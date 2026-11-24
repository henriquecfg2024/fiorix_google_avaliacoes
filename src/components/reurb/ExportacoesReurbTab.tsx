'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileJson,
  FolderOutput,
  FolderSync,
  Loader2,
  Printer,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ReurbExportacaoDTO } from '@/lib/reurb/types';
import { ComprovanteExportacaoModal } from './ComprovanteExportacaoModal';
import { gerarPdfComprovanteExportacaoReurb } from './reurb-comprovante-pdf';
import {
  gerarZipReurbPorMes,
  isFileSystemAccessSupported,
  pickReurbRootDirectory,
  resolveCompetenciaExportacao,
  salvarArquivosReurbEmPastasExistentes,
  type ReurbBatchMode,
  type ReurbBatchProgress,
  type ReurbBatchSummary,
} from './reurb-batch-folders';
import {
  MESES_NOMES,
  buildAnosDisponiveis,
  formatarDataHoraBr,
  gerarHtmlComprovanteExportacaoReurb,
  imprimirHtmlA4,
  isExportacaoElegivelComprovante,
  labelStatusImportacaoOnr,
  triggerDownloadBlob,
} from './reurb-ui-helpers';

interface ConfirmOnrTarget {
  exportacao: ReurbExportacaoDTO;
  protocoloOnrExterno: string;
  observacao: string;
}

type FiltroSituacaoOnr = 'TODAS' | 'CONFIRMADA_ONR' | 'PENDENTE_CONFIRMACAO';

interface ExportacoesReurbTabProps {
  selectedIds: string[];
  canExportJson: boolean;
  canConfirmImport: boolean;
  isReadOnly: boolean;
  incluirArt69: boolean;
  generating: boolean;
  refreshKey: number;
  onToggleArt69: (checked: boolean) => void;
  onGerarLote: () => void;
  onClearSelection: () => void;
  onIrParaProcessos: () => void;
  onDataChanged: () => void;
}

export function ExportacoesReurbTab({
  selectedIds,
  canExportJson,
  canConfirmImport,
  isReadOnly,
  incluirArt69,
  generating,
  refreshKey,
  onToggleArt69,
  onGerarLote,
  onClearSelection,
  onIrParaProcessos,
  onDataChanged,
}: ExportacoesReurbTabProps) {
  const [historico, setHistorico] = useState<ReurbExportacaoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmOnrTarget | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [previewComprovante, setPreviewComprovante] = useState<ReurbExportacaoDTO | null>(null);
  const printCleanupRef = useRef<(() => void) | null>(null);

  const [filtroAno, setFiltroAno] = useState<number | 'todos'>(() => new Date().getFullYear());
  const [filtroMes, setFiltroMes] = useState<number | 'todos'>('todos');
  const [filtroSituacaoOnr, setFiltroSituacaoOnr] = useState<FiltroSituacaoOnr>('TODAS');
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<ReurbBatchProgress | null>(null);
  const [batchSummary, setBatchSummary] = useState<ReurbBatchSummary | null>(null);

  const anosDisponiveis = useMemo(() => buildAnosDisponiveis(new Date().getFullYear()), []);

  useEffect(() => {
    return () => {
      printCleanupRef.current?.();
      printCleanupRef.current = null;
    };
  }, []);

  function handleImprimirComprovante(exp: ReurbExportacaoDTO) {
    if (!isExportacaoElegivelComprovante(exp)) return;
    printCleanupRef.current?.();
    printCleanupRef.current = imprimirHtmlA4(gerarHtmlComprovanteExportacaoReurb(exp));
  }

  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '250' });
      if (filtroAno !== 'todos') {
        params.set('ano', String(filtroAno));
      }
      if (filtroMes !== 'todos') {
        params.set('mes', String(filtroMes));
      }
      const expRes = await fetch(`/api/reurb/exportacoes?${params.toString()}`, {
        cache: 'no-store',
      });
      const expBody = await expRes.json();
      if (expRes.ok && Array.isArray(expBody?.exportacoes)) {
        setHistorico(expBody.exportacoes);
        setSelectedExportIds([]);
      }
    } catch {
      toast.error('Falha ao carregar histórico de exportações.');
    } finally {
      setLoading(false);
    }
  }, [filtroAno, filtroMes]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico, refreshKey]);

  const historicoFiltrado = useMemo(() => {
    return historico.filter((exp) => {
      if (filtroSituacaoOnr === 'CONFIRMADA_ONR' && exp.statusImportacaoOnr !== 'CONFIRMADA_ONR') {
        return false;
      }
      if (
        filtroSituacaoOnr === 'PENDENTE_CONFIRMACAO' &&
        exp.statusImportacaoOnr === 'CONFIRMADA_ONR'
      ) {
        return false;
      }
      if (filtroAno !== 'todos' || filtroMes !== 'todos') {
        const comp = resolveCompetenciaExportacao(exp);
        if (!comp) return false;
        if (filtroAno !== 'todos' && comp.ano !== filtroAno) return false;
        if (filtroMes !== 'todos' && comp.mes !== filtroMes) return false;
      }
      return true;
    });
  }, [historico, filtroAno, filtroMes, filtroSituacaoOnr]);

  const alvosLote = useMemo(() => {
    if (selectedExportIds.length === 0) return historicoFiltrado;
    const idSet = new Set(selectedExportIds);
    return historicoFiltrado.filter((exp) => idSet.has(exp.id));
  }, [historicoFiltrado, selectedExportIds]);

  const allVisibleSelected =
    historicoFiltrado.length > 0 &&
    historicoFiltrado.every((exp) => selectedExportIds.includes(exp.id));

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedExportIds([]);
      return;
    }
    setSelectedExportIds(historicoFiltrado.map((exp) => exp.id));
  }

  function toggleRowSelection(id: string) {
    setSelectedExportIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  const fetchJsonBytes = useCallback(async (exportacaoId: string): Promise<Uint8Array> => {
    const res = await fetch(
      `/api/reurb/exportacoes/${encodeURIComponent(exportacaoId)}/download`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      throw new Error(`Falha HTTP ${res.status} ao baixar JSON da exportação.`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }, []);

  async function handleSalvarEmPastas(mode: ReurbBatchMode) {
    if (batchRunning) return;
    if (alvosLote.length === 0) {
      toast.error('Nenhuma exportação disponível no filtro/seleção atual.');
      return;
    }
    if (!isFileSystemAccessSupported()) {
      toast.error(
        'Este navegador não permite escrita direta em pastas locais. Use o botão "Baixar ZIP por mês".'
      );
      return;
    }

    let rootDir;
    try {
      rootDir = await pickReurbRootDirectory();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      toast.error('Não foi possível acessar a pasta selecionada.');
      return;
    }

    setBatchRunning(true);
    setBatchSummary(null);
    setBatchProgress({ atual: 0, total: alvosLote.length, arquivoAtual: 'Iniciando...' });
    try {
      const summary = await salvarArquivosReurbEmPastasExistentes({
        exportacoes: alvosLote,
        mode,
        rootDir,
        fetchJsonBytes,
        generatePdfBytes: (exp) => gerarPdfComprovanteExportacaoReurb(exp),
        onProgress: setBatchProgress,
      });
      setBatchSummary(summary);
      if (summary.salvos > 0 && summary.erros === 0 && summary.semPasta === 0) {
        toast.success(`${summary.salvos} arquivo(s) salvo(s) diretamente nas pastas existentes.`);
      } else if (summary.salvos > 0) {
        toast.success(
          `${summary.salvos} salvo(s) · ${summary.ignoradosExistentes} já existente(s) · ${summary.semPasta} sem pasta.`
        );
      } else if (summary.semPasta > 0) {
        toast.error(
          `Nenhuma pasta mensal encontrada (${summary.pastasAusentes.join(', ')}) em "${summary.rootDirName}". Nenhuma pasta nova foi criada.`
        );
      } else {
        toast.info('Nenhum arquivo novo precisou ser gravado (já existentes ou não elegíveis).');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gravar arquivos em lote.');
    } finally {
      setBatchRunning(false);
      setBatchProgress(null);
    }
  }

  async function handleBaixarZipPorMes(mode: ReurbBatchMode = 'ambos') {
    if (batchRunning) return;
    if (alvosLote.length === 0) {
      toast.error('Nenhuma exportação disponível no filtro/seleção atual.');
      return;
    }

    setBatchRunning(true);
    setBatchProgress({ atual: 0, total: alvosLote.length, arquivoAtual: 'Montando ZIP...' });
    try {
      const result = await gerarZipReurbPorMes({
        exportacoes: alvosLote,
        mode,
        fetchJsonBytes,
        generatePdfBytes: (exp) => gerarPdfComprovanteExportacaoReurb(exp),
        onProgress: setBatchProgress,
      });
      if (result.totalArquivos === 0) {
        toast.error('Nenhum arquivo elegível encontrado para gerar o pacote ZIP.');
        return;
      }
      const anoLabel = filtroAno === 'todos' ? 'todos' : String(filtroAno);
      const mesLabel =
        filtroMes === 'todos' ? 'todos' : String(filtroMes).padStart(2, '0');
      const zipName = `reurb_${anoLabel}_${mesLabel}.zip`;
      triggerDownloadBlob(result.blob, zipName, 'application/zip');
      toast.success(`Pacote ZIP gerado com ${result.totalArquivos} arquivo(s) por mês.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao gerar pacote ZIP por mês.');
    } finally {
      setBatchRunning(false);
      setBatchProgress(null);
    }
  }

  async function handleConfirmarImportacaoOnr() {
    if (!confirmTarget || confirming) return;
    setConfirming(true);
    try {
      const res = await fetch(
        `/api/reurb/exportacoes/${encodeURIComponent(confirmTarget.exportacao.id)}/confirmar-importacao`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            protocoloOnrExterno: confirmTarget.protocoloOnrExterno.trim() || null,
            observacao: confirmTarget.observacao.trim() || null,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        toast.error(body?.error || 'Não foi possível confirmar a importação no Ofício Eletrônico.');
        return;
      }
      toast.success('Importação manual no Ofício Eletrônico registrada no histórico.');
      setConfirmTarget(null);
      onDataChanged();
      carregarHistorico();
    } catch {
      toast.error('Erro ao registrar confirmação manual no Ofício Eletrônico.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra compacta de lote ou atalho para seleção */}
      {selectedIds.length > 0 ? (
        <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-100">
            <strong className="text-emerald-300">{selectedIds.length}</strong> regularização(ões) selecionada(s) para geração do arquivo JSON em lote.
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirArt69}
                onChange={(e) => onToggleArt69(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              Incluir Art. 69 (escopo municipal confirmado)
            </label>
            <button
              type="button"
              onClick={onIrParaProcessos}
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Alterar seleção
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-slate-300 hover:bg-white/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar seleção
            </button>
            <button
              type="button"
              disabled={!canExportJson || isReadOnly || generating}
              onClick={onGerarLote}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4" />
              )}
              Gerar JSON em lote
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#0D1322] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-300">
            Para gerar um novo arquivo JSON em lote, selecione as regularizações desejadas na aba{' '}
            <strong className="text-white">Painel e Processos</strong>.
          </span>
          <button
            type="button"
            onClick={onIrParaProcessos}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-200 hover:bg-emerald-500/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Selecionar processos
          </button>
        </div>
      )}

      {/* Histórico de exportações e salvamento em lote nas pastas por mês */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="p-4 border-b border-white/10 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">
                Histórico de exportações JSON e importação no Ofício Eletrônico
              </h2>
              <p className="text-xs text-slate-400">
                Selecione <span className="font-mono text-slate-300">W:\REURB</span>, o ano (<span className="font-mono text-slate-300">2026</span>) ou diretamente a pasta do mês (<span className="font-mono text-slate-300">09-SETEMBRO</span>) para salvar pela <strong className="text-slate-200">data de registro</strong>, sem criar pastas novas nem sobrescrever arquivos existentes.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <label htmlFor="reurb-exp-ano" className="text-slate-400">
                  Ano (Registro)
                </label>
                <select
                  id="reurb-exp-ano"
                  value={filtroAno === 'todos' ? 'todos' : String(filtroAno)}
                  onChange={(e) =>
                    setFiltroAno(e.target.value === 'todos' ? 'todos' : Number(e.target.value))
                  }
                  className="rounded-xl border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-white"
                >
                  <option value="todos">Todos os anos</option>
                  {anosDisponiveis.map((ano) => (
                    <option key={ano} value={ano}>
                      {ano}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="reurb-exp-mes" className="text-slate-400">
                  Mês (Registro)
                </label>
                <select
                  id="reurb-exp-mes"
                  value={filtroMes === 'todos' ? 'todos' : String(filtroMes)}
                  onChange={(e) =>
                    setFiltroMes(e.target.value === 'todos' ? 'todos' : Number(e.target.value))
                  }
                  className="rounded-xl border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-white"
                >
                  <option value="todos">Todos os meses</option>
                  {MESES_NOMES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {String(m.value).padStart(2, '0')} - {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <select
                aria-label="Filtrar por situação no Ofício Eletrônico"
                value={filtroSituacaoOnr}
                onChange={(e) => setFiltroSituacaoOnr(e.target.value as FiltroSituacaoOnr)}
                className="rounded-xl border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-white"
              >
                <option value="TODAS">Todas situações ONR</option>
                <option value="CONFIRMADA_ONR">Importada no Ofício Eletrônico</option>
                <option value="PENDENTE_CONFIRMACAO">Aguardando confirmação</option>
              </select>
            </div>
          </div>

          {/* Barra de ações em lote nas pastas por mês */}
          <div className="rounded-xl border border-white/10 bg-[#070A12]/80 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-300">
              {selectedExportIds.length > 0 ? (
                <>
                  <strong className="text-emerald-300">{alvosLote.length}</strong> exportação(ões) marcada(s) para salvamento em lote
                </>
              ) : (
                <>
                  Alvo do lote: <strong className="text-white">{alvosLote.length}</strong> exportação(ões) do filtro atual
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={batchRunning || alvosLote.length === 0}
                onClick={() => handleSalvarEmPastas('comprovantes')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-600/20 px-3 py-1.5 font-semibold text-emerald-100 hover:bg-emerald-600/35 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <FolderOutput className="h-3.5 w-3.5" />
                Salvar Comprovantes PDF em lote
              </button>

              <button
                type="button"
                disabled={batchRunning || alvosLote.length === 0}
                onClick={() => handleSalvarEmPastas('jsons')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-600/20 px-3 py-1.5 font-semibold text-cyan-100 hover:bg-cyan-600/35 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <FolderSync className="h-3.5 w-3.5" />
                Salvar JSONs em lote (por mês)
              </button>

              <button
                type="button"
                disabled={batchRunning || alvosLote.length === 0}
                onClick={() => handleSalvarEmPastas('ambos')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-400/40 bg-indigo-600/25 px-3 py-1.5 font-semibold text-indigo-100 hover:bg-indigo-600/40 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <FolderOutput className="h-3.5 w-3.5" />
                Salvar JSONs + Comprovantes
              </button>

              <button
                type="button"
                disabled={batchRunning || alvosLote.length === 0}
                onClick={() => handleBaixarZipPorMes('ambos')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Archive className="h-3.5 w-3.5" />
                Baixar ZIP por mês
              </button>
            </div>
          </div>

          {batchProgress && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              <span>
                Processando {batchProgress.atual} de {batchProgress.total}:{' '}
                <strong className="font-mono">{batchProgress.arquivoAtual}</strong>
              </span>
            </div>
          )}

          {batchSummary && (
            <div className="rounded-xl border border-white/15 bg-white/[0.03] px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3 text-slate-200">
                <span>
                  <strong className="text-emerald-300">{batchSummary.salvos}</strong> salvo(s)
                </span>
                <span>
                  <strong className="text-slate-300">{batchSummary.ignoradosExistentes}</strong> já existente(s) ignorado(s)
                </span>
                {batchSummary.semPasta > 0 && (
                  <span className="text-amber-300">
                    <strong>{batchSummary.semPasta}</strong> sem pasta existente ({batchSummary.pastasAusentes.join(', ')})
                  </span>
                )}
                {batchSummary.semDataRegistro > 0 && (
                  <span className="text-amber-300">
                    <strong>{batchSummary.semDataRegistro}</strong> sem data de registro
                  </span>
                )}
                {batchSummary.naoElegiveis > 0 && (
                  <span className="text-slate-400">
                    <strong>{batchSummary.naoElegiveis}</strong> não elegível(is)
                  </span>
                )}
                {batchSummary.erros > 0 && (
                  <span className="text-rose-300">
                    <strong>{batchSummary.erros}</strong> erro(s)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setBatchSummary(null)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Ocultar resumo
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="pl-4 pr-2 py-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas exportações listadas"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-3.5 w-3.5 rounded accent-emerald-500"
                  />
                </th>
                <th className="px-4 py-3">Data / Operador</th>
                <th className="px-4 py-3">Tipo / Arquivo</th>
                <th className="px-4 py-3">Geração FIORIX</th>
                <th className="px-4 py-3">Importação Ofício Eletrônico</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Carregando histórico de exportações...
                  </td>
                </tr>
              ) : historicoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Nenhuma exportação encontrada para o período/filtro selecionado.
                  </td>
                </tr>
              ) : (
                historicoFiltrado.map((exp) => {
                  const comp = resolveCompetenciaExportacao(exp);
                  const checked = selectedExportIds.includes(exp.id);
                  return (
                    <tr key={exp.id} className={checked ? 'bg-emerald-500/[0.05]' : undefined}>
                      <td className="pl-4 pr-2 py-3 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar exportação ${exp.nomeArquivoJson || exp.id}`}
                          checked={checked}
                          onChange={() => toggleRowSelection(exp.id)}
                          className="h-3.5 w-3.5 rounded accent-emerald-500 mt-0.5"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{formatarDataHoraBr(exp.createdAt)}</div>
                        <div className="text-[11px] text-slate-400">{exp.geradoPorNome || 'Operador'}</div>
                        {comp && (
                          <div className="text-[10px] text-emerald-300/90 mt-0.5">
                            Pasta Registro: {String(comp.mes).padStart(2, '0')}/{comp.ano}
                            {comp.mista ? ' (mista)' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">
                          {exp.tipo === 'UNITARIA' ? 'Unitária' : 'Em Lote'} ·{' '}
                          {exp.qtdAptasGeradas} apta(s) / {exp.qtdBarradas} barrada(s)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {exp.nomeArquivoJson || exp.erroDetalhe || 'Sem arquivo gerado'}
                          {exp.ocrConsultado ? ' · OCR SiplanIA consultado' : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {exp.statusGeracao === 'GERADO' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> JSON Gerado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
                            <XCircle className="h-3 w-3" /> Falha
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {exp.statusImportacaoOnr === 'CONFIRMADA_ONR' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200">
                              <FileCheck2 className="h-3 w-3" /> Importada no Ofício Eletrônico
                            </span>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {formatarDataHoraBr(exp.confirmadoImportacaoEm)}
                              {exp.protocoloOnrExterno ? ` · Prot. ${exp.protocoloOnrExterno}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-300">
                            {labelStatusImportacaoOnr(exp.statusImportacaoOnr)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        {exp.statusGeracao === 'GERADO' && exp.nomeArquivoJson && (
                          <a
                            href={`/api/reurb/exportacoes/${encodeURIComponent(exp.id)}/download`}
                            title="Baixar arquivo JSON desta exportação"
                            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10"
                          >
                            <Download className="h-3 w-3" /> JSON
                          </a>
                        )}
                        {isExportacaoElegivelComprovante(exp) && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPreviewComprovante(exp)}
                              title="Visualizar comprovante de geração JSON sem pendências"
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                            >
                              <Eye className="h-3 w-3" /> Visualizar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleImprimirComprovante(exp)}
                              title="Imprimir comprovante de geração JSON sem pendências"
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
                            >
                              <Printer className="h-3 w-3" /> Comprovante
                            </button>
                          </>
                        )}
                        {exp.qtdBarradas > 0 && exp.nomeArquivoPendencias && (
                          <a
                            href={`/api/reurb/exportacoes/${encodeURIComponent(exp.id)}/download?tipo=pendencias`}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200 hover:bg-amber-500/20"
                          >
                            <Download className="h-3 w-3" /> Pendências
                          </a>
                        )}
                        {exp.statusGeracao === 'GERADO' &&
                          exp.statusImportacaoOnr !== 'CONFIRMADA_ONR' &&
                          canConfirmImport &&
                          !isReadOnly && (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmTarget({
                                  exportacao: exp,
                                  protocoloOnrExterno: '',
                                  observacao: '',
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/25"
                            >
                              Confirmar no Ofício Eletrônico
                            </button>
                          )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Confirmação Manual Ofício Eletrônico */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-[#0D1322] p-6 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
              <ShieldAlert className="h-5 w-5" />
              Confirmar importação manual no Ofício Eletrônico
            </div>
            <p className="text-slate-300">
              Arquivo: <strong className="text-white">{confirmTarget.exportacao.nomeArquivoJson}</strong>
            </p>
            <div>
              <label className="block text-slate-400 mb-1">
                Protocolo / Recibo do Ofício Eletrônico (opcional)
              </label>
              <input
                type="text"
                value={confirmTarget.protocoloOnrExterno}
                onChange={(e) =>
                  setConfirmTarget({ ...confirmTarget, protocoloOnrExterno: e.target.value })
                }
                placeholder="Ex.: OFICIO-REURB-2026-8841"
                className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Observação (opcional)</label>
              <textarea
                rows={3}
                value={confirmTarget.observacao}
                onChange={(e) =>
                  setConfirmTarget({ ...confirmTarget, observacao: e.target.value })
                }
                placeholder="Importado sem erros no portal do Ofício Eletrônico."
                className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="rounded-xl border border-white/15 px-4 py-2 text-slate-300 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={confirming}
                onClick={handleConfirmarImportacaoOnr}
                className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {confirming ? 'Salvando...' : 'Registrar confirmação no Ofício Eletrônico'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ComprovanteExportacaoModal
        exportacao={previewComprovante}
        onClose={() => setPreviewComprovante(null)}
      />
    </div>
  );
}

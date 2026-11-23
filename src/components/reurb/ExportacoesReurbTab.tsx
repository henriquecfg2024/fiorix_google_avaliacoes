'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileJson,
  Loader2,
  Printer,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ReurbExportacaoDTO, ReurbRegularizacaoResumo } from '@/lib/reurb/types';
import { ComprovanteExportacaoModal } from './ComprovanteExportacaoModal';
import {
  formatarDataBr,
  formatarDataHoraBr,
  gerarHtmlComprovanteExportacaoReurb,
  imprimirHtmlA4,
  isExportacaoElegivelComprovante,
  labelModalidade,
  labelStatusImportacaoOnr,
  triggerDownloadBlob,
} from './reurb-ui-helpers';

interface MixedModalData {
  aptasCount: number;
  barradasCount: number;
  aptas: Array<{ id: string; matricula: number; protocolo: string; empreendimento: string | null }>;
  barradas: Array<{
    matricula: number;
    protocolo: string;
    empreendimento: string | null;
    bloqueios: Array<{ campo: string; motivo: string }>;
  }>;
}

function formatarBloqueiosAgrupados(
  bloqueios: Array<{ campo: string; motivo: string }>,
  separador = ' | '
): string {
  const counts = new Map<string, { texto: string; qtd: number }>();
  for (const bl of bloqueios) {
    const chave = `${bl.campo}|${bl.motivo}`;
    const prev = counts.get(chave);
    if (prev) {
      prev.qtd += 1;
    } else {
      counts.set(chave, { texto: `${bl.campo}: ${bl.motivo}`, qtd: 1 });
    }
  }
  return Array.from(counts.values())
    .map((item) => (item.qtd > 1 ? `${item.texto} (×${item.qtd})` : item.texto))
    .join(separador);
}

interface ConfirmOnrTarget {
  exportacao: ReurbExportacaoDTO;
  protocoloOnrExterno: string;
  observacao: string;
}

interface ExportacoesReurbTabProps {
  selectedIds: string[];
  canExportJson: boolean;
  canConfirmImport: boolean;
  isReadOnly: boolean;
  refreshKey: number;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onOpenDetalhe: (id: string) => void;
  onDataChanged: () => void;
}

export function ExportacoesReurbTab({
  selectedIds,
  canExportJson,
  canConfirmImport,
  isReadOnly,
  refreshKey,
  onToggleSelect,
  onClearSelection,
  onOpenDetalhe,
  onDataChanged,
}: ExportacoesReurbTabProps) {
  const [catalogo, setCatalogo] = useState<ReurbRegularizacaoResumo[]>([]);
  const [historico, setHistorico] = useState<ReurbExportacaoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [incluirArt69, setIncluirArt69] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [blockedList, setBlockedList] = useState<
    Array<{ matricula: number; protocolo: string; bloqueios: Array<{ campo: string; motivo: string }> }>
  >([]);
  const [mixedModal, setMixedModal] = useState<MixedModalData | null>(null);
  const [lastLocalJson, setLastLocalJson] = useState<{
    id: string;
    fileName: string;
    content: string;
  } | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmOnrTarget | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [lastEligibleExportacao, setLastEligibleExportacao] = useState<ReurbExportacaoDTO | null>(
    null
  );
  const [previewComprovante, setPreviewComprovante] = useState<ReurbExportacaoDTO | null>(null);
  const printCleanupRef = useRef<(() => void) | null>(null);

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

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const [procRes, expRes] = await Promise.all([
        fetch('/api/reurb/processos?ano=todos&pageSize=100', { cache: 'no-store' }),
        fetch('/api/reurb/exportacoes', { cache: 'no-store' }),
      ]);
      const procBody = await procRes.json();
      const expBody = await expRes.json();
      if (procRes.ok && Array.isArray(procBody?.itens)) {
        setCatalogo(procBody.itens);
      }
      if (expRes.ok && Array.isArray(expBody?.exportacoes)) {
        setHistorico(expBody.exportacoes);
      }
    } catch {
      toast.error('Falha ao carregar lista de processos e histórico de exportações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados, refreshKey]);

  const selectedSet = new Set(selectedIds);
  const selecionados = catalogo.filter((c) => selectedSet.has(c.id));
  const qtdAptosSel = selecionados.filter((s) => s.situacaoValidacao === 'APTO').length;
  const qtdPendentesSel = selecionados.length - qtdAptosSel;

  async function executarGeracaoLote(confirmarMisto: boolean) {
    if (selectedIds.length === 0 || generating) return;
    setGenerating(true);
    setErrorBanner(null);
    setBlockedList([]);
    setLastEligibleExportacao(null);

    try {
      const res = await fetch('/api/reurb/exportacoes/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          confirmarMisto,
          incluirArt69,
        }),
      });
      const body = await res.json();

      if (res.status === 409 && body?.requerConfirmacaoMista) {
        setMixedModal({
          aptasCount: body.aptasCount,
          barradasCount: body.barradasCount,
          aptas: body.aptas || [],
          barradas: body.barradas || [],
        });
        return;
      }

      setMixedModal(null);

      if (!res.ok || !body?.ok) {
        const msg = body?.error || 'Falha ao gerar arquivo JSON para o Ofício Eletrônico.';
        setErrorBanner(msg);
        if (Array.isArray(body?.barradas)) {
          setBlockedList(body.barradas);
        }
        toast.error(msg);
        carregarDados();
        return;
      }

      if (body.jsonString && body.exportacao?.nomeArquivoJson) {
        setLastLocalJson({
          id: body.exportacao.id,
          fileName: body.exportacao.nomeArquivoJson,
          content: body.jsonString,
        });
        triggerDownloadBlob(body.jsonString, body.exportacao.nomeArquivoJson);
      }
      if (body.relatorioPendencias && body.exportacao?.nomeArquivoPendencias) {
        triggerDownloadBlob(
          JSON.stringify(body.relatorioPendencias, null, 2),
          body.exportacao.nomeArquivoPendencias
        );
      }

      toast.success(
        `JSON do Ofício Eletrônico v1.4 gerado com ${body.exportacao?.qtdAptasGeradas ?? 0} regularização(ões) apta(s).`
      );
      if (isExportacaoElegivelComprovante(body.exportacao)) {
        setLastEligibleExportacao(body.exportacao);
      }
      onDataChanged();
      carregarDados();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao gerar lote JSON.';
      setErrorBanner(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
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
      carregarDados();
    } catch {
      toast.error('Erro ao registrar confirmação manual no Ofício Eletrônico.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      {errorBanner && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2 text-xs text-rose-200">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <XCircle className="h-4 w-4" />
            <span>{errorBanner}</span>
          </div>
          {blockedList.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {blockedList.map((b) => (
                <div key={b.matricula} className="rounded-lg border border-rose-500/25 bg-[#070A12] p-2">
                  <strong>Matrícula {b.matricula} (Prot. {b.protocolo}):</strong>{' '}
                  {formatarBloqueiosAgrupados(b.bloqueios, ' | ')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {lastEligibleExportacao && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              <strong>{lastEligibleExportacao.nomeArquivoJson}</strong> gerado sem pendências (
              {lastEligibleExportacao.qtdAptasGeradas} regularização(ões) ·{' '}
              {lastEligibleExportacao.qtdDerivadasIncluidas} derivada(s)).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewComprovante(lastEligibleExportacao)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 font-semibold text-cyan-100 hover:bg-cyan-500/25"
            >
              <Eye className="h-3.5 w-3.5" />
              Visualizar comprovante
            </button>
            <button
              type="button"
              onClick={() => handleImprimirComprovante(lastEligibleExportacao)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 font-semibold text-emerald-100 hover:bg-emerald-500/30"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir comprovante
            </button>
            <button
              type="button"
              onClick={() => setLastEligibleExportacao(null)}
              className="rounded-lg border border-white/15 px-2.5 py-1.5 text-slate-300 hover:bg-white/10"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Seleção do lote */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white">Seleção do lote — Ofício Eletrônico</h2>
            <p className="text-xs text-slate-400">
              {selectedIds.length} selecionada(s) ·{' '}
              <span className="text-emerald-300 font-semibold">{qtdAptosSel} apta(s)</span> ·{' '}
              <span className="text-amber-300 font-semibold">{qtdPendentesSel} com pendência(s)</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirArt69}
                onChange={(e) => setIncluirArt69(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              Incluir Art. 69 (escopo municipal confirmado)
            </label>

            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
              >
                Limpar seleção
              </button>
            )}

            <button
              type="button"
              disabled={!canExportJson || isReadOnly || selectedIds.length === 0 || generating}
              onClick={() => executarGeracaoLote(false)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4" />
              )}
              Gerar JSON em lote — Ofício Eletrônico
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-4 py-3 w-10">Incluir</th>
                <th className="px-4 py-3">Matrícula / Protocolo</th>
                <th className="px-4 py-3">Empreendimento / Modalidade</th>
                <th className="px-4 py-3">Registro</th>
                <th className="px-4 py-3">Derivadas</th>
                <th className="px-4 py-3">Aptidão</th>
                <th className="px-4 py-3">Status no Ofício Eletrônico</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    Carregando regularizações...
                  </td>
                </tr>
              ) : catalogo.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    Nenhuma regularização sincronizada no banco até o momento.
                  </td>
                </tr>
              ) : (
                catalogo.map((reg) => (
                  <tr key={reg.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedSet.has(reg.id)}
                        onChange={() => onToggleSelect(reg.id)}
                        className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-white">{reg.matricula}</div>
                      <div className="text-[11px] text-slate-400">Prot. {reg.protocolo}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-slate-200">{reg.empreendimento || 'Não informado'}</div>
                      <div className="text-[11px] text-slate-400">{labelModalidade(reg.modalidade)}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">{formatarDataBr(reg.dataRegistro)}</td>
                    <td className="px-4 py-2.5 text-slate-200">{reg.qtdDerivadasLista}</td>
                    <td className="px-4 py-2.5">
                      {reg.situacaoValidacao === 'APTO' ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 font-semibold">
                          Apto
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300 font-semibold">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-300">
                      {labelStatusImportacaoOnr(reg.statusImportacaoOnr)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenDetalhe(reg.id)}
                        className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white hover:bg-white/10"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico de exportações e confirmação manual no Ofício Eletrônico */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-white">Histórico de exportações JSON e importação no Ofício Eletrônico</h2>
          <p className="text-xs text-slate-400">
            Registro auditável de arquivos gerados, falhas de revalidação e confirmação manual no Ofício Eletrônico.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Data / Operador</th>
                <th className="px-4 py-3">Tipo / Arquivo</th>
                <th className="px-4 py-3">Geração FIORIX</th>
                <th className="px-4 py-3">Importação Ofício Eletrônico</th>
                <th className="px-4 py-3 text-right">Downloads & Confirmação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {historico.length === 0 && !lastLocalJson ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Nenhuma exportação registrada ainda.
                  </td>
                </tr>
              ) : (
                historico.map((exp) => (
                  <tr key={exp.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{formatarDataHoraBr(exp.createdAt)}</div>
                      <div className="text-[11px] text-slate-400">{exp.geradoPorNome || 'Operador'}</div>
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
                      {exp.statusGeracao === 'GERADO' && (
                        <a
                          href={`/api/reurb/exportacoes/${encodeURIComponent(exp.id)}/download?tipo=json`}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white hover:bg-white/10"
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Lote Misto (409) */}
      {mixedModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-amber-500/40 bg-[#0D1322] p-6 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
              <AlertTriangle className="h-5 w-5" />
              Lote contém processos aptos e pendentes
            </div>
            <p className="text-slate-300">
              Foram identificadas <strong>{mixedModal.aptasCount}</strong> regularização(ões) apta(s) e{' '}
              <strong className="text-amber-300">{mixedModal.barradasCount}</strong> com pendência(s) bloqueante(s). Deseja gerar o JSON do Ofício Eletrônico v1.4 apenas com as aptas e baixar o relatório de pendências para as barradas?
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {mixedModal.barradas.map((b) => (
                <div key={b.matricula} className="rounded-lg border border-white/10 bg-[#070A12] p-2.5">
                  <div className="font-bold text-amber-200">
                    Barrada: Matrícula {b.matricula} (Prot. {b.protocolo})
                  </div>
                  <div className="text-slate-300 mt-0.5">
                    {formatarBloqueiosAgrupados(b.bloqueios, ' · ')}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMixedModal(null)}
                className="rounded-xl border border-white/15 px-4 py-2 text-slate-300 hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={() => executarGeracaoLote(true)}
                className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Prosseguir apenas com os {mixedModal.aptasCount} apto(s)
              </button>
            </div>
          </div>
        </div>
      )}

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
              <label className="block text-slate-400 mb-1">Protocolo / Recibo do Ofício Eletrônico (opcional)</label>
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

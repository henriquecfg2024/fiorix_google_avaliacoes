'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  FileJson,
  LayoutDashboard,
  Loader2,
  Printer,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ReurbConsultaFiltros, ReurbExportacaoDTO } from '@/lib/reurb/types';
import { ComprovanteExportacaoModal } from './ComprovanteExportacaoModal';
import { ExportacoesReurbTab } from './ExportacoesReurbTab';
import { PainelReurbTab } from './PainelReurbTab';
import { ProcessoDetalheModal } from './ProcessoDetalheModal';
import { RelatoriosReurbTab } from './RelatoriosReurbTab';
import {
  formatarBloqueiosAgrupados,
  gerarHtmlComprovanteExportacaoReurb,
  imprimirHtmlA4,
  isExportacaoElegivelComprovante,
  triggerDownloadBlob,
} from './reurb-ui-helpers';

type ReurbTabKey = 'painel' | 'exportacoes' | 'relatorios';

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

interface CentralReurbClientProps {
  initialAno: number;
  initialMes: number;
  demoMode: boolean;
  permissoes: {
    canExportJson: boolean;
    canConfirmImport: boolean;
    isReadOnly: boolean;
  };
  userRole: string;
}

export function CentralReurbClient({
  initialAno,
  initialMes,
  demoMode,
  permissoes,
  userRole,
}: CentralReurbClientProps) {
  const isMaster = userRole.toUpperCase() === 'MASTER';
  const [abaAtiva, setAbaAtiva] = useState<ReurbTabKey>('painel');
  const [filtros, setFiltros] = useState<ReurbConsultaFiltros>({
    ano: initialAno,
    mes: initialMes,
    tipoData: 'registro',
    modalidade: 'TODAS',
    situacao: 'TODAS',
    page: 1,
    pageSize: 50,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [incluirArt69, setIncluirArt69] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loteErrorBanner, setLoteErrorBanner] = useState<string | null>(null);
  const [loteBlockedList, setLoteBlockedList] = useState<
    Array<{ matricula: number; protocolo: string; bloqueios: Array<{ campo: string; motivo: string }> }>
  >([]);
  const [mixedModal, setMixedModal] = useState<MixedModalData | null>(null);
  const [lastEligibleExportacao, setLastEligibleExportacao] = useState<ReurbExportacaoDTO | null>(
    null
  );
  const [previewComprovante, setPreviewComprovante] = useState<ReurbExportacaoDTO | null>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const printCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      printCleanupRef.current?.();
      printCleanupRef.current = null;
    };
  }, []);

  function handleUpdateFiltros(patch: Partial<ReurbConsultaFiltros>) {
    setFiltros((prev) => ({ ...prev, ...patch }));
  }

  function handleChangePeriodoRelatorios(nextAno: number, nextMes: number | 'todos') {
    setFiltros((prev) => ({
      ...prev,
      ano: nextAno,
      mes: nextMes,
      dataDe: null,
      dataAte: null,
      page: 1,
    }));
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSelectMany(ids: string[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return Array.from(next);
    });
  }

  async function executarGeracaoLote(confirmarMisto: boolean) {
    if (selectedIds.length === 0 || generating || !permissoes.canExportJson || permissoes.isReadOnly) {
      return;
    }
    setGenerating(true);
    setLoteErrorBanner(null);
    setLoteBlockedList([]);
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
        setLoteErrorBanner(msg);
        if (Array.isArray(body?.barradas)) {
          setLoteBlockedList(body.barradas);
        }
        toast.error(msg);
        setRefreshKey((k) => k + 1);
        return;
      }

      if (body.jsonString && body.exportacao?.nomeArquivoJson) {
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
      setSelectedIds([]);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado ao gerar lote JSON.';
      setLoteErrorBanner(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  const tabs: Array<{ id: ReurbTabKey; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'painel', label: 'Painel e Processos', icon: LayoutDashboard },
    { id: 'exportacoes', label: 'Exportações', icon: FileJson },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header Central REURB */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Building2 className="h-6 w-6 text-emerald-400" />
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Central REURB</h1>
            {demoMode && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200">
                Modo demonstração controlado
              </span>
            )}
            {permissoes.isReadOnly && (
              <span className="rounded-full border border-slate-500/40 bg-slate-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                Somente leitura
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Regularização Fundiária Urbana (WEBRI + OCR SiplanIA) · Leiaute Importar em Lote do Ofício Eletrônico v1.4
          </p>
        </div>

        {selectedIds.length > 0 && permissoes.canExportJson && !permissoes.isReadOnly && (
          <button
            type="button"
            disabled={generating}
            onClick={() => executarGeracaoLote(false)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4" />
            )}
            Gerar JSON em lote ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Navegação em 3 abas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAbaAtiva(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                active
                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === 'exportacoes' && selectedIds.length > 0 && (
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                  {selectedIds.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Feedbacks globais de geração JSON em lote */}
      {loteErrorBanner && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2 text-xs text-rose-200">
          <div className="flex items-center justify-between gap-2 font-bold text-rose-300">
            <span className="inline-flex items-center gap-2">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{loteErrorBanner}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setLoteErrorBanner(null);
                setLoteBlockedList([]);
              }}
              className="rounded-lg border border-rose-400/30 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20"
            >
              Fechar
            </button>
          </div>
          {loteBlockedList.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {loteBlockedList.map((b) => (
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewComprovante(lastEligibleExportacao)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 font-semibold text-cyan-100 hover:bg-cyan-500/25"
            >
              Visualizar comprovante
            </button>
            <button
              type="button"
              onClick={() => {
                printCleanupRef.current?.();
                printCleanupRef.current = imprimirHtmlA4(
                  gerarHtmlComprovanteExportacaoReurb(lastEligibleExportacao)
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 font-semibold text-emerald-100 hover:bg-emerald-500/30"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir comprovante
            </button>
            {abaAtiva !== 'exportacoes' && (
              <button
                type="button"
                onClick={() => setAbaAtiva('exportacoes')}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 font-semibold text-white hover:bg-white/10"
              >
                Ver em Exportações
              </button>
            )}
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

      {/* Conteúdo das 3 Abas */}
      {abaAtiva === 'painel' && (
        <PainelReurbTab
          filtros={filtros}
          selectedIds={selectedIds}
          canExportJson={permissoes.canExportJson}
          isReadOnly={permissoes.isReadOnly}
          incluirArt69={incluirArt69}
          generating={generating}
          refreshKey={refreshKey}
          onUpdateFiltros={handleUpdateFiltros}
          onToggleSelect={handleToggleSelect}
          onSelectMany={handleSelectMany}
          onClearSelection={() => setSelectedIds([])}
          onToggleArt69={setIncluirArt69}
          onGerarLote={() => executarGeracaoLote(false)}
          onOpenDetalhe={(id) => setDetalheId(id)}
        />
      )}

      {abaAtiva === 'exportacoes' && (
        <ExportacoesReurbTab
          selectedIds={selectedIds}
          canExportJson={permissoes.canExportJson}
          canConfirmImport={permissoes.canConfirmImport}
          isReadOnly={permissoes.isReadOnly}
          incluirArt69={incluirArt69}
          generating={generating}
          refreshKey={refreshKey}
          onToggleArt69={setIncluirArt69}
          onGerarLote={() => executarGeracaoLote(false)}
          onClearSelection={() => setSelectedIds([])}
          onIrParaProcessos={() => setAbaAtiva('painel')}
          onDataChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {abaAtiva === 'relatorios' && (
        <RelatoriosReurbTab
          ano={filtros.ano ?? initialAno}
          mes={filtros.mes ?? 'todos'}
          refreshKey={refreshKey}
          onChangePeriodo={handleChangePeriodoRelatorios}
          onOpenDetalhe={(id) => setDetalheId(id)}
        />
      )}

      <ProcessoDetalheModal
        regularizacaoId={detalheId}
        canExportJson={permissoes.canExportJson}
        isReadOnly={permissoes.isReadOnly}
        isMaster={isMaster}
        onClose={() => setDetalheId(null)}
        onExportSuccess={() => setRefreshKey((k) => k + 1)}
      />

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

      <ComprovanteExportacaoModal
        exportacao={previewComprovante}
        onClose={() => setPreviewComprovante(null)}
      />
    </div>
  );
}

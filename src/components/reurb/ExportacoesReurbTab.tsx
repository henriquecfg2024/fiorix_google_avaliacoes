'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileJson,
  Loader2,
  Printer,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ReurbExportacaoDTO } from '@/lib/reurb/types';
import { ComprovanteExportacaoModal } from './ComprovanteExportacaoModal';
import {
  formatarDataHoraBr,
  gerarHtmlComprovanteExportacaoReurb,
  imprimirHtmlA4,
  isExportacaoElegivelComprovante,
  labelStatusImportacaoOnr,
} from './reurb-ui-helpers';

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
      const expRes = await fetch('/api/reurb/exportacoes', { cache: 'no-store' });
      const expBody = await expRes.json();
      if (expRes.ok && Array.isArray(expBody?.exportacoes)) {
        setHistorico(expBody.exportacoes);
      }
    } catch {
      toast.error('Falha ao carregar histórico de exportações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico, refreshKey]);

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

      {/* Histórico de exportações e confirmação manual no Ofício Eletrônico */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-white">
            Histórico de exportações JSON e importação no Ofício Eletrônico
          </h2>
          <p className="text-xs text-slate-400">
            Registro auditável de arquivos gerados, comprovantes, falhas de revalidação e confirmação manual no Ofício Eletrônico.
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
                <th className="px-4 py-3 text-right">Downloads &amp; Confirmação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Carregando histórico de exportações...
                  </td>
                </tr>
              ) : historico.length === 0 ? (
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

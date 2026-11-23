'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Layers,
  Loader2,
  Printer,
  ShieldAlert,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  OnrValidationResult,
  ReurbExportacaoDTO,
  ReurbRegularizacaoDTO,
} from '@/lib/reurb/types';
import { ComprovanteExportacaoModal } from './ComprovanteExportacaoModal';
import {
  agruparPendenciasModal,
  formatarDataBr,
  gerarHtmlComprovanteExportacaoReurb,
  imprimirHtmlA4,
  isExportacaoElegivelComprovante,
  labelModalidade,
  labelStatusImportacaoOnr,
  triggerDownloadBlob,
} from './reurb-ui-helpers';

interface DetalheApiResponse {
  registro: ReurbRegularizacaoDTO;
  validacaoOnr: OnrValidationResult;
}

interface ProcessoDetalheModalProps {
  regularizacaoId: string | null;
  canExportJson: boolean;
  isReadOnly: boolean;
  onClose: () => void;
  onExportSuccess: () => void;
}

export function ProcessoDetalheModal({
  regularizacaoId,
  canExportJson,
  isReadOnly,
  onClose,
  onExportSuccess,
}: ProcessoDetalheModalProps) {
  const [data, setData] = useState<DetalheApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExportacaoComprovante, setLastExportacaoComprovante] =
    useState<ReurbExportacaoDTO | null>(null);
  const [previewComprovante, setPreviewComprovante] = useState<ReurbExportacaoDTO | null>(null);
  const printCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      printCleanupRef.current?.();
      printCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!regularizacaoId) {
      setData(null);
      setError(null);
      setExportError(null);
      setLastExportacaoComprovante(null);
      setPreviewComprovante(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setExportError(null);
    setLastExportacaoComprovante(null);
    setPreviewComprovante(null);

    fetch(`/api/reurb/processos/${encodeURIComponent(regularizacaoId)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Falha ao carregar detalhe da REURB.');
        return body as DetalheApiResponse;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao consultar processo REURB.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [regularizacaoId]);

  if (!regularizacaoId) return null;

  const reg = data?.registro;
  const derivsJson = reg?.derivadas.filter((d) => d.incluirNoJson && !d.ehAreaPublica && !d.ehCondominioIntermediario) || [];
  const derivsExcluidas = reg?.derivadas.filter((d) => !d.incluirNoJson || d.ehAreaPublica || d.ehCondominioIntermediario) || [];
  const pendenciasAgrupadas = agruparPendenciasModal(reg?.pendencias || []);

  async function handleExportarUnitaria() {
    if (!reg || exporting) return;
    setExporting(true);
    setExportError(null);
    setLastExportacaoComprovante(null);

    try {
      const res = await fetch('/api/reurb/exportacoes/unitaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reg.id }),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        const msg = body?.error || 'Falha ao gerar JSON unitário para o Ofício Eletrônico.';
        setExportError(msg);
        toast.error(msg);
        return;
      }

      if (body.jsonString && body.exportacao?.nomeArquivoJson) {
        triggerDownloadBlob(body.jsonString, body.exportacao.nomeArquivoJson);
      }
      if (isExportacaoElegivelComprovante(body.exportacao)) {
        setLastExportacaoComprovante(body.exportacao);
      }
      toast.success(
        `JSON unitário da matrícula ${reg.matricula} gerado com revalidação do Ofício Eletrônico v1.4.`
      );
      onExportSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao exportar JSON unitário.';
      setExportError(msg);
      toast.error(msg);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0D1322] text-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0D1322]/95 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400">
              Detalhe da Regularização Fundiária
            </div>
            <h2 className="text-lg font-bold text-white">
              {reg ? `Matrícula ${reg.matricula} · ${reg.empreendimento || `Prot. ${reg.protocolo}`}` : 'Carregando...'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {reg && canExportJson && !isReadOnly && (
              <button
                type="button"
                disabled={exporting || reg.situacaoValidacao !== 'APTO'}
                onClick={handleExportarUnitaria}
                title={
                  reg.situacaoValidacao !== 'APTO'
                    ? 'Resolva as pendências bloqueantes antes de exportar JSON'
                    : 'Revalidar no Connector e exportar JSON unitário para o Ofício Eletrônico v1.4'
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Exportar JSON unitário
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhes"
              className="rounded-xl border border-white/15 p-2 text-slate-300 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 text-xs">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              Carregando informações do processo, atos, derivadas e fontes OCR...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200">
              {error}
            </div>
          )}

          {exportError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200">
              <strong>Exportação unitária bloqueada:</strong> {exportError}
            </div>
          )}

          {lastExportacaoComprovante && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex flex-wrap items-center justify-between gap-3 text-emerald-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>{lastExportacaoComprovante.nomeArquivoJson}</strong> gerado sem pendências.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewComprovante(lastExportacaoComprovante)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 font-semibold text-cyan-100 hover:bg-cyan-500/25"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Visualizar comprovante
                </button>
                <button
                  type="button"
                  onClick={() => {
                    printCleanupRef.current?.();
                    printCleanupRef.current = imprimirHtmlA4(
                      gerarHtmlComprovanteExportacaoReurb(lastExportacaoComprovante)
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 font-semibold text-emerald-100 hover:bg-emerald-500/30"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir comprovante
                </button>
              </div>
            </div>
          )}

          {reg && (
            <>
              {/* Dados principais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-[#070A12] p-3.5 space-y-1">
                  <div className="text-slate-400">Matrícula / Protocolo</div>
                  <div className="text-sm font-bold text-white">
                    {reg.matricula} · Prot. {reg.protocolo}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Modalidade: <span className="text-slate-200 font-semibold">{labelModalidade(reg.modalidade)}</span> ·{' '}
                    {reg.classificacaoFinal}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#070A12] p-3.5 space-y-1">
                  <div className="text-slate-400">Datas</div>
                  <div className="text-slate-200">
                    Registro: <strong>{formatarDataBr(reg.dataRegistro)}</strong>
                  </div>
                  <div className="text-slate-400">
                    Prenotação: <strong className="text-slate-200">{formatarDataBr(reg.dataPrenotacao)}</strong>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#070A12] p-3.5 space-y-1">
                  <div className="text-slate-400">Situação Ofício Eletrônico v1.4</div>
                  <div className="flex items-center gap-2">
                    {reg.situacaoValidacao === 'APTO' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Apto para exportação
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                        <AlertTriangle className="h-3.5 w-3.5" /> Com pendências ({reg.qtdBloqueios})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Importação Ofício Eletrônico: {labelStatusImportacaoOnr(reg.statusImportacaoOnr)}
                  </div>
                </div>
              </div>

              {/* Localização e Agente */}
              <div className="rounded-xl border border-white/10 bg-[#070A12] p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-400 block">Município</span>
                  <span className="font-semibold text-white">{reg.municipio || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Distrito / Subdistrito</span>
                  <span className="font-semibold text-white">
                    {reg.distrito || '—'} {reg.subdistrito ? `/ ${reg.subdistrito}` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Bairro / Localização</span>
                  <span className="font-semibold text-white">
                    {reg.bairro || 'Não comprovado'} ({reg.tipoLocalizacao})
                  </span>
                  {!reg.bairro && reg.bairroSugerido && (
                    <span className="block text-[11px] text-amber-300">
                      Sugestão logradouros: {reg.bairroSugerido}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block">Agente ({reg.tipoAgente === 1 ? 'Poder Público' : reg.tipoAgente === 2 ? 'Particular' : 'Pendente'})</span>
                  <span className="font-semibold text-white">{reg.agente || '—'}</span>
                </div>
              </div>

              {/* Pendências bloqueantes Ofício Eletrônico */}
              {pendenciasAgrupadas.bloqueios.length > 0 && (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-200">
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                    Pendências bloqueantes — Ofício Eletrônico ({pendenciasAgrupadas.bloqueios.length})
                  </div>
                  <div className="space-y-2">
                    {pendenciasAgrupadas.bloqueios.map((p, idx) => (
                      <div
                        key={p.id || `bloq-${p.campo}-${idx}`}
                        className="rounded-lg border border-white/10 bg-[#070A12] p-2.5 flex flex-wrap items-start justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                              {p.severidade}
                            </span>
                            <span className="font-bold text-white">{p.campo}</span>
                            {p.matriculaDerivada && (
                              <span className="text-slate-400">(Derivada {p.matriculaDerivada})</span>
                            )}
                          </div>
                          <p className="mt-1 text-slate-200">{p.motivo}</p>
                          {p.acaoNecessaria && (
                            <p className="mt-0.5 text-[11px] text-emerald-300">Ação: {p.acaoNecessaria}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">Fonte: {p.fonte}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alertas de conferência recomendada */}
              {pendenciasAgrupadas.alertasConferencia.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold text-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      Alertas de conferência recomendada ({pendenciasAgrupadas.alertasConferencia.length})
                    </div>
                    <span className="text-[11px] text-amber-200/80">
                      Não impedem a exportação do JSON, mas recomenda-se conferência.
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pendenciasAgrupadas.alertasConferencia.map((p, idx) => (
                      <div
                        key={p.id || `conf-${p.campo}-${idx}`}
                        className="rounded-lg border border-white/10 bg-[#070A12] p-2.5 flex flex-wrap items-start justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              {p.severidade}
                            </span>
                            <span className="font-bold text-white">{p.campo}</span>
                            {p.matriculaDerivada && (
                              <span className="text-slate-400">(Derivada {p.matriculaDerivada})</span>
                            )}
                          </div>
                          <p className="mt-1 text-slate-200">{p.motivo}</p>
                          {p.acaoNecessaria && (
                            <p className="mt-0.5 text-[11px] text-emerald-300">Ação: {p.acaoNecessaria}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">Fonte: {p.fonte}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Auditoria e avisos informativos (recolhido por padrão) */}
              {pendenciasAgrupadas.totalInformativos > 0 && (
                <details className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.04] p-4">
                  <summary className="cursor-pointer select-none flex flex-wrap items-center justify-between gap-2 font-semibold text-cyan-200">
                    <span>
                      Auditoria e avisos informativos ({pendenciasAgrupadas.totalInformativos}) — não bloqueiam a exportação
                    </span>
                    <span className="text-[11px] font-normal text-slate-400">
                      Clique para expandir detalhes
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    {pendenciasAgrupadas.qtdDerivadasSemTitulacao > 0 && (
                      <div className="rounded-lg border border-white/10 bg-[#070A12] p-2.5 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                              INFO
                            </span>
                            <span className="font-bold text-white">derivadas[].dataRegistro</span>
                          </div>
                          <p className="mt-1 text-slate-200">
                            {pendenciasAgrupadas.qtdDerivadasSemTitulacao} derivada(s) sem ato de titulação posterior — enviadas com <code className="text-cyan-300">dataRegistro: null</code> conforme Manual do Ofício Eletrônico v1.4.
                          </p>
                        </div>
                        <span className="text-[11px] text-slate-400">WEBRI tblWRIAtos (TpAto=54)</span>
                      </div>
                    )}
                    {pendenciasAgrupadas.outrosInformativos.map((p, idx) => (
                      <div
                        key={p.id || `info-${p.campo}-${idx}`}
                        className="rounded-lg border border-white/10 bg-[#070A12] p-2.5 flex flex-wrap items-start justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                              {p.severidade}
                            </span>
                            <span className="font-bold text-white">{p.campo}</span>
                            {p.matriculaDerivada && (
                              <span className="text-slate-400">(Derivada {p.matriculaDerivada})</span>
                            )}
                          </div>
                          <p className="mt-1 text-slate-200">{p.motivo}</p>
                          {p.acaoNecessaria && (
                            <p className="mt-0.5 text-[11px] text-slate-400">{p.acaoNecessaria}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">Fonte: {p.fonte}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Fontes e Evidências OCR */}
              {(reg.fontes.length > 0 || reg.empreendimentoTrechoOcr) && (
                <div className="rounded-xl border border-white/10 bg-[#070A12] p-4 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-slate-200">
                    <FileText className="h-4 w-4 text-cyan-400" />
                    Fontes dos dados e evidências OCR (SiplanIA)
                  </div>
                  {reg.empreendimentoTrechoOcr && (
                    <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-2.5 text-slate-200">
                      <span className="text-[11px] text-cyan-300 font-semibold block">
                        Trecho empreendimento ({reg.empreendimentoFonte || 'OCR'}):
                      </span>
                      {reg.empreendimentoTrechoOcr}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {reg.fontes.map((f, idx) => (
                      <div
                        key={`${f.campo}-${idx}`}
                        className={`rounded-lg border p-2.5 ${
                          f.exigeConferencia
                            ? 'border-amber-500/40 bg-amber-500/5'
                            : 'border-white/10 bg-[#0D1322]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white">{f.campo}: {f.valor}</span>
                          {f.exigeConferencia && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300 font-semibold">
                              Conferência recomendada
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">Origem: {f.origem}</div>
                        {f.trechoOcr && (
                          <div className="mt-1 text-[11px] text-cyan-200 italic">&ldquo;{f.trechoOcr}&rdquo;</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Atos vinculados */}
              {reg.atosVinculados.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-[#070A12] p-4 space-y-2">
                  <div className="font-bold text-slate-200">Atos vinculados no WEBRI</div>
                  <div className="space-y-1.5">
                    {reg.atosVinculados.map((a, idx) => (
                      <div key={`${a.atoId}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 text-slate-300 border-b border-white/5 pb-1.5 last:border-b-0">
                        <span>
                          <strong className="text-white">{a.seqLabel}</strong> · {a.negocioDescricao}
                          {a.negId ? ` (Neg. ${a.negId})` : ''}
                        </span>
                        <span className="text-slate-400">{formatarDataBr(a.dataAto)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matrículas derivadas */}
              <div className="rounded-xl border border-white/10 bg-[#070A12] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-200">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    Matrículas derivadas ({derivsJson.length} incluídas no JSON · {derivsExcluidas.length} área(s) pública(s)/intermediária(s) excluída(s))
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Qtd Unidades na matriz: {reg.quantidadeUnidades}
                  </span>
                </div>

                {derivsExcluidas.length > 0 && (
                  <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 space-y-1.5">
                    <div className="font-semibold text-cyan-200">
                      Áreas públicas / vias / condomínio intermediário excluídos do array derivadas[] (Manual do Ofício Eletrônico v1.4)
                    </div>
                    {derivsExcluidas.map((d) => (
                      <div key={d.matriculaDerivada} className="text-[11px] text-slate-200 flex flex-wrap justify-between gap-2 border-t border-white/5 pt-1">
                        <span>
                          <strong>Matrícula {d.matriculaDerivada}</strong> ({d.categoriaArea}) — {d.motivoExclusao || 'Excluída do JSON'}
                        </span>
                        {d.fonteOcr && <span className="text-cyan-300">{d.fonteOcr}</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto border border-white/10 rounded-lg">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-white/[0.03] text-slate-400 sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Derivada</th>
                        <th className="px-3 py-2">Abertura</th>
                        <th className="px-3 py-2">Titulação (dataRegistro)</th>
                        <th className="px-3 py-2">Vínculo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {derivsJson.map((d) => (
                        <tr key={d.matriculaDerivada}>
                          <td className="px-3 py-1.5 font-bold text-white">{d.matriculaDerivada}</td>
                          <td className="px-3 py-1.5 text-slate-300">
                            {d.dataAbertura ? formatarDataBr(d.dataAbertura) : 'Omitida (opcional — Manual do Ofício Eletrônico pág. 24)'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-300">
                            {d.dataRegistro ? formatarDataBr(d.dataRegistro) : 'null (sem titulação posterior)'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-400">{d.vinculoMetodo || 'FILIACAO'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ComprovanteExportacaoModal
        exportacao={previewComprovante}
        onClose={() => setPreviewComprovante(null)}
      />
    </div>
  );
}

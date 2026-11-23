'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  Layers,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import type { ReurbPainelDTO, ReurbSituacaoValidacao } from '@/lib/reurb/types';
import {
  buildAnosDisponiveis,
  filtrarProcessosPainel,
  formatarDataBr,
  gerarHtmlImpressaoPainel,
  hasActivePainelFilters,
  INITIAL_PAINEL_COLUMN_FILTERS,
  labelModalidade,
  MESES_NOMES,
  type PainelColumnFilters,
} from './reurb-ui-helpers';

export type PainelKpiDrillType =
  | 'registradas'
  | 'derivadasAbertas'
  | 'aptas'
  | 'pendencias';

interface PainelReurbTabProps {
  ano: number;
  mes: number | 'todos';
  refreshKey: number;
  onChangePeriodo: (ano: number, mes: number | 'todos') => void;
  onDrillDown: (tipo: PainelKpiDrillType) => void;
  onOpenDetalhe: (id: string) => void;
}

export function PainelReurbTab({
  ano,
  mes,
  refreshKey,
  onChangePeriodo,
  onDrillDown,
  onOpenDetalhe,
}: PainelReurbTabProps) {
  const [data, setData] = useState<ReurbPainelDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnFilters, setColumnFilters] = useState<PainelColumnFilters>(
    INITIAL_PAINEL_COLUMN_FILTERS
  );
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    return () => {
      if (printIframeRef.current) {
        printIframeRef.current.remove();
        printIframeRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams({
      ano: String(ano),
      mes: mes === 'todos' ? 'todos' : String(mes),
    });

    fetch(`/api/reurb/painel?${qs.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Falha ao carregar o Painel REURB.');
        return body as ReurbPainelDTO;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao consultar indicadores REURB.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ano, mes, refreshKey]);

  const anos = buildAnosDisponiveis(ano);
  const crossMonthItems =
    data?.derivadasPeriodoResumo.itens.filter((item) => item.deOutroMes) || [];
  const processosPeriodo = useMemo(() => data?.processosPeriodo ?? [], [data]);
  const processosFiltrados = useMemo(
    () => filtrarProcessosPainel(processosPeriodo, columnFilters),
    [processosPeriodo, columnFilters]
  );
  const filtrosAtivos = hasActivePainelFilters(columnFilters);
  const totalDerivadasFiltradas = useMemo(
    () => processosFiltrados.reduce((acc, item) => acc + item.qtdDerivadasLista, 0),
    [processosFiltrados]
  );

  function handleClearFilters() {
    setColumnFilters(INITIAL_PAINEL_COLUMN_FILTERS);
  }

  function handleImprimirFiltrados() {
    if (typeof window === 'undefined' || processosFiltrados.length === 0) return;

    if (printIframeRef.current) {
      printIframeRef.current.remove();
      printIframeRef.current = null;
    }

    const html = gerarHtmlImpressaoPainel({
      ano,
      mes,
      processos: processosFiltrados,
      totalPeriodo: processosPeriodo.length,
      filters: columnFilters,
    });

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';

    const cleanup = () => {
      if (printIframeRef.current === iframe) {
        printIframeRef.current = null;
      }
      iframe.remove();
    };

    const fallbackTimer = window.setTimeout(cleanup, 60_000);
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        window.clearTimeout(fallbackTimer);
        cleanup();
        return;
      }
      const handleAfterPrint = () => {
        window.clearTimeout(fallbackTimer);
        win.removeEventListener('afterprint', handleAfterPrint);
        cleanup();
      };
      win.addEventListener('afterprint', handleAfterPrint);
      win.focus();
      win.print();
    };

    iframe.srcdoc = html;
    printIframeRef.current = iframe;
    document.body.appendChild(iframe);
  }

  return (
    <div className="space-y-6">
      {/* Seletores Ano / Mês */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="reurb-painel-ano" className="block text-[11px] font-medium text-slate-400 mb-1">
              Ano de referência
            </label>
            <select
              id="reurb-painel-ano"
              value={ano}
              onChange={(e) => onChangePeriodo(Number(e.target.value), mes)}
              className="rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
            >
              {anos.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reurb-painel-mes" className="block text-[11px] font-medium text-slate-400 mb-1">
              Mês
            </label>
            <select
              id="reurb-painel-mes"
              value={mes === 'todos' ? 'todos' : String(mes)}
              onChange={(e) =>
                onChangePeriodo(
                  ano,
                  e.target.value === 'todos' ? 'todos' : Number(e.target.value)
                )
              }
              className="rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
            >
              <option value="todos">Ano inteiro ({ano})</option>
              {MESES_NOMES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 max-w-md">
          Clique em qualquer indicador para abrir a <strong className="text-slate-200">Consulta</strong> filtrada pelas mesmas regras de data de referência e situação.
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* 4 KPI Cards clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onDrillDown('registradas')}
          className="text-left rounded-2xl border border-white/10 bg-[#0D1322] p-5 hover:border-emerald-400/50 hover:bg-[#11192E] transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Regularizações registradas
            </span>
            <FileCheck2 className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">
            {loading ? '—' : data?.kpis.registradas ?? 0}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Regra: processos distintos contados pela <strong>data de registro</strong> da regularização no período.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrillDown('derivadasAbertas')}
          className="text-left rounded-2xl border border-white/10 bg-[#0D1322] p-5 hover:border-cyan-400/50 hover:bg-[#11192E] transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Matrículas derivadas abertas
            </span>
            <Layers className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-white">
            {loading ? '—' : data?.kpis.derivadasAbertas ?? 0}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Regra: derivadas distintas pela <strong>data de abertura</strong> de cada matrícula
            {crossMonthItems.length > 0 ? ` (${crossMonthItems.length} de matriz de outro mês)` : ''}.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrillDown('aptas')}
          className="text-left rounded-2xl border border-white/10 bg-[#0D1322] p-5 hover:border-emerald-400/50 hover:bg-[#11192E] transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Aptas à exportação
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-emerald-300">
            {loading ? '—' : data?.kpis.aptasExportacao ?? 0}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Regra: <strong>situação atual</strong> dos processos registrados no período sem pendência bloqueante ONR v1.4.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onDrillDown('pendencias')}
          className="text-left rounded-2xl border border-white/10 bg-[#0D1322] p-5 hover:border-amber-400/50 hover:bg-[#11192E] transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Com pendências
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-3 text-3xl font-extrabold text-amber-300">
            {loading ? '—' : data?.kpis.comPendencias ?? 0}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Regra: <strong>situação atual</strong> dos processos registrados no período que exigem revisão antes do JSON.
          </p>
        </button>
      </div>

      {/* Detalhamento de derivadas de matrizes de outro mês */}
      {crossMonthItems.length > 0 && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-cyan-200 font-semibold text-sm">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>
                Composição das {data?.kpis.derivadasAbertas} matrículas derivadas abertas: {crossMonthItems.length} derivada(s) pertencem a regularização matriz registrada em outro mês
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDrillDown('derivadasAbertas')}
              className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-400/20"
            >
              Ver todas na Consulta
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Array.from(
              new Map(
                crossMonthItems.map((i) => [
                  i.regularizacaoId,
                  {
                    regularizacaoId: i.regularizacaoId,
                    matriculaMatriz: i.matriculaMatriz,
                    protocolo: i.protocolo,
                    empreendimento: i.empreendimento,
                    dataRegistroMatriz: i.dataRegistroMatriz,
                    count: crossMonthItems.filter((x) => x.regularizacaoId === i.regularizacaoId).length,
                  },
                ])
              ).values()
            ).map((grupo) => (
              <div
                key={grupo.regularizacaoId}
                className="rounded-xl border border-white/10 bg-[#0D1322] p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Matriz {grupo.matriculaMatriz} · {grupo.empreendimento || grupo.protocolo}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Matriz registrada em {formatarDataBr(grupo.dataRegistroMatriz)} ·{' '}
                    <span className="text-cyan-300 font-semibold">{grupo.count} derivada(s) no período</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDetalhe(grupo.regularizacaoId)}
                  className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  Detalhes
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de regularizações registradas no período */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              Regularizações registradas no período
            </h2>
            <p className="text-xs text-slate-400">
              {loading
                ? 'Carregando processos...'
                : filtrosAtivos
                  ? `Exibindo ${processosFiltrados.length} de ${processosPeriodo.length} processo(s) · ${totalDerivadasFiltradas} derivada(s) no JSON`
                  : `${processosPeriodo.length} processo(s) registrado(s) no recorte selecionado · ${totalDerivadasFiltradas} derivada(s) no JSON`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />}
            {filtrosAtivos && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
                Limpar filtros
              </button>
            )}
            <button
              type="button"
              onClick={handleImprimirFiltrados}
              disabled={loading || processosFiltrados.length === 0}
              title="Imprimir regularizações conforme filtros aplicados"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5" />
              {!loading && processosFiltrados.length > 0
                ? `Imprimir (${processosFiltrados.length})`
                : 'Imprimir'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Matrícula / Protocolo</th>
                <th className="px-4 py-3">Empreendimento</th>
                <th className="px-4 py-3">Registro</th>
                <th className="px-4 py-3">Derivadas JSON</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
              <tr className="border-t border-white/10 bg-[#0A0F1C]">
                <th className="px-4 py-2 font-normal normal-case tracking-normal">
                  <input
                    type="text"
                    value={columnFilters.matriculaProtocolo}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({
                        ...prev,
                        matriculaProtocolo: e.target.value,
                      }))
                    }
                    placeholder="Matrícula ou prot..."
                    aria-label="Filtrar por Matrícula ou Protocolo"
                    className="w-full rounded-lg border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                </th>
                <th className="px-4 py-2 font-normal normal-case tracking-normal">
                  <input
                    type="text"
                    value={columnFilters.empreendimento}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({
                        ...prev,
                        empreendimento: e.target.value,
                      }))
                    }
                    placeholder="Nome ou modalidade..."
                    aria-label="Filtrar por Empreendimento ou Modalidade"
                    className="w-full rounded-lg border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                </th>
                <th className="px-4 py-2 font-normal normal-case tracking-normal">
                  <input
                    type="text"
                    value={columnFilters.registro}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({
                        ...prev,
                        registro: e.target.value,
                      }))
                    }
                    placeholder="dd/mm/aaaa..."
                    aria-label="Filtrar por Data de Registro"
                    className="w-full rounded-lg border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                </th>
                <th className="px-4 py-2 font-normal normal-case tracking-normal">
                  <input
                    type="text"
                    value={columnFilters.derivadasJson}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({
                        ...prev,
                        derivadasJson: e.target.value,
                      }))
                    }
                    placeholder="Ex: 28, >=10, 2-50"
                    aria-label="Filtrar por Derivadas JSON"
                    className="w-full rounded-lg border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                </th>
                <th className="px-4 py-2 font-normal normal-case tracking-normal">
                  <select
                    value={columnFilters.situacao}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({
                        ...prev,
                        situacao: e.target.value as 'TODAS' | ReurbSituacaoValidacao,
                      }))
                    }
                    aria-label="Filtrar por Situação"
                    className="w-full rounded-lg border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="TODAS">Todas</option>
                    <option value="APTO">Apto</option>
                    <option value="PENDENTE">Pendente</option>
                  </select>
                </th>
                <th className="px-4 py-2 text-right font-normal normal-case tracking-normal">
                  {filtrosAtivos ? (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                    >
                      Limpar
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-600">—</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!loading && processosPeriodo.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Nenhuma regularização registrada no período selecionado.
                  </td>
                </tr>
              ) : !loading && processosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    <div className="space-y-2">
                      <div>Nenhuma regularização encontrada com os filtros aplicados.</div>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                processosFiltrados.map((reg) => (
                  <tr key={reg.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{reg.matricula}</div>
                      <div className="text-[11px] text-slate-400">Prot. {reg.protocolo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">
                        {reg.empreendimento || 'Não informado'}
                      </div>
                      <div className="text-[11px] text-slate-400">{labelModalidade(reg.modalidade)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{formatarDataBr(reg.dataRegistro)}</td>
                    <td className="px-4 py-3 text-slate-200 font-semibold">{reg.qtdDerivadasLista}</td>
                    <td className="px-4 py-3">
                      {reg.situacaoValidacao === 'APTO' ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                          Apto
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenDetalhe(reg.id)}
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
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
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BarChart3, Calendar, Download, Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { ReurbConsultaFiltros, ReurbRelatorioDTO } from '@/lib/reurb/types';
import {
  buildAnosDisponiveis,
  filtrarPendenciasRelatorio,
  formatarDataBr,
  labelModalidade,
  MESES_NOMES,
  type RelatorioEvolucaoMetrica,
  type RelatorioPendenciaFiltro,
  triggerDownloadBlob,
} from './reurb-ui-helpers';

interface RelatoriosReurbTabProps {
  ano: number;
  mes: number | 'todos';
  refreshKey: number;
  onChangePeriodo: (ano: number, mes: number | 'todos') => void;
  onDrillDown: (patch: Partial<ReurbConsultaFiltros>) => void;
  onOpenDetalhe: (id: string) => void;
}

const METRICA_CONFIG: Record<
  RelatorioEvolucaoMetrica,
  { label: string; gradient: string; textClass: string }
> = {
  derivadasAbertas: {
    label: 'Derivadas abertas',
    gradient: 'from-emerald-500/80 to-cyan-400/80',
    textClass: 'text-cyan-300',
  },
  registradas: {
    label: 'Registradas',
    gradient: 'from-blue-500/80 to-cyan-400/80',
    textClass: 'text-white',
  },
  aptas: {
    label: 'Aptas JSON',
    gradient: 'from-emerald-600/80 to-emerald-400/80',
    textClass: 'text-emerald-300',
  },
  comPendencias: {
    label: 'Com pendências',
    gradient: 'from-amber-500/80 to-orange-400/80',
    textClass: 'text-amber-300',
  },
};

export function RelatoriosReurbTab({
  ano,
  mes,
  refreshKey,
  onChangePeriodo,
  onDrillDown,
  onOpenDetalhe,
}: RelatoriosReurbTabProps) {
  const [data, setData] = useState<ReurbRelatorioDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<RelatorioEvolucaoMetrica>('derivadasAbertas');
  const [pendenciaFiltro, setPendenciaFiltro] = useState<RelatorioPendenciaFiltro>('TODAS');
  const [pendenciaBusca, setPendenciaBusca] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams({
      ano: String(ano),
      mes: mes === 'todos' ? 'todos' : String(mes),
    });

    fetch(`/api/reurb/relatorios?${qs.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Falha ao carregar relatórios REURB.');
        return body as ReurbRelatorioDTO;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao montar relatórios REURB.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ano, mes, refreshKey]);

  async function handleBaixarExcel() {
    if (downloadingExcel) return;
    setDownloadingExcel(true);
    try {
      const qs = new URLSearchParams({
        ano: String(ano),
        mes: mes === 'todos' ? 'todos' : String(mes),
      });
      const res = await fetch(`/api/reurb/relatorios/excel?${qs.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || 'Falha ao exportar Excel REURB.');
      }
      const blob = await res.blob();
      const mesSuffix = mes === 'todos' ? 'ano_inteiro' : String(mes).padStart(2, '0');
      triggerDownloadBlob(
        blob,
        `fiorix_reurb_relatorio_${ano}_${mesSuffix}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      toast.success('Relatório Excel (.xlsx) exportado com sucesso.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar arquivo Excel.');
    } finally {
      setDownloadingExcel(false);
    }
  }

  const anos = buildAnosDisponiveis(ano);
  const evolucao = useMemo(() => data?.evolucaoMensal ?? [], [data]);

  const totaisAnuais = useMemo(
    () =>
      evolucao.reduce(
        (acc, item) => ({
          registradas: acc.registradas + item.registradas,
          derivadasAbertas: acc.derivadasAbertas + item.derivadasAbertas,
          aptas: acc.aptas + item.aptas,
          comPendencias: acc.comPendencias + item.comPendencias,
        }),
        { registradas: 0, derivadasAbertas: 0, aptas: 0, comPendencias: 0 }
      ),
    [evolucao]
  );

  const maxEvolucao = useMemo(
    () => Math.max(1, ...evolucao.map((m) => m[metrica])),
    [evolucao, metrica]
  );

  const todasPendencias = useMemo(() => data?.pendenciasPeriodo ?? [], [data]);
  const qtdBloqueantes = useMemo(
    () => todasPendencias.filter((p) => p.qtdBloqueios > 0).length,
    [todasPendencias]
  );
  const qtdConferencia = useMemo(
    () => todasPendencias.filter((p) => p.qtdBloqueios === 0 && p.qtdAlertas > 0).length,
    [todasPendencias]
  );
  const pendenciasFiltradas = useMemo(
    () => filtrarPendenciasRelatorio(todasPendencias, pendenciaFiltro, pendenciaBusca),
    [todasPendencias, pendenciaFiltro, pendenciaBusca]
  );

  const totalDerivadasModalidades = Math.max(1, data?.totais.derivadasAbertas ?? 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho dinâmico de Período + Ações */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] p-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="reurb-rel-ano" className="block text-[11px] text-slate-400 mb-1">
              Ano
            </label>
            <select
              id="reurb-rel-ano"
              value={ano}
              onChange={(e) => onChangePeriodo(Number(e.target.value), mes)}
              className="rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
            >
              {anos.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="reurb-rel-mes" className="block text-[11px] text-slate-400 mb-1">
              Mês
            </label>
            <select
              id="reurb-rel-mes"
              value={mes === 'todos' ? 'todos' : String(mes)}
              onChange={(e) =>
                onChangePeriodo(
                  ano,
                  e.target.value === 'todos' ? 'todos' : Number(e.target.value)
                )
              }
              className="rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
            >
              <option value="todos">Ano inteiro ({ano})</option>
              {MESES_NOMES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {mes !== 'todos' && (
            <button
              type="button"
              onClick={() => onChangePeriodo(ano, 'todos')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
            >
              <Calendar className="h-3.5 w-3.5" />
              Ver ano inteiro ({ano})
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onDrillDown({ ano, mes })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            Ver processos deste período
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleBaixarExcel}
            disabled={downloadingExcel || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {downloadingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exportar Excel (.xlsx)
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* 1. Resumo por modalidade (interativo com drill-down) */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">1. Resumo por modalidade</h2>
            <p className="text-xs text-slate-400">
              Clique em uma modalidade ou indicador numérico para abrir os processos filtrados em Painel e Processos.
            </p>
          </div>
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Modalidade</th>
                <th className="px-4 py-3">Registradas</th>
                <th className="px-4 py-3">Derivadas abertas</th>
                <th className="px-4 py-3">Aptas JSON</th>
                <th className="px-4 py-3">Com pendências</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data?.porModalidade.map((m) => {
                const sharePct =
                  (data?.totais.derivadasAbertas ?? 0) > 0
                    ? Math.round((m.derivadasAbertas / totalDerivadasModalidades) * 100)
                    : 0;
                return (
                  <tr key={m.modalidade} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onDrillDown({
                            ano,
                            mes,
                            modalidade: m.modalidade,
                            tipoData: 'registro',
                            situacao: 'TODAS',
                          })
                        }
                        className="text-left group"
                      >
                        <div className="font-semibold text-white group-hover:text-emerald-300 transition-colors inline-flex items-center gap-1">
                          {m.label}
                          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 w-28 rounded-full bg-[#070A12] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
                              style={{ width: `${sharePct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400">{sharePct}% das derivadas</span>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onDrillDown({
                            ano,
                            mes,
                            modalidade: m.modalidade,
                            tipoData: 'registro',
                            situacao: 'TODAS',
                          })
                        }
                        className="font-semibold text-slate-200 hover:text-white hover:underline"
                      >
                        {m.registradas}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onDrillDown({
                            ano,
                            mes,
                            modalidade: m.modalidade,
                            tipoData: 'abertura_derivada',
                            situacao: 'TODAS',
                          })
                        }
                        className="font-semibold text-cyan-300 hover:text-cyan-200 hover:underline"
                      >
                        {m.derivadasAbertas}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onDrillDown({
                            ano,
                            mes,
                            modalidade: m.modalidade,
                            tipoData: 'registro',
                            situacao: 'APTO',
                          })
                        }
                        className="font-semibold text-emerald-300 hover:text-emerald-200 hover:underline"
                      >
                        {m.aptas}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onDrillDown({
                            ano,
                            mes,
                            modalidade: m.modalidade,
                            tipoData: 'registro',
                            situacao: 'PENDENTE',
                          })
                        }
                        className="font-semibold text-amber-300 hover:text-amber-200 hover:underline"
                      >
                        {m.comPendencias}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {data && (
                <tr className="bg-white/[0.03] font-bold">
                  <td className="px-4 py-3 text-white">TOTAL DO PERÍODO</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        onDrillDown({ ano, mes, modalidade: 'TODAS', tipoData: 'registro', situacao: 'TODAS' })
                      }
                      className="text-white hover:underline"
                    >
                      {data.totais.registradas}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        onDrillDown({
                          ano,
                          mes,
                          modalidade: 'TODAS',
                          tipoData: 'abertura_derivada',
                          situacao: 'TODAS',
                        })
                      }
                      className="text-cyan-300 hover:underline"
                    >
                      {data.totais.derivadasAbertas}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        onDrillDown({ ano, mes, modalidade: 'TODAS', tipoData: 'registro', situacao: 'APTO' })
                      }
                      className="text-emerald-300 hover:underline"
                    >
                      {data.totais.aptas}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        onDrillDown({ ano, mes, modalidade: 'TODAS', tipoData: 'registro', situacao: 'PENDENTE' })
                      }
                      className="text-amber-300 hover:underline"
                    >
                      {data.totais.comPendencias}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Evolução mensal dinâmica no ano */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">2. Evolução mensal ({ano})</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Total anual: <strong className="text-white">{totaisAnuais.registradas}</strong> reg. ·{' '}
              <strong className="text-cyan-300">{totaisAnuais.derivadasAbertas}</strong> deriv. ·{' '}
              <strong className="text-emerald-300">{totaisAnuais.aptas}</strong> aptas ·{' '}
              <strong className="text-amber-300">{totaisAnuais.comPendencias}</strong> pend. — clique em um mês para filtrar os cards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(METRICA_CONFIG) as RelatorioEvolucaoMetrica[]).map((key) => {
              const cfg = METRICA_CONFIG[key];
              const active = metrica === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMetrica(key)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                      : 'border-white/10 bg-[#070A12] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          {evolucao.map((m) => {
            const valorMetrica = m[metrica];
            const pct = Math.round((valorMetrica / maxEvolucao) * 100);
            const isMesAtivo = mes === m.mes;
            const metricaCfg = METRICA_CONFIG[metrica];

            return (
              <div
                key={m.mes}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors ${
                  isMesAtivo
                    ? 'border-emerald-400/50 bg-emerald-500/10'
                    : 'border-transparent hover:bg-white/[0.03]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChangePeriodo(ano, isMesAtivo ? 'todos' : m.mes)}
                  title={
                    isMesAtivo
                      ? `Voltar para o ano inteiro (${ano})`
                      : `Filtrar cards para ${m.mesLabel}/${ano}`
                  }
                  className="flex-1 grid grid-cols-12 items-center gap-3 text-left text-xs"
                >
                  <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5 font-semibold text-slate-200">
                    <span>{m.mesLabel}</span>
                    {isMesAtivo && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </div>
                  <div className="col-span-5 sm:col-span-7 h-5 rounded-md bg-[#070A12] border border-white/10 overflow-hidden flex items-center">
                    <div
                      className={`h-full bg-gradient-to-r ${metricaCfg.gradient} transition-all duration-300`}
                      style={{ width: `${valorMetrica > 0 ? Math.max(4, pct) : 0}%` }}
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-4 text-right text-[11px] text-slate-300 whitespace-nowrap">
                    <strong className={metrica === 'registradas' ? 'text-white underline' : 'text-white'}>
                      {m.registradas}
                    </strong>{' '}
                    reg. ·{' '}
                    <strong className={metrica === 'derivadasAbertas' ? 'text-cyan-300 underline' : 'text-cyan-300'}>
                      {m.derivadasAbertas}
                    </strong>{' '}
                    deriv. ·{' '}
                    <span className={metrica === 'comPendencias' ? 'text-amber-300 font-bold underline' : 'text-amber-300'}>
                      {m.comPendencias} pend.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onDrillDown({
                      ano,
                      mes: m.mes,
                      tipoData: metrica === 'derivadasAbertas' ? 'abertura_derivada' : 'registro',
                      situacao:
                        metrica === 'aptas'
                          ? 'APTO'
                          : metrica === 'comPendencias'
                            ? 'PENDENTE'
                            : 'TODAS',
                    })
                  }
                  title={`Abrir processos de ${m.mesLabel}/${ano} em Painel e Processos`}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-1 text-slate-400 hover:border-emerald-400/40 hover:text-emerald-200"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Pendências e conferências no período (dinâmico com filtro e busca) */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">3. Pendências e alertas no período</h2>
            <p className="text-xs text-slate-400">
              Processos registrados no período com pendências bloqueantes ou pontos de conferência recomendada.
            </p>
          </div>

          {todasPendencias.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPendenciaFiltro('TODAS')}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                    pendenciaFiltro === 'TODAS'
                      ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                      : 'border-white/10 bg-[#070A12] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todos ({todasPendencias.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPendenciaFiltro('BLOQUEIO')}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                    pendenciaFiltro === 'BLOQUEIO'
                      ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                      : 'border-white/10 bg-[#070A12] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Bloqueantes ({qtdBloqueantes})
                </button>
                <button
                  type="button"
                  onClick={() => setPendenciaFiltro('CONFERENCIA')}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                    pendenciaFiltro === 'CONFERENCIA'
                      ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                      : 'border-white/10 bg-[#070A12] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Conferência ({qtdConferencia})
                </button>
              </div>

              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={pendenciaBusca}
                  onChange={(e) => setPendenciaBusca(e.target.value)}
                  placeholder="Filtrar matrícula ou motivo..."
                  aria-label="Filtrar pendências do relatório"
                  className="rounded-lg border border-white/15 bg-[#070A12] pl-8 pr-2.5 py-1 text-[11px] text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Matrícula / Protocolo</th>
                <th className="px-4 py-3">Empreendimento</th>
                <th className="px-4 py-3">Registro</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descrição principal</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!loading && pendenciasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    {todasPendencias.length === 0
                      ? 'Nenhuma pendência ou alerta registrado neste período.'
                      : 'Nenhum registro encontrado para o filtro aplicado.'}
                  </td>
                </tr>
              ) : (
                pendenciasFiltradas.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenDetalhe(p.id)}
                        className="text-left hover:underline"
                      >
                        <div className="font-bold text-white">{p.matricula}</div>
                        <div className="text-[11px] text-slate-400">Prot. {p.protocolo}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">{p.empreendimento || 'Não informado'}</div>
                      <div className="text-[11px] text-slate-400">{labelModalidade(p.modalidade)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{formatarDataBr(p.dataRegistro)}</td>
                    <td className="px-4 py-3">
                      {p.qtdBloqueios > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-rose-500/35 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-200 whitespace-nowrap">
                          Bloqueante ({p.qtdBloqueios})
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-200 whitespace-nowrap">
                          Conferência ({p.qtdAlertas})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{p.motivoPrincipal}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenDetalhe(p.id)}
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
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

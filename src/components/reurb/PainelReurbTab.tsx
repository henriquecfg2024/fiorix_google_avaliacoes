'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileCheck2, Layers, RefreshCw } from 'lucide-react';
import type { ReurbPainelDTO } from '@/lib/reurb/types';
import {
  buildAnosDisponiveis,
  formatarDataBr,
  labelModalidade,
  MESES_NOMES,
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
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">
              Regularizações registradas no período
            </h2>
            <p className="text-xs text-slate-400">
              {loading
                ? 'Carregando processos...'
                : `${data?.processosPeriodo.length ?? 0} processo(s) registrado(s) no recorte selecionado`}
            </p>
          </div>
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />}
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
            </thead>
            <tbody className="divide-y divide-white/5">
              {!loading && (data?.processosPeriodo.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Nenhuma regularização registrada no período selecionado.
                  </td>
                </tr>
              ) : (
                data?.processosPeriodo.map((reg) => (
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

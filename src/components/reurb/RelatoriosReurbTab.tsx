'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { ReurbRelatorioDTO } from '@/lib/reurb/types';
import {
  buildAnosDisponiveis,
  formatarDataBr,
  labelModalidade,
  MESES_NOMES,
  triggerDownloadBlob,
} from './reurb-ui-helpers';

interface RelatoriosReurbTabProps {
  ano: number;
  mes: number | 'todos';
  refreshKey: number;
  onChangePeriodo: (ano: number, mes: number | 'todos') => void;
  onOpenDetalhe: (id: string) => void;
}

export function RelatoriosReurbTab({
  ano,
  mes,
  refreshKey,
  onChangePeriodo,
  onOpenDetalhe,
}: RelatoriosReurbTabProps) {
  const [data, setData] = useState<ReurbRelatorioDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const maxEvolucao = Math.max(
    1,
    ...(data?.evolucaoMensal.map((m) => Math.max(m.registradas, m.derivadasAbertas)) || [1])
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Exportação Excel */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Ano</label>
            <select
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
            <label className="block text-[11px] text-slate-400 mb-1">Mês</label>
            <select
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
        </div>

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

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* 1. Resumo por modalidade */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">1. Resumo por modalidade</h2>
            <p className="text-xs text-slate-400">
              Totais consolidados com as mesmas regras de contagem do Painel (registro vs. abertura das derivadas).
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
              {data?.porModalidade.map((m) => (
                <tr key={m.modalidade}>
                  <td className="px-4 py-3 font-semibold text-white">{m.label}</td>
                  <td className="px-4 py-3 text-slate-200">{m.registradas}</td>
                  <td className="px-4 py-3 text-cyan-300 font-semibold">{m.derivadasAbertas}</td>
                  <td className="px-4 py-3 text-emerald-300 font-semibold">{m.aptas}</td>
                  <td className="px-4 py-3 text-amber-300 font-semibold">{m.comPendencias}</td>
                </tr>
              ))}
              {data && (
                <tr className="bg-white/[0.03] font-bold">
                  <td className="px-4 py-3 text-white">TOTAL DO PERÍODO</td>
                  <td className="px-4 py-3 text-white">{data.totais.registradas}</td>
                  <td className="px-4 py-3 text-cyan-300">{data.totais.derivadasAbertas}</td>
                  <td className="px-4 py-3 text-emerald-300">{data.totais.aptas}</td>
                  <td className="px-4 py-3 text-amber-300">{data.totais.comPendencias}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Evolução mensal no ano */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">2. Evolução mensal ({ano})</h2>
        </div>
        <div className="space-y-2.5">
          {data?.evolucaoMensal.map((m) => {
            const pctDer = Math.round((m.derivadasAbertas / maxEvolucao) * 100);
            return (
              <div key={m.mes} className="grid grid-cols-12 items-center gap-3 text-xs">
                <div className="col-span-2 sm:col-span-1 font-semibold text-slate-300">
                  {m.mesLabel}
                </div>
                <div className="col-span-6 sm:col-span-7 h-5 rounded-md bg-[#070A12] border border-white/10 overflow-hidden flex items-center">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500/70 to-cyan-400/70 transition-all"
                    style={{ width: `${m.derivadasAbertas > 0 ? Math.max(4, pctDer) : 0}%` }}
                  />
                </div>
                <div className="col-span-4 text-right text-[11px] text-slate-300">
                  <strong className="text-white">{m.registradas}</strong> reg. ·{' '}
                  <strong className="text-cyan-300">{m.derivadasAbertas}</strong> deriv. ·{' '}
                  <span className="text-amber-300">{m.comPendencias} pend.</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Pendências no período */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-white">3. Pendências no período</h2>
          <p className="text-xs text-slate-400">
            Processos registrados no período com pendências bloqueantes ou alertas de conferência.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Matrícula / Protocolo</th>
                <th className="px-4 py-3">Empreendimento</th>
                <th className="px-4 py-3">Registro</th>
                <th className="px-4 py-3">Pendência principal</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!loading && (data?.pendenciasPeriodo.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Nenhuma pendência registrada neste período.
                  </td>
                </tr>
              ) : (
                data?.pendenciasPeriodo.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-white">{p.matricula}</div>
                      <div className="text-[11px] text-slate-400">Prot. {p.protocolo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">{p.empreendimento || 'Não informado'}</div>
                      <div className="text-[11px] text-slate-400">{labelModalidade(p.modalidade)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{formatarDataBr(p.dataRegistro)}</td>
                    <td className="px-4 py-3 text-amber-200">{p.motivoPrincipal}</td>
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

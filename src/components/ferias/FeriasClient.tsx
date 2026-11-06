"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  CalendarCheck,
  ChevronDown,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { getMinhasFeriasAction } from "@/app/actions/ferias";
import { EscalaItem, PublicacaoStatus } from "@/lib/ferias/ferias-repository";

interface FeriasClientProps {
  userRole?: string;
  userName?: string;
  userId?: string;
  initialPublicacao?: PublicacaoStatus;
  initialFerias?: EscalaItem | null;
}

interface MesOcupacao {
  mesNum: number;
  label: string;
  hasVacation: boolean;
  interval?: string;
}

function getMesesCalendario(ano: number, ferias: EscalaItem | null): MesOcupacao[] {
  const labels = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const periodos = [
    { inicio: ferias?.p1Inicio, fim: ferias?.p1Fim },
    { inicio: ferias?.p2Inicio, fim: ferias?.p2Fim },
    { inicio: ferias?.p3Inicio, fim: ferias?.p3Fim },
  ].filter((p): p is { inicio: string; fim: string } => !!(p.inicio && p.fim));

  return labels.map((label, idx) => {
    const mesNum = idx + 1;
    let hasVacation = false;
    let interval: string | undefined;

    for (const p of periodos) {
      const [anoIni, mesIni, diaIni] = p.inicio.split("-").map(Number);
      const [anoFim, mesFim, diaFim] = p.fim.split("-").map(Number);

      if (anoIni === ano || anoFim === ano) {
        if (mesIni === mesNum && mesFim === mesNum) {
          hasVacation = true;
          interval = `${String(diaIni).padStart(2, "0")} – ${String(diaFim).padStart(2, "0")}`;
          break;
        } else if (mesIni === mesNum) {
          hasVacation = true;
          interval = `${String(diaIni).padStart(2, "0")} – ...`;
          break;
        } else if (mesFim === mesNum) {
          hasVacation = true;
          interval = `... – ${String(diaFim).padStart(2, "0")}`;
          break;
        } else if (mesNum > mesIni && mesNum < mesFim) {
          hasVacation = true;
          interval = "Mês todo";
          break;
        }
      }
    }

    return {
      mesNum,
      label,
      hasVacation,
      interval,
    };
  });
}

function formatDateBr(iso?: string | null): string {
  if (!iso) return "";
  return iso.split("-").reverse().join("/");
}

function formatShortDateBr(iso?: string | null): string {
  if (!iso) return "";
  const [, mes, dia] = iso.split("-");
  return mes && dia ? `${dia}/${mes}` : iso;
}

export function FeriasClient({
  userRole = "USER",
  initialPublicacao,
  initialFerias,
}: FeriasClientProps) {
  const isPrivilegedViewer = ["ADMIN", "RH", "MASTER", "GESTOR", "SUBSTITUTO"].includes(userRole);

  const [ano, setAno] = useState(2027);
  const [loading, setLoading] = useState(!initialPublicacao);
  const [publicacao, setPublicacao] = useState<PublicacaoStatus>(
    initialPublicacao || { ano, status: "PUBLICADA" }
  );
  const [minhasFerias, setMinhasFerias] = useState<EscalaItem | null>(initialFerias ?? null);

  useEffect(() => {
    if (ano === 2027 && initialPublicacao) {
      setPublicacao(initialPublicacao);
      setMinhasFerias(initialFerias ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getMinhasFeriasAction({ ano })
      .then((res) => {
        if (cancelled) return;
        setPublicacao(res.publicacao);
        setMinhasFerias(res.ferias);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Erro ao carregar férias:", err);
        setMinhasFerias(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ano, initialPublicacao, initialFerias]);

  const mesesCalendario = getMesesCalendario(ano, minhasFerias);
  const historicoEvents = minhasFerias?.historico || [];

  const periodosAtivos: Array<{ ordem: number; inicio: string; fim: string; dias: number }> = [];
  if (minhasFerias?.p1Inicio && minhasFerias?.p1Fim) {
    periodosAtivos.push({
      ordem: 1,
      inicio: minhasFerias.p1Inicio,
      fim: minhasFerias.p1Fim,
      dias: minhasFerias.p1Dias || 0,
    });
  }
  if (minhasFerias?.p2Inicio && minhasFerias?.p2Fim) {
    periodosAtivos.push({
      ordem: 2,
      inicio: minhasFerias.p2Inicio,
      fim: minhasFerias.p2Fim,
      dias: minhasFerias.p2Dias || 0,
    });
  }
  if (minhasFerias?.p3Inicio && minhasFerias?.p3Fim) {
    periodosAtivos.push({
      ordem: 3,
      inicio: minhasFerias.p3Inicio,
      fim: minhasFerias.p3Fim,
      dias: minhasFerias.p3Dias || 0,
    });
  }

  const totalDiasProgramados =
    minhasFerias?.totalDias ||
    periodosAtivos.reduce((acc, p) => acc + (p.dias || 0), 0);

  const proximoPeriodoKpi =
    periodosAtivos.length > 0
      ? `${formatShortDateBr(periodosAtivos[0].inicio)} a ${formatShortDateBr(periodosAtivos[0].fim)}`
      : "Não programado";

  const escalaVisivel = isPrivilegedViewer || publicacao.status === "PUBLICADA";

  return (
    <div className="w-full flex-1 min-h-full flex flex-col justify-start bg-[#070A12] text-white relative overflow-hidden pb-12 font-sans">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[90vw] max-w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-cyan-500/8 to-emerald-500/8 blur-3xl opacity-60" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-5 py-6 sm:px-8 space-y-6">
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">MEU ESPAÇO</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">FÉRIAS</span>
            <h1 className="sr-only">Minhas Férias — Programação Individual</h1>
          </div>
        </div>

        {/* ── Cards de Indicadores / Resumo Executivo (Padrão FIORIX) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KPI 1: Próximo Período */}
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Próximo Período
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                  ANO {ano}
                </span>
              </div>
              <div className="text-2xl font-black text-white truncate">
                {loading ? "..." : escalaVisivel ? proximoPeriodoKpi : "Aguardando RH"}
              </div>
              <p className="text-xs text-slate-400">
                {escalaVisivel && periodosAtivos.length > 0
                  ? `1º período oficial de ${ano}`
                  : "Programação individual no exercício"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 2: Dias Programados */}
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Dias Programados
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  {escalaVisivel && totalDiasProgramados > 0 ? "CONFIRMADO" : "PENDENTE"}
                </span>
              </div>
              <div className="text-2xl font-black text-white">
                {loading
                  ? "..."
                  : escalaVisivel
                  ? `${totalDiasProgramados} dia${totalDiasProgramados !== 1 ? "s" : ""}`
                  : "0 dias"}
              </div>
              <p className="text-xs text-emerald-400/90 font-medium">
                {escalaVisivel && periodosAtivos.length > 0
                  ? `Distribuídos em ${periodosAtivos.length} ${periodosAtivos.length === 1 ? "período" : "períodos"}`
                  : "Aguardando registro na escala"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
              <CalendarCheck className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 3: Status da Escala */}
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Status da Escala
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                  ART. 135 CLT
                </span>
              </div>
              <div className="text-2xl font-black text-white">
                {loading
                  ? "..."
                  : publicacao.status === "PUBLICADA"
                  ? "Publicada"
                  : "Em Elaboração"}
              </div>
              <p className="text-xs text-slate-400">
                {publicacao.status === "PUBLICADA"
                  ? "Homologada pela gestão de RH"
                  : "Planejamento anual em revisão"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* ── Card Principal (Padrão FIORIX) ─────────────────────────── */}
        <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 backdrop-blur-xl shadow-sm overflow-hidden">
          {/* Cabeçalho do Card */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-5 gap-4 border-b border-white/10 bg-[#0B1020]/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Férias de {ano}
                </h2>
                <p className="text-xs text-slate-400">
                  {escalaVisivel && periodosAtivos.length > 0
                    ? `${periodosAtivos.length} ${periodosAtivos.length === 1 ? "período programado" : "períodos programados"}`
                    : "Consulta de períodos, calendário anual e histórico"}
                </p>
              </div>
            </div>

            {/* Seletor de Ano */}
            <div className="relative self-start sm:self-auto">
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="appearance-none bg-[#080D1A] border border-white/15 text-white text-sm font-semibold rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-cyan-500/50 cursor-pointer transition-colors hover:bg-white/[0.04]"
              >
                <option value={2026} className="bg-[#0B1020] text-white">Ano 2026</option>
                <option value={2027} className="bg-[#0B1020] text-white">Ano 2027</option>
                <option value={2028} className="bg-[#0B1020] text-white">Ano 2028</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none" />
            </div>
          </div>

          {/* ── Conteúdo ─────────────────────────────────────────────── */}
          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <p className="text-sm text-slate-400">Carregando programação de férias...</p>
              </div>
            ) : !escalaVisivel ? (
              <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
                <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-inner">
                  <Calendar className="w-10 h-10 text-cyan-400/80" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Escala anual ainda não publicada
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Quando o setor de Recursos Humanos publicar a escala oficial de {ano}, seus períodos programados aparecerão organizados aqui.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Linha Superior: Próximas Férias + Meu Calendário */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Bloco Esquerdo: Períodos Programados */}
                  <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#080D1A] p-6 space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                          <CalendarCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">
                            Próximas férias
                          </h3>
                          <p className="text-xs text-slate-400">
                            {periodosAtivos.length > 0
                              ? `${periodosAtivos[0].ordem}º período programado`
                              : "Planejamento individual"}
                          </p>
                        </div>
                      </div>
                      {periodosAtivos.length > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {periodosAtivos[0].dias || totalDiasProgramados || 15} dias
                        </span>
                      )}
                    </div>

                    {periodosAtivos.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                          {formatDateBr(periodosAtivos[0].inicio)} — {formatDateBr(periodosAtivos[0].fim)}
                        </div>

                        {periodosAtivos.length > 1 && (
                          <div className="pt-2 flex flex-wrap gap-2">
                            {periodosAtivos.slice(1).map((p) => (
                              <span
                                key={p.ordem}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-white/10 bg-white/[0.03] text-xs text-slate-300 font-medium"
                              >
                                <span className="text-cyan-400 font-bold">{p.ordem}º período:</span>
                                <span>
                                  {formatDateBr(p.inicio)} a {formatDateBr(p.fim)}
                                </span>
                                {p.dias ? <span className="text-slate-400">({p.dias}d)</span> : null}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-3 space-y-1">
                        <div className="text-lg font-bold text-white">
                          Nenhuma férias programada em {ano}
                        </div>
                        <p className="text-xs text-slate-400">
                          Quando o RH registrar sua programação neste exercício, ela aparecerá aqui.
                        </p>
                      </div>
                    )}

                    <div className="pt-3 border-t border-white/8 flex items-center justify-between text-xs text-slate-400">
                      <span>Aviso prévio mínimo de 30 dias garantido pelo sistema</span>
                      <span className="font-mono text-[11px] text-cyan-400">CLT • ART. 135</span>
                    </div>
                  </div>

                  {/* Bloco Direito: Meu Calendário Anual */}
                  <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#080D1A] p-6 space-y-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-cyan-400" />
                        <h3 className="text-base font-bold text-white">
                          Meu calendário {ano}
                        </h3>
                      </div>
                      <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        Programadas
                      </span>
                    </div>

                    <div className="my-auto py-2 overflow-x-auto scrollbar-none">
                      <div className="grid grid-cols-6 sm:grid-cols-12 lg:grid-cols-6 gap-2 items-center">
                        {mesesCalendario.map((m) => (
                          <div key={m.mesNum} className="flex justify-center">
                            {m.hasVacation ? (
                              <div className="w-full flex flex-col items-center bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-2 py-2">
                                <span className="text-[10px] font-bold text-emerald-300">
                                  {m.label}
                                </span>
                                <span className="w-2 h-2 rounded-full bg-emerald-400 my-1" />
                                <span className="text-[10px] font-mono font-bold text-emerald-300 whitespace-nowrap">
                                  {m.interval || "Férias"}
                                </span>
                              </div>
                            ) : (
                              <div className="w-full flex flex-col items-center rounded-xl border border-white/5 bg-white/[0.015] px-2 py-2">
                                <span className="text-[10px] font-semibold text-slate-400">
                                  {m.label}
                                </span>
                                <span className="w-2 h-2 rounded-full border border-slate-600/70 my-1" />
                                <span className="text-[10px] font-mono text-slate-600 select-none">
                                  —
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/8 text-xs text-slate-400 flex items-center justify-between">
                      <span>Visão mensal consolidada</span>
                      <span className="font-mono text-[11px] text-slate-500">12 MESES</span>
                    </div>
                  </div>
                </div>

                {/* Linha Inferior: Histórico de Férias */}
                <div className="rounded-2xl border border-white/10 bg-[#080D1A] p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/8 pb-3.5">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-base font-bold text-white">
                        Histórico de movimentações
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400">
                      {historicoEvents.length}{" "}
                      {historicoEvents.length === 1 ? "registro" : "registros"}
                    </span>
                  </div>

                  {historicoEvents.length > 0 ? (
                    <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-500/25">
                      {historicoEvents.map((ev, i) => (
                        <div key={i} className="relative space-y-1">
                          <span className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          <div className="text-xs text-slate-400 font-mono">{ev.data}</div>
                          <div className="text-sm font-bold text-white">
                            Férias de {ano} programadas
                          </div>
                          <div className="text-xs text-slate-400">
                            {ev.por || "Atualizado por RH"}
                          </div>
                          {ev.motivo && (
                            <div className="rounded-xl border border-white/10 bg-[#0B1020]/80 p-3 text-xs text-slate-300 font-mono mt-1.5 max-w-2xl">
                              {ev.motivo}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      Nenhum evento registrado no histórico para o exercício de {ano}.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Rodapé do Card ───────────────────────────────────────── */}
          <div className="px-6 py-3.5 border-t border-white/10 bg-[#0B1020]/80 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Programação individual homologada pelo setor de Recursos Humanos.</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">7º RI SP • SIGA/FIORIX</span>
          </div>
        </div>
      </div>
    </div>
  );
}

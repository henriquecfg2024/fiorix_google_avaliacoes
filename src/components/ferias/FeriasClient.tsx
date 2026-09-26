"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, CalendarCheck } from "lucide-react";
import { EscalaAnualClient } from "@/components/ferias/EscalaAnualClient";
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

function VacationIllustration() {
  return (
    <svg
      viewBox="0 0 280 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full select-none pointer-events-none"
    >
      <defs>
        <radialGradient
          id="sunGlow"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(200 65) rotate(90) scale(75)"
        >
          <stop stopColor="#6366F1" stopOpacity="0.4" />
          <stop offset="0.6" stopColor="#38BDF8" stopOpacity="0.15" />
          <stop offset="1" stopColor="#0B1020" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="calLine" x1="150" y1="90" x2="230" y2="155" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" stopOpacity="0.8" />
          <stop offset="1" stopColor="#6366F1" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Sun/Moon glow */}
      <circle cx="200" cy="65" r="42" fill="url(#sunGlow)" />
      <circle cx="200" cy="65" r="24" fill="#38BDF8" fillOpacity="0.08" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.3" />

      {/* Horizon / Soft Hills */}
      <path d="M110 160 Q170 135 280 148 L280 180 L110 180 Z" fill="#0c1226" fillOpacity="0.9" />
      <path d="M140 170 Q210 150 280 162 L280 180 L140 180 Z" fill="#080d1c" />

      {/* Palm Trees Silhouette */}
      <g stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" opacity="0.65">
        <path d="M260 160 Q255 110 242 85" fill="none" />
        <path d="M242 85 Q225 75 210 82" fill="none" />
        <path d="M242 85 Q232 65 220 62" fill="none" />
        <path d="M242 85 Q250 68 262 70" fill="none" />
        <path d="M242 85 Q258 80 270 90" fill="none" />
        <path d="M242 85 Q248 95 255 105" fill="none" />
        <path d="M272 165 Q270 125 264 105" fill="none" strokeWidth="2" />
        <path d="M264 105 Q252 95 240 100" fill="none" strokeWidth="2" />
        <path d="M264 105 Q268 90 278 92" fill="none" strokeWidth="2" />
      </g>

      {/* 3D Tilted Desk Calendar Wireframe */}
      <g transform="translate(148, 80) rotate(-4)">
        {/* Shadow base */}
        <polygon points="12,78 72,78 64,84 4,84" fill="#030712" opacity="0.8" />
        {/* Stand / back support */}
        <polygon points="12,18 20,8 78,8 70,18" fill="#1e1b4b" opacity="0.5" stroke="url(#calLine)" strokeWidth="1" />
        <polygon points="12,18 70,18 68,78 10,78" fill="#0f172a" opacity="0.85" stroke="url(#calLine)" strokeWidth="1.2" />

        {/* Spiral binder loops */}
        <circle cx="22" cy="18" r="2.5" fill="#38BDF8" fillOpacity="0.8" />
        <circle cx="34" cy="18" r="2.5" fill="#38BDF8" fillOpacity="0.8" />
        <circle cx="46" cy="18" r="2.5" fill="#38BDF8" fillOpacity="0.8" />
        <circle cx="58" cy="18" r="2.5" fill="#38BDF8" fillOpacity="0.8" />

        {/* Calendar days grid (subtle neon cells) */}
        <rect x="18" y="30" width="8" height="6" rx="1.5" fill="#6366F1" fillOpacity="0.3" stroke="#818CF8" strokeWidth="0.8" />
        <rect x="30" y="30" width="8" height="6" rx="1.5" fill="#6366F1" fillOpacity="0.3" stroke="#818CF8" strokeWidth="0.8" />
        <rect x="42" y="30" width="8" height="6" rx="1.5" fill="#38BDF8" fillOpacity="0.6" stroke="#38BDF8" strokeWidth="0.8" />
        <rect x="54" y="30" width="8" height="6" rx="1.5" fill="#6366F1" fillOpacity="0.3" stroke="#818CF8" strokeWidth="0.8" />

        <rect x="18" y="42" width="8" height="6" rx="1.5" fill="#6366F1" fillOpacity="0.3" stroke="#818CF8" strokeWidth="0.8" />
        <rect x="30" y="42" width="8" height="6" rx="1.5" fill="#38BDF8" fillOpacity="0.6" stroke="#38BDF8" strokeWidth="0.8" />
        <rect x="42" y="42" width="8" height="6" rx="1.5" fill="#38BDF8" fillOpacity="0.6" stroke="#38BDF8" strokeWidth="0.8" />
        <rect x="54" y="42" width="8" height="6" rx="1.5" fill="#6366F1" fillOpacity="0.3" stroke="#818CF8" strokeWidth="0.8" />

        <rect x="18" y="54" width="8" height="6" rx="1.5" fill="#6366F1" fillOpacity="0.3" stroke="#818CF8" strokeWidth="0.8" />
        <rect x="30" y="54" width="8" height="6" rx="1.5" fill="#6366F1" fillOpacity="0.3" stroke="#818CF8" strokeWidth="0.8" />
        <rect x="42" y="54" width="8" height="6" rx="1.5" fill="#6366F1" fillOpacity="0.3" stroke="#818CF8" strokeWidth="0.8" />
        <rect x="54" y="54" width="8" height="6" rx="1.5" fill="#6366F1" fillOpacity="0.3" stroke="#818CF8" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

export function FeriasClient({
  userRole = "USER",
  userName = "Colaborador",
  userId = "",
  initialPublicacao,
  initialFerias,
}: FeriasClientProps) {
  const [mounted, setMounted] = useState(false);
  const isManager = ["ADMIN", "RH", "MASTER", "GESTOR"].includes(userRole);
  const isSubstituto = userRole === "SUBSTITUTO";
  const canAccessEscala = isManager || isSubstituto;
  const isReadOnly = isSubstituto;

  const [activeTab, setActiveTab] = useState<"minhas" | "escala">("minhas");
  const [ano, setAno] = useState(2027);
  const [loading, setLoading] = useState(!initialPublicacao);
  const [publicacao, setPublicacao] = useState<PublicacaoStatus>(
    initialPublicacao || { ano, status: "PUBLICADA" }
  );
  const [minhasFerias, setMinhasFerias] = useState<EscalaItem | null>(initialFerias ?? null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "escala" && canAccessEscala) {
        setActiveTab("escala");
      } else {
        setActiveTab("minhas");
      }
    }
  }, [canAccessEscala]);

  useEffect(() => {
    setMounted(true);

    // Se é a carga inicial com 2027 e já temos dados pré-carregados pelo servidor, pula refetch
    if (ano === 2027 && initialPublicacao) {
      return;
    }

    setLoading(true);

    // Consulta isolada com Anti-IDOR e Zero Leakage
    getMinhasFeriasAction({ ano })
      .then((res) => {
        setPublicacao(res.publicacao);
        setMinhasFerias(res.ferias);
      })
      .catch((err) => {
        console.error("Erro ao carregar férias:", err);
        setMinhasFerias(null);
      })
      .finally(() => setLoading(false));
  }, [ano, initialPublicacao]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070A12] text-slate-900 dark:text-white p-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="h-8 w-48 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-64 bg-white dark:bg-[#0B1020]/72 rounded-[28px] border border-slate-200 dark:border-white/8 animate-pulse" />
        </div>
      </div>
    );
  }

  // 12 Meses calculados
  const mesesCalendario = getMesesCalendario(ano, minhasFerias);

  // Lista de eventos da linha do tempo
  const historicoEvents = minhasFerias?.historico || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A12] text-slate-900 dark:text-white relative overflow-hidden pb-20">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-6 sm:px-8 space-y-6">
        {/* Se tiver acesso e estiver na aba de escala anual, exibe a escala anual */}
        {canAccessEscala && activeTab === "escala" ? (
          <div>
            {/* Seletor de abas */}
            <div className="flex justify-end mb-4">
              <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-slate-200 dark:border-white/8 text-xs font-bold">
                <button
                  onClick={() => setActiveTab("escala")}
                  className="px-4 py-2 rounded-xl transition-all cursor-pointer bg-indigo-600 text-white shadow-lg"
                >
                  Escala Anual de Férias
                </button>
                <button
                  onClick={() => setActiveTab("minhas")}
                  className="px-4 py-2 rounded-xl transition-all cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Minhas Férias
                </button>
              </div>
            </div>

            <EscalaAnualClient
              initialAno={ano}
              initialPublicacao={publicacao}
              userRole={userRole}
              readOnly={isReadOnly}
            />
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────
              TELA "MINHAS FÉRIAS" DO COLABORADOR (PREMIUM & ACOLHEDORA)
          ───────────────────────────────────────────────────────────── */
          <div className="space-y-6">
            {/* 1. Header & Seletor de Ano */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/6">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
                  <span className="text-slate-600">/</span>
                  <Link href="/pessoas" className="hover:text-white transition-colors">Pessoas</Link>
                  <span className="text-slate-600">/</span>
                  <span className="text-emerald-400 font-semibold">Férias</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                    MINHAS FÉRIAS
                  </h1>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Programação individual e histórico de concessões.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Seletor de Ano estilizado com borda violeta */}
                <div className="flex items-center bg-white dark:bg-[#0c1224] border border-slate-200 dark:border-indigo-500/30 rounded-2xl px-3.5 py-2 shadow-sm text-indigo-700 dark:text-indigo-300">
                  <Calendar className="w-4 h-4 text-indigo-400 mr-2" />
                  <select
                    value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                    className="bg-transparent text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer pr-1"
                  >
                    <option value={2026} className="bg-[#0c101c] text-white">2026</option>
                    <option value={2027} className="bg-[#0c101c] text-white">2027</option>
                    <option value={2028} className="bg-[#0c101c] text-white">2028</option>
                  </select>
                </div>

                {canAccessEscala && (
                  <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-slate-200 dark:border-white/8 text-xs font-bold">
                    <button
                      onClick={() => setActiveTab("escala")}
                      className="px-4 py-2 rounded-xl transition-all cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    >
                      Escala Anual de Férias
                    </button>
                    <button
                      onClick={() => setActiveTab("minhas")}
                      className="px-4 py-2 rounded-xl transition-all cursor-pointer bg-indigo-600 text-white shadow-lg"
                    >
                      Minhas Férias
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 1. Loading State (Skeleton Shimmer) enquanto busca os dados */}
            {loading ? (
              <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Skeleton Card Esquerdo: Próximas Férias */}
                  <div className="lg:col-span-7 flex flex-col justify-between rounded-[24px] border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0c142e]/60 p-7 min-h-[340px] shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white/5" />
                      <div className="space-y-2">
                        <div className="h-6 w-44 bg-white/10 rounded-lg" />
                        <div className="h-4 w-32 bg-white/5 rounded-md" />
                      </div>
                    </div>
                    <div className="space-y-3 my-6">
                      <div className="h-10 w-72 bg-white/10 rounded-xl" />
                      <div className="h-6 w-20 bg-white/5 rounded-full" />
                    </div>
                    <div className="h-4 w-48 bg-white/5 rounded-md" />
                  </div>

                  {/* Skeleton Card Direito: Calendário */}
                  <div className="lg:col-span-5 flex flex-col justify-between rounded-[24px] border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0B1020]/72 p-7 min-h-[340px] shadow-sm">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/6">
                      <div className="h-5 w-36 bg-white/10 rounded-lg" />
                      <div className="h-4 w-28 bg-white/5 rounded-full" />
                    </div>
                    <div className="grid grid-cols-6 gap-2 my-4">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="h-14 bg-white/5 rounded-xl" />
                      ))}
                    </div>
                    <div className="h-3 w-40 bg-white/5 rounded mx-auto" />
                  </div>
                </div>

                {/* Skeleton Card Histórico */}
                <div className="rounded-[24px] border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0B1020]/72 p-7 space-y-4 shadow-sm">
                  <div className="h-5 w-40 bg-white/10 rounded-lg" />
                  <div className="h-14 bg-white/5 rounded-2xl" />
                </div>
              </div>
            ) : !canAccessEscala && publicacao.status !== "PUBLICADA" ? (
              /* 2. Aviso de escala não publicada (apenas quando a consulta retornou e realmente NÃO está publicada) */
              <div className="w-full max-w-3xl mx-auto py-12 px-6 rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020]/72 backdrop-blur-xl text-center space-y-4 shadow-sm dark:shadow-xl">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                  <Calendar className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    A escala anual de férias ainda não foi publicada pelo RH.
                  </h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Aguarde a divulgação ou entre em contato com o setor responsável.
                  </p>
                </div>
              </div>
            ) : (
              /* Composição Visual de 3 Cards */
              <div className="space-y-6">
                {/* Linha Superior: 2 Cards Principais (60% / 40%) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Card Esquerdo: Próximas férias (aprox. 58-60%) */}
                  <div className="lg:col-span-7 flex flex-col justify-between rounded-[24px] border border-indigo-500/20 bg-gradient-to-br from-[#0c142e] via-[#0B1020] to-[#070A12] p-7 shadow-xl relative overflow-hidden backdrop-blur-xl min-h-[340px]">
                    {/* Brilho esmeralda suave no canto superior esquerdo */}
                    <div className="pointer-events-none absolute -top-16 -left-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl" />

                    {/* Arte vetorial noturna no canto inferior direito */}
                    <div className="absolute right-0 bottom-0 w-64 sm:w-80 h-44 sm:h-52 pointer-events-none opacity-60 sm:opacity-85">
                      <VacationIllustration />
                    </div>

                    {/* Topo do Card */}
                    <div className="relative z-10 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)] shrink-0">
                        <CalendarCheck className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                          Próximas férias
                        </h3>
                        <p className="text-xs sm:text-sm text-indigo-300/80 font-medium mt-0.5">
                          {minhasFerias?.p1Inicio ? "1º período programado" : "Planejamento individual"}
                        </p>
                      </div>
                    </div>

                    {/* Meio: Datas em Destaque */}
                    <div className="relative z-10 my-6 space-y-3">
                      {minhasFerias?.p1Inicio && minhasFerias?.p1Fim ? (
                        <>
                          <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-mono sm:font-sans">
                            {minhasFerias.p1Inicio.split("-").reverse().join("/")} — {minhasFerias.p1Fim.split("-").reverse().join("/")}
                          </div>
                          <div>
                            <span className="inline-flex items-center px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold text-xs shadow-sm">
                              {minhasFerias.p1Dias || minhasFerias.totalDias || 15} dias
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1.5 py-2">
                          <div className="text-xl font-bold text-slate-900 dark:text-white">
                            Nenhuma férias programada
                          </div>
                          <p className="text-xs text-slate-400">
                            Quando o RH registrar sua programação, ela aparecerá aqui.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Rodapé: Citação acolhedora */}
                    <div className="relative z-10 pt-2">
                      <p className="text-xs text-slate-400 italic">
                        “Tempo para viver o que realmente importa.”
                      </p>
                    </div>
                  </div>

                  {/* Card Direito: Meu calendário [Ano] (aprox. 40-42%) */}
                  <div className="lg:col-span-5 flex flex-col justify-between rounded-[24px] border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0B1020]/80 p-7 shadow-sm dark:shadow-xl relative overflow-hidden backdrop-blur-xl min-h-[340px]">
                    {/* Topo do Calendário com Ícone e Legenda */}
                    <div className="flex items-center justify-between gap-2 pb-4">
                      <div className="flex items-center gap-2.5">
                        <Calendar className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                          Meu calendário {ano}
                        </h3>
                      </div>
                      <span className="flex items-center gap-1.5 text-xs text-slate-400 font-medium shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        Férias programadas
                      </span>
                    </div>

                    {/* Régua Horizontal dos 12 Meses */}
                    <div className="my-auto py-4 overflow-x-auto scrollbar-none">
                      <div className="grid grid-cols-12 gap-1 min-w-[340px] items-center">
                        {mesesCalendario.map((m) => (
                          <div key={m.mesNum} className="flex justify-center">
                            {m.hasVacation ? (
                              <div className="flex flex-col items-center bg-emerald-950/40 border border-emerald-500/40 rounded-2xl px-1.5 py-2.5 shadow-[0_0_15px_rgba(16,185,129,0.18)] min-w-[32px] sm:min-w-[36px]">
                                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-300">
                                  {m.label}
                                </span>
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)] my-1" />
                                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-300 whitespace-nowrap mt-0.5">
                                  {m.interval || "Férias"}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center py-2.5 min-w-[28px] sm:min-w-[32px]">
                                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">
                                  {m.label}
                                </span>
                                <span className="w-2.5 h-2.5 rounded-full border border-slate-600/70 my-1" />
                                <span className="text-[9px] sm:text-[10px] text-transparent select-none mt-0.5">
                                  —
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rodapé do Calendário */}
                    <div className="pt-2 text-center sm:text-right">
                      <p className="text-xs text-slate-400/80 italic">
                        Grandes momentos também fazem parte da sua jornada.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Linha Inferior: Histórico de Férias (100% largura) */}
                <div className="rounded-[24px] border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0B1020]/80 p-7 shadow-sm dark:shadow-xl relative backdrop-blur-xl space-y-6">
                  {/* Cabeçalho do Card */}
                  <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-white/8 pb-4">
                    <Calendar className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      Histórico de férias
                    </h3>
                  </div>

                  {/* Linha do Tempo Limpa & Elegante */}
                  {historicoEvents.length > 0 ? (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-500/20">
                      {historicoEvents.map((ev, i) => (
                        <div key={i} className="relative space-y-1.5">
                          {/* Marcador na linha do tempo */}
                          <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                          <div className="text-xs text-slate-400 font-mono">
                            {ev.data}
                          </div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            Férias de {ano} programadas
                          </div>
                          <div className="text-xs text-slate-400">
                            {ev.por || "Atualizado por RH"}
                          </div>
                          {ev.motivo && (
                            <div className="rounded-2xl border border-slate-200 dark:border-white/6 bg-slate-50 dark:bg-[#070A12]/60 p-3.5 text-xs text-slate-700 dark:text-slate-300 font-mono mt-1 max-w-2xl">
                              {ev.motivo}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs italic">
                      Nenhum evento registrado no histórico para este ano.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

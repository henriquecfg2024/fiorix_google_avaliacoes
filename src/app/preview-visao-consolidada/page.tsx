"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sun,
  Moon,
  TrendingUp,
  Star,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Building2,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useTheme } from "next-themes";

export default function PreviewVisaoConsolidadaPage() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A12] text-slate-900 dark:text-white transition-colors duration-300 font-sans">
      {/* ── BANNER FIXO DE CONTROLE DO PREVIEW ── */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white border-b border-indigo-500/30 px-4 py-2.5 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500 text-white font-black text-xs shadow-sm">
              F
            </span>
            <span className="text-xs font-semibold tracking-wide">
              PREVIEW INTERATIVO • FIORIX DESIGN SYSTEM
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 font-bold">
              Visão Consolidada
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 hidden md:inline">
              Alterne o tema no seletor ou no botão do cabeçalho:
            </span>
            <ThemeToggle variant="pills" />
          </div>
        </div>
      </div>

      {/* ── SIMULAÇÃO DO TOPBAR REAL DO FIORIX ── */}
      <header className="h-14 w-full border-b border-slate-200 dark:border-white/[0.08] bg-white/90 dark:bg-[#080A12]/90 backdrop-blur-md sticky top-[45px] z-40 transition-colors">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between px-4 lg:px-8">
          {/* Logo e Contexto */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366f1] to-[#a855f7] text-white font-extrabold shadow-md shadow-indigo-500/20">
              F
            </div>
            <div>
              <span className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight block">
                FIORIX
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-white/50 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                7º RI São Paulo
              </span>
            </div>
          </div>

          {/* Ações da Direita */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>✓ Todas respondidas</span>
            </div>

            {/* BOTÃO EM DESTAQUE NO CABEÇALHO */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-white/10">
              <ThemeToggle />
            </div>

            {/* Avatar do Usuário */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#6366f1] to-[#a855f7] text-white font-bold text-xs shadow-md cursor-pointer hover:scale-105 transition-transform" title="Jonatan Lima">
              JL
            </div>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL DA VISÃO CONSOLIDADA ── */}
      <main className="max-w-7xl mx-auto px-4 py-8 lg:px-8 space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/8">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-400 dark:text-slate-600">/</span>
              <span className="text-slate-700 dark:text-slate-300 font-semibold">Visão Geral</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Visão Consolidada
              </h1>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-0.5 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                PAINEL EXECUTIVO
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Indicadores consolidados de reputação, avaliações Google e performance operacional.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-xl font-medium border bg-white dark:bg-white/[0.04] text-slate-600 dark:text-white/70 border-slate-200 dark:border-white/10">
              Última sincronização: hoje às 08:30
            </span>
          </div>
        </div>

        {/* ── ILHA DE CLAREZA / CARDS DE DESTAQUE SUPERIOR ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* CARD 1: SAÚDE DA REPUTAÇÃO (SCORE 81/100) */}
          <div className="lg:col-span-7 rounded-[28px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020]/90 p-6 sm:p-7 shadow-[0_15px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.3)] transition-all">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/8">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Saúde da Reputação
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Índice consolidado de qualidade do atendimento
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+4.2% este mês</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 pt-5 items-center">
              {/* Score Circular */}
              <div className="sm:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-[#080D1A] border border-slate-200/80 dark:border-white/8">
                <div className="relative flex items-center justify-center w-36 h-36">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      className="text-slate-200 dark:text-slate-800"
                      strokeWidth="10"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      stroke="#06B6D4"
                      strokeWidth="10"
                      strokeDasharray={2 * Math.PI * 48}
                      strokeDashoffset={2 * Math.PI * 48 * (1 - 81 / 100)}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      81
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      de 100 pts
                    </span>
                  </div>
                </div>
                <span className="mt-2 text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                  Nível Excelente
                </span>
              </div>

              {/* Detalhes do Score */}
              <div className="sm:col-span-7 space-y-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/6 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Avaliações Positivas (4 e 5⭐)</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">468 (87.3%)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/6 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Neutras (3⭐)</span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">35 (6.5%)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/6 flex items-center justify-between">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Críticas (1 e 2⭐)</span>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">33 (6.2%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: SIMULAÇÃO DE IMPACTO OPERACIONAL / IA */}
          <div className="lg:col-span-5 rounded-[28px] border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 dark:from-[#11162B] dark:via-[#0B1020] dark:to-[#17132C] p-6 sm:p-7 shadow-[0_15px_40px_rgba(99,102,241,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col justify-between transition-all">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-indigo-100 dark:border-white/8">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Inteligência FIORIX
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/20">
                  Simulação
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  Resolvendo o gargalo de atendimento telefônico, o Score salta de:
                </h3>
                <div className="flex items-center gap-3 py-1">
                  <div className="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 font-black text-xl text-slate-800 dark:text-white">
                    81
                  </div>
                  <ArrowRight className="w-5 h-5 text-indigo-500" />
                  <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 font-black text-xl text-emerald-600 dark:text-emerald-400">
                    92 pts
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Identificamos 18 menções recentes sobre demora na linha telefônica. A correção direta desse ponto tem impacto imediato de +11 pontos na reputação pública.
                </p>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-indigo-100 dark:border-white/8">
              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Ver Diagnóstico Completo no BI</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── LINHA DE KPIS OPERACIONAIS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1 */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0B1020] shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Nota Média Google</span>
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
              4.4 <span className="text-sm font-semibold text-slate-400">/ 5.0</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <span>★ ★ ★ ★ ☆</span>
              <span className="text-slate-400 ml-1">536 avaliações</span>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0B1020] shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Taxa de Resposta</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#10B981] mt-2">
              98.2%
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              526 de 536 clientes respondidos
            </div>
          </div>

          {/* KPI 3 */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0B1020] shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Tempo Médio Resposta</span>
              <Clock className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#22D3EE] mt-2">
              4h 12m
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Meta da serventia: menos de 24h
            </div>
          </div>

          {/* KPI 4 */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#0B1020] shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Satisfação Líquida (NPS)</span>
              <ThumbsUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
              +81 pts
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Zona de Excelência regulatória
            </div>
          </div>
        </div>

        {/* ── EXPLICAÇÃO TÉCNICA E COMPARATIVO ── */}
        <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-100/60 dark:bg-white/[0.02]">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>💡 Como funciona a alternância:</span>
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Ao clicar no botão de <strong>Sol / Lua</strong> no topo direito da tela, todas as classes com prefixo <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 font-mono text-[11px]">dark:</code> são ativadas/desativadas instantaneamente sem recarregar a página. As métricas e cores semânticas (Verde `#10B981`, Ciano `#22D3EE`, Âmbar `#F59E0B`) mantêm o mesmo significado e contraste perfeito nos dois modos.
          </p>
        </div>
      </main>
    </div>
  );
}

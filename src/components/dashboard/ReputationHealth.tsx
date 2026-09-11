import React from 'react';
import Link from 'next/link';
import {
  Handshake,
  Target,
  Hourglass,
  Building2,
  FileText,
  DollarSign,
  Clock,
  Phone,
  Globe,
  SquareParking,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Lightbulb,
  BarChart3,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { ReputationHealthData, ReputationIndicatorItem } from '@/lib/reputation-health';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Handshake,
  Target,
  Hourglass,
  Building2,
  FileText,
  DollarSign,
  Clock,
  Phone,
  Globe,
  SquareParking,
};

interface ReputationHealthProps {
  variant?: 'executive' | 'detailed';
  data: ReputationHealthData;
}

export function ReputationHealth({ variant = 'executive', data }: ReputationHealthProps) {
  const gaugeRadius = 66;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference - (data.scoreGeral / 100) * gaugeCircumference;

  // ─────────────────────────────────────────────────────────────
  // 1. VARIANTE EXECUTIVA (HOME / Visão Consolidada)
  // ─────────────────────────────────────────────────────────────
  if (variant === 'executive') {
    return (
      <div className="space-y-6 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 lg:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all">
        {/* Header do Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] shrink-0" />
              <h2 className="text-lg font-extrabold tracking-tight text-white">
                Saúde da Reputação
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Como está a reputação do seu cartório no Google.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold shadow-sm">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-300 font-bold">+{data.variacaoMensal}%</span>
            <span className="text-slate-400 font-normal">vs. mês anterior</span>
          </div>
        </div>

        {/* Grid Principal: Coluna Esquerda (Gauge) & Coluna Direita (Resumo Executivo) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Coluna Esquerda: Gauge Circular Ciano */}
          <div className="lg:col-span-4 flex flex-col justify-center items-center rounded-2xl border border-white/12 bg-[#080D1A]/80 p-6 text-center shadow-inner">
            <div className="relative flex h-44 w-44 items-center justify-center">
              <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={gaugeRadius}
                  className="text-slate-800/80"
                  strokeWidth="12"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={gaugeRadius}
                  stroke="#06B6D4"
                  strokeWidth="12"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="drop-shadow-[0_0_16px_rgba(6,182,212,0.45)] transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-5xl font-black tracking-tight text-white">{data.scoreGeral}</span>
                <span className="text-xs font-semibold text-slate-400 mt-0.5">de 100</span>
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mt-4">
              Reputação <span className={`${data.reputacaoLabelColor} font-black`}>{data.reputacaoLabel}</span>
            </h3>
            <p className="text-xs leading-relaxed text-slate-400 mt-2 max-w-xs">
              {data.reputacaoMsg}
            </p>
          </div>

          {/* Coluna Direita: Contadores + Prioridades + Oportunidade */}
          <div className="lg:col-span-8 flex flex-col justify-between gap-5">
            {/* Linha 1: Três Contadores Executivos Interativos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card 1: Saudáveis */}
              <Link
                href="/estatisticas"
                className="group flex items-center justify-between rounded-2xl border border-white/12 bg-[#080D1A]/80 p-4 transition-all duration-200 hover:border-emerald-500/40 hover:bg-[#0c1428]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white leading-none">
                      {data.contadores.saudaveis}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      Indicadores Saudáveis
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              {/* Card 2: Pontos de Atenção */}
              <Link
                href="/estatisticas"
                className="group flex items-center justify-between rounded-2xl border border-white/12 bg-[#080D1A]/80 p-4 transition-all duration-200 hover:border-amber-500/40 hover:bg-[#0c1428]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white leading-none">
                      {data.contadores.atencao}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      Pontos de Atenção
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
              </Link>

              {/* Card 3: Indicadores Críticos */}
              <Link
                href="/estatisticas"
                className="group flex items-center justify-between rounded-2xl border border-white/12 bg-[#080D1A]/80 p-4 transition-all duration-200 hover:border-rose-500/40 hover:bg-[#0c1428]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white leading-none">
                      {data.contadores.criticos}
                    </div>
                    <div className="text-xs text-slate-300 font-medium mt-1">
                      Indicadores Críticos
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>

            {/* Linha 2: Principais Pontos de Atenção */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-400" />
                    <h4 className="text-sm font-bold text-rose-400">
                      Principais pontos de atenção
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400">
                    Itens que mais impactam a sua reputação no momento.
                  </p>
                </div>
              </div>

              {/* 3 Cards de Prioridade Dinâmica */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.prioridades.map((ind) => {
                  const IconComponent = ICON_MAP[ind.iconName] || AlertCircle;
                  return (
                    <Link
                      key={ind.id}
                      href={`/avaliacoes?search=${encodeURIComponent(ind.query)}`}
                      className="group flex flex-col justify-between rounded-2xl border border-white/12 bg-[#080D1A]/80 p-3.5 transition-all duration-200 hover:border-rose-500/40 hover:bg-[#0c1428]"
                    >
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2.5 truncate min-w-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${ind.iconBoxClass}`}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
                            {ind.nome}
                          </span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold font-mono text-rose-300 shrink-0">
                          {ind.score}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80 mt-2.5">
                        <div
                          className="h-full rounded-full bg-rose-500 transition-all duration-700"
                          style={{ width: `${Math.max(ind.score, 4)}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Linha 3: Oportunidade de Melhoria & CTA Principal */}
            <div className="rounded-2xl border border-white/12 bg-white/[0.02] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-cyan-300">
                    Oportunidade de melhoria
                  </h5>
                  <p className="text-xs text-slate-300 mt-0.5">
                    A correção dos itens críticos pode elevar significativamente o seu Score de Reputação.
                  </p>
                </div>
              </div>

              <Link
                href="/estatisticas"
                className="flex items-center gap-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold px-4 py-2.5 text-xs sm:text-sm shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all shrink-0 self-end sm:self-auto"
              >
                <span>Ver análise completa</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. VARIANTE ANALÍTICA DETALHADA (ESTATÍSTICAS)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 lg:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all">
      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] shrink-0" />
            <h2 className="text-lg font-extrabold tracking-tight text-white">
              Saúde da Reputação
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Acompanhe os principais indicadores que impactam a experiência dos usuários e a reputação do cartório.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 shadow-sm">
          <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
          <span>{data.contadores.total} Indicadores</span>
        </div>
      </div>

      {/* Grid Principal: Coluna Esquerda (Gauge) & Coluna Direita (Grupos Semânticos) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Coluna Esquerda: Gauge Circular Ciano e Acesso Metodológico */}
        <div className="lg:col-span-4 flex flex-col justify-between items-center rounded-2xl border border-white/12 bg-[#080D1A]/80 p-6 text-center shadow-inner">
          <div className="flex flex-col items-center justify-center pt-2">
            <div className="relative flex h-44 w-44 items-center justify-center">
              <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  r={gaugeRadius}
                  className="text-slate-800/80"
                  strokeWidth="12"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="80"
                  cy="80"
                  r={gaugeRadius}
                  stroke="#06B6D4"
                  strokeWidth="12"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="drop-shadow-[0_0_16px_rgba(6,182,212,0.45)] transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-5xl font-black tracking-tight text-white">{data.scoreGeral}</span>
                <span className="text-xs font-semibold text-slate-400 mt-0.5">de 100</span>
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mt-4">
              Reputação <span className={`${data.reputacaoLabelColor} font-black`}>{data.reputacaoLabel}</span>
            </h3>
            <p className="text-xs leading-relaxed text-slate-400 mt-2 max-w-xs">
              {data.reputacaoMsg}
            </p>
          </div>
        </div>


        {/* Coluna Direita: Grupos Semânticos (4 Saudáveis, 3 Atenção, 3 Críticos) */}
        <div className="lg:col-span-8 flex flex-col justify-between gap-5">
          {/* 1. Indicadores Saudáveis */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-emerald-400">Indicadores Saudáveis</h4>
              </div>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                {data.saudaveis.length} de 10
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.saudaveis.map((ind) => (
                <IndicatorCard key={ind.id} ind={ind} tone="green" />
              ))}
            </div>
          </div>

          {/* 2. Pontos de Atenção */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h4 className="text-sm font-bold text-amber-400">Pontos de Atenção</h4>
              </div>
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                {data.atencao.length} de 10
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.atencao.map((ind) => (
                <IndicatorCard key={ind.id} ind={ind} tone="amber" />
              ))}
            </div>
          </div>

          {/* 3. Indicadores Críticos */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400" />
                <h4 className="text-sm font-bold text-rose-400">Indicadores Críticos</h4>
              </div>
              <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-300">
                {data.criticos.length} de 10
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.criticos.map((ind) => (
                <IndicatorCard key={ind.id} ind={ind} tone="red" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IndicatorCard({
  ind,
  tone,
}: {
  ind: ReputationIndicatorItem;
  tone: 'green' | 'amber' | 'red';
}) {
  const IconComponent = ICON_MAP[ind.iconName] || AlertCircle;
  const borderClass =
    tone === 'green'
      ? 'border-emerald-500/20 hover:border-emerald-500/40'
      : tone === 'amber'
      ? 'border-amber-500/20 hover:border-amber-500/40'
      : 'border-rose-500/20 hover:border-rose-500/40';

  const textClass =
    tone === 'green' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-rose-300';

  const barClass =
    tone === 'green' ? 'bg-emerald-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-rose-500';

  return (
    <Link
      href={`/avaliacoes?search=${encodeURIComponent(ind.query)}`}
      className={`group flex flex-col justify-between rounded-2xl border ${borderClass} bg-[#080D1A]/80 p-3.5 transition-all duration-200 hover:bg-[#0c1428]`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2.5 truncate min-w-0">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${ind.iconBoxClass}`}>
            <IconComponent className="h-4 w-4" />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
            {ind.nome}
          </span>
        </div>
        <span className={`text-xs sm:text-sm font-bold font-mono ${textClass} shrink-0`}>
          {ind.score}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80 mt-2.5">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barClass}`}
          style={{ width: `${Math.max(ind.score, 4)}%` }}
        />
      </div>
    </Link>
  );
}

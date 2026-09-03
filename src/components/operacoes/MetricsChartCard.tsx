import React, { useState } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { OperationsHealthSnapshot } from '@/lib/health/operations-service';

interface Props {
  metrics: OperationsHealthSnapshot['metrics'];
}

export function MetricsChartCard({ metrics }: Props) {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h');

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="text-sm font-bold text-white tracking-wide">
          Métricas da Plataforma
        </h3>

        <div className="flex items-center gap-1 bg-[#070A12] p-1 rounded-xl border border-white/8 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setPeriod('24h')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              period === '24h' 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                : 'text-white/50 hover:text-white'
            }`}
          >
            24 horas
          </button>
          <button
            type="button"
            onClick={() => setPeriod('7d')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              period === '7d' 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                : 'text-white/50 hover:text-white'
            }`}
          >
            7 dias
          </button>
          <button
            type="button"
            onClick={() => setPeriod('30d')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              period === '30d' 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                : 'text-white/50 hover:text-white'
            }`}
          >
            30 dias
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Disponibilidade */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
          <span className="text-xs text-white/50 font-medium">Disponibilidade</span>
          <div className="my-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">
              {metrics.availabilityPercent}%
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-400 font-mono">
              <ArrowUpRight className="h-3.5 w-3.5" />
              0.02%
            </span>
          </div>
          <svg className="w-full h-8 text-emerald-400/60" viewBox="0 0 100 24" fill="none">
            <path d="M0 20 L20 18 L40 14 L60 16 L80 10 L100 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="flex justify-between text-[10px] text-white/30 font-mono mt-1">
            <span>12:00</span>
            <span>18:00</span>
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
          </div>
        </div>

        {/* 2. Sincronizações no Prazo */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
          <span className="text-xs text-white/50 font-medium">Sincronizações no prazo</span>
          <div className="my-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">
              {metrics.syncOnTimePercent}%
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-400 font-mono">
              <ArrowUpRight className="h-3.5 w-3.5" />
              0.05%
            </span>
          </div>
          <svg className="w-full h-8 text-cyan-400/60" viewBox="0 0 100 24" fill="none">
            <path d="M0 12 L20 10 L40 16 L60 8 L80 12 L100 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="flex justify-between text-[10px] text-white/30 font-mono mt-1">
            <span>12:00</span>
            <span>18:00</span>
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
          </div>
        </div>

        {/* 3. Taxa de Sucesso */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
          <span className="text-xs text-white/50 font-medium">Taxa de sucesso</span>
          <div className="my-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">
              {metrics.successRatePercent}%
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-emerald-400 font-mono">
              <ArrowUpRight className="h-3.5 w-3.5" />
              0.01%
            </span>
          </div>
          <svg className="w-full h-8 text-purple-400/60" viewBox="0 0 100 24" fill="none">
            <path d="M0 16 L20 14 L40 10 L60 8 L80 12 L100 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="flex justify-between text-[10px] text-white/30 font-mono mt-1">
            <span>12:00</span>
            <span>18:00</span>
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
          </div>
        </div>

        {/* 4. p95 Latência API */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
          <span className="text-xs text-white/50 font-medium">p95 API</span>
          <div className="my-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-white font-mono">
              {metrics.p95LatencyMs} ms
            </span>
            <span className="inline-flex items-center text-xs font-semibold text-amber-400 font-mono">
              <ArrowDownRight className="h-3.5 w-3.5" />
              12ms
            </span>
          </div>
          <svg className="w-full h-8 text-amber-400/60" viewBox="0 0 100 24" fill="none">
            <path d="M0 10 L20 16 L40 12 L60 20 L80 8 L100 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="flex justify-between text-[10px] text-white/30 font-mono mt-1">
            <span>12:00</span>
            <span>18:00</span>
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
          </div>
        </div>
      </div>
    </div>
  );
}

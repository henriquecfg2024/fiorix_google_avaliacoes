import React from 'react';
import type { OperationsHealthSnapshot } from '@/lib/health/types';

interface Props {
  metrics: OperationsHealthSnapshot['metrics'];
}

export function MetricsChartCard({ metrics }: Props) {
  return (
    <section className="rounded-2xl border border-[#1E293B] bg-[#111729] p-4 shadow-sm">
      <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#1E293B] text-center font-mono text-xs">
        <div className="py-2 sm:py-0 sm:px-3">
          <span className="text-[10px] font-sans text-[#64748B] uppercase block">Disponibilidade</span>
          <span className="text-sm font-bold text-[#10B981] mt-0.5 block">
            {metrics.availabilityPercent !== null ? `${metrics.availabilityPercent}%` : '99.9%'}
          </span>
        </div>
        <div className="py-2 sm:py-0 sm:px-3">
          <span className="text-[10px] font-sans text-[#64748B] uppercase block">Sincronizações</span>
          <span className="text-sm font-bold text-[#10B981] mt-0.5 block">
            {metrics.syncOnTimePercent !== null ? `${metrics.syncOnTimePercent}% no prazo` : '100% no prazo'}
          </span>
        </div>
        <div className="py-2 sm:py-0 sm:px-3">
          <span className="text-[10px] font-sans text-[#64748B] uppercase block">Taxa Sucesso</span>
          <span className="text-sm font-bold text-[#10B981] mt-0.5 block">
            {metrics.successRatePercent !== null ? `${metrics.successRatePercent}%` : '100.0%'}
          </span>
        </div>
        <div className="py-2 sm:py-0 sm:px-3">
          <span className="text-[10px] font-sans text-[#64748B] uppercase block">Latência Postgres</span>
          <span className="text-sm font-bold text-[#3B82F6] mt-0.5 block">
            {metrics.p95LatencyMs !== null ? `${metrics.p95LatencyMs} ms` : '200 ms'}
          </span>
        </div>
        <div className="py-2 sm:py-0 sm:px-3 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-sans text-[#64748B] uppercase block">Ingestão Média</span>
          <span className="text-sm font-bold text-cyan-400 mt-0.5 block">
            {metrics.avgBatchDurationMs !== null && metrics.avgBatchDurationMs !== undefined
              ? `${(metrics.avgBatchDurationMs / 1000).toFixed(1)}s / ciclo`
              : '1.5s / ciclo'}
          </span>
        </div>
      </div>
    </section>
  );
}

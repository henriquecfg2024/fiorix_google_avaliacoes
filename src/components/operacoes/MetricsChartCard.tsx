import React from 'react';
import { TrendingUp, Activity, HelpCircle } from 'lucide-react';
import { OperationsHealthSnapshot } from '@/lib/health/operations-service';

interface Props {
  metrics: OperationsHealthSnapshot['metrics'];
}

export function MetricsChartCard({ metrics }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold text-white tracking-wide">
          Métricas Agregadas da Plataforma
        </h3>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/[0.04] text-white/50 border border-white/6">
          {metrics.provenance}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Disponibilidade */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
          <span className="text-xs text-white/50 font-medium">Disponibilidade</span>
          <div className="my-2">
            <span className="text-sm font-semibold text-white/40 font-sans">
              {metrics.availabilityPercent !== null ? `${metrics.availabilityPercent}%` : 'Aguardando integração'}
            </span>
          </div>
          <span className="text-[10px] text-white/30 font-sans">SLA de 30 dias</span>
        </div>

        {/* 2. Sincronizações no Prazo */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
          <span className="text-xs text-white/50 font-medium">Sincronizações no prazo</span>
          <div className="my-2">
            <span className="text-sm font-semibold text-white/40 font-sans">
              {metrics.syncOnTimePercent !== null ? `${metrics.syncOnTimePercent}%` : 'Aguardando integração'}
            </span>
          </div>
          <span className="text-[10px] text-white/30 font-sans">Amostragem histórica</span>
        </div>

        {/* 3. Taxa de Sucesso */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
          <span className="text-xs text-white/50 font-medium">Taxa de sucesso</span>
          <div className="my-2">
            <span className="text-sm font-semibold text-white/40 font-sans">
              {metrics.successRatePercent !== null ? `${metrics.successRatePercent}%` : 'Aguardando integração'}
            </span>
          </div>
          <span className="text-[10px] text-white/30 font-sans">Rotinas executadas</span>
        </div>

        {/* 4. p95 Latência API */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
          <span className="text-xs text-white/50 font-medium">p95 Latência API</span>
          <div className="my-2">
            <span className="text-sm font-semibold text-white/40 font-sans">
              {metrics.p95LatencyMs !== null ? `${metrics.p95LatencyMs} ms` : 'Aguardando integração'}
            </span>
          </div>
          <span className="text-[10px] text-white/30 font-sans">Percentil 95</span>
        </div>
      </div>
    </div>
  );
}

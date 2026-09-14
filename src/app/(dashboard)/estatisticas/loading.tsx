import React from 'react';

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] ${className}`} />;
}

export default function EstatisticasLoading() {
  return (
    <div className="min-h-screen bg-[#070A12] p-4 lg:p-8 space-y-6">
      {/* Breadcrumb + Title */}
      <div className="space-y-2">
        <Pulse className="h-3 w-48 rounded-lg" />
        <Pulse className="h-7 w-72 rounded-xl" />
      </div>

      {/* Card 1: Distribuição de Notas */}
      <Pulse className="h-[320px] rounded-[28px]" />

      {/* Card 2: Análise Qualitativa */}
      <Pulse className="h-[280px] rounded-[28px]" />

      {/* Card 3: Saúde da Reputação */}
      <Pulse className="h-[100px] rounded-[28px]" />

      {/* Indicadores Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Pulse className="h-[72px] rounded-2xl" />
        <Pulse className="h-[72px] rounded-2xl" />
        <Pulse className="h-[72px] rounded-2xl" />
        <Pulse className="h-[72px] rounded-2xl" />
      </div>

      {/* Metodologia */}
      <Pulse className="h-[200px] rounded-[28px]" />
    </div>
  );
}

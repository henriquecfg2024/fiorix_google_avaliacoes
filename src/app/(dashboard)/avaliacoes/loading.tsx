import React from 'react';

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] ${className}`} />;
}

export default function AvaliacoesLoading() {
  return (
    <div className="min-h-screen bg-[#070A12] p-4 lg:p-8 space-y-6">
      {/* Breadcrumb + Title */}
      <div className="space-y-2">
        <Pulse className="h-3 w-36 rounded-lg" />
        <Pulse className="h-7 w-56 rounded-xl" />
      </div>

      {/* Filters bar */}
      <div className="flex gap-3">
        <Pulse className="h-10 w-64 rounded-xl" />
        <Pulse className="h-10 w-32 rounded-xl" />
        <Pulse className="h-10 w-32 rounded-xl" />
      </div>

      {/* Review cards */}
      <div className="space-y-3">
        <Pulse className="h-[140px] rounded-[28px]" />
        <Pulse className="h-[140px] rounded-[28px]" />
        <Pulse className="h-[140px] rounded-[28px]" />
        <Pulse className="h-[140px] rounded-[28px]" />
        <Pulse className="h-[140px] rounded-[28px]" />
      </div>
    </div>
  );
}

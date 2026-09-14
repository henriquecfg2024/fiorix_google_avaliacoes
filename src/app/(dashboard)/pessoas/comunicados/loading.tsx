import React from 'react';

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] ${className}`} />;
}

export default function ComunicadosLoading() {
  return (
    <div className="min-h-screen bg-[#070A12] p-4 lg:p-8 space-y-6">
      {/* Breadcrumb + Title */}
      <div className="space-y-2">
        <Pulse className="h-3 w-40 rounded-lg" />
        <Pulse className="h-7 w-52 rounded-xl" />
      </div>

      {/* Communication cards */}
      <div className="space-y-3">
        <Pulse className="h-[120px] rounded-[28px]" />
        <Pulse className="h-[120px] rounded-[28px]" />
        <Pulse className="h-[120px] rounded-[28px]" />
      </div>
    </div>
  );
}

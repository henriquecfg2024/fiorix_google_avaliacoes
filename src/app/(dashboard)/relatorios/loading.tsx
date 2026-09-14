import React from 'react';

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] ${className}`} />;
}

export default function RelatoriosLoading() {
  return (
    <div className="min-h-screen bg-[#070A12] p-4 lg:p-8 space-y-6">
      {/* Breadcrumb + Title */}
      <div className="space-y-2">
        <Pulse className="h-3 w-36 rounded-lg" />
        <Pulse className="h-7 w-48 rounded-xl" />
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Pulse className="h-[180px] rounded-[28px]" />
        <Pulse className="h-[180px] rounded-[28px]" />
        <Pulse className="h-[180px] rounded-[28px]" />
      </div>
    </div>
  );
}

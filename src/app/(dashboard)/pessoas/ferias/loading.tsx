import React from 'react';

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200 dark:bg-white/[0.04] ${className}`} />;
}

export default function FeriasLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A12] p-4 lg:p-8 space-y-6">
      {/* Breadcrumb + Title */}
      <div className="space-y-2">
        <Pulse className="h-3 w-32 rounded-lg" />
        <Pulse className="h-7 w-44 rounded-xl" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Pulse className="h-[100px] rounded-[28px]" />
        <Pulse className="h-[100px] rounded-[28px]" />
        <Pulse className="h-[100px] rounded-[28px]" />
        <Pulse className="h-[100px] rounded-[28px]" />
      </div>

      {/* Calendar / Table */}
      <Pulse className="h-[300px] rounded-[28px]" />
    </div>
  );
}

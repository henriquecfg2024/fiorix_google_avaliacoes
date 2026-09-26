import React from 'react';

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200 dark:bg-white/[0.04] ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A12] p-4 lg:p-8 space-y-6">
      {/* Breadcrumb + Title */}
      <div className="space-y-2">
        <Pulse className="h-3 w-40 rounded-lg" />
        <Pulse className="h-7 w-64 rounded-xl" />
      </div>

      {/* Saúde da Reputação card */}
      <Pulse className="h-[340px] rounded-[28px]" />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Pulse className="h-[120px] rounded-[28px]" />
        <Pulse className="h-[120px] rounded-[28px]" />
        <Pulse className="h-[120px] rounded-[28px]" />
        <Pulse className="h-[120px] rounded-[28px]" />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Pulse className="h-[300px] rounded-[28px]" />
        <Pulse className="h-[300px] rounded-[28px]" />
      </div>
    </div>
  );
}

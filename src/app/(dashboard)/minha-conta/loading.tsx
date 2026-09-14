import React from 'react';

function Pulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] ${className}`} />;
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#070A12] p-4 lg:p-8 space-y-6">
      <div className="space-y-2">
        <Pulse className="h-3 w-40 rounded-lg" />
        <Pulse className="h-7 w-56 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Pulse className="h-[100px] rounded-[28px]" />
        <Pulse className="h-[100px] rounded-[28px]" />
        <Pulse className="h-[100px] rounded-[28px]" />
        <Pulse className="h-[100px] rounded-[28px]" />
      </div>
      <Pulse className="h-[400px] rounded-[28px]" />
    </div>
  );
}

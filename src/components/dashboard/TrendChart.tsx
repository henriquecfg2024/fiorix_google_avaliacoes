'use client';

import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type TrendTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string | number;
};

type TrendDataPoint = { month: string; nota: number; volume: number };

interface TrendChartProps {
  data?: TrendDataPoint[];
}

const defaultData: TrendDataPoint[] = [
  { month: 'Jan', nota: 4.2, volume: 120 },
  { month: 'Fev', nota: 4.3, volume: 150 },
  { month: 'Mar', nota: 4.1, volume: 95 },
  { month: 'Abr', nota: 4.5, volume: 180 },
  { month: 'Mai', nota: 4.4, volume: 160 },
  { month: 'Jun', nota: 4.7, volume: 190 },
];

export function TrendChart({ data }: TrendChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentData = data ?? defaultData;

  const CustomTooltip = ({ active, payload, label }: TrendTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="space-y-1 rounded-xl border border-white/10 bg-[#0B1020]/95 p-3 text-xs text-white shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <p className="border-b border-white/10 pb-1 font-bold text-slate-200">{label}</p>
          <div className="flex items-center justify-between gap-4 font-semibold text-cyan-300">
            <span>⭐ Nota Média:</span>
            <span>{payload[0]?.value}</span>
          </div>
          <div className="flex items-center justify-between gap-4 font-semibold text-amber-300">
            <span>📊 Volume:</span>
            <span>{payload[1]?.value} avaliações</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all">
      <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/8 pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-card-title font-bold text-white">Tendência de Avaliações</h3>
          <p className="mt-0.5 text-xs text-slate-400">Evolução da nota média e volume acumulado</p>
        </div>

        <div className="inline-flex self-start gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-cyan-200 sm:self-auto">
          Últimos 6 meses
        </div>
      </div>

      <div className="h-[220px] w-full min-w-0" style={{ minWidth: 0 }}>
        {isMounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
              <linearGradient id="colorNota" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.34} />
                <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" opacity={0.8} />

            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11.5, fontWeight: 500 }} />

            <YAxis
              yAxisId="left"
              domain={[3.0, 5.0]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 11.5 }}
              tickFormatter={(v) => v.toFixed(1)}
            />

            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11.5 }} />

            <Tooltip content={<CustomTooltip />} />

            <Area yAxisId="left" type="monotone" dataKey="nota" name="Nota Média" stroke="#22D3EE" strokeWidth={3} fillOpacity={1} fill="url(#colorNota)" />

            <Area
              yAxisId="right"
              type="monotone"
              dataKey="volume"
              name="Volume"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#colorVolume)"
            />
          </AreaChart>
        </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin opacity-50" />
          </div>
        )}
      </div>
    </div>
  );
}

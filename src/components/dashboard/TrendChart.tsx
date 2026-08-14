'use client';

import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function TrendChart() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1a'>('30d');

  const dataMap = {
    '7d': [
      { month: 'Seg', nota: 4.5, volume: 22 },
      { month: 'Ter', nota: 4.6, volume: 28 },
      { month: 'Qua', nota: 4.4, volume: 19 },
      { month: 'Qui', nota: 4.7, volume: 35 },
      { month: 'Sex', nota: 4.5, volume: 30 },
      { month: 'Sáb', nota: 4.8, volume: 15 },
      { month: 'Dom', nota: 4.6, volume: 12 },
    ],
    '30d': [
      { month: 'Jan', nota: 4.2, volume: 120 },
      { month: 'Fev', nota: 4.3, volume: 150 },
      { month: 'Mar', nota: 4.1, volume: 95 },
      { month: 'Abr', nota: 4.5, volume: 180 },
      { month: 'Mai', nota: 4.4, volume: 160 },
      { month: 'Jun', nota: 4.7, volume: 190 },
    ],
    '90d': [
      { month: 'Abril', nota: 4.3, volume: 420 },
      { month: 'Maio', nota: 4.5, volume: 490 },
      { month: 'Junho', nota: 4.7, volume: 540 },
    ],
    '1a': [
      { month: 'Q1', nota: 4.2, volume: 1200 },
      { month: 'Q2', nota: 4.4, volume: 1450 },
      { month: 'Q3', nota: 4.5, volume: 1600 },
      { month: 'Q4', nota: 4.7, volume: 1850 },
    ],
  };

  const currentData = dataMap[period];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="space-y-1 rounded-xl border border-slate-700 bg-slate-950/95 p-3 text-xs text-white shadow-xl backdrop-blur-sm">
          <p className="border-b border-slate-800 pb-1 font-bold text-slate-300">{label}</p>
          <div className="flex items-center justify-between gap-4 font-semibold text-blue-400">
            <span>⭐ Nota Média:</span>
            <span>{payload[0]?.value}</span>
          </div>
          <div className="flex items-center justify-between gap-4 font-semibold text-violet-400">
            <span>📊 Volume:</span>
            <span>{payload[1]?.value} avaliações</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-[0_12px_30px_rgba(2,6,23,0.22)] transition-all">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-white">Tendência de Avaliações</h3>
          <p className="mt-0.5 text-xs text-slate-400">Evolução da nota média e volume acumulado</p>
        </div>

        <div className="inline-flex self-start gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 text-xs font-semibold sm:self-auto">
          {(['7d', '30d', '90d', '1a'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPeriod(tab)}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                period === tab ? 'bg-blue-600 font-bold text-white shadow-sm' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNota" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.18)" opacity={0.8} />

            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 500 }} />

            <YAxis
              yAxisId="left"
              domain={[3.0, 5.0]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              tickFormatter={(v) => v.toFixed(1)}
            />

            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />

            <Tooltip content={<CustomTooltip />} />

            <Area yAxisId="left" type="monotone" dataKey="nota" name="Nota Média" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorNota)" />

            <Area
              yAxisId="right"
              type="monotone"
              dataKey="volume"
              name="Volume"
              stroke="#8B5CF6"
              strokeWidth={2}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#colorVolume)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

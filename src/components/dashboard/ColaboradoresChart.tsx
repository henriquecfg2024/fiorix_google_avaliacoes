'use client';

import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export interface ColaboradorRankData {
  nome: string;
  elogios: number;
}

type ColaboradorTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: ColaboradorRankData }>;
};

interface ColaboradoresChartProps {
  monthData?: ColaboradorRankData[];
  quarterData?: ColaboradorRankData[];
  totalData?: ColaboradorRankData[];
}

export function ColaboradoresChart({ monthData, quarterData, totalData }: ColaboradoresChartProps) {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'total'>('month');

  const defaultMonth: ColaboradorRankData[] = [
    { nome: 'Lucas', elogios: 8 },
    { nome: 'Ana', elogios: 6 },
    { nome: 'Jonatan', elogios: 4 },
    { nome: 'Anne', elogios: 3 },
    { nome: 'Ricardo Marçal', elogios: 3 },
  ];

  const defaultQuarter: ColaboradorRankData[] = [
    { nome: 'Ricardo Marçal', elogios: 34 },
    { nome: 'Ana', elogios: 12 },
    { nome: 'Lucas', elogios: 10 },
    { nome: 'Jonatan', elogios: 5 },
    { nome: 'Anne', elogios: 4 },
  ];

  const defaultTotal: ColaboradorRankData[] = [
    { nome: 'Ricardo Marçal', elogios: 77 },
    { nome: 'Ana', elogios: 19 },
    { nome: 'Jonatan', elogios: 5 },
    { nome: 'Anne', elogios: 4 },
    { nome: 'Lucas', elogios: 4 },
  ];

  let rawList: ColaboradorRankData[] = [];
  if (period === 'month') {
    rawList = monthData && monthData.length > 0 && monthData.some((d) => d.elogios > 0) ? monthData : defaultMonth;
  } else if (period === 'quarter') {
    rawList = quarterData && quarterData.length > 0 && quarterData.some((d) => d.elogios > 0) ? quarterData : defaultQuarter;
  } else {
    rawList = totalData && totalData.length > 0 && totalData.some((d) => d.elogios > 0) ? totalData : defaultTotal;
  }

  const deduplicatedMap = new Map<string, number>();
  rawList.forEach((item) => {
    const norm = item.nome.trim();
    const existing = deduplicatedMap.get(norm) || 0;
    deduplicatedMap.set(norm, Math.max(existing, item.elogios));
  });

  const currentList: ColaboradorRankData[] = Array.from(deduplicatedMap.entries())
    .map(([nome, elogios]) => ({ nome, elogios }))
    .sort((a, b) => b.elogios - a.elogios)
    .slice(0, 5);

  const chartData = [...currentList].reverse();

  const CustomTooltip = ({ active, payload }: ColaboradorTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl border border-white/10 bg-[#0B1020]/95 p-2.5 text-xs text-white shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <p className="font-bold text-slate-200">{data.nome}</p>
          <p className="mt-0.5 font-semibold text-emerald-300">👏 {data.elogios} elogios registrados</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-white">Ranking dos Colaboradores</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {period === 'month'
              ? 'Menções positivas no mês atual'
              : period === 'quarter'
                ? 'Menções nos últimos 90 dias'
                : 'Todo o período acumulado'}
          </p>
        </div>

        <div className="inline-flex self-start gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 text-xs font-semibold sm:self-auto">
          <button
            onClick={() => setPeriod('month')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              period === 'month' ? 'bg-cyan-500/15 font-bold text-cyan-200 shadow-sm' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            Este mês
          </button>
          <button
            onClick={() => setPeriod('quarter')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              period === 'quarter' ? 'bg-cyan-500/15 font-bold text-cyan-200 shadow-sm' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            Trimestre
          </button>
          <button
            onClick={() => setPeriod('total')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              period === 'total' ? 'bg-cyan-500/15 font-bold text-cyan-200 shadow-sm' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            Geral
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {currentList.map((col, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
          const isTop = idx === 0;

          return (
            <div
              key={idx}
              className={`flex flex-col items-center justify-center rounded-xl border p-2.5 text-center transition-all ${
                isTop ? 'border-cyan-500/20 bg-cyan-500/[0.06] shadow-sm' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
              }`}
            >
              <span className="text-[10px] font-bold uppercase text-slate-400">{medal} Rank</span>
              <span className="mt-0.5 max-w-full truncate text-xs font-bold text-white">{col.nome}</span>
              <span className="mt-1 text-xs font-extrabold text-emerald-300">{col.elogios} 👏</span>
            </div>
          );
        })}
      </div>

      <div className="h-[220px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={chartData} margin={{ top: 0, right: 20, left: 10, bottom: 0 }} barCategoryGap={12}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nome"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#CBD5E1', fontSize: 12, fontWeight: 600 }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            <Bar dataKey="elogios" radius={[0, 8, 8, 0]} barSize={20}>
              {chartData.map((entry, index) => {
                const isTop1 = entry.nome === currentList[0]?.nome;
                return <Cell key={`cell-${index}`} fill={isTop1 ? '#22D3EE' : '#0EA5E9'} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

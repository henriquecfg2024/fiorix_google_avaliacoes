'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';

export interface ColaboradorRankData {
  nome: string;
  elogios: number;
}

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

  let currentList: ColaboradorRankData[] = [];
  if (period === 'month') {
    currentList = monthData && monthData.length > 0 && monthData.some((d) => d.elogios > 0) ? monthData : defaultMonth;
  } else if (period === 'quarter') {
    currentList = quarterData && quarterData.length > 0 && quarterData.some((d) => d.elogios > 0) ? quarterData : defaultQuarter;
  } else {
    currentList = totalData && totalData.length > 0 && totalData.some((d) => d.elogios > 0) ? totalData : defaultTotal;
  }

  // Reverse list so top rank displays at top in vertical layout
  const chartData = [...currentList].reverse();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 border border-slate-800 text-white rounded-xl shadow-xl p-2.5 text-xs backdrop-blur-sm">
          <p className="font-bold text-slate-200">{data.nome}</p>
          <p className="text-emerald-400 font-semibold mt-0.5">👏 {data.elogios} elogios registrados</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all space-y-4">
      {/* HEADER WITH TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Ranking dos Colaboradores</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {period === 'month'
              ? 'Menções positivas no mês atual'
              : period === 'quarter'
              ? 'Menções nos últimos 90 dias'
              : 'Todo o período acumulado'}
          </p>
        </div>

        {/* TABS */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === 'month'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Este mês
          </button>
          <button
            onClick={() => setPeriod('quarter')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === 'quarter'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Trimestre
          </button>
          <button
            onClick={() => setPeriod('total')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              period === 'total'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Geral
          </button>
        </div>
      </div>

      {/* MINI LEADERBOARD PILLS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {currentList.map((col, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
          const isTop = idx === 0;

          return (
            <div
              key={idx}
              className={`rounded-xl p-2.5 flex flex-col items-center justify-center text-center transition-all border ${
                isTop
                  ? 'bg-blue-50/80 border-blue-200 shadow-sm'
                  : 'bg-slate-50 border-slate-100 hover:bg-slate-100/80'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-500 uppercase">{medal} Rank</span>
              <span className="text-xs font-bold text-slate-900 truncate max-w-full mt-0.5">
                {col.nome}
              </span>
              <span className="text-xs font-extrabold text-emerald-600 mt-1">
                {col.elogios} 👏
              </span>
            </div>
          );
        })}
      </div>

      {/* RECHARTS HORIZONTAL BARCHART (FLAT - NO 3D) */}
      <div className="w-full h-[220px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            barCategoryGap={12}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nome"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241,245,249,0.6)' }} />
            <Bar dataKey="elogios" radius={[0, 8, 8, 0]} barSize={20}>
              {chartData.map((entry, index) => {
                const isTop1 = entry.nome === currentList[0]?.nome;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isTop1 ? '#1E40AF' : '#3B82F6'}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


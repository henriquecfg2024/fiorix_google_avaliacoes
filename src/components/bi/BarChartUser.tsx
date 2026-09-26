"use client";

import { useMemo } from "react";
import { useChartTheme } from '@/hooks/useChartTheme';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface BarChartUserProps {
  data: Array<{
    NOME?: string;
    QUANTIDADE?: number;
  }>;
}

type TooltipPoint = {
  name?: string;
  value?: number;
};

export function BarChartUser({ data }: BarChartUserProps) {
  const ct = useChartTheme();
  const chartData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    data.forEach((row) => {
      const rawUser = row.NOME ? String(row.NOME).trim() : "";
      const user = rawUser || "Outro";
      counts[user] = (counts[user] || 0) + (row.QUANTIDADE || 1);
    });

    return Object.keys(counts)
      .map((name) => ({
        name,
        count: counts[name],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [data]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPoint[] }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1020]/90 p-3 text-xs text-slate-900 dark:text-white shadow-xl">
          <p className="font-semibold text-slate-700 dark:text-white/80">{item.name}</p>
          <p className="mt-1 font-bold text-cyan-600 dark:text-cyan-300">{(item.value ?? 0).toLocaleString("pt-BR")} autenticações</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-[350px] min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl">
      <div>
        <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Ranking por Usuário</h3>
        <p className="text-xs text-slate-500 dark:text-white/40">Colaboradores com maior volume de processamento</p>
      </div>

      <div className="mt-4 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.gridStroke} vertical={false} />
            <XAxis
              dataKey="name"
              stroke={ct.axisStroke}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => (val.length > 12 ? `${val.substring(0, 10)}...` : val)}
            />
            <YAxis stroke={ct.axisStroke} fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: ct.tooltipCursor }} />
            <defs>
              <linearGradient id="userBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#14B8A6" />
              </linearGradient>
            </defs>
            <Bar dataKey="count" fill="#38BDF8" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? "url(#userBarGrad)" : "#38BDF8"} opacity={1 - index * 0.08} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

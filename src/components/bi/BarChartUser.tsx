"use client";

import { useMemo } from "react";
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
  const chartData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    data.forEach((row) => {
      const user = row.NOME || "Outro";
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
        <div className="rounded-xl border border-white/10 bg-[#0B1020]/95 p-3 text-xs text-white shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="font-semibold text-white/80">{item.name}</p>
          <p className="mt-1 font-bold text-cyan-300">{item.value.toLocaleString("pt-BR")} autenticações</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-[350px] min-h-0 min-w-0 flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div>
        <h3 className="text-base font-bold tracking-tight text-white">Ranking por Usuário</h3>
        <p className="text-xs text-white/40">Colaboradores com maior volume de processamento</p>
      </div>

      <div className="mt-4 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="rgba(255,255,255,0.38)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => (val.length > 12 ? `${val.substring(0, 10)}...` : val)}
            />
            <YAxis stroke="rgba(255,255,255,0.38)" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
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

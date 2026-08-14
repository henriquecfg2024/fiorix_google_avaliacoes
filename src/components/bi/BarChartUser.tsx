"use client";

import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface BarChartUserProps {
  data: any[];
}

export function BarChartUser({ data }: BarChartUserProps) {
  const chartData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    data.forEach((row) => {
      const user = row.NOME || "Outro";
      counts[user] = (counts[user] || 0) + (row.QUANTIDADE || 1);
    });

    // Convert to array and sort by value descending
    return Object.keys(counts)
      .map((name) => ({
        name,
        count: counts[name],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // top 8 users
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="bg-[#0F172A] border border-white/10 p-3 rounded-lg shadow-xl text-xs text-white">
          <p className="font-semibold text-white/80">{item.name}</p>
          <p className="text-[#00C950] font-bold mt-1">
            {item.value.toLocaleString("pt-BR")} autenticações
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col h-[350px] min-h-0">
      {/* Title */}
      <div>
        <h3 className="text-base font-bold tracking-tight text-white">Ranking por Usuário</h3>
        <p className="text-xs text-white/40">Colaboradores com maior volume de processamento</p>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="rgba(255,255,255,0.4)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => (val.length > 12 ? `${val.substring(0, 10)}...` : val)}
            />
            <YAxis
              stroke="rgba(255,255,255,0.4)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
            <Bar dataKey="count" fill="#00C950" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === 0 ? "url(#neonGreenGrad)" : "#00C950"}
                  opacity={1 - index * 0.08}
                />
              ))}
            </Bar>
            {/* Gradient definition */}
            <defs>
              <linearGradient id="neonGreenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00C950" />
                <stop offset="100%" stopColor="#006428" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

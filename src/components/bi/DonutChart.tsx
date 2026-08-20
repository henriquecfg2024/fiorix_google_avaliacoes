"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface DonutChartProps {
  data: Array<{
    TIPO_DETALHADO?: string;
    QUANTIDADE?: number;
  }>;
}

type TooltipPoint = {
  payload?: {
    tipo?: string;
    total?: number;
  };
};

export function DonutChart({ data }: DonutChartProps) {
  const chartData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    data.forEach((row) => {
      const label = row.TIPO_DETALHADO || "Outros";
      counts[label] = (counts[label] || 0) + (row.QUANTIDADE || 0);
    });

    const sorted = Object.keys(counts)
      .map((tipo) => ({ tipo, total: counts[tipo] }))
      .sort((a, b) => b.total - a.total);

    const topItems = sorted.slice(0, 7);
    const otherTotal = sorted.slice(7).reduce((sum, item) => sum + item.total, 0);

    return [...topItems, ...(otherTotal > 0 ? [{ tipo: "Outros", total: otherTotal }] : [])];
  }, [data]);

  const totalSum = useMemo(() => chartData.reduce((acc, curr) => acc + curr.total, 0), [chartData]);

  const COLORS = ["#38BDF8", "#14B8A6", "#F59E0B", "#A78BFA", "#FB7185", "#60A5FA", "#34D399", "#F97316"];

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPoint[] }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct = totalSum > 0 ? ((item.total / totalSum) * 100).toFixed(1) : "0";
      return (
        <div className="rounded-xl border border-white/10 bg-[#0B1020]/95 p-3 text-xs text-white shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="font-semibold text-white/80">{item.tipo}</p>
          <p className="mt-1 font-bold text-white">
            {item.total.toLocaleString("pt-BR")} ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: { payload?: Array<{ color?: string; value?: string }> }) => {
    const { payload } = props;
    return (
      <ul className="mt-2 flex max-h-[72px] flex-wrap justify-center gap-x-4 gap-y-2 overflow-y-auto px-1 text-xs text-white/60">
        {payload?.map((entry, index: number) => {
          const itemVal = chartData.find((d) => d.tipo === entry.value)?.total || 0;
          const itemPct = totalSum > 0 ? ((itemVal / totalSum) * 100).toFixed(1) : "0";
          return (
            <li key={`item-${index}`} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-white/80">{entry.value}</span>
              <span className="text-white/40">({itemPct}%)</span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="flex h-full min-h-[350px] min-w-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div>
        <h3 className="text-base font-bold tracking-tight text-white">Distribuição por Tipo de Pedido</h3>
        <p className="text-xs text-white/40">Proporção dos serviços executados</p>
      </div>

      <div className="relative mt-2 h-[250px] min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius="65%"
              paddingAngle={3}
              dataKey="total"
              nameKey="tipo"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" align="center" content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Total</span>
          <span className="mt-0.5 text-lg font-bold text-white">
            {totalSum > 1000 ? `${(totalSum / 1000).toFixed(1)}k` : totalSum}
          </span>
        </div>
      </div>
    </div>
  );
}

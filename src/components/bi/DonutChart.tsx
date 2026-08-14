"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface DonutChartProps {
  data: any[];
}

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

    return [
      ...topItems,
      ...(otherTotal > 0 ? [{ tipo: "Outros", total: otherTotal }] : []),
    ];
  }, [data]);

  const totalSum = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.total, 0);
  }, [chartData]);

  const COLORS = ["#00C950", "#2B7FFF", "#F59E0B", "#8B5CF6"];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct = totalSum > 0 ? ((item.total / totalSum) * 100).toFixed(1) : "0";
      return (
        <div className="bg-[#0F172A] border border-white/10 p-3 rounded-lg shadow-xl text-xs text-white">
          <p className="font-semibold text-white/80">{item.tipo}</p>
          <p className="text-white font-bold mt-1">
            {item.total.toLocaleString("pt-BR")} ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <ul className="max-h-[72px] overflow-y-auto flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 px-1 text-xs text-white/60">
        {payload.map((entry: any, index: number) => {
          const itemVal = chartData.find(d => d.tipo === entry.value)?.total || 0;
          const itemPct = totalSum > 0 ? ((itemVal / totalSum) * 100).toFixed(1) : "0";
          return (
            <li key={`item-${index}`} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-white/80">{entry.value}</span>
              <span className="text-white/40">({itemPct}%)</span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col min-h-[350px] h-full">
      {/* Title */}
      <div>
        <h3 className="text-base font-bold tracking-tight text-white">Distribuição por Tipo de Pedido</h3>
        <p className="text-xs text-white/40">Proporção dos serviços executados</p>
      </div>

      {/* Chart */}
      <div className="relative flex-1 min-h-0 h-[250px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
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

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-white/40">Total</span>
          <span className="text-lg font-bold text-white mt-0.5">
            {totalSum > 1000 ? `${(totalSum / 1000).toFixed(1)}k` : totalSum}
          </span>
        </div>
      </div>
    </div>
  );
}

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
      const label = row.TIPO_PEDIDO || "Outros";
      counts[label] = (counts[label] || 0) + (row.QUANTIDADE || 0);
    });

    return Object.keys(counts).map((name) => ({
      name,
      value: counts[name],
    }));
  }, [data]);

  const total = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);

  const COLORS = ["#00C950", "#2B7FFF", "#F59E0B", "#8B5CF6"];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
      return (
        <div className="bg-[#0F172A] border border-white/10 p-3 rounded-lg shadow-xl text-xs text-white">
          <p className="font-semibold text-white/80">{item.name}</p>
          <p className="text-white font-bold mt-1">
            {item.value.toLocaleString("pt-BR")} ({pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 text-xs text-white/60">
        {payload.map((entry: any, index: number) => {
          const itemVal = chartData.find(d => d.name === entry.value)?.value || 0;
          const itemPct = total > 0 ? ((itemVal / total) * 100).toFixed(1) : "0";
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col h-[350px] justify-between">
      {/* Title */}
      <div>
        <h3 className="text-base font-bold tracking-tight text-white">Distribuição por Tipo de Pedido</h3>
        <p className="text-xs text-white/40">Proporção dos serviços executados</p>
      </div>

      {/* Chart */}
      <div className="relative flex-1 min-h-[180px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-[40px]">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-white/40">Total</span>
          <span className="text-lg font-bold text-white mt-0.5">
            {total > 1000 ? `${(total / 1000).toFixed(1)}k` : total}
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface AreaChartVolumeProps {
  data: Array<{
    HORA_NUM?: number;
    TIPO?: string;
    QUANTIDADE?: number;
  }>;
}

type TooltipPoint = {
  color?: string;
  name?: string;
  value?: number;
  payload?: {
    displayHour?: string;
  };
};

export function AreaChartVolume({ data }: AreaChartVolumeProps) {
  const chartData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      displayHour: `${String(i).padStart(2, "0")}:00`,
      TITULO: 0,
      CERTIDAO: 0,
    }));

    data.forEach((row) => {
      const hour = row.HORA_NUM;
      const tipo = row.TIPO;
      const count = row.QUANTIDADE || 0;

      if (hour >= 0 && hour < 24) {
        if (tipo === "TÍTULO") {
          hours[hour].TITULO += count;
        } else if (tipo === "CERTIDÃO") {
          hours[hour].CERTIDAO += count;
        }
      }
    });

    return hours;
  }, [data]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPoint[] }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-white/10 bg-[#0B1020]/95 p-3 text-xs text-white shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="font-semibold text-white/80">Faixa Horária: {payload[0].payload.displayHour}</p>
          {payload.map((p, idx: number) => (
            <p key={idx} className="font-bold" style={{ color: p.color }}>
              {p.name}: {p.value.toLocaleString("pt-BR")}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-[350px] min-h-0 min-w-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div>
        <h3 className="text-base font-bold tracking-tight text-white">Volume por Hora</h3>
        <p className="text-xs text-white/40">Comparação horária entre Títulos e Certidões</p>
      </div>

      <div className="mt-4 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTitulo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2DD4BF" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#2DD4BF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCertidao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#60A5FA" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="displayHour"
              stroke="rgba(255,255,255,0.38)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis stroke="rgba(255,255,255,0.38)" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              content={({ payload }: { payload?: Array<{ color?: string; value?: string }> }) => (
                <div className="flex justify-center gap-6 text-xs text-white/60">
                  {payload?.map((entry, index: number) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span>{entry.value === "TITULO" ? "Títulos" : "Certidões"}</span>
                    </div>
                  ))}
                </div>
              )}
            />
            <Area type="monotone" dataKey="TITULO" name="TITULO" stroke="#2DD4BF" strokeWidth={2} fillOpacity={1} fill="url(#colorTitulo)" />
            <Area
              type="monotone"
              dataKey="CERTIDAO"
              name="CERTIDAO"
              stroke="#60A5FA"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCertidao)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

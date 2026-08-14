"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface AreaChartVolumeProps {
  data: any[];
}

export function AreaChartVolume({ data }: AreaChartVolumeProps) {
  const chartData = useMemo(() => {
    // Initialize 24 hours
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      displayHour: `${String(i).padStart(2, "0")}:00`,
      TITULO: 0,
      CERTIDAO: 0,
    }));

    // Populate data
    data.forEach((row) => {
      const hour = row.HORA_NUM;
      const tipo = row.TIPO; // TÍTULO or CERTIDÃO
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0F172A] border border-white/10 p-3 rounded-lg shadow-xl text-xs text-white space-y-1">
          <p className="font-semibold text-white/80">Faixa Horária: {payload[0].payload.displayHour}</p>
          {payload.map((p: any, idx: number) => (
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col h-[350px] min-h-0">
      {/* Title */}
      <div>
        <h3 className="text-base font-bold tracking-tight text-white">Volume por Hora</h3>
        <p className="text-xs text-white/40">Comparação horária entre Títulos e Certidões</p>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTitulo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00C950" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#00C950" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCertidao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2B7FFF" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#2B7FFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="displayHour"
              stroke="rgba(255,255,255,0.4)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="rgba(255,255,255,0.4)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              content={({ payload }) => (
                <div className="flex justify-center gap-6 text-xs text-white/60">
                  {payload?.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span>{entry.value === "TITULO" ? "Títulos" : "Certidões"}</span>
                    </div>
                  ))}
                </div>
              )}
            />
            <Area
              type="monotone"
              dataKey="TITULO"
              name="TITULO"
              stroke="#00C950"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorTitulo)"
            />
            <Area
              type="monotone"
              dataKey="CERTIDAO"
              name="CERTIDAO"
              stroke="#2B7FFF"
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

"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";

interface HeatmapChartProps {
  data: any[];
}

export function HeatmapChart({ data }: HeatmapChartProps) {
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const daysOfWeekPt = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const heatmapData = useMemo(() => {
    // Initialize empty grid 7x24
    const grid: { [day: string]: { [hour: number]: number } } = {};
    daysOfWeek.forEach((day) => {
      grid[day] = {};
      hours.forEach((hour) => {
        grid[day][hour] = 0;
      });
    });

    // Populate grid
    data.forEach((row) => {
      const day = row.DIA_SEMANA;
      const hour = row.HORA_NUM;
      if (grid[day] !== undefined && grid[day][hour] !== undefined) {
        grid[day][hour] += row.QUANTIDADE || 0;
      }
    });

    // Find max value for scaling color intensity
    let maxVal = 0;
    daysOfWeek.forEach((day) => {
      hours.forEach((hour) => {
        if (grid[day][hour] > maxVal) {
          maxVal = grid[day][hour];
        }
      });
    });

    return { grid, maxVal: maxVal || 1 };
  }, [data]);

  const getColorIntensity = (value: number) => {
    if (value === 0) return "rgba(10, 15, 30, 0.6)"; // Deep navy base background
    const ratio = value / heatmapData.maxVal;
    // Blend from navy dark (#0A0F1E) to neon green (#00C950)
    // #00C950 is rgb(0, 201, 80)
    // #0A0F1E is rgb(10, 15, 30)
    const r = Math.round(10 + (0 - 10) * ratio);
    const g = Math.round(15 + (201 - 15) * ratio);
    const b = Math.round(30 + (80 - 30) * ratio);
    return `rgba(${r}, ${g}, ${b}, ${0.2 + 0.8 * ratio})`;
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            Distribuição por Dia e Hora (Heatmap 7x24)
          </h3>
          <p className="text-xs text-white/40">Visualização de produtividade por faixa horária de Segunda a Domingo</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded border border-amber-400/20">
          <Info className="h-3.5 w-3.5" />
          <span>Fila crítica: Segunda 7h</span>
        </div>
      </div>

      {/* Grid Heatmap */}
      <div className="overflow-x-auto select-none pt-2">
        <div className="min-w-[800px] space-y-1">
          {/* Hours Header */}
          <div className="flex items-center">
            <div className="w-20 text-xs text-white/40 font-medium pr-2 text-right">Dia</div>
            <div className="flex-1 grid grid-cols-24 gap-[2px]">
              {hours.map((hour) => (
                <div key={hour} className="text-center text-[10px] text-white/40 font-mono">
                  {String(hour).padStart(2, "0")}h
                </div>
              ))}
            </div>
          </div>

          {/* Heatmap Rows */}
          {daysOfWeek.map((day, dIdx) => (
            <div key={day} className="flex items-center">
              {/* Day Label */}
              <div className="w-20 text-xs text-white/60 font-semibold pr-2 text-right">
                {daysOfWeekPt[dIdx]}
              </div>

              {/* Day Hours Cells */}
              <div className="flex-1 grid grid-cols-24 gap-[2px]">
                {hours.map((hour) => {
                  const value = heatmapData.grid[day][hour];
                  const color = getColorIntensity(value);
                  const isMonday7h = day === "Monday" && hour === 7;

                  return (
                    <div
                      key={hour}
                      style={{ backgroundColor: color }}
                      className={`h-8 rounded-[3px] border border-white/[0.02] flex items-center justify-center transition-all group relative cursor-pointer ${
                        isMonday7h ? "animate-pulse shadow-[0_0_12px_#00C950] border-[#00C950]/50" : "hover:border-white/30"
                      }`}
                    >
                      {/* Monday 7h Dot Indicator */}
                      {isMonday7h && (
                        <span className="absolute h-2 w-2 rounded-full bg-[#00C950] shadow-[0_0_6px_#00C950]" />
                      )}

                      {/* Tooltip */}
                      <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-25 bg-[#0F172A] border border-white/10 px-3 py-1.5 rounded-lg shadow-xl text-center text-[11px] whitespace-nowrap">
                        <p className="font-semibold text-white">
                          {daysOfWeekPt[dIdx]}, {hour}h
                        </p>
                        <p className="text-[#00C950] font-bold mt-0.5">
                          {value.toLocaleString("pt-BR")} autenticações
                        </p>
                        {isMonday7h && (
                          <p className="text-xs text-red-400 font-bold mt-1 uppercase tracking-wider text-[9px]">
                            Indicador Crítico (Fila/Espera)
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-3 text-xs text-white/40 pt-2 border-t border-white/5">
        <span>Menos ativo</span>
        <div className="flex gap-[2px]">
          <div className="w-5 h-3 rounded-[2px]" style={{ backgroundColor: "rgba(10, 15, 30, 0.6)" }} />
          <div className="w-5 h-3 rounded-[2px]" style={{ backgroundColor: "rgba(0, 100, 40, 0.4)" }} />
          <div className="w-5 h-3 rounded-[2px]" style={{ backgroundColor: "rgba(0, 150, 60, 0.7)" }} />
          <div className="w-5 h-3 rounded-[2px]" style={{ backgroundColor: "rgba(0, 201, 80, 0.9)" }} />
        </div>
        <span>Mais ativo</span>
      </div>
    </div>
  );
}

"use client";

import { Component, useMemo, type ReactNode } from "react";
import { Info } from "lucide-react";

interface HeatmapChartProps {
  data: Array<{
    DIA_SEMANA?: string;
    HORA_NUM?: number | string;
    QUANTIDADE?: number;
  }>;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_OF_WEEK_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/* ── Error Boundary ────────────────────────────────────────────────── */
class HeatmapErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Erro desconhecido" };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[28px] border border-white/10 bg-[#0B1020]/72 p-6 text-center text-white/60">
          <p className="text-sm font-semibold text-rose-400">Erro ao renderizar Heatmap</p>
          <p className="mt-1 text-xs text-white/40">{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Inner Heatmap (pode lançar erros que o boundary captura) ────── */
function HeatmapChartInner({ data }: HeatmapChartProps) {
  const normalizeDay = (d: string | undefined | null): string => {
    if (!d) return "Sunday";
    const lower = String(d).toLowerCase();
    if (lower.includes("domingo") || lower === "sunday" || lower === "0") return "Sunday";
    if (lower.includes("segunda") || lower === "monday" || lower === "1") return "Monday";
    if (lower.includes("terça") || lower.includes("terca") || lower === "tuesday" || lower === "2") return "Tuesday";
    if (lower.includes("quarta") || lower === "wednesday" || lower === "3") return "Wednesday";
    if (lower.includes("quinta") || lower === "thursday" || lower === "4") return "Thursday";
    if (lower.includes("sexta") || lower === "friday" || lower === "5") return "Friday";
    if (lower.includes("sábado") || lower.includes("sabado") || lower === "saturday" || lower === "6") return "Saturday";
    return "Sunday";
  };

  const heatmapData = useMemo(() => {
    const grid: { [day: string]: { [hour: number]: number } } = {};
    DAYS_OF_WEEK.forEach((day) => {
      grid[day] = {};
      HOURS.forEach((hour) => {
        grid[day][hour] = 0;
      });
    });

    (data ?? []).forEach((row) => {
      if (!row) return;
      const day = normalizeDay(row.DIA_SEMANA);
      const hour = Number(row.HORA_NUM);
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
      const quantity = Number(row.QUANTIDADE ?? 1);
      if (grid[day] !== undefined && grid[day][hour] !== undefined) {
        grid[day][hour] += Number.isFinite(quantity) ? quantity : 1;
      }
    });

    let maxVal = 0;
    DAYS_OF_WEEK.forEach((day) => {
      HOURS.forEach((hour) => {
        if (grid[day][hour] > maxVal) {
          maxVal = grid[day][hour];
        }
      });
    });

    return { grid, maxVal: maxVal || 1 };
  }, [data]);

  const getColorIntensity = (value: number) => {
    if (!value || value === 0) return "rgba(11, 16, 32, 0.85)";
    const ratio = value / heatmapData.maxVal;
    const r = Math.round(11 + (45 - 11) * ratio);
    const g = Math.round(16 + (212 - 16) * ratio);
    const b = Math.round(32 + (191 - 32) * ratio);
    return `rgba(${r}, ${g}, ${b}, ${0.18 + 0.82 * ratio})`;
  };

  return (
    <div className="space-y-6 rounded-[28px] border border-white/10 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold tracking-tight text-white">
            Distribuição por Dia e Hora (Heatmap 7x24)
          </h3>
          <p className="text-xs text-white/40">Visualização de produtividade por faixa horária de Domingo a Sábado</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
          <Info className="h-3.5 w-3.5" />
          <span>Fila crítica: Segunda 7h</span>
        </div>
      </div>

      <div className="select-none overflow-x-auto pt-2">
        <div className="min-w-[800px] space-y-1">
          <div className="flex items-center">
            <div className="w-20 pr-2 text-right text-xs font-medium text-white/40">Dia</div>
            <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
              {HOURS.map((hour) => (
                <div key={hour} className="text-center font-mono text-[10px] text-white/40">
                  {String(hour).padStart(2, "0")}h
                </div>
              ))}
            </div>
          </div>

          {DAYS_OF_WEEK.map((day, dIdx) => (
            <div key={day} className="flex items-center">
              <div className="w-20 pr-2 text-right text-xs font-semibold text-white/60">
                {DAYS_OF_WEEK_PT[dIdx]}
              </div>

              <div className="grid flex-1 grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
                {HOURS.map((hour) => {
                  const value = heatmapData.grid[day]?.[hour] ?? 0;
                  const color = getColorIntensity(value);
                  const isMonday7h = day === "Monday" && hour === 7;

                  return (
                    <div
                      key={hour}
                      style={{ backgroundColor: color }}
                      className={`group relative flex h-8 cursor-pointer items-center justify-center rounded-[3px] border border-white/[0.02] transition-all ${
                        isMonday7h ? "border-amber-300/50 shadow-[0_0_12px_rgba(251,191,36,0.35)]" : "hover:border-white/30"
                      }`}
                    >
                      {isMonday7h && <span className="absolute h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />}

                      <div className="pointer-events-none absolute bottom-full left-1/2 z-[25] hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0B1020]/95 px-3 py-1.5 text-center text-[11px] shadow-[0_20px_60px_rgba(0,0,0,0.28)] group-hover:block">
                        <p className="font-semibold text-white">
                          {DAYS_OF_WEEK_PT[dIdx]}, {hour}h
                        </p>
                        <p className="mt-0.5 font-bold text-cyan-300">{(value ?? 0).toLocaleString("pt-BR")} autenticações</p>
                        {isMonday7h && (
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-rose-300">
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

      <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-2 text-xs text-white/40">
        <span>Menos ativo</span>
        <div className="flex gap-[2px]">
          <div className="h-3 w-5 rounded-[2px]" style={{ backgroundColor: "rgba(11, 16, 32, 0.85)" }} />
          <div className="h-3 w-5 rounded-[2px]" style={{ backgroundColor: "rgba(20, 184, 166, 0.38)" }} />
          <div className="h-3 w-5 rounded-[2px]" style={{ backgroundColor: "rgba(56, 189, 248, 0.7)" }} />
          <div className="h-3 w-5 rounded-[2px]" style={{ backgroundColor: "rgba(251, 191, 36, 0.9)" }} />
        </div>
        <span>Mais ativo</span>
      </div>
    </div>
  );
}

/* ── Exportação pública com Error Boundary ──────────────────────── */
export function HeatmapChart({ data }: HeatmapChartProps) {
  return (
    <HeatmapErrorBoundary>
      <HeatmapChartInner data={data} />
    </HeatmapErrorBoundary>
  );
}

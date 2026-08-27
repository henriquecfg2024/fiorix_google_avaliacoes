"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, RotateCcw, Check, ChevronDown, ChevronUp } from "lucide-react";

export interface ChartVisibility {
  chart1: boolean;
  chart2: boolean;
  chart3: boolean;
}

interface FiorixControlBarProps {
  visibleCharts: ChartVisibility;
  onToggleChart: (chartKey: keyof ChartVisibility) => void;
  onResetCharts: () => void;
}

export function FiorixControlBar({
  visibleCharts,
  onToggleChart,
  onResetCharts,
}: FiorixControlBarProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const activeCount = [visibleCharts.chart1, visibleCharts.chart2, visibleCharts.chart3].filter(Boolean).length;

  const chartLabels: { key: keyof ChartVisibility; name: string; desc: string }[] = [
    { key: "chart1", name: "Gráfico 1: Evolução Diária", desc: "Comparativo diário entre títulos no prazo e em atraso" },
    { key: "chart2", name: "Gráfico 2: Severidade do Atraso", desc: "Distribuição por faixas de dias de atraso (1-3d, 4-7d, etc.)" },
    { key: "chart3", name: "Gráfico 3: Distribuição Geral", desc: "Visão macro da proporção (No prazo, Atrasado, Devolução)" },
  ];

  return (
    <div className="space-y-3">
      <Card className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-[#0B1020]/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        {/* Left Status */}
        <div className="flex items-center gap-3 w-full sm:w-auto text-sm">
          <span className="font-semibold text-white">Gráficos exibidos</span>
          <span className="hidden text-white/52 md:inline">
            <strong className="text-white">{activeCount}</strong> de 3 gráficos ativos.
          </span>
          <button
            onClick={() => setIsManagerOpen(!isManagerOpen)}
            className="ml-2 flex items-center gap-1 text-sm font-medium text-amber-300 underline-offset-4 hover:underline"
          >
            {isManagerOpen ? (
              <>Fechar painel <ChevronUp size={14} /></>
            ) : (
              <>Gerenciar <ChevronDown size={14} /></>
            )}
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onResetCharts}
            className="w-full border-white/8 bg-white/[0.04] text-xs font-medium text-white shadow-sm hover:bg-white/[0.08] sm:w-auto"
            title="Restaurar visualização dos 3 gráficos padrão"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-white/60" />
            Restaurar padrão
          </Button>
          <Button
            size="sm"
            onClick={() => setIsManagerOpen(!isManagerOpen)}
            className={`w-full text-xs font-semibold shadow-sm transition-all sm:w-auto ${
              isManagerOpen
                ? "border border-white/8 bg-white/[0.06] text-white hover:bg-white/[0.1]"
                : "border border-amber-400/20 bg-gradient-to-r from-indigo-500 to-amber-400 text-white hover:brightness-105"
            }`}
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Escolher gráficos
          </Button>
        </div>
      </Card>

      {/* Expandable Chart Manager Panel */}
      {isManagerOpen && (
        <Card className="animate-in fade-in rounded-2xl border border-white/8 bg-white/[0.03] p-4 shadow-[0_16px_45px_rgba(0,0,0,0.12)] duration-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/70">
              Selecione os gráficos visíveis no Dashboard:
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetCharts}
              className="h-6 px-2 text-xs text-amber-300 hover:bg-white/[0.05] hover:text-white"
            >
              Marcar todos
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {chartLabels.map((item) => {
              const isChecked = visibleCharts[item.key];
              return (
                <label
                  key={item.key}
                  onClick={() => onToggleChart(item.key)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                    isChecked
                      ? "border-amber-400/20 bg-white/[0.05] shadow-sm ring-1 ring-amber-400/15"
                      : "border-white/8 bg-white/[0.03] text-white/58 opacity-80 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      isChecked
                        ? "border-amber-400 bg-amber-400 text-slate-950"
                        : "border-white/15 bg-transparent"
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-white">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-white/48">
                      {item.desc}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

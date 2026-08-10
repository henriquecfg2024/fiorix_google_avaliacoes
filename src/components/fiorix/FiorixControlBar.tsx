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
      <Card className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl shadow-sm border-gray-100 dark:border-border gap-4">
        {/* Left Status */}
        <div className="flex items-center gap-3 w-full sm:w-auto text-sm">
          <span className="font-semibold text-foreground">Gráficos exibidos</span>
          <span className="text-muted-foreground hidden md:inline">
            <strong className="text-foreground">{activeCount}</strong> de 3 gráficos ativos.
          </span>
          <button
            onClick={() => setIsManagerOpen(!isManagerOpen)}
            className="text-blue-600 hover:text-blue-700 font-medium ml-2 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 text-sm underline-offset-4 hover:underline"
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
            className="w-full sm:w-auto shadow-sm text-xs font-medium"
            title="Restaurar visualização dos 3 gráficos padrão"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            Restaurar padrão
          </Button>
          <Button
            size="sm"
            onClick={() => setIsManagerOpen(!isManagerOpen)}
            className={`w-full sm:w-auto text-xs font-semibold shadow-sm transition-all ${
              isManagerOpen 
                ? "bg-slate-900 text-white hover:bg-slate-800" 
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            Escolher gráficos
          </Button>
        </div>
      </Card>

      {/* Expandable Chart Manager Panel */}
      {isManagerOpen && (
        <Card className="p-4 rounded-xl shadow-sm border-blue-100 bg-blue-50/30 dark:bg-accent/40 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Selecione os gráficos visíveis no Dashboard:
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetCharts}
              className="text-xs text-blue-600 hover:text-blue-800 h-6 px-2"
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
                      ? "bg-white dark:bg-card border-blue-500 shadow-sm ring-1 ring-blue-500/20"
                      : "bg-gray-50/80 dark:bg-card/50 border-gray-200 dark:border-border text-muted-foreground opacity-75 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      isChecked
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-transparent"
                    }`}
                  >
                    {isChecked && <Check className="h-3 w-3" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-slate-900 dark:text-slate-100">
                      {item.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5 leading-tight">
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

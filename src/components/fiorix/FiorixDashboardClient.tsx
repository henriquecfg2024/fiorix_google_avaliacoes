"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FiorixHero } from "@/components/fiorix/FiorixHero";
import { FiorixControlBar, ChartVisibility } from "@/components/fiorix/FiorixControlBar";
import { FiorixFilters } from "@/components/fiorix/FiorixFilters";
import { FiorixKpiGrid } from "@/components/fiorix/FiorixKpiGrid";
import { FiorixCharts } from "@/components/fiorix/FiorixCharts";
import { FiorixDataTable } from "@/components/fiorix/FiorixDataTable";

interface FiorixDashboardClientProps {
  imports: any[];
  dashboardData: any;
  atrasados: any;
  initialFilters: any;
  userRole?: string;
}

export function FiorixDashboardClient({
  imports,
  dashboardData,
  atrasados,
  initialFilters,
  userRole,
}: FiorixDashboardClientProps) {
  const router = useRouter();

  const [visibleCharts, setVisibleCharts] = useState<ChartVisibility>({
    chart1: true,
    chart2: true,
    chart3: true,
  });

  const handleToggleChart = (chartKey: keyof ChartVisibility) => {
    setVisibleCharts((prev) => ({
      ...prev,
      [chartKey]: !prev[chartKey],
    }));
  };

  const handleResetCharts = () => {
    setVisibleCharts({
      chart1: true,
      chart2: true,
      chart3: true,
    });
    toast.success("Visualização dos gráficos restaurada para o padrão.");
  };

  const handleFilterChange = (key: string, value: string) => {
    const searchParams = new URLSearchParams(window.location.search);
    if (value && value !== "ALL" && value !== "todos") {
      searchParams.set(key, value);
    } else {
      searchParams.delete(key);
    }
    router.push(`?${searchParams.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <div className="space-y-6 animate-in fade-in duration-700 slide-in-from-bottom-4">
          <FiorixHero />

          <FiorixControlBar
            visibleCharts={visibleCharts}
            onToggleChart={handleToggleChart}
            onResetCharts={handleResetCharts}
          />

          <FiorixFilters
            tiposPrenotacao={dashboardData.tiposPrenotacao}
            filters={initialFilters}
            onFilterChange={handleFilterChange}
          />

          <FiorixKpiGrid
            data={{
              total: {
                value: dashboardData.summary.totalRecords,
                label: "Total de títulos computados",
              },
              noPrazo: {
                value: dashboardData.summary.noPrazoCount,
                percentage: dashboardData.summary.percentNoPrazo,
                label: "Dentro do prazo legal",
              },
              emAtraso: {
                value: dashboardData.summary.atrasadoCount,
                percentage: dashboardData.summary.percentAtrasado,
                label: "Fora do prazo legal",
              },
              devolucoes: {
                value: dashboardData.summary.devolucaoCount,
                percentage: dashboardData.summary.percentDevolucao,
                label: "Com exigências",
              },
            }}
          />

          <FiorixCharts
            pieChartData={dashboardData.charts.pieChartData}
            delaySeverity={dashboardData.charts.delaySeverity}
            evolucaoPrazoPorDia={dashboardData.charts.evolucaoPrazoPorDia}
            visibleCharts={visibleCharts}
          />

          <FiorixDataTable
            initialData={atrasados}
            initialFilters={initialFilters}
            totalAtrasadosCount={dashboardData.summary.atrasadoCount}
          />
        </div>
      </main>
    </div>
  );
}

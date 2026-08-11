"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FiorixHero } from "@/components/fiorix/FiorixHero";
import { FiorixControlBar, ChartVisibility } from "@/components/fiorix/FiorixControlBar";
import { FiorixFilters } from "@/components/fiorix/FiorixFilters";
import { FiorixKpiGrid } from "@/components/fiorix/FiorixKpiGrid";
import { FiorixCharts } from "@/components/fiorix/FiorixCharts";
import { FiorixDataTable } from "@/components/fiorix/FiorixDataTable";
import { FiorixSkeleton } from "@/components/fiorix/FiorixSkeleton";

interface FiorixDashboardClientProps {
  imports: any[];
  dashboardData: any;
  atrasados: any;
  initialFilters: any;
  userRole?: string;
}

export function FiorixDashboardClient({ imports, dashboardData, atrasados, initialFilters, userRole }: FiorixDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUpdating, setIsUpdating] = useState(false);

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
    startTransition(() => {
      const searchParams = new URLSearchParams(window.location.search);
      if (value && value !== "ALL" && value !== "todos") {
        searchParams.set(key, value);
      } else {
        searchParams.delete(key);
      }
      router.push(`?${searchParams.toString()}`);
    });
  };

  const handleUpdate = () => {
    setIsUpdating(true);
    startTransition(() => {
      router.refresh();
      setTimeout(() => {
        setIsUpdating(false);
        toast.success("Dados sincronizados com sucesso!", {
          description: "As informações refletem o estado atual da base de dados.",
        });
      }, 500);
    });
  };

  const handleImport = () => {
    router.push("/bi/importar");
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white selection:bg-blue-900 transition-colors duration-300">
      <main className="container mx-auto px-4 lg:px-8 py-8 space-y-6">
        {isPending && isUpdating ? (
          <FiorixSkeleton />
        ) : (
          <div className="space-y-6 animate-in fade-in duration-700 slide-in-from-bottom-4">
            <FiorixHero 
              onUpdate={handleUpdate} 
              onImport={handleImport}
              isUpdating={isUpdating || isPending}
              userRole={userRole}
            />
            
            <FiorixControlBar
              visibleCharts={visibleCharts}
              onToggleChart={handleToggleChart}
              onResetCharts={handleResetCharts}
            />
            
            <FiorixFilters 
              imports={imports}
              tiposPrenotacao={dashboardData.tiposPrenotacao}
              filters={initialFilters}
              onFilterChange={handleFilterChange}
            />
            
            <FiorixKpiGrid data={{
              total: { value: dashboardData.summary.totalRecords, label: "Total de títulos computados" },
              noPrazo: { value: dashboardData.summary.noPrazoCount, percentage: dashboardData.summary.percentNoPrazo, label: "Dentro do prazo legal" },
              emAtraso: { value: dashboardData.summary.atrasadoCount, percentage: dashboardData.summary.percentAtrasado, label: "Fora do prazo legal" },
              devolucoes: { value: dashboardData.summary.devolucaoCount, percentage: dashboardData.summary.percentDevolucao, label: "Com exigências" }
            }} />
            
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
        )}
      </main>
    </div>
  );
}

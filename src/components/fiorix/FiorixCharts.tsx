"use client";

import { Bar, BarChart, CartesianGrid, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface FiorixChartsProps {
  pieChartData: any[];
  delaySeverity?: any[];
  evolucaoPrazoPorDia: any[];
  visibleCharts: {
    chart1: boolean; // Evolução Diária
    chart2: boolean; // Severidade do Atraso
    chart3: boolean; // Distribuição Geral
  };
}

const chartConfig = {
  noPrazo: {
    label: "No Prazo",
    color: "#10B981",
  },
  atrasado: {
    label: "Em Atraso",
    color: "#EF4444",
  },
} satisfies ChartConfig;

const severityChartConfig = {
  count: {
    label: "Títulos",
    color: "#EF4444",
  },
} satisfies ChartConfig;

export function FiorixCharts({ pieChartData, delaySeverity = [], evolucaoPrazoPorDia, visibleCharts }: FiorixChartsProps) {
  const formattedEvolucao = evolucaoPrazoPorDia.map(d => {
    const parts = d.data.split('-');
    return {
      ...d,
      displayDate: parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.data,
    };
  });

  const activeCount = [visibleCharts.chart1, visibleCharts.chart2, visibleCharts.chart3].filter(Boolean).length;

  if (activeCount === 0) {
    return (
      <Card className="p-8 text-center border-dashed rounded-2xl">
        <p className="text-muted-foreground text-sm">Nenhum gráfico selecionado para exibição.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Utilize o painel acima ou clique em "Restaurar padrão" para reexibir os gráficos.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Row: Main Trend / Evolution Chart (if active) */}
      {visibleCharts.chart1 && (
        <Card className="shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Gráfico 1: Evolução Diária do Prazo de Entrega</CardTitle>
            <CardDescription>Comparativo contínuo entre títulos entregues no prazo e em atraso</CardDescription>
          </CardHeader>
          <CardContent>
            {formattedEvolucao.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart accessibilityLayer data={formattedEvolucao} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="displayDate"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="noPrazo" fill="var(--color-noPrazo)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="atrasado" fill="var(--color-atrasado)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] w-full flex items-center justify-center text-muted-foreground">
                Sem dados suficientes no período.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bottom Row: Severity & Distribution */}
      {(visibleCharts.chart2 || visibleCharts.chart3) && (
        <div className={`grid grid-cols-1 ${visibleCharts.chart2 && visibleCharts.chart3 ? "lg:grid-cols-2" : "grid-cols-1"} gap-4`}>
          {/* Chart 2: Delay Severity */}
          {visibleCharts.chart2 && (
            <Card className="shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Gráfico 2: Severidade do Atraso</CardTitle>
                <CardDescription>Distribuição dos títulos fora do prazo por faixas de dias de atraso</CardDescription>
              </CardHeader>
              <CardContent>
                {delaySeverity.length > 0 ? (
                  <ChartContainer config={severityChartConfig} className="h-[250px] w-full">
                    <BarChart accessibilityLayer data={delaySeverity} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={10} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="#EF4444" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[250px] w-full flex items-center justify-center text-muted-foreground">
                    Sem dados de severidade de atraso.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chart 3: Pie / Donut Chart */}
          {visibleCharts.chart3 && (
            <Card className="shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Gráfico 3: Distribuição Geral</CardTitle>
                <CardDescription>Visão macro da proporção de títulos no prazo, atrasos e exigências</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pb-0">
                {pieChartData.length > 0 ? (
                  <div className="h-[250px] w-full max-w-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="count"
                          stroke="none"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ color: '#1e293b', fontSize: '14px', fontWeight: 500 }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[250px] w-full flex items-center justify-center text-muted-foreground">
                    Nenhum dado para o período.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface FiorixChartsProps {
  pieChartData: any[];
  evolucaoPrazoPorDia: any[];
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

export function FiorixCharts({ pieChartData, evolucaoPrazoPorDia }: FiorixChartsProps) {
  // Format dates for the XAxis like "DD/MM" if possible
  const formattedEvolucao = evolucaoPrazoPorDia.map(d => {
    const parts = d.data.split('-');
    return {
      ...d,
      displayDate: parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.data,
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Bar Chart */}
      <Card className="lg:col-span-2 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Evolução Diária</CardTitle>
          <CardDescription>Comparativo entre títulos no prazo e em atraso</CardDescription>
        </CardHeader>
        <CardContent>
          {formattedEvolucao.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
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

      {/* Pie Chart */}
      <Card className="shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Distribuição Geral</CardTitle>
          <CardDescription>Visão macro do período selecionado</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-0">
          {pieChartData.length > 0 ? (
            <div className="h-[250px] w-full max-w-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
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
              Nenhum dado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

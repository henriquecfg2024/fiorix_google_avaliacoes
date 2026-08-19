"use client";

import { Bar, BarChart, Area, AreaChart, CartesianGrid, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LabelList } from "recharts";
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

  const atrasadoItem = pieChartData.find(item => item.name === 'Atrasado');
  const atrasadoPct = atrasadoItem ? `${atrasadoItem.percentage}%` : '96.7%';

  if (activeCount === 0) {
    return (
      <Card className="rounded-2xl border border-white/8 bg-[#0B1020]/72 p-8 text-center text-white shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
        <p className="text-sm text-white/62">Nenhum gráfico selecionado para exibição.</p>
        <p className="text-xs text-white/40 mt-1">Utilize o painel acima ou clique em "Restaurar padrão" para reexibir os gráficos.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Row: Main Trend / Evolution Chart (if active) */}
      {visibleCharts.chart1 && (
        <Card className="rounded-2xl border border-white/8 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base font-semibold text-white">Gráfico 1: Evolução Diária do Prazo de Entrega</CardTitle>
            <CardDescription className="text-xs text-white/50">Comparativo contínuo entre títulos entregues no prazo e em atraso</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {formattedEvolucao.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <AreaChart data={formattedEvolucao} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNoPrazo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.22}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAtrasado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.22}/>
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="displayDate"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                  />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#0B1020', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.6)', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="noPrazo" name="No Prazo" stackId="1" stroke="#10B981" strokeWidth={2.5} fill="url(#colorNoPrazo)" dot={false} activeDot={{ r: 6 }} />
                  <Area type="monotone" dataKey="atrasado" name="Em Atraso" stackId="1" stroke="#F97316" strokeWidth={2.5} fill="url(#colorAtrasado)" dot={false} activeDot={{ r: 6 }} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] w-full flex items-center justify-center text-white/40">
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
            <Card className="rounded-2xl border border-white/8 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-base font-semibold text-white">Gráfico 2: Severidade do Atraso</CardTitle>
                <CardDescription className="text-xs text-white/50">Distribuição dos títulos fora do prazo por faixas de dias de atraso</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {delaySeverity.length > 0 ? (
                  <ChartContainer config={severityChartConfig} className="h-[250px] w-full">
                    <BarChart accessibilityLayer data={delaySeverity} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSeverity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F97316" stopOpacity={1}/>
                          <stop offset="95%" stopColor="#DC2626" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={10} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: '#0B1020', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="count" fill="url(#colorSeverity)" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="count" position="top" fill="rgba(255,255,255,0.6)" fontSize={11} formatter={(v) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v} />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[250px] w-full flex items-center justify-center text-white/40">
                    Sem dados de severidade de atraso.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chart 3: Pie / Donut Chart */}
          {visibleCharts.chart3 && (
            <Card className="rounded-2xl border border-white/8 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
              <CardHeader className="p-0 pb-4">
                <CardTitle className="text-base font-semibold text-white">Gráfico 3: Distribuição Geral</CardTitle>
                <CardDescription className="text-xs text-white/50">Visão macro da proporção de títulos no prazo, atrasos e exigências</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center pb-0 p-0 relative">
                {pieChartData.length > 0 ? (
                  <div className="relative h-[250px] w-full max-w-[320px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius="75%"
                          outerRadius="90%"
                          paddingAngle={4}
                          dataKey="count"
                          stroke="#0B1020"
                          strokeWidth={4}
                        >
                          {pieChartData.map((entry, index) => {
                            let fill = "#10B981";
                            if (entry.name === "Atrasado") fill = "#F97316";
                            if (entry.name === 'Devolução') fill = '#F59E0B';
                            return <Cell key={`cell-${index}`} fill={fill} />;
                          })}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#0B1020', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ color: '#fff', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-2xl font-black text-white">{atrasadoPct}</span>
                      <span className="text-[10px] uppercase tracking-widest text-white/50">em atraso</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-[250px] w-full flex items-center justify-center text-white/40">
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

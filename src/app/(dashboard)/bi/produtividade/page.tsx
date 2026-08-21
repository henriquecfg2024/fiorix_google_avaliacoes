"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, Eye, LayoutGrid, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { AreaChartVolume } from "@/components/bi/AreaChartVolume";
import { BarChartUser } from "@/components/bi/BarChartUser";
import { DataTablePremium } from "@/components/bi/DataTablePremium";
import { DonutChart } from "@/components/bi/DonutChart";
import { HeatmapChart } from "@/components/bi/HeatmapChart";
import { KpiCards } from "@/components/bi/KpiCards";
import { FiorixSkeleton } from "@/components/fiorix/FiorixSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CAIXAS_DIGITAIS = ["eProtocolo", "GuilhermeM", "Rafael", "Intimação", "Intimacao"];

const normalizeNome = (valor: string) =>
  (valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isDigital = (nome: string) =>
  CAIXAS_DIGITAIS.some((item) => normalizeNome(nome).includes(normalizeNome(item)));

type FiltroCaixa = "todos" | "digital" | "presencial";

type ProdutividadeRow = {
  [key: string]: unknown;
  DATA?: string;
  TIPO?: string;
  TIPO_PEDIDO?: string;
  NOME?: string;
  QUANTIDADE?: number;
};

export default function ProdutividadePage() {
  const [data, setData] = useState<ProdutividadeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState("2026-08-01");
  const [endDate, setEndDate] = useState("2026-08-11");
  const [tipo, setTipo] = useState("ALL");
  const [tipoPedido, setTipoPedido] = useState("ALL");
  const [tipoDetalhado, setTipoDetalhado] = useState("ALL");
  const [nome, setNome] = useState("ALL");
  const [filtroCaixa, setFiltroCaixa] = useState<FiltroCaixa>("todos");

  const [chartsVisible, setChartsVisible] = useState({
    kpiCards: true,
    heatmap: true,
    donut: true,
    barChart: true,
    areaChart: true,
    dataTable: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem("fiorix_produtividade_charts_visible");
    if (!saved) return;

    try {
      setChartsVisible(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleChart = (key: keyof typeof chartsVisible) => {
    setChartsVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("fiorix_produtividade_charts_visible", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const dataRes = await fetch("/api/bi/produtividade/data");

        if (!dataRes.ok) {
          throw new Error(`Erro HTTP: ${dataRes.status}`);
        }

        const contentType = dataRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Resposta inválida do servidor");
        }

        const result = await dataRes.json();
        if (result.success && Array.isArray(result.data)) {
          setData(result.data.filter(Boolean) as ProdutividadeRow[]);
        } else {
          setData([]);
        }
      } catch (error: unknown) {
        console.warn("Erro ao buscar dados de produtividade:", error instanceof Error ? error.message : error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const baseFilteredData = useMemo(() => {
    return data.filter((row) => {
      if (!row || !row.DATA) return false;
      if (row.DATA < startDate || row.DATA > endDate) return false;
      if (tipo !== "ALL" && row.TIPO !== tipo) return false;
      if (tipoPedido !== "ALL" && row.TIPO_PEDIDO !== tipoPedido) return false;
      if (tipoDetalhado !== "ALL" && row.TIPO_DETALHADO !== tipoDetalhado) return false;
      if (nome !== "ALL" && row.NOME !== nome) return false;
      return true;
    });
  }, [data, startDate, endDate, tipo, tipoPedido, tipoDetalhado, nome]);

  const digitalCount = useMemo(() => {
    return baseFilteredData.reduce((acc, row) => {
      if (!isDigital(String(row.NOME || ""))) return acc;
      return acc + Number(row.QUANTIDADE || 0);
    }, 0);
  }, [baseFilteredData]);

  const presencialCount = useMemo(() => {
    return baseFilteredData.reduce((acc, row) => {
      if (isDigital(String(row.NOME || ""))) return acc;
      return acc + Number(row.QUANTIDADE || 0);
    }, 0);
  }, [baseFilteredData]);

  const totalCaixas = digitalCount + presencialCount;

  const selectOptions = useMemo(() => {
    const tiposPedidos = new Set<string>();
    const tiposDetalhados = new Set<string>();
    const nomes = new Set<string>();

    baseFilteredData.forEach((row) => {
      if (!row) return;
      if (row.TIPO_PEDIDO) tiposPedidos.add(String(row.TIPO_PEDIDO));
      if (row.TIPO_DETALHADO) tiposDetalhados.add(String(row.TIPO_DETALHADO));
      if (row.NOME) nomes.add(String(row.NOME));
    });

    return {
      tiposPedidos: Array.from(tiposPedidos).sort(),
      tiposDetalhados: Array.from(tiposDetalhados).sort(),
      nomes: Array.from(nomes).sort(),
    };
  }, [baseFilteredData]);

  const filteredData = useMemo(() => {
    if (filtroCaixa === "digital") {
      return baseFilteredData.filter((row) => isDigital(String(row.NOME || "")));
    }

    if (filtroCaixa === "presencial") {
      return baseFilteredData.filter((row) => !isDigital(String(row.NOME || "")));
    }

    return baseFilteredData;
  }, [baseFilteredData, filtroCaixa]);

  const clearFilters = () => {
    setStartDate("2026-08-01");
    setEndDate("2026-08-11");
    setTipo("ALL");
    setTipoPedido("ALL");
    setTipoDetalhado("ALL");
    setNome("ALL");
    toast.success("Filtros limpos com sucesso.");
  };

  const caixaTabs = [
    {
      key: "todos" as FiltroCaixa,
      label: "Todos",
      helper: "Visão consolidada",
      count: totalCaixas.toLocaleString("pt-BR"),
      dotClass: "bg-white/60",
    },
    {
      key: "digital" as FiltroCaixa,
      label: "Digital ONR",
      helper: "RIDigital",
      count: digitalCount.toLocaleString("pt-BR"),
      dotClass: "bg-[#00C950]",
    },
    {
      key: "presencial" as FiltroCaixa,
      label: "Presencial",
      helper: "Recepção",
      count: presencialCount.toLocaleString("pt-BR"),
      dotClass: "bg-[#2B7FFF]",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span>BI</span>
              <ChevronRight className="h-3 w-3 text-slate-600" />
              <span className="text-amber-300">Produtividade</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Produtividade de Caixa
              </h1>
              {!loading && data.length > 0 && (
                <Badge className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                  {data.length.toLocaleString("pt-BR")} registros
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-white/5 border-white/10 text-white hover:bg-white/10 font-semibold gap-2 text-xs"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Gerenciar Gráficos
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-[#0F172A] border-white/10 text-white p-4" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm border-b border-white/10 pb-2">
                    Exibição de Componentes
                  </h4>
                  <div className="space-y-3">
                    {[
                      { key: "kpiCards", label: "KPIs / Indicadores Superiores" },
                      { key: "heatmap", label: "Heatmap 7x24" },
                      { key: "donut", label: "Distribuição por Tipo de Pedido" },
                      { key: "barChart", label: "Ranking por Usuário" },
                      { key: "areaChart", label: "Volume por Hora" },
                      { key: "dataTable", label: "Tabela de Registros" },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={key}
                          checked={chartsVisible[key as keyof typeof chartsVisible]}
                          onCheckedChange={() => toggleChart(key as keyof typeof chartsVisible)}
                          className="border-white/20 data-[state=checked]:bg-[#00C950] data-[state=checked]:text-white"
                        />
                        <label
                          htmlFor={key}
                          className="text-sm font-medium leading-none text-white/80 cursor-pointer select-none"
                        >
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

        <div className="space-y-1.5">
          <span className="px-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
            Segmentação de Caixa
          </span>

          <div className="flex flex-wrap gap-2">
            {caixaTabs.map((item) => {
              const active = filtroCaixa === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFiltroCaixa(item.key)}
                  aria-pressed={active}
                  className={[
                    "min-w-[160px] flex-1 md:flex-none rounded-2xl border px-4 py-3 text-left transition-all backdrop-blur-xl",
                    active
                      ? "border-amber-400/40 bg-[#0B1020]/90 text-white shadow-[0_18px_50px_rgba(0,0,0,0.20)]"
                      : "border-white/12 bg-[#0B1020]/72 text-white/70 hover:border-white/20 hover:bg-[#0B1020]/85 hover:text-white",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.dotClass}`} />
                    <span className="text-[13px] font-semibold leading-tight">{item.label}</span>
                  </div>
                  <div className="text-[11px] text-white/45">{item.helper}</div>
                  <div className="mt-2 text-[11px] font-medium text-white/55">
                    {item.count} autenticações
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <FiorixSkeleton />
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-12 text-center flex flex-col items-center justify-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-[#00C950] animate-pulse" />
          <div>
            <h3 className="text-lg font-bold">Nenhum dado cadastrado</h3>
            <p className="text-sm text-white/50 mt-1">
              Assim que o administrador concluir a carga em Importações, os indicadores aparecerão aqui.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)] space-y-4">
            <div className="flex items-center gap-2 text-white/80 font-bold text-sm">
              <LayoutGrid className="h-4 w-4 text-[#00C950]" />
              <span>Filtros do Painel de Produtividade</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                  Data Inicial
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-white focus:border-[#00C950]/50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                  Data Final
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white/5 border-white/10 text-white focus:border-[#00C950]/50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                  Tipo
                </label>
                <Select value={tipo} onValueChange={(val) => setTipo(val || "ALL")}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-[#00C950]/50">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A0F1E] border-white/10 text-white">
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="TÍTULO">TÍTULO</SelectItem>
                    <SelectItem value="CERTIDÃO">CERTIDÃO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                  Tipo Pedido
                </label>
                <Select value={tipoPedido} onValueChange={(val) => setTipoPedido(val || "ALL")}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-[#00C950]/50">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A0F1E] border-white/10 text-white">
                    <SelectItem value="ALL">Todos</SelectItem>
                    {selectOptions.tiposPedidos.map((tp) => (
                      <SelectItem key={tp} value={tp}>
                        {tp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                  Tipo Detalhado
                </label>
                <Select value={tipoDetalhado} onValueChange={(val) => setTipoDetalhado(val || "ALL")}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-[#00C950]/50 truncate">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A0F1E] border-white/10 text-white max-w-[320px]">
                    <SelectItem value="ALL">Todos</SelectItem>
                    {selectOptions.tiposDetalhados.map((td) => (
                      <SelectItem key={td} value={td} className="text-xs">
                        {td}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                  Nome Colaborador
                </label>
                <Select value={nome} onValueChange={(val) => setNome(val || "ALL")}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white focus:border-[#00C950]/50">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A0F1E] border-white/10 text-white">
                    <SelectItem value="ALL">Todos</SelectItem>
                    {selectOptions.nomes.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-white/60 hover:text-white gap-2 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Limpar Filtros
              </Button>
            </div>
          </div>

          {filtroCaixa === "todos" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-white/60">Digital ONR</span>
                  <div className="rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70">
                    RIDigital
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-2xl font-bold tracking-tight text-white">
                    <span className="bg-gradient-to-r from-[#00C950] to-[#2B7FFF] bg-clip-text text-transparent">
                      {digitalCount.toLocaleString("pt-BR")}
                    </span>
                    <span className="ml-2 text-lg text-white/80">
                      ({totalCaixas > 0 ? ((digitalCount / totalCaixas) * 100).toFixed(1) : "0.0"}%)
                    </span>
                  </h3>
                  <p className="text-xs text-white/40">
                    Volume associado às caixas digitais para gestão de escala do ONR
                  </p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#00C950] to-[#2B7FFF] opacity-70" />
              </div>

              <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-white/60">Presencial</span>
                  <div className="rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70">
                    Recepção
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-2xl font-bold tracking-tight text-white">
                    <span className="bg-gradient-to-r from-amber-400 to-[#00C950] bg-clip-text text-transparent">
                      {presencialCount.toLocaleString("pt-BR")}
                    </span>
                    <span className="ml-2 text-lg text-white/80">
                      ({totalCaixas > 0 ? ((presencialCount / totalCaixas) * 100).toFixed(1) : "0.0"}%)
                    </span>
                  </h3>
                  <p className="text-xs text-white/40">
                    Volume presencial de recepção para balanceamento operacional
                  </p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 to-[#00C950] opacity-70" />
              </div>
            </div>
          )}

          {chartsVisible.kpiCards && <KpiCards data={filteredData} />}

          {(chartsVisible.heatmap || chartsVisible.donut) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {chartsVisible.heatmap && (
                <div className={`${chartsVisible.donut ? "lg:col-span-8" : "lg:col-span-12"} min-w-0`}>
                  <HeatmapChart data={filteredData} />
                </div>
              )}
              {chartsVisible.donut && (
                <div className={`${chartsVisible.heatmap ? "lg:col-span-4" : "lg:col-span-12"} min-w-0`}>
                  <DonutChart data={filteredData} />
                </div>
              )}
            </div>
          )}

          {(chartsVisible.barChart || chartsVisible.areaChart) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {chartsVisible.barChart && <BarChartUser data={filteredData} />}
              {chartsVisible.areaChart && <AreaChartVolume data={filteredData} />}
            </div>
          )}

          {chartsVisible.dataTable && (
            <div className="pt-2">
              <DataTablePremium data={filteredData} />
            </div>
          )}
        </div>
      )}
      </main>
    </div>
  );
}

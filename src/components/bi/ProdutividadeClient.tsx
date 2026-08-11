"use client";

import { useState, useMemo, useEffect } from "react";
import { RefreshCw, Upload, Sparkles, ChevronRight, LayoutGrid, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { ImportModal } from "./ImportModal";
import { KpiCards } from "./KpiCards";
import { HeatmapChart } from "./HeatmapChart";
import { DonutChart } from "./DonutChart";
import { BarChartUser } from "./BarChartUser";
import { AreaChartVolume } from "./AreaChartVolume";
import { DataTablePremium } from "./DataTablePremium";
import { FiorixSkeleton } from "@/components/fiorix/FiorixSkeleton";

export function ProdutividadeClient() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Filters State
  const [startDate, setStartDate] = useState("2026-08-01");
  const [endDate, setEndDate] = useState("2026-08-11");
  const [tipo, setTipo] = useState("ALL");
  const [tipoPedido, setTipoPedido] = useState("ALL");
  const [nome, setNome] = useState("ALL");

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dbData, error } = await supabase
        .from("fiorix_produtividade_dados")
        .select("*")
        .order("DATA", { ascending: false });

      if (error) throw error;
      setData(dbData || []);
    } catch (error: any) {
      console.error("Erro ao buscar dados do Supabase:", error);
      toast.error(`Erro ao carregar dados: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    toast.info("Iniciando sincronização com SQL Server...");
    try {
      const res = await fetch("/api/bi/produtividade/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });

      const contentType = res.headers.get("content-type");
      if (!res.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error(`Falha no servidor (Status ${res.status}). Verifique as credenciais ou a rota de API.`);
      }

      const result = await res.json();
      if (result.success) {
        toast.success(`Sincronização concluída! ${result.inserted} registros atualizados.`);
        fetchData();
      } else {
        throw new Error(result.error || "Erro desconhecido ao sincronizar.");
      }
    } catch (error: any) {
      console.error("Erro na sincronização:", error);
      const cleanMsg = typeof error?.message === "string" && error.message.includes("<")
        ? "Erro no servidor ao processar resposta."
        : error?.message || "Erro de conexão.";
      toast.error(`Erro na sincronização: ${cleanMsg}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Distinct Lists for Select dropdowns based on raw data
  const selectOptions = useMemo(() => {
    const tiposPedidos = new Set<string>();
    const nomes = new Set<string>();

    data.forEach((row) => {
      if (row.TIPO_PEDIDO) tiposPedidos.add(row.TIPO_PEDIDO);
      if (row.NOME) nomes.add(row.NOME);
    });

    return {
      tiposPedidos: Array.from(tiposPedidos).sort(),
      nomes: Array.from(nomes).sort(),
    };
  }, [data]);

  // Filtered Data via front-end aggregation
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      // 1. Date filter
      if (row.DATA < startDate || row.DATA > endDate) return false;
      
      // 2. TIPO filter
      if (tipo !== "ALL" && row.TIPO !== tipo) return false;

      // 3. TIPO_PEDIDO filter
      if (tipoPedido !== "ALL" && row.TIPO_PEDIDO !== tipoPedido) return false;

      // 4. NOME filter
      if (nome !== "ALL" && row.NOME !== nome) return false;

      return true;
    });
  }, [data, startDate, endDate, tipo, tipoPedido, nome]);

  const clearFilters = () => {
    setStartDate("2026-08-01");
    setEndDate("2026-08-11");
    setTipo("ALL");
    setTipoPedido("ALL");
    setNome("ALL");
    toast.success("Filtros limpos com sucesso.");
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white p-4 lg:p-8 space-y-6">
      
      {/* Breadcrumb Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-white/40 mb-1.5 font-medium">
            <span>Dashboard</span>
            <ChevronRight className="h-3 w-3" />
            <span>BI</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[#00C950]">Produtividade</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Produtividade - Caixa</h1>
            <Badge className="bg-[#00C950]/15 text-[#00C950] border-[#00C950]/30 hover:bg-[#00C950]/20 font-mono text-xs">
              {data.length.toLocaleString("pt-BR")} registros
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-[#2B7FFF] text-white hover:bg-blue-600 font-semibold gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            Sincronizar Dados
          </Button>

          <Button
            onClick={() => setIsImportOpen(true)}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold gap-2"
          >
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
        </div>
      </div>

      {/* Date Picker Row */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center gap-2 text-white/80 font-bold text-sm">
          <LayoutGrid className="h-4 w-4 text-[#00C950]" />
          <span>Filtros do Painel de Produtividade</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
          {/* Data Inicio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Data Inicial</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-[#00C950]/50"
            />
          </div>

          {/* Data Fim */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Data Final</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:border-[#00C950]/50"
            />
          </div>

          {/* Tipo Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Tipo</label>
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

          {/* Tipo Pedido Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Tipo Pedido</label>
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

          {/* Nome Select */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Nome Colaborador</label>
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

      {loading ? (
        <FiorixSkeleton />
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-12 text-center flex flex-col items-center justify-center space-y-4">
          <Sparkles className="h-10 w-10 text-[#00C950] animate-pulse" />
          <div>
            <h3 className="text-lg font-bold">Nenhum dado cadastrado no Supabase</h3>
            <p className="text-sm text-white/50 mt-1">Sincronize com a base SQL Server ou faça o upload de um arquivo CSV para começar.</p>
          </div>
          <div className="flex gap-4">
            <Button onClick={handleSync} className="bg-[#2B7FFF] text-white hover:bg-blue-600 font-semibold">
              Sincronizar SQL Server
            </Button>
            <Button onClick={() => setIsImportOpen(true)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold">
              Importar CSV
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* KPIs Row */}
          <KpiCards data={filteredData} />

          {/* Row 1 Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <HeatmapChart data={filteredData} />
            </div>
            <div className="lg:col-span-4">
              <DonutChart data={filteredData} />
            </div>
          </div>

          {/* Row 2 Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarChartUser data={filteredData} />
            <AreaChartVolume data={filteredData} />
          </div>

          {/* Row 3 Table */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white uppercase tracking-wider">Tabela de Registros</h3>
            </div>
            <DataTablePremium data={filteredData} />
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  );
}

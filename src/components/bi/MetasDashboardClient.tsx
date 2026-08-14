"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";
import { 
  Target, AlertCircle, Clock, TrendingUp, Search, Filter, Loader2, Download,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileSpreadsheet,
  X, AlertTriangle, Calendar, Activity
} from "lucide-react";

type MetasData = {
  protocolo: number;
  dataApresentado?: string;
  dtPrevisao?: string;
  dtEntregaReal?: string;
  status?: string;
  atrasoDias?: number;
  d1Protocolo?: string;
  d1Escaneamento?: string;
  d2Contraditorio?: string;
  d3Extrato?: string;
  d4Qualificacao?: string;
  d5Calculo?: string;
  d8Impressao?: string;
  d9Preparacao?: string;
  d9Conferencia?: string;
  d10Entrega?: string;
  qtdRetrabalho?: number;
  diasD1D2?: number | null;
  diasD2D3?: number | null;
  diasD3D4?: number | null;
  diasD4D5?: number | null;
  diasD5D8?: number | null;
  diasD8D9?: number | null;
  [key: string]: any;
};

export function MetasDashboardClient() {
  const [data, setData] = useState<MetasData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [gargaloFilter, setGargaloFilter] = useState("ALL");

  // Drawer/Modal State
  const [selectedProtocol, setSelectedProtocol] = useState<MetasData | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/bi/metas/data");
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (error) {
        console.error("Failed to load metas data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, gargaloFilter, itemsPerPage]);

  // Helper universal para pegar valor ignorando casing e aliases
  const getVal = (record: any, ...keys: string[]) => {
    if (!record) return null;
    for (const k of keys) {
      if (record[k] !== undefined && record[k] !== null) return record[k];
    }
    return null;
  };

  // Format date helper
  const formatDate = (val: any) => {
    if (!val) return "-";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return "-";
      return format(d, "dd/MM HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  // Safe diff calculation in days between two date fields
  const calculateDaysBetween = (startVal: any, endVal: any, givenDaysVal: any) => {
    if (givenDaysVal !== null && givenDaysVal !== undefined) {
      return Number(givenDaysVal);
    }
    if (!startVal) return null;
    if (!endVal) return null; // Fase ainda não aconteceu
    
    try {
      const dStart = new Date(startVal).getTime();
      const dEnd = new Date(endVal).getTime();
      if (isNaN(dStart) || isNaN(dEnd)) return null;
      const diff = Math.max(0, Math.floor((dEnd - dStart) / (1000 * 60 * 60 * 24)));
      return diff;
    } catch {
      return null;
    }
  };

  // Determine phases and bottleneck for a given record
  const getPhasesForRecord = (record: MetasData) => {
    const d1 = getVal(record, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT");
    const d1E = getVal(record, "d1Escaneamento", "D1_ESCANEAMENTO", "D1_ESCAN");
    const d2 = getVal(record, "d2Contraditorio", "D2_CONTRADITORIO", "D2_CONTRAD");
    const d3 = getVal(record, "d3Extrato", "D3_EXTRATO", "D3_EXTR");
    const d4 = getVal(record, "d4Qualificacao", "D4_QUALIFICACAO", "D4_QUALI");
    const d5 = getVal(record, "d5Calculo", "D5_CALCULO", "D5_CALC");
    const d8 = getVal(record, "d8Impressao", "D8_IMPRESSAO", "D8_IMP");
    const d9 = getVal(record, "d9Preparacao", "D9_PREPARACAO", "D9_PREP");

    const phases = [
      { name: "PROTOCOLO -> CONTRADITORIO", dias: calculateDaysBetween(d1, d2, getVal(record, "diasD1D2", "DIAS_D1_D2")) },
      { name: "CONTRADITORIO -> EXTRATO", dias: calculateDaysBetween(d2, d3, getVal(record, "diasD2D3", "DIAS_D2_D3")) },
      { name: "EXTRATO -> QUALIFICACAO", dias: calculateDaysBetween(d3, d4, getVal(record, "diasD3D4", "DIAS_D3_D4")) },
      { name: "QUALIFICACAO -> CALCULO", dias: calculateDaysBetween(d4, d5, getVal(record, "diasD4D5", "DIAS_D4_D5")) },
      { name: "CALCULO -> IMPRESSAO", dias: calculateDaysBetween(d5, d8, getVal(record, "diasD5D8", "DIAS_D5_D8")) },
      { name: "IMPRESSAO -> PREPARACAO", dias: calculateDaysBetween(d8, d9, getVal(record, "diasD8D9", "DIAS_D8_D9")) },
    ];

    let max = phases[0];
    for (const phase of phases) {
      if ((phase.dias || 0) > (max.dias || 0)) {
        max = phase;
      }
    }
    return { phases, topGargalo: max };
  };

  const getGargaloForRecord = (record: MetasData) => {
    return getPhasesForRecord(record).topGargalo;
  };

  // Calculate chart data & KPIs
  const { chartData, kpis, statuses, gargaloTypes } = useMemo(() => {
    if (data.length === 0) return { chartData: [], kpis: null, statuses: [], gargaloTypes: [] };

    let atrasados = 0;
    let entregueComAtraso = 0;
    
    const phaseSums = {
      D1_D2: { sum: 0, count: 0 },
      D2_D3: { sum: 0, count: 0 },
      D3_D4: { sum: 0, count: 0 },
      D4_D5: { sum: 0, count: 0 },
      D5_D8: { sum: 0, count: 0 },
      D8_D9: { sum: 0, count: 0 },
    };

    const statusSet = new Set<string>();
    const gargaloSet = new Set<string>();
    const gargaloCounts: Record<string, number> = {};

    data.forEach(item => {
      const st = String(getVal(item, "status", "STATUS") || "Desconhecido");
      const atrasoDias = Number(getVal(item, "atrasoDias", "ATRASO_DIAS") || 0);

      statusSet.add(st);

      const isLate = atrasoDias > 0 || st.toLowerCase().includes("atraso");
      if (isLate) {
        if (st.toLowerCase().includes("entregue")) {
          entregueComAtraso++;
        } else {
          atrasados++;
        }
      }

      const { phases, topGargalo } = getPhasesForRecord(item);
      gargaloSet.add(topGargalo.name);
      gargaloCounts[topGargalo.name] = (gargaloCounts[topGargalo.name] || 0) + 1;

      if (phases[0].dias !== null) { phaseSums.D1_D2.sum += phases[0].dias; phaseSums.D1_D2.count++; }
      if (phases[1].dias !== null) { phaseSums.D2_D3.sum += phases[1].dias; phaseSums.D2_D3.count++; }
      if (phases[2].dias !== null) { phaseSums.D3_D4.sum += phases[2].dias; phaseSums.D3_D4.count++; }
      if (phases[3].dias !== null) { phaseSums.D4_D5.sum += phases[3].dias; phaseSums.D4_D5.count++; }
      if (phases[4].dias !== null) { phaseSums.D5_D8.sum += phases[4].dias; phaseSums.D5_D8.count++; }
      if (phases[5].dias !== null) { phaseSums.D8_D9.sum += phases[5].dias; phaseSums.D8_D9.count++; }
    });

    let topGargaloName = "Nenhum";
    let topGargaloCount = 0;
    Object.entries(gargaloCounts).forEach(([name, count]) => {
      if (count > topGargaloCount) {
        topGargaloName = name;
        topGargaloCount = count;
      }
    });

    const chart = [
      { name: "D1->D2", fullName: "Prot->Contrad.", dias: phaseSums.D1_D2.count ? phaseSums.D1_D2.sum / phaseSums.D1_D2.count : 0, count: phaseSums.D1_D2.count },
      { name: "D2->D3", fullName: "Contrad.->Extr.", dias: phaseSums.D2_D3.count ? phaseSums.D2_D3.sum / phaseSums.D2_D3.count : 0, count: phaseSums.D2_D3.count },
      { name: "D3->D4", fullName: "Extr.->Qualif.", dias: phaseSums.D3_D4.count ? phaseSums.D3_D4.sum / phaseSums.D3_D4.count : 0, count: phaseSums.D3_D4.count },
      { name: "D4->D5", fullName: "Qualif.->Calc.", dias: phaseSums.D4_D5.count ? phaseSums.D4_D5.sum / phaseSums.D4_D5.count : 0, count: phaseSums.D4_D5.count },
      { name: "D5->D8", fullName: "Calc.->Impres.", dias: phaseSums.D5_D8.count ? phaseSums.D5_D8.sum / phaseSums.D5_D8.count : 0, count: phaseSums.D5_D8.count },
      { name: "D8->D9", fullName: "Impres.->Prep.", dias: phaseSums.D8_D9.count ? phaseSums.D8_D9.sum / phaseSums.D8_D9.count : 0, count: phaseSums.D8_D9.count },
    ].map(d => ({ ...d, dias: Number(d.dias.toFixed(2)) }));

    return {
      chartData: chart,
      kpis: {
        total: data.length,
        atrasados,
        entregueComAtraso,
        topGargalo: { name: topGargaloName, count: topGargaloCount }
      },
      statuses: Array.from(statusSet).sort(),
      gargaloTypes: Array.from(gargaloSet).sort(),
    };
  }, [data]);

  // Filtering
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const prot = String(getVal(item, "protocolo", "PROTOCOLO") || "");
      const st = String(getVal(item, "status", "STATUS") || "");
      const matchSearch = search ? prot.includes(search) : true;
      const matchStatus = statusFilter !== "ALL" ? st === statusFilter : true;
      const matchGargalo = gargaloFilter !== "ALL" ? getGargaloForRecord(item).name === gargaloFilter : true;
      
      return matchSearch && matchStatus && matchGargalo;
    });
  }, [data, search, statusFilter, gargaloFilter]);

  // Pagination Calculations
  const totalFiltered = filteredData.length;
  const totalPages = Math.ceil(totalFiltered / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalFiltered);
  
  const paginatedData = useMemo(() => {
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, startIndex, endIndex]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const paginationRange = useMemo(() => {
    const range: (number | string)[] = [];
    const delta = 2;

    let start = Math.max(1, currentPage - delta);
    let end = Math.min(totalPages, currentPage + delta);

    if (currentPage <= delta) {
      end = Math.min(totalPages, 1 + delta * 2);
    }
    if (currentPage + delta >= totalPages) {
      start = Math.max(1, totalPages - delta * 2);
    }

    if (start > 1) {
      range.push(1);
      if (start > 2) range.push("...");
    }

    for (let i = start; i <= end; i++) {
      range.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) range.push("...");
      range.push(totalPages);
    }

    return range;
  }, [currentPage, totalPages]);

  // CSV Export Helper
  const handleExportCSV = (exportList: MetasData[], filename: string) => {
    if (exportList.length === 0) return;

    const headers = [
      "PROTOCOLO", "STATUS", "ATRASO_DIAS", "DATA_APRESENTADO", "DT_PREVISAO", 
      "DT_ENTREGA_REAL", "D1_PROTOCOLO", "D3_EXTRATO", "D4_QUALIFICACAO", 
      "D5_CALCULO", "D8_IMPRESSAO", "D10_ENTREGA", "GARGALO", "DIAS_GARGALO"
    ];

    const rows = exportList.map(item => {
      const g = getGargaloForRecord(item);
      const prot = getVal(item, "protocolo", "PROTOCOLO");
      const st = getVal(item, "status", "STATUS");
      const atr = getVal(item, "atrasoDias", "ATRASO_DIAS");
      return [
        prot,
        `"${(st || "").replace(/"/g, '""')}"`,
        atr || 0,
        `"${getVal(item, "dataApresentado", "DATA_APRESENTADO") || ""}"`,
        `"${getVal(item, "dtPrevisao", "DT_PREVISAO") || ""}"`,
        `"${getVal(item, "dtEntregaReal", "DT_ENTREGA_REAL") || ""}"`,
        `"${getVal(item, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT") || ""}"`,
        `"${getVal(item, "d3Extrato", "D3_EXTRATO", "D3_EXTR") || ""}"`,
        `"${getVal(item, "d4Qualificacao", "D4_QUALIFICACAO", "D4_QUALI") || ""}"`,
        `"${getVal(item, "d5Calculo", "D5_CALCULO", "D5_CALC") || ""}"`,
        `"${getVal(item, "d8Impressao", "D8_IMPRESSAO", "D8_IMP") || ""}"`,
        `"${getVal(item, "d10Entrega", "D10_ENTREGA", "D10_ENT") || ""}"`,
        `"${g.name}"`,
        g.dias !== null ? g.dias : 0
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-white/50">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-white/60 text-xs font-semibold mb-1 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" /> TOTAL
          </p>
          <h3 className="text-3xl font-bold text-white">
            {kpis?.total ? kpis.total.toLocaleString("pt-BR") : 0}
          </h3>
        </div>

        <div className="bg-white/5 border border-red-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-red-300 text-xs font-semibold mb-1 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> ATRASADOS
          </p>
          <h3 className="text-3xl font-bold text-white">
            {kpis?.atrasados ? kpis.atrasados.toLocaleString("pt-BR") : 0}
          </h3>
        </div>

        <div className="bg-white/5 border border-orange-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-orange-300 text-xs font-semibold mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4" /> ENTREGUE COM ATRASO
          </p>
          <h3 className="text-3xl font-bold text-white">
            {kpis?.entregueComAtraso ? kpis.entregueComAtraso.toLocaleString("pt-BR") : 0}
          </h3>
        </div>

        <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-bl-full -mr-4 -mt-4"></div>
          <p className="text-purple-300 text-xs font-semibold mb-1 flex items-center gap-2 truncate pr-6" title="Gargalo Principal">
            <TrendingUp className="w-4 h-4" /> PRINCIPAL GARGALO
          </p>
          <h3 className="text-lg font-bold text-white truncate pr-2 mt-2" title={kpis?.topGargalo?.name}>
            {kpis?.topGargalo?.name || "-"}
          </h3>
          <p className="text-xs text-white/50 mt-1">
            Afeta {kpis?.topGargalo?.count?.toLocaleString("pt-BR") || 0} protocolos
          </p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
          Média de Dias por Fase 
          <span className="text-xs font-normal text-white/50 bg-white/10 px-2 py-0.5 rounded-md">
            Identificador de Gargalos
          </span>
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="fullName" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const dataPoint = payload[0].payload;
                    return (
                      <div className="bg-[#1E293B] border border-white/10 rounded-xl p-3 shadow-2xl text-xs space-y-1 text-white">
                        <p className="font-bold text-blue-400">{dataPoint.fullName}</p>
                        <p className="text-white/80">
                          {dataPoint.name}: média <span className="font-bold text-white">{dataPoint.dias}d</span> -{" "}
                          <span className="text-white/60">{dataPoint.count?.toLocaleString("pt-BR") || 0} protocolos</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="dias" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.dias > 3 ? '#ef4444' : entry.dias > 1 ? '#f59e0b' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela Container */}
      <div ref={tableRef} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col scroll-mt-24">
        
        {/* Topo da Tabela: Informações e Itens por página */}
        <div className="p-4 border-b border-white/10 flex flex-wrap gap-4 items-center justify-between bg-white/[0.03] text-xs text-white/70">
          <div>
            Mostrando <span className="font-semibold text-white">{totalFiltered > 0 ? startIndex + 1 : 0}</span>-
            <span className="font-semibold text-white">{endIndex}</span> de{" "}
            <span className="font-semibold text-white">{totalFiltered.toLocaleString("pt-BR")}</span> | Página{" "}
            <span className="font-semibold text-white">{currentPage}</span> de{" "}
            <span className="font-semibold text-white">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <span>Itens por página:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="bg-[#0F172A] border border-white/10 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {/* Toolbar de Busca, Filtros e Exportação CSV */}
        <div className="p-4 border-b border-white/10 flex flex-wrap gap-4 items-center justify-between bg-white/[0.01]">
          <div className="relative max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-white/40" />
            </div>
            <input
              type="text"
              placeholder="Buscar por Protocolo..."
              className="w-full bg-[#0F172A] border border-white/10 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-white/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Filtro Status */}
            <div className="flex items-center gap-2 bg-[#0F172A] border border-white/10 rounded-lg px-3 py-1.5">
              <Filter className="h-3.5 w-3.5 text-white/40" />
              <select 
                className="bg-transparent text-sm text-white focus:outline-none appearance-none pr-4"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos os Status</option>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Filtro Gargalo */}
            <div className="flex items-center gap-2 bg-[#0F172A] border border-white/10 rounded-lg px-3 py-1.5">
              <Filter className="h-3.5 w-3.5 text-white/40" />
              <select 
                className="bg-transparent text-sm text-white focus:outline-none appearance-none pr-4 max-w-[150px] truncate"
                value={gargaloFilter}
                onChange={(e) => setGargaloFilter(e.target.value)}
              >
                <option value="ALL">Qualquer Gargalo</option>
                {gargaloTypes.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Botões Exportar CSV */}
            <button
              onClick={() => handleExportCSV(paginatedData, `metas_pagina_${currentPage}`)}
              title="Exportar registros visíveis na página atual para CSV"
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" /> Exportar Página (CSV)
            </button>

            <button
              onClick={() => handleExportCSV(filteredData, "metas_filtradas")}
              title="Exportar todos os registros filtrados para CSV"
              className="flex items-center gap-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" /> Exportar Filtrados (CSV)
            </button>
          </div>
        </div>

        {/* Tabela de Dados */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-white/60 bg-white/[0.03] uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Protocolo</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Atraso</th>
                <th className="px-4 py-3 font-semibold text-center bg-white/[0.01]">D1 Prot</th>
                <th className="px-4 py-3 font-semibold text-center bg-white/[0.01]">D3 Extr</th>
                <th className="px-4 py-3 font-semibold text-center bg-white/[0.01]">D4 Quali</th>
                <th className="px-4 py-3 font-semibold text-center bg-white/[0.01]">D5 Calc</th>
                <th className="px-4 py-3 font-semibold text-center bg-white/[0.01]">D8 Imp</th>
                <th className="px-4 py-3 font-semibold text-center bg-white/[0.01]">D10 Ent</th>
                <th className="px-4 py-3 font-semibold">Gargalo</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row) => {
                const prot = getVal(row, "protocolo", "PROTOCOLO");
                const st = String(getVal(row, "status", "STATUS") || "N/A");
                const atr = Number(getVal(row, "atrasoDias", "ATRASO_DIAS") || 0);

                const isAtrasado = atr > 0 || st.toLowerCase().includes("atraso");
                const gargalo = getGargaloForRecord(row);
                
                const d1Val = getVal(row, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT");
                const d3Val = getVal(row, "d3Extrato", "D3_EXTRATO", "D3_EXTR");
                const d4Val = getVal(row, "d4Qualificacao", "D4_QUALIFICACAO", "D4_QUALI");
                const d5Val = getVal(row, "d5Calculo", "D5_CALCULO", "D5_CALC");
                const d8Val = getVal(row, "d8Impressao", "D8_IMPRESSAO", "D8_IMP");
                const d10Val = getVal(row, "d10Entrega", "D10_ENTREGA", "D10_ENT");

                return (
                  <tr 
                    key={prot} 
                    onClick={() => setSelectedProtocol(row)}
                    title="Clique para ver o detalhamento completo do protocolo"
                    className="border-b border-white/5 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-blue-400 underline decoration-blue-400/30 underline-offset-4">{prot}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        isAtrasado ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {st}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${atr > 0 ? 'text-red-400' : 'text-white/50'}`}>
                      {atr > 0 ? `${atr}d` : '-'}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-white/70 text-center bg-white/[0.01]">{formatDate(d1Val)}</td>
                    <td className="px-4 py-3 text-[11px] text-white/70 text-center bg-white/[0.01]">{formatDate(d3Val)}</td>
                    <td className={`px-4 py-3 text-[11px] text-center bg-white/[0.01] ${gargalo.name.includes("EXTRATO -> QUALIFICACAO") ? "text-orange-400 font-bold" : "text-white/70"}`}>
                      {formatDate(d4Val)}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-white/70 text-center bg-white/[0.01]">{formatDate(d5Val)}</td>
                    <td className="px-4 py-3 text-[11px] text-white/70 text-center bg-white/[0.01]">{formatDate(d8Val)}</td>
                    <td className="px-4 py-3 text-[11px] text-white/70 text-center bg-white/[0.01]">{formatDate(d10Val)}</td>
                    <td className="px-4 py-3 text-[11px] font-medium text-purple-300">
                      {gargalo.name} ({gargalo.dias !== null ? `${gargalo.dias}d` : '0d'})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredData.length === 0 && (
            <div className="p-8 text-center text-white/50">
              Nenhum protocolo encontrado com os filtros atuais.
            </div>
          )}
        </div>

        {/* Rodapé: Paginação */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 bg-white/[0.02]">
            <div className="text-xs text-white/50">
              Página <span className="text-white font-semibold">{currentPage}</span> de{" "}
              <span className="text-white font-semibold">{totalPages}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                title="Primeira Página"
                className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all cursor-pointer"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                title="Página Anterior"
                className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 mx-1">
                {paginationRange.map((page, index) => {
                  if (typeof page === "string") {
                    return (
                      <span key={`dots-${index}`} className="px-2 text-white/40 text-xs select-none">
                        ...
                      </span>
                    );
                  }

                  const isCurrent = page === currentPage;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      style={{
                        backgroundColor: isCurrent ? "#8b5cf6" : undefined,
                      }}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isCurrent
                          ? "text-white shadow-lg shadow-purple-500/20 font-bold"
                          : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                title="Próxima Página"
                className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                title="Última Página"
                className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all cursor-pointer"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL / DRAWER LATERAL DIREITO - DETALHAMENTO DO PROTOCOLO */}
      {selectedProtocol && (() => {
        const protNum = getVal(selectedProtocol, "protocolo", "PROTOCOLO");
        const stStr = String(getVal(selectedProtocol, "status", "STATUS") || "Em dia");
        const atrDias = Number(getVal(selectedProtocol, "atrasoDias", "ATRASO_DIAS") || 0);
        const retrabalho = Number(getVal(selectedProtocol, "qtdRetrabalho", "QTD_RETRABALHO", "qtd_retrabalho") || 0);

        const isEntregueComAtraso = stStr.toLowerCase().includes("entregue") && (atrDias > 0 || stStr.toLowerCase().includes("atraso"));
        const isAtrasado = !isEntregueComAtraso && (atrDias > 0 || stStr.toLowerCase().includes("atraso"));

        // Seção 1: Mapeamento de Datas com suporte a aliases
        const datesMap = [
          { label: "D1_PROTOCOLO", val: getVal(selectedProtocol, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT") },
          { label: "D1_ESCANEAMENTO", val: getVal(selectedProtocol, "d1Escaneamento", "D1_ESCANEAMENTO", "D1_ESCAN") },
          { label: "D2_CONTRADITORIO", val: getVal(selectedProtocol, "d2Contraditorio", "D2_CONTRADITORIO", "D2_CONTRAD") },
          { label: "D3_EXTRATO", val: getVal(selectedProtocol, "d3Extrato", "D3_EXTRATO", "D3_EXTR") },
          { label: "D4_QUALIFICACAO", val: getVal(selectedProtocol, "d4Qualificacao", "D4_QUALIFICACAO", "D4_QUALI") },
          { label: "D5_CALCULO", val: getVal(selectedProtocol, "d5Calculo", "D5_CALCULO", "D5_CALC") },
          { label: "D8_IMPRESSAO", val: getVal(selectedProtocol, "d8Impressao", "D8_IMPRESSAO", "D8_IMP") },
          { label: "D9_PREPARACAO", val: getVal(selectedProtocol, "d9Preparacao", "D9_PREPARACAO", "D9_PREP") },
          { label: "D9_CONFERENCIA", val: getVal(selectedProtocol, "d9Conferencia", "D9_CONFERENCIA", "D9_CONF") },
          { label: "D10_ENTREGA", val: getVal(selectedProtocol, "d10Entrega", "D10_ENTREGA", "D10_ENT") },
        ];

        // Seção 2: Cálculo dos Dias por Fase
        const { phases } = getPhasesForRecord(selectedProtocol);
        let totalDiasSoma = 0;
        let temAlgumDia = false;
        phases.forEach(p => {
          if (p.dias !== null && p.dias !== undefined) {
            totalDiasSoma += p.dias;
            temAlgumDia = true;
          }
        });

        return (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in"
              onClick={() => setSelectedProtocol(null)}
            />

            {/* Painel Lateral */}
            <div className="relative w-full max-w-lg bg-[#0F172A] border-l border-white/10 shadow-2xl h-full flex flex-col z-10 overflow-hidden animate-in slide-in-from-right duration-300">
              
              {/* Header do Drawer */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Protocolo <span className="text-blue-400">{protNum}</span>
                  </h2>
                  <p className="text-xs text-white/50 mt-0.5">Linha do Tempo e Detalhamento por Fase</p>
                </div>

                <button
                  onClick={() => setSelectedProtocol(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Conteúdo com Scroll */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                
                {/* Badges de Status & Atraso Sem Duplicidade */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div>
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Status do Pedido</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      isEntregueComAtraso
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        : isAtrasado
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {stStr}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Dias de Atraso</p>
                    <span className={`text-sm font-bold ${atrDias > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {atrDias > 0 ? `${atrDias}d` : '0d'}
                    </span>
                  </div>
                </div>

                {/* Alerta de Retrabalho */}
                {retrabalho > 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-3 text-yellow-300 text-xs font-medium">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-400" />
                    <div>
                      <p className="font-bold">Atenção: Retrabalho Registrado ({retrabalho})</p>
                      <p className="text-yellow-300/80 text-[11px] mt-0.5">
                        Este protocolo passou por {retrabalho} reanálise(s) de retrabalho.
                      </p>
                    </div>
                  </div>
                )}

                {/* Seção 1 - Datas das Fases */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" /> Seção 1 - Datas das Fases
                  </h3>
                  
                  <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5 text-xs">
                    {datesMap.map((d, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center">
                        <span className="text-white/60 font-mono">{d.label}:</span>
                        <span className={`font-medium ${d.val ? 'text-white' : 'text-white/30'}`}>
                          {formatDate(d.val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seção 2 - Quadro de Dias por Fase */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-400" /> Seção 2 - Quadro de Dias por Fase
                  </h3>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 text-xs">
                    {phases.map((phase, idx) => {
                      const hasDays = phase.dias !== null && phase.dias !== undefined;
                      const isGargalo = hasDays && phase.dias > 3;

                      return (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02]">
                          <span className="text-white/70 font-medium">{phase.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isGargalo ? "text-red-400" : hasDays ? "text-white" : "text-white/30"}`}>
                              {hasDays ? `${phase.dias}d` : "-"}
                            </span>
                          {isGargalo && (
                            <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold">
                              Gargalo
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* TOTAL */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between font-bold text-sm text-white">
                    <span className="text-purple-300">TOTAL DE DIAS NA ESTEIRA:</span>
                    <span className="text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-1 rounded-lg">
                      {temAlgumDia ? `${totalDiasSoma} dias` : '-'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer do Drawer */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-end">
              <button
                onClick={() => setSelectedProtocol(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </div>
  );
}

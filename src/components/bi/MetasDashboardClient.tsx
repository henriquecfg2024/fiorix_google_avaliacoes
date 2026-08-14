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
  X, AlertTriangle, Calendar, Activity, ArrowUpDown, ArrowUp, ArrowDown
} from "lucide-react";

type SortField = 
  | "protocolo" 
  | "natureza"
  | "status" 
  | "atraso" 
  | "d1Protocolo" 
  | "d3Extrato" 
  | "d4Qualificacao" 
  | "d5Calculo" 
  | "d8Impressao" 
  | "d10Entrega" 
  | "gargalo";

type SortOrder = "asc" | "desc";

type MetasData = {
  protocolo: number;
  natureza?: string;
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
  const [sortField, setSortField] = useState<SortField>("protocolo");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

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

  // Reset page when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, gargaloFilter, itemsPerPage, sortField, sortOrder]);

  // Helper universal para pegar valor ignorando casing e aliases
  const getVal = (record: any, ...keys: string[]) => {
    if (!record) return null;
    for (const k of keys) {
      if (record[k] !== undefined && record[k] !== null) return record[k];
    }
    return null;
  };

  const getDateKey = (value: unknown) => {
    if (!value) return null;
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const brDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
  };

  // Lógica principal de recalcular Status e Atraso zerando horas (Regra estrita)
  const getMetasStatusAndAtraso = (record: MetasData) => {
    const d10 = getVal(record, "d10Entrega", "D10_ENTREGA", "D10_ENT", "dtEntregaReal", "DT_ENTREGA_REAL");
    const dtPrev = getVal(record, "dtPrevisao", "DT_PREVISAO");
    const dataApres = getVal(record, "dataApresentado", "DATA_APRESENTADO");
    const d1Protocolo = getVal(record, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

    // 1. Protocolos apresentados hoje nunca podem ser Atrasados -> Sempre Em dia 0d
    if ([dataApres, d1Protocolo].some((value) => getDateKey(value) === hojeKey)) {
      try {
        return {
          status: "Em dia",
          atrasoDias: 0,
          badge: { text: "Em dia", bgClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" }
        };
      } catch {}
    }

    // 2. Se D10_ENTREGA (ou entrega real) já existe
    if (d10 && dtPrev) {
      try {
        const d10Date = new Date(d10);
        const prevDate = new Date(dtPrev);
        if (!isNaN(d10Date.getTime()) && !isNaN(prevDate.getTime())) {
          d10Date.setHours(0, 0, 0, 0);
          prevDate.setHours(0, 0, 0, 0);

          const diffEnt = Math.floor((d10Date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffEnt <= 0) {
            return {
              status: "Em dia",
              atrasoDias: 0,
              badge: { text: "Em dia", bgClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" }
            };
          } else {
            return {
              status: "Entregue com Atraso",
              atrasoDias: diffEnt,
              badge: { text: "Entregue com Atraso", bgClass: "bg-orange-500/20 text-orange-400 border border-orange-500/30" }
            };
          }
        }
      } catch {}
    }

    // 3. Protocolos abertos (sem D10_ENTREGA): calcula diffDias = hoje - previsao (zerando horas)
    if (dtPrev) {
      try {
        const prevDate = new Date(dtPrev);
        if (!isNaN(prevDate.getTime())) {
          prevDate.setHours(0, 0, 0, 0);

          const diffDias = Math.floor((hoje.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDias <= 0) {
            return {
              status: "Em dia",
              atrasoDias: 0,
              badge: { text: "Em dia", bgClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" }
            };
          } else {
            return {
              status: "Atrasado",
              atrasoDias: diffDias,
              badge: { text: "Atrasado", bgClass: "bg-red-500/20 text-red-400 border border-red-500/30" }
            };
          }
        }
      } catch {}
    }

    return {
      status: "Em dia",
      atrasoDias: 0,
      badge: { text: "Em dia", bgClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" }
    };
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

  // Safe diff calculation in days (com Math.max(0, ...) para evitar dias negativos por datas invertidas)
  const calculateDaysBetween = (startVal: any, endVal: any, givenDaysVal: any, isLastActivePhase: boolean = false) => {
    if (givenDaysVal !== null && givenDaysVal !== undefined) {
      return Math.max(0, Number(givenDaysVal));
    }
    if (!startVal) return null;
    
    try {
      const dStart = new Date(startVal).getTime();
      if (isNaN(dStart)) return null;

      if (endVal) {
        const dEnd = new Date(endVal).getTime();
        if (isNaN(dEnd)) return null;
        return Math.max(0, Math.floor((dEnd - dStart) / (1000 * 60 * 60 * 24)));
      }

      if (isLastActivePhase) {
        const now = new Date().getTime();
        return Math.max(0, Math.floor((now - dStart) / (1000 * 60 * 60 * 24)));
      }

      return null;
    } catch {
      return null;
    }
  };

  // Determine all 9 phase transitions & bottleneck for a given record
  const getPhasesForRecord = (record: MetasData) => {
    const d1 = getVal(record, "d1Protocolo", "D1_PROTOCOLO", "D1_PROT");
    const d1E = getVal(record, "d1Escaneamento", "D1_ESCANEAMENTO", "D1_ESCAN");
    const d2 = getVal(record, "d2Contraditorio", "D2_CONTRADITORIO", "D2_CONTRAD");
    const d3 = getVal(record, "d3Extrato", "D3_EXTRATO", "D3_EXTR");
    const d4 = getVal(record, "d4Qualificacao", "D4_QUALIFICACAO", "D4_QUALI");
    const d5 = getVal(record, "d5Calculo", "D5_CALCULO", "D5_CALC");
    const d8 = getVal(record, "d8Impressao", "D8_IMPRESSAO", "D8_IMP");
    const d9 = getVal(record, "d9Preparacao", "D9_PREPARACAO", "D9_PREP");
    const d9C = getVal(record, "d9Conferencia", "D9_CONFERENCIA", "D9_CONF");
    const d10 = getVal(record, "d10Entrega", "D10_ENTREGA", "D10_ENT");

    const isP1Active = Boolean(d1 && !d1E);
    const isP2Active = Boolean(d1E && !d2);
    const isP3Active = Boolean(d2 && !d3);
    const isP4Active = Boolean(d3 && !d4);
    const isP5Active = Boolean(d4 && !d5);
    const isP6Active = Boolean(d5 && !d8);
    const isP7Active = Boolean(d8 && !d9);
    const isP8Active = Boolean(d9 && !d9C);
    const isP9Active = Boolean(d9C && !d10);

    const phases = [
      { key: "D1_D1E", label: "Prot. -> Escan.", name: "PROTOCOLO -> ESCANEAMENTO", dias: calculateDaysBetween(d1, d1E, getVal(record, "diasD1D1E", "DIAS_D1_D1ESCAN"), isP1Active) },
      { key: "D1E_D2", label: "Escan. -> Contrad.", name: "ESCANEAMENTO -> CONTRADITORIO", dias: calculateDaysBetween(d1E, d2, getVal(record, "diasD1ED2", "DIAS_D1ESCAN_D2"), isP2Active) },
      { key: "D2_D3", label: "Contrad. -> Extr.", name: "CONTRADITORIO -> EXTRATO", dias: calculateDaysBetween(d2, d3, getVal(record, "diasD2D3", "DIAS_D2_D3"), isP3Active) },
      { key: "D3_D4", label: "Extr. -> Qualif.", name: "EXTRATO -> QUALIFICACAO", dias: calculateDaysBetween(d3, d4, getVal(record, "diasD3D4", "DIAS_D3_D4"), isP4Active) },
      { key: "D4_D5", label: "Qualif. -> Calc.", name: "QUALIFICACAO -> CALCULO", dias: calculateDaysBetween(d4, d5, getVal(record, "diasD4D5", "DIAS_D4_D5"), isP5Active) },
      { key: "D5_D8", label: "Calc. -> Impres.", name: "CALCULO -> IMPRESSAO", dias: calculateDaysBetween(d5, d8, getVal(record, "diasD5D8", "DIAS_D5_D8"), isP6Active) },
      { key: "D8_D9", label: "Impres. -> Prep.", name: "IMPRESSAO -> PREPARACAO", dias: calculateDaysBetween(d8, d9, getVal(record, "diasD8D9", "DIAS_D8_D9"), isP7Active) },
      { key: "D9_D9C", label: "Prep. -> Conf.", name: "PREPARACAO -> CONFERENCIA", dias: calculateDaysBetween(d9, d9C, getVal(record, "diasD9D9C", "DIAS_D9PREP_D9CONF"), isP8Active) },
      { key: "D9C_D10", label: "Conf. -> Entrega", name: "CONFERENCIA -> ENTREGA", dias: calculateDaysBetween(d9C, d10, getVal(record, "diasD9CD10", "DIAS_D9CONF_D10"), isP9Active) },
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

  // Calculate chart data & KPIs considerando as 9 transições completas
  const { chartData, kpis, statuses, gargaloTypes } = useMemo(() => {
    if (data.length === 0) return { chartData: [], kpis: null, statuses: [], gargaloTypes: [] };

    let atrasados = 0;
    let entregueComAtraso = 0;
    
    const phaseSums: Record<string, { sum: number; count: number }> = {
      D1_D1E: { sum: 0, count: 0 },
      D1E_D2: { sum: 0, count: 0 },
      D2_D3: { sum: 0, count: 0 },
      D3_D4: { sum: 0, count: 0 },
      D4_D5: { sum: 0, count: 0 },
      D5_D8: { sum: 0, count: 0 },
      D8_D9: { sum: 0, count: 0 },
      D9_D9C: { sum: 0, count: 0 },
      D9C_D10: { sum: 0, count: 0 },
    };

    const statusSet = new Set<string>();
    const gargaloSet = new Set<string>();
    const gargaloCounts: Record<string, number> = {};

    data.forEach(item => {
      const { status, atrasoDias, badge } = getMetasStatusAndAtraso(item);
      statusSet.add(badge.text);

      if (status === "Atrasado") {
        atrasados++;
      } else if (status === "Entregue com Atraso") {
        entregueComAtraso++;
      }

      const { phases, topGargalo } = getPhasesForRecord(item);
      gargaloSet.add(topGargalo.name);
      gargaloCounts[topGargalo.name] = (gargaloCounts[topGargalo.name] || 0) + 1;

      phases.forEach(p => {
        if (p.dias !== null && p.dias !== undefined) {
          if (phaseSums[p.key]) {
            phaseSums[p.key].sum += Math.max(0, p.dias);
            phaseSums[p.key].count++;
          }
        }
      });
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
      { name: "D1->D1E", fullName: "Prot.->Escan.", label: "Protocolo -> Escaneamento", key: "D1_D1E" },
      { name: "D1E->D2", fullName: "Escan.->Contrad.", label: "Escaneamento -> Contraditório", key: "D1E_D2" },
      { name: "D2->D3", fullName: "Contrad.->Extr.", label: "Contraditório -> Extrato", key: "D2_D3" },
      { name: "D3->D4", fullName: "Extr.->Qualif.", label: "Extrato -> Qualificação", key: "D3_D4" },
      { name: "D4->D5", fullName: "Qualif.->Calc.", label: "Qualificação -> Cálculo", key: "D4_D5" },
      { name: "D5->D8", fullName: "Calc.->Impres.", label: "Cálculo -> Impressão", key: "D5_D8" },
      { name: "D8->D9", fullName: "Impres.->Prep.", label: "Impressão -> Preparação", key: "D8_D9" },
      { name: "D9->D9C", fullName: "Prep.->Conf.", label: "Preparação -> Conferência", key: "D9_D9C" },
      { name: "D9C->D10", fullName: "Conf.->Entrega", label: "Conferência -> Entrega", key: "D9C_D10" },
    ].map(d => {
      const stats = phaseSums[d.key];
      const avg = stats.count > 0 ? stats.sum / stats.count : 0;
      return {
        ...d,
        dias: Math.round(Math.max(0, avg)),
        count: stats.count
      };
    });

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

  // Filtering & Sorting
  const filteredData = useMemo(() => {
    const filtered = data.filter(item => {
      const prot = String(getVal(item, "protocolo", "PROTOCOLO") || "");
      const nat = String(getVal(item, "natureza", "NATUREZA") || "").toLowerCase();
      const { badge } = getMetasStatusAndAtraso(item);
      
      const searchLower = search.toLowerCase();
      const matchSearch = search ? (prot.includes(search) || nat.includes(searchLower)) : true;
      const matchStatus = statusFilter !== "ALL" ? badge.text === statusFilter : true;
      const matchGargalo = gargaloFilter !== "ALL" ? getGargaloForRecord(item).name === gargaloFilter : true;
      
      return matchSearch && matchStatus && matchGargalo;
    });

    return [...filtered].sort((a, b) => {
      let valA: any = null;
      let valB: any = null;

      switch (sortField) {
        case "protocolo":
          valA = Number(getVal(a, "protocolo", "PROTOCOLO")) || 0;
          valB = Number(getVal(b, "protocolo", "PROTOCOLO")) || 0;
          break;
        case "natureza":
          valA = getVal(a, "natureza", "NATUREZA") || "";
          valB = getVal(b, "natureza", "NATUREZA") || "";
          break;
        case "atraso":
          valA = getMetasStatusAndAtraso(a).atrasoDias;
          valB = getMetasStatusAndAtraso(b).atrasoDias;
          break;
        case "status":
          valA = getMetasStatusAndAtraso(a).badge.text;
          valB = getMetasStatusAndAtraso(b).badge.text;
          break;
        case "gargalo":
          valA = getGargaloForRecord(a).name;
          valB = getGargaloForRecord(b).name;
          break;
        case "d1Protocolo":
          valA = getVal(a, "d1Protocolo", "D1_PROTOCOLO", "DATA_APRESENTADO");
          valB = getVal(b, "d1Protocolo", "D1_PROTOCOLO", "DATA_APRESENTADO");
          break;
        case "d3Extrato":
          valA = getVal(a, "d3Extrato", "D3_EXTRATO");
          valB = getVal(b, "d3Extrato", "D3_EXTRATO");
          break;
        case "d4Qualificacao":
          valA = getVal(a, "d4Qualificacao", "D4_QUALIFICACAO");
          valB = getVal(b, "d4Qualificacao", "D4_QUALIFICACAO");
          break;
        case "d5Calculo":
          valA = getVal(a, "d5Calculo", "D5_CALCULO");
          valB = getVal(b, "d5Calculo", "D5_CALCULO");
          break;
        case "d8Impressao":
          valA = getVal(a, "d8Impressao", "D8_IMPRESSAO");
          valB = getVal(b, "d8Impressao", "D8_IMPRESSAO");
          break;
        case "d10Entrega":
          valA = getVal(a, "d10Entrega", "D10_ENTREGA");
          valB = getVal(b, "d10Entrega", "D10_ENTREGA");
          break;
        default:
          valA = getVal(a, sortField);
          valB = getVal(b, sortField);
      }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === "") return 1;
      if (valB === null || valB === undefined || valB === "") return -1;

      let res = 0;
      if (typeof valA === "number" && typeof valB === "number") {
        res = valA - valB;
      } else {
        res = String(valA).localeCompare(String(valB), "pt-BR", { numeric: true });
      }

      return sortOrder === "asc" ? res : -res;
    });
  }, [data, search, statusFilter, gargaloFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "atraso" || field === "protocolo" || field.startsWith("d") ? "desc" : "asc");
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-white/30 group-hover:text-white/70 transition-colors inline ml-1" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-purple-400 inline ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 text-purple-400 inline ml-1" />
    );
  };

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
      "PROTOCOLO", "NATUREZA", "STATUS", "ATRASO_DIAS", "DATA_APRESENTADO", "DT_PREVISAO", 
      "DT_ENTREGA_REAL", "D1_PROTOCOLO", "D3_EXTRATO", "D4_QUALIFICACAO", 
      "D5_CALCULO", "D8_IMPRESSAO", "D10_ENTREGA", "GARGALO", "DIAS_GARGALO"
    ];

    const rows = exportList.map(item => {
      const g = getGargaloForRecord(item);
      const prot = getVal(item, "protocolo", "PROTOCOLO");
      const nat = getVal(item, "natureza", "NATUREZA") || "";
      const { status, atrasoDias } = getMetasStatusAndAtraso(item);

      return [
        prot,
        `"${String(nat).replace(/"/g, '""')}"`,
        `"${status.replace(/"/g, '""')}"`,
        atrasoDias || 0,
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

      {/* Gráfico de Média de Dias por Fase (9 Transições) */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
          Média de Dias por Fase 
          <span className="text-xs font-normal text-white/50 bg-white/10 px-2 py-0.5 rounded-md">
            9 Transições de Esteira
          </span>
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="fullName" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => String(Math.round(val))} />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const dataPoint = payload[0].payload;
                    return (
                      <div className="bg-[#1E293B] border border-white/10 rounded-xl p-3 shadow-2xl text-xs space-y-1 text-white">
                        <p className="font-bold text-blue-400">{dataPoint.label}</p>
                        <p className="text-white/80">
                          {dataPoint.name}: média <span className="font-bold text-white">{Math.round(dataPoint.dias)} dias</span> |{" "}
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
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.dias > 3 ? '#ef4444' : entry.dias >= 1 ? '#f59e0b' : '#3b82f6'} 
                  />
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

            {/* Ordenação */}
            <div className="flex items-center gap-2 bg-[#0F172A] border border-white/10 rounded-lg px-3 py-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-purple-400" />
              <select 
                className="bg-transparent text-sm text-white focus:outline-none appearance-none pr-4 max-w-[170px] truncate"
                value={`${sortField}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split("-") as [SortField, SortOrder];
                  setSortField(field);
                  setSortOrder(order);
                }}
              >
                <option value="protocolo-desc">Protocolo (Decrescente)</option>
                <option value="protocolo-asc">Protocolo (Crescente)</option>
                <option value="natureza-asc">Natureza (A-Z)</option>
                <option value="natureza-desc">Natureza (Z-A)</option>
                <option value="atraso-desc">Maior Atraso</option>
                <option value="atraso-asc">Menor Atraso</option>
                <option value="d1Protocolo-desc">D1 Prot (Mais Recente)</option>
                <option value="d1Protocolo-asc">D1 Prot (Mais Antigo)</option>
                <option value="status-asc">Status (A-Z)</option>
                <option value="status-desc">Status (Z-A)</option>
                <option value="gargalo-asc">Gargalo (A-Z)</option>
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
            <thead className="text-xs text-white/60 bg-white/[0.03] uppercase select-none">
              <tr>
                <th 
                  onClick={() => handleSort("protocolo")}
                  className="px-4 py-3 font-semibold cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    Protocolo {renderSortIcon("protocolo")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("natureza")}
                  className="px-4 py-3 font-semibold cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    Natureza {renderSortIcon("natureza")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("status")}
                  className="px-4 py-3 font-semibold cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    Status {renderSortIcon("status")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("atraso")}
                  className="px-4 py-3 font-semibold cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    Atraso {renderSortIcon("atraso")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d1Protocolo")}
                  className="px-4 py-3 font-semibold text-center bg-white/[0.01] cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-1">
                    D1 Prot {renderSortIcon("d1Protocolo")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d3Extrato")}
                  className="px-4 py-3 font-semibold text-center bg-white/[0.01] cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-1">
                    D3 Extr {renderSortIcon("d3Extrato")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d4Qualificacao")}
                  className="px-4 py-3 font-semibold text-center bg-white/[0.01] cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-1">
                    D4 Quali {renderSortIcon("d4Qualificacao")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d5Calculo")}
                  className="px-4 py-3 font-semibold text-center bg-white/[0.01] cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-1">
                    D5 Calc {renderSortIcon("d5Calculo")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d8Impressao")}
                  className="px-4 py-3 font-semibold text-center bg-white/[0.01] cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-1">
                    D8 Imp {renderSortIcon("d8Impressao")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("d10Entrega")}
                  className="px-4 py-3 font-semibold text-center bg-white/[0.01] cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-1">
                    D10 Ent {renderSortIcon("d10Entrega")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("gargalo")}
                  className="px-4 py-3 font-semibold cursor-pointer hover:text-white hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    Gargalo {renderSortIcon("gargalo")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row) => {
                const prot = getVal(row, "protocolo", "PROTOCOLO");
                const natVal = getVal(row, "natureza", "NATUREZA", "TIPO_DETALHADO", "tipo_detalhado");
                const { atrasoDias, badge } = getMetasStatusAndAtraso(row);

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
                    <td className="px-4 py-3 text-xs text-white/80 max-w-[160px] truncate" title={natVal || "-"}>
                      {natVal || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${badge.bgClass}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className={`px-4 py-3 font-medium ${atrasoDias > 0 ? 'text-red-400' : 'text-white/50'}`}>
                      {atrasoDias > 0 ? `${atrasoDias}d` : '0d'}
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
        const { atrasoDias, badge } = getMetasStatusAndAtraso(selectedProtocol);
        const retrabalho = Number(getVal(selectedProtocol, "qtdRetrabalho", "QTD_RETRABALHO", "qtd_retrabalho") || 0);

        // Seção 1: Mapeamento de Datas das 10 Fases
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

        // Seção 2: Cálculo dos Dias pelas 9 Transições
        const { phases } = getPhasesForRecord(selectedProtocol);
        let totalDiasSoma = 0;
        let temAlgumDia = false;
        phases.forEach(p => {
          if (p.dias !== null && p.dias !== undefined) {
            totalDiasSoma += Math.max(0, p.dias);
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badge.bgClass}`}>
                      {badge.text}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Dias de Atraso</p>
                    <span className={`text-sm font-bold ${atrasoDias > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {atrasoDias > 0 ? `${atrasoDias}d` : '0d'}
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

                {/* Seção 1 - Datas das Fases (10 Fases) */}
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

                {/* Seção 2 - Quadro de Dias por Fase (9 Transições) */}
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
                          <span className="text-white/70 font-medium">{phase.label}</span>
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

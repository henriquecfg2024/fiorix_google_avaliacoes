"use client";

import { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import {
  Search,
  Download,
  FileText,
  AlertTriangle,
  RotateCcw,
  Copy,
  Printer,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/card";

// Mock data reflecting screenshot and requirements
const initialProtocolos: any[] = [];

const chartDataEmpty = [
  { name: "11/08", Correcoes: 0, Meta: 0 },
  { name: "12/08", Correcoes: 0, Meta: 0 },
  { name: "13/08", Correcoes: 0, Meta: 0 },
  { name: "14/08", Correcoes: 0, Meta: 0 },
  { name: "15/08", Correcoes: 0, Meta: 0 },
  { name: "16/08", Correcoes: 0, Meta: 0 },
  { name: "17/08", Correcoes: 0, Meta: 0 },
  { name: "18/08", Correcoes: 0, Meta: 0 },
];
const chartData = chartDataEmpty;

const initialHistoricoAuditorias: any[] = [];

const importacoesMock: any[] = [];

export function AuditoriaDashboardClient() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "pendencias" | "historico" | "importacoes">("dashboard");
  const [selectedProtocolos, setSelectedProtocolos] = useState<string[]>([]);
  const [protocolos, setProtocolos] = useState<any[]>([]);
  const [historicoAuditorias] = useState(initialHistoricoAuditorias);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter states
  const [filtroFalta, setFiltroFalta] = useState<string>("todos");
  const [filtroSetor, setFiltroSetor] = useState<string>("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");
  const [loading, setLoading] = useState(false);
  const [lastAuditAt, setLastAuditAt] = useState<string | null>(null);
  const [totalAuditados, setTotalAuditados] = useState<number>(0);

  // Calculated metrics from real data
  const metrics = useMemo(() => {
    if (protocolos.length === 0) {
      return { 
        avgDays: 0, 
        total76: 0,
        avgRegistrado: 0, 
        total75: 0,
        avgDevolvido: 0, 
        total48: 0,
        avg48: 0,
        totalPulos: 0,
        riskLevel: "NENHUM", 
        riskColor: "emerald" 
      };
    }

    const registrado = protocolos.filter((p) => p.falta === 76);
    const devolvido = protocolos.filter((p) => p.falta === 75);
    const retirada30d = protocolos.filter((p) => p.falta === 48);
    const pulos = protocolos.filter((p) => [131, 86, 63].includes(p.falta));

    const avg = (arr: any[]) => arr.length > 0 ? Math.round((arr.reduce((s, p) => s + p.dias, 0) / arr.length) * 10) / 10 : 0;

    const avgDays = avg(protocolos);
    const avgRegistrado = avg(registrado);
    const avgDevolvido = avg(devolvido);
    const avg48 = avg(retirada30d);

    let riskLevel = "BAIXO";
    let riskColor = "emerald";
    if (protocolos.length > 200 || avgDays > 30) { riskLevel = "ALTO"; riskColor = "red"; }
    else if (protocolos.length > 100 || avgDays > 15) { riskLevel = "MODERADO"; riskColor = "amber"; }

    return { 
      avgDays, 
      total76: registrado.length,
      avgRegistrado, 
      total75: devolvido.length,
      avgDevolvido, 
      total48: retirada30d.length,
      avg48,
      totalPulos: pulos.length,
      riskLevel, 
      riskColor 
    };
  }, [protocolos]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/fiorix/auditoria");
      const json = await res.json();
      if (json.success && Array.isArray(json.protocolos)) {
        setProtocolos(json.protocolos);
        setTotalAuditados(Number(json.totalAuditados) || json.protocolos.length);
        setLastAuditAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
        if (!silent) {
          toast.success("Auditoria recalculada!", {
            description: `${json.protocolos.length} pendências reais encontradas.`
          });
        }
      } else {
        setProtocolos([]);
        setTotalAuditados(0);
      }
    } catch {
      if (!silent) toast.error("Falha ao carregar auditoria.");
      setProtocolos([]);
      setTotalAuditados(0);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);
  }, []);

  const [sortField, setSortField] = useState<string>("protocolo");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroFalta, filtroSetor, filtroResponsavel, searchTerm]);

  // Dynamic falta list
  const faltaList = useMemo(() => {
    const map = new Map<number, string>();
    protocolos.forEach((p) => {
      if (p.falta && p.faltaDescricao) {
        map.set(p.falta, p.faltaDescricao);
      }
    });
    return Array.from(map.entries()).map(([codigo, descricao]) => ({ codigo: String(codigo), descricao }));
  }, [protocolos]);

  // Dynamic sectors list
  const setoresList = useMemo(() => {
    const list = new Set<string>();
    protocolos.forEach((p) => {
      if (p.setor) list.add(p.setor);
    });
    return Array.from(list).sort();
  }, [protocolos]);

  // Dynamic responsibles list
  const responsaveisList = useMemo(() => {
    const list = new Set(protocolos.map((p) => p.responsavel));
    return Array.from(list);
  }, [protocolos]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProtocolos(sortedAndFilteredProtocolos.map((p) => p.id));
    } else {
      setSelectedProtocolos([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedProtocolos((prev) => [...prev, id]);
    } else {
      setSelectedProtocolos((prev) => prev.filter((item) => item !== id));
    }
  };

  const sortedProtocolos = useMemo(() => {
    return protocolos.filter((p) => {
      const matchesSearch = p.id.includes(searchTerm) || p.cliente.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFalta = filtroFalta === "todos" ? true : String(p.falta) === filtroFalta;
      const matchesSetor = filtroSetor === "todos" ? true : p.setor === filtroSetor;
      const matchesResp = filtroResponsavel === "todos" ? true : p.responsavel === filtroResponsavel;

      return matchesSearch && matchesFalta && matchesSetor && matchesResp;
    });
  }, [protocolos, searchTerm, filtroFalta, filtroSetor, filtroResponsavel]);

  const sortedAndFilteredProtocolos = useMemo(() => {
    return [...sortedProtocolos].sort((a, b) => {
      let valA: string | number = a[sortField as keyof typeof a] as string | number;
      let valB: string | number = b[sortField as keyof typeof b] as string | number;

      if (sortField === "protocolo") {
        valA = Number(a.id);
        valB = Number(b.id);
      } else if (sortField === "dias") {
        valA = a.dias;
        valB = b.dias;
      } else if (sortField === "dataUltAndamento") {
        const parseDate = (dStr: string) => {
          const parts = dStr.split("/");
          return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
        };
        valA = parseDate(a.dataUltAndamento);
        valB = parseDate(b.dataUltAndamento);
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [sortedProtocolos, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedAndFilteredProtocolos.length / itemsPerPage) || 1;
  
  const paginatedProtocolos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFilteredProtocolos.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFilteredProtocolos, currentPage, itemsPerPage]);

  // Export CSV
  const handleExportCSV = () => {
    const targetList = selectedProtocolos.length > 0
      ? sortedAndFilteredProtocolos.filter((p) => selectedProtocolos.includes(p.id))
      : sortedAndFilteredProtocolos;

    if (targetList.length === 0) {
      toast.warning("Nenhum protocolo disponível para exportar.");
      return;
    }

    const headers = [
      "Protocolo",
      "Natureza",
      "Fase",
      "Andamento_Faltante_ID",
      "Andamento_Faltante_Nome",
      "Dias_Parado",
      "Setor",
      "Responsavel",
      "Data_Importacao",
      "Encaminhamento",
    ];

    const rows = targetList.map((p) => [
      p.id,
      p.cliente,
      p.fase,
      p.falta,
      p.faltaDescricao || (p.falta === 76 ? "BALCÃO REGISTRADO" : "BALCÃO DEVOLVIDO"),
      `${p.dias}d`,
      p.setor,
      p.responsavel,
      p.dataUltAndamento || "",
      "Regularizar andamento pendente",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `fiorix_auditoria_pendencias_${dateStr}_${filtroSetor}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Lista exportada com sucesso.");
  };

  // Copy List
  const handleCopyList = () => {
    const targetList = selectedProtocolos.length > 0
      ? sortedAndFilteredProtocolos.filter((p) => selectedProtocolos.includes(p.id))
      : sortedAndFilteredProtocolos;

    if (targetList.length === 0) {
      toast.warning("Nenhum protocolo disponível para copiar.");
      return;
    }

    const text = targetList
      .map((p) => `Protocolo: ${p.id} | Natureza: ${p.cliente} | Inconformidade: ${p.faltaDescricao || p.falta} | Setor: ${p.setor}`)
      .join("\n");

    navigator.clipboard.writeText(text);
    toast.success("Lista copiada para a área de transferência.");
  };

  // Open Relatorio PDF / Imprimir Relatório
  const handleOpenPrintPreview = () => {
    const targetList = selectedProtocolos.length > 0
      ? sortedAndFilteredProtocolos.filter((p) => selectedProtocolos.includes(p.id))
      : sortedAndFilteredProtocolos;

    if (targetList.length === 0) {
      toast.warning("Selecione ao menos um protocolo para imprimir.");
      return;
    }

    const idsStr = targetList.map((p) => p.id).join(",");
    window.open(`/api/fiorix/relatorio-pdf?protocolos=${idsStr}`, "_blank");
  };

  return (
    <div className="space-y-6 font-[Inter,system-ui,sans-serif] text-slate-900 dark:text-white">
      {/* Upper info / Header Meta */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-[24px] border border-white/20 bg-[#0B1020]/90 px-5 py-3.5 shadow-sm backdrop-blur-xl">
        <div className="text-slate-400 dark:text-white/60 text-xs flex flex-wrap items-center gap-3">
          <span>Última auditoria: {lastAuditAt ? `hoje ${lastAuditAt}` : "carregando..."}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20"></span>
          <span>{(totalAuditados || protocolos.length).toLocaleString("pt-BR")} títulos auditados</span>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20"></span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            Dados reais
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(false)}
            disabled={loading}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-400/20 bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition hover:brightness-105 disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Rodando..." : "Nova Auditoria"}</span>
          </button>
        </div>
      </div>

      {/* Top Cards Grid — Padrão FIORIX */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Antes FIORIX */}
        <div className="group relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl transition-all hover:border-blue-400/50">
          <div className="flex items-start justify-between w-full">
            <span className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-white/80">
              Antes FIORIX
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-300">
                gargalo: {metrics.avgDays}d
              </span>
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/15 p-1.5 text-blue-400 transition-all group-hover:brightness-110">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {protocolos.length.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs font-medium text-slate-400 dark:text-white/50">títulos</span>
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-slate-500 dark:text-gray-300">
              {protocolos.length > 0 ? `${protocolos.length} pendentes` : "0 pendentes"}
            </p>
          </div>
        </div>

        {/* Card 2: Meta FIORIX */}
        <div className="group relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl transition-all hover:border-amber-400/50">
          <div className="flex items-start justify-between w-full">
            <span className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-white/80">
              Meta FIORIX
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                SLA: 48h
              </span>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-1.5 text-amber-400 transition-all group-hover:brightness-110">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-amber-400">
              Zerar {protocolos.length}
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-slate-500 dark:text-gray-300">
              Regularização contínua • Compliance
            </p>
          </div>
        </div>

        {/* Card 3: Realizado FIORIX */}
        <div className="group relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl transition-all hover:border-emerald-400/50">
          <div className="flex items-start justify-between w-full">
            <span className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-white/80">
              Realizado FIORIX
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                HOJE
              </span>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-1.5 text-emerald-400 transition-all group-hover:brightness-110">
                <RotateCcw className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#10B981]">
                {protocolos.length.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs font-medium text-slate-400 dark:text-white/50">pendências ativas</span>
            </div>
            <p className="text-xs sm:text-[13px] font-medium text-slate-500 dark:text-gray-300">
              Média de {metrics.avgDays}d por pendência
            </p>
          </div>
        </div>

        {/* Card 4: Risco Atual */}
        <div className="group relative flex min-h-[140px] flex-col justify-between overflow-hidden rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl transition-all hover:border-rose-400/50">
          <div className="flex items-start justify-between w-full">
            <span className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-white/80">
              Risco Atual
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                metrics.riskColor === "red" ? "border-rose-500/30 bg-rose-500/15 text-rose-300" :
                metrics.riskColor === "amber" ? "border-amber-500/30 bg-amber-500/15 text-amber-300" :
                "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
              }`}>
                {metrics.riskLevel} RISCO
              </span>
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-1.5 text-rose-400 transition-all group-hover:brightness-110">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {protocolos.length.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs font-medium text-slate-400 dark:text-white/50">pendências</span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-rose-300/90">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{protocolos.length > 0 ? `${protocolos.filter(p => p.dias > 30).length} com mais de 30 dias` : "Nenhum risco detectado"}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Selector — Padrão FIORIX */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-[20px] border border-white/20 bg-[#0B1020]/90 p-1.5 shadow-sm backdrop-blur-xl">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "dashboard"
              ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
              : "text-slate-400 dark:text-white/60 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          Dashboard Diário
        </button>
        <button
          onClick={() => setActiveTab("pendencias")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "pendencias"
              ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
              : "text-slate-400 dark:text-white/60 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <span>Pendências Inteligentes de Fluxo</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === "pendencias" ? "bg-slate-950/20 text-slate-950" : "bg-white/10 text-white"
          }`}>
            {protocolos.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "historico"
              ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
              : "text-slate-400 dark:text-white/60 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <span>Histórico de Auditorias</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === "historico" ? "bg-slate-950/20 text-slate-950" : "bg-white/10 text-white"
          }`}>
            {historicoAuditorias.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("importacoes")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "importacoes"
              ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-md shadow-amber-500/10"
              : "text-slate-400 dark:text-white/60 hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <span>Auditoria Importações</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            activeTab === "importacoes" ? "bg-slate-950/20 text-slate-950" : "bg-white/10 text-white"
          }`}>
            {protocolos.length}
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Card de Plano de Regularização — Padrão FIORIX */}
          <div className="space-y-4 rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl">
            <h4 className="flex items-center gap-2 text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-white/90">
              📋 Plano de Regularização
            </h4>
            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <div className="rounded-2xl border border-white/10 bg-[#080D1A] p-4 transition-all hover:border-white/20">
                <p className="font-bold text-white text-xs sm:text-[13px]">1. Priorizar</p>
                <p className="mt-1.5 text-slate-400 dark:text-white/70 leading-relaxed">
                  Atuar primeiro nos protocolos com maior tempo de permanência e impacto no prazo.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#080D1A] p-4 transition-all hover:border-white/20">
                <p className="font-bold text-white text-xs sm:text-[13px]">2. Regularizar</p>
                <p className="mt-1.5 text-slate-400 dark:text-white/70 leading-relaxed">
                  Confirmar os andamentos pendentes junto às equipes responsáveis.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#080D1A] p-4 transition-all hover:border-white/20">
                <p className="font-bold text-white text-xs sm:text-[13px]">3. Validar</p>
                <p className="mt-1.5 text-slate-400 dark:text-white/70 leading-relaxed">
                  Acompanhar a próxima auditoria até a redução dos itens pendentes.
                </p>
              </div>
            </div>
          </div>

          {/* Evolução Diária & Cards de Balcão — Padrão FIORIX */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl flex flex-col justify-between">
              <div>
                <h3 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-white/90 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_0_6px_rgba(16,185,129,0.08)]"></span>
                  Evolução diária das correções FIORIX
                </h3>
                <p className="mt-1 text-xs text-slate-400 dark:text-white/50">
                  Metas de andamento validadas pelo motor de compliance
                </p>
              </div>

              <div className="h-[220px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCorrecoes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="name" stroke="currentColor" className="text-slate-400 dark:text-white/40" fontSize={10} />
                    <YAxis stroke="currentColor" className="text-slate-400 dark:text-white/40" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: "#0B1020", borderColor: "rgba(255,255,255,0.15)", borderRadius: "14px", color: "#fff" }} />
                    <Area type="monotone" dataKey="Correcoes" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCorrecoes)" name="Auto-correções" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Resumo cards no dashboard */}
            <div className="space-y-4">
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl transition-all hover:border-amber-400/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-amber-400">
                    Sem Balcão Registrado
                  </h4>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                    {metrics.total76} Protocolos
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white">{metrics.avgRegistrado}d</span>
                  <p className="mt-1 text-xs sm:text-[13px] font-medium text-slate-400 dark:text-gray-300">
                    Média parado • Cód. 76 pendente
                  </p>
                </div>
              </div>
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl transition-all hover:border-purple-400/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-purple-400">
                    Sem Balcão Devolvido
                  </h4>
                  <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-bold text-purple-300">
                    {metrics.total75} Protocolos
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white">{metrics.avgDevolvido}d</span>
                  <p className="mt-1 text-xs sm:text-[13px] font-medium text-slate-400 dark:text-gray-300">
                    {metrics.total75 === 0 ? "Nenhum protocolo estagnado" : `Média parado • Cód. 75 pendente`}
                  </p>
                </div>
              </div>
              <div className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl transition-all hover:border-blue-400/50">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-blue-400">
                    Pulos de Fluxo
                  </h4>
                  <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-300">
                    {metrics.totalPulos} Protocolos
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white">{metrics.totalPulos}</span>
                  <p className="mt-1 text-xs sm:text-[13px] font-medium text-slate-400 dark:text-gray-300">
                    Qualificação / Scanner / Impressão
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "pendencias" && (
        <div className="space-y-4 overflow-hidden rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl">
          
          {/* A. FILTROS AVANÇADOS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl border border-white/10 bg-[#080D1A] p-4">
            {/* Filtro Inconformidade */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/50">Inconformidade</span>
              <select
                value={filtroFalta}
                onChange={(e) => setFiltroFalta(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0B1020] px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todos ({protocolos.length})</option>
                {faltaList.map((f) => {
                  const count = protocolos.filter((p) => String(p.falta) === f.codigo).length;
                  return (
                    <option key={f.codigo} value={f.codigo}>
                      {f.descricao} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Filtro Setor */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/50">Setor</span>
              <select
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0B1020] px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todos</option>
                {setoresList.map((s) => {
                  const count = protocolos.filter((p) => p.setor === s).length;
                  return (
                    <option key={s} value={s}>
                      {s} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Filtro Responsável */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/50">Responsável</span>
              <select
                value={filtroResponsavel}
                onChange={(e) => setFiltroResponsavel(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0B1020] px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todos</option>
                {responsaveisList.map((resp) => (
                  <option key={resp} value={resp}>
                    {resp}
                  </option>
                ))}
              </select>
            </div>

            {/* Busca Protocolo */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/50">Buscar por Texto</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar protocolo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0B1020] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* B. AÇÕES EM MASSA E TOP CONTROLS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <h3 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-white/90">
              Pendências Inteligentes de Fluxo
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleOpenPrintPreview}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.08]"
              >
                <Printer className="w-3.5 h-3.5" />
                🖨️ Imprimir Relatório
              </button>
              <button
                onClick={handleOpenPrintPreview}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.08]"
              >
                <FileText className="w-3.5 h-3.5 text-red-400" />
                📄 Exportar PDF por Setor
              </button>
              <button
                onClick={handleExportCSV}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.08]"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                📊 Exportar Lista
              </button>
              <button
                onClick={handleCopyList}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.08]"
              >
                <Copy className="w-3.5 h-3.5" />
                📋 Copiar Lista
              </button>
            </div>
          </div>

          {/* C. TABELA DE AUDITORIA */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#080D1A] text-slate-900 dark:text-white shadow-sm backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="select-none bg-slate-50 dark:bg-[#0B1020] text-xs uppercase tracking-wider text-slate-600 dark:text-white/60 border-b border-white/10">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProtocolos.length === sortedAndFilteredProtocolos.length && sortedAndFilteredProtocolos.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-slate-300 dark:border-white/20 bg-transparent text-amber-500 focus:ring-0"
                      />
                    </th>
                    {(() => {
                      const renderHeader = (field: string, label: string) => {
                        const isActive = sortField === field;
                        return (
                          <th
                            onClick={() => {
                              if (isActive) {
                                setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
                              } else {
                                setSortField(field);
                                setSortDirection("asc");
                              }
                            }}
                            className="cursor-pointer select-none p-4 hover:text-slate-900 dark:hover:text-white transition-colors"
                          >
                            <div className="flex items-center gap-1.5 font-semibold">
                              {label}
                              {isActive ? (
                                <span className="text-[9px] font-bold text-amber-400">{sortDirection === "asc" ? "▲" : "▼"}</span>
                              ) : (
                                <span className="opacity-20 text-[9px]">↕</span>
                              )}
                            </div>
                          </th>
                        );
                      };
                      return (
                        <>
                          {renderHeader("protocolo", "Protocolo")}
                          {renderHeader("cliente", "Natureza")}
                          {renderHeader("fase", "Fase")}
                          {renderHeader("falta", "Andamento Ausente")}
                          {renderHeader("dias", "Dias Parado")}
                          {renderHeader("setor", "Setor")}
                          {renderHeader("dataUltAndamento", "Data Últ. Andamento")}
                        </>
                      );
                    })()}
                    <th className="p-4 text-right font-semibold">Encaminhamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 bg-transparent">
                  {paginatedProtocolos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-xs text-slate-400 dark:text-white/30">
                        Nenhuma pendência encontrada.
                      </td>
                    </tr>
                  ) : (
                    paginatedProtocolos.map((p) => {
                      const isSelected = selectedProtocolos.includes(p.id);
                      return (
                        <tr key={p.id} className={`transition hover:bg-slate-50 dark:hover:bg-white/[0.03] text-slate-700 dark:text-white/80 ${isSelected ? "bg-amber-50 dark:bg-amber-500/[0.03]" : ""}`}>
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                              className="rounded border-slate-300 dark:border-white/20 bg-transparent text-amber-500 focus:ring-0"
                            />
                          </td>
                          <td className="p-4 font-bold text-slate-900 dark:text-white">
                            {p.id}
                            <span className="ml-2 rounded-md border border-slate-200 dark:border-white/8 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:text-white/72">
                              {p.badge}
                            </span>
                          </td>
                          <td className="p-4 text-slate-800 dark:text-white/80">{p.cliente}</td>
                          <td className="p-4 text-slate-600 dark:text-white/60">{p.fase}</td>
                          <td className="p-4">
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                              p.falta === 76 ? "border-amber-500/30 bg-amber-500/15 text-amber-300" :
                              p.falta === 75 ? "border-rose-500/30 bg-rose-500/15 text-rose-300" :
                              p.falta === 48 ? "border-purple-500/30 bg-purple-500/15 text-purple-300" :
                              "border-blue-500/30 bg-blue-500/15 text-blue-300"
                            }`}>
                              {p.faltaDescricao || (p.falta === 76 ? "Balcão registrado pendente" : "Balcão devolvido pendente")}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-amber-400">{p.dias}d</td>
                          <td className="p-4 text-slate-700 dark:text-white/70">
                            {p.setor}
                          </td>
                          <td className="p-4 text-slate-500 dark:text-white/55">{p.dataUltAndamento}</td>
                          <td className="p-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(p.id);
                                  toast.success(`Protocolo #${p.id} copiado!`, {
                                    description: "Use este número para localizar o protocolo na rotina interna."
                                  });
                                }}
                                className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-white/[0.08]"
                                title="Copiar número do protocolo"
                              >
                                📋 Copiar Protocolo
                              </button>
                              <span className="text-[9px] text-slate-400 dark:text-white/40">
                                Encaminhar para regularização do andamento pendente
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé com Barra de Paginação Completa */}
            <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 bg-slate-50/70 dark:bg-white/[0.02] px-6 py-3.5 sm:flex-row">
              {/* Informação de intervalo */}
              <div className="text-xs text-slate-600 dark:text-white/60 text-center sm:text-left">
                Exibindo <strong className="text-slate-900 dark:text-white">{sortedAndFilteredProtocolos.length > 0 ? (Math.min(sortedAndFilteredProtocolos.length, (currentPage - 1) * itemsPerPage + 1)).toLocaleString("pt-BR") : "0"}</strong> a{" "}
                <strong className="text-slate-900 dark:text-white">{Math.min(sortedAndFilteredProtocolos.length, currentPage * itemsPerPage).toLocaleString("pt-BR")}</strong> de{" "}
                <strong className="text-slate-900 dark:text-white">{sortedAndFilteredProtocolos.length.toLocaleString("pt-BR")}</strong> pendências
              </div>

              {/* Controles de Paginação & Itens Por Página */}
              <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
                {/* Seletor de Tamanho de Página */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-white/60">
                  <span>Exibir:</span>
                  <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
                    {[10, 20, 50, 100].map((size) => (
                      <button
                        key={size}
                        onClick={() => { setItemsPerPage(size); setCurrentPage(1); }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                          itemsPerPage === size
                            ? "bg-gradient-to-r from-amber-500 to-amber-400 font-bold text-slate-950 shadow-xs"
                            : "text-slate-400 dark:text-white/60 hover:text-white"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Navegação de Páginas */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage <= 1}
                    title="Primeira Página"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronsLeft size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
                    disabled={currentPage <= 1}
                    title="Página Anterior"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <span className="text-xs px-2 font-medium text-slate-800 dark:text-white min-w-[90px] text-center">
                    Página {currentPage.toLocaleString("pt-BR")} de {totalPages.toLocaleString("pt-BR")}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
                    disabled={currentPage >= totalPages}
                    title="Próxima Página"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    title="Última Página"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronsRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ABA HISTÓRICO DE AUDITORIAS */}
      {activeTab === "historico" && (
        <div className="space-y-4 overflow-hidden rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl">
          <div>
            <h3 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-white/90">
              Histórico de Auditorias
            </h3>
            <p className="text-xs text-slate-400 dark:text-white/50 mt-1">
              Histórico consolidado para acompanhamento da evolução das pendências
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/15 bg-[#080D1A]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 dark:text-white/60 font-bold bg-[#0B1020]">
                  <th className="p-4">Data/Hora Auditoria</th>
                  <th className="p-4">Total Auditado</th>
                  <th className="p-4">Pendências Encontradas</th>
                  <th className="p-4">Base auditada</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {historicoAuditorias.map((i) => (
                  <tr key={i.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-4 text-slate-400 dark:text-white/50">{i.data}</td>
                    <td className="p-4 text-white font-bold">{i.totalAuditado} títulos</td>
                    <td className="p-4 font-semibold text-amber-400">{i.pendencias}</td>
                    <td className="p-4 text-slate-300 dark:text-white/70 font-mono">{i.arquivo}</td>
                    <td className="p-4 text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          i.status === "Validado"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : i.status === "Regularizado"
                            ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                            : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. IMPORTAÇÕES TAB */}
      {activeTab === "importacoes" && (
        <div className="space-y-4 overflow-hidden rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl">
          <div>
            <h3 className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-700 dark:text-white/90">
              Histórico de Auditoria de Cargas
            </h3>
            <p className="text-xs text-slate-400 dark:text-white/50 mt-1">
              Conformidade e status das cargas de dados importadas para o módulo BI
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/15 bg-[#080D1A]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 dark:text-white/60 font-bold bg-[#0B1020]">
                  <th className="p-4">Data</th>
                  <th className="p-4">Arquivo</th>
                  <th className="p-4">Total Linhas</th>
                  <th className="p-4">Origem</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Anomalias/Erros</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {importacoesMock.map((i) => (
                  <tr key={i.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-4 text-slate-400 dark:text-white/50">{i.data}</td>
                    <td className="p-4 font-semibold text-white">{i.arquivo}</td>
                    <td className="p-4 text-slate-300 dark:text-white/80">{i.linhas.toLocaleString("pt-BR")}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 text-[9px] rounded-full font-bold ${
                          i.origem === "Inferido"
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {i.origem}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                          i.status === "SUCCESS"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
                    <td className="p-4 text-rose-300 max-w-[200px] truncate" title={i.erro}>
                      {i.erro || "Sem inconsistências"}
                    </td>
                    <td className="p-4 text-right">
                      {i.status === "FAILED" && (
                        <button
                          onClick={() => toast.info(`Reprocessando importação ${i.id}...`)}
                          className="px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 ml-auto"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reprocessar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

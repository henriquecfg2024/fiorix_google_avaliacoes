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
} from "lucide-react";
import { Card } from "@/components/ui/card";

// Mock data reflecting screenshot and requirements
const initialProtocolos = [
  { id: "642368", badge: "IP-248", cliente: "Instrumento Particular", fase: "Exame Formal", falta: 76, dias: 5, setor: "Conferência", responsavel: "Maria", dataUltAndamento: "13/08/2026" },
  { id: "642371", badge: "CA-251", cliente: "Construtora Aurora Ltda", fase: "Registro", falta: 76, dias: 12, setor: "Conferência", responsavel: "João", dataUltAndamento: "06/08/2026" },
  { id: "642389", badge: "SA-309", cliente: "Silva & Andrade Imóveis", fase: "Conferência", falta: 76, dias: 27, setor: "Conferência", responsavel: "Maria", dataUltAndamento: "22/07/2026" },
  { id: "642402", badge: "BR-402", cliente: "Banco Regional S/A", fase: "Prenotação", falta: 76, dias: 8, setor: "Conferência", responsavel: "Carlos", dataUltAndamento: "10/08/2026" },
  { id: "642415", badge: "MRV-415", cliente: "MRV Engenharia", fase: "Exigência", falta: 76, dias: 3, setor: "Balcão", responsavel: "Ana", dataUltAndamento: "15/08/2026" },
  { id: "642429", badge: "CY-429", cliente: "Cyrela Construtora", fase: "Análise", falta: 76, dias: 19, setor: "Conferência", responsavel: "Maria", dataUltAndamento: "30/07/2026" },
];

const chartData = [
  { name: "11/08", Correcoes: 42, Meta: 80 },
  { name: "12/08", Correcoes: 55, Meta: 80 },
  { name: "13/08", Correcoes: 98, Meta: 80 },
  { name: "14/08", Correcoes: 148, Meta: 80 },
  { name: "15/08", Correcoes: 135, Meta: 80 },
  { name: "16/08", Correcoes: 198, Meta: 80 },
  { name: "17/08", Correcoes: 245, Meta: 80 },
  { name: "18/08", Correcoes: 312, Meta: 80 },
];

const initialHistoricoAuditorias = [
  { id: "1", data: "18/08/2026 08:42", totalAuditado: "118.523", pendencias: "2 pendências", arquivo: "fiorix_bi_18_08.csv", status: "Pendente" },
  { id: "2", data: "17/08/2026 08:35", totalAuditado: "114.821", pendencias: "0 pendências", arquivo: "fiorix_bi_17_08.csv", status: "Validado" },
  { id: "3", data: "16/08/2026 09:12", totalAuditado: "114.821", pendencias: "6 pendências", arquivo: "fiorix_bi_16_08.csv", status: "Regularizado" },
];

const importacoesMock = [
  { id: "imp-1", data: "18/08/2026", arquivo: "Fiorix-Metas-18-08.csv", linhas: 15591, status: "SUCCESS", origem: "Original" },
  { id: "imp-2", data: "17/08/2026", arquivo: "Fiorix-Metas-17-08.csv", linhas: 14890, status: "SUCCESS", origem: "Original" },
  { id: "imp-3", data: "15/08/2026", arquivo: "Fiorix-Metas-12-08_17-08.csv", linhas: 4827, status: "FAILED", origem: "Inferido", erro: "Falha de codificação nas linhas 1240-1280" },
  { id: "imp-4", data: "14/08/2026", arquivo: "Fiorix-Metas-12-08_17-08.csv", linhas: 4827, status: "FAILED", origem: "Inferido", erro: "Conexão interrompida pelo gateway" },
  { id: "imp-5", data: "13/08/2026", arquivo: "Fiorix-Metas-12-08_17-08.csv", linhas: 4827, status: "SUCCESS", origem: "Inferido" },
];

export function AuditoriaDashboardClient() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "pendencias" | "historico" | "importacoes">("dashboard");
  const [selectedProtocolos, setSelectedProtocolos] = useState<string[]>([]);
  const [protocolos, setProtocolos] = useState(initialProtocolos);
  const [historicoAuditorias] = useState(initialHistoricoAuditorias);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter states
  const [filtroFalta, setFiltroFalta] = useState<"todos" | "76" | "75" | "tarefa" | "semRetirada">("todos");
  const [filtroSetor, setFiltroSetor] = useState<"todos" | "Balcão" | "Conferência" | "Qualificação" | "Registro">("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");
  const [loading, setLoading] = useState(false);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/fiorix/auditoria");
      const json = await res.json();
      if (json.success && json.protocolos) {
        setProtocolos(json.protocolos.length > 0 ? json.protocolos : initialProtocolos);
        if (!silent) {
          toast.success("Auditoria recalculada!", {
            description: `${json.protocolos.length} pendências reais encontradas.`
          });
        }
      }
    } catch {
      if (!silent) toast.error("Falha ao carregar auditoria.");
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
      
      let matchesFalta = true;
      if (filtroFalta === "76") matchesFalta = p.falta === 76;
      else if (filtroFalta === "75") matchesFalta = p.falta === 75;
      else if (filtroFalta === "tarefa") matchesFalta = false; // Mock filter behavior
      else if (filtroFalta === "semRetirada") matchesFalta = false; // Mock filter behavior

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
      "Cliente",
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
      p.falta === 76 ? "BALCÃO REGISTRADO" : "BALCÃO DEVOLVIDO",
      `${p.dias}d`,
      p.setor,
      p.responsavel,
      "18/08/2026",
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
      .map((p) => `Protocolo: ${p.id} | Cliente: ${p.cliente} | Falta ID: ${p.falta} | Setor: ${p.setor}`)
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
    <div className="space-y-6 font-[Inter,system-ui,sans-serif] text-white">
      {/* Upper info / Header Meta */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-[#0B1020]/72 px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <div className="text-white/60 text-xs flex flex-wrap items-center gap-3">
          <span> Última auditoria: hoje 08:42</span>
          <span className="w-1 h-1 rounded-full bg-white/22"></span>
          <span>118.523 títulos auditados</span>
          <span className="w-1 h-1 rounded-full bg-white/22"></span>
          <span className="rounded-full border border-emerald-500/18 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-300">
            98.4% precisão
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(false)}
            disabled={loading}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-400/20 bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:brightness-105 disabled:opacity-55"
          >
            {loading ? "🔄 Rodando..." : "🔄 Nova Auditoria"}
          </button>
        </div>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="rounded-2xl border border-white/8 bg-[#0B1020]/78 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] transition hover:border-white/12">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/48">Antes FIORIX</span>
            <span className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] font-bold text-white/80">gargalo: 77.1d</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">15.591</span>
            <span className="text-xs text-white/40">títulos</span>
          </div>
          <p className="text-xs text-white/60 mt-1">4.793 atrasados (30.7%)</p>
        </div>

        {/* Card 2 */}
        <div className="rounded-2xl border border-white/8 bg-[#0B1020]/78 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] transition hover:border-white/12">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/48">Meta FIORIX</span>
            <span className="rounded-full border border-indigo-400/20 bg-indigo-500/12 px-2 py-0.5 text-[10px] font-bold text-indigo-200">SLA: 48h</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-300">Zerar 280</span>
          </div>
          <p className="text-xs text-white/58 mt-1">Regularização em até 48h • Conferência</p>
        </div>

        {/* Card 3 */}
        <div className="rounded-2xl border border-white/8 bg-[#0B1020]/78 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] transition hover:border-white/12">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/48">Realizado FIORIX</span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-200">HOJE</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-300">0 / 1.240</span>
            <span className="text-xs text-white/40">mês</span>
          </div>
          <p className="text-xs text-white/58 mt-1">Taxa de sucesso 98.4% - Auto</p>
        </div>

        {/* Card 4 */}
        <div className="rounded-2xl border border-white/8 bg-[#0B1020]/78 p-5 shadow-[0_16px_50px_rgba(0,0,0,0.18)] transition hover:border-white/12">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/48">Risco Atual</span>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/12 px-2 py-0.5 text-[10px] font-bold text-amber-200">BAIXO RISCO</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">280</span>
            <span className="text-xs text-white/40">falsos atrasos</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-200/85">
            <AlertTriangle className="w-3.5 h-3.5" />
            Auditoria de listagem pronta
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-fit rounded-2xl border border-white/8 bg-[#0B1020]/72 p-1 shadow-[0_14px_36px_rgba(0,0,0,0.14)] backdrop-blur-xl">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "dashboard" ? "bg-gradient-to-r from-indigo-500 to-amber-400 text-white shadow-lg shadow-amber-500/10" : "text-white/60 hover:text-white"
          }`}
        >
          Dashboard Diário
        </button>
        <button
          onClick={() => setActiveTab("pendencias")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "pendencias" ? "bg-gradient-to-r from-indigo-500 to-amber-400 text-white shadow-lg shadow-amber-500/10" : "text-white/60 hover:text-white"
          }`}
        >
          Pendências Inteligentes de Fluxo
          <span className="rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px]">{protocolos.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "historico" ? "bg-gradient-to-r from-indigo-500 to-amber-400 text-white shadow-lg shadow-amber-500/10" : "text-white/60 hover:text-white"
          }`}
        >
          Histórico de Auditorias
          <span className="rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px]">{historicoAuditorias.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("importacoes")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "importacoes" ? "bg-gradient-to-r from-indigo-500 to-amber-400 text-white shadow-lg shadow-amber-500/10" : "text-white/60 hover:text-white"
          }`}
        >
          Auditoria Importações
          <span className="rounded-full border border-white/10 bg-white/10 px-1.5 py-0.5 text-[10px]">118.523</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Card de Fluxo Recomendado */}
          <Card className="space-y-3 rounded-2xl border border-white/8 bg-gradient-to-br from-[#0B1020]/90 via-[#0B1020]/72 to-[#11172A]/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              📋 Plano de Regularização
            </h4>
            <div className="grid gap-3 md:grid-cols-3 text-xs text-white/70">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <p className="font-bold text-white">1. Priorizar</p>
                <p className="mt-1">Atuar primeiro nos protocolos com maior tempo de permanência e impacto no prazo.</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <p className="font-bold text-white">2. Regularizar</p>
                <p className="mt-1">Confirmar os andamentos pendentes junto às equipes responsáveis.</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <p className="font-bold text-white">3. Validar</p>
                <p className="mt-1">Acompanhar a próxima auditoria até a redução dos itens pendentes.</p>
              </div>
            </div>
          </Card>

          {/* Evolução Diária */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_0_6px_rgba(16,185,129,0.08)]"></span>
                  Evolução diária das correções FIORIX
                </h3>
                <p className="mt-1 text-xs text-white/42">Metas de andamento validadas pelo motor de compliance</p>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <Tooltip contentStyle={{ background: "#0B1020", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px" }} />
                    <Area type="monotone" dataKey="Correcoes" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCorrecoes)" name="Auto-correções" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Resumo cards no dashboard */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">Sem Balcão Registrado</h4>
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/12 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                    {protocolos.filter((p) => p.falta === 76).length} Protocolos
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-[32px] font-black text-white">27.1d</span>
                  <p className="mt-1 text-xs text-white/52">Média parado • Setor Conferência</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">Sem Balcão Devolvido</h4>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-200">
                    {protocolos.filter((p) => p.falta === 75).length} Protocolos
                  </span>
                </div>
                <div className="mt-4">
                  <span className="text-[32px] font-black text-white">0.0d</span>
                  <p className="mt-1 text-xs text-white/52">Status: Fluxo normalizado</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "pendencias" && (
        <div className="space-y-4 overflow-hidden rounded-2xl border border-white/8 bg-[#0B1020]/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.16)]">
          
          {/* A. FILTROS AVANÇADOS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4">
            {/* Filtro Falta ID */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Inconformidade</span>
              <select
                value={filtroFalta}
                onChange={(e) => setFiltroFalta(e.target.value as typeof filtroFalta)}
                className="w-full rounded-lg border border-white/8 bg-[#0C1323] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todos</option>
                <option value="76">Balcão registrado pendente</option>
                <option value="75">Balcão devolvido pendente</option>
                <option value="tarefa">Falta TAREFA</option>
                <option value="semRetirada">Sem DtRetirada</option>
              </select>
            </div>

            {/* Filtro Setor */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Setor</span>
              <select
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value as typeof filtroSetor)}
                className="w-full rounded-lg border border-white/8 bg-[#0C1323] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todos</option>
                <option value="Balcão">Balcão</option>
                <option value="Conferência">Conferência</option>
                <option value="Qualificação">Qualificação</option>
                <option value="Registro">Registro</option>
              </select>
            </div>

            {/* Filtro Responsável */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Responsável</span>
              <select
                value={filtroResponsavel}
                onChange={(e) => setFiltroResponsavel(e.target.value)}
                className="w-full rounded-lg border border-white/8 bg-[#0C1323] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/42">Buscar por Texto</span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/38" />
                <input
                  type="text"
                  placeholder="Buscar protocolo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-white/8 bg-[#0C1323] py-1.5 pl-9 pr-3 text-xs text-white placeholder-white/28 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* B. AÇÕES EM MASSA E TOP CONTROLS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <h3 className="text-sm font-bold text-white/96">Pendências Inteligentes de Fluxo</h3>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleOpenPrintPreview}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/[0.08]"
              >
                <Printer className="w-3.5 h-3.5" />
                🖨️ Imprimir Relatório
              </button>
              <button
                onClick={handleOpenPrintPreview}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/[0.08]"
              >
                <FileText className="w-3.5 h-3.5 text-red-400" />
                📄 Exportar PDF por Setor
              </button>
              <button
                onClick={handleExportCSV}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/[0.08]"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                📊 Exportar Lista
              </button>
              <button
                onClick={handleCopyList}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-white/[0.08]"
              >
                <Copy className="w-3.5 h-3.5" />
                📋 Copiar Lista
              </button>
            </div>
          </div>

          {/* C. TABELA DE AUDITORIA */}
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0B1020]/72 text-white shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="select-none bg-[#0B1020] text-xs uppercase tracking-wider text-white/58 border-b border-white/8">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProtocolos.length === sortedAndFilteredProtocolos.length && sortedAndFilteredProtocolos.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-white/20 bg-transparent text-amber-400 focus:ring-0"
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
                            className="cursor-pointer select-none p-4 hover:text-white transition-colors"
                          >
                            <div className="flex items-center gap-1.5 font-semibold">
                              {label}
                              {isActive ? (
                                <span className="text-[9px] font-bold text-amber-300">{sortDirection === "asc" ? "▲" : "▼"}</span>
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
                          {renderHeader("cliente", "Cliente")}
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
                <tbody className="divide-y divide-white/5 bg-transparent">
                  {paginatedProtocolos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-xs text-white/30">
                        Nenhuma pendência encontrada.
                      </td>
                    </tr>
                  ) : (
                    paginatedProtocolos.map((p) => {
                      const isSelected = selectedProtocolos.includes(p.id);
                      return (
                        <tr key={p.id} className={`transition hover:bg-white/[0.03] text-white/80 ${isSelected ? "bg-amber-500/[0.03]" : ""}`}>
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                              className="rounded border-white/20 bg-transparent text-amber-400 focus:ring-0"
                            />
                          </td>
                          <td className="p-4 font-bold text-white">
                            {p.id}
                            <span className="ml-2 rounded-md border border-white/8 bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-white/72">
                              {p.badge}
                            </span>
                          </td>
                          <td className="p-4 text-white/80">{p.cliente}</td>
                          <td className="p-4 text-white/60">{p.fase}</td>
                          <td className="p-4">
                            {p.falta === 76 ? (
                              <span className="rounded-full border border-amber-500/20 bg-amber-500/12 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                                Balcão registrado pendente
                              </span>
                            ) : (
                              <span className="rounded-full border border-red-500/20 bg-red-500/12 px-2 py-0.5 text-[10px] font-bold text-red-200">
                                Balcão devolvido pendente
                              </span>
                            )}
                          </td>
                          <td className="p-4 font-semibold text-amber-200">{p.dias}d</td>
                          <td className="p-4 text-white/70">
                            {p.setor}
                          </td>
                          <td className="p-4 text-white/55">{p.dataUltAndamento}</td>
                          <td className="p-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(p.id);
                                  toast.success(`Protocolo #${p.id} copiado!`, {
                                    description: "Use este número para localizar o protocolo na rotina interna."
                                  });
                                }}
                                className="flex cursor-pointer items-center gap-1 rounded-md border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-white/[0.08]"
                                title="Copiar número do protocolo"
                              >
                                📋 Copiar Protocolo
                              </button>
                              <span className="text-[9px] text-white/42">
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
            <div className="flex flex-col items-center justify-between gap-4 border-t border-white/8 bg-white/[0.03] px-6 py-3.5 sm:flex-row">
              {/* Informação de intervalo */}
              <div className="text-xs text-white/60 text-center sm:text-left">
                Exibindo <strong className="text-white">{sortedAndFilteredProtocolos.length > 0 ? (Math.min(sortedAndFilteredProtocolos.length, (currentPage - 1) * itemsPerPage + 1)).toLocaleString("pt-BR") : "0"}</strong> a{" "}
                <strong className="text-white">{Math.min(sortedAndFilteredProtocolos.length, currentPage * itemsPerPage).toLocaleString("pt-BR")}</strong> de{" "}
                <strong className="text-white">{sortedAndFilteredProtocolos.length.toLocaleString("pt-BR")}</strong> pendências
              </div>

              {/* Controles de Paginação & Itens Por Página */}
              <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
                {/* Seletor de Tamanho de Página */}
                <div className="flex items-center gap-1.5 text-xs text-white/60">
                  <span>Exibir:</span>
                  <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
                    {[10, 20, 50, 100].map((size) => (
                      <button
                        key={size}
                        onClick={() => { setItemsPerPage(size); setCurrentPage(1); }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                          itemsPerPage === size
                            ? "bg-gradient-to-r from-indigo-500 to-amber-400 font-semibold text-white shadow-xs"
                            : "text-white/60 hover:text-white"
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
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronsLeft size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((c) => Math.max(1, c - 1))}
                    disabled={currentPage <= 1}
                    title="Página Anterior"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <span className="text-xs px-2 font-medium text-white min-w-[90px] text-center">
                    Página {currentPage.toLocaleString("pt-BR")} de {totalPages.toLocaleString("pt-BR")}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((c) => Math.min(totalPages, c + 1))}
                    disabled={currentPage >= totalPages}
                    title="Próxima Página"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    title="Última Página"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
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
        <div className="bg-[#0F172A]/50 border border-white/10 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Histórico de Auditorias</h3>
            <p className="text-xs text-white/40 mt-1">
              Histórico consolidado para acompanhamento da evolução das pendências
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/50 font-bold bg-white/[0.01]">
                  <th className="p-4">Data/Hora Auditoria</th>
                  <th className="p-4">Total Auditado</th>
                  <th className="p-4">Pendências Encontradas</th>
                  <th className="p-4">Base auditada</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {historicoAuditorias.map((i) => (
                  <tr key={i.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-4 text-white/50">{i.data}</td>
                    <td className="p-4 text-white font-bold">{i.totalAuditado} títulos</td>
                    <td className="p-4 font-semibold text-amber-400">{i.pendencias}</td>
                    <td className="p-4 text-white/60 font-mono">{i.arquivo}</td>
                    <td className="p-4 text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          i.status === "Validado"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : i.status === "Regularizado"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
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
        <div className="bg-[#0F172A]/50 border border-white/10 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Histórico de Auditoria de Cargas</h3>
            <p className="text-xs text-white/40 mt-1">
              Conformidade e status das cargas de dados importadas para o módulo BI
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/50 font-bold bg-white/[0.01]">
                  <th className="p-4">Data</th>
                  <th className="p-4">Arquivo</th>
                  <th className="p-4">Total Linhas</th>
                  <th className="p-4">Origem</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Anomalias/Erros</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {importacoesMock.map((i) => (
                  <tr key={i.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-4 text-white/50">{i.data}</td>
                    <td className="p-4 font-semibold text-white">{i.arquivo}</td>
                    <td className="p-4 text-white/80">{i.linhas.toLocaleString("pt-BR")}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 text-[9px] rounded font-bold ${
                          i.origem === "Inferido"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        {i.origem}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                          i.status === "SUCCESS"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/15"
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
                    <td className="p-4 text-rose-300/80 max-w-[200px] truncate" title={i.erro}>
                      {i.erro || "Sem inconsistências"}
                    </td>
                    <td className="p-4 text-right">
                      {i.status === "FAILED" && (
                        <button
                          onClick={() => toast.info(`Reprocessando importação ${i.id}...`)}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-md text-[10px] font-bold transition flex items-center gap-1.5 ml-auto"
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

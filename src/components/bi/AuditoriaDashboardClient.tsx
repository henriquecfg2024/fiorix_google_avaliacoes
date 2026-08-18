"use client";

import { useState, useMemo } from "react";
import { CorrecaoModal } from "@/components/auditoria/CorrecaoModal";
import { CorrecaoLoteModal } from "@/components/auditoria/CorrecaoLoteModal";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Send,
  Wrench,
  CheckCircle,
  AlertTriangle,
  Play,
  RotateCcw,
} from "lucide-react";

// Mock data reflecting screenshot and requirements
const initialProtocolos = [
  { id: "642368", badge: "IP-248", cliente: "Instrumento Particular", fase: "Exame Formal", falta: 76, dias: 5, setor: "Conferência", responsavel: "Maria" },
  { id: "642371", badge: "CA-251", cliente: "Construtora Aurora Ltda", fase: "Registro", falta: 76, dias: 12, setor: "Conferência", responsavel: "João" },
  { id: "642389", badge: "SA-309", cliente: "Silva & Andrade Imóveis", fase: "Conferência", falta: 76, dias: 27, setor: "Conferência", responsavel: "Maria" },
  { id: "642402", badge: "BR-402", cliente: "Banco Regional S/A", fase: "Prenotação", falta: 76, dias: 8, setor: "Conferência", responsavel: "Carlos" },
  { id: "642415", badge: "MRV-415", cliente: "MRV Engenharia", fase: "Exigência", falta: 76, dias: 3, setor: "Balcão", responsavel: "Ana" },
  { id: "642429", badge: "CY-429", cliente: "Cyrela Construtora", fase: "Análise", falta: 76, dias: 19, setor: "Conferência", responsavel: "Maria" },
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

const initialIntervencoes = [
  { id: "1", data: "18/08/2026 10:15", protocolo: 642301, tipo: "Auto-correção ID 76", de: "Pendente", para: "Balcão Registrado", motivo: "Detectada inconsistência de fluxo", risco: "Nenhum", usuario: "FIORIX.CORRETOR", aprovado: "Sistema" },
  { id: "2", data: "18/08/2026 09:40", protocolo: 642305, tipo: "Inserção ID 76", de: "Ausente", para: "Balcão Registrado", motivo: "Manual via painel de compliance", risco: "Baixo", usuario: "FIORIX.CORRETOR", aprovado: "Henrique Master" },
];

const importacoesMock = [
  { id: "imp-1", data: "18/08/2026", arquivo: "Fiorix-Metas-18-08.csv", linhas: 15591, status: "SUCCESS", origem: "Original" },
  { id: "imp-2", data: "17/08/2026", arquivo: "Fiorix-Metas-17-08.csv", linhas: 14890, status: "SUCCESS", origem: "Original" },
  { id: "imp-3", data: "15/08/2026", arquivo: "Fiorix-Metas-12-08_17-08.csv", linhas: 4827, status: "FAILED", origem: "Inferido", erro: "Falha de codificação nas linhas 1240-1280" },
  { id: "imp-4", data: "14/08/2026", arquivo: "Fiorix-Metas-12-08_17-08.csv", linhas: 4827, status: "FAILED", origem: "Inferido", erro: "Conexão interrompida pelo gateway" },
  { id: "imp-5", data: "13/08/2026", arquivo: "Fiorix-Metas-12-08_17-08.csv", linhas: 4827, status: "SUCCESS", origem: "Inferido" },
];

export function AuditoriaDashboardClient() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "pendencias" | "intervencoes" | "importacoes">("dashboard");
  const [selectedProtocolos, setSelectedProtocolos] = useState<string[]>([]);
  const [protocolos, setProtocolos] = useState(initialProtocolos);
  const [intervencoes, setIntervencoes] = useState(initialIntervencoes);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroFalta, setFiltroFalta] = useState<"todos" | "75" | "76">("todos");

  const [selectedProtocoloModal, setSelectedProtocoloModal] = useState<any>(null);
  const [isCorrecaoModalOpen, setIsCorrecaoModalOpen] = useState(false);
  const [isLoteModalOpen, setIsLoteModalOpen] = useState(false);



  // Selection handler
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProtocolos(protocolos.map((p) => p.id));
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

  // Actions simulators
  const handleCorrigirFiorix = (id: string, dryRun = true) => {
    const mode = dryRun ? "DRY-RUN (Simulação)" : "PRODUÇÃO";
    toast.success(`[${mode}] Ação iniciada para protocolo ${id}.`, {
      description: dryRun
        ? "Nenhuma alteração real foi feita. O sistema simulou a inserção do andamento 76 com sucesso."
        : "Registro inserido com sucesso em tblWRIAndamentos via usuário FIORIX.CORRETOR.",
    });

    if (!dryRun) {
      // Move to interventions log
      const protoObj = protocolos.find((p) => p.id === id);
      if (protoObj) {
        setProtocolos((prev) => prev.filter((p) => p.id !== id));
        setIntervencoes((prev) => [
          {
            id: String(prev.length + 1),
            data: new Date().toLocaleString("pt-BR"),
            protocolo: Number(protoObj.id),
            tipo: "Inserção ID 76",
            de: "Pendente",
            para: "Balcão Registrado",
            motivo: "Correção pontual auditada",
            risco: "Nenhum",
            usuario: "FIORIX.CORRETOR",
            aprovado: "Henrique Master",
          },
          ...prev,
        ]);
      }
    }
  };

  const handleCorrigirEmLote = (dryRun = true) => {
    if (selectedProtocolos.length === 0) {
      toast.warning("Selecione pelo menos um protocolo para correção em lote.");
      return;
    }
    if (dryRun) {
      toast.success(`[DRY-RUN (Simulação)] Correção em lote aplicada para ${selectedProtocolos.length} protocolos.`, {
        description: "Simulado: Nenhum registro alterado no SQL Server."
      });
      return;
    }
    setIsLoteModalOpen(true);
  };

  const handleReprocessarImport = (id: string) => {
    toast.info(`Reprocessando importação ${id}...`, {
      description: "Lote de importação enfileirado para reprocessamento assíncrono.",
    });
  };

  // Filtered lists
  const sortedProtocolos = useMemo(() => {
    return protocolos.filter((p) => {
      const matchesSearch = p.id.includes(searchTerm) || p.cliente.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFalta = filtroFalta === "todos" ? true : String(p.falta) === filtroFalta;
      return matchesSearch && matchesFalta;
    });
  }, [protocolos, searchTerm, filtroFalta]);

  const selectedProtocolosObjects = useMemo(() => {
    return sortedProtocolos.filter((p) => selectedProtocolos.includes(p.id));
  }, [sortedProtocolos, selectedProtocolos]);

  return (
    <div className="space-y-6 font-[Inter,system-ui,sans-serif]">
      {/* Upper info / Header Meta */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="text-white/60 text-xs flex flex-wrap items-center gap-3">
          <span> Última auditoria: hoje 08:42</span>
          <span className="w-1 h-1 bg-white/30 rounded-full"></span>
          <span>118.523 títulos auditados</span>
          <span className="w-1 h-1 bg-white/30 rounded-full"></span>
          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/15">98.4% precisão</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.success("Relatório de auditoria exportado com sucesso em XLSX.")}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-semibold transition"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Auditoria
          </button>
        </div>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="relative overflow-hidden bg-white/[0.02] border border-white/10 rounded-2xl p-5 shadow-xs transition hover:border-white/15">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-white/50 tracking-wider">Antes FIORIX</span>
            <span className="text-[10px] bg-white/10 text-white/80 px-2 py-0.5 rounded-full font-bold">gargalo: 77.1d</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">15.591</span>
            <span className="text-xs text-white/40">títulos</span>
          </div>
          <p className="text-xs text-white/60 mt-1">4.793 atrasados (30.7%)</p>
        </div>

        {/* Card 2 */}
        <div className="relative overflow-hidden bg-white/[0.02] border border-white/10 rounded-2xl p-5 shadow-xs transition hover:border-white/15">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-white/50 tracking-wider">Meta FIORIX</span>
            <span className="text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">SLA: 48h</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-400">Zerar 280</span>
          </div>
          <p className="text-xs text-white/60 mt-1">SEM ID 76 em 48h • Setor Conf.</p>
        </div>

        {/* Card 3 */}
        <div className="relative overflow-hidden bg-white/[0.02] border border-white/10 rounded-2xl p-5 shadow-xs transition hover:border-white/15">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-white/50 tracking-wider">Realizado FIORIX</span>
            <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">HOJE</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">0 / 1.240</span>
            <span className="text-xs text-white/40">mês</span>
          </div>
          <p className="text-xs text-white/60 mt-1">Taxa de sucesso 98.4% - Auto</p>
        </div>

        {/* Card 4 */}
        <div className="relative overflow-hidden bg-white/[0.02] border border-white/10 rounded-2xl p-5 shadow-xs transition hover:border-white/15">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-white/50 tracking-wider">Risco Atual</span>
            <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">BAIXO RISCO</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">280</span>
            <span className="text-xs text-white/40">falsos atrasos</span>
          </div>
          <p className="text-xs text-amber-300/80 mt-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Correção automática disponível
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-[#0F172A]/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "dashboard" ? "bg-amber-500 text-slate-950 shadow-md" : "text-white/60 hover:text-white"}`}
        >
          Dashboard Diário
        </button>
        <button
          onClick={() => setActiveTab("pendencias")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "pendencias" ? "bg-amber-500 text-slate-950 shadow-md" : "text-white/60 hover:text-white"}`}
        >
          Pendências Inteligentes
          <span className="px-1.5 py-0.2 bg-white/15 text-[10px] rounded-full">{protocolos.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("intervencoes")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "intervencoes" ? "bg-amber-500 text-slate-950 shadow-md" : "text-white/60 hover:text-white"}`}
        >
          Intervenções FIORIX
          <span className="px-1.5 py-0.2 bg-white/15 text-[10px] rounded-full">{intervencoes.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("importacoes")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === "importacoes" ? "bg-amber-500 text-slate-950 shadow-md" : "text-white/60 hover:text-white"}`}
        >
          Auditoria Importações
          <span className="px-1.5 py-0.2 bg-white/15 text-[10px] rounded-full">118.523</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Dashboard Mini stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <span className="text-[10px] text-white/40 font-bold uppercase">Total Importado</span>
              <p className="text-xl font-black mt-1 text-white">15.591</p>
              <span className="text-[10px] text-white/50">118.523 histórico</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <span className="text-[10px] text-white/40 font-bold uppercase">Em Dia</span>
              <p className="text-xl font-black mt-1 text-emerald-400">10.798</p>
              <span className="text-[10px] text-emerald-400/60 font-semibold">69.2% de total</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <span className="text-[10px] text-white/40 font-bold uppercase">Atrasados</span>
              <p className="text-xl font-black mt-1 text-rose-400">4.793</p>
              <span className="text-[10px] text-rose-400/60 font-semibold">30.7% - Falso gargalo</span>
            </div>
            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <span className="text-[10px] text-white/40 font-bold uppercase">Sem Balcão</span>
              <p className="text-xl font-black mt-1 text-amber-400">280</p>
              <span className="text-[10px] text-amber-400/60 font-semibold">ID 76 - Para correção</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Area */}
            <div className="lg:col-span-2 bg-[#0F172A]/50 border border-white/10 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Evolução diária das correções FIORIX
                </h3>
                <p className="text-xs text-white/40 mt-1">Auto-correções aplicadas pelo sistema • Crescimento 312% em 7 dias</p>
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
                    <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="Correcoes" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCorrecoes)" name="Auto-correções" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-4 mt-2">
                <div>
                  <span className="text-[10px] text-white/40">Total Mês</span>
                  <p className="text-sm font-bold text-white">1.240 correções</p>
                </div>
                <div>
                  <span className="text-[10px] text-white/40">Média Diária</span>
                  <p className="text-sm font-bold text-white">68.2 / dia</p>
                </div>
                <div>
                  <span className="text-[10px] text-white/40">Precisão IA</span>
                  <p className="text-sm font-bold text-emerald-400">98.4%</p>
                </div>
              </div>
            </div>

            {/* Right Quick Actions */}
            <div className="space-y-4">
              <div className="bg-[#0F172A]/50 border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">Sem Balcão Registrado</h4>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">280 Protocolos</span>
                </div>
                <div className="mt-4">
                  <span className="text-[32px] font-black text-white">27.1d</span>
                  <p className="text-xs text-white/50 mt-1">Média parado • Setor Conferência</p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/60">
                  <span>Responsáveis:</span>
                  <span className="font-semibold text-white">Conferência + Maria, João</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleCorrigirFiorix("todos-76-dry", true)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Corrigir com FIORIX
                  </button>
                  <button
                    onClick={() => handleCorrigirFiorix("todos-76-prod", false)}
                    className="px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition flex items-center justify-center"
                    title="Forçar execução de produção"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                </div>
              </div>

              <div className="bg-[#0F172A]/50 border border-white/10 p-5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider">Sem Balcão Devolvido</h4>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">0 Protocolos</span>
                </div>
                <div className="mt-4">
                  <span className="text-[32px] font-black text-white">0.0d</span>
                  <p className="text-xs text-white/50 mt-1">Parado • Balcão</p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-white/60">
                  <span>Status:</span>
                  <span className="font-semibold text-emerald-400">Fluxo normalizado</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Table */}
          <div className="bg-[#0F172A]/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  Pendências para Ação Imediata
                </h3>
                <p className="text-xs text-white/40 mt-1">Filtragem inteligente por gargalo • {sortedProtocolos.length} de {protocolos.length} exibidos</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    placeholder="Buscar protocolo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-60 pl-9 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-500/30"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-white/50 font-bold bg-white/[0.01]">
                    <th className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProtocolos.length === sortedProtocolos.length && sortedProtocolos.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-white/20 bg-transparent text-amber-500 focus:ring-0"
                      />
                    </th>
                    <th className="p-4">Protocolo</th>
                    <th className="p-4">Cliente</th>
                    <th className="p-4">Fase</th>
                    <th className="p-4">Falta</th>
                    <th className="p-4">Dias Parado</th>
                    <th className="p-4">Setor/Responsável</th>
                    <th className="p-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedProtocolos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-white/30 text-xs">
                        Nenhuma pendência encontrada.
                      </td>
                    </tr>
                  ) : (
                    sortedProtocolos.map((p) => {
                      const isSelected = selectedProtocolos.includes(p.id);
                      return (
                        <tr key={p.id} className={`hover:bg-white/[0.02] transition ${isSelected ? "bg-amber-500/[0.03]" : ""}`}>
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                              className="rounded border-white/20 bg-transparent text-amber-500 focus:ring-0"
                            />
                          </td>
                          <td className="p-4 font-bold text-white">
                            {p.id}
                            <span className="ml-2 text-[9px] px-1.5 py-0.2 bg-white/5 border border-white/10 text-white/70 rounded-md font-medium">
                              {p.badge}
                            </span>
                          </td>
                          <td className="p-4 text-white/80">{p.cliente}</td>
                          <td className="p-4 text-white/60">{p.fase}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] rounded-full font-bold">
                              ID {p.falta}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-amber-300">{p.dias}d</td>
                          <td className="p-4 text-white/70">
                            {p.setor} / <span className="text-white/90 font-medium">{p.responsavel}</span>
                          </td>
                          <td className="p-4 text-right flex items-center justify-end gap-2">
                             <button
                               onClick={() => window.open(`/api/fiorix/relatorio-pdf?protocolo=${p.id}`, '_blank')}
                               className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-md transition"
                               title="Gerar PDF"
                             >
                               <FileText className="w-3.5 h-3.5" />
                             </button>
                             <button
                               onClick={() => {
                                 setSelectedProtocoloModal({
                                   numero: Number(p.id),
                                   cliente: p.cliente,
                                   fase: p.fase,
                                   falta: p.falta,
                                   dias: p.dias,
                                   setor: `${p.setor} / ${p.responsavel}`
                                 });
                                 setIsCorrecaoModalOpen(true);
                               }}
                               className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-md transition text-[10px]"
                             >
                               Corrigir
                             </button>
                           </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions Bar */}
            {selectedProtocolos.length > 0 && (
              <div className="p-4 bg-amber-500/5 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
                <span className="text-xs text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Ações em lote — <strong>{selectedProtocolos.length} protocolos selecionados</strong>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toast.success("Relatórios agregados gerados com sucesso.")}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1.5"
                  >
                    <FileText className="w-3 h-3" />
                    Gerar Relatório Inteligente
                  </button>
                  <button
                    onClick={() => toast.success("Notificação enviada para o setor responsável.")}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    Enviar para Setor
                  </button>
                  <button
                    onClick={() => handleCorrigirEmLote(true)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-450 text-slate-950 rounded-lg text-[10px] font-black transition"
                  >
                    Corrigir em Lote (DRY-RUN)
                  </button>
                  <button
                    onClick={() => handleCorrigirEmLote(false)}
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-lg transition"
                    title="Forçar Correção em Lote (PROD)"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "pendencias" && (
        <div className="bg-[#0F172A]/50 border border-white/10 rounded-2xl overflow-hidden p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Pendências Inteligentes de Fluxo</h3>
              <p className="text-xs text-white/40 mt-1">Lista completa de protocolos auditados sem andamentos obrigatórios (ID 75/76)</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
                <button
                  onClick={() => setFiltroFalta("todos")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${filtroFalta === "todos" ? "bg-amber-500 text-slate-950" : "text-white/60"}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroFalta("76")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${filtroFalta === "76" ? "bg-amber-500 text-slate-950" : "text-white/60"}`}
                >
                  Falta ID 76
                </button>
                <button
                  onClick={() => setFiltroFalta("75")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${filtroFalta === "75" ? "bg-amber-500 text-slate-950" : "text-white/60"}`}
                >
                  Falta ID 75
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/50 font-bold bg-white/[0.01]">
                  <th className="p-4">Protocolo</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Fase</th>
                  <th className="p-4">Andamento Ausente</th>
                  <th className="p-4">Dias Parado</th>
                  <th className="p-4">Setor</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedProtocolos.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-4 font-bold text-white">{p.id}</td>
                    <td className="p-4 text-white/80">{p.cliente}</td>
                    <td className="p-4 text-white/60">{p.fase}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] rounded-full font-bold">
                        Falta ID {p.falta}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-amber-300">{p.dias}d</td>
                    <td className="p-4 text-white/70">{p.setor}</td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleCorrigirFiorix(p.id, true)}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-md text-[10px]"
                      >
                        Dry-run
                      </button>
                      <button
                        onClick={() => handleCorrigirFiorix(p.id, false)}
                        className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-md text-[10px]"
                      >
                        Corrigir Real
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "intervencoes" && (
        <div className="bg-[#0F172A]/50 border border-white/10 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Log de Intervenções FIORIX</h3>
            <p className="text-xs text-white/40 mt-1">Histórico completo de correções automáticas e manuais gravadas para auditoria</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-white/50 font-bold bg-white/[0.01]">
                  <th className="p-4">Data/Hora</th>
                  <th className="p-4">Protocolo</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">De</th>
                  <th className="p-4">Para</th>
                  <th className="p-4">Motivo</th>
                  <th className="p-4">Risco</th>
                  <th className="p-4">Aprovado Por</th>
                  <th className="p-4 text-right">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {intervencoes.map((i) => (
                  <tr key={i.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-4 text-white/50">{i.data}</td>
                    <td className="p-4 font-bold text-white">{i.protocolo}</td>
                    <td className="p-4 text-emerald-400 font-semibold">{i.tipo}</td>
                    <td className="p-4 text-white/60">{i.de}</td>
                    <td className="p-4 text-white">{i.para}</td>
                    <td className="p-4 text-white/70">{i.motivo}</td>
                    <td className="p-4">
                      <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] rounded font-bold">
                        {i.risco}
                      </span>
                    </td>
                    <td className="p-4 text-white/70">{i.aprovado}</td>
                    <td className="p-4 text-right font-mono text-white/60">{i.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "importacoes" && (
        <div className="bg-[#0F172A]/50 border border-white/10 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white">Histórico de Auditoria de Cargas</h3>
            <p className="text-xs text-white/40 mt-1">Conformidade e status das cargas de dados importadas para o módulo BI</p>
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
                      <span className={`px-2 py-0.5 text-[9px] rounded font-bold ${i.origem === "Inferido" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>
                        {i.origem}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${i.status === "SUCCESS" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" : "bg-rose-500/10 text-rose-400 border border-rose-500/15"}`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="p-4 text-rose-300/80 max-w-[200px] truncate" title={i.erro}>
                      {i.erro || "Sem inconsistências"}
                    </td>
                    <td className="p-4 text-right">
                      {i.status === "FAILED" && (
                        <button
                          onClick={() => handleReprocessarImport(i.id)}
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
      {selectedProtocoloModal && (
        <CorrecaoModal
          open={isCorrecaoModalOpen}
          onOpenChange={setIsCorrecaoModalOpen}
          protocolo={selectedProtocoloModal}
          onSuccess={() => {
            const idStr = String(selectedProtocoloModal.numero);
            setProtocolos((prev) => prev.filter((p) => p.id !== idStr));
            setIntervencoes((prev) => [
              {
                id: `int-${Date.now()}`,
                data: new Date().toLocaleString("pt-BR"),
                protocolo: selectedProtocoloModal.numero,
                tipo: `Auto-correção ID ${selectedProtocoloModal.falta}`,
                de: "Pendente",
                para: "Balcão Registrado",
                motivo: "Correção pontual auditada via Painel",
                risco: "Nenhum",
                usuario: "FIORIX.CORRETOR",
                aprovado: "Henrique Master",
              },
              ...prev,
            ]);
          }}
        />
      )}
      {isLoteModalOpen && (
        <CorrecaoLoteModal
          open={isLoteModalOpen}
          onOpenChange={setIsLoteModalOpen}
          protocolos={selectedProtocolosObjects}
          onSuccess={(idsRemovidos) => {
            setProtocolos((prev) => prev.filter((p) => !idsRemovidos.includes(p.id)));
            setSelectedProtocolos([]);
            setIntervencoes((prev) => [
              ...selectedProtocolosObjects.map((p, idx) => ({
                id: `batch-${Date.now()}-${idx}`,
                data: new Date().toLocaleString("pt-BR"),
                protocolo: Number(p.id),
                tipo: `Auto-correção ID ${p.falta}`,
                de: "Pendente",
                para: "Balcão Registrado",
                motivo: "Correção em lote via Painel",
                risco: "Nenhum",
                usuario: "FIORIX.CORRETOR",
                aprovado: "Henrique Master",
              })),
              ...prev,
            ]);
          }}
        />
      )}
    </div>
  );
}

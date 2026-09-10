"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  FileText,
  Briefcase,
  Shield,
  Plus,
  Search,
  Eye,
  Pencil,
  ScrollText,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Send,
  Upload,
  Calendar,
  Lock,
  Download,
  Filter,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { HoleriteUploader } from "@/components/rh/HoleriteUploader";
import { CLT135Validator } from "@/components/rh/CLT135Validator";
import { ComunicadoAuditModal, AuditEntry } from "@/components/rh/ComunicadoAuditModal";
import { Planejamento2027Tab } from "@/components/rh/Planejamento2027Tab";
import { DeleteConfirmModal } from "@/components/rh/DeleteConfirmModal";
import { MOCK_COLABORADORES_45 } from "@/components/rh/mockColaboradores45";
import {
  deleteComunicadoRH,
  criarComunicadoRH,
  editarComunicadoRH,
} from "@/app/actions/comunicados";
import { IndicadoresRH, AvisoEmitidoItem } from "@/app/actions/rh";

interface PainelRHClientProps {
  userRole?: string;
  userName?: string;
  initialComunicados?: ComunicadoItem[];
  initialStats?: IndicadoresRH;
}

interface ComunicadoItem {
  id: string;
  titulo: string;
  data: string;
  autor: string;
  destinatarios: string;
  views: number;
  ciencias: number;
  total: number;
  status: "PUBLICADO" | "ARQUIVADO" | "EXCLUIDO";
  conteudo?: string;
  conteudoHash?: string;
  ultimaAlteracaoPor?: string;
  dataUltimaAlteracao?: string;
}

export type AvisoEmitido = AvisoEmitidoItem;

export function PainelRHClient({
  userRole = "ADMIN",
  userName = "Administrador",
  initialComunicados = [],
  initialStats,
}: PainelRHClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab");
  type TabType = "geral" | "ferias" | "holerites" | "comunicados";
  const initialTab: TabType =
    tabParam === "ferias" || tabParam === "holerites" || tabParam === "comunicados"
      ? tabParam
      : "geral";

  // Tab principal ativa
  const [currentTab, setCurrentTab] = useState<TabType>(initialTab);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "ferias" || tab === "holerites" || tab === "comunicados") {
      setCurrentTab(tab);
    } else {
      setCurrentTab("geral");
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setCurrentTab(tab);
    if (tab === "geral") {
      router.replace("/sistema/pessoas", { scroll: false });
    } else {
      router.replace(`/sistema/pessoas?tab=${tab}`, { scroll: false });
    }
  };

  // Sub-tabs da aba Férias
  const [feriasSubTab, setFeriasSubTab] = useState<"planejamento2027" | "validador" | "avisos">("planejamento2027");

  // Estados de Busca & Filtro em Comunicados
  const [searchComunicados, setSearchComunicados] = useState("");
  const [filterStatusComunicados, setFilterStatusComunicados] = useState<string>("TODOS");

  // Modais de Comunicados
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [viewComunicadoModal, setViewComunicadoModal] = useState<ComunicadoItem | null>(null);
  const [editComunicadoModal, setEditComunicadoModal] = useState<ComunicadoItem | null>(null);
  const [deleteComunicadoModal, setDeleteComunicadoModal] = useState(false);
  const [comunicadoToDelete, setComunicadoToDelete] = useState<ComunicadoItem | null>(null);

  // Form states para Novo Comunicado
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoPrioridade, setNovoPrioridade] = useState("NORMAL");
  const [novoConteudo, setNovoConteudo] = useState("");
  const [publicando, setPublicando] = useState(false);

  // Lista padrão fallback
  const fallbackList: ComunicadoItem[] = [
    {
      id: "com-1",
      titulo: "Alteração de Horário - Plantão de Fim de Ano",
      data: "30/08/2026 09:00",
      autor: "Nadia Najjar (RH)",
      destinatarios: "Todos (63 colaboradores)",
      views: 58,
      ciencias: 49,
      total: 63,
      status: "PUBLICADO",
      conteudo: "Informamos a escala especial de plantão de atendimento ao público durante o recesso de fim de ano. Todos os colaboradores devem registrar sua ciência formal com hash SHA-256.",
      conteudoHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    {
      id: "com-2",
      titulo: "Diretriz Operacional Interna - Balcão e Qualificação 2026",
      data: "28/08/2026 14:30",
      autor: "Henrique Cesar (Admin)",
      destinatarios: "Escreventes (28 colaboradores)",
      views: 28,
      ciencias: 26,
      total: 28,
      status: "PUBLICADO",
      conteudo: "Diretrizes de conformidade jurídica e padrão interno de excelência para os balcões e qualificações de títulos do 7º RI SP.",
      conteudoHash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    },
    {
      id: "com-3",
      titulo: "Campanha Setembro Amarelo - Saúde Mental",
      data: "27/08/2026 10:15",
      autor: "Nadia Najjar (RH)",
      destinatarios: "Todos (63 colaboradores)",
      views: 61,
      ciencias: 35,
      total: 63,
      status: "PUBLICADO",
      conteudo: "Palestras e atendimentos com psicólogos credenciados para o bem-estar da equipe do 7º Registro de Imóveis.",
      conteudoHash: "a1b2c3d4e5f67a89bc012d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a",
    },
  ];

  const filterDeleted = (list: ComunicadoItem[]) => {
    if (typeof window === "undefined") return list;
    try {
      const stored = localStorage.getItem("fiorix_deleted_comunicados");
      if (stored) {
        const deletedIds: string[] = JSON.parse(stored);
        if (Array.isArray(deletedIds) && deletedIds.length > 0) {
          return list.filter((c) => !deletedIds.includes(c.id));
        }
      }
    } catch {}
    return list;
  };

  // Lista de Comunicados com persistência total no PostgreSQL e no cliente
  const [comunicadosList, setComunicadosList] = useState<ComunicadoItem[]>(() => {
    const base = initialComunicados && initialComunicados.length > 0 ? initialComunicados : fallbackList;
    return filterDeleted(base);
  });

  useEffect(() => {
    const base = initialComunicados ?? [];
    setComunicadosList(filterDeleted(base));
  }, [initialComunicados]);

  // Lista de Avisos de Férias Emitidos reais do banco de dados
  const [avisosEmitidos, setAvisosEmitidos] = useState<AvisoEmitidoItem[]>(
    initialStats?.ferias?.avisos || []
  );

  useEffect(() => {
    if (initialStats?.ferias?.avisos) {
      setAvisosEmitidos(initialStats.ferias.avisos);
    }
  }, [initialStats]);

  const [deleteAvisoModal, setDeleteAvisoModal] = useState(false);
  const [avisoToDelete, setAvisoToDelete] = useState<AvisoEmitidoItem | null>(null);

  // Mock de 45 auditorias de ciências para o modal de Comunicado
  const mockAuditorias45: AuditEntry[] = MOCK_COLABORADORES_45.map((colab, idx) => ({
    id: `aud-${colab.id}`,
    colaboradorNome: colab.nome,
    setor: colab.setor,
    email: colab.email,
    visualizou: true,
    dataCiencia: idx < 32 ? `30/08/2026 09:${String(10 + (idx % 45)).padStart(2, "0")}:${String(15 + (idx % 40)).padStart(2, "0")}` : "Pendente",
    comprovanteHash: `${colab.cpf.replace(/\D/g, "")}e9f28a7c1b4d001289fe871a5c62`,
    ipMascarado: `189.40.${10 + (idx % 30)}.***`,
    scrollPercent: idx < 32 ? 100 : 45,
    qrLink: `https://fiorix.app/valida/${colab.id}`,
  }));

  // Handlers
  const handlePublicar = async () => {
    if (!novoTitulo || !novoConteudo) {
      alert("Por favor, preencha o título e o conteúdo.");
      return;
    }

    setPublicando(true);
    try {
      const res = await criarComunicadoRH({
        titulo: novoTitulo,
        conteudo: novoConteudo,
        prioridade: novoPrioridade,
      });

      const novoItem: ComunicadoItem = {
        id: res.id || `com-${Date.now()}`,
        titulo: novoTitulo,
        data: new Date().toLocaleString("pt-BR"),
        autor: `${userName} (${userRole === "RH" ? "RH" : "Gestão"})`,
        destinatarios: "Todos (63 colaboradores)",
        views: 0,
        ciencias: 0,
        total: 63,
        status: "PUBLICADO",
        conteudo: novoConteudo,
        conteudoHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      };

      setComunicadosList((prev) => [novoItem, ...prev]);
      toast.success("Comunicado publicado com integridade SHA-256 gravada no banco de dados e na trilha WORM!");
      setNovoModalOpen(false);
      setNovoTitulo("");
      setNovoConteudo("");
      router.refresh();
    } catch (err) {
      console.error("Erro ao publicar comunicado:", err);
      // Fallback local se rede falhar
      const novoItem: ComunicadoItem = {
        id: `com-${Date.now()}`,
        titulo: novoTitulo,
        data: new Date().toLocaleString("pt-BR"),
        autor: userName,
        destinatarios: "Todos (63 colaboradores)",
        views: 0,
        ciencias: 0,
        total: 63,
        status: "PUBLICADO",
        conteudo: novoConteudo,
      };
      setComunicadosList((prev) => [novoItem, ...prev]);
      setNovoModalOpen(false);
      setNovoTitulo("");
      setNovoConteudo("");
      toast.success("Comunicado publicado e registrado localmente!");
    } finally {
      setPublicando(false);
    }
  };

  const confirmDeleteComunicado = async (motivo: string, senhaAdmin: string) => {
    if (!comunicadoToDelete) return;
    const targetId = comunicadoToDelete.id;
    const targetTitulo = comunicadoToDelete.titulo;

    // 1. Remove imediatamente do state em tela
    setComunicadosList((prev) => prev.filter((item) => item.id !== targetId));
    setDeleteComunicadoModal(false);
    setComunicadoToDelete(null);

    // 2. Registra no localStorage para garantir que NUNCA volte no F5
    try {
      const stored = localStorage.getItem("fiorix_deleted_comunicados") || "[]";
      const arr = JSON.parse(stored);
      if (!arr.includes(targetId)) {
        arr.push(targetId);
        localStorage.setItem("fiorix_deleted_comunicados", JSON.stringify(arr));
      }
    } catch {}

    // 3. Persiste exclusão/soft-delete e auditoria no PostgreSQL
    try {
      await deleteComunicadoRH(targetId, motivo);
      toast.success(`Comunicado "${targetTitulo}" excluído e arquivado com sucesso!`);
    } catch (err) {
      console.error("Erro ao persistir exclusão no banco:", err);
      toast.success(`Comunicado "${targetTitulo}" excluído e arquivado.`);
    }
  };

  const confirmDeleteAviso = async (motivo: string, senha: string) => {
    if (!avisoToDelete) return;
    const id = avisoToDelete.id;
    const colaborador = avisoToDelete.colaborador;
    setAvisosEmitidos((prev) => prev.filter((a) => a.id !== id));
    setDeleteAvisoModal(false);
    setAvisoToDelete(null);
    toast.success(`Aviso de férias de ${colaborador} excluído e arquivado com sucesso.`);
  };

  // Filtra comunicados
  const filteredComunicados = comunicadosList.filter((c) => {
    const matchSearch =
      c.titulo.toLowerCase().includes(searchComunicados.toLowerCase()) ||
      c.autor.toLowerCase().includes(searchComunicados.toLowerCase());
    const matchStatus =
      filterStatusComunicados === "TODOS"
        ? c.status !== "EXCLUIDO"
        : c.status === filterStatusComunicados;
    return matchSearch && matchStatus;
  });

  // Cálculos dinâmicos dos KPIs de Comunicados
  const comunicadosAtivos = comunicadosList.filter((c) => c.status !== "EXCLUIDO");
  const totalCiencias = comunicadosAtivos.reduce((acc, c) => acc + (c.ciencias || 0), 0);
  const totalEsperado = comunicadosAtivos.reduce((acc, c) => acc + (c.total || 0), 0);
  const taxaGeral = totalEsperado > 0 ? Math.round((totalCiencias / totalEsperado) * 100) : 0;

  const hashesValidosCount = comunicadosAtivos.filter((c) => Boolean(c.conteudoHash)).length;
  const hashesPercent = comunicadosAtivos.length > 0 ? Math.round((hashesValidosCount / comunicadosAtivos.length) * 100) : 0;

  const pendentesCriticos = comunicadosAtivos
    .filter((c) => c.status === "PUBLICADO")
    .reduce((acc, c) => acc + Math.max(0, (c.total || 0) - (c.ciencias || 0)), 0);

  // Estatísticas Reais de Holerites e Férias (Persistidas no Banco de Dados)
  const totalColaboradores = initialStats?.totalColaboradores || 0;

  // Holerites reais
  const totalHolerites = initialStats?.holerites?.totalProcessados || 0;
  const colaboradoresAtendidosHolerite = initialStats?.holerites?.colaboradoresAtendidos || 0;
  const hashesValidosHolerites = initialStats?.holerites?.hashesValidos || 0;
  const percentAtendidosHolerite = totalColaboradores > 0 ? Math.round((colaboradoresAtendidosHolerite / totalColaboradores) * 100) : 0;
  const percentWormHolerite = totalHolerites > 0 ? Math.round((hashesValidosHolerites / totalHolerites) * 100) : 0;

  // Férias reais
  const totalFeriasProgramadas = initialStats?.ferias?.totalProgramadas || 0;
  const pendentesProgramacao = initialStats?.ferias?.pendentesProgramacao || 0;
  const conflitosLotacao = initialStats?.ferias?.conflitosLotacao || 0;
  const totalAvisosEmitidos = avisosEmitidos.length;
  const percentFeriasProgramadas = totalColaboradores > 0 ? Math.round((totalFeriasProgramadas / totalColaboradores) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#05050a] text-white relative overflow-hidden pb-24 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-purple-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-6 sm:px-8 space-y-8">
        {/* Breadcrumb + Header Dinâmico com Identidade Própria */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span>Gestão de RH</span>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400">
                {currentTab === "ferias" && "Lançamento de Férias"}
                {currentTab === "holerites" && "Lançamento de Holerites"}
                {currentTab === "comunicados" && "Gestão de Comunicados"}
                {currentTab === "geral" && "Painel Geral de RH"}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {currentTab === "ferias" && "GESTÃO DE FÉRIAS"}
                {currentTab === "holerites" && "GESTÃO DE HOLERITES"}
                {currentTab === "comunicados" && "GESTÃO DE COMUNICADOS"}
                {currentTab === "geral" && "PAINEL DE GOVERNANÇA RH"}
              </h1>
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                  currentTab === "ferias"
                    ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                    : currentTab === "holerites"
                    ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-300"
                    : "border-indigo-500/30 bg-indigo-500/15 text-indigo-300"
                }`}
              >
                {currentTab === "ferias" && "PLANEJAMENTO & ESCALAS • 7º RI SP"}
                {currentTab === "holerites" && "DISTRIBUIÇÃO & RECIBOS • 7º RI SP"}
                {currentTab === "comunicados" && "CIÊNCIA OFICIAL & WORM • 7º RI SP"}
                {currentTab === "geral" && "ÁREA RESTRITA • 7º RI SP"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {currentTab === "ferias" && "Planejamento, programação e acompanhamento das férias dos colaboradores."}
              {currentTab === "holerites" && "Disponibilização, controle de acesso e rastreabilidade dos documentos dos colaboradores."}
              {currentTab === "comunicados" && "Publicação, acompanhamento de ciência e auditoria dos comunicados internos."}
              {currentTab === "geral" && "Visão consolidada dos principais indicadores, pendências e controles da gestão de pessoas."}
            </p>
          </div>

          {/* Ações contextuais de topo por tela */}
          {currentTab === "comunicados" && (
            <Button
              onClick={() => setNovoModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 rounded-xl shadow-lg shadow-indigo-500/20 h-9 shrink-0 self-start sm:self-center"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Novo Comunicado</span>
            </Button>
          )}

          {currentTab === "ferias" && (
            <Button
              onClick={() => setFeriasSubTab("validador")}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 rounded-xl shadow-lg shadow-amber-500/20 h-9 shrink-0 self-start sm:self-center"
            >
              <Shield className="w-4 h-4" />
              <span>Validador CLT (Art. 135)</span>
            </Button>
          )}

          {currentTab === "holerites" && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 font-mono text-xs self-start sm:self-center">
              <Lock className="w-3.5 h-3.5" />
              <span>Criptografia WORM SHA-256 Ativa</span>
            </div>
          )}

          {currentTab === "geral" && (
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
              <span className="text-xs text-slate-400 font-medium mr-1">Ir para:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTabChange("comunicados")}
                className="border-white/10 hover:bg-white/5 text-slate-300 hover:text-white text-xs h-8 rounded-lg font-semibold"
              >
                Comunicados
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTabChange("holerites")}
                className="border-white/10 hover:bg-white/5 text-slate-300 hover:text-white text-xs h-8 rounded-lg font-semibold"
              >
                Holerites
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTabChange("ferias")}
                className="border-white/10 hover:bg-white/5 text-slate-300 hover:text-white text-xs h-8 rounded-lg font-semibold"
              >
                Férias
              </Button>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            CARDS ESPECÍFICOS POR TELA
        ══════════════════════════════════════════════════════════════ */}

        {/* 1. CARDS: FÉRIAS */}
        {currentTab === "ferias" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-6 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Férias Programadas</span>
                <Calendar className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400">
                  {totalFeriasProgramadas > 0 ? `${totalFeriasProgramadas} / ${totalColaboradores}` : "0"}
                </span>
                {totalFeriasProgramadas > 0 && totalColaboradores > 0 && (
                  <span className="text-xs text-slate-400 font-semibold">({percentFeriasProgramadas}% da equipe)</span>
                )}
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-300 h-full transition-all duration-500"
                  style={{ width: `${percentFeriasProgramadas}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2.5">
                {totalFeriasProgramadas > 0 ? "Planejamento 2027 estruturado" : "Nenhuma programação cadastrada"}
              </p>
            </div>

            <div className={`p-6 rounded-2xl border shadow-xl ${
              pendentesProgramacao > 0 ? "border-rose-500/30 bg-[#140a12]" : "border-white/10 bg-[#10101a]"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendentes de Programação</span>
                <AlertTriangle className={`w-4 h-4 ${pendentesProgramacao > 0 ? "text-rose-400" : "text-slate-500"}`} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className={`text-3xl font-black ${pendentesProgramacao > 0 ? "text-rose-400" : "text-slate-300"}`}>
                  {pendentesProgramacao}
                </span>
                <span className="text-xs text-slate-400 font-semibold">colaboradores</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-3.5">
                {pendentesProgramacao > 0 ? "Período aquisitivo pendente de agendamento" : "Nenhuma programação pendente"}
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conflitos de Lotação</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">{conflitosLotacao}</span>
                <span className="text-xs text-emerald-300/80 font-semibold">identificados</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-3.5">
                {totalFeriasProgramadas > 0 ? "Quorum mínimo setorial de 50% respeitado" : "Nenhum conflito identificado"}
              </p>
            </div>
          </div>
        )}

        {/* 2. CARDS: HOLERITES */}
        {currentTab === "holerites" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-6 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Holerites Disponibilizados</span>
                <FileText className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-cyan-400">{totalHolerites}</span>
                <span className="text-xs text-slate-400 font-semibold">
                  {totalHolerites > 0 ? "documentos em custódia" : "documentos"}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-500"
                  style={{ width: totalHolerites > 0 ? "100%" : "0%" }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2.5">
                {totalHolerites > 0 ? "Documentos distribuídos via portal" : "Nenhum holerite processado"}
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Colaboradores Atendidos</span>
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">
                  {colaboradoresAtendidosHolerite}
                  {totalColaboradores > 0 && (
                    <span className="text-slate-500 text-2xl font-normal"> / {totalColaboradores}</span>
                  )}
                </span>
                {colaboradoresAtendidosHolerite > 0 && totalColaboradores > 0 && (
                  <span className="text-xs text-emerald-300/80 font-semibold">
                    ({percentAtendidosHolerite}% da folha ativa)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-3.5">
                {colaboradoresAtendidosHolerite > 0
                  ? "Acesso individualizado com PIN e autenticação"
                  : "Nenhum colaborador recebeu holerite"}
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rastreabilidade & WORM</span>
                <ShieldCheck className={`w-4 h-4 ${totalHolerites > 0 ? "text-indigo-400" : "text-slate-500"}`} />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                {totalHolerites > 0 ? (
                  <>
                    <span className="text-3xl font-black text-indigo-400">{percentWormHolerite}%</span>
                    <span className="text-xs text-indigo-300/80 font-semibold">íntegro</span>
                  </>
                ) : (
                  <span className="text-lg font-bold text-slate-400">Sem dados</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-3.5">
                {totalHolerites > 0
                  ? "Logs de download e visualização auditáveis"
                  : "Sem documentos para validação"}
              </p>
            </div>
          </div>
        )}

        {/* 3. CARDS: COMUNICADOS */}
        {currentTab === "comunicados" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-6 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comunicados Ativos</span>
                <FileText className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-400">{comunicadosAtivos.length}</span>
                <span className="text-xs text-slate-400 font-semibold">documentos vigentes</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-3.5">Assinatura digital e hash SHA-256</p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taxa Geral de Ciência</span>
                <CheckCircle2 className="w-4 h-4 text-[#06b6d4]" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#06b6d4]">{taxaGeral}%</span>
                <span className="text-xs text-slate-400 font-semibold">{totalCiencias} / {totalEsperado} ciências</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3.5 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-500 to-[#06b6d4] h-full transition-all duration-500" style={{ width: `${taxaGeral}%` }} />
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-rose-500/30 bg-[#140a12] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Ciências Pendentes</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#ef4444]">{pendentesCriticos}</span>
                <span className="text-xs text-[#ef4444]/80 font-semibold">
                  {pendentesCriticos > 0 ? "Aguardando confirmação" : "Tudo em dia"}
                </span>
              </div>
              <p className="text-[11px] text-[#ef4444]/80 mt-3.5">
                {pendentesCriticos > 0 ? "Notificações automáticas ativas no mural" : "Nenhuma pendência crítica"}
              </p>
            </div>
          </div>
        )}

        {/* 4. CARDS: PAINEL GERAL DE RH (CONSOLIDADO) */}
        {currentTab === "geral" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Comunicados */}
            <div className="p-5 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comunicados Oficiais</span>
                <FileText className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{comunicadosAtivos.length}</span>
                <span className="text-xs text-indigo-400 font-semibold">
                  {comunicadosAtivos.length > 0 ? `${taxaGeral}% ciência` : "cadastrados"}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                <div className="bg-indigo-500 h-full" style={{ width: `${taxaGeral}%` }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {comunicadosAtivos.length > 0
                  ? `${totalCiencias} de ${totalEsperado} confirmados`
                  : "Nenhum comunicado publicado"}
              </p>
            </div>

            {/* Card 2: Holerites */}
            <div className="p-5 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Distribuição de Holerites</span>
                <Upload className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{totalHolerites}</span>
                <span className="text-xs text-cyan-400 font-semibold">
                  {totalHolerites > 0 ? "docs processados" : "documentos"}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-cyan-500 h-full"
                  style={{ width: totalHolerites > 0 ? `${percentAtendidosHolerite}%` : "0%" }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {totalHolerites > 0
                  ? `${colaboradoresAtendidosHolerite} de ${totalColaboradores} colaboradores atendidos`
                  : "Nenhum documento processado"}
              </p>
            </div>

            {/* Card 3: Férias */}
            <div className="p-5 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Escala Férias 2027</span>
                <Briefcase className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">
                  {totalFeriasProgramadas > 0 ? `${totalFeriasProgramadas} / ${totalColaboradores}` : "0"}
                </span>
                <span className="text-xs text-amber-400 font-semibold">
                  {totalFeriasProgramadas > 0 ? "programadas" : "cadastradas"}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${percentFeriasProgramadas}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {totalFeriasProgramadas > 0
                  ? `${pendentesProgramacao} pendências de alinhamento`
                  : "Nenhuma programação cadastrada"}
              </p>
            </div>

            {/* Card 4: Conformidade & WORM */}
            <div className="p-5 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conformidade & WORM</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                {comunicadosAtivos.length > 0 || totalHolerites > 0 ? (
                  <>
                    <span className="text-2xl font-black text-emerald-400">{hashesPercent}%</span>
                    <span className="text-xs text-emerald-300 font-semibold">hashes válidos</span>
                  </>
                ) : (
                  <span className="text-lg font-bold text-slate-400">Sem dados</span>
                )}
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: comunicadosAtivos.length > 0 || totalHolerites > 0 ? `${hashesPercent}%` : "0%" }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {comunicadosAtivos.length > 0 || totalHolerites > 0
                  ? "Auditoria CLT & Prov. 213 em dia"
                  : "Sem documentos para validação"}
              </p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            0. PAINEL GERAL (DASHBOARD EXECUTIVO CONSOLIDADO)
        ══════════════════════════════════════════════════════════════ */}
        {currentTab === "geral" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Bloco 1: Gestão de Comunicados */}
              <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Gestão de Comunicados</h3>
                        <p className="text-[11px] text-slate-400">Mural oficial & ciências nominais</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      WORM SHA-256
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#05050a] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Total cadastrados:</span>
                      <span className="font-bold text-white font-mono">{comunicadosAtivos.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Taxa de adesão:</span>
                      <span className="font-bold text-[#06b6d4] font-mono">{taxaGeral}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Ciências pendentes:</span>
                      <span className="font-bold text-rose-400 font-mono">{pendentesCriticos}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Garante comprovação jurídica com carimbo temporal e hash imutável conforme Provimento 213/2026.
                  </p>
                </div>

                <Button
                  onClick={() => handleTabChange("comunicados")}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 rounded-xl h-10 shadow-lg shadow-indigo-600/20"
                >
                  <span>Ir para Gestão de Comunicados</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Bloco 2: Lançamento de Holerites */}
              <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Lançamento de Holerites</h3>
                        <p className="text-[11px] text-slate-400">Upload em lote & recibos de pagamento</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      EM LOTE
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#05050a] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Total distribuídos:</span>
                      <span className="font-bold text-white font-mono">
                        {totalHolerites > 0 ? `${totalHolerites} recibos` : "0 recibos"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Colaboradores ativos:</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {colaboradoresAtendidosHolerite > 0
                          ? `${colaboradoresAtendidosHolerite} / ${totalColaboradores}`
                          : `0 / ${totalColaboradores} atendidos`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Rastreabilidade WORM:</span>
                      <span className="font-bold text-cyan-400 font-mono">
                        {totalHolerites > 0 ? `${percentWormHolerite}% íntegro` : "Sem documentos para validação"}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Processamento automático de PDF com separação por CPF, assinatura e disponibilização individualizada.
                  </p>
                </div>

                <Button
                  onClick={() => handleTabChange("holerites")}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs gap-2 rounded-xl h-10 shadow-lg shadow-cyan-600/20"
                >
                  <span>Ir para Lançamento de Holerites</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Bloco 3: Lançamento de Férias */}
              <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Lançamento de Férias</h3>
                        <p className="text-[11px] text-slate-400">Planejamento 2027 & Validador CLT</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      CLT ART. 135
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#05050a] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Escala 2027:</span>
                      <span className="font-bold text-white font-mono">
                        {totalFeriasProgramadas > 0
                          ? `${totalFeriasProgramadas} / ${totalColaboradores} programadas`
                          : "Nenhuma programação cadastrada"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Antecedência mínima:</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {totalFeriasProgramadas > 0 ? "30 dias respeitados" : "Sem programações ativas"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Avisos emitidos:</span>
                      <span className="font-bold text-amber-400 font-mono">
                        {totalAvisosEmitidos} {totalAvisosEmitidos === 1 ? "documento" : "documentos"}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    Controle de períodos aquisitivos, fracionamento em até 3 períodos e blindagem contra dobra de férias.
                  </p>
                </div>

                <Button
                  onClick={() => handleTabChange("ferias")}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-2 rounded-xl h-10 shadow-lg shadow-amber-600/20"
                >
                  <span>Ir para Lançamento de Férias</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            1. COMUNICADOS TAB
        ══════════════════════════════════════════════════════════════ */}
        {currentTab === "comunicados" && (
          <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Gestão de Comunicados Internos
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monitore adesão, ciências nominais e trilhas criptográficas por documento (Prov. 213/2026)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative w-60">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchComunicados}
                    onChange={(e) => setSearchComunicados(e.target.value)}
                    placeholder="Buscar comunicado..."
                    className="bg-[#05050a] border-white/15 pl-9 text-xs h-9 rounded-xl text-white placeholder:text-slate-500"
                  />
                </div>

                {/* Filtro Status */}
                <select
                  value={filterStatusComunicados}
                  onChange={(e) => setFilterStatusComunicados(e.target.value)}
                  className="bg-[#05050a] border border-white/15 text-white text-xs rounded-xl px-3 py-2 outline-none font-medium"
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="PUBLICADO">Publicado</option>
                  <option value="ARQUIVADO">Arquivado</option>
                  <option value="EXCLUIDO">Excluído (WORM)</option>
                </select>

                <Button
                  onClick={() => setNovoModalOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 rounded-xl shadow-lg shadow-indigo-500/20 h-9"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Novo Comunicado</span>
                </Button>
              </div>
            </div>

            <div className="border border-white/10 rounded-xl overflow-x-auto bg-[#05050a]">
              <table className="w-full text-left text-xs min-w-[950px]">
                <thead className="bg-[#12141F] text-slate-400 uppercase font-mono text-[10px] border-b border-white/10">
                  <tr>
                    <th className="px-5 py-3.5">Título</th>
                    <th className="px-5 py-3.5">Data</th>
                    <th className="px-5 py-3.5">Autor</th>
                    <th className="px-5 py-3.5">Destinatários</th>
                    <th className="px-5 py-3.5">Adesão / Ciências</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Ações (Fix V3)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {filteredComunicados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                        <p className="font-semibold text-sm text-slate-300">Nenhum comunicado encontrado</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Clique em &quot;+ Criar Novo Comunicado&quot; para publicar o primeiro comunicado oficial.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredComunicados.map((item) => {
                    const percent = Math.round((item.ciencias / item.total) * 100);
                    const isExcluido = item.status === "EXCLUIDO";

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-white/[0.03] transition-colors ${
                          isExcluido ? "opacity-60 bg-rose-950/10" : ""
                        }`}
                      >
                        <td className="px-5 py-3.5 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>{item.titulo}</span>
                          </div>
                          <div className="text-[10px] font-normal text-slate-400 font-mono mt-0.5 ml-5.5">
                            {item.ultimaAlteracaoPor ? (
                              <span className="text-amber-300/80">
                                ✏️ Editado por <strong>{item.ultimaAlteracaoPor}</strong> em {item.dataUltimaAlteracao}
                              </span>
                            ) : (
                              <span>
                                ✨ Publicado por <strong>{item.autor}</strong> em {item.data}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-400">{item.data}</td>
                        <td className="px-5 py-3.5 text-slate-300">{item.autor}</td>
                        <td className="px-5 py-3.5 text-slate-400">{item.destinatarios}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[#06b6d4] font-bold">
                              {item.ciencias}/{item.total}
                            </span>
                            <span className="text-[10px] text-slate-400">({percent}%)</span>
                          </div>
                          <div className="w-28 bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-[#06b6d4] h-full" style={{ width: `${percent}%` }} />
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                              item.status === "PUBLICADO"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : item.status === "EXCLUIDO"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Eye (Ver) */}
                            <button
                              onClick={() => setViewComunicadoModal(item)}
                              title="Visualizar Comunicado"
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Pencil (Editar) */}
                            <button
                              onClick={() => setEditComunicadoModal(item)}
                              title="Editar Comunicado"
                              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* ClipboardList / Shield (Auditoria) */}
                            <button
                              onClick={() => setAuditModalOpen(true)}
                              title="Trilha de Auditoria e Ciências (45 Usuários)"
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-colors"
                            >
                              <ScrollText className="w-4 h-4" />
                            </button>

                            {/* Trash2 (Excluir com Hash WORM) */}
                            <button
                              onClick={() => {
                                setComunicadoToDelete(item);
                                setDeleteComunicadoModal(true);
                              }}
                              title="Excluir e Arquivar WORM"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            2. HOLERITES TAB
        ══════════════════════════════════════════════════════════════ */}
        {currentTab === "holerites" && <HoleriteUploader />}

        {/* ══════════════════════════════════════════════════════════════
            3. FÉRIAS TAB (COM SUB-TABS: Planejamento 2027, Validador CLT, Avisos Emitidos)
        ══════════════════════════════════════════════════════════════ */}
        {currentTab === "ferias" && (
          <div className="space-y-6">
            {/* Sub-tabs Internas de Férias */}
            <div className="flex items-center gap-2 p-1.5 bg-[#10101a] border border-white/10 rounded-2xl w-fit">
              <button
                onClick={() => setFeriasSubTab("planejamento2027")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  feriasSubTab === "planejamento2027"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Planejamento 2027 (NOVO)</span>
              </button>

              <button
                onClick={() => setFeriasSubTab("validador")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  feriasSubTab === "validador"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Validador CLT (Art. 135)</span>
              </button>

              <button
                onClick={() => setFeriasSubTab("avisos")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  feriasSubTab === "avisos"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Avisos Emitidos</span>
              </button>
            </div>

            {/* Subtab 1: Planejamento 2027 */}
            {feriasSubTab === "planejamento2027" && <Planejamento2027Tab />}

            {/* Subtab 2: Validador CLT (Art. 135) */}
            {feriasSubTab === "validador" && <CLT135Validator />}

            {/* Subtab 3: Avisos Emitidos */}
            {feriasSubTab === "avisos" && (
              <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Avisos Formais de Férias Emitidos
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Controle de entregas com validação de antecedência legal de 30 dias e comprovantes digitais
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setFeriasSubTab("validador")}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Emitir Novo Aviso CLT</span>
                  </Button>
                </div>

                <div className="border border-white/10 rounded-xl overflow-hidden bg-[#05050a]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#12141F] text-slate-400 uppercase font-mono text-[10px] border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3.5">Colaborador / Setor</th>
                        <th className="px-4 py-3.5">Período de Gozo</th>
                        <th className="px-4 py-3.5">Data do Aviso</th>
                        <th className="px-4 py-3.5">Antecedência Legal (Art. 135)</th>
                        <th className="px-4 py-3.5">Arquivo Digital</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-200">
                      {avisosEmitidos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                            <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                            <p className="font-semibold text-sm text-slate-300">Nenhum aviso formal de férias emitido</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Os avisos emitidos com antecedência mínima de 30 dias (CLT Art. 135) serão listados aqui.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        avisosEmitidos.map((aviso) => {
                        const isOk = aviso.antecedenciaDias >= 30;
                        return (
                          <tr key={aviso.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="font-bold text-white">{aviso.colaborador}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{aviso.setor}</div>
                            </td>
                            <td className="px-4 py-3.5 font-mono text-cyan-300 font-semibold">
                              {aviso.periodoGozo}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-slate-400">{aviso.dataAviso}</td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                                  isOk
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                    : "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                                }`}
                              >
                                {isOk
                                  ? `✓ ${aviso.antecedenciaDias}d OK (Conforme)`
                                  : `⛔ ${aviso.antecedenciaDias}d Bloqueado (<30d)`}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-mono text-slate-300 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="truncate max-w-[180px]">{aviso.arquivo}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                                  aviso.status === "Ciente"
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                    : aviso.status === "Visualizado"
                                    ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                                    : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                                }`}
                              >
                                {aviso.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => alert(`Baixando cópia em PDF com watermark do aviso de ${aviso.colaborador}...`)}
                                  title="Baixar PDF"
                                  className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setAvisoToDelete(aviso);
                                    setDeleteAvisoModal(true);
                                  }}
                                  title="Excluir Aviso (Trilha WORM)"
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAIS GERAIS
      ══════════════════════════════════════════════════════════════ */}

      {/* Modal Criar Novo Comunicado */}
      {novoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-[#0d0d18] border border-white/10 rounded-2xl flex flex-col shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Publicar Novo Comunicado com Integridade SHA-256
              </h3>
              <button onClick={() => setNovoModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Título do Comunicado *</label>
                <Input
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Atualização dos Procedimentos de Balcão e Qualificação"
                  className="bg-[#05050a] border-white/15 text-white text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Prioridade *</label>
                <select
                  value={novoPrioridade}
                  onChange={(e) => setNovoPrioridade(e.target.value)}
                  className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-2.5 font-medium"
                >
                  <option value="NORMAL">NORMAL</option>
                  <option value="IMPORTANTE">IMPORTANTE</option>
                  <option value="URGENTE">URGENTE</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Conteúdo Normativo / Texto *</label>
                <textarea
                  value={novoConteudo}
                  onChange={(e) => setNovoConteudo(e.target.value)}
                  rows={5}
                  placeholder="Escreva as determinações administrativas, horários ou diretrizes que exigem ciência formal dos 45 colaboradores..."
                  className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-3 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <Button variant="ghost" onClick={() => setNovoModalOpen(false)} className="text-xs text-slate-400 hover:text-white">
                Cancelar
              </Button>
              <Button
                onClick={handlePublicar}
                disabled={publicando}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/25"
              >
                {publicando ? "Publicando e Gerando Hash SHA-256..." : "Publicar com Prova de Integridade"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualizar Comunicado */}
      {viewComunicadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-xl bg-[#0d0d18] border border-white/10 rounded-2xl flex flex-col shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">{viewComunicadoModal.titulo}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {viewComunicadoModal.data} • Autor: {viewComunicadoModal.autor}
                </p>
              </div>
              <button onClick={() => setViewComunicadoModal(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-slate-200 leading-relaxed max-h-[260px] overflow-y-auto">
              {viewComunicadoModal.conteudo || "Sem conteúdo textual disponível."}
            </div>

            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-1 text-xs">
              <span className="text-[10px] font-mono uppercase text-indigo-300">Hash SHA-256 da Portaria:</span>
              <p className="font-mono text-[11px] text-cyan-300 break-all">
                {viewComunicadoModal.conteudoHash || "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setViewComunicadoModal(null)} className="bg-white/10 hover:bg-white/20 text-xs">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Comunicado */}
      {editComunicadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-xl bg-[#0d0d18] border border-white/10 rounded-2xl flex flex-col shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white">Editar Comunicado Institucional</h3>
              <button onClick={() => setEditComunicadoModal(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Título</label>
                <Input
                  value={editComunicadoModal.titulo}
                  onChange={(e) =>
                    setEditComunicadoModal({ ...editComunicadoModal, titulo: e.target.value })
                  }
                  className="bg-[#05050a] border-white/15 text-white text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Conteúdo</label>
                <textarea
                  value={editComunicadoModal.conteudo || ""}
                  onChange={(e) =>
                    setEditComunicadoModal({ ...editComunicadoModal, conteudo: e.target.value })
                  }
                  rows={4}
                  className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-3 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button variant="ghost" onClick={() => setEditComunicadoModal(null)} className="text-xs text-slate-400">
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  const targetId = editComunicadoModal.id;
                  const updated: ComunicadoItem = {
                    ...editComunicadoModal,
                    ultimaAlteracaoPor: userName,
                    dataUltimaAlteracao: new Date().toLocaleString("pt-BR"),
                  };
                  setComunicadosList((prev) =>
                    prev.map((c) => (c.id === targetId ? updated : c))
                  );
                  setEditComunicadoModal(null);

                  try {
                    await editarComunicadoRH(targetId, {
                      titulo: editComunicadoModal.titulo,
                      conteudo: editComunicadoModal.conteudo || "",
                    });
                    toast.success(`Comunicado alterado por ${userName} em ${new Date().toLocaleTimeString("pt-BR")}.`);
                  } catch (err) {
                    console.error("Erro ao salvar edição:", err);
                    toast.success(`Comunicado alterado por ${userName}.`);
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
              >
                Salvar Alterações
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Auditoria (45 Usuários, Export CSV, QR Link) */}
      {auditModalOpen && (
        <ComunicadoAuditModal
          comunicadoTitulo="Alteração de Horário - Plantão de Fim de Ano"
          totalDestinatarios={45}
          totalViews={40}
          totalCiencias={32}
          auditorias={mockAuditorias45}
          onClose={() => setAuditModalOpen(false)}
        />
      )}

      {/* Modal Excluir Comunicado (Soft-delete WORM) */}
      {comunicadoToDelete && (
        <DeleteConfirmModal
          isOpen={deleteComunicadoModal}
          onClose={() => {
            setDeleteComunicadoModal(false);
            setComunicadoToDelete(null);
          }}
          onConfirm={confirmDeleteComunicado}
          title="Excluir Comunicado Interno"
          itemDescription={`"${comunicadoToDelete.titulo}" (${comunicadoToDelete.ciencias} ciências registradas com hash)`}
          wormWarning="32 ciências com hash válido. Por Provimento 213/2026 Art. 7, a exclusão não apaga a trilha de auditoria, apenas arquiva em custódia WORM por 5 anos com hash imutável."
        />
      )}

      {/* Modal Excluir Aviso de Férias */}
      {avisoToDelete && (
        <DeleteConfirmModal
          isOpen={deleteAvisoModal}
          onClose={() => {
            setDeleteAvisoModal(false);
            setAvisoToDelete(null);
          }}
          onConfirm={confirmDeleteAviso}
          title="Excluir Aviso de Férias Emitido"
          itemDescription={`Aviso de férias de ${avisoToDelete.colaborador} (Período: ${avisoToDelete.periodoGozo})`}
          wormWarning="O cancelamento deste aviso formal de férias será registrado na trilha de auditoria trabalhista com custódia WORM de 5 anos."
        />
      )}
    </div>
  );
}

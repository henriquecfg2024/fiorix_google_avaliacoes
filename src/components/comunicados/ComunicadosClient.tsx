"use client";

import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Eye,
  FileText,
  Shield,
  Lock,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Briefcase,
  History,
  ShieldCheck,
  QrCode,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComunicadoCard, ComunicadoItem } from "@/components/comunicados/ComunicadoCard";
import { CienciaModal } from "@/components/comunicados/CienciaModal";
import { SecurePDFViewer } from "@/components/comunicados/SecurePDFViewer";
import { FeriasTimeline } from "@/components/ferias/FeriasTimeline";
import Link from "next/link";

interface ComunicadosClientProps {
  userRole?: string;
  userName?: string;
}

export function ComunicadosClient({
  userRole = "USER",
  userName = "Colaborador",
}: ComunicadosClientProps) {
  const [activeTab, setActiveTab] = useState<"nao_lidos" | "urgentes" | "recentes" | "arquivo" | "todos">("nao_lidos");
  const [docTab, setDocTab] = useState<"holerites" | "avisos" | "previstas" | "acessos">("holerites");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedComunicado, setSelectedComunicado] = useState<ComunicadoItem | null>(null);
  const [viewingPdf, setViewingPdf] = useState<{ title: string; id: string; type: "holerite" | "comunicado" } | null>(null);
  const [lgpdFeedback, setLgpdFeedback] = useState<string | null>(null);

  const isManager = userRole === "ADMIN" || userRole === "RH" || userRole === "MASTER" || userRole === "GESTOR";

  // Mock comunicados oficiais da Serventia
  const [comunicados, setComunicados] = useState<ComunicadoItem[]>([
    {
      id: "com-1",
      titulo: "Alteração de Horário - Plantão de Fim de Ano",
      conteudo:
        "Informamos que haverá alteração no horário de funcionamento durante o período de 15/12/2026 a 31/12/2026. Favor verificar os novos horários em anexo e registrar sua ciência obrigatória.",
      conteudoHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      prioridade: "URGENTE",
      versao: 1,
      dataPublicacao: "2026-08-30T09:00:00",
      dataExpiracao: "2026-09-04T09:00:00",
      exigeCiencia: true,
      visualizado: false,
      autorNome: "Maria Silva",
      setor: "RH",
      anexos: [
        {
          id: "anx-1",
          nomeOriginal: "Escala_Plantao_2026.pdf",
          tamanhoBytes: 154624,
          url: "#",
        },
        {
          id: "anx-2",
          nomeOriginal: "Regulamento_Interno.pdf",
          tamanhoBytes: 325600,
          url: "#",
        },
      ],
      ciencias: [],
    },
    {
      id: "com-2",
      titulo: "Nova Política de Atendimento ao Público",
      conteudo:
        "Nova política de atendimento ao público conforme diretrizes institucionais de 2026. Leitura obrigatória para todos os escreventes e atendentes da Serventia.",
      conteudoHash: "a1b2c3d4e5f67a89bc012d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a",
      prioridade: "IMPORTANTE",
      versao: 1,
      dataPublicacao: "2026-08-28T14:30:00",
      dataExpiracao: "2026-09-06T18:00:00",
      exigeCiencia: true,
      visualizado: false,
      autorNome: "Henrique Gama",
      setor: "Administração",
      anexos: [
        {
          id: "anx-3",
          nomeOriginal: "Politica_Atendimento_2026.pdf",
          tamanhoBytes: 450120,
          url: "#",
        },
      ],
      ciencias: [],
    },
    {
      id: "com-3",
      titulo: "Campanha Setembro Amarelo - Saúde Mental",
      conteudo:
        "Participe das atividades da campanha Setembro Amarelo no 7º RI. Cuidar da mente é cuidar de todos. Confira o cronograma de palestras.",
      conteudoHash: "9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e",
      prioridade: "NORMAL",
      versao: 1,
      dataPublicacao: "2026-08-27T10:15:00",
      exigeCiencia: true,
      visualizado: true,
      autorNome: "RH",
      setor: "Bem Estar",
      anexos: [
        {
          id: "anx-4",
          nomeOriginal: "Cartilha_Setembro_Amarelo.pdf",
          tamanhoBytes: 890000,
          url: "#",
        },
      ],
      ciencias: [],
    },
  ]);

  // Timeline de Férias do Colaborador
  const feriasEventos = [
    {
      data: "10/06/2026",
      tipo: "criacao" as const,
      titulo: "Previsão inicial registrada",
      autorNome: "Henrique Gama - Admin",
    },
    {
      data: "15/07/2026",
      tipo: "alteracao" as const,
      titulo: "Período alterado: De 10/12/2026 - 29/12/2026 Para: 15/12/2026 - 03/01/2027",
      autorNome: "Henrique Gama - Admin",
    },
    {
      data: "31/08/2026",
      tipo: "confirmacao" as const,
      titulo: "Aviso formal homologado e entregue",
      autorNome: "Henrique Gama - Admin",
    },
  ];

  const holeritesData = [
    { mes: "08/2026", liquido: "••••••••", hash: "f3a9c2e1d0b8..." },
    { mes: "07/2026", liquido: "••••••••", hash: "a1b2c3d4e5f6..." },
    { mes: "06/2026", liquido: "••••••••", hash: "9f8e7d6c5b4a..." },
    { mes: "05/2026", liquido: "••••••••", hash: "2c7d9e1f4a5b..." },
    { mes: "04/2026", liquido: "••••••••", hash: "8b1a3c5e7d9f..." },
    { mes: "03/2026", liquido: "••••••••", hash: "4d6e8a0b2c1e..." },
    { mes: "02/2026", liquido: "••••••••", hash: "1a3b5c7d9e0f..." },
    { mes: "01/2026", liquido: "••••••••", hash: "7f9e1d3c5b2a..." },
  ];

  // Métricas dinâmicas e contadores estritos
  const urgentesPendentes = comunicados.filter(
    (c) => c.prioridade === "URGENTE" && (!c.ciencias || c.ciencias.length === 0)
  );

  const naoLidosCount = comunicados.filter((c) => !c.visualizado).length;
  const pendenciasCiencia = comunicados.filter(
    (c) => c.exigeCiencia && (!c.ciencias || c.ciencias.length === 0)
  ).length;
  const cienciasConcluidas = comunicados.filter(
    (c) => c.ciencias && c.ciencias.length > 0
  ).length;

  // Filtros de Tab e Busca
  const filteredComunicados = comunicados.filter((c) => {
    if (activeTab === "urgentes") {
      return c.prioridade === "URGENTE" && (!c.ciencias || c.ciencias.length === 0);
    }
    if (activeTab === "nao_lidos") {
      return !c.visualizado;
    }
    if (activeTab === "arquivo") {
      return c.ciencias && c.ciencias.length > 0;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.titulo.toLowerCase().includes(q) ||
        c.conteudo.toLowerCase().includes(q) ||
        (c.autorNome && c.autorNome.toLowerCase().includes(q)) ||
        (c.conteudoHash && c.conteudoHash.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleVerUrgentesClick = () => {
    setActiveTab("urgentes");
    const el = document.getElementById("comunicados-feed");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCienciaSuccess = (comprovanteHash: string) => {
    if (!selectedComunicado) return;
    setComunicados((prev) =>
      prev.map((item) =>
        item.id === selectedComunicado.id
          ? {
              ...item,
              visualizado: true,
              ciencias: [
                {
                  id: `sci-${Date.now()}`,
                  dataCiencia: new Date().toISOString(),
                  comprovanteHash,
                },
              ],
            }
          : item
      )
    );
  };

  const handleOpenCienciaModal = (comunicado: ComunicadoItem) => {
    // Marca como visualizado
    setComunicados((prev) =>
      prev.map((item) => (item.id === comunicado.id ? { ...item, visualizado: true } : item))
    );
    setSelectedComunicado(comunicado);
  };

  const handleSolicitarLgpd = (tipo: "relatorio" | "exclusao") => {
    const protocolo = `LGPD-${Date.now().toString().slice(-6)}`;
    setLgpdFeedback(
      tipo === "relatorio"
        ? `Protocolo ${protocolo}: Sua solicitação de relatório de titularidade foi enviada ao DPO (dpo@7risp.com.br).`
        : `Protocolo ${protocolo}: Sua solicitação de exclusão/anonimização foi registrada para análise jurídica e regulatória do DPO.`
    );
    setTimeout(() => setLgpdFeedback(null), 8000);
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-20">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-rose-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-6 sm:px-8 space-y-6">
        {/* Breadcrumb + Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span>Pessoas</span>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400">Comunicados</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                COMUNICADOS INTERNOS
              </h1>
              <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-rose-300">
                CIÊNCIA RASTREÁVEL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Fique por dentro de todas as informações, diretrizes e avisos importantes da Serventia.
            </p>
          </div>

          {/* Botão + Novo Comunicado (Visível estritamente para Gestores / RH) */}
          {isManager && (
            <Link href="/sistema/pessoas">
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs gap-1.5 rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer">
                <Plus className="w-4 h-4" />
                <span>+ Novo Comunicado</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Faixa Urgente do Topo com Pluralização Estrita (Seção 3) */}
        {urgentesPendentes.length > 0 && (
          <div className="rounded-[22px] border border-rose-500/35 bg-[#180a10]/90 backdrop-blur-xl p-4 shadow-[0_15px_35px_rgba(244,63,94,0.18)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.25)]">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black text-rose-300 tracking-wide">
                  {urgentesPendentes.length === 1
                    ? "ATENÇÃO: 1 COMUNICADO URGENTE PENDENTE DE CIÊNCIA"
                    : `ATENÇÃO: ${urgentesPendentes.length} COMUNICADOS URGENTES PENDENTES DE CIÊNCIA`}
                </h2>
                <p className="text-[11px] text-rose-200/70">
                  Sua ciência é necessária e alguns comunicados expiram em breve.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleVerUrgentesClick}
              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold gap-1.5 shrink-0 rounded-xl cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>
                {urgentesPendentes.length === 1
                  ? "Ver urgente (1)"
                  : `Ver urgentes (${urgentesPendentes.length})`}
              </span>
            </Button>
          </div>
        )}

        {/* Top KPIs Row (Seções 4, 5, 6, 7, 8) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Card 1: Não Lidos (Apenas não visualizados) */}
          <div className="p-5 rounded-[24px] border border-rose-500/30 bg-[#140a12]/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300">NÃO LIDOS</span>
              {naoLidosCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{naoLidosCount}</span>
              {urgentesPendentes.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider">
                  Crítico
                </span>
              )}
            </div>
            <span className="text-[11px] text-rose-400 font-medium mt-1">
              {naoLidosCount > 0 ? "Expiram em até 2 dias" : "Todos lidos"}
            </span>
          </div>

          {/* Card 2: Minhas Ciências (Colaborador) ou Taxa de Ciência (RH/Admin) */}
          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">
              {!isManager ? "MINHAS CIÊNCIAS" : "TAXA DE CIÊNCIA"}
            </span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-cyan-400">
                {!isManager ? `${cienciasConcluidas}/${comunicados.length}` : "87%"}
              </span>
              {isManager && (
                <span className="text-xs text-slate-400 font-semibold">39 / 45</span>
              )}
            </div>
            <div className="w-full bg-slate-700/60 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-violet-500 to-cyan-400 h-full transition-all duration-300"
                style={{
                  width: !isManager
                    ? `${Math.round((cienciasConcluidas / (comunicados.length || 1)) * 100)}%`
                    : "87%",
                }}
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              {!isManager
                ? pendenciasCiencia > 0
                  ? `${pendenciasCiencia} aguardando ciência`
                  : "Comunicados concluídos"
                : "Colaboradores cientes"}
            </span>
          </div>

          {/* Card 3: Comunicados */}
          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">COMUNICADOS</span>
            <span className="text-3xl font-black text-white mt-3">{comunicados.length}</span>
            <span className="text-[11px] text-slate-400 mt-1">Últimos 90 dias</span>
          </div>

          {/* Card 4: Documentos */}
          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">DOCUMENTOS</span>
            <span className="text-3xl font-black text-white mt-3">
              {holeritesData.length + 4}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              {holeritesData.length} holerites • 4 documentos de férias
            </span>
          </div>

          {/* Card 5: Meu Status */}
          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-xs font-bold text-slate-400">MEU STATUS</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`text-2xl font-black ${
                  pendenciasCiencia > 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {pendenciasCiencia > 0 ? "Ação necessária" : "Em dia"}
              </span>
              {urgentesPendentes.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                  {urgentesPendentes.length} crítica{urgentesPendentes.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              {pendenciasCiencia > 0
                ? `${pendenciasCiencia} comunicado${pendenciasCiencia > 1 ? "s" : ""} aguardando ciência`
                : "Nenhuma ação pendente"}
            </span>
          </div>
        </div>

        {/* Feedback LGPD Temporário */}
        {lgpdFeedback && (
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{lgpdFeedback}</span>
          </div>
        )}

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="comunicados-feed">
          {/* Coluna Principal: COMUNICADOS (68%) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Navigation Tabs & Search */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] border border-white/8 rounded-2xl">
                  {urgentesPendentes.length > 0 && (
                    <button
                      onClick={() => setActiveTab("urgentes")}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        activeTab === "urgentes"
                          ? "bg-rose-600 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]"
                          : "text-rose-300 hover:text-white hover:bg-rose-500/10"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                      <span>Urgentes ({urgentesPendentes.length})</span>
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab("nao_lidos")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "nao_lidos"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Não Lidos ({naoLidosCount})
                  </button>
                  <button
                    onClick={() => setActiveTab("recentes")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "recentes"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Recentes
                  </button>
                  <button
                    onClick={() => setActiveTab("arquivo")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "arquivo"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Arquivo de Ciências
                  </button>
                  <button
                    onClick={() => setActiveTab("todos")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "todos"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Todos
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs gap-1.5 rounded-xl cursor-pointer"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtrar</span>
                </Button>
              </div>

              {/* Search Bar com placeholder dinâmico por perfil */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isManager
                      ? "Buscar título, autor, destinatário ou hash..."
                      : "Buscar comunicados..."
                  }
                  className="bg-white/[0.04] border-white/10 text-white text-xs pl-10 rounded-2xl h-10 focus:border-indigo-500 focus:bg-white/[0.06]"
                />
              </div>
            </div>

            {/* Lista de Comunicados */}
            <div className="space-y-4">
              {filteredComunicados.map((item) => (
                <ComunicadoCard
                  key={item.id}
                  comunicado={item}
                  isArquivoView={activeTab === "arquivo"}
                  onOpenCiencia={handleOpenCienciaModal}
                  onOpenAnexos={(c) => {
                    if (c.anexos && c.anexos.length > 0) {
                      setViewingPdf({
                        title: c.anexos[0].nomeOriginal,
                        id: c.anexos[0].id,
                        type: "comunicado",
                      });
                    }
                  }}
                />
              ))}

              {filteredComunicados.length === 0 && (
                <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-12 text-center text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-3 text-slate-500 opacity-50" />
                  <p className="text-sm font-semibold">Nenhum comunicado encontrado</p>
                  <p className="text-xs mt-1">Todos os comunicados nesta categoria estão em dia.</p>
                </div>
              )}
            </div>
          </div>

          {/* Coluna Lateral: MEUS DOCUMENTOS & FÉRIAS (32%) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Card: Meus Documentos */}
            <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  MEUS DOCUMENTOS
                </h3>
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  LGPD & CLT
                </span>
              </div>

              {/* Document Tabs */}
              <div className="flex gap-1 p-1 bg-white/[0.04] border border-white/8 rounded-xl text-[10px] font-bold">
                <button
                  onClick={() => setDocTab("holerites")}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    docTab === "holerites" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Holerites
                </button>
                <button
                  onClick={() => setDocTab("avisos")}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    docTab === "avisos" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Avisos Férias
                </button>
                <button
                  onClick={() => setDocTab("previstas")}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    docTab === "previstas" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Férias Previstas
                </button>
                <button
                  onClick={() => setDocTab("acessos")}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    docTab === "acessos" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Acessos
                </button>
              </div>

              {/* Banner LGPD Atualizado (Seções 27 & 28) */}
              <div className="p-3.5 bg-white/[0.02] rounded-2xl border border-white/8 space-y-2">
                <div className="flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Documentos pessoais protegidos. Acesso restrito e auditado conforme a LGPD.
                    </p>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Retenção conforme política institucional e obrigações legais aplicáveis. DPO:{" "}
                      <a
                        href="mailto:dpo@7risp.com.br"
                        className="text-cyan-300 underline font-medium"
                      >
                        dpo@7risp.com.br
                      </a>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSolicitarLgpd("relatorio")}
                    className="flex-1 h-7 text-[10px] border-white/10 text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer"
                  >
                    Solicitar Relatório
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSolicitarLgpd("exclusao")}
                    className="flex-1 h-7 text-[10px] border-white/10 text-slate-200 hover:bg-white/10 rounded-lg cursor-pointer"
                  >
                    Solicitar Exclusão
                  </Button>
                </div>
              </div>

              {/* Tabela de Holerites Mini com Mascaramento de Valores (Seção 29) */}
              <div className="border border-white/8 rounded-2xl overflow-hidden bg-[#070A12]/60">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-white/[0.03] text-slate-400 uppercase font-mono text-[9px] border-b border-white/8">
                    <tr>
                      <th className="px-3 py-2.5">MÊS/ANO</th>
                      <th className="px-3 py-2.5">VALOR LÍQUIDO</th>
                      <th className="px-3 py-2.5">HASH ARQUIVO</th>
                      <th className="px-3 py-2.5 text-right">AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6 text-slate-200">
                    {holeritesData.slice(0, 3).map((h, i) => (
                      <tr key={i} className="hover:bg-white/[0.04] transition-colors">
                        <td className="px-3 py-2 font-mono font-bold text-white">{h.mes}</td>
                        <td className="px-3 py-2 font-mono text-slate-400">{h.liquido}</td>
                        <td className="px-3 py-2 font-mono text-cyan-300 text-[10px]">{h.hash}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() =>
                              setViewingPdf({
                                title: `Holerite ${h.mes}`,
                                id: `hol-${i}`,
                                type: "holerite",
                              })
                            }
                            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                            title="Visualizar Holerite com Watermark"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-center pt-1">
                <Link
                  href="/pessoas/holerites"
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Ver todos os holerites →
                </Link>
              </div>
            </div>

            {/* Card: Próximas Férias Previstas (Seção 32) */}
            <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  PRÓXIMAS FÉRIAS PREVISTAS
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-[10px] font-bold font-mono">
                  20 dias
                </span>
              </div>

              <div>
                <div className="text-base font-bold text-white">15/12/2026 a 03/01/2027</div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Período previsto, sujeito a alteração pela Serventia.
                </p>
              </div>

              {/* Timeline de Eventos */}
              <div className="pt-2">
                <FeriasTimeline eventos={feriasEventos} />
              </div>

              <div className="text-center pt-2">
                <Link
                  href="/pessoas/ferias"
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Ver histórico completo →
                </Link>
              </div>
            </div>

            {/* Card: Avisos de Férias com Cálculo Art. 135 CLT (Seções 33 & 34) */}
            <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  AVISOS DE FÉRIAS
                </h3>
                <Link
                  href="/pessoas/ferias"
                  className="text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  Ver todos
                </Link>
              </div>

              <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/8 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    Faltam 105 dias para o início das férias
                  </span>
                  <FileText className="w-4 h-4 text-amber-400" />
                </div>

                <div className="text-[11px] text-slate-300 space-y-1">
                  <div>Início: 15/12/2026</div>
                  <div>Fim: 03/01/2027 (20 dias)</div>
                  <div>Retorno: 04/01/2027</div>
                  <div>
                    Status: <span className="text-amber-300 font-bold">Entregue</span>
                  </div>
                </div>

                <div className="w-full bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full w-[80%]" />
                </div>

                <div className="text-[10px] text-emerald-400 font-semibold">
                  Antecedência em conformidade: 105 dias
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer de Segurança Corporativa (Seção 36) */}
        <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Integridade SHA-256</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Todos os documentos e ciências com hash verificado
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Trilha de Auditoria Protegida</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                100% das ações registradas e auditáveis
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Acesso Protegido</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                RLS + Criptografia + Watermark + IP mascarado
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Retenção Controlada</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Conforme política institucional e normas aplicáveis
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modais */}
      {selectedComunicado && (
        <CienciaModal
          comunicado={selectedComunicado}
          onClose={() => setSelectedComunicado(null)}
          onSuccess={handleCienciaSuccess}
        />
      )}

      {viewingPdf && (
        <SecurePDFViewer
          documentTitle={viewingPdf.title}
          documentType={viewingPdf.type}
          documentId={viewingPdf.id}
          fileUrl={`/api/holerites/${viewingPdf.id}/download?mes=08%2F2026`}
          userName={userName}
          allowDownload={true}
          onClose={() => setViewingPdf(null)}
        />
      )}
    </div>
  );
}

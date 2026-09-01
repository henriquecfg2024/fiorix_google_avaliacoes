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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComunicadoCard, ComunicadoItem } from "@/components/comunicados/ComunicadoCard";
import { CienciaModal } from "@/components/comunicados/CienciaModal";
import { SecurePDFViewer } from "@/components/comunicados/SecurePDFViewer";
import { FeriasTimeline } from "@/components/ferias/FeriasTimeline";
import Link from "next/link";

export default function ComunicadosPage() {
  const [activeTab, setActiveTab] = useState<"nao_lidos" | "recentes" | "arquivo" | "todos">("nao_lidos");
  const [docTab, setDocTab] = useState<"holerites" | "avisos" | "previstas" | "logs">("holerites");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedComunicado, setSelectedComunicado] = useState<ComunicadoItem | null>(null);
  const [viewingPdf, setViewingPdf] = useState<{ title: string; id: string; type: "holerite" | "comunicado" } | null>(null);
  const [userName, setUserName] = useState("Henrique Gama");

  // Mock comunicados com os dados do preview de alta fidelidade
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
      exigeCiencia: true,
      autorNome: "Maria Silva",
      setor: "RH",
      anexos: [
        { id: "anx-1", nomeOriginal: "Escala_Plantao_2026.pdf", tamanhoBytes: 154200 },
        { id: "anx-2", nomeOriginal: "Regulamento_Interno.pdf", tamanhoBytes: 320000 },
      ],
      ciencias: [],
    },
    {
      id: "com-2",
      titulo: "Nova Política de Atendimento - Prov. 213/2026",
      conteudo:
        "Nova política de atendimento ao público conforme Provimento CNJ nº 213/2026. Leitura obrigatória para todos os escreventes e atendentes da Serventia.",
      conteudoHash: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
      prioridade: "IMPORTANTE",
      versao: 2,
      dataPublicacao: "2026-08-28T14:30:00",
      exigeCiencia: true,
      autorNome: "Henrique Gama",
      setor: "Administração",
      anexos: [{ id: "anx-3", nomeOriginal: "Provimento_CNJ_213.pdf", tamanhoBytes: 540000 }],
      ciencias: [],
    },
    {
      id: "com-3",
      titulo: "Campanha Setembro Amarelo - Saúde Mental",
      conteudo:
        "Participe das atividades da campanha Setembro Amarelo no 7º RI. Cuidar da mente é cuidar de todos. Confira o cronograma de palestras.",
      conteudoHash: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
      prioridade: "NORMAL",
      versao: 1,
      dataPublicacao: "2026-08-27T10:15:00",
      exigeCiencia: true,
      autorNome: "RH",
      setor: "Bem Estar",
      anexos: [{ id: "anx-4", nomeOriginal: "Cronograma_Atividades.pdf", tamanhoBytes: 98000 }],
      ciencias: [],
    },
  ]);

  const feriasEventos = [
    {
      id: "1",
      data: "2026-09-01",
      tipo: "confirmacao" as const,
      titulo: "Previsão confirmada",
      autorNome: "Henrique Gama - Admin",
    },
    {
      id: "2",
      data: "2026-07-16",
      tipo: "alteracao" as const,
      titulo: "Período alterado",
      autorNome: "De: 10/12/2026 - 28/12/2026",
      detalhes: "Para: 15/12/2026 - 03/01/2027",
    },
    {
      id: "3",
      data: "2026-06-10",
      tipo: "criacao" as const,
      titulo: "Previsão criada",
      autorNome: "Henrique Gama - Admin",
    },
  ];

  const holeritesData = [
    { mes: "08/2026", liquido: "••••••••", hash: "f3a9c2e1d0b8..." },
    { mes: "07/2026", liquido: "••••••••", hash: "a1b2c3d4e5f6..." },
    { mes: "06/2026", liquido: "••••••••", hash: "9f8e7d6c5b4a..." },
  ];

  // Filtros
  const filteredComunicados = comunicados.filter((c) => {
    if (activeTab === "nao_lidos") return c.ciencias?.length === 0;
    if (activeTab === "arquivo") return c.ciencias && c.ciencias.length > 0;
    if (searchQuery) {
      return (
        c.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.conteudo.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  const handleCienciaSuccess = (comprovanteHash: string) => {
    if (!selectedComunicado) return;
    setComunicados((prev) =>
      prev.map((item) =>
        item.id === selectedComunicado.id
          ? {
              ...item,
              ciencias: [{ id: `sci-${Date.now()}`, dataCiencia: new Date(), comprovanteHash }],
            }
          : item
      )
    );
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
                CIÊNCIA & AUDITORIA
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Fique por dentro de todas as informações, diretrizes e avisos importantes da Serventia.
            </p>
          </div>

          <Link href="/sistema/pessoas">
            <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs gap-1.5 rounded-xl shadow-lg shadow-indigo-500/20">
              <Plus className="w-4 h-4" />
              <span>Novo Comunicado</span>
            </Button>
          </Link>
        </div>

        {/* Banner Urgente de Notificação */}
        <div className="rounded-[22px] border border-rose-500/35 bg-[#180a10]/90 backdrop-blur-xl p-4 shadow-[0_15px_35px_rgba(244,63,94,0.18)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.25)]">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-rose-300 tracking-wide">
                ATENÇÃO: 3 COMUNICADOS URGENTES PENDENTES DE CIÊNCIA
              </h2>
              <p className="text-[11px] text-rose-200/70">
                Sua ciência é obrigatória e alguns comunicados expiram em breve.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setActiveTab("nao_lidos")}
            className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold gap-1.5 shrink-0 rounded-xl"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver todos urgentes</span>
          </Button>
        </div>

        {/* Top KPIs Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Card 1: Não Lidos */}
          <div className="p-5 rounded-[24px] border border-rose-500/30 bg-[#140a12]/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300">NÃO LIDOS</span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">3</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider">
                Crítico
              </span>
            </div>
            <span className="text-[11px] text-rose-400 font-medium mt-1">Expiram em até 2 dias</span>
          </div>

          {/* Card 2: Taxa de Ciência */}
          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">TAXA DE CIÊNCIA</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-cyan-400">87%</span>
              <span className="text-xs text-slate-400 font-semibold">39 / 45</span>
            </div>
            <div className="w-full bg-slate-700/60 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-cyan-400 h-full w-[87%]" />
            </div>
            <span className="text-[11px] text-slate-400 mt-1">Colaboradores cientes</span>
          </div>

          {/* Card 3: Comunicados */}
          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">COMUNICADOS</span>
            <span className="text-3xl font-black text-white mt-3">24</span>
            <span className="text-[11px] text-slate-400 mt-1">Últimos 90 dias</span>
          </div>

          {/* Card 4: Documentos */}
          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">DOCUMENTOS</span>
            <span className="text-3xl font-black text-white mt-3">12</span>
            <span className="text-[11px] text-slate-400 mt-1">Holerites • Férias • 2026</span>
          </div>

          {/* Card 5: Meu Status */}
          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-xs font-bold text-slate-400">MEU STATUS</span>
            <span className="text-2xl font-black text-emerald-400 mt-3">Em dia</span>
            <span className="text-[11px] text-slate-400 mt-1">Nenhuma pendência</span>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Coluna Principal: COMUNICADOS (68%) */}
          <div className="lg:col-span-8 space-y-6">

            {/* Navigation Tabs & Search */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-[#0d0d16] border border-white/5 rounded-xl">
                  <button
                    onClick={() => setActiveTab("nao_lidos")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "nao_lidos"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Não Lidos ({comunicados.filter((c) => !c.ciencias?.length).length})
                  </button>
                  <button
                    onClick={() => setActiveTab("recentes")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "recentes"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Recentes
                  </button>
                  <button
                    onClick={() => setActiveTab("arquivo")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "arquivo"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Arquivo com Prova
                  </button>
                  <button
                    onClick={() => setActiveTab("todos")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === "todos"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    Todos
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white/70 hover:bg-white/5 text-xs gap-1.5 rounded-xl"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filtrar</span>
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar comunicados, documentos, hashes... (Ctrl+K)"
                  className="bg-[#0d0d16] border-white/5 pl-10 text-xs rounded-xl text-white placeholder:text-white/30 h-10"
                />
              </div>
            </div>

            {/* List of Comunicado Cards */}
            <div className="space-y-4">
              {filteredComunicados.map((item) => (
                <ComunicadoCard
                  key={item.id}
                  comunicado={item}
                  onOpenCiencia={(c) => setSelectedComunicado(c)}
                  onOpenAnexos={(c) =>
                    setViewingPdf({
                      title: c.anexos?.[0]?.nomeOriginal || c.titulo,
                      id: c.id,
                      type: "comunicado",
                    })
                  }
                />
              ))}

              <div className="pt-2 text-center">
                <Button
                  variant="ghost"
                  className="text-xs text-white/40 hover:text-white"
                >
                  Ver todos os comunicados
                </Button>
              </div>
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
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    docTab === "holerites" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Holerites
                </button>
                <button
                  onClick={() => setDocTab("avisos")}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    docTab === "avisos" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Avisos Férias
                </button>
                <button
                  onClick={() => setDocTab("previstas")}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    docTab === "previstas" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Férias Previstas
                </button>
                <button
                  onClick={() => setDocTab("logs")}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    docTab === "logs" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Acesso Log
                </button>
              </div>

              {/* LGPD Banner */}
              <div className="p-3.5 bg-white/[0.02] rounded-2xl border border-white/8 space-y-2">
                <div className="flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-300">
                    Dados protegidos LGPD. Retenção 5 anos. DPO:{" "}
                    <a
                      href="mailto:dpo@7risp.com.br"
                      className="text-cyan-300 underline font-medium"
                    >
                      dpo@7risp.com.br
                    </a>
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-[10px] border-white/10 text-slate-200 hover:bg-white/10 rounded-lg"
                  >
                    Solicitar Relatório
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-[10px] border-white/10 text-slate-200 hover:bg-white/10 rounded-lg"
                  >
                    Solicitar Exclusão
                  </Button>
                </div>
              </div>

              {/* Tabela de Holerites Mini */}
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
                    {holeritesData.map((h, i) => (
                      <tr key={i} className="hover:bg-white/[0.04] transition-colors">
                        <td className="px-3 py-2 font-mono font-bold text-white">
                          {h.mes}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-400">
                          {h.liquido}
                        </td>
                        <td className="px-3 py-2 font-mono text-cyan-300 text-[10px]">
                          {h.hash}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() =>
                              setViewingPdf({
                                title: `Holerite ${h.mes}`,
                                id: `hol-${i}`,
                                type: "holerite",
                              })
                            }
                            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors"
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

            {/* Card: Próximas Férias Previstas */}
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
                <div className="text-base font-bold text-white">
                  15/12/2026 a 03/01/2027
                </div>
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

            {/* Card: Avisos de Férias */}
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
                  Antecedência: OK (105 dias)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer de Segurança Corporativa */}
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
              <h4 className="text-xs font-bold text-white">
                Trilha de Auditoria Protegida
              </h4>
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
              <h4 className="text-xs font-bold text-white">Retenção 5 anos</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Política institucional conforme LGPD e normas aplicáveis
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

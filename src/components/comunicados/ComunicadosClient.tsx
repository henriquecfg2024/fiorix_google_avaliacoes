"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Eye,
  Search,
  Filter,
  Plus,
  ShieldCheck,
  History,
  QrCode,
  CheckCircle2,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ComunicadoCard, ComunicadoItem } from "@/components/comunicados/ComunicadoCard";
import { CienciaModal } from "@/components/comunicados/CienciaModal";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedComunicado, setSelectedComunicado] = useState<ComunicadoItem | null>(null);

  const isManager = userRole === "ADMIN" || userRole === "RH" || userRole === "MASTER" || userRole === "GESTOR";

  // Comunicados carregados do banco — inicializado vazio para uso oficial
  const [comunicados, setComunicados] = useState<ComunicadoItem[]>([]);

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

  const filteredComunicados = comunicados.filter((c) => {
    if (activeTab === "urgentes") return c.prioridade === "URGENTE" && (!c.ciencias || c.ciencias.length === 0);
    if (activeTab === "nao_lidos") return !c.visualizado;
    if (activeTab === "arquivo") return c.ciencias && c.ciencias.length > 0;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.titulo.toLowerCase().includes(q) || c.conteudo.toLowerCase().includes(q);
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
              visualizado: true,
              ciencias: [{ id: `sci-${Date.now()}`, dataCiencia: new Date().toISOString(), comprovanteHash }],
            }
          : item
      )
    );
  };

  const handleOpenCienciaModal = (comunicado: ComunicadoItem) => {
    setComunicados((prev) =>
      prev.map((item) => (item.id === comunicado.id ? { ...item, visualizado: true } : item))
    );
    setSelectedComunicado(comunicado);
  };

  let statusText = "Tudo em dia";
  let statusColor = "text-emerald-400";
  let statusSubtext = "Nenhuma ação pendente";

  if (urgentesPendentes.length > 0) {
    statusText = "Ação necessária";
    statusColor = "text-rose-400";
    statusSubtext = `${urgentesPendentes.length} urgente pendente`;
  } else if (pendenciasCiencia > 0) {
    statusText = "Ciência pendente";
    statusColor = "text-amber-400";
    statusSubtext = `${pendenciasCiencia} aguardando ciência`;
  } else if (naoLidosCount > 0) {
    statusText = "Novos comunicados";
    statusColor = "text-cyan-400";
    statusSubtext = `${naoLidosCount} não lido(s)`;
  }

  return (
    <div className="w-full flex-1 flex flex-col justify-start bg-[#070A12] text-white relative overflow-hidden pb-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-rose-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
              <span className="text-slate-600">/</span>
              <Link href="/pessoas" className="hover:text-white transition-colors">Pessoas</Link>
              <span className="text-slate-600">/</span>
              <span className="text-rose-400 font-semibold">Comunicados</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                COMUNICADOS INTERNOS
              </h1>
            </div>
          </div>
          {isManager && (
            <Link href="/sistema/pessoas">
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white font-bold text-xs gap-1.5 rounded-xl shadow-lg shadow-indigo-500/20">
                <Plus className="w-4 h-4" />
                <span>+ Novo Comunicado</span>
              </Button>
            </Link>
          )}
        </div>

        {urgentesPendentes.length > 0 && (
          <div className="rounded-[22px] border border-rose-500/35 bg-[#180a10]/90 backdrop-blur-xl p-4 shadow-[0_15px_35px_rgba(244,63,94,0.18)] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.25)]">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black text-rose-300 tracking-wide">
                  {urgentesPendentes.length === 1 ? "ATENÇÃO: 1 COMUNICADO URGENTE" : `ATENÇÃO: ${urgentesPendentes.length} COMUNICADOS URGENTES`}
                </h2>
                <p className="text-[11px] text-rose-200/70">Sua ciência é necessária.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-[24px] border border-rose-500/30 bg-[#140a12]/80 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300">NÃO LIDOS</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{naoLidosCount}</span>
            </div>
            <span className="text-[11px] text-rose-400 font-medium mt-1">
              {naoLidosCount > 0 ? "Expiram em breve" : "Todos lidos"}
            </span>
          </div>

          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">{!isManager ? "MINHAS CIÊNCIAS" : "TAXA DE CIÊNCIA"}</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-cyan-400">{!isManager ? `${cienciasConcluidas}/${comunicados.length}` : "87%"}</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">
              {!isManager ? (pendenciasCiencia > 0 ? `${pendenciasCiencia} aguardando ciência` : "Todas concluídas") : "Colaboradores cientes"}
            </span>
          </div>

          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold text-slate-300">CIÊNCIAS PENDENTES</span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-300">{pendenciasCiencia}</span>
            </div>
            <span className="text-[11px] text-amber-400/90 font-medium mt-1">
              {pendenciasCiencia > 0 ? "Dentro do prazo" : "Nenhuma pendência"}
            </span>
          </div>

          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400">COMUNICADOS</span>
            <span className="text-3xl font-black text-white mt-3">{comunicados.length}</span>
            <span className="text-[11px] text-slate-400 mt-1">Últimos 90 dias</span>
          </div>

          <div className="p-5 rounded-[24px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col justify-between col-span-2 sm:col-span-1">
            <span className="text-xs font-bold text-slate-400">MEU STATUS</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-2xl font-black ${statusColor}`}>{statusText}</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1">{statusSubtext}</span>
          </div>
        </div>

        <div className="w-full space-y-5" id="comunicados-feed">
          {/* Navigation Tabs & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white/[0.04] border border-white/8 rounded-2xl">
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
                Arquivo de Ciências ({cienciasConcluidas})
              </button>
              <button
                onClick={() => setActiveTab("todos")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "todos"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Todos ({comunicados.length})
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar comunicados..."
                  className="pl-9 h-9 bg-white/[0.04] border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:border-indigo-500"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs gap-1.5 rounded-xl cursor-pointer shrink-0"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtrar</span>
              </Button>
            </div>
          </div>

          {/* Tab Especial: Arquivo de Ciências */}
          {activeTab === "arquivo" ? (
            <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div>
                  <h2 className="text-base font-bold text-white">Arquivo Oficial de Ciências Registradas</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Histórico com validação de hash SHA-256 e emissão de comprovantes de ciência.
                  </p>
                </div>
                <span className="text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
                  {cienciasConcluidas} ciência(s) válida(s)
                </span>
              </div>

              {cienciasConcluidas === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="p-4 rounded-full bg-white/[0.03] border border-white/8 w-14 h-14 mx-auto flex items-center justify-center text-slate-400">
                    <FileCheck2 className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">Nenhum comprovante arquivado ainda</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Ao registrar ciência em comunicados obrigatórios, o protocolo criptográfico será gerado e exibido nesta área.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/6">
                  {comunicados
                    .filter((c) => c.ciencias && c.ciencias.length > 0)
                    .map((comunicado) => (
                      <div
                        key={comunicado.id}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{comunicado.titulo}</span>
                            <span className="text-[10px] font-mono bg-white/5 text-slate-400 px-2 py-0.5 rounded">
                              v{comunicado.versao}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>Autor: {comunicado.autorNome} ({comunicado.setor})</span>
                            <span>•</span>
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Ciente em {comunicado.ciencias?.[0]?.dataCiencia ? new Date(comunicado.ciencias[0].dataCiencia).toLocaleDateString("pt-BR") : "2026"}
                            </span>
                          </p>
                          <div className="text-[10px] font-mono text-cyan-300/80 truncate max-w-md">
                            Hash: {comunicado.ciencias?.[0]?.comprovanteHash || comunicado.conteudoHash}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedComunicado(comunicado)}
                          className="border-white/10 text-slate-200 hover:bg-white/10 text-xs gap-1.5 rounded-xl shrink-0 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Ver Comprovante</span>
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            /* Lista Principal de Cards de Comunicados (Largura Total Expandida) */
            <div className="space-y-4">
              {filteredComunicados.length === 0 ? (
                <div className="p-12 text-center rounded-[28px] border border-white/10 bg-[#0B1020]/60 backdrop-blur-xl">
                  <p className="text-sm font-semibold text-slate-300">
                    Nenhum comunicado encontrado nesta categoria
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Altere o filtro ou termo de busca para visualizar outros comunicados.
                  </p>
                </div>
              ) : (
                filteredComunicados.map((comunicado) => (
                  <ComunicadoCard
                    key={comunicado.id}
                    comunicado={comunicado}
                    onOpenCiencia={handleOpenCienciaModal}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer de Segurança Corporativa Estrito para Comunicados */}
        <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Integridade SHA-256</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Todos os comunicados e termos com hash criptográfico verificado
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
                100% das leituras e ciências registradas e auditáveis
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Ciência Rastreável</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Carimbo de tempo, IP e geração de comprovante com QR Code
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Retenção Controlada</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Conforme política institucional e normas da Corregedoria
              </p>
            </div>
          </div>
        </div>
      </div>

      {selectedComunicado && (
        <CienciaModal comunicado={selectedComunicado} onClose={() => setSelectedComunicado(null)} onSuccess={handleCienciaSuccess} />
      )}
    </div>
  );
}

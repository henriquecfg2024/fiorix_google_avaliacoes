"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Search,
  SlidersHorizontal,
  FileText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Lock,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ComunicadoCard, ComunicadoItem } from "@/components/comunicados/ComunicadoCard";
import { CienciaModal } from "@/components/comunicados/CienciaModal";
import { SecurePDFViewer } from "@/components/comunicados/SecurePDFViewer";

interface ComunicadosClientProps {
  userRole?: string;
  userName?: string;
  initialComunicados?: ComunicadoItem[];
}

export function ComunicadosClient({
  userName = "Colaborador",
  initialComunicados = [],
}: ComunicadosClientProps) {
  const [activeTab, setActiveTab] = useState<"pendentes" | "todos">("pendentes");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPrioridade, setFilterPrioridade] = useState<string>("TODAS");
  const [filterStatusCiencia, setFilterStatusCiencia] = useState<"TODOS" | "PENDENTE" | "CIENTE">("TODOS");
  const [filterComAnexo, setFilterComAnexo] = useState<boolean>(false);
  const [selectedComunicado, setSelectedComunicado] = useState<ComunicadoItem | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ title: string; url: string; id: string } | null>(null);
  const [comunicados, setComunicados] = useState<ComunicadoItem[]>(() => initialComunicados ?? []);

  React.useEffect(() => {
    setComunicados(initialComunicados ?? []);
  }, [initialComunicados]);

  const isPendente = (c: ComunicadoItem) =>
    Boolean(c.exigeCiencia && (!c.ciencias || c.ciencias.length === 0));

  const pendentesCount = comunicados.filter(isPendente).length;
  const confirmadosCount = comunicados.filter(
    (c) => Boolean(c.ciencias && c.ciencias.length > 0)
  ).length;
  const urgentesPendentes = comunicados.filter(
    (c) => c.prioridade === "URGENTE" && isPendente(c)
  );

  const hasActiveFilters =
    filterPrioridade !== "TODAS" || filterStatusCiencia !== "TODOS" || filterComAnexo;

  const filteredComunicados = comunicados.filter((c) => {
    const matchTab = activeTab === "pendentes" ? isPendente(c) : true;
    if (!matchTab) return false;

    if (filterPrioridade !== "TODAS" && c.prioridade !== filterPrioridade) {
      return false;
    }

    const isCiente = Boolean(c.ciencias && c.ciencias.length > 0);
    if (filterStatusCiencia === "PENDENTE" && isCiente) {
      return false;
    }
    if (filterStatusCiencia === "CIENTE" && !isCiente) {
      return false;
    }

    if (filterComAnexo && (!c.anexos || c.anexos.length === 0)) {
      return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.titulo.toLowerCase().includes(q) || c.conteudo?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleCienciaSuccess = (comprovanteHash: string) => {
    if (!selectedComunicado) return;
    const novaCiencia = {
      id: `sci-${Date.now()}`,
      dataCiencia: new Date().toISOString(),
      comprovanteHash,
    };
    setSelectedComunicado((prev) =>
      prev ? { ...prev, visualizado: true, ciencias: [novaCiencia] } : null
    );
    setComunicados((prev) =>
      prev.map((item) =>
        item.id === selectedComunicado.id
          ? {
              ...item,
              visualizado: true,
              ciencias: [novaCiencia],
            }
          : item
      )
    );
  };

  const handleOpenCienciaModal = (comunicado: ComunicadoItem) => {
    setSelectedComunicado(comunicado);
  };

  return (
    <div className="w-full flex-1 min-h-full flex flex-col justify-start bg-[#070A12] text-white relative overflow-hidden pb-12 font-sans">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[90vw] max-w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-cyan-500/8 to-emerald-500/8 blur-3xl opacity-60" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-5 py-6 sm:px-8 space-y-6">
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">MEU ESPAÇO</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">COMUNICADOS</span>
            <h1 className="sr-only">Meus Comunicados Internos</h1>
          </div>
        </div>

        {/* ── Cards de Indicadores / Resumo Executivo (Padrão FIORIX) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KPI 1: Pendentes de Ciência */}
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Pendentes de Ciência
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                    pendentesCount > 0
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/25"
                      : "bg-cyan-500/15 text-cyan-300 border-cyan-500/25"
                  }`}
                >
                  {pendentesCount > 0 ? "AÇÃO NECESSÁRIA" : "EM DIA"}
                </span>
              </div>
              <div className="text-2xl font-black text-white">
                {`${pendentesCount} pendente${pendentesCount !== 1 ? "s" : ""}`}
              </div>
              <p className={`text-xs ${pendentesCount > 0 ? "text-amber-400/90 font-medium" : "text-slate-400"}`}>
                {urgentesPendentes.length > 0
                  ? `${urgentesPendentes.length} com prioridade urgente`
                  : pendentesCount > 0
                  ? "Aguardando leitura e confirmação"
                  : "Nenhuma pendência no momento"}
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-inner ${
                pendentesCount > 0
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
              }`}
            >
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 2: Ciências Confirmadas */}
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ciências Confirmadas
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  HOMOLOGADAS
                </span>
              </div>
              <div className="text-2xl font-black text-white">
                {`${confirmadosCount} confirmada${confirmadosCount !== 1 ? "s" : ""}`}
              </div>
              <p className="text-xs text-emerald-400/90 font-medium">
                Comprovante nominal SHA-256 registrado
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 3: Total no Mural */}
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Publicações no Mural
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                  PROV. 213/2026
                </span>
              </div>
              <div className="text-2xl font-black text-white">
                {`${comunicados.length} comunicado${comunicados.length !== 1 ? "s" : ""}`}
              </div>
              <p className="text-xs text-slate-400">Avisos e normativos oficiais do RH</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* ── Card Principal (Padrão FIORIX) ─────────────────────────── */}
        <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 backdrop-blur-xl shadow-sm overflow-hidden">
          {/* Cabeçalho do Card */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-6 py-5 gap-4 border-b border-white/10 bg-[#0B1020]/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Mural de Comunicados
                </h2>
                <p className="text-xs text-slate-400">
                  {filteredComunicados.length}{" "}
                  {filteredComunicados.length === 1 ? "publicação exibida" : "publicações exibidas"}
                </p>
              </div>
            </div>

            {/* Abas + Busca e Filtros */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-[#080D1A] border border-white/15 rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("pendentes")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "pendentes"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>Pendentes</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-all ${
                      activeTab === "pendentes"
                        ? "bg-white/20 text-white"
                        : "bg-white/8 text-slate-400"
                    }`}
                  >
                    {pendentesCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("todos")}
                  className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "todos"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Todos
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                  searchOpen
                    ? "bg-indigo-500/15 border-indigo-500/35 text-indigo-300"
                    : "bg-[#080D1A] border-white/15 text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
                aria-label="Buscar"
                title="Buscar comunicados"
              >
                {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className={`relative w-10 h-10 flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                  filterOpen || hasActiveFilters
                    ? "bg-indigo-500/15 border-indigo-500/35 text-indigo-300"
                    : "bg-[#080D1A] border-white/15 text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
                aria-label="Filtrar comunicados"
                title="Filtrar comunicados"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {hasActiveFilters && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#080D1A]" />
                )}
              </button>
            </div>
          </div>

          {/* ── Conteúdo ─────────────────────────────────────────────── */}
          <div className="p-6 space-y-4">
            {/* Alerta urgentes */}
            {urgentesPendentes.length > 0 && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/25 shrink-0">
                  <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-300">
                    {urgentesPendentes.length === 1
                      ? "1 comunicado urgente pendente"
                      : `${urgentesPendentes.length} comunicados urgentes pendentes`}
                  </p>
                  <p className="text-xs text-rose-200/70 mt-0.5">
                    Sua ciência nominal é necessária.
                  </p>
                </div>
              </div>
            )}

            {/* Campo de busca expansível */}
            {searchOpen && (
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar comunicados por título ou conteúdo..."
                  className="pl-10 h-10 bg-[#080D1A] border-white/15 rounded-xl text-xs text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-0"
                />
              </div>
            )}

            {/* Painel de filtros expansível */}
            {filterOpen && (
              <div className="p-4 bg-[#080D1A] border border-white/10 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    Filtros de visualização
                  </span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterPrioridade("TODAS");
                        setFilterStatusCiencia("TODOS");
                        setFilterComAnexo(false);
                      }}
                      className="text-xs text-cyan-400 hover:underline font-medium transition-colors cursor-pointer"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Prioridade */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Prioridade
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "TODAS", label: "Todas" },
                        { id: "URGENTE", label: "Urgente" },
                        { id: "IMPORTANTE", label: "Importante" },
                        { id: "NORMAL", label: "Normal" },
                      ].map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setFilterPrioridade(item.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            filterPrioridade === item.id
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/10"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status de Ciência */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Status de Ciência
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "TODOS", label: "Todos" },
                        { id: "PENDENTE", label: "Pendente de Ciência" },
                        { id: "CIENTE", label: "Ciência Realizada" },
                      ].map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setFilterStatusCiencia(item.id as "TODOS" | "PENDENTE" | "CIENTE")}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            filterStatusCiencia === item.id
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/10"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Anexos */}
                <div className="pt-2 flex items-center justify-between border-t border-white/8">
                  <label
                    htmlFor="filter-anexo"
                    className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer select-none py-0.5"
                  >
                    <input
                      id="filter-anexo"
                      type="checkbox"
                      checked={filterComAnexo}
                      onChange={(e) => setFilterComAnexo(e.target.checked)}
                      className="rounded border-white/20 text-indigo-600 focus:ring-indigo-500 bg-transparent cursor-pointer"
                    />
                    Exibir apenas comunicados com anexo PDF
                  </label>
                </div>
              </div>
            )}

            {/* Lista ou Estado Vazio */}
            {filteredComunicados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
                <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-10 h-10 text-cyan-400/80" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {activeTab === "pendentes" ? "Tudo em dia" : "Nenhum comunicado encontrado"}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {activeTab === "pendentes"
                      ? "Você não possui comunicados pendentes de ciência no momento. Quando o RH publicar novos avisos, eles aparecerão organizados aqui."
                      : "Altere os filtros selecionados ou o termo de busca para visualizar outras publicações."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredComunicados.map((comunicado) => (
                  <ComunicadoCard
                    key={comunicado.id}
                    comunicado={comunicado}
                    onOpenCiencia={handleOpenCienciaModal}
                    onOpenAnexos={(c) => {
                      if (c.anexos && c.anexos.length > 0) {
                        setPdfPreview({
                          id: c.anexos[0].id,
                          title: `${c.titulo} — ${c.anexos[0].nomeOriginal}`,
                          url: `/api/comunicados/anexo/${c.anexos[0].id}`,
                        });
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Rodapé do Card ───────────────────────────────────────── */}
          <div className="px-6 py-3.5 border-t border-white/10 bg-[#0B1020]/80 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ciência eletrônica nominal com integridade SHA-256 conforme Provimento 213/2026.</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">7º RI SP • SIGA/FIORIX</span>
          </div>
        </div>
      </div>

      {selectedComunicado && (
        <CienciaModal
          comunicado={selectedComunicado}
          onClose={() => setSelectedComunicado(null)}
          onSuccess={handleCienciaSuccess}
        />
      )}

      {pdfPreview && (
        <SecurePDFViewer
          documentTitle={pdfPreview.title}
          documentType="comunicado"
          documentId={pdfPreview.id}
          fileUrl={pdfPreview.url}
          userName={userName}
          allowDownload={true}
          onClose={() => setPdfPreview(null)}
        />
      )}
    </div>
  );
}

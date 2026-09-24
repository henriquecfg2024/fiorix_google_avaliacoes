"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Search,
  SlidersHorizontal,
  FileText,
  CheckCircle2,
  BarChart3,
  QrCode,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ComunicadoCard, ComunicadoItem } from "@/components/comunicados/ComunicadoCard";
import { CienciaModal } from "@/components/comunicados/CienciaModal";
import { SecurePDFViewer } from "@/components/comunicados/SecurePDFViewer";
import Link from "next/link";

interface ComunicadosClientProps {
  userRole?: string;
  userName?: string;
  initialComunicados?: ComunicadoItem[];
}

export function ComunicadosClient({
  userRole = "USER",
  userName = "Colaborador",
  initialComunicados = [],
}: ComunicadosClientProps) {
  const [activeTab, setActiveTab] = useState<"nao_lidos" | "todos">("nao_lidos");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedComunicado, setSelectedComunicado] = useState<ComunicadoItem | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ title: string; url: string; id: string } | null>(null);
  const [comunicados, setComunicados] = useState<ComunicadoItem[]>(() => initialComunicados ?? []);

  React.useEffect(() => {
    setComunicados(initialComunicados ?? []);
  }, [initialComunicados]);

  const naoLidosCount = comunicados.filter((c) => !c.visualizado).length;
  const urgentesPendentes = comunicados.filter(
    (c) => c.prioridade === "URGENTE" && (!c.ciencias || c.ciencias.length === 0)
  );

  const filteredComunicados = comunicados.filter((c) => {
    const matchTab = activeTab === "nao_lidos" ? !c.visualizado : true;
    if (!matchTab) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.titulo.toLowerCase().includes(q) || c.conteudo?.toLowerCase().includes(q);
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

  return (
    <div className="w-full flex-1 flex flex-col bg-[#070A12] text-white relative overflow-hidden pb-16">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500/8 via-indigo-500/6 to-cyan-500/4 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-lg px-4 py-5 space-y-4">

        {/* Breadcrumb + Título */}
        <div className="space-y-1 pb-3 border-b border-white/8">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Link href="/dashboard" className="hover:text-slate-300 transition-colors">Dashboard</Link>
            <span>/</span>
            <Link href="/pessoas" className="hover:text-slate-300 transition-colors">Pessoas</Link>
            <span>/</span>
            <span className="text-rose-400 font-semibold">Comunicados</span>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            COMUNICADOS INTERNOS
          </h1>
        </div>

        {/* Alerta urgentes */}
        {urgentesPendentes.length > 0 && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/8 p-3.5 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/25 shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-300">
                {urgentesPendentes.length === 1
                  ? "1 comunicado urgente pendente"
                  : `${urgentesPendentes.length} comunicados urgentes pendentes`}
              </p>
              <p className="text-[11px] text-rose-200/60 mt-0.5">Sua ciência é necessária.</p>
            </div>
          </div>
        )}

        {/* Navegação: abas + ícones de busca/filtro */}
        <div className="flex items-center gap-2">
          {/* Controle segmentado */}
          <div className="flex-1 flex items-center bg-white/[0.05] border border-white/10 rounded-2xl p-1 gap-1">
            <button
              onClick={() => setActiveTab("nao_lidos")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === "nao_lidos"
                  ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.45)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Não lidos
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-all ${
                activeTab === "nao_lidos"
                  ? "bg-white/20 text-white"
                  : "bg-white/8 text-slate-400"
              }`}>
                {naoLidosCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("todos")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === "todos"
                  ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.45)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Todos
            </button>
          </div>

          {/* Botão busca */}
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className={`w-10 h-10 flex items-center justify-center rounded-2xl border transition-all ${
              searchOpen
                ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
                : "bg-white/[0.05] border-white/10 text-slate-400 hover:text-white hover:bg-white/8"
            }`}
            aria-label="Buscar"
          >
            {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          {/* Botão filtro */}
          <button
            className="w-10 h-10 flex items-center justify-center rounded-2xl border bg-white/[0.05] border-white/10 text-slate-400 hover:text-white hover:bg-white/8 transition-all"
            aria-label="Filtrar"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Campo de busca expansível */}
        {searchOpen && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar comunicados..."
              className="pl-9 h-9 bg-white/[0.04] border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:border-violet-500/60 focus:ring-0"
            />
          </div>
        )}

        {/* Conteúdo principal */}
        {filteredComunicados.length === 0 ? (
          <div className="space-y-3 pt-1">
            {/* Empty state premium */}
            <div className="rounded-3xl border border-violet-500/20 bg-[#0B1022]/90 shadow-[inset_0_0_40px_rgba(139,92,246,0.06)] p-8 flex flex-col items-center text-center gap-4">
              {/* Ícone documento + check */}
              <div className="relative flex items-center justify-center w-20 h-20">
                {/* Partículas decorativas */}
                <span className="absolute top-1 left-2 w-1 h-1 rounded-full bg-violet-400/60" />
                <span className="absolute top-3 right-1 w-1.5 h-1.5 rounded-full bg-violet-300/40" />
                <span className="absolute bottom-2 left-0 w-1 h-1 rounded-full bg-violet-500/50" />
                <span className="absolute bottom-1 right-3 w-1 h-1 rounded-full bg-violet-400/40" />

                {/* Documento */}
                <div className="relative">
                  <FileText
                    className="w-14 h-14 text-slate-500/80"
                    strokeWidth={1.2}
                  />
                  {/* Linhas internas simuladas */}
                  <div className="absolute top-[30%] left-[22%] w-[55%] space-y-1.5">
                    <div className="h-[2px] bg-slate-500/60 rounded-full" />
                    <div className="h-[2px] bg-slate-500/40 rounded-full w-3/4" />
                  </div>
                  {/* Badge check verde */}
                  <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#0B1022] border-2 border-emerald-500/80 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.4)]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-white tracking-tight">Tudo em dia</h2>
                <p className="text-sm font-semibold text-slate-300">
                  Você não tem comunicados pendentes.
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Os novos comunicados aparecerão aqui.
                </p>
              </div>
            </div>

            {/* Card "Como funciona" */}
            <div className="rounded-2xl border border-white/8 bg-[#0B1022]/70 px-4 py-3">
              <h3 className="text-xs font-bold text-white mb-2">Como funciona</h3>
              <div className="border-t border-white/8 mb-2" />
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-violet-400" strokeWidth={1.8} />
                  </div>
                  <span className="text-xs text-slate-400">Novos comunicados aparecem aqui</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.8} />
                  </div>
                  <span className="text-xs text-slate-400">Leia e confirme sua ciência</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <BarChart3 className="w-3.5 h-3.5 text-violet-400" strokeWidth={1.8} />
                  </div>
                  <span className="text-xs text-slate-400">Acompanhe no histórico</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
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

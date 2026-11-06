"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  FileText,
  CheckCircle2,
  Bookmark,
  BookOpen,
  Paperclip,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ComunicadoItem {
  id: string;
  titulo: string;
  conteudo: string;
  conteudoHash: string;
  prioridade: "URGENTE" | "IMPORTANTE" | "NORMAL" | string;
  versao: number;
  dataPublicacao: string | Date;
  dataExpiracao?: string | Date | null;
  exigeCiencia: boolean;
  visualizado?: boolean;
  autorNome?: string;
  setor?: string;
  anexos?: Array<{ id: string; nomeOriginal: string; tamanhoBytes: number; url?: string }>;
  ciencias?: Array<{ id: string; dataCiencia: string | Date; comprovanteHash: string }>;
}

interface ComunicadoCardProps {
  comunicado: ComunicadoItem;
  onOpenCiencia: (comunicado: ComunicadoItem) => void;
  onOpenAnexos?: (comunicado: ComunicadoItem) => void;
  isArquivoView?: boolean;
}

export function ComunicadoCard({
  comunicado,
  onOpenCiencia,
  onOpenAnexos,
  isArquivoView = false,
}: ComunicadoCardProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const isCiente = Boolean(comunicado.ciencias && comunicado.ciencias.length > 0);
  const prioridadeNormalizada = (comunicado.prioridade || "NORMAL").toUpperCase();
  const isUrgente = prioridadeNormalizada === "URGENTE";
  const isImportante = prioridadeNormalizada === "IMPORTANTE";

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`fiorix_saved_comunicado_${comunicado.id}`);
      if (saved === "true") setBookmarked(true);
    } catch {}
  }, [comunicado.id]);

  const toggleBookmark = () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      if (next) {
        localStorage.setItem(`fiorix_saved_comunicado_${comunicado.id}`, "true");
      } else {
        localStorage.removeItem(`fiorix_saved_comunicado_${comunicado.id}`);
      }
    } catch {}
  };

  let dataPublicacaoFormatada = "07 out 2026 · 19:46";
  try {
    if (comunicado.dataPublicacao) {
      const d =
        typeof comunicado.dataPublicacao === "string"
          ? new Date(comunicado.dataPublicacao)
          : comunicado.dataPublicacao;
      if (!isNaN(d.getTime())) {
        dataPublicacaoFormatada = format(d, "dd MMM yyyy '·' HH:mm", { locale: ptBR });
      }
    }
  } catch {
    dataPublicacaoFormatada = "07 out 2026 · 19:46";
  }

  let dataCienciaFormatada = "";
  if (isCiente && comunicado.ciencias?.[0]?.dataCiencia) {
    try {
      const cd =
        typeof comunicado.ciencias[0].dataCiencia === "string"
          ? new Date(comunicado.ciencias[0].dataCiencia)
          : comunicado.ciencias[0].dataCiencia;
      if (!isNaN(cd.getTime())) {
        dataCienciaFormatada = format(cd, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      }
    } catch {
      dataCienciaFormatada = "08/10/2026 às 13:40";
    }
  }

  let statusTexto = "Ciência pendente";
  let statusTipo: "pendente" | "vencido" | "confirmado" | "informativo" = "pendente";

  if (isCiente) {
    statusTipo = "confirmado";
    statusTexto = dataCienciaFormatada
      ? `Ciência confirmada em ${dataCienciaFormatada}`
      : "Ciência confirmada";
  } else if (!comunicado.exigeCiencia) {
    statusTipo = "informativo";
    statusTexto = "Leitura informativa · Sem exigência de ciência";
  } else if (comunicado.dataExpiracao) {
    try {
      const expDate = new Date(comunicado.dataExpiracao);
      const diffMs = expDate.getTime() - Date.now();
      const expFmt = format(expDate, "dd/MM/yyyy", { locale: ptBR });

      if (diffMs <= 0) {
        statusTipo = "vencido";
        statusTexto = `Ciência pendente · Prazo vencido em ${expFmt}`;
      } else {
        const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (dias <= 1) {
          statusTexto = `Ciência pendente · Prazo expira hoje (até ${expFmt})`;
        } else {
          statusTexto = `Ciência pendente · Prazo em ${dias} dias`;
        }
      }
    } catch {
      statusTexto = "Ciência pendente";
    }
  }

  const getBadgeStyle = () => {
    if (isUrgente) {
      return "bg-rose-500/15 text-rose-300 border border-rose-500/30";
    }
    if (isImportante) {
      return "bg-amber-500/15 text-amber-300 border border-amber-500/30";
    }
    return "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25";
  };

  const getPriorityLabel = () => {
    if (isUrgente) return "Urgente";
    if (isImportante) return "Importante";
    return "Normal";
  };

  const anexosCount = comunicado.anexos ? comunicado.anexos.length : 0;
  const autorLimpo = (comunicado.autorNome || "RH").replace(/\s*\/\s*Gestão/i, "").trim();

  return (
    <div className="relative rounded-2xl border border-white/10 hover:border-white/20 bg-[#080D1A] p-5 shadow-xs transition-all space-y-3.5 text-white font-sans">
      {/* A. Cabeçalho Compacto: Badge, Data e Versão */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${getBadgeStyle()}`}>
            {getPriorityLabel()}
          </span>
          <span className="text-xs text-slate-400 font-sans">
            {dataPublicacaoFormatada}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            v{comunicado.versao || 1}
          </span>
        </div>
      </div>

      {/* B. Conteúdo: Título, Metadados e Resumo */}
      <div className="space-y-1.5">
        <h3
          onClick={() => onOpenCiencia(comunicado)}
          className="text-base sm:text-lg font-bold text-white tracking-tight hover:text-cyan-300 transition-colors cursor-pointer"
        >
          {comunicado.titulo}
        </h3>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span>{autorLimpo}</span>
          {anexosCount > 0 && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                {anexosCount} {anexosCount === 1 ? "anexo PDF" : "anexos PDF"}
              </span>
            </>
          )}
        </div>

        <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed pt-1 line-clamp-3">
          {comunicado.conteudo}
        </p>
      </div>

      {/* Seção Arquivo de Ciências */}
      {isArquivoView && isCiente && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Ciência Homologada
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {dataCienciaFormatada}
            </span>
          </div>
        </div>
      )}

      {/* Divisor sutil */}
      <div className="border-t border-white/10 pt-3 space-y-3">
        {/* C. Status Único de Ciência */}
        <div className="flex items-center gap-2 text-xs">
          {statusTipo === "confirmado" && (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-400 font-medium">{statusTexto}</span>
            </>
          )}
          {statusTipo === "vencido" && (
            <>
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-rose-400 font-semibold">{statusTexto}</span>
            </>
          )}
          {statusTipo === "pendente" && (
            <>
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-amber-400 font-medium">{statusTexto}</span>
            </>
          )}
          {statusTipo === "informativo" && (
            <>
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-slate-400">{statusTexto}</span>
            </>
          )}
        </div>

        {/* D. Ações: Ler comunicado, Abrir PDF, Salvar */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenCiencia(comunicado)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{isCiente ? "Ver comunicado" : "Ler comunicado"}</span>
            </button>

            {anexosCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenAnexos) {
                    onOpenAnexos(comunicado);
                  } else if (comunicado.anexos?.[0]?.url || comunicado.anexos?.[0]?.id) {
                    window.open(
                      comunicado.anexos[0].url || `/api/comunicados/anexo/${comunicado.anexos[0].id}`,
                      "_blank"
                    );
                  }
                }}
                className="border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white font-medium text-xs h-9 px-3.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title={anexosCount === 1 ? `Abrir PDF: ${comunicado.anexos![0].nomeOriginal}` : "Abrir anexos PDF"}
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Abrir PDF{anexosCount > 1 ? ` (${anexosCount})` : ""}</span>
              </button>
            )}
          </div>

          {/* Botão Salvar / Favoritar */}
          <button
            type="button"
            onClick={toggleBookmark}
            aria-label={bookmarked ? "Remover dos salvos" : "Salvar comunicado"}
            title={bookmarked ? "Remover dos salvos" : "Salvar comunicado"}
            className={`h-9 w-9 rounded-xl border transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
              bookmarked
                ? "bg-indigo-500/15 border-indigo-500/35 text-indigo-300"
                : "border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-indigo-400 text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

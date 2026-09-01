"use client";

import React, { useState } from "react";
import { AlertCircle, Clock, FileText, CheckCircle2, Bookmark, Eye, ShieldAlert, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  autorNome?: string;
  setor?: string;
  anexos?: Array<{ id: string; nomeOriginal: string; tamanhoBytes: number }>;
  ciencias?: Array<{ id: string; dataCiencia: string | Date; comprovanteHash: string }>;
}

interface ComunicadoCardProps {
  comunicado: ComunicadoItem;
  onOpenCiencia: (comunicado: ComunicadoItem) => void;
  onOpenAnexos?: (comunicado: ComunicadoItem) => void;
}

export function ComunicadoCard({ comunicado, onOpenCiencia, onOpenAnexos }: ComunicadoCardProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const isCiente = comunicado.ciencias && comunicado.ciencias.length > 0;
  const isUrgente = comunicado.prioridade === "URGENTE";
  const isImportante = comunicado.prioridade === "IMPORTANTE";

  // Formatação de data
  const dataFormatada = format(new Date(comunicado.dataPublicacao), "dd/MM/yyyy HH:mm", { locale: ptBR });

  // Classes de estilo baseadas na prioridade
  const borderClass = isUrgente
    ? "border-red-500/40 bg-[#12080a] shadow-[0_0_20px_rgba(239,68,68,0.1)] hover:border-red-500/60"
    : isImportante
    ? "border-amber-500/30 bg-[#120e08] hover:border-amber-500/50"
    : "border-cyan-500/20 bg-[#0d0d16] hover:border-cyan-500/40";

  const badgeClass = isUrgente
    ? "bg-red-500 text-white font-black shadow-[0_0_10px_rgba(239,68,68,0.4)]"
    : isImportante
    ? "bg-amber-500 text-black font-black"
    : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold";

  return (
    <div className={`relative rounded-2xl border p-6 transition-all duration-200 ${borderClass} flex flex-col justify-between`}>
      <div>
        {/* Top bar: Badge, Data, Dot status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] tracking-wide uppercase ${badgeClass}`}>
              {comunicado.prioridade}
            </span>
            <span className="text-xs text-white/50">{dataFormatada}</span>
          </div>

          <div className="flex items-center gap-2">
            {isUrgente && !isCiente && (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            )}
            {isImportante && !isCiente && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            )}
            {comunicado.prioridade === "NORMAL" && (
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-white tracking-tight hover:text-indigo-300 transition-colors cursor-pointer" onClick={() => onOpenCiencia(comunicado)}>
          {comunicado.titulo}
        </h3>

        {/* Autor & Anexos metadata */}
        <div className="flex items-center gap-2 text-xs text-white/50 mt-1 mb-3">
          <span>{comunicado.autorNome || "Administração"}</span>
          <span>•</span>
          <span>{comunicado.setor || "Diretoria Geral"}</span>
          {comunicado.anexos && comunicado.anexos.length > 0 && (
            <>
              <span>•</span>
              <span className="text-cyan-400 flex items-center gap-1 font-medium">
                <FileText className="w-3.5 h-3.5" />
                {comunicado.anexos.length} anexo{comunicado.anexos.length > 1 ? "s" : ""} PDF
              </span>
            </>
          )}
        </div>

        {/* Text snippet */}
        <p className="text-xs text-white/70 line-clamp-2 leading-relaxed mb-4">
          {comunicado.conteudo}
        </p>
      </div>

      {/* Status da Ciência / Barra de aviso */}
      <div className="space-y-3 pt-3 border-t border-white/5">
        {comunicado.exigeCiencia && (
          <div
            onClick={() => !isCiente && onOpenCiencia(comunicado)}
            className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-colors ${
              isCiente
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : isUrgente
                ? "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                : "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
            }`}
          >
            <div className="flex items-center gap-2">
              {isCiente ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-current" />
              )}
              <span className="font-semibold">
                {isCiente
                  ? "Ciência Registrada com Sucesso"
                  : isUrgente
                  ? "Pendente de Ciência • Expira em 2 dias"
                  : "Pendente de Ciência • Expira em 5 dias"}
              </span>
            </div>
            {!isCiente && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
          </div>
        )}

        {/* Actions Button Row */}
        <div className="flex items-center gap-2">
          {!isCiente ? (
            <Button
              onClick={() => onOpenCiencia(comunicado)}
              className="flex-1 bg-white hover:bg-white/90 text-black font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ler e Dar Ciência com Prova</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => onOpenCiencia(comunicado)}
              className="flex-1 border-white/10 text-white/80 hover:bg-white/5 text-xs py-2 rounded-xl flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ver Comprovante de Ciência</span>
            </Button>
          )}

          {comunicado.anexos && comunicado.anexos.length > 0 && (
            <Button
              variant="outline"
              onClick={() => onOpenAnexos && onOpenAnexos(comunicado)}
              className="border-white/10 bg-[#12141F] text-white/80 hover:text-white hover:bg-white/10 text-xs py-2 px-3 rounded-xl flex items-center gap-1.5"
            >
              <span>Ver Anexo{comunicado.anexos.length > 1 ? "s" : ""} ({comunicado.anexos.length})</span>
            </Button>
          )}

          <button
            onClick={() => setBookmarked(!bookmarked)}
            className={`p-2 rounded-xl border transition-colors ${
              bookmarked
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400"
                : "border-white/10 bg-[#12141F] text-white/40 hover:text-white hover:bg-white/10"
            }`}
            title="Favoritar Comunicado"
          >
            <Bookmark className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

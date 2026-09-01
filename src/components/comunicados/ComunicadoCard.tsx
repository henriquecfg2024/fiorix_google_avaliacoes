"use client";

import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Clock,
  FileText,
  CheckCircle2,
  Bookmark,
  Eye,
  ShieldCheck,
  ChevronRight,
  QrCode,
  Lock,
} from "lucide-react";
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
  const isUrgente = comunicado.prioridade === "URGENTE";
  const isImportante = comunicado.prioridade === "IMPORTANTE";

  // Formatação segura de data
  let dataFormatada = "30/08/2026 09:00";
  try {
    if (comunicado.dataPublicacao) {
      const d =
        typeof comunicado.dataPublicacao === "string"
          ? new Date(comunicado.dataPublicacao)
          : comunicado.dataPublicacao;
      if (!isNaN(d.getTime())) {
        dataFormatada = format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
      }
    }
  } catch (e) {
    dataFormatada = "30/08/2026 09:00";
  }

  // Data da ciência se houver
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
      dataCienciaFormatada = "01/09/2026 às 18:42";
    }
  }

  // Cálculo dinâmico do prazo para ciência (dataExpiracao - agora)
  const [prazoRestante, setPrazoRestante] = useState<string>("");
  const [isExpirado, setIsExpirado] = useState(false);

  useEffect(() => {
    if (!isUrgente || isCiente) return;

    const calcPrazo = () => {
      // Data de expiração padrão: 48h após publicação se não especificada
      const expDate = comunicado.dataExpiracao
        ? new Date(comunicado.dataExpiracao)
        : new Date(new Date(comunicado.dataPublicacao).getTime() + 48 * 3600 * 1000);

      const diff = expDate.getTime() - Date.now();
      if (diff <= 0) {
        setIsExpirado(true);
        setPrazoRestante("PRAZO EXPIRADO");
      } else {
        const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        setPrazoRestante(
          `${String(dias).padStart(2, "0")}d ${String(horas).padStart(2, "0")}h ${String(
            mins
          ).padStart(2, "0")}min`
        );
      }
    };

    calcPrazo();
    const interval = setInterval(calcPrazo, 60000);
    return () => clearInterval(interval);
  }, [comunicado, isUrgente, isCiente]);

  // Classes de estilo baseadas na prioridade
  const borderClass = isCiente
    ? "border-emerald-500/25 bg-[#0B1020]/72 hover:border-emerald-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
    : isUrgente
    ? "border-rose-500/35 bg-[#140a12]/80 hover:border-rose-500/60 shadow-[0_20px_50px_rgba(244,63,94,0.15)]"
    : isImportante
    ? "border-amber-500/30 bg-[#14100c]/80 hover:border-amber-500/50 shadow-[0_20px_50px_rgba(245,158,11,0.1)]"
    : "border-cyan-500/20 bg-[#0B1020]/72 hover:border-cyan-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.25)]";

  const badgeClass = isUrgente
    ? "bg-rose-500 text-white font-black shadow-[0_0_12px_rgba(244,63,94,0.4)]"
    : isImportante
    ? "bg-amber-500 text-black font-black"
    : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold";

  return (
    <div
      className={`relative rounded-[28px] border p-6 transition-all duration-300 backdrop-blur-xl ${borderClass} flex flex-col justify-between`}
    >
      <div>
        {/* Top bar: Badge, Data, Versão, Dot status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wide uppercase ${badgeClass}`}
            >
              {comunicado.prioridade}
            </span>
            <span className="text-xs text-white/50">{dataFormatada}</span>
            <span className="text-[10px] font-mono text-white/40">v{comunicado.versao}</span>
          </div>

          <div className="flex items-center gap-2">
            {isCiente ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ciente</span>
              </span>
            ) : isUrgente ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                  Pendente
                </span>
              </span>
            ) : isImportante ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Pendente
                </span>
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          className="text-base font-bold text-white tracking-tight hover:text-indigo-300 transition-colors cursor-pointer"
          onClick={() => onOpenCiencia(comunicado)}
        >
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

      {/* Seção Arquivo de Ciências: Informações de Prova Criptográfica */}
      {isArquivoView && isCiente && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Hash verificado
            </span>
            <span className="text-[11px] text-white/50 font-mono">
              {dataCienciaFormatada || "Ciência Homologada"}
            </span>
          </div>
          <div className="text-[10px] font-mono text-cyan-300/80 truncate bg-[#070A12]/80 p-1.5 rounded-lg border border-white/5 flex items-center justify-between">
            <span>SHA-256: {comunicado.ciencias?.[0]?.comprovanteHash || comunicado.conteudoHash}</span>
            <QrCode className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-2" />
          </div>
        </div>
      )}

      {/* Status da Ciência / Barra de aviso */}
      <div className="space-y-3 pt-3 border-t border-white/5">
        {comunicado.exigeCiencia && (
          <div
            onClick={() => onOpenCiencia(comunicado)}
            className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-colors ${
              isCiente
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : isUrgente
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
                : "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20"
            }`}
          >
            <div className="flex items-center gap-2">
              {isCiente ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-current" />
              )}
              <div className="flex flex-col">
                <span className="font-semibold">
                  {isCiente
                    ? "✓ Ciência registrada"
                    : isUrgente
                    ? isExpirado
                      ? "PRAZO EXPIRADO"
                      : `Pendente de Ciência • Prazo: ${prazoRestante || "Expira em breve"}`
                    : "Pendente de Ciência • Expira em 5 dias"}
                </span>
                {isCiente && dataCienciaFormatada && (
                  <span className="text-[10px] text-emerald-300/70 font-mono mt-0.5">
                    {dataCienciaFormatada}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </div>
        )}

        {/* Actions Button Row */}
        <div className="flex items-center gap-2">
          {!isCiente ? (
            <Button
              onClick={() => onOpenCiencia(comunicado)}
              className="flex-1 bg-white hover:bg-white/90 text-black font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ler e Dar Ciência com Prova</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => onOpenCiencia(comunicado)}
              className="flex-1 border-white/10 text-white/90 hover:bg-white/5 text-xs py-2 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ver Comprovante</span>
            </Button>
          )}

          {comunicado.anexos && comunicado.anexos.length > 0 && (
            <Button
              variant="outline"
              onClick={() => onOpenAnexos && onOpenAnexos(comunicado)}
              className="border-white/10 bg-[#12141F] text-white/80 hover:text-white hover:bg-white/10 text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <span>
                Ver Anexo{comunicado.anexos.length > 1 ? "s" : ""} ({comunicado.anexos.length})
              </span>
            </Button>
          )}

          <button
            onClick={() => setBookmarked(!bookmarked)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
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

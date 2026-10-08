"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  FileText,
  Download,
  ExternalLink,
  X,
  Check,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { QRComprovante } from "./QRComprovante";

interface CienciaModalProps {
  comunicado: {
    id: string;
    titulo: string;
    conteudo: string;
    conteudoHash: string;
    prioridade: string;
    versao: number;
    autorNome?: string;
    anexos?: Array<{ id: string; nomeOriginal: string; tamanhoBytes: number }>;
  };
  onClose: () => void;
  onSuccess: (comprovanteHash: string) => void;
}

export function CienciaModal({ comunicado, onClose, onSuccess }: CienciaModalProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [declaracaoChecked, setDeclaracaoChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultadoCiencia, setResultadoCiencia] = useState<{
    id: string;
    comprovanteHash: string;
    qrCodeUrl: string;
    timestamp: string;
    ipMascarado: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fecha com ESC quando não estiver enviando
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const totalScroll = scrollHeight - clientHeight;
    if (totalScroll <= 20) {
      setScrollProgress(100);
      setHasScrolledToBottom(true);
      return;
    }
    const progress = Math.min(100, Math.max(0, Math.round((scrollTop / totalScroll) * 100)));
    setScrollProgress(progress);
    if (progress >= 85) {
      setHasScrolledToBottom(true);
    }
  };

  useEffect(() => {
    checkScroll();
    const t1 = setTimeout(checkScroll, 100);
    const t2 = setTimeout(checkScroll, 300);
    window.addEventListener("resize", checkScroll);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", checkScroll);
    };
  }, [comunicado]);

  const handleScroll = () => {
    checkScroll();
  };

  const handleDarCiencia = async () => {
    if (!hasScrolledToBottom || !declaracaoChecked || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/comunicados/ciencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comunicadoId: comunicado.id,
          comunicadoHash: comunicado.conteudoHash,
          scrollPercent: scrollProgress,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao registrar ciência");
      }

      setResultadoCiencia(data);
      onSuccess(data.comprovanteHash);
    } catch (err: any) {
      alert(err.message || "Falha ao registrar ciência.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadComprovante = () => {
    if (!resultadoCiencia) return;
    const receiptText = `
============================================================
              COMPROVANTE DE CIÊNCIA — FIORIX
          7º REGISTRO DE IMÓVEIS DE SÃO PAULO
============================================================
COMUNICADO: ${comunicado.titulo} (v${comunicado.versao})
ID: ${comunicado.id}
HASH DO CONTEÚDO: ${comunicado.conteudoHash}
------------------------------------------------------------
PROVA DE INTEGRIDADE:
HASH DO COMPROVANTE (SHA-256): ${resultadoCiencia.comprovanteHash}
REGISTRADO EM: ${resultadoCiencia.timestamp}
IP DO CLIENTE: ${resultadoCiencia.ipMascarado}
URL DE VERIFICAÇÃO: ${resultadoCiencia.qrCodeUrl}
------------------------------------------------------------
Autenticidade garantida por integridade criptográfica SHA-256.
============================================================
    `.trim();

    const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprovante-ciencia-${comunicado.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const numAnexos = comunicado.anexos ? comunicado.anexos.length : 0;

  const orientacaoTexto =
    numAnexos === 0
      ? "Leia o comunicado antes de confirmar sua ciência."
      : numAnexos === 1
      ? "Leia o comunicado e seu anexo antes de confirmar sua ciência."
      : "Leia o comunicado e seus anexos antes de confirmar sua ciência.";

  const declaracaoTexto =
    numAnexos === 0
      ? "Declaro que li e tomei ciência deste comunicado."
      : numAnexos === 1
      ? "Declaro que li e tomei ciência deste comunicado e de seu anexo."
      : "Declaro que li e tomei ciência deste comunicado e de seus anexos.";

  const formatTamanho = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  };

  const getPrioridadeBadge = (prioridade: string) => {
    const p = (prioridade || "").toUpperCase();
    if (p === "URGENTE") {
      return {
        label: "Urgente",
        classes: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      };
    }
    if (p === "IMPORTANTE") {
      return {
        label: "Importante",
        classes: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      };
    }
    return {
      label: p === "NORMAL" ? "Normal" : p || "Geral",
      classes: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    };
  };

  const badge = getPrioridadeBadge(comunicado.prioridade);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-ciencia-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0B1020] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header Compacto */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-white/10 bg-[#070A12]/90">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${badge.classes}`}
              >
                {badge.label}
              </span>
              <span className="text-xs text-white/50">
                Versão {comunicado.versao}
                {comunicado.autorNome ? ` · ${comunicado.autorNome}` : ""}
              </span>
            </div>
            <h2
              id="modal-ciencia-titulo"
              className="text-base sm:text-lg font-bold text-white mt-1.5 leading-snug"
            >
              {comunicado.titulo}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
            className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0 -mr-1 -mt-1 disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        {!resultadoCiencia ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Conteúdo com rolagem suave */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-5 text-white/85 text-sm leading-relaxed"
            >
              {/* Orientação Direta */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/70">
                <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{orientacaoTexto}</span>
              </div>

              {/* Texto do Comunicado */}
              <div className="text-white/90 whitespace-pre-wrap font-sans text-sm sm:text-base leading-relaxed selection:bg-indigo-500/30">
                {comunicado.conteudo}
              </div>

              {/* Seção de Anexo(s) em Destaque */}
              {comunicado.anexos && comunicado.anexos.length > 0 && (
                <div className="pt-2 space-y-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                    {comunicado.anexos.length === 1 ? "Documento Anexo" : "Documentos Anexos"}
                  </h3>
                  <div className="space-y-2">
                    {comunicado.anexos.map((anexo) => (
                      <div
                        key={anexo.id}
                        className="w-full p-3.5 bg-[#121626] rounded-xl border border-indigo-500/20 hover:border-indigo-500/30 flex items-center justify-between gap-4 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p
                              className="text-xs sm:text-sm font-medium text-white truncate"
                              title={anexo.nomeOriginal}
                            >
                              {anexo.nomeOriginal}
                            </p>
                            <p className="text-[11px] text-white/45 font-mono">
                              {formatTamanho(anexo.tamanhoBytes)}
                            </p>
                          </div>
                        </div>
                        <a
                          href={`/api/comunicados/anexo/${anexo.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 rounded-lg text-xs font-semibold transition-colors shrink-0"
                          title="Abrir anexo em nova aba"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Abrir PDF</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé com Declaração e Ações */}
            <div className="p-5 sm:p-6 border-t border-white/10 bg-[#070A12]/90 space-y-4">
              <div
                className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                  hasScrolledToBottom
                    ? "bg-indigo-500/[0.04] border-indigo-500/25"
                    : "bg-white/[0.02] border-white/5 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="declaracao"
                    disabled={!hasScrolledToBottom}
                    checked={declaracaoChecked}
                    onCheckedChange={(v) => setDeclaracaoChecked(Boolean(v))}
                    className="mt-0.5 border-white/30 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                  <div className="space-y-1">
                    <label
                      htmlFor="declaracao"
                      className={`text-xs sm:text-sm leading-snug select-none cursor-pointer block ${
                        hasScrolledToBottom ? "text-white font-medium" : "text-white/40 cursor-not-allowed"
                      }`}
                    >
                      {declaracaoTexto}
                    </label>
                    {!hasScrolledToBottom ? (
                      <p className="text-[11px] text-amber-400/80">
                        Role até o final do texto para habilitar a declaração.
                      </p>
                    ) : !declaracaoChecked ? (
                      <p className="text-[11px] text-white/45">
                        Marque a declaração para confirmar.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  disabled={submitting}
                  className="text-white/60 hover:text-white hover:bg-white/5 text-xs px-3"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={!hasScrolledToBottom || !declaracaoChecked || submitting}
                  onClick={handleDarCiencia}
                  className="bg-[#6366f1] hover:bg-[#5254db] text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirmando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar ciência</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Tela de Sucesso com QR Code e Hash SHA-256 */
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center space-y-6 bg-[#0B1020]">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center max-w-md">
              <h3 className="text-lg font-bold text-white">Ciência Registrada com Sucesso!</h3>
              <p className="text-xs text-white/60 mt-1">
                A prova criptográfica foi gerada e gravada de forma imutável na trilha de auditoria.
              </p>
            </div>

            <div className="w-full max-w-md p-4 bg-[#101424] rounded-xl border border-white/10 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/40">Data e Hora:</span>
                <span className="text-white font-mono">
                  {new Date(resultadoCiencia.timestamp).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/40">IP Mascarado:</span>
                <span className="text-white font-mono">{resultadoCiencia.ipMascarado}</span>
              </div>
              <div className="flex flex-col py-1 border-b border-white/5">
                <span className="text-white/40 mb-1">Hash do Comprovante (SHA-256):</span>
                <span className="text-cyan-400 font-mono text-[10px] break-all bg-black/40 p-2 rounded border border-white/5">
                  {resultadoCiencia.comprovanteHash}
                </span>
              </div>

              {/* QR Code */}
              <div className="pt-2 flex justify-center">
                <QRComprovante
                  url={resultadoCiencia.qrCodeUrl}
                  hash={resultadoCiencia.comprovanteHash}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 w-full max-w-md">
              <Button
                variant="outline"
                onClick={handleDownloadComprovante}
                className="flex-1 border-white/10 text-white/80 hover:bg-white/10 hover:text-white text-xs gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Comprovante</span>
              </Button>
              <Button
                onClick={onClose}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs"
              >
                Concluir
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

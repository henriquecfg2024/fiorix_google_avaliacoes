"use client";

import React, { useState, useRef } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, FileText, Download, ExternalLink, X, Lock, Check } from "lucide-react";
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

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const totalScroll = scrollHeight - clientHeight;
    if (totalScroll <= 15) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0B1020] border border-white/12 rounded-[28px] flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/8 bg-[#070A12]/80">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${comunicado.prioridade === "URGENTE" ? "bg-red-500/20 text-red-400" : "bg-indigo-500/20 text-indigo-400"}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${comunicado.prioridade === "URGENTE" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"}`}>
                  {comunicado.prioridade}
                </span>
                <span className="text-xs text-white/50">Versão {comunicado.versao}</span>
              </div>
              <h2 className="text-base font-bold text-white mt-0.5 truncate max-w-lg">
                {comunicado.titulo}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scroll Progress Bar */}
        {!resultadoCiencia && (
          <div className="w-full bg-white/5 h-1 relative">
            <div
              className={`h-full transition-all duration-150 ${hasScrolledToBottom ? "bg-emerald-500" : "bg-gradient-to-r from-violet-500 to-cyan-400"}`}
              style={{ width: `${hasScrolledToBottom ? 100 : scrollProgress}%` }}
            />
          </div>
        )}

        {/* Body */}
        {!resultadoCiencia ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Scrollable Content */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 p-6 overflow-y-auto space-y-4 text-white/80 leading-relaxed text-sm bg-[#080A12]/50"
            >
              <div className="p-4 bg-[#101019] rounded-xl border border-white/5 mb-4">
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wide mb-1">
                  Diretriz de Leitura Obrigatória
                </h3>
                <p className="text-xs text-white/50">
                  Para habilitar a declaração de ciência com validade jurídica e prova de integridade SHA-256, role todo o conteúdo até o fim (ou visualize o conteúdo completo).
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs font-mono text-cyan-400">
                  <span>Progresso de leitura: {hasScrolledToBottom ? 100 : scrollProgress}%</span>
                  {hasScrolledToBottom ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Leitura concluída
                    </span>
                  ) : (
                    <span className="text-amber-400/80">Role para continuar</span>
                  )}
                </div>
              </div>

              {/* Texto do Comunicado */}
              <div className="prose prose-invert max-w-none text-white/90 whitespace-pre-wrap font-sans text-sm">
                {comunicado.conteudo}
              </div>

              {/* Anexos */}
              {comunicado.anexos && comunicado.anexos.length > 0 && (
                <div className="pt-4 border-t border-white/10 mt-6">
                  <h4 className="text-xs font-bold text-white/70 uppercase mb-2">Anexos Vinculados ({comunicado.anexos.length})</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {comunicado.anexos.map((anexo) => (
                      <div key={anexo.id} className="p-3 bg-[#12141F] rounded-lg border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span className="text-xs font-medium text-white truncate">{anexo.nomeOriginal}</span>
                        </div>
                        <span className="text-[10px] text-white/40">{(anexo.tamanhoBytes / 1024).toFixed(0)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hash de Conteúdo */}
              <div className="pt-4 border-t border-white/5 text-[11px] font-mono text-white/40 flex items-center gap-2">
                <Lock className="w-3 h-3 text-indigo-400" />
                <span>Hash do Conteúdo: {comunicado.conteudoHash}</span>
              </div>
            </div>

            {/* Footer with Checkbox and Action */}
            <div className="p-6 border-t border-white/10 bg-[#0d0d16] space-y-4">
              <div className={`p-4 rounded-xl border transition-all ${hasScrolledToBottom ? "bg-indigo-500/5 border-indigo-500/30" : "bg-white/[0.02] border-white/5 opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="declaracao"
                    disabled={!hasScrolledToBottom}
                    checked={declaracaoChecked}
                    onCheckedChange={(v) => setDeclaracaoChecked(Boolean(v))}
                    className="mt-0.5 border-white/30 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                  />
                  <label
                    htmlFor="declaracao"
                    className={`text-xs leading-relaxed cursor-pointer select-none ${hasScrolledToBottom ? "text-white font-medium" : "text-white/40"}`}
                  >
                    Declaro que li e tomei ciência integral deste comunicado, ciente de sua vigência e aplicação no âmbito do 7º Registro de Imóveis de São Paulo.
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <Button variant="ghost" size="sm" onClick={onClose} className="text-white/60 hover:text-white text-xs">
                  Cancelar
                </Button>
                <Button
                  disabled={!hasScrolledToBottom || !declaracaoChecked || submitting}
                  onClick={handleDarCiencia}
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-40"
                >
                  {submitting ? "Gerando Prova de Integridade..." : "Dar Ciência com Prova de Integridade"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Tela de Sucesso com QR Code e Hash */
          <div className="p-8 flex flex-col items-center justify-center space-y-6 bg-[#080A12]/80">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center max-w-md">
              <h3 className="text-lg font-black text-white">Ciência Registrada com Sucesso!</h3>
              <p className="text-xs text-white/60 mt-1">
                A prova criptográfica foi gerada e gravada de forma imutável na trilha de auditoria.
              </p>
            </div>

            <div className="w-full max-w-md p-4 bg-[#101019] rounded-2xl border border-white/10 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/40">Data e Hora:</span>
                <span className="text-white font-mono">{new Date(resultadoCiencia.timestamp).toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-white/40">IP Mascarado:</span>
                <span className="text-white font-mono">{resultadoCiencia.ipMascarado}</span>
              </div>
              <div className="flex flex-col py-1 border-b border-white/5">
                <span className="text-white/40 mb-1">Hash do Comprovante (SHA-256):</span>
                <span className="text-cyan-400 font-mono text-[10px] break-all bg-black/40 p-1.5 rounded border border-white/5">
                  {resultadoCiencia.comprovanteHash}
                </span>
              </div>

              {/* QR Code */}
              <div className="pt-2 flex justify-center">
                <QRComprovante url={resultadoCiencia.qrCodeUrl} hash={resultadoCiencia.comprovanteHash} />
              </div>
            </div>

            <div className="flex items-center gap-3 w-full max-w-md">
              <Button
                variant="outline"
                onClick={handleDownloadComprovante}
                className="flex-1 border-white/10 text-white/80 hover:bg-white/10 text-xs gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Comprovante</span>
              </Button>
              <Button
                onClick={onClose}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
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

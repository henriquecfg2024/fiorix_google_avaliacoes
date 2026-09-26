"use client";

import React, { useState, useEffect } from "react";
import { Download, Lock, FileText, X, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SecurePDFViewerProps {
  documentTitle: string;
  documentType: "holerite" | "comunicado" | "ferias";
  documentId: string;
  fileUrl: string;
  userName: string;
  allowDownload?: boolean;
  onClose?: () => void;
}

export function SecurePDFViewer({
  documentTitle,
  documentType,
  documentId,
  fileUrl,
  userName,
  allowDownload = false,
  onClose,
}: SecurePDFViewerProps) {
  const [timestamp, setTimestamp] = useState<string>("");

  useEffect(() => {
    setTimestamp(new Date().toLocaleString("pt-BR"));
    // Log view event
    fetch("/api/lgpd/solicitacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: `${documentType}_view`,
        recursoId: documentId,
      }),
    }).catch(() => {});
  }, [documentType, documentId]);

  const handlePrint = () => {
    fetch("/api/lgpd/solicitacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: `${documentType}_print`,
        recursoId: documentId,
      }),
    }).catch(() => {});
    window.print();
  };

  const handleDownload = () => {
    if (!allowDownload) return;
    fetch("/api/lgpd/solicitacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: `${documentType}_download_authorized`,
        recursoId: documentId,
      }),
    }).catch(() => {});
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = `${documentTitle}.pdf`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl h-[85vh] bg-white dark:bg-[#0B1020] border border-white/12 rounded-[28px] flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#070A12]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {documentTitle}
              </h2>
              <p className="text-xs text-white/50">
                Documento pessoal e confidencial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-slate-200 dark:border-white/10 text-white/80 hover:bg-white/10 text-xs gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </Button>
            {allowDownload && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="border-slate-200 dark:border-white/10 text-white/80 hover:bg-white/10 text-xs gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar</span>
              </Button>
            )}
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-slate-200 dark:border-white/10 text-white/80 hover:bg-white/10 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                title="Abrir PDF em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Nova Aba</span>
              </a>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content Viewer Area with Dynamic Watermark */}
        <div className="relative flex-1 bg-[#05050a] overflow-auto flex items-center justify-center p-6 select-none">
          {/* Watermark Overlay */}
          <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-around overflow-hidden opacity-10 rotate-[-25deg] select-none">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="whitespace-nowrap text-xs font-mono font-bold text-white/70 tracking-widest uppercase flex justify-around"
              >
                <span>
                  CONFIDENCIAL • {userName} • {timestamp}
                </span>
                <span>
                  DOCUMENTO PESSOAL • FIORIX
                </span>
              </div>
            ))}
          </div>

          {/* PDF Frame or Simulated Document Canvas */}
          {fileUrl ? (
            <div className="w-full h-full min-h-[500px] flex-1 flex flex-col bg-[#101019] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-inner relative z-0">
              <iframe
                src={fileUrl}
                title={documentTitle}
                className="w-full h-full min-h-[500px] flex-1 border-0 bg-white"
              />
            </div>
          ) : (
            <div className="w-full max-w-2xl min-h-[500px] bg-[#101019] border border-slate-200 dark:border-white/10 rounded-xl p-8 shadow-inner flex flex-col justify-between text-white/90">
              <div className="border-b border-slate-200 dark:border-white/10 pb-4 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-base text-white">7º REGISTRO DE IMÓVEIS DE SÃO PAULO</h3>
                  <p className="text-xs text-white/50">Sistema Integrado FIORIX PESSOAS</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/40">{timestamp}</p>
                </div>
              </div>

              <div className="my-8 space-y-4 text-xs text-white/70 leading-relaxed">
                <div className="p-3 bg-white/5 rounded-lg border border-slate-200 dark:border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase">Titular</span>
                    <span className="font-bold text-white">{userName}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase">Documento</span>
                    <span className="font-semibold text-indigo-300">{documentTitle}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-white/10 pt-4 flex items-center justify-between text-[10px] text-white/40">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Somente você pode visualizar este documento.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Security Notice */}
        <div className="px-6 py-3 bg-[#080A12] border-t border-slate-200 dark:border-white/5 flex items-center text-xs text-white/50">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Somente você pode visualizar seus documentos.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

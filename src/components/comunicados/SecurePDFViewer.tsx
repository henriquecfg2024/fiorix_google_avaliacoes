"use client";

import React, { useState, useEffect } from "react";
import { Download, Lock, FileText, X, ExternalLink, Printer, Loader2, AlertCircle, RefreshCw } from "lucide-react";
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
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const loadDocumentBlob = React.useCallback(() => {
    if (!fileUrl) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    fetch(fileUrl)
      .then(async (res) => {
        if (!res.ok) {
          const raw = await res.text().catch(() => "");
          let msg = `Erro ${res.status}: Não foi possível carregar o documento.`;
          try {
            const parsed = JSON.parse(raw);
            msg = parsed.error || msg;
          } catch {}
          throw new Error(msg);
        }
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error("[SecurePDFViewer] Erro ao carregar PDF:", err);
        setLoadError(err.message || "Falha na conexão ao carregar o arquivo.");
        setLoading(false);
      });
  }, [fileUrl]);

  useEffect(() => {
    loadDocumentBlob();
    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [loadDocumentBlob]);

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
    a.href = blobUrl || fileUrl;
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

          {fileUrl ? (
            <div className="w-full h-full min-h-[500px] flex-1 flex flex-col bg-[#101019] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-inner relative z-0">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#0a0c16] text-white">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-sm font-semibold text-white/90">Carregando documento seguro...</p>
                  <p className="text-xs text-white/50">Validando autenticidade e integridade criptográfica</p>
                </div>
              ) : loadError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#0a0c16] p-6 text-center text-white">
                  <div className="p-3 rounded-full bg-rose-500/10 text-rose-400">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-rose-200">{loadError}</p>
                    <p className="text-xs text-white/50">Não foi possível exibir o PDF no visualizador integrado.</p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadDocumentBlob}
                      className="gap-2 border-white/20 text-white hover:bg-white/10"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Tentar Novamente</span>
                    </Button>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir em Nova Aba</span>
                    </a>
                  </div>
                </div>
              ) : (
                <iframe
                  src={blobUrl || fileUrl}
                  title={documentTitle}
                  className="w-full h-full min-h-[500px] flex-1 border-0 bg-white"
                />
              )}
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

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Download,
  Lock,
  FileText,
  X,
  ExternalLink,
  Printer,
  Loader2,
  AlertCircle,
  RefreshCw,
  Maximize2,
  Minimize2,
} from "lucide-react";
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
  const [isMaximized, setIsMaximized] = useState(false);

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

  // Tecla ESC: se maximizado, restaura; se normal, fecha
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isMaximized) {
          setIsMaximized(false);
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMaximized, onClose]);

  const loadDocumentBlob = useCallback(() => {
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
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md transition-all duration-200 ${
        isMaximized ? "p-0" : "p-3 sm:p-5"
      }`}
    >
      <div
        className={`relative w-full bg-white dark:bg-[#0B1020] flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-200 ${
          isMaximized
            ? "w-screen h-screen max-w-none rounded-none border-0"
            : "max-w-5xl h-[88vh] border border-white/12 rounded-[24px]"
        }`}
      >
        {/* Header */}
        <div
          onDoubleClick={() => setIsMaximized((prev) => !prev)}
          className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-white/8 bg-[#070A12]/90 select-none cursor-default"
          title="Dê dois cliques para alternar entre maximizado e tamanho padrão"
        >
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate" title={documentTitle}>
                {documentTitle}
              </h2>
              <p className="text-[11px] text-white/50">
                Documento pessoal e confidencial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-slate-200 dark:border-white/10 text-white/80 hover:bg-white/10 text-xs gap-1.5 h-8 px-2.5 sm:px-3 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>
            {allowDownload && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="border-slate-200 dark:border-white/10 text-white/80 hover:bg-white/10 text-xs gap-1.5 h-8 px-2.5 sm:px-3 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Baixar</span>
              </Button>
            )}
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-slate-200 dark:border-white/10 text-white/80 hover:bg-white/10 text-xs px-2.5 sm:px-3 h-8 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Abrir PDF em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nova Aba</span>
              </a>
            )}

            {/* Botão Maximizar / Restaurar */}
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              aria-label={isMaximized ? "Restaurar tamanho da janela" : "Maximizar para tela cheia"}
              title={isMaximized ? "Restaurar tamanho da janela" : "Maximizar para tela cheia"}
              className="border border-slate-200 dark:border-white/10 text-white/80 hover:bg-white/10 hover:text-white text-xs p-2 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            >
              {isMaximized ? (
                <Minimize2 className="w-4 h-4 text-indigo-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-300 hover:text-white" />
              )}
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar visualizador"
                title="Fechar (ESC)"
                className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors ml-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content Viewer Area with Dynamic Watermark */}
        <div
          className={`relative flex-1 bg-[#05050a] overflow-auto flex items-center justify-center select-none ${
            isMaximized ? "p-2 sm:p-3" : "p-4 sm:p-6"
          }`}
        >
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
        <div className="px-6 py-2.5 bg-[#080A12] border-t border-slate-200 dark:border-white/5 flex items-center text-xs text-white/50 shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Somente você pode visualizar seus documentos.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

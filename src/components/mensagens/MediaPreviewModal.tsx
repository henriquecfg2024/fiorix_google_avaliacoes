'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Loader2,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface MediaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  anexo: {
    id: string;
    nomeArquivo: string;
    mimeType: string;
    tamanhoBytes: number;
  } | null;
}

function humanFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaPreviewModal({ isOpen, onClose, anexo }: MediaPreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Fecha ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Carrega URL assinada quando o anexo muda
  useEffect(() => {
    if (!isOpen || !anexo) {
      setSignedUrl(null);
      setError(null);
      setZoom(1);
      return;
    }

    setLoading(true);
    setError(null);
    setZoom(1);

    fetch(`/api/mensagens/anexo/${anexo.id}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Falha ao carregar visualização do arquivo.');
        }
        return res.json();
      })
      .then((data) => {
        if (data.signedUrl) {
          setSignedUrl(data.signedUrl);
        } else {
          throw new Error('URL de visualização não retornada.');
        }
      })
      .catch((err: any) => {
        console.error('[MediaPreviewModal] Erro:', err);
        setError(err.message || 'Erro ao carregar o arquivo.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, anexo]);

  const handleDownload = useCallback(async () => {
    if (!signedUrl || !anexo) return;
    try {
      const fileRes = await fetch(signedUrl);
      const blob = await fileRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = anexo.nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(signedUrl, '_blank');
    }
  }, [signedUrl, anexo]);

  if (!isOpen || !anexo) return null;

  const isImage = anexo.mimeType.startsWith('image/');
  const isPdf = anexo.mimeType.includes('pdf');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-preview-title"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* ── Barra Superior de Ferramentas ── */}
      <header
        className="w-full h-16 px-4 md:px-6 bg-[#0B1020]/90 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0 shadow-lg z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0 pr-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 id="media-preview-title" className="text-sm font-semibold text-white truncate max-w-sm md:max-w-md">
              {anexo.nomeArquivo}
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              {humanFileSize(anexo.tamanhoBytes)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* Controles de Zoom para Imagens */}
          {isImage && (
            <div className="hidden sm:flex items-center gap-1 bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-xl p-1 mr-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                title="Reduzir zoom"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono text-slate-300 px-1 min-w-[42px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                title="Aumentar zoom"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              {zoom !== 1 && (
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  title="Restaurar tamanho original"
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Abrir em nova aba */}
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir em nova aba"
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Download */}
          {signedUrl && (
            <button
              type="button"
              onClick={handleDownload}
              title="Baixar arquivo"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-500/20 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Baixar</span>
            </button>
          )}

          {/* Fechar */}
          <button
            type="button"
            onClick={onClose}
            title="Fechar visualização (ESC)"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Área Principal de Visualização ── */}
      <main
        className="flex-1 w-full h-[calc(100vh-64px)] overflow-hidden flex items-center justify-center p-3 md:p-6"
        onClick={(e) => {
          // Clique fora do conteúdo fecha o modal
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs">Carregando visualização segura...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 text-center max-w-sm p-6 rounded-2xl bg-[#0B1020] border border-rose-500/30">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <p className="text-xs text-rose-300">{error}</p>
            {signedUrl && (
              <button
                type="button"
                onClick={handleDownload}
                className="mt-2 px-4 py-2 bg-emerald-500 text-white text-xs font-semibold rounded-xl"
              >
                Tentar baixar diretamente
              </button>
            )}
          </div>
        ) : isImage && signedUrl ? (
          <div
            className="overflow-auto max-w-full max-h-full flex items-center justify-center p-4 transition-transform duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrl}
              alt={anexo.nomeArquivo}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-transform duration-150"
            />
          </div>
        ) : isPdf && signedUrl ? (
          <div
            className="w-full h-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 bg-[#0B1020]"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={signedUrl}
              className="w-full h-full border-none rounded-2xl"
              title={anexo.nomeArquivo}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center max-w-sm p-8 rounded-2xl bg-[#0B1020] border border-slate-200 dark:border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-1">{anexo.nomeArquivo}</p>
              <p className="text-xs text-slate-400 mb-4">
                Pré-visualização direta indisponível para este formato de arquivo.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer"
              >
                Baixar Arquivo ({humanFileSize(anexo.tamanhoBytes)})
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

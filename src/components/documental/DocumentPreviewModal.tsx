'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  X,
  Copy,
  Check,
  Printer,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Building2,
  ArrowLeft,
} from 'lucide-react';

export interface DocumentTextResult {
  fileName: string;
  extension: string;
  html: string;
  text: string;
  size: number;
}

interface DocumentPreviewModalProps {
  documento: DocumentTextResult;
  relativePath?: string;
  rootId?: string;
  onClose: () => void;
}

export function DocumentPreviewModal({
  documento,
  relativePath,
  rootId,
  onClose,
}: DocumentPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(documento.text || documento.html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${documento.fileName}</title>
          <style>
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 13pt;
              line-height: 1.6;
              color: #111;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1, h2, h3 { font-family: Arial, sans-serif; }
            .header {
              text-align: center;
              border-bottom: 2px solid #222;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            .header h2 { margin: 0; font-size: 14pt; letter-spacing: 1px; }
            .header p { margin: 4px 0 0 0; font-size: 10pt; color: #555; }
            p { margin: 0 0 12px 0; text-align: justify; text-indent: 2.5em; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>7º OFICIAL DE REGISTRO DE IMÓVEIS DE SÃO PAULO</h2>
            <p>Visualização de Minuta / Documento Interno • ${documento.fileName}</p>
          </div>
          ${documento.html || `<p>${documento.text.replace(/\n/g, '<br/>')}</p>`}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const wordCount = documento.text ? documento.text.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = documento.text ? documento.text.length : 0;

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-doc-title"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-2 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`flex flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl transition-all duration-300 ${
          isFullScreen
            ? 'fixed inset-2 sm:inset-4 w-auto h-auto max-w-none'
            : 'w-full max-w-4xl h-[92vh] max-h-[880px]'
        }`}
      >
        {/* Header Superior */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-3.5 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-400">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3
                  id="preview-doc-title"
                  className="truncate text-sm sm:text-base font-bold text-slate-100"
                  title={documento.fileName}
                >
                  {documento.fileName}
                </h3>
                <span className="rounded bg-sky-900/60 border border-sky-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300 shrink-0 uppercase">
                  {documento.extension.replace('.', '') || 'DOCX'}
                </span>
              </div>
              <p className="truncate text-xs font-mono text-slate-400 mt-0.5">
                {relativePath ? `${rootId ? `[${rootId}] ` : ''}${relativePath}` : `${Math.ceil(documento.size / 1024)} KB`}
              </p>
            </div>
          </div>

          {/* Ações da Barra */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Alternar Modo de Exibição */}
            <div className="hidden sm:flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('formatted')}
                className={`rounded px-2.5 py-1 transition ${
                  viewMode === 'formatted'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Formatado
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`rounded px-2.5 py-1 transition ${
                  viewMode === 'raw'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Texto Puro
              </button>
            </div>

            {/* Copiar Texto */}
            <button
              type="button"
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              title="Copiar todo o texto da minuta"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Copiar</span>
                </>
              )}
            </button>

            {/* Imprimir */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              title="Imprimir minuta com cabeçalho oficial do cartório"
            >
              <Printer className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            {/* Maximizar */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition"
              title={isFullScreen ? "Restaurar tamanho" : "Maximizar visualização"}
            >
              {isFullScreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>

            {/* Voltar */}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition shadow-sm active:scale-95 shrink-0"
              title="Voltar para a tela anterior"
            >
              <ArrowLeft className="h-4 w-4 text-cyan-400" />
              <span>Voltar</span>
            </button>

            {/* Fechar */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 hover:bg-slate-800 transition"
              title="Fechar visualizador"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Faixa Informativa de Segurança e Contexto */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 bg-slate-900/60 px-5 py-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Processado internamente pelo Connector via Mammoth OpenXML. Nenhum dado transferido para nuvem pública.</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
            <span>{wordCount.toLocaleString('pt-BR')} palavras</span>
            <span>•</span>
            <span>{charCount.toLocaleString('pt-BR')} caracteres</span>
            <span>•</span>
            <span>{Math.ceil(documento.size / 1024)} KB</span>
          </div>
        </div>

        {/* Área Central de Visualização (Estilo Folha de Cartório / Documento Oficial) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/70">
          <div className="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white text-slate-900 shadow-xl p-8 sm:p-12 min-h-full">
            {/* Cabeçalho Oficial do Registro */}
            <div className="text-center border-b border-slate-300 pb-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-slate-700 mb-1">
                <Building2 className="h-4 w-4 text-slate-600" />
                <h4 className="font-serif font-bold text-sm tracking-wider uppercase text-slate-800">
                  7º Oficial de Registro de Imóveis de São Paulo
                </h4>
              </div>
              <p className="font-sans text-[11px] text-slate-500">
                Visualização Local de Minuta / Manifestação Documental • {documento.fileName}
              </p>
            </div>

            {/* Conteúdo Renderizado */}
            {viewMode === 'formatted' ? (
              <div
                className="font-serif text-[15px] sm:text-[16px] leading-relaxed text-slate-900 space-y-4 prose-p:text-justify prose-p:indent-8 prose-headings:font-sans prose-headings:text-slate-900"
                dangerouslySetInnerHTML={{
                  __html: documento.html || `<p>${documento.text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
                }}
              />
            ) : (
              <pre className="font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap select-text">
                {documento.text || 'Sem texto detectável.'}
              </pre>
            )}
          </div>
        </div>

        {/* Rodapé do Modal com Botão Voltar */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/95 px-5 py-3 rounded-b-2xl text-xs text-slate-400">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-4 py-1.5 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition shadow active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 text-cyan-400" />
            <span>Voltar para tela anterior</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] hidden sm:inline">
              {documento.fileName}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

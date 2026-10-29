'use client';

import { useState, useEffect, useRef } from 'react';
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
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  Layers,
} from 'lucide-react';

export interface DocumentTextResult {
  fileName: string;
  extension: string;
  html: string;
  text: string;
  size: number;
  pdfDataUrl?: string;
  pages?: string[];
  pageCount?: number;
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

  // Estados para imagens (.KEN / TIFF)
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [modoVisualizacaoKen, setModoVisualizacaoKen] = useState<'pagina' | 'todas'>('pagina');
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const ext = (documento.extension || '').toLowerCase();
  const isKenOrTif = ext === '.ken' || ext === '.tif' || ext === '.tiff' || (!!documento.pages && documento.pages.length > 0);
  const isPdf = ext === '.pdf' || !!documento.pdfDataUrl;
  const isDoc = ext === '.docx' || ext === '.doc';

  const pages = documento.pages || [];
  const totalPages = pages.length || documento.pageCount || 1;

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
    // Se for imagem .KEN / TIFF
    if (isKenOrTif && pages.length > 0) {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      const imagesToPrint = modoVisualizacaoKen === 'todas'
        ? pages
        : [pages[currentPage - 1]];

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${documento.fileName}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: sans-serif; background: #fff; }
              .header { text-align: center; border-bottom: 2px solid #333; margin-bottom: 20px; padding-bottom: 10px; }
              .header h2 { margin: 0; font-size: 14pt; }
              .header p { margin: 4px 0 0 0; font-size: 10pt; color: #555; }
              .page-container { text-align: center; margin-bottom: 30px; page-break-after: always; }
              .page-container:last-child { page-break-after: auto; }
              img { max-width: 100%; height: auto; }
              @media print {
                body { padding: 0; }
                .page-container { page-break-after: always; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>7º OFICIAL DE REGISTRO DE IMÓVEIS DE SÃO PAULO</h2>
              <p>Livro 2 – Registro Geral • Matrícula Digitalizada (${documento.fileName})</p>
            </div>
            ${imagesToPrint.map((src, i) => `
              <div class="page-container">
                <p style="font-size: 11px; color: #666; margin-bottom: 6px;">Folha ${modoVisualizacaoKen === 'todas' ? i + 1 : currentPage} de ${pages.length}</p>
                <img src="${src}" alt="Folha ${i + 1}" />
              </div>
            `).join('')}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
      return;
    }

    // Se for PDF
    if (isPdf && documento.pdfDataUrl) {
      const win = window.open(documento.pdfDataUrl, '_blank');
      win?.focus();
      return;
    }

    // Minuta / DOCX
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

  const handleDownload = () => {
    if (isKenOrTif && pages[currentPage - 1]) {
      const a = document.createElement('a');
      a.href = pages[currentPage - 1];
      a.download = `${documento.fileName}_folha_${currentPage}.png`;
      a.click();
    } else if (isPdf && documento.pdfDataUrl) {
      const a = document.createElement('a');
      a.href = documento.pdfDataUrl;
      a.download = documento.fileName;
      a.click();
    }
  };

  const handleOpenInNewTab = () => {
    if (isPdf && documento.pdfDataUrl) {
      window.open(documento.pdfDataUrl, '_blank');
    } else if (isKenOrTif && pages[currentPage - 1]) {
      window.open(pages[currentPage - 1], '_blank');
    }
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
            : isKenOrTif || isPdf
              ? 'w-full max-w-5xl h-[94vh] max-h-[960px]'
              : 'w-full max-w-4xl h-[92vh] max-h-[880px]'
        }`}
      >
        {/* Header Superior */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-3 rounded-t-2xl">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm ${
                isKenOrTif
                  ? 'bg-amber-950/80 border-amber-500/40 text-amber-400'
                  : isPdf
                    ? 'bg-rose-950/80 border-rose-500/40 text-rose-400'
                    : 'bg-sky-950/80 border-sky-500/40 text-sky-400'
              }`}
            >
              {isKenOrTif ? (
                <Building2 className="h-5 w-5" />
              ) : isPdf ? (
                <FileText className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
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
                <span
                  className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold shrink-0 uppercase ${
                    isKenOrTif
                      ? 'bg-amber-900/60 border-amber-500/40 text-amber-300'
                      : isPdf
                        ? 'bg-rose-900/60 border-rose-500/40 text-rose-300'
                        : 'bg-sky-900/60 border-sky-500/40 text-sky-300'
                  }`}
                >
                  {documento.extension.replace('.', '') || (isKenOrTif ? 'KEN' : isPdf ? 'PDF' : 'DOCX')}
                </span>
              </div>
              <p className="truncate text-xs font-mono text-slate-400 mt-0.5">
                {relativePath ? `${rootId ? `[${rootId}] ` : ''}${relativePath}` : `${Math.ceil(documento.size / 1024)} KB`}
                {isKenOrTif && pages.length > 0 && ` • ${pages.length} folha(s) digitalizada(s)`}
              </p>
            </div>
          </div>

          {/* Ações da Barra */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Controles para Imagem .KEN / TIFF */}
            {isKenOrTif && pages.length > 0 && (
              <>
                {/* Navegação de Página */}
                <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-xs">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 transition"
                    title="Folha anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-mono text-xs font-semibold px-2 text-amber-300">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 transition"
                    title="Próxima folha"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Alternância: Folha a Folha vs Todas as Folhas */}
                <div className="hidden sm:flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setModoVisualizacaoKen('pagina')}
                    className={`rounded px-2 py-1 transition ${
                      modoVisualizacaoKen === 'pagina'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoVisualizacaoKen('todas')}
                    className={`rounded px-2 py-1 transition ${
                      modoVisualizacaoKen === 'todas'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todas ({totalPages})
                  </button>
                </div>

                {/* Zoom e Rotação */}
                <div className="hidden md:flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
                  <button
                    type="button"
                    onClick={() => setZoom(z => Math.max(40, z - 20))}
                    className="p-1 text-slate-400 hover:text-white transition"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono text-[11px] text-slate-300 w-11 text-center font-bold">
                    {zoom}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom(z => Math.min(300, z + 20))}
                    className="p-1 text-slate-400 hover:text-white transition"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation(r => (r + 90) % 360)}
                    className="p-1 text-slate-400 hover:text-amber-300 transition border-l border-slate-800 pl-1.5 ml-1"
                    title="Girar 90°"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}

            {/* Alternar Modo de Exibição para Minutas (DOCX/DOC) */}
            {isDoc && (
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
            )}

            {/* Botão Copiar (para minutas) */}
            {isDoc && (
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
            )}

            {/* Botão Abrir em Nova Guia (PDF ou KEN) */}
            {(isPdf || isKenOrTif) && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                title="Abrir arquivo em nova guia do navegador"
              >
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden md:inline">Nova Guia</span>
              </button>
            )}

            {/* Botão Download (KEN / PDF) */}
            {(isPdf || isKenOrTif) && (
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                title="Baixar arquivo / imagem"
              >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden md:inline">Baixar</span>
              </button>
            )}

            {/* Botão Imprimir */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              title="Imprimir visualização oficial"
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

        {/* Faixa Informativa de Contexto e Cartório */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 bg-slate-900/60 px-5 py-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>
              {isKenOrTif
                ? 'Acervo oficial de imagens digitalizadas do 7º RI (Wang TIFF / Kenta .KEN). Armazenamento local seguro em K:\\IMAGENS\\LV2.'
                : isPdf
                  ? 'Arquivo PDF processado localmente no cartório para conferência visual direta do escrevente.'
                  : 'Processado internamente pelo Connector via Mammoth OpenXML. Nenhum dado transferido para nuvem pública.'}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
            {isDoc && (
              <>
                <span>{wordCount.toLocaleString('pt-BR')} palavras</span>
                <span>•</span>
                <span>{charCount.toLocaleString('pt-BR')} caracteres</span>
                <span>•</span>
              </>
            )}
            {isKenOrTif && pages.length > 0 && (
              <>
                <span className="text-amber-400 font-bold">{pages.length} Folha(s) no Livro 2</span>
                <span>•</span>
              </>
            )}
            <span>{Math.ceil(documento.size / 1024)} KB</span>
          </div>
        </div>

        {/* Área Central de Visualização */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-950/70">
          {/* CASO 1: Matrícula Digitalizada (.KEN / TIFF) */}
          {isKenOrTif && pages.length > 0 ? (
            <div ref={imageContainerRef} className="flex flex-col items-center justify-center min-h-full">
              {modoVisualizacaoKen === 'pagina' ? (
                // Exibição Folha a Folha com Zoom e Rotação
                <div className="flex flex-col items-center space-y-4 max-w-full">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-950/40 px-3.5 py-1 text-xs text-amber-300 shadow-sm">
                    <Building2 className="h-3.5 w-3.5 text-amber-400" />
                    <span className="font-semibold">Ficha {currentPage} de {totalPages}</span>
                    <span className="text-amber-400/60">•</span>
                    <span className="font-mono text-[11px] text-amber-400/80">Livro 2 – Registro Geral</span>
                  </div>

                  <div
                    className="overflow-auto max-w-full flex items-center justify-center p-2 rounded-xl transition-all duration-150"
                    style={{
                      transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <img
                      src={pages[currentPage - 1]}
                      alt={`Ficha ${currentPage}`}
                      className="rounded-lg shadow-2xl border border-slate-700 bg-white max-h-[78vh] object-contain"
                    />
                  </div>
                </div>
              ) : (
                // Exibição de Todas as Folhas Continuamente
                <div className="w-full max-w-4xl space-y-8 py-4">
                  {pages.map((pageSrc, idx) => (
                    <div key={idx} className="flex flex-col items-center space-y-2 border-b border-slate-800 pb-8 last:border-b-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 text-xs text-amber-300">
                        <Building2 className="h-3.5 w-3.5 text-amber-400" />
                        <span className="font-semibold">Ficha / Folha {idx + 1} de {totalPages}</span>
                      </div>
                      <img
                        src={pageSrc}
                        alt={`Ficha ${idx + 1}`}
                        className="rounded-lg shadow-2xl border border-slate-700 bg-white max-w-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : isPdf && documento.pdfDataUrl ? (
            /* CASO 2: Visualizador Interativo de PDF */
            <div className="w-full h-full flex flex-col rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900 min-h-[600px]">
              <iframe
                src={documento.pdfDataUrl}
                className="w-full flex-1 min-h-[650px] border-0 bg-white"
                title={documento.fileName}
              />
            </div>
          ) : isDoc ? (
            /* CASO 3: Minuta Word (.DOCX / .DOC) em Folha Oficial do 7º RI */
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
          ) : (
            /* CASO 4: Fallback Genérico para outros arquivos */
            <div className="mx-auto max-w-3xl rounded-xl border border-slate-800 bg-slate-900 text-slate-200 shadow-xl p-6 min-h-full">
              <div
                className="font-sans text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: documento.html || `<pre>${documento.text}</pre>` }}
              />
            </div>
          )}
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

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Download, Printer, X } from 'lucide-react';
import type { ReurbExportacaoDTO } from '@/lib/reurb/types';
import {
  buildNomeArquivoComprovantePdf,
  gerarPdfComprovanteExportacaoReurb,
} from './reurb-comprovante-pdf';
import {
  gerarHtmlComprovanteExportacaoReurb,
  imprimirHtmlA4,
  isExportacaoElegivelComprovante,
  triggerDownloadBlob,
} from './reurb-ui-helpers';

interface ComprovanteExportacaoModalProps {
  exportacao: ReurbExportacaoDTO | null;
  onClose: () => void;
}

/** Modal de pré-visualização A4 e impressão do comprovante de geração de arquivo JSON. */
export function ComprovanteExportacaoModal({
  exportacao,
  onClose,
}: ComprovanteExportacaoModalProps) {
  const printCleanupRef = useRef<(() => void) | null>(null);

  const html = useMemo(() => {
    if (!isExportacaoElegivelComprovante(exportacao)) return null;
    return gerarHtmlComprovanteExportacaoReurb(exportacao);
  }, [exportacao]);

  useEffect(() => {
    return () => {
      printCleanupRef.current?.();
      printCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!html) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [html, onClose]);

  if (!exportacao || !html) return null;

  const confirmadaOnr = exportacao.statusImportacaoOnr === 'CONFIRMADA_ONR';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Comprovante de Geração de Arquivo JSON"
    >
      <button
        type="button"
        aria-label="Fechar visualização do comprovante"
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-default"
      />

      <div className="relative z-10 w-full max-w-[900px] rounded-2xl border border-white/15 bg-[#0D1322] text-white shadow-2xl overflow-hidden flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0D1322] px-5 py-3.5">
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white">
                Comprovante de Geração de Arquivo JSON
              </h2>
              {confirmadaOnr ? (
                <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-200">
                  Importada no Ofício Eletrônico
                </span>
              ) : (
                <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-200">
                  Aguardando importação manual no Ofício Eletrônico
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {exportacao.nomeArquivoJson || exportacao.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const bytes = gerarPdfComprovanteExportacaoReurb(exportacao);
                const copy = new Uint8Array(bytes.byteLength);
                copy.set(bytes);
                triggerDownloadBlob(
                  new Blob([copy.buffer], { type: 'application/pdf' }),
                  buildNomeArquivoComprovantePdf(exportacao),
                  'application/pdf'
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/45 bg-cyan-600/20 px-3.5 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-600/35"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar PDF
            </button>
            <button
              type="button"
              onClick={() => {
                printCleanupRef.current?.();
                printCleanupRef.current = imprimirHtmlA4(html);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir / Salvar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar visualização"
              className="rounded-xl border border-white/15 p-2 text-slate-300 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="bg-[#070A12] p-4">
          <iframe
            title="Pré-visualização do Comprovante de Geração de Arquivo JSON"
            srcDoc={html}
            sandbox=""
            className="w-full h-[74vh] rounded-xl border border-white/15 bg-white shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}

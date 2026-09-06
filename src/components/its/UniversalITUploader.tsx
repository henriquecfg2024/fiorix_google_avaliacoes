'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Mail,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface UniversalITUploaderProps {
  onParseSuccess: (data: {
    tipoDetectado: string;
    nomeArquivo: string;
    hashSha256: string;
    itensExtraidos: {
      objetivo: string;
      responsavel: string;
      quandoUsar?: string;
      procedimento: Array<{ ordem: number; titulo: string; desc: string }>;
      checklist: string[];
      errosComuns: string[];
    };
  }) => void;
  onCancel?: () => void;
}

export function UniversalITUploader({ onParseSuccess, onCancel }: UniversalITUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const processFileOrHtml = async (file: File | null, textHtml?: string) => {
    setIsUploading(true);
    setStatusMessage('Lendo arquivo e calculando carimbo SHA-256...');

    try {
      // Verificação de resolução para imagens
      if (file && file.type.startsWith('image/')) {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        await new Promise((resolve) => {
          img.onload = () => {
            if (img.width < 800) {
              toast.warning('Atenção: Imagem com largura inferior a 800px. O OCR pode ter precisão reduzida.');
            }
            URL.revokeObjectURL(objectUrl);
            resolve(true);
          };
          img.onerror = () => resolve(true);
        });
      }

      setStatusMessage('Processando conteúdo com o Parser Universal...');
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else if (textHtml) {
        formData.append('textHtml', textHtml);
      }

      const res = await fetch('/api/its/universal-parser', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao processar arquivo.');
      }

      setStatusMessage('Estruturando nova versão com IA...');
      const result = await res.json();

      toast.success(`Documento "${result.nomeArquivo}" processado com sucesso!`);
      onParseSuccess(result);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro no processamento: ' + (err.message || 'Erro desconhecido.'));
    } finally {
      setIsUploading(false);
      setStatusMessage('');
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      await processFileOrHtml(acceptedFiles[0]);
    },
    [processFileOrHtml]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'message/rfc822': ['.eml'],
      'application/vnd.ms-outlook': ['.msg'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
    },
  });

  // Suporte a arraste direto de texto/HTML de e-mails do Gmail/Outlook Web
  const handleDirectDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const htmlData = e.dataTransfer.getData('text/html');
    const plainText = e.dataTransfer.getData('text/plain');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFileOrHtml(e.dataTransfer.files[0]);
    } else if (htmlData || plainText) {
      await processFileOrHtml(null, htmlData || plainText);
    }
  };

  return (
    <div className="w-full bg-[#121212] border border-zinc-800 rounded-2xl p-6 text-white shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-white">Uploader Universal Inteligente</h3>
            <p className="text-xs text-zinc-400">
              Arraste PDF, Word, Excel, E-mail do Outlook/Gmail ou foto do procedimento
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div
        {...getRootProps()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDirectDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragActive || dragActive
            ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
            : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50 hover:bg-zinc-900'
        }`}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            <p className="font-medium text-emerald-300 text-sm">{statusMessage}</p>
            <p className="text-xs text-zinc-500">Aguarde enquanto extraímos e estruturamos as regras do 7º RI SP...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-300 shadow-inner group-hover:scale-105 transition-transform">
              <UploadCloud className="w-8 h-8 text-emerald-400" />
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-200">
                Arraste o arquivo ou <span className="text-emerald-400 underline underline-offset-2">clique para selecionar</span>
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Suporta arraste direto da janela do Gmail/Outlook sem precisar salvar o e-mail
              </p>
            </div>

            {/* Badges de formatos aceitos */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2 pt-3 border-t border-zinc-800/80">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                <FileText className="w-3 h-3" /> PDF
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <FileText className="w-3 h-3" /> Word (.docx)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <FileSpreadsheet className="w-3 h-3" /> Excel (.xlsx)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Mail className="w-3 h-3" /> E-mail (.eml/.msg)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <ImageIcon className="w-3 h-3" /> Imagem / Foto
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

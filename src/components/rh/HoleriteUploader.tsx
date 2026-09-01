"use client";

import React, { useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadItem {
  arquivo: string;
  cpf?: string;
  colaborador?: string;
  competencia?: string;
  status: "MATCH" | "NÃO ENCONTRADO" | "DUPLICADO" | "FORMATO INVÁLIDO" | "PENDENTE";
}

export function HoleriteUploader() {
  const [files, setFiles] = useState<File[]>([]);
  const [previewItems, setPreviewItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files);
    setFiles(selected);
    setUploadDone(false);

    // Gera o preview prévio
    const items: UploadItem[] = selected.map((file) => {
      const match = file.name.match(/^(\d{11})_(\d{2})-(\d{4})\.pdf$/i);
      if (!match) {
        return {
          arquivo: file.name,
          status: "FORMATO INVÁLIDO",
        };
      }
      const [, cpf, mes, ano] = match;
      return {
        arquivo: file.name,
        cpf: `${cpf.substring(0, 3)}.***.***-${cpf.substring(9)}`,
        competencia: `${mes}/${ano}`,
        status: "PENDENTE",
      };
    });

    setPreviewItems(items);
  };

  const handleUpload = async () => {
    if (files.length === 0 || uploading) return;
    setUploading(true);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/rh/upload-holerites", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.resultados) {
        setPreviewItems(data.resultados);
        setUploadDone(true);
      } else {
        alert(data.error || "Erro no envio de documentos");
      }
    } catch (err) {
      alert("Falha na comunicação com o servidor.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Upload em Lote de Holerites & Comprovantes
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Padrão de nomenclatura obrigatório: <code className="text-cyan-300 font-mono">CPF_MM-AAAA.pdf</code> (ex: 12345678901_08-2026.pdf)
          </p>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
          BUCKET PRIVADO + HASH SHA-256
        </span>
      </div>

      {/* Dropzone Area */}
      <div className="relative border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-8 flex flex-col items-center justify-center transition-colors bg-[#070A12]/40">
        <UploadCloud className="w-10 h-10 text-indigo-400 mb-3" />
        <p className="text-xs font-semibold text-white">Arraste os arquivos PDF ou clique para selecionar</p>
        <p className="text-[11px] text-slate-400 mt-1">Até 5MB por arquivo • Processamento automático com validação de integridade</p>
        <input
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileSelection}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>

      {/* Pre-upload Validation Table */}
      {previewItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/70">
              Arquivos selecionados ({previewItems.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFiles([]);
                setPreviewItems([]);
              }}
              className="text-white/40 hover:text-white text-xs h-7"
            >
              Limpar seleção
            </Button>
          </div>

          <div className="border border-white/5 rounded-xl overflow-hidden bg-[#101019]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#12141F] text-white/40 uppercase font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-4 py-2.5">Arquivo</th>
                  <th className="px-4 py-2.5">CPF</th>
                  <th className="px-4 py-2.5">Colaborador</th>
                  <th className="px-4 py-2.5">Competência</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {previewItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 font-mono text-white flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="truncate max-w-[200px]">{item.arquivo}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-white/60">{item.cpf || "-"}</td>
                    <td className="px-4 py-2.5">{item.colaborador || "-"}</td>
                    <td className="px-4 py-2.5 font-mono text-cyan-400">{item.competencia || "-"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === "MATCH"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : item.status === "PENDENTE"
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleUpload}
              disabled={uploading || uploadDone}
              className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-90 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20"
            >
              {uploading ? "Enviando e Gerando Hashes..." : uploadDone ? "✓ Upload Concluído com Sucesso" : "Enviar Documentos com Segurança"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

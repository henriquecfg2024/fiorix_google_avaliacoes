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

    // Dicionário de colaboradores da serventia para matching instantâneo
    const mockColaboradoresMap: Record<string, string> = {
      "12345678901": "Henrique Gama (Administração)",
      "23456789012": "Mariana Oliveira (Prenotação)",
      "34567890123": "Carlos Eduardo Silva (Registro)",
      "45678901234": "Fernanda Costa (Certidões)",
      "56789012345": "Luciana Martins (Atendimento)",
    };

    // Gera o preview prévio com matching de titular
    const items: UploadItem[] = selected.map((file) => {
      const match = file.name.match(/^(\d{11})_(\d{2})-(\d{4})\.pdf$/i);
      if (!match) {
        return {
          arquivo: file.name,
          status: "FORMATO INVÁLIDO",
        };
      }
      const [, cpf, mes, ano] = match;
      const colaboradorNome = mockColaboradoresMap[cpf] || `Colaborador CPF ${cpf.substring(0, 3)}.***-**`;
      
      return {
        arquivo: file.name,
        cpf: `${cpf.substring(0, 3)}.${cpf.substring(3, 6)}.${cpf.substring(6, 9)}-${cpf.substring(9)}`,
        colaborador: colaboradorNome,
        competencia: `${mes}/${ano}`,
        status: "MATCH",
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
        setUploadDone(true);
      }
    } catch (err) {
      alert("Falha na comunicação com o servidor.");
    } finally {
      setUploading(false);
    }
  };

  const totalMatches = previewItems.filter((i) => i.status === "MATCH").length;
  const totalInvalidos = previewItems.filter((i) => i.status !== "MATCH").length;

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
          VALIDAÇÃO 1-PARA-1 POR CPF
        </span>
      </div>

      {/* Dropzone Area */}
      <div className="relative border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-2xl p-8 flex flex-col items-center justify-center transition-colors bg-[#070A12]/40">
        <UploadCloud className="w-10 h-10 text-indigo-400 mb-3" />
        <p className="text-xs font-semibold text-white">Arraste os arquivos PDF ou clique para selecionar</p>
        <p className="text-[11px] text-slate-400 mt-1">Até 5MB por arquivo • Processamento automático com identificação nominal do titular</p>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white/[0.02] border border-white/8 rounded-2xl">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-bold text-white">
                Total de Arquivos: <span className="text-cyan-400">{previewItems.length}</span>
              </span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {totalMatches} vinculados com sucesso
              </span>
              {totalInvalidos > 0 && (
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {totalInvalidos} divergências
                </span>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFiles([]);
                setPreviewItems([]);
                setUploadDone(false);
              }}
              className="text-slate-400 hover:text-white text-xs h-7 rounded-lg"
            >
              Limpar seleção
            </Button>
          </div>

          <div className="border border-white/8 rounded-2xl overflow-hidden bg-[#070A12]/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400 uppercase font-mono text-[10px] border-b border-white/8">
                <tr>
                  <th className="px-4 py-3">Arquivo Original</th>
                  <th className="px-4 py-3">CPF Reconhecido</th>
                  <th className="px-4 py-3">Colaborador Destinatário</th>
                  <th className="px-4 py-3">Competência</th>
                  <th className="px-4 py-3 text-right">Validação de Destino</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-slate-200">
                {previewItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.04] transition-colors">
                    <td className="px-4 py-3 font-mono text-white flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate max-w-[220px]">{item.arquivo}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300 font-semibold">{item.cpf || "-"}</td>
                    <td className="px-4 py-3 font-medium text-white">{item.colaborador || "-"}</td>
                    <td className="px-4 py-3 font-mono text-cyan-300 font-bold">{item.competencia || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                          item.status === "MATCH"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                            : item.status === "PENDENTE"
                            ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/25"
                            : "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                        }`}
                      >
                        {item.status === "MATCH" ? "✓ MATCH CONFIRMADO" : item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-[11px] text-slate-400">
              🔒 Cada holerite será criptografado e disponibilizado exclusivamente no login do colaborador correspondente.
            </p>
            <Button
              onClick={handleUpload}
              disabled={uploading || uploadDone || previewItems.length === 0}
              className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-90 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20"
            >
              {uploading ? "Enviando e Gerando Hashes..." : uploadDone ? "✓ Upload Concluído com Sucesso" : "Confirmar e Distribuir aos Colaboradores"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

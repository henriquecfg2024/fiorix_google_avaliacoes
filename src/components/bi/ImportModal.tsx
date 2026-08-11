"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { Upload, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportModal({ isOpen, onClose, onSuccess }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV válido.");
      return;
    }
    setFile(selectedFile);

    // BOM character fix and parsing
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        const rawRows = results.data;
        if (rawRows.length === 0) {
          toast.error("O arquivo CSV está vazio.");
          return;
        }

        // Map and validate columns
        const dbRows = rawRows.map((row: any) => {
          const getVal = (col: string) => {
            if (row[col] !== undefined && row[col] !== null) return String(row[col]).trim();
            const key = Object.keys(row).find(
              (k) => k.toLowerCase().replace(/[^a-z0-9_]/g, "") === col.toLowerCase().replace(/[^a-z0-9_]/g, "")
            );
            return key ? String(row[key]).trim() : "";
          };

          const parseDate = (val: string) => {
            if (!val) return new Date().toISOString().split("T")[0];
            // Handle various formats like YYYY-MM-DD or DD/MM/YYYY
            if (val.includes("/")) {
              const parts = val.split("/");
              if (parts.length === 3) {
                // assume DD/MM/YYYY
                return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
              }
            }
            return val.split(" ")[0]; // Take only the date part of YYYY-MM-DD HH:mm:ss
          };

          const dataStr = parseDate(getVal("data") || getVal("dtprotocolo") || getVal("data_protocolo"));
          const horaNum = parseInt(getVal("hora_num") || "0", 10);
          const diaSemana = getVal("dia_semana") || "Monday";
          const hora = getVal("hora") || "00:00";
          const pedido = parseInt(getVal("pedido") || getVal("protocolo") || "0", 10);
          const nome = getVal("nome") || "Sem Nome";
          const tipo = getVal("tipo") || "TÍTULO";
          const tipoPedido = getVal("tipo_pedido") || "PRENOTADO";
          const tipoDetalhado = getVal("tipo_detalhado") || "";
          const quantidade = parseInt(getVal("quantidade") || "1", 10);

          return {
            DATA: dataStr,
            HORA_NUM: isNaN(horaNum) ? 0 : horaNum,
            DIA_SEMANA: diaSemana,
            HORA: hora,
            PEDIDO: pedido,
            NOME: nome,
            TIPO: tipo,
            TIPO_PEDIDO: tipoPedido,
            TIPO_DETALHADO: tipoDetalhado,
            QUANTIDADE: isNaN(quantidade) ? 1 : quantidade,
          };
        }).filter(r => r.PEDIDO > 0 && r.DATA);

        setParsedData(dbRows);
        setPreview(dbRows.slice(0, 10));
        toast.success(`Arquivo carregado. ${dbRows.length} registros prontos para importação.`);
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV: ${error.message}`);
      }
    });
  };

  const handleConfirmImport = async () => {
    if (parsedData.length === 0) return;
    setIsImporting(true);

    try {
      const chunkSize = 1000;
      let insertedCount = 0;

      for (let i = 0; i < parsedData.length; i += chunkSize) {
        const chunk = parsedData.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("fiorix_produtividade_dados")
          .upsert(chunk, { onConflict: "PEDIDO,DATA" });

        if (error) throw error;
        insertedCount += chunk.length;
      }

      toast.success(`Sucesso! ${insertedCount} registros importados/atualizados.`);
      onSuccess();
      onClose();
      // Reset state
      setFile(null);
      setPreview([]);
      setParsedData([]);
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error(`Erro ao salvar no banco de dados: ${error.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl rounded-xl border border-white/10 bg-[#0A0F1E] p-6 shadow-2xl animate-in zoom-in-95 duration-250 text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <h2 className="text-xl font-bold tracking-tight">Importar Dados de Produtividade</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-white/60 hover:text-white hover:bg-white/10">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Upload Zone */}
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 hover:border-[#00C950]/50 rounded-lg p-10 cursor-pointer bg-white/[0.01] hover:bg-white/[0.03] transition-all group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <div className="p-4 rounded-full bg-white/[0.03] border border-white/10 group-hover:border-[#00C950]/30 transition-all mb-4">
              <Upload className="h-8 w-8 text-white/60 group-hover:text-[#00C950] transition-colors" />
            </div>
            <p className="text-sm font-semibold mb-1 text-white">Arraste e solte o arquivo CSV aqui</p>
            <p className="text-xs text-white/40">ou clique para selecionar do computador</p>
            <div className="mt-4 text-xs text-white/50 bg-white/5 px-3 py-1.5 rounded border border-white/10">
              Colunas esperadas: DATA, HORA_NUM, DIA_SEMANA, HORA, PEDIDO, NOME, TIPO, TIPO_PEDIDO, QUANTIDADE
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white/[0.02] border border-white/10 p-3 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-[#00C950]/10 border border-[#00C950]/20">
                  <Check className="h-5 w-5 text-[#00C950]" />
                </div>
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-white/40">{(file.size / 1024).toFixed(1)} KB • {parsedData.length} registros</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setPreview([]);
                  setParsedData([]);
                }}
                className="text-white/60 hover:text-red-400 hover:bg-white/5"
              >
                Remover
              </Button>
            </div>

            {/* Preview Table */}
            <div>
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Preview (Primeiras 10 linhas)</p>
              <div className="overflow-x-auto rounded border border-white/10 max-h-[300px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white/5 text-white/80 sticky top-0">
                    <tr>
                      <th className="p-2 border-b border-white/10">Pedido</th>
                      <th className="p-2 border-b border-white/10">Data</th>
                      <th className="p-2 border-b border-white/10">Hora</th>
                      <th className="p-2 border-b border-white/10">Dia</th>
                      <th className="p-2 border-b border-white/10">Nome</th>
                      <th className="p-2 border-b border-white/10">Tipo</th>
                      <th className="p-2 border-b border-white/10">Tipo Pedido</th>
                      <th className="p-2 border-b border-white/10">Qtd</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-white/[0.01]">
                    {preview.map((row, index) => (
                      <tr key={index} className="hover:bg-white/[0.02]">
                        <td className="p-2 border-r border-white/5 font-semibold text-[#2B7FFF]">{row.PEDIDO}</td>
                        <td className="p-2 border-r border-white/5">{row.DATA}</td>
                        <td className="p-2 border-r border-white/5">{row.HORA}</td>
                        <td className="p-2 border-r border-white/5">{row.DIA_SEMANA}</td>
                        <td className="p-2 border-r border-white/5 text-white/80">{row.NOME}</td>
                        <td className="p-2 border-r border-white/5">{row.TIPO}</td>
                        <td className="p-2 border-r border-white/5">{row.TIPO_PEDIDO}</td>
                        <td className="p-2">{row.QUANTIDADE}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-white hover:bg-white/10"
                disabled={isImporting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmImport}
                className="bg-[#00C950] text-black hover:bg-[#00A842] font-semibold"
                disabled={isImporting || parsedData.length === 0}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Importando...
                  </>
                ) : (
                  "Confirmar Importação"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

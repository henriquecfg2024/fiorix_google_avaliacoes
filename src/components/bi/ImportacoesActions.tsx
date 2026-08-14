"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Upload, UploadCloud } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ImportacoesActions() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingMetas, setIsImportingMetas] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [metasProgress, setMetasProgress] = useState({ current: 0, total: 0 });

  const handleImport = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV válido.");
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: 0 });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: async (results) => {
        const rawRows = results.data;

        if (rawRows.length === 0) {
          toast.error("O arquivo CSV está vazio.");
          setIsImporting(false);
          return;
        }

        const dbRows = rawRows
          .map((row: any) => {
            const getVal = (col: string) => {
              if (row[col] !== undefined && row[col] !== null) return String(row[col]).trim();

              const key = Object.keys(row).find(
                (k) =>
                  k.toLowerCase().replace(/[^a-z0-9_]/g, "") ===
                  col.toLowerCase().replace(/[^a-z0-9_]/g, "")
              );

              return key ? String(row[key]).trim() : "";
            };

            const parseDate = (val: string) => {
              if (!val) return new Date().toISOString().split("T")[0];

              if (val.includes("/")) {
                const parts = val.split("/");
                if (parts.length === 3) {
                  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                }
              }

              return val.split(" ")[0];
            };

            return {
              DATA: parseDate(getVal("data")),
              HORA: getVal("hora") || "00:00",
              DIA_SEMANA: getVal("dia_semana") || "Monday",
              HORA_NUM: parseInt(getVal("hora_num") || "0", 10),
              PEDIDO: parseInt(getVal("pedido") || "0", 10),
              NOME: getVal("nome") || "Outro",
              TIPO: getVal("tipo") || "TÍTULO",
              TIPO_PEDIDO: getVal("tipo_pedido") || "PRENOTADO",
              TIPO_DETALHADO: getVal("tipo_detalhado") || "",
              QUANTIDADE: parseInt(getVal("quantidade") || "1", 10),
            };
          })
          .filter((row: any) => row.PEDIDO > 0 && row.DATA);

        const totalRows = dbRows.length;
        if (totalRows === 0) {
          toast.error("Nenhum registro válido encontrado no CSV.");
          setIsImporting(false);
          return;
        }

        setImportProgress({ current: 0, total: totalRows });
        const importKey = crypto.randomUUID();
        const sortedDates = dbRows
          .map((row: any) => row.DATA)
          .filter(Boolean)
          .sort();
        const importMetaBase = {
          importKey,
          fileName: file.name,
          totalRows,
          importedBy: "Manual CSV",
          periodStart: sortedDates[0] || null,
          periodEnd: sortedDates[sortedDates.length - 1] || null,
        };

        try {
          const batchSize = 500;
          let importedTotal = 0;

          for (let start = 0; start < totalRows; start += batchSize) {
            const batch = dbRows.slice(start, start + batchSize);
            const batchNumber = Math.floor(start / batchSize) + 1;
            const totalBatches = Math.ceil(totalRows / batchSize);

            const res = await fetch("/api/bi/produtividade/import", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                rows: batch,
                importMeta: {
                  ...importMetaBase,
                  batchNumber,
                  totalBatches,
                },
              }),
            });

            if (!res.ok) {
              const responseType = res.headers.get("content-type") || "";

              if (responseType.includes("application/json")) {
                const errData = await res.json().catch(() => ({ error: "Erro desconhecido" }));
                throw new Error(
                  errData.error || `Falha no lote ${batchNumber}/${totalBatches}: HTTP ${res.status}`
                );
              }

              const rawText = await res.text().catch(() => "");
              const compactText = rawText.replace(/\s+/g, " ").trim();
              throw new Error(
                compactText
                  ? `Falha no lote ${batchNumber}/${totalBatches}: ${compactText.slice(0, 180)}`
                  : `Falha no lote ${batchNumber}/${totalBatches}: HTTP ${res.status}`
              );
            }

            const result = await res.json().catch(() => ({ success: true, count: batch.length }));
            importedTotal += Number(result.count ?? batch.length);
            setImportProgress({
              current: Math.min(start + batch.length, totalRows),
              total: totalRows,
            });
          }

          toast.success(`Importação de ${importedTotal.toLocaleString("pt-BR")} registros concluída!`);
          router.refresh();
        } catch (err: any) {
          console.error("Erro na importação de produtividade:", err);
          await fetch("/api/bi/produtividade/import", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "mark_failed",
              errorMessage: err.message || "Falha durante a importação",
              importMeta: importMetaBase,
            }),
          }).catch(() => null);
          toast.error(`Erro ao salvar no banco: ${err.message}`);
        } finally {
          setIsImporting(false);
        }
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV: ${error.message}`);
        setIsImporting(false);
      },
    });
  };

  const metasInputRef = useRef<HTMLInputElement>(null);

  const handleImportMetas = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV válido para Metas.");
      return;
    }

    setIsImportingMetas(true);
    setMetasProgress({ current: 0, total: 0 });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: async (results) => {
        const rawRows = results.data;

        if (rawRows.length === 0) {
          toast.error("O arquivo CSV de Metas está vazio.");
          setIsImportingMetas(false);
          return;
        }

        // Validate required headers
        const requiredHeaders = [
          "PROTOCOLO", "DATA_APRESENTADO", "DT_PREVISAO", "DT_ENTREGA_REAL", "STATUS",
          "ATRASO_DIAS", "D1_PROTOCOLO", "D1_ESCANEAMENTO", "D2_CONTRADITORIO", "D3_EXTRATO",
          "D4_QUALIFICACAO", "D5_CALCULO", "D8_IMPRESSAO", "D9_PREPARACAO", "D9_CONFERENCIA",
          "D10_ENTREGA", "QTD_RETRABALHO", "DIAS_D1_D2", "DIAS_D2_D3", "DIAS_D3_D4",
          "DIAS_D4_D5", "DIAS_D5_D8", "DIAS_D8_D9"
        ];
        
        const fileHeaders = results.meta.fields || [];
        const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));
        
        if (missingHeaders.length > 0) {
          toast.error(`CSV inválido. Colunas faltando: ${missingHeaders.join(", ")}`);
          setIsImportingMetas(false);
          return;
        }

        const totalRows = rawRows.length;
        setMetasProgress({ current: 0, total: totalRows });
        const importKey = crypto.randomUUID();

        // Extraindo datas para o periodo
        const dates = rawRows.map((r: any) => r.DATA_APRESENTADO).filter(Boolean).sort();
        const periodStart = dates[0] || null;
        const periodEnd = dates[dates.length - 1] || null;
        
        const importMetaBase = {
          importKey,
          fileName: file.name,
          totalRows,
          importedBy: "Manual CSV (Metas)",
          periodStart,
          periodEnd
        };

        try {
          const batchSize = 500;
          let importedTotal = 0;

          for (let start = 0; start < totalRows; start += batchSize) {
            const batch = rawRows.slice(start, start + batchSize);
            const batchNumber = Math.floor(start / batchSize) + 1;
            const totalBatches = Math.ceil(totalRows / batchSize);

            const res = await fetch("/api/bi/metas/import", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                rows: batch,
                importMeta: {
                  ...importMetaBase,
                  batchNumber,
                  totalBatches,
                },
              }),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({ error: "Erro desconhecido" }));
              throw new Error(errData.error || \`Falha no lote \${batchNumber}/\${totalBatches}\`);
            }

            const result = await res.json().catch(() => ({ success: true, count: batch.length }));
            importedTotal += Number(result.count ?? batch.length);
            setMetasProgress({
              current: Math.min(start + batch.length, totalRows),
              total: totalRows,
            });
          }

          toast.success(\`Importação de \${importedTotal.toLocaleString("pt-BR")} metas concluída!\`);
          router.refresh();
        } catch (err: any) {
          console.error("Erro na importação de metas:", err);
          toast.error(\`Erro ao salvar metas: \${err.message}\`);
        } finally {
          setIsImportingMetas(false);
        }
      },
      error: (error) => {
        toast.error(\`Erro ao ler CSV de Metas: \${error.message}\`);
        setIsImportingMetas(false);
      },
    });
  };

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImport(file);
          e.currentTarget.value = "";
        }}
        accept=".csv"
        className="hidden"
      />

      <Link href="/bi/importar">
        <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 gap-2">
          <UploadCloud className="h-4 w-4" />
          Importar Módulo BI
        </Button>
      </Link>

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        className="bg-[#00C950] hover:bg-[#00A844] text-white gap-2"
      >
        {isImporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Importando Produtividade ({Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%)
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Importar Produtividade
          </>
        )}
      </Button>

      <input
        type="file"
        ref={metasInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportMetas(file);
          e.currentTarget.value = "";
        }}
        accept=".csv"
        className="hidden"
      />

      <Button
        onClick={() => metasInputRef.current?.click()}
        disabled={isImportingMetas}
        className="bg-[#00C950] hover:bg-[#00A844] text-white gap-2"
      >
        {isImportingMetas ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Importando Metas ({Math.round((metasProgress.current / (metasProgress.total || 1)) * 100)}%)
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Importar Metas
          </>
        )}
      </Button>
    </div>
  );
}

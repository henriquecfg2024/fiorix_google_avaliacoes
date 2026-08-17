"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Upload, UploadCloud } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const aliases: Record<string, string[]> = {
  PROTOCOLO: ["protocolo", "numero_protocolo", "numero", "cod_protocolo", "nr_protocolo"],
  DATA_APRESENTADO: [
    "data_apresentado",
    "data_apresentacao",
    "data_entrada",
    "data_protocolo",
    "dt_protocolo",
    "DataDoTituloApresentado",
    "d1_protocolo",
  ],
  DT_PREVISAO: ["dt_previsao", "dt_previsao_entrega", "data_previsao", "data_previsao_entrega"],
  DT_ENTREGA_REAL: ["dt_entrega_real", "dt_entrega", "data_entrega", "data_entrega_real", "DtRetirada"],
  STATUS: ["status", "situacao", "status_protocolo"],
  NATUREZA: ["natureza", "naturezatitulo", "natureza_titulo", "tipo_detalhado", "tipo", "especie", "Natureza"],
  ATRASO_DIAS: ["atraso_dias", "dias_atraso", "atraso"],
};

const canonicalHeader = (header: string) => {
  const normalized = normalizeHeader(header);
  return (
    Object.entries(aliases).find(([, names]) =>
      names.some((name) => normalizeHeader(name) === normalized)
    )?.[0] || header
  );
};

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
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      worker: false,
      chunkSize: 512 * 1024,
      complete: async (results) => {
        const rawRows = (results.data as Record<string, any>[]).map((row) => {
          const normalizedRow: Record<string, any> = { ...row };
          Object.entries(row).forEach(([header, value]) => {
            const canonical = canonicalHeader(header);
            if (canonical !== header && normalizedRow[canonical] === undefined) normalizedRow[canonical] = value;
          });
          return normalizedRow;
        });

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
          const batchSize = 100;
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

    let importMetaForFailure: Record<string, unknown> | null = null;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: async (results) => {
        try {
          const rawRows = (results.data as Record<string, any>[]).map((row) => {
            const normalizedRow: Record<string, any> = { ...row };
            Object.entries(row).forEach(([header, value]) => {
              const canonical = canonicalHeader(header);
              if (canonical !== header && normalizedRow[canonical] === undefined) {
                normalizedRow[canonical] = value;
              }
              const upperClean = header.replace(/^\uFEFF/, "").trim().toUpperCase();
              if (normalizedRow[upperClean] === undefined) {
                normalizedRow[upperClean] = value;
              }
            });
            return normalizedRow;
          });

          if (rawRows.length === 0) {
            toast.error("O arquivo CSV de Metas está vazio.");
            return;
          }

          const fileHeaders = results.meta.fields || [];
          const availableHeaders = new Set(fileHeaders.map(normalizeHeader));
          const hasProtocol = aliases.PROTOCOLO.some((name) => availableHeaders.has(normalizeHeader(name)));
          const hasProtocolDate = [...aliases.DATA_APRESENTADO, "d1_protocolo"]
            .some((name) => availableHeaders.has(normalizeHeader(name)));

          if (!hasProtocol || !hasProtocolDate) {
            toast.error("CSV inválido. Colunas de PROTOCOLO e/ou DATA indisponíveis.");
            return;
          }

          const totalRows = rawRows.length;
          setMetasProgress({ current: 0, total: totalRows });
          const importKey = crypto.randomUUID();

          // Extraindo datas para o periodo
          const dates = rawRows
            .map((r: any) => r.DATA_APRESENTADO || r.D1_PROTOCOLO)
            .filter(Boolean)
            .sort();
          const periodStart = dates[0] || null;
          const periodEnd = dates[dates.length - 1] || null;

          const importMetaBase = {
            importKey,
            fileName: file.name,
            totalRows,
            importedBy: "Manual CSV (Metas)",
            periodStart,
            periodEnd,
          };
          importMetaForFailure = importMetaBase;

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
              throw new Error(errData.error || `Falha no lote ${batchNumber}/${totalBatches}`);
            }

            const result = await res.json().catch(() => ({ success: true, count: batch.length }));
            importedTotal += Number(result.count ?? batch.length);
            setMetasProgress({
              current: Math.min(start + batch.length, totalRows),
              total: totalRows,
            });
          }

          toast.success(`Importação de ${importedTotal.toLocaleString("pt-BR")} metas concluída!`);
          router.refresh();
        } catch (err: any) {
          console.error("Erro na importação de metas:", err);
          if (importMetaForFailure) {
            await fetch("/api/bi/metas/import", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "mark_failed",
                importMeta: importMetaForFailure,
              }),
            }).catch(() => null);
          }
          toast.error(`Erro ao salvar metas: ${err.message || "Erro desconhecido"}`);
        } finally {
          setIsImportingMetas(false);
        }
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV de Metas: ${error.message}`);
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
        <Button className="bg-[#00C950] hover:bg-[#00A844] text-white gap-2">
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

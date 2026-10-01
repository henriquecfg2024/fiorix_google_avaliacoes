"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Layers3,
  Loader2,
  Printer,
  RotateCcw,
  ShieldAlert,
  Target,
  Trash2,
  Upload,
  UploadCloud,
  Users,
} from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";

import {
  clearAllMetasData,
  clearAllProdutividadeData,
  clearAllTarefasData,
  clearAllRetornosData,
  clearAllImpressoesData,
} from "@/app/(dashboard)/bi/importacoes/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const aliases: Record<string, string[]> = {
  PROTOCOLO: [
    "protocolo",
    "numero_protocolo",
    "numero_do_protocolo",
    "numero",
    "cod_protocolo",
    "nr_protocolo",
    "n_protocolo",
    "protocolo_do_titulo",
    "numeroprenotacao",
    "numero_prenotacao",
  ],
  DATA_APRESENTADO: [
    "data_apresentado",
    "data_apresentacao",
    "data_entrada",
    "data_protocolo",
    "dt_protocolo",
    "DataDoTituloApresentado",
    "datarecepcao",
    "data_recepcao",
  ],
  DT_PREVISAO: [
    "dt_previsao",
    "dt_previsao_entrega",
    "data_previsao",
    "data_previsao_entrega",
    "DATA_PREVISTAFINAL",
    "data_previstafinal",
    "DtPrevisaoEntrega",
  ],
  DT_ENTREGA_REAL: [
    "dt_entrega_real",
    "dt_entrega",
    "data_entrega",
    "data_entrega_real",
    "DtRetirada",
    "D10_ENTREGA",
    "d10_entrega",
  ],
  STATUS: ["status", "situacao", "status_protocolo"],
  STATUS_META: ["status_meta", "statusmeta", "status_da_meta"],
  NATUREZA: [
    "natureza",
    "naturezatitulo",
    "natureza_titulo",
    "tipo_detalhado",
    "especie",
    "Natureza",
  ],
  TIPO: ["tipo", "tipo_prenotacao"],
  ID_NATUREZA: ["id_natureza", "idnatureza"],
  MAGNETICO: ["magnetico"],
  ATRASO_DIAS: ["atraso_dias", "dias_atraso", "atraso"],
  DIAS_ATRASO: ["dias_atraso", "atraso_dias", "atraso"],
  DIAS_CORRIDOS: ["dias_corridos", "diascorridos"],
};

const canonicalHeader = (header: string) => {
  const normalized = normalizeHeader(header);
  return (
    Object.entries(aliases).find(([, names]) =>
      names.some((name) => normalizeHeader(name) === normalized)
    )?.[0] || header
  );
};

const stripExcelSeparatorDirective = (chunk: string) =>
  chunk.replace(/^\uFEFF?sep\s*=\s*[^\r\n]+\r?\n/i, "");

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ModuleType =
  | "PRODUTIVIDADE"
  | "METAS"
  | "TAREFAS"
  | "RETORNOS"
  | "IMPRESSOES";

interface PreviewModalState {
  open: boolean;
  moduleType: ModuleType | null;
  moduleLabel: string;
  file: File | null;
  headers: string[];
  sampleRows: Record<string, any>[];
  totalEstimatedRows: number;
}

interface ClearModalState {
  open: boolean;
  moduleKey: string;
  moduleLabel: string;
  description: string;
  action: () => Promise<any>;
  isLoading: boolean;
}

export function ImportacoesActions() {
  const router = useRouter();

  // Progress states
  const [activeImportModule, setActiveImportModule] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Refs for hidden inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const metasInputRef = useRef<HTMLInputElement>(null);
  const tarefasInputRef = useRef<HTMLInputElement>(null);
  const retornosInputRef = useRef<HTMLInputElement>(null);
  const impressoesInputRef = useRef<HTMLInputElement>(null);

  // Advanced section collapse state
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Preview modal state
  const [previewModal, setPreviewModal] = useState<PreviewModalState>({
    open: false,
    moduleType: null,
    moduleLabel: "",
    file: null,
    headers: [],
    sampleRows: [],
    totalEstimatedRows: 0,
  });

  // Clear modal state
  const [clearModal, setClearModal] = useState<ClearModalState>({
    open: false,
    moduleKey: "",
    moduleLabel: "",
    description: "",
    action: async () => {},
    isLoading: false,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // File Selection & Preview Trigger
  // ─────────────────────────────────────────────────────────────────────────────
  const handleFileSelected = (
    e: React.ChangeEvent<HTMLInputElement>,
    moduleType: ModuleType,
    moduleLabel: string
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo no formato CSV (.csv).");
      return;
    }

    // Quick parse first 5 rows for modal preview
    Papa.parse(file, {
      header: true,
      preview: 5,
      skipEmptyLines: true,
      encoding: "UTF-8",
      beforeFirstChunk: stripExcelSeparatorDirective,
      transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const sampleRows = (results.data as Record<string, any>[]).slice(0, 3);
        const estimatedRows = Math.max(1, Math.round(file.size / 150));

        setPreviewModal({
          open: true,
          moduleType,
          moduleLabel,
          file,
          headers,
          sampleRows,
          totalEstimatedRows: estimatedRows,
        });
      },
      error: (err) => {
        toast.error(`Falha ao ler prévia do arquivo: ${err.message}`);
      },
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Upload Executors
  // ─────────────────────────────────────────────────────────────────────────────
  const executeImportProdutividade = async (file: File) => {
    setActiveImportModule("Produtividade");
    setImportProgress({ current: 0, total: 0 });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      beforeFirstChunk: stripExcelSeparatorDirective,
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      worker: false,
      chunkSize: 512 * 1024,
      complete: async (results) => {
        const rawRows = (results.data as Record<string, any>[]).map((row) => {
          const normalizedRow: Record<string, any> = { ...row };
          Object.entries(row).forEach(([header, value]) => {
            const canonical = canonicalHeader(header);
            if (canonical !== header && normalizedRow[canonical] === undefined)
              normalizedRow[canonical] = value;
          });
          return normalizedRow;
        });

        if (rawRows.length === 0) {
          toast.error("O arquivo CSV está vazio.");
          setActiveImportModule(null);
          return;
        }

        const dbRows = rawRows
          .map((row: any) => {
            const getVal = (col: string) => {
              if (row[col] !== undefined && row[col] !== null)
                return String(row[col]).trim();

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
          toast.error("Nenhum registro válido encontrado no CSV de Produtividade.");
          setActiveImportModule(null);
          return;
        }

        setImportProgress({ current: 0, total: totalRows });

        try {
          const importKey = crypto.randomUUID();
          const batchSize = 500;
          let importedTotal = 0;

          const dates = dbRows
            .map((r: any) => r.DATA)
            .filter(Boolean)
            .sort();
          const periodStart = dates[0] || null;
          const periodEnd = dates[dates.length - 1] || null;

          for (let i = 0; i < totalRows; i += batchSize) {
            const batch = dbRows.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(totalRows / batchSize);

            const res = await fetch("/api/bi/produtividade/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rows: batch,
                importMeta: {
                  importKey,
                  fileName: file.name,
                  totalRows,
                  importedBy: "Manual CSV (Contingência)",
                  periodStart,
                  periodEnd,
                  batchNumber,
                  totalBatches,
                },
              }),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({ error: "Erro desconhecido" }));
              throw new Error(errData.error || `Falha no lote ${batchNumber}/${totalBatches}`);
            }

            const data = await res.json().catch(() => ({ count: batch.length }));
            importedTotal += Number(data.count ?? batch.length);

            setImportProgress({
              current: Math.min(i + batch.length, totalRows),
              total: totalRows,
            });
          }

          toast.success(
            `Importação de ${importedTotal.toLocaleString("pt-BR")} registros concluída com sucesso!`
          );
          router.refresh();
        } catch (err: any) {
          toast.error(`Erro ao salvar no banco: ${err.message}`);
        } finally {
          setActiveImportModule(null);
        }
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV: ${error.message}`);
        setActiveImportModule(null);
      },
    });
  };

  const executeImportMetas = async (file: File) => {
    setActiveImportModule("Metas");
    setImportProgress({ current: 0, total: 0 });

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
            setActiveImportModule(null);
            return;
          }

          const totalRows = rawRows.length;
          setImportProgress({ current: 0, total: totalRows });
          const importKey = crypto.randomUUID();

          const dates = rawRows
            .map((r: any) => r.DATA_APRESENTADO || r.DT_PREVISAO)
            .filter(Boolean)
            .sort();
          const periodStart = dates[0] || null;
          const periodEnd = dates[dates.length - 1] || null;

          const importMetaBase = {
            importKey,
            fileName: file.name,
            totalRows,
            importedBy: "Manual CSV (Metas Contingência)",
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
              headers: { "Content-Type": "application/json" },
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
            setImportProgress({
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
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "mark_failed", importMeta: importMetaForFailure }),
            }).catch(() => null);
          }
          toast.error(`Erro ao salvar metas: ${err.message || "Erro desconhecido"}`);
        } finally {
          setActiveImportModule(null);
        }
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV de Metas: ${error.message}`);
        setActiveImportModule(null);
      },
    });
  };

  const executeImportTarefas = async (file: File) => {
    setActiveImportModule("Tarefas");
    setImportProgress({ current: 0, total: 0 });

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
            toast.error("O arquivo CSV de Tarefas está vazio.");
            setActiveImportModule(null);
            return;
          }

          const totalRows = rawRows.length;
          setImportProgress({ current: 0, total: totalRows });
          const importKey = crypto.randomUUID();

          const dates = rawRows
            .map((r: any) => r.DT_PREVISAO || r.DATA_ENTRADA)
            .filter(Boolean)
            .sort();
          const periodStart = dates[0] || null;
          const periodEnd = dates[dates.length - 1] || null;

          const importMetaBase = {
            importKey,
            fileName: file.name,
            totalRows,
            importedBy: "Manual CSV (Tarefas Contingência)",
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

            const res = await fetch("/api/bi/tarefas/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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
            setImportProgress({
              current: Math.min(start + batch.length, totalRows),
              total: totalRows,
            });
          }

          toast.success(`Importação de ${importedTotal.toLocaleString("pt-BR")} tarefas concluída!`);
          router.refresh();
        } catch (err: any) {
          console.error("Erro na importação de tarefas:", err);
          if (importMetaForFailure) {
            await fetch("/api/bi/tarefas/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "mark_failed", importMeta: importMetaForFailure }),
            }).catch(() => null);
          }
          toast.error(`Erro ao salvar tarefas: ${err.message || "Erro desconhecido"}`);
        } finally {
          setActiveImportModule(null);
        }
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV de Tarefas: ${error.message}`);
        setActiveImportModule(null);
      },
    });
  };

  const executeImportRetornos = async (file: File) => {
    setActiveImportModule("Retornos");
    setImportProgress({ current: 0, total: 0 });

    let importMetaForFailure: Record<string, unknown> | null = null;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: async (results) => {
        try {
          const rawRows = results.data as Record<string, any>[];
          if (rawRows.length === 0) {
            toast.error("O arquivo CSV de Retornos está vazio.");
            setActiveImportModule(null);
            return;
          }

          const totalRows = rawRows.length;
          setImportProgress({ current: 0, total: totalRows });
          const importKey = crypto.randomUUID();

          const dates = rawRows
            .map((r: any) => r.DataRetorno || r.data_retorno || r.DataRecepcao || r.data_recepcao)
            .filter(Boolean)
            .sort();
          const periodStart = dates[0] ? String(dates[0]).split("T")[0] : null;
          const periodEnd = dates[dates.length - 1] ? String(dates[dates.length - 1]).split("T")[0] : null;

          const importMetaBase = {
            importKey,
            fileName: file.name,
            totalRows,
            importedBy: "Manual CSV (Retornos Contingência)",
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

            const res = await fetch("/api/bi/retornos/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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
            setImportProgress({
              current: Math.min(start + batch.length, totalRows),
              total: totalRows,
            });
          }

          toast.success(`Importação de ${importedTotal.toLocaleString("pt-BR")} retornos concluída!`);
          router.refresh();
        } catch (err: any) {
          console.error("Erro na importação de retornos:", err);
          if (importMetaForFailure) {
            await fetch("/api/bi/retornos/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "mark_failed", importMeta: importMetaForFailure }),
            }).catch(() => null);
          }
          toast.error(`Erro ao salvar retornos: ${err.message || "Erro desconhecido"}`);
        } finally {
          setActiveImportModule(null);
        }
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV de Retornos: ${error.message}`);
        setActiveImportModule(null);
      },
    });
  };

  const executeImportImpressoes = async (file: File) => {
    setActiveImportModule("Impressões");
    setImportProgress({ current: 0, total: 0 });

    let importMetaForFailure: Record<string, unknown> | null = null;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete: async (results) => {
        try {
          const rawRows = results.data as Record<string, any>[];
          if (rawRows.length === 0) {
            toast.error("O arquivo CSV de Impressões está vazio.");
            setActiveImportModule(null);
            return;
          }

          const totalRows = rawRows.length;
          setImportProgress({ current: 0, total: totalRows });
          const importKey = crypto.randomUUID();

          const dates = rawRows
            .map((r: any) => r.DataImpressao || r.data_impressao || r.DataEntrada || r.data_entrada)
            .filter(Boolean)
            .sort();
          const periodStart = dates[0] ? String(dates[0]).split("T")[0] : null;
          const periodEnd = dates[dates.length - 1] ? String(dates[dates.length - 1]).split("T")[0] : null;

          const importMetaBase = {
            importKey,
            fileName: file.name,
            totalRows,
            importedBy: "Manual CSV (Impressões Contingência)",
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

            const res = await fetch("/api/bi/impressoes/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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
            setImportProgress({
              current: Math.min(start + batch.length, totalRows),
              total: totalRows,
            });
          }

          toast.success(`Importação de ${importedTotal.toLocaleString("pt-BR")} impressões concluída!`);
          router.refresh();
        } catch (err: any) {
          console.error("Erro na importação de impressões:", err);
          if (importMetaForFailure) {
            await fetch("/api/bi/impressoes/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "mark_failed", importMeta: importMetaForFailure }),
            }).catch(() => null);
          }
          toast.error(`Erro ao salvar impressões: ${err.message || "Erro desconhecido"}`);
        } finally {
          setActiveImportModule(null);
        }
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV de Impressões: ${error.message}`);
        setActiveImportModule(null);
      },
    });
  };

  const handleConfirmPreview = async () => {
    const { moduleType, file } = previewModal;
    setPreviewModal((prev) => ({ ...prev, open: false }));
    if (!moduleType || !file) return;

    if (moduleType === "PRODUTIVIDADE") {
      await executeImportProdutividade(file);
    } else if (moduleType === "METAS") {
      await executeImportMetas(file);
    } else if (moduleType === "TAREFAS") {
      await executeImportTarefas(file);
    } else if (moduleType === "RETORNOS") {
      await executeImportRetornos(file);
    } else if (moduleType === "IMPRESSOES") {
      await executeImportImpressoes(file);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Clear Actions
  // ─────────────────────────────────────────────────────────────────────────────
  const openClearDialog = (
    moduleKey: string,
    moduleLabel: string,
    description: string,
    action: () => Promise<any>
  ) => {
    setClearModal({
      open: true,
      moduleKey,
      moduleLabel,
      description,
      action,
      isLoading: false,
    });
  };

  const handleConfirmClear = async () => {
    setClearModal((prev) => ({ ...prev, isLoading: true }));
    try {
      const res = await clearModal.action();
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Base de ${clearModal.moduleLabel} limpa com sucesso.`);
        router.refresh();
      }
    } catch (err: any) {
      toast.error(`Erro ao limpar base: ${err.message}`);
    } finally {
      setClearModal((prev) => ({ ...prev, isLoading: false, open: false }));
    }
  };

  const isAnyImporting = Boolean(activeImportModule);

  return (
    <div className="w-full space-y-4">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileSelected(e, "PRODUTIVIDADE", "Produtividade")}
        accept=".csv"
        className="hidden"
      />
      <input
        type="file"
        ref={metasInputRef}
        onChange={(e) => handleFileSelected(e, "METAS", "Metas")}
        accept=".csv"
        className="hidden"
      />
      <input
        type="file"
        ref={tarefasInputRef}
        onChange={(e) => handleFileSelected(e, "TAREFAS", "Tarefas")}
        accept=".csv"
        className="hidden"
      />
      <input
        type="file"
        ref={retornosInputRef}
        onChange={(e) => handleFileSelected(e, "RETORNOS", "Retornos")}
        accept=".csv"
        className="hidden"
      />
      <input
        type="file"
        ref={impressoesInputRef}
        onChange={(e) => handleFileSelected(e, "IMPRESSOES", "Impressões")}
        accept=".csv"
        className="hidden"
      />

      {/* Progress Bar (Active when uploading) */}
      {isAnyImporting && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              Processando envio de contingência ({activeImportModule})...
            </span>
            <span>
              {importProgress.current.toLocaleString("pt-BR")} /{" "}
              {importProgress.total.toLocaleString("pt-BR")} linhas (
              {Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%)
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-emerald-950/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((importProgress.current / (importProgress.total || 1)) * 100)
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Bloco 1: Enviar arquivo de contingência */}
      <div className="rounded-[28px] border border-white/20 bg-[#0B1020]/90 p-5 shadow-sm backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/8 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-emerald-400" />
              Enviar arquivo de contingência
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/55 mt-0.5">
              Selecione o módulo para upload manual somente quando o FIORIX Connector estiver
              indisponível.
            </p>
          </div>
          <Badge className="self-start sm:self-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
            CARGA MANUAL DE CONTINGÊNCIA
          </Badge>
        </div>

        {/* 6 Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Link href="/bi/importar" className="w-full">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-white/10 bg-white/[0.04] text-xs font-medium text-slate-800 dark:text-white hover:bg-white/[0.08] hover:border-cyan-500/40"
            >
              <UploadCloud className="h-4 w-4 text-cyan-400 shrink-0" />
              <span className="truncate">Módulo BI</span>
            </Button>
          </Link>

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnyImporting}
            variant="outline"
            className="w-full justify-start gap-2 border-white/10 bg-white/[0.04] text-xs font-medium text-slate-800 dark:text-white hover:bg-white/[0.08] hover:border-emerald-500/40"
          >
            <Users className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="truncate">Produtividade</span>
          </Button>

          <Button
            onClick={() => metasInputRef.current?.click()}
            disabled={isAnyImporting}
            variant="outline"
            className="w-full justify-start gap-2 border-white/10 bg-white/[0.04] text-xs font-medium text-slate-800 dark:text-white hover:bg-white/[0.08] hover:border-violet-500/40"
          >
            <Target className="h-4 w-4 text-violet-400 shrink-0" />
            <span className="truncate">Metas</span>
          </Button>

          <Button
            onClick={() => tarefasInputRef.current?.click()}
            disabled={isAnyImporting}
            variant="outline"
            className="w-full justify-start gap-2 border-white/10 bg-white/[0.04] text-xs font-medium text-slate-800 dark:text-white hover:bg-white/[0.08] hover:border-purple-500/40"
          >
            <Layers3 className="h-4 w-4 text-purple-400 shrink-0" />
            <span className="truncate">Tarefas</span>
          </Button>

          <Button
            onClick={() => retornosInputRef.current?.click()}
            disabled={isAnyImporting}
            variant="outline"
            className="w-full justify-start gap-2 border-white/10 bg-white/[0.04] text-xs font-medium text-slate-800 dark:text-white hover:bg-white/[0.08] hover:border-blue-500/40"
          >
            <RotateCcw className="h-4 w-4 text-blue-400 shrink-0" />
            <span className="truncate">Retornos</span>
          </Button>

          <Button
            onClick={() => impressoesInputRef.current?.click()}
            disabled={isAnyImporting}
            variant="outline"
            className="w-full justify-start gap-2 border-white/10 bg-white/[0.04] text-xs font-medium text-slate-800 dark:text-white hover:bg-white/[0.08] hover:border-amber-500/40"
          >
            <Printer className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="truncate">Impressões</span>
          </Button>
        </div>
      </div>

      {/* Bloco 2: Ações avançadas (Área de Limpeza Destrutiva) */}
      <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-4 shadow-sm backdrop-blur-xl transition-all">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex w-full items-center justify-between text-left cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 text-red-400" />
            <div>
              <div className="text-xs font-semibold text-red-200">
                Ações avançadas de contingência
              </div>
              <div className="text-[11px] text-red-300/70">
                Operações destrutivas de redefinição de registros da serventia (Requer perfil Administrador).
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-red-300">
            <span>{showAdvanced ? "Ocultar" : "Exibir ações"}</span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </button>

        {showAdvanced && (
          <div className="mt-4 pt-3 border-t border-red-500/20 space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <span>
                <strong>Atenção:</strong> A limpeza apaga todos os registros do módulo correspondente
                deste cartório. Todas as exclusões são auditadas com data, hora e usuário responsável.
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openClearDialog(
                    "PRODUTIVIDADE",
                    "Produtividade",
                    "Todos os registros de recepção e produtividade serão permanentemente excluídos.",
                    clearAllProdutividadeData
                  )
                }
                className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 text-xs gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar Produtividade
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openClearDialog(
                    "METAS",
                    "Metas",
                    "Todos os registros de metas e gargalos operacionais serão permanentemente excluídos.",
                    clearAllMetasData
                  )
                }
                className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 text-xs gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar Metas
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openClearDialog(
                    "TAREFAS",
                    "Tarefas",
                    "Todos os registros de tarefas operacionais e previsão de carga serão permanentemente excluídos.",
                    clearAllTarefasData
                  )
                }
                className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 text-xs gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar Tarefas
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openClearDialog(
                    "RETORNOS",
                    "Retornos",
                    "Todos os registros de retornos e notas devolutivas serão permanentemente excluídos.",
                    clearAllRetornosData
                  )
                }
                className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 text-xs gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar Retornos
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  openClearDialog(
                    "IMPRESSOES",
                    "Impressões",
                    "Todos os registros de impressões de livros e certidões serão permanentemente excluídos.",
                    clearAllImpressoesData
                  )
                }
                className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 text-xs gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpar Impressões
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal de Confirmação & Pré-visualização antes do Envio
      ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={previewModal.open}
        onOpenChange={(open) =>
          !open && setPreviewModal((prev) => ({ ...prev, open: false }))
        }
      >
        <DialogContent className="max-w-xl border-white/20 bg-[#0B1020] text-white p-6 rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              Confirmar envio de contingência — {previewModal.moduleLabel}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Revise as informações do arquivo CSV antes de confirmar a gravação.
            </DialogDescription>
          </DialogHeader>

          {previewModal.file && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div>
                  <span className="text-white/45">Arquivo:</span>
                  <div className="font-semibold text-white break-all">
                    {previewModal.file.name}
                  </div>
                </div>
                <div>
                  <span className="text-white/45">Tamanho:</span>
                  <div className="font-semibold text-white">
                    {formatFileSize(previewModal.file.size)}
                  </div>
                </div>
                <div>
                  <span className="text-white/45">Módulo de Destino:</span>
                  <div>
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-semibold">
                      {previewModal.moduleLabel}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-white/45">Colunas Detectadas:</span>
                  <div className="font-semibold text-white">
                    {previewModal.headers.length} colunas no cabeçalho
                  </div>
                </div>
              </div>

              {/* Colunas detectadas */}
              {previewModal.headers.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                    Colunas do Cabeçalho:
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-2">
                    {previewModal.headers.map((h) => (
                      <span
                        key={h}
                        className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/80 font-mono"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Amostra das primeiras linhas */}
              {previewModal.sampleRows.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                    Amostra das Primeiras Linhas (Preview):
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/[0.02] p-2">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-white/10 text-white/50">
                          {previewModal.headers.slice(0, 5).map((col) => (
                            <th key={col} className="p-1 font-medium">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewModal.sampleRows.map((r, i) => (
                          <tr key={i} className="border-b border-white/5 text-white/80">
                            {previewModal.headers.slice(0, 5).map((col) => (
                              <td key={col} className="p-1 truncate max-w-[120px]">
                                {String(r[col] ?? "-")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                <strong>Importante:</strong> Esta ação gravará os registros de contingência no banco
                de dados do FIORIX e atualizará os indicadores.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewModal((prev) => ({ ...prev, open: false }))}
              className="border-white/20 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmPreview}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirmar Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────────────────────
          Modal de Confirmação para Ações Destrutivas (Limpeza)
      ───────────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={clearModal.open}
        onOpenChange={(open) =>
          !open && !clearModal.isLoading && setClearModal((prev) => ({ ...prev, open: false }))
        }
      >
        <DialogContent className="max-w-md border-red-500/30 bg-[#0B1020] text-white p-6 rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-400">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Exclusão Permanente — {clearModal.moduleLabel}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Esta é uma ação destrutiva irreversível e será auditada pelo sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-white/80">{clearModal.description}</p>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-[11px]">
              <strong>Atenção:</strong> Os dados apagados não poderão ser recuperados a menos que
              uma nova importação de contingência ou sincronização incremental seja executada.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={clearModal.isLoading}
              onClick={() => setClearModal((prev) => ({ ...prev, open: false }))}
              className="border-white/20 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={clearModal.isLoading}
              onClick={handleConfirmClear}
              className="gap-2 bg-red-600 text-white hover:bg-red-500"
            >
              {clearModal.isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Excluindo dados...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Confirmar Exclusão
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Upload, UploadCloud } from "lucide-react";
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
  DT_PREVISAO: ["dt_previsao", "dt_previsao_entrega", "data_previsao", "data_previsao_entrega", "DATA_PREVISTAFINAL", "data_previstafinal", "DtPrevisaoEntrega"],
  DT_ENTREGA_REAL: ["dt_entrega_real", "dt_entrega", "data_entrega", "data_entrega_real", "DtRetirada", "D10_ENTREGA", "d10_entrega"],
  STATUS: ["status", "situacao", "status_protocolo"],
  STATUS_META: ["status_meta", "statusmeta", "status_da_meta"],
  NATUREZA: ["natureza", "naturezatitulo", "natureza_titulo", "tipo_detalhado", "especie", "Natureza"],
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

export function ImportacoesActions() {
  const router = useRouter();

  // Produtividade
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [isClearingProd, setIsClearingProd] = useState(false);

  // Metas
  const metasInputRef = useRef<HTMLInputElement>(null);
  const [isImportingMetas, setIsImportingMetas] = useState(false);
  const [metasProgress, setMetasProgress] = useState({ current: 0, total: 0 });
  const [isClearingMetas, setIsClearingMetas] = useState(false);

  // Tarefas
  const tarefasInputRef = useRef<HTMLInputElement>(null);
  const [isImportingTarefas, setIsImportingTarefas] = useState(false);
  const [tarefasProgress, setTarefasProgress] = useState({ current: 0, total: 0 });
  const [isClearingTarefas, setIsClearingTarefas] = useState(false);

  // Retornos
  const retornosInputRef = useRef<HTMLInputElement>(null);
  const [isImportingRetornos, setIsImportingRetornos] = useState(false);
  const [retornosProgress, setRetornosProgress] = useState({ current: 0, total: 0 });
  const [isClearingRetornos, setIsClearingRetornos] = useState(false);

  // Impressões
  const impressoesInputRef = useRef<HTMLInputElement>(null);
  const [isImportingImpressoes, setIsImportingImpressoes] = useState(false);
  const [impressoesProgress, setImpressoesProgress] = useState({ current: 0, total: 0 });
  const [isClearingImpressoes, setIsClearingImpressoes] = useState(false);

  // 1. Produtividade
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
      beforeFirstChunk: stripExcelSeparatorDirective,
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
                  importedBy: "Manual CSV",
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

          toast.success(`Importação de ${importedTotal.toLocaleString("pt-BR")} registros concluída!`);
          router.refresh();
        } catch (err: any) {
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

  const handleClearProdutividade = async () => {
    if (!confirm("Tem certeza que deseja apagar TODO o histórico de produtividade? Essa ação não pode ser desfeita.")) {
      return;
    }
    setIsClearingProd(true);
    try {
      const res = await clearAllProdutividadeData();
      if (res.error) toast.error(res.error);
      else {
        toast.success("Base de Produtividade limpa com sucesso.");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(`Erro ao limpar produtividade: ${err.message}`);
    } finally {
      setIsClearingProd(false);
    }
  };

  // 2. Metas
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

          const totalRows = rawRows.length;
          setMetasProgress({ current: 0, total: totalRows });
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
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "mark_failed", importMeta: importMetaForFailure }),
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

  const handleClearMetas = async () => {
    if (!confirm("Tem certeza que deseja apagar TODO o histórico de metas? Essa ação não pode ser desfeita.")) {
      return;
    }
    setIsClearingMetas(true);
    try {
      const res = await clearAllMetasData();
      if (res.error) toast.error(res.error);
      else {
        toast.success("Base de Metas limpa com sucesso.");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(`Erro ao limpar metas: ${err.message}`);
    } finally {
      setIsClearingMetas(false);
    }
  };

  // 3. Tarefas
  const handleImportTarefas = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV válido para Tarefas.");
      return;
    }

    setIsImportingTarefas(true);
    setTarefasProgress({ current: 0, total: 0 });

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
            return;
          }

          const totalRows = rawRows.length;
          setTarefasProgress({ current: 0, total: totalRows });
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
            importedBy: "Manual CSV (Tarefas)",
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
            setTarefasProgress({
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
          setIsImportingTarefas(false);
        }
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV de Tarefas: ${error.message}`);
        setIsImportingTarefas(false);
      },
    });
  };

  const handleClearTarefas = async () => {
    if (!confirm("Tem certeza que deseja apagar TODO o histórico de tarefas? Essa ação não pode ser desfeita.")) {
      return;
    }
    setIsClearingTarefas(true);
    try {
      const res = await clearAllTarefasData();
      if (res.error) toast.error(res.error);
      else {
        toast.success("Base de Tarefas limpa com sucesso.");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(`Erro ao limpar tarefas: ${err.message}`);
    } finally {
      setIsClearingTarefas(false);
    }
  };

  // 4. Retornos (dbo.pr_Fiorix_BI_Retornos)
  const handleImportRetornos = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV válido para Retornos.");
      return;
    }

    setIsImportingRetornos(true);
    setRetornosProgress({ current: 0, total: 0 });

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
            return;
          }

          const totalRows = rawRows.length;
          setRetornosProgress({ current: 0, total: totalRows });
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
            importedBy: "Manual CSV (Retornos)",
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
            setRetornosProgress({
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
          setIsImportingRetornos(false);
        }
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV de Retornos: ${error.message}`);
        setIsImportingRetornos(false);
      },
    });
  };

  const handleClearRetornos = async () => {
    if (!confirm("Tem certeza que deseja apagar TODO o histórico de retornos? Essa ação não pode ser desfeita.")) {
      return;
    }
    setIsClearingRetornos(true);
    try {
      const res = await clearAllRetornosData();
      if (res.error) toast.error(res.error);
      else {
        toast.success("Base de Retornos limpa com sucesso.");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(`Erro ao limpar retornos: ${err.message}`);
    } finally {
      setIsClearingRetornos(false);
    }
  };

  // 5. Impressões (dbo.pr_Fiorix_BI_Impressoes)
  const handleImportImpressoes = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, selecione um arquivo CSV válido para Impressões.");
      return;
    }

    setIsImportingImpressoes(true);
    setImpressoesProgress({ current: 0, total: 0 });

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
            return;
          }

          const totalRows = rawRows.length;
          setImpressoesProgress({ current: 0, total: totalRows });
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
            importedBy: "Manual CSV (Impressões)",
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
            setImpressoesProgress({
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
          setIsImportingImpressoes(false);
        }
      },
      error: (error) => {
        toast.error(`Erro ao ler CSV de Impressões: ${error.message}`);
        setIsImportingImpressoes(false);
      },
    });
  };

  const handleClearImpressoes = async () => {
    if (!confirm("Tem certeza que deseja apagar TODO o histórico de impressões? Essa ação não pode ser desfeita.")) {
      return;
    }
    setIsClearingImpressoes(true);
    try {
      const res = await clearAllImpressoesData();
      if (res.error) toast.error(res.error);
      else {
        toast.success("Base de Impressões limpa com sucesso.");
        router.refresh();
      }
    } catch (err: any) {
      toast.error(`Erro ao limpar impressões: ${err.message}`);
    } finally {
      setIsClearingImpressoes(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Inputs Ocultos */}
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

      <input
        type="file"
        ref={tarefasInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportTarefas(file);
          e.currentTarget.value = "";
        }}
        accept=".csv"
        className="hidden"
      />

      <input
        type="file"
        ref={retornosInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportRetornos(file);
          e.currentTarget.value = "";
        }}
        accept=".csv"
        className="hidden"
      />

      <input
        type="file"
        ref={impressoesInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportImpressoes(file);
          e.currentTarget.value = "";
        }}
        accept=".csv"
        className="hidden"
      />

      {/* Botões de Importação (Verdes) */}
      <Link href="/bi/importar">
        <Button className="bg-[#00C950] hover:bg-[#00A844] text-white gap-2 font-medium">
          <UploadCloud className="h-4 w-4" />
          Importar Módulo BI
        </Button>
      </Link>

      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        className="bg-[#00C950] hover:bg-[#00A844] text-white gap-2 font-medium"
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

      <Button
        onClick={() => metasInputRef.current?.click()}
        disabled={isImportingMetas}
        className="bg-[#00C950] hover:bg-[#00A844] text-white gap-2 font-medium"
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

      <Button
        onClick={() => tarefasInputRef.current?.click()}
        disabled={isImportingTarefas}
        className="bg-[#00C950] hover:bg-[#00A844] text-white gap-2 font-medium"
      >
        {isImportingTarefas ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Importando Tarefas ({Math.round((tarefasProgress.current / (tarefasProgress.total || 1)) * 100)}%)
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Importar Tarefas
          </>
        )}
      </Button>

      <Button
        onClick={() => retornosInputRef.current?.click()}
        disabled={isImportingRetornos}
        className="bg-[#00C950] hover:bg-[#00A844] text-white gap-2 font-medium"
      >
        {isImportingRetornos ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Importando Retornos ({Math.round((retornosProgress.current / (retornosProgress.total || 1)) * 100)}%)
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Importar Retornos
          </>
        )}
      </Button>

      <Button
        onClick={() => impressoesInputRef.current?.click()}
        disabled={isImportingImpressoes}
        className="bg-[#00C950] hover:bg-[#00A844] text-white gap-2 font-medium"
      >
        {isImportingImpressoes ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Importando Impressões ({Math.round((impressoesProgress.current / (impressoesProgress.total || 1)) * 100)}%)
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Importar Impressões
          </>
        )}
      </Button>

      {/* Botões de Limpeza (Red Outline) */}
      <Button
        variant="outline"
        onClick={handleClearProdutividade}
        disabled={isClearingProd}
        className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 gap-2"
        title="Apagar todo o histórico de produtividade da base"
      >
        {isClearingProd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Limpar Produtividade
      </Button>

      <Button
        variant="outline"
        onClick={handleClearMetas}
        disabled={isClearingMetas}
        className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 gap-2"
        title="Apagar todo o histórico de metas da base"
      >
        {isClearingMetas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Limpar Metas
      </Button>

      <Button
        variant="outline"
        onClick={handleClearTarefas}
        disabled={isClearingTarefas}
        className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 gap-2"
        title="Apagar todo o histórico de tarefas da base"
      >
        {isClearingTarefas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Limpar Tarefas
      </Button>

      <Button
        variant="outline"
        onClick={handleClearRetornos}
        disabled={isClearingRetornos}
        className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 gap-2"
        title="Apagar todo o histórico de retornos da base"
      >
        {isClearingRetornos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Limpar Retornos
      </Button>

      <Button
        variant="outline"
        onClick={handleClearImpressoes}
        disabled={isClearingImpressoes}
        className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 gap-2"
        title="Apagar todo o histórico de impressões da base"
      >
        {isClearingImpressoes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Limpar Impressões
      </Button>
    </div>
  );
}

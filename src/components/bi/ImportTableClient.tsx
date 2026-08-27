"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteImportButton } from "@/components/bi/DeleteImportButton";
import type { UnifiedImportRecord } from "@/lib/import-history";

function formatMonthLabel(start: string | null, end: string | null) {
  if (!start) return null;

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;

  const monthLabel = startDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  if (!end) return monthLabel;

  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return null;

  const sameMonth =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth();

  if (sameMonth) return monthLabel;

  const endMonthLabel = endDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return `${monthLabel} a ${endMonthLabel}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start && !end) return "-";
  if (start && end) {
    return `${new Date(start).toLocaleDateString("pt-BR")} até ${new Date(end).toLocaleDateString("pt-BR")}`;
  }
  return start || end || "-";
}

function statusBadge(record: UnifiedImportRecord) {
  if (record.status === "FAILED" || record.status === "Falhou") {
    return (
      <Badge className="bg-red-500/10 text-red-300 border border-red-500/20 font-semibold">
        Falhou
      </Badge>
    );
  }

  if (record.status === "PROCESSING" || record.status === "Processando" || record.status === "Processando...") {
    return (
      <Badge className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">
        Processando
      </Badge>
    );
  }

  if (record.status === "INFERRED" || record.origin === "inferred") {
    return (
      <Badge className="bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
        Inferido
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
      Concluído
    </Badge>
  );
}

function sourceBadge(source: UnifiedImportRecord["source"]) {
  if (source === "BI") {
    return <Badge className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-semibold">Módulo BI</Badge>;
  } else if (source === "METAS") {
    return <Badge className="bg-violet-500/10 text-violet-300 border border-violet-500/20 font-semibold">Metas</Badge>;
  }
  return <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">Produtividade</Badge>;
}

function displayReference(row: UnifiedImportRecord) {
  if (row.origin !== "inferred") return row.fileName;

  const monthLabel = formatMonthLabel(row.periodStart, row.periodEnd);
  if (!monthLabel) return row.fileName;

  return `Produtividade ${monthLabel}`;
}

interface ImportTableClientProps {
  rows: UnifiedImportRecord[];
  showSearch?: boolean;
}

export function ImportTableClient({ rows, showSearch = false }: ImportTableClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const processedRows = useMemo(() => {
    if (!searchTerm) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter((r) => {
      const fileName = String(r.fileName || "").toLowerCase();
      const ref = String(displayReference(r)).toLowerCase();
      const source = String(r.source || "").toLowerCase();
      const importedBy = String(r.importedBy || "").toLowerCase();
      return fileName.includes(term) || ref.includes(term) || source.includes(term) || importedBy.includes(term);
    });
  }, [rows, searchTerm]);

  const totalItems = processedRows.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(totalItems, currentPage * pageSize);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, currentPage, pageSize]);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0B1020]/72 text-white shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
      {showSearch && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 bg-white/[0.01] p-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
            <Input
              placeholder="Buscar por arquivo ou origem..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 rounded-lg border border-white/8 bg-white/[0.04] text-xs text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none focus:ring-0"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="select-none bg-[#0B1020] text-xs uppercase tracking-wider text-white/58 border-b border-white/8">
            <tr>
              <th className="px-4 py-3.5 font-semibold">Origem</th>
              <th className="px-4 py-3.5 font-semibold">Arquivo / Referência</th>
              <th className="px-4 py-3.5 font-semibold">Período</th>
              <th className="px-4 py-3.5 font-semibold">Data/Hora</th>
              <th className="px-4 py-3.5 font-semibold">Linhas</th>
              <th className="px-4 py-3.5 font-semibold">Inseridas</th>
              <th className="px-4 py-3.5 font-semibold">Importado por</th>
              <th className="px-4 py-3.5 font-semibold">Status</th>
              <th className="px-4 py-3.5 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-transparent">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-xs text-white/30">
                  Nenhuma importação encontrada.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => {
                const isMetasCompleted =
                  row.source === "METAS" &&
                  (row.status === "Concluído" || row.status === "SUCCESS" || row.status === "COMPLETED");
                return (
                  <tr key={`${row.source}-${row.id}`} className="transition hover:bg-white/[0.03] text-white/80 align-top">
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        {sourceBadge(row.source)}
                        {row.origin === "inferred" && (
                          <div className="text-[10px] text-white/45">Histórico inferido pela base</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white">
                      <div className="font-semibold break-all">{displayReference(row)}</div>
                      {row.origin === "inferred" && (
                        <div className="mt-0.5 text-xs text-white/45 break-all">{row.fileName}</div>
                      )}
                      {row.errorMessage && (
                        <div className="mt-0.5 text-xs text-red-300">{row.errorMessage}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70">{formatPeriod(row.periodStart, row.periodEnd)}</td>
                    <td className="px-4 py-3 text-white/70">{formatDateTime(row.importedAt)}</td>
                    <td className={`px-4 py-3 font-semibold ${isMetasCompleted ? "text-emerald-300" : "text-white"}`}>
                      {Number(row.rowsCount || 0).toLocaleString("pt-BR")}
                    </td>
                    <td className={`px-4 py-3 font-semibold ${isMetasCompleted ? "text-emerald-300" : "text-emerald-400"}`}>
                      {row.insertedCount !== null ? Number(row.insertedCount || 0).toLocaleString("pt-BR") : "-"}
                    </td>
                    <td className="px-4 py-3 text-white/65">{row.importedBy || "-"}</td>
                    <td className="px-4 py-3">{statusBadge(row)}</td>
                    <td className="px-4 py-3 text-right">
                      <DeleteImportButton id={row.id} source={row.source as UnifiedImportRecord["source"]} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Unified Pagination Footer */}
      <div className="flex flex-col items-center justify-between gap-4 border-t border-white/8 bg-white/[0.03] px-6 py-3.5 sm:flex-row">
        <div className="text-xs text-white/60 text-center sm:text-left">
          Exibindo <strong className="text-white">{totalItems > 0 ? startIndex.toLocaleString("pt-BR") : "0"}</strong> a{" "}
          <strong className="text-white">{endIndex.toLocaleString("pt-BR")}</strong> de{" "}
          <strong className="text-white">{totalItems.toLocaleString("pt-BR")}</strong> registros
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <span>Exibir:</span>
            <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
              {[10, 20, 50, 100].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                    pageSize === size
                      ? "bg-gradient-to-r from-indigo-500 to-amber-400 font-semibold text-white shadow-xs"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              title="Primeira Página"
            >
              <ChevronsLeft size={15} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              title="Página Anterior"
            >
              <ChevronLeft size={15} />
            </Button>

            <span className="text-xs px-2 font-medium text-white min-w-[90px] text-center">
              Página {currentPage.toLocaleString("pt-BR")} de {totalPages.toLocaleString("pt-BR")}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              title="Próxima Página"
            >
              <ChevronRight size={15} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Última Página"
            >
              <ChevronsRight size={15} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DataTablePremiumProps {
  data: Array<Record<string, unknown>>;
}

export function DataTablePremium({ data }: DataTablePremiumProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("DATA");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Filter & Sort
  const processedData = useMemo(() => {
    let result = [...data];

    // Search filter (on PEDIDO or NOME)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          String(item.PEDIDO).toLowerCase().includes(term) ||
          String(item.NOME).toLowerCase().includes(term) ||
          String(item.TIPO_PEDIDO).toLowerCase().includes(term) ||
          String(item.TIPO_DETALHADO).toLowerCase().includes(term)
      );
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Convert date/numbers for proper comparison
      if (sortField === "DATA") {
        aVal = new Date(`${a.DATA}T${a.HORA || "00:00"}`).getTime();
        bVal = new Date(`${b.DATA}T${b.HORA || "00:00"}`).getTime();
      } else if (sortField === "PEDIDO" || sortField === "HORA_NUM") {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal || "").toLowerCase();
        bVal = String(bVal || "").toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalItems = processedData.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(totalItems, currentPage * pageSize);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  const sanitizeCsvField = (value: string | null | undefined): string => {
    if (!value) return '';
    const str = String(value);
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str.replace(/"/g, '""').replace(/\n/g, ' ')}`;
    }
    return str.replace(/"/g, '""').replace(/\n/g, ' ');
  };

  const exportToCSV = () => {
    if (processedData.length === 0) return;
    
    const headers = ["DATA", "HORA", "DIA_SEMANA", "PEDIDO", "NOME", "TIPO", "TIPO_PEDIDO", "TIPO_DETALHADO", "QUANTIDADE"];
    const csvRows = [
      headers.join(";"),
      ...processedData.map((row) =>
        [
          row.DATA,
          row.HORA,
          row.DIA_SEMANA,
          row.PEDIDO,
          `"${sanitizeCsvField(String(row.NOME))}"`,
          row.TIPO,
          `"${sanitizeCsvField(String(row.TIPO_PEDIDO))}"`,
          `"${sanitizeCsvField(String(row.TIPO_DETALHADO))}"`,
          row.QUANTIDADE,
        ].join(";")
      ),
    ];

    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `produtividade_filtrada_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTipoPedidoBadgeStyle = (tipo: string) => {
    switch (tipo) {
      case "PRENOTADO":
        return "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";
      case "Consulta Eletrônica (CE)":
        return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
      case "Consulta Eletrônica (VM)":
        return "bg-violet-500/10 text-violet-300 border-violet-500/20";
      default:
        return "bg-amber-500/10 text-amber-300 border-amber-500/20";
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0B1020]/72 text-white shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
      {/* Controls Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 bg-white/[0.01] p-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
          <Input
            placeholder="Buscar por Pedido ou Nome..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 rounded-lg border border-white/8 bg-white/[0.04] text-xs text-white placeholder:text-white/40 focus:border-amber-400 focus:outline-none focus:ring-0"
          />
        </div>

        <Button
          onClick={exportToCSV}
          className="w-full sm:w-auto rounded-lg border border-white/8 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/[0.08] gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar Filtros ({processedData.length.toLocaleString("pt-BR")})
        </Button>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="select-none bg-[#0B1020] text-xs uppercase tracking-wider text-white/58 border-b border-white/8">
            <tr>
              <th onClick={() => handleSort("DATA")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white transition-colors">
                Data {sortField === "DATA" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("HORA")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white transition-colors">
                Hora {sortField === "HORA" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("DIA_SEMANA")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white transition-colors">
                Dia Semana {sortField === "DIA_SEMANA" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("PEDIDO")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white transition-colors">
                Pedido {sortField === "PEDIDO" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("NOME")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white transition-colors">
                Nome {sortField === "NOME" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("TIPO")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white transition-colors">
                Tipo {sortField === "TIPO" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("TIPO_PEDIDO")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white transition-colors">
                Tipo Pedido {sortField === "TIPO_PEDIDO" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("TIPO_DETALHADO")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white transition-colors">
                Detalhado {sortField === "TIPO_DETALHADO" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-transparent">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => (
                <tr key={idx} className="transition-colors hover:bg-white/[0.03] text-white/80">
                  <td className="px-4 py-3 font-medium text-white">{String(row.DATA || "-")}</td>
                  <td className="px-4 py-3 font-mono text-white/70">{String(row.HORA || "-")}</td>
                  <td className="px-4 py-3 text-white/70">{String(row.DIA_SEMANA || "-")}</td>
                  <td className="px-4 py-3 font-bold text-cyan-300">
                    <a href={`/bi/pedidos/${row.PEDIDO}`} className="hover:underline">
                      {String(row.PEDIDO || "-")}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{String(row.NOME || "-")}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={row.TIPO === "TÍTULO" ? "border-emerald-500/20 text-emerald-300 bg-emerald-500/10 font-semibold" : "border-cyan-500/20 text-cyan-300 bg-cyan-500/10 font-semibold"}>
                      {String(row.TIPO || "-")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`font-semibold ${getTipoPedidoBadgeStyle(String(row.TIPO_PEDIDO || ""))}`}>
                      {String(row.TIPO_PEDIDO || "-")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">{String(row.TIPO_DETALHADO || "-")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-white/40">
                  Nenhum registro encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Unified Pagination Footer */}
      <div className="flex flex-col items-center justify-between gap-4 border-t border-white/8 bg-white/[0.03] px-6 py-3.5 sm:flex-row">
        {/* Interval text */}
        <div className="text-xs text-white/60 text-center sm:text-left">
          Exibindo <strong className="text-white">{startIndex.toLocaleString("pt-BR")}</strong> a{" "}
          <strong className="text-white">{endIndex.toLocaleString("pt-BR")}</strong> de{" "}
          <strong className="text-white">{totalItems.toLocaleString("pt-BR")}</strong> registros
        </div>

        {/* Page Controls & Size Selector */}
        <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <span>Exibir:</span>
            <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
              {[10, 20, 50, 100].map((size) => (
                <button
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
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
              onClick={() => setCurrentPage((p) => p - 1)}
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
              onClick={() => setCurrentPage((p) => p + 1)}
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

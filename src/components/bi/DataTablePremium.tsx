"use client";

import { useState, useMemo } from "react";
import { Search, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DataTablePremiumProps {
  data: any[];
}

export function DataTablePremium({ data }: DataTablePremiumProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState("DATA");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const pageSize = 50;

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
          String(item.TIPO_PEDIDO).toLowerCase().includes(term)
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
  const totalPages = Math.ceil(processedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  const sanitizeCsvField = (value: string | null | undefined): string => {
    if (!value) return '';
    const str = String(value);
    // Se começar com caracteres perigosos de fórmula CSV/Excel/Calc, adiciona apóstrofo
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
          `"${sanitizeCsvField(row.NOME)}"`,
          row.TIPO,
          `"${sanitizeCsvField(row.TIPO_PEDIDO)}"`,
          `"${sanitizeCsvField(row.TIPO_DETALHADO)}"`,
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
        return "bg-blue-500/10 text-[#2B7FFF] border-blue-500/20";
      case "Consulta Eletrônica (CE)":
        return "bg-[#00C950]/10 text-[#00C950] border-[#00C950]/20";
      case "Consulta Eletrônica (VM)":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl space-y-4">
      {/* Controls Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
          <Input
            placeholder="Buscar por Pedido ou Nome..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#00C950]/50"
          />
        </div>

        <Button
          onClick={exportToCSV}
          className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white gap-2 font-semibold"
        >
          <Download className="h-4 w-4" />
          Exportar Filtros ({processedData.length})
        </Button>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-sm text-left">
          <thead className="bg-white/5 text-white/80 select-none">
            <tr>
              <th onClick={() => handleSort("DATA")} className="p-3 border-b border-white/10 cursor-pointer hover:bg-white/5">
                Data {sortField === "DATA" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("HORA")} className="p-3 border-b border-white/10 cursor-pointer hover:bg-white/5">
                Hora {sortField === "HORA" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("DIA_SEMANA")} className="p-3 border-b border-white/10 cursor-pointer hover:bg-white/5">
                Dia Semana {sortField === "DIA_SEMANA" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("PEDIDO")} className="p-3 border-b border-white/10 cursor-pointer hover:bg-white/5">
                Pedido {sortField === "PEDIDO" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("NOME")} className="p-3 border-b border-white/10 cursor-pointer hover:bg-white/5">
                Nome {sortField === "NOME" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("TIPO")} className="p-3 border-b border-white/10 cursor-pointer hover:bg-white/5">
                Tipo {sortField === "TIPO" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("TIPO_PEDIDO")} className="p-3 border-b border-white/10 cursor-pointer hover:bg-white/5">
                Tipo Pedido {sortField === "TIPO_PEDIDO" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
              <th onClick={() => handleSort("TIPO_DETALHADO")} className="p-3 border-b border-white/10 cursor-pointer hover:bg-white/5">
                Detalhado {sortField === "TIPO_DETALHADO" && (sortDirection === "asc" ? "▲" : "▼")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-white/[0.01]">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors text-white/80">
                  <td className="p-3">{row.DATA}</td>
                  <td className="p-3 font-mono">{row.HORA}</td>
                  <td className="p-3">{row.DIA_SEMANA}</td>
                  <td className="p-3 font-semibold text-[#2B7FFF]">
                    <a href={`/bi/pedidos/${row.PEDIDO}`} className="hover:underline">
                      {row.PEDIDO}
                    </a>
                  </td>
                  <td className="p-3 font-medium text-white">{row.NOME}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={row.TIPO === "TÍTULO" ? "border-emerald-500/30 text-[#00C950] bg-emerald-500/5" : "border-[#2B7FFF]/30 text-[#2B7FFF] bg-[#2B7FFF]/5"}>
                      {row.TIPO}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className={getTipoPedidoBadgeStyle(row.TIPO_PEDIDO)}>
                      {row.TIPO_PEDIDO}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-white/50">{row.TIPO_DETALHADO}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-white/40">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between text-xs text-white/60">
        <div>
          Mostrando <span className="font-semibold text-white">{Math.min(processedData.length, (currentPage - 1) * pageSize + 1)}-{Math.min(processedData.length, currentPage * pageSize)}</span> de <span className="font-semibold text-white">{processedData.length}</span> registros
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="h-8 w-8 rounded-md hover:bg-white/5 hover:text-white"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 rounded-md hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="px-3 text-sm">
            Página <span className="font-semibold text-white">{currentPage}</span> de <span className="font-semibold text-white">{totalPages}</span>
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 rounded-md hover:bg-white/5 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 rounded-md hover:bg-white/5 hover:text-white"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

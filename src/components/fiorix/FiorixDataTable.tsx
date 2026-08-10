"use client";

import { useState, useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Filter, Info, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";

interface FiorixDataTableProps {
  initialData?: {
    items?: any[];
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
    rangeCounts?: number[];
  } | any[];
  initialFilters?: {
    importId?: string;
    startDate?: string;
    endDate?: string;
    tipoPrenotacao?: string;
  };
  totalAtrasadosCount?: number;
}

const DELAY_RANGES = [
  { label: "Todos", index: 0 },
  { label: "1–3 dias", index: 1 },
  { label: "4–7 dias", index: 2 },
  { label: "8–15 dias", index: 3 },
  { label: "16–30 dias", index: 4 },
  { label: "31+ dias", index: 5 },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function FiorixDataTable({ initialData, initialFilters, totalAtrasadosCount }: FiorixDataTableProps) {
  // Normalize initial data if array or object format
  const rawItems = Array.isArray(initialData) ? initialData : initialData?.items || [];
  const rawPagination = Array.isArray(initialData)
    ? { page: 1, pageSize: 20, totalItems: rawItems.length, totalPages: Math.ceil(rawItems.length / 20) || 1 }
    : initialData?.pagination || { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 };
  const rawCounts = Array.isArray(initialData)
    ? [rawItems.length, 0, 0, 0, 0, 0]
    : initialData?.rangeCounts || [0, 0, 0, 0, 0, 0];

  const [items, setItems] = useState<any[]>(rawItems);
  const [pagination, setPagination] = useState(rawPagination);
  const [rangeCounts, setRangeCounts] = useState<number[]>(rawCounts);

  const [activeRange, setActiveRange] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(rawPagination.page || 1);
  const [pageSize, setPageSize] = useState(rawPagination.pageSize || 20);
  const [isLoading, setIsLoading] = useState(false);

  const isMounted = useRef(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset page on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch updated data from API when pagination or filters change
  useEffect(() => {
    // Skip initial fetch if mounted for the first time and using server initialData
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    let isSubscribed = true;
    async function fetchData() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (initialFilters?.importId) params.set("importId", initialFilters.importId);
        if (initialFilters?.startDate) params.set("startDate", initialFilters.startDate);
        if (initialFilters?.endDate) params.set("endDate", initialFilters.endDate);
        if (initialFilters?.tipoPrenotacao) params.set("tipoPrenotacao", initialFilters.tipoPrenotacao);

        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        if (activeRange > 0) params.set("rangeIndex", String(activeRange));
        if (debouncedSearch) params.set("search", debouncedSearch);

        const res = await fetch(`/api/bi/atrasados?${params.toString()}`);
        if (!res.ok) throw new Error("Erro ao carregar dados");
        const json = await res.json();

        if (isSubscribed && json.success) {
          setItems(json.items || []);
          setPagination(json.pagination || { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
          if (json.rangeCounts) setRangeCounts(json.rangeCounts);
        }
      } catch (err) {
        console.error("Erro ao buscar títulos atrasados:", err);
      } finally {
        if (isSubscribed) setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      isSubscribed = false;
    };
  }, [page, pageSize, activeRange, debouncedSearch, initialFilters]);

  const handleRangeChange = (index: number) => {
    setActiveRange(index);
    setPage(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "no_prazo":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0 dark:bg-emerald-950/60 dark:text-emerald-300">No Prazo</Badge>;
      case "atrasado":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0 dark:bg-red-950/60 dark:text-red-300">Atrasado</Badge>;
      case "devolvido":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0 dark:bg-amber-950/60 dark:text-amber-300">Devolvido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalOverallCount = totalAtrasadosCount || rangeCounts[0] || pagination.totalItems;
  const formattedTotalOverall = totalOverallCount ? totalOverallCount.toLocaleString("pt-BR") : "0";
  
  const startItem = pagination.totalItems > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

  return (
    <Card className="rounded-2xl shadow-sm border-gray-100 dark:border-border mt-4 overflow-hidden">
      {/* Banner de informações sobre consulta completa */}
      <div className="bg-blue-500/10 border-b border-blue-500/20 px-6 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs text-blue-950 dark:text-blue-200">
        <div className="flex items-center gap-2 font-medium">
          <Info size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            <strong>Consulta integral de títulos em atraso:</strong> Pesquise, filtre por faixa e navegue por todos os{" "}
            <strong>{formattedTotalOverall}</strong> protocolos com estouro de prazo legal.
          </span>
        </div>
        <Badge variant="outline" className="bg-blue-100 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 font-semibold text-[11px] flex items-center gap-1">
          <Layers size={11} />
          Consulta Geral ({formattedTotalOverall})
        </Badge>
      </div>

      <CardHeader className="pb-4 border-b border-gray-100 dark:border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Títulos em Atraso (Drill-down)</CardTitle>
            <CardDescription>Detalhamento dos protocolos críticos com estouro de prazo legal</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar protocolo em toda base..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-gray-50 dark:bg-accent border-gray-200 dark:border-border rounded-lg shadow-sm text-xs"
            />
            {isLoading && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 text-blue-600 animate-spin" />
            )}
          </div>
        </div>

        {/* Filtro por faixa de dias */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium mr-1">Dias de atraso:</span>
          {DELAY_RANGES.map((r) => {
            const countForBadge = rangeCounts[r.index] ?? 0;
            return (
              <Button
                key={r.label}
                variant={activeRange === r.index ? "default" : "outline"}
                size="sm"
                className={`h-7 text-xs rounded-full px-3 transition-all ${
                  activeRange === r.index
                    ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-sm font-medium"
                    : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-accent"
                }`}
                onClick={() => handleRangeChange(r.index)}
              >
                {r.label}
                <span
                  className={`ml-1.5 text-[10px] font-bold ${
                    activeRange === r.index ? "text-slate-300 dark:text-slate-700" : "text-muted-foreground/70"
                  }`}
                >
                  {countForBadge.toLocaleString("pt-BR")}
                </span>
              </Button>
            );
          })}
        </div>
      </CardHeader>
      
      <div className="overflow-x-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 bg-background dark:bg-card border border-border px-4 py-2 rounded-xl shadow-md text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <span>Carregando dados da página...</span>
            </div>
          </div>
        )}
        
        <Table>
          <TableHeader className="bg-gray-50/50 dark:bg-accent/50">
            <TableRow>
              <TableHead className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">Protocolo</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">Status</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">Atraso (Dias)</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider uppercase text-muted-foreground">Data Entrada</TableHead>
              <TableHead className="font-semibold text-xs tracking-wider uppercase text-muted-foreground text-right">Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id} className="hover:bg-gray-50/50 dark:hover:bg-accent/50 transition-colors">
                <TableCell className="font-semibold text-foreground">{row.protocolo}</TableCell>
                <TableCell>{getStatusBadge(row.status)}</TableCell>
                <TableCell className="text-red-600 font-bold dark:text-red-400">+{row.atraso}d</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.data ? row.data.split('-').reverse().join('/') : '-'}
                </TableCell>
                <TableCell className="text-right text-muted-foreground font-medium">{row.tipo}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <div className="space-y-1">
                    <p className="font-medium text-sm text-foreground">Nenhum protocolo atrasado encontrado</p>
                    <p className="text-xs text-muted-foreground">
                      {debouncedSearch
                        ? `Nenhum resultado corresponde ao protocolo "${debouncedSearch}".`
                        : activeRange > 0
                        ? `Nenhum título encontrado para a faixa "${DELAY_RANGES[activeRange].label}".`
                        : "Não há registros disponíveis nos filtros selecionados."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Rodapé com Barra de Paginação Completa */}
      <div className="px-6 py-3.5 border-t border-gray-100 dark:border-border bg-gray-50/50 dark:bg-card flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Informação de intervalo */}
        <div className="text-xs text-muted-foreground text-center sm:text-left">
          Exibindo <strong className="text-foreground">{startItem.toLocaleString("pt-BR")}</strong> a{" "}
          <strong className="text-foreground">{endItem.toLocaleString("pt-BR")}</strong> de{" "}
          <strong className="text-foreground">{pagination.totalItems.toLocaleString("pt-BR")}</strong> protocolos atrasados
          {activeRange > 0 && (
            <span> · Faixa: <strong className="text-foreground">{DELAY_RANGES[activeRange].label}</strong></span>
          )}
        </div>

        {/* Controles de Paginação & Itens Por Página */}
        <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
          {/* Seletor de Tamanho de Página */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Exibir:</span>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-accent p-0.5 rounded-lg border border-gray-200 dark:border-border">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                    pageSize === size
                      ? "bg-white dark:bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Navegação de Páginas */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(1)}
              title="Primeira Página"
            >
              <ChevronsLeft size={15} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Página Anterior"
            >
              <ChevronLeft size={15} />
            </Button>

            <span className="text-xs px-2 font-medium text-foreground min-w-[90px] text-center">
              Página {pagination.page.toLocaleString("pt-BR")} de {pagination.totalPages.toLocaleString("pt-BR")}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground"
              disabled={page >= pagination.totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              title="Próxima Página"
            >
              <ChevronRight size={15} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground"
              disabled={page >= pagination.totalPages || isLoading}
              onClick={() => setPage(pagination.totalPages)}
              title="Última Página"
            >
              <ChevronsRight size={15} />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

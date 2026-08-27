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
  const [queryMode, setQueryMode] = useState<'atrasado' | 'full'>('atrasado');
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [servicoFilter, setServicoFilter] = useState<string>("ALL");
  const [tipoFilter, setTipoFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(false);
  const [messagePrompt, setMessagePrompt] = useState<string | null>(null);

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
      setMessagePrompt(null);
      try {
        const params = new URLSearchParams();
        if (initialFilters?.importId) params.set("importId", initialFilters.importId);
        if (initialFilters?.startDate) params.set("startDate", initialFilters.startDate);
        if (initialFilters?.endDate) params.set("endDate", initialFilters.endDate);
        
        // Se estiver no modo Consulta Geral, prioriza o filtro TIPO da própria tabela. Caso contrário, usa o do painel principal
        const finalTipo = queryMode === 'full' ? tipoFilter : (initialFilters?.tipoPrenotacao || "ALL");
        if (finalTipo && finalTipo !== "ALL") params.set("tipoPrenotacao", finalTipo);

        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        params.set("queryMode", queryMode);
        
        if (queryMode === 'atrasado' && activeRange > 0) {
          params.set("rangeIndex", String(activeRange));
        }
        if (queryMode === 'full') {
          if (statusFilter !== "ALL") params.set("statusFilter", statusFilter);
          if (servicoFilter !== "ALL") params.set("servicoFilter", servicoFilter);
        }

        if (debouncedSearch) params.set("search", debouncedSearch);

        const res = await fetch(`/api/bi/atrasados?${params.toString()}`);
        if (!res.ok) throw new Error("Erro ao carregar dados");
        const json = await res.json();

        if (isSubscribed && json.success) {
          setItems(json.items || []);
          setPagination(json.pagination || { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
          if (json.rangeCounts) setRangeCounts(json.rangeCounts);

          // Se for uma busca por protocolo numérico exato
          if (debouncedSearch && /^\d+$/.test(debouncedSearch)) {
            const foundItem = (json.items || []).find((i: any) => i.protocolo === debouncedSearch);
            if (foundItem) {
              if (foundItem.status === 'Em dia') {
                setMessagePrompt(`Protocolo ${debouncedSearch} está Em dia (0 dias) - não está em atraso`);
              }
            } else {
              // Se não achou na busca com o queryMode atual, tentar avisar
              if (queryMode === 'atrasado') {
                setMessagePrompt(`Protocolo ${debouncedSearch} não encontrado em atraso. Use a Consulta Geral.`);
              }
            }
          }
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
  }, [page, pageSize, activeRange, debouncedSearch, queryMode, statusFilter, servicoFilter, tipoFilter, initialFilters]);

  // Functions are defined below

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    let isSubscribed = true;
    async function fetchData() {
      setIsLoading(true);
      setMessagePrompt(null);
      try {
        const params = new URLSearchParams();
        if (initialFilters?.importId) params.set("importId", initialFilters.importId);
        if (initialFilters?.startDate) params.set("startDate", initialFilters.startDate);
        if (initialFilters?.endDate) params.set("endDate", initialFilters.endDate);
        
        // Se estiver no modo Consulta Geral, prioriza o filtro TIPO da própria tabela. Caso contrário, usa o do painel principal
        const finalTipo = queryMode === 'full' ? tipoFilter : (initialFilters?.tipoPrenotacao || "ALL");
        if (finalTipo && finalTipo !== "ALL") params.set("tipoPrenotacao", finalTipo);

        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        params.set("queryMode", queryMode);
        
        if (queryMode === 'atrasado' && activeRange > 0) {
          params.set("rangeIndex", String(activeRange));
        }
        if (queryMode === 'full') {
          if (statusFilter !== "ALL") params.set("statusFilter", statusFilter);
          if (servicoFilter !== "ALL") params.set("servicoFilter", servicoFilter);
        }

        if (debouncedSearch) params.set("search", debouncedSearch);

        const res = await fetch(`/api/bi/atrasados?${params.toString()}`);
        if (!res.ok) throw new Error("Erro ao carregar dados");
        const json = await res.json();

        if (isSubscribed && json.success) {
          setItems(json.items || []);
          setPagination(json.pagination || { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
          if (json.rangeCounts) setRangeCounts(json.rangeCounts);

          // Se for uma busca por protocolo numérico exato
          if (debouncedSearch && /^\d+$/.test(debouncedSearch)) {
            const foundItem = (json.items || []).find((i: any) => i.protocolo === debouncedSearch);
            if (foundItem) {
              if (foundItem.status === 'Em dia') {
                setMessagePrompt(`Protocolo ${debouncedSearch} está Em dia (0 dias) - não está em atraso`);
              }
            } else {
              // Se não achou na busca com o queryMode atual, tentar avisar
              if (queryMode === 'atrasado') {
                setMessagePrompt(`Protocolo ${debouncedSearch} não encontrado em atraso. Use a Consulta Geral.`);
              }
            }
          }
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
  }, [page, pageSize, activeRange, debouncedSearch, queryMode, statusFilter, servicoFilter, tipoFilter, initialFilters]);

  const handleRangeChange = (index: number) => {
    setActiveRange(index);
    setPage(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const handleToggleQueryMode = (mode: 'atrasado' | 'full') => {
    setQueryMode(mode);
    setPage(1);
    setActiveRange(0);
    setStatusFilter("ALL");
    setServicoFilter("ALL");
    setTipoFilter("ALL");
  };

  const getStatusBadge = (status: string) => {
    if (status === "Atrasado") {
      return <Badge className="bg-red-500/10 border border-red-500/20 text-red-300 backdrop-blur-md font-semibold text-[11px]">Atrasado</Badge>;
    }
    return <Badge className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 backdrop-blur-md font-semibold text-[11px]">Em dia</Badge>;
  };

  const getAtrasoBadge = (dias: number) => {
    if (dias === 0) {
      return <Badge className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 backdrop-blur-md font-mono font-bold text-[11px]">0 dias</Badge>;
    }
    if (dias >= 1 && dias <= 15) {
      return <Badge className="bg-amber-500/10 border border-amber-500/20 text-amber-300 backdrop-blur-md font-mono font-bold text-[11px]">{dias} dias</Badge>;
    }
    if (dias >= 16 && dias <= 30) {
      return <Badge className="bg-orange-500/10 border border-orange-500/20 text-orange-300 backdrop-blur-md font-mono font-bold text-[11px]">{dias} dias</Badge>;
    }
    return <Badge className="bg-red-500/10 border border-red-500/20 text-red-300 backdrop-blur-md font-mono font-bold text-[11px]">{dias} dias</Badge>;
  };

  const getServicoBadge = (servico: string) => {
    if (servico === "REGISTRADO") {
      return <Badge className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 backdrop-blur-md font-semibold text-[11px]">REGISTRADO</Badge>;
    }
    return <Badge className="bg-amber-500/10 border border-amber-500/20 text-amber-300 backdrop-blur-md font-semibold text-[11px]">DEVOLVIDO</Badge>;
  };

  const totalOverallCount = totalAtrasadosCount || rangeCounts[0] || pagination.totalItems;
  const formattedTotalOverall = totalOverallCount ? totalOverallCount.toLocaleString("pt-BR") : "0";
  
  const startItem = pagination.totalItems > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

  return (
    <Card className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-[#0B1020]/72 text-white shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
      {/* Abas Superiores */}
      <div className="flex border-b border-white/8 bg-[#0B1020]/92">
        <button
          onClick={() => handleToggleQueryMode('atrasado')}
          className={`flex-1 sm:flex-initial px-6 py-3.5 text-xs uppercase font-bold tracking-wider transition-colors border-b-2 ${
            queryMode === 'atrasado'
              ? 'border-amber-400 text-amber-300 bg-white/[0.03]'
              : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          ⏰ Títulos em Atraso ({formattedTotalOverall})
        </button>
        <button
          onClick={() => handleToggleQueryMode('full')}
          className={`flex-1 sm:flex-initial px-6 py-3.5 text-xs uppercase font-bold tracking-wider transition-colors border-b-2 ${
            queryMode === 'full'
              ? 'border-cyan-400 text-cyan-300 bg-white/[0.03]'
              : 'border-transparent text-white/50 hover:text-white/80'
          }`}
        >
          🔍 Consulta Geral
        </button>
      </div>

      <CardHeader className="space-y-4 border-b border-white/8 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold text-white">
              {queryMode === 'full' ? 'Consulta Geral (Todos os Títulos)' : 'Títulos em Atraso (Drill-down)'}
            </CardTitle>
            <CardDescription className="text-xs text-white/50">
              {queryMode === 'full' 
                ? 'Exibição completa de títulos e prazos registrados no sistema' 
                : 'Detalhamento dos protocolos críticos com estouro de prazo legal'}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/40" />
            <Input
              type="search"
              placeholder="Buscar protocolo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 bg-[#0C1323] border-white/8 text-white rounded-xl shadow-sm text-xs focus:ring-0 focus:border-amber-400"
            />
            {isLoading && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 text-emerald-300 animate-spin" />
            )}
          </div>
        </div>

        {messagePrompt && (
          <div className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs text-cyan-300">
            <Info size={14} />
            <span>{messagePrompt}</span>
          </div>
        )}

        {/* Filtros da Consulta Geral */}
        {queryMode === 'full' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-white/40">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="rounded-xl border border-white/8 bg-[#0C1323] px-2 py-1.5 text-xs text-white outline-none focus:border-amber-400"
              >
                <option value="ALL" className="bg-[#0B1020]">Todos os Status</option>
                <option value="Em dia" className="bg-[#0B1020]">Em dia</option>
                <option value="Atrasado" className="bg-[#0B1020]">Atrasado</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-white/40">Serviço</label>
              <select
                value={servicoFilter}
                onChange={(e) => { setServicoFilter(e.target.value); setPage(1); }}
                className="rounded-xl border border-white/8 bg-[#0C1323] px-2 py-1.5 text-xs text-white outline-none focus:border-amber-400"
              >
                <option value="ALL" className="bg-[#0B1020]">Todos os Serviços</option>
                <option value="REGISTRADO" className="bg-[#0B1020]">REGISTRADO</option>
                <option value="DEVOLVIDO" className="bg-[#0B1020]">DEVOLVIDO</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-white/40">Tipo</label>
              <select
                value={tipoFilter}
                onChange={(e) => { setTipoFilter(e.target.value); setPage(1); }}
                className="rounded-xl border border-white/8 bg-[#0C1323] px-2 py-1.5 text-xs text-white outline-none focus:border-amber-400"
              >
                <option value="ALL" className="bg-[#0B1020]">Todos os Tipos</option>
                <option value="PRENOTADO" className="bg-[#0B1020]">PRENOTADO</option>
                <option value="INTIMACAO" className="bg-[#0B1020]">INTIMACAO</option>
                <option value="INTIMACAO ONLINE" className="bg-[#0B1020]">INTIMACAO ONLINE</option>
                <option value="OFICIO - INDISPONIBILIDADE" className="bg-[#0B1020]">OFICIO - INDISPONIBILIDADE</option>
                <option value="REGULARIZACAO FUNDIARIA" className="bg-[#0B1020]">REGULARIZACAO FUNDIARIA</option>
              </select>
            </div>
          </div>
        )}

        {/* Filtro por faixa de dias (Apenas para modo Atrasado) */}
        {queryMode === 'atrasado' && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-white/40 shrink-0" />
            <span className="text-xs text-white/60 font-medium mr-1">Dias de atraso:</span>
            {DELAY_RANGES.map((r) => {
              const countForBadge = rangeCounts[r.index] ?? 0;
              return (
                <Button
                  key={r.label}
                  variant={activeRange === r.index ? "default" : "outline"}
                  size="sm"
                  className={`h-7 rounded-full border border-white/8 px-3 text-xs transition-all ${
                    activeRange === r.index
                      ? "bg-gradient-to-r from-indigo-500 to-amber-400 font-medium text-white shadow-sm"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                  onClick={() => handleRangeChange(r.index)}
                >
                  {r.label}
                  <span
                    className={`ml-1.5 text-[10px] font-bold ${
                      activeRange === r.index ? "text-slate-700" : "text-white/40"
                    }`}
                  >
                    {countForBadge.toLocaleString("pt-BR")}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </CardHeader>
      
      <div className="relative max-h-[600px] overflow-x-auto overflow-y-auto">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0B1020]/55 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-[#0B1020] px-4 py-2 text-xs text-white/60 shadow-md">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
              <span>Carregando dados...</span>
            </div>
          </div>
        )}
        
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-[#0B1020]">
            <TableRow className="border-white/8 bg-[#0B1020]">
              <TableHead className="sticky top-0 z-20 bg-[#0B1020] text-xs font-semibold uppercase tracking-wider text-white/58">Protocolo</TableHead>
              <TableHead className="sticky top-0 z-20 bg-[#0B1020] text-xs font-semibold uppercase tracking-wider text-white/58">Tipo</TableHead>
              <TableHead className="sticky top-0 z-20 bg-[#0B1020] text-xs font-semibold uppercase tracking-wider text-white/58">Status</TableHead>
              <TableHead className="sticky top-0 z-20 bg-[#0B1020] text-xs font-semibold uppercase tracking-wider text-white/58">Atraso Dias</TableHead>
              <TableHead className="sticky top-0 z-20 bg-[#0B1020] text-right text-xs font-semibold uppercase tracking-wider text-white/58">Serviço</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id} className="border-white/5 text-white/80 transition-colors hover:bg-white/[0.035]">
                <TableCell className="font-semibold text-amber-200">{row.protocolo}</TableCell>
                <TableCell className="font-medium text-white/64">{row.tipo}</TableCell>
                <TableCell>{getStatusBadge(row.status)}</TableCell>
                <TableCell>{getAtrasoBadge(row.atraso)}</TableCell>
                <TableCell className="text-right">{getServicoBadge(row.servico)}</TableCell>
              </TableRow>
            ))}
            {items.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-white/40">
                  <div className="space-y-1">
                    <p className="font-medium text-sm text-white">Nenhum protocolo encontrado</p>
                    <p className="text-xs text-white/40">
                      {debouncedSearch
                        ? `Nenhum resultado corresponde ao protocolo "${debouncedSearch}".`
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
      <div className="flex flex-col items-center justify-between gap-4 border-t border-white/8 bg-white/[0.03] px-6 py-3.5 sm:flex-row">
        {/* Informação de intervalo */}
        <div className="text-xs text-white/60 text-center sm:text-left">
          Exibindo <strong className="text-white">{startItem.toLocaleString("pt-BR")}</strong> a{" "}
          <strong className="text-white">{endItem.toLocaleString("pt-BR")}</strong> de{" "}
          <strong className="text-white">{pagination.totalItems.toLocaleString("pt-BR")}</strong> registros
          {activeRange > 0 && queryMode === 'atrasado' && (
            <span> · Faixa: <strong className="text-white">{DELAY_RANGES[activeRange].label}</strong></span>
          )}
        </div>

        {/* Controles de Paginação & Itens Por Página */}
        <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
          {/* Seletor de Tamanho de Página */}
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <span>Exibir:</span>
            <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                    pageSize === size
                      ? "bg-gradient-to-r from-indigo-500 to-amber-400 text-white shadow-xs"
                      : "text-white/60 hover:text-white"
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
              className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(1)}
              title="Primeira Página"
            >
              <ChevronsLeft size={15} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Página Anterior"
            >
              <ChevronLeft size={15} />
            </Button>

            <span className="text-xs px-2 font-medium text-white min-w-[90px] text-center">
              Página {pagination.page.toLocaleString("pt-BR")} de {pagination.totalPages.toLocaleString("pt-BR")}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              disabled={page >= pagination.totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              title="Próxima Página"
            >
              <ChevronRight size={15} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg border border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]"
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

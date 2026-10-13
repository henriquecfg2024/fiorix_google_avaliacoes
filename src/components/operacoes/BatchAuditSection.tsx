'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Copy,
  Check,
  X,
  Download,
  FilterX,
  Wifi,
} from 'lucide-react';
import { toast } from 'sonner';

interface BatchItem {
  id: string;
  batchId: string;
  source: string;
  status: string;
  syncMode: string;
  recordsReceived: number;
  recordsInserted: number;
  recordsUpdated: number;
  durationMs: number | null;
  chunkCount: number;
  chunksReceived: number;
  generatedAt: string;
  receivedAt: string;
  processedAt: string | null;
  errorMessage?: string | null;
}

interface BatchesResponse {
  batches: BatchItem[];
  summary?: {
    totalBatches: number;
    totalRecords: number;
    recordsInserted: number;
    recordsUpdated: number;
    errorBatches: number;
    avgDurationMs: number | null;
    successRate: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const MODULE_PROCEDURES: Record<string, string> = {
  bi: 'dbo.pr_Fiorix_BI_Incremental_v2',
  produtividade: 'dbo.pr_Fiorix_Produtividade_Incremental_v2',
  metas: 'dbo.pr_Fiorix_Metas_Incremental_v2',
  tarefas: 'dbo.pr_Fiorix_Tarefas_Incremental_v2',
  retornos: 'dbo.pr_Fiorix_Retornos_Incremental_v2',
  impressoes: 'dbo.pr_Fiorix_Impressoes_Incremental_v2',
};

export function BatchAuditSection() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [summary, setSummary] = useState<BatchesResponse['summary'] | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filtros
  const [periodFilter, setPeriodFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchBatches = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (periodFilter !== 'all') params.set('period', periodFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/v1/operacoes/batches?${params.toString()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data: BatchesResponse = await res.json();
        setBatches(data.batches);
        setPagination(data.pagination);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar histórico de lotes:', err);
      toast.error('Erro ao carregar histórico de lotes');
    } finally {
      setLoading(false);
    }
  }, [periodFilter, sourceFilter, statusFilter, pageSize, searchTerm]);

  useEffect(() => {
    fetchBatches(1);
  }, [periodFilter, sourceFilter, statusFilter, pageSize]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBatches(1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    // Força refetch imediato sem busca
    setTimeout(() => {
      const params = new URLSearchParams({
        page: '1',
        pageSize: pageSize.toString(),
      });
      if (periodFilter !== 'all') params.set('period', periodFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      fetch(`/api/v1/operacoes/batches?${params.toString()}`)
        .then((r) => r.json())
        .then((d: BatchesResponse) => {
          setBatches(d.batches);
          setPagination(d.pagination);
          if (d.summary) setSummary(d.summary);
        });
    }, 0);
  };

  const handleClearAllFilters = () => {
    setPeriodFilter('all');
    setSourceFilter('all');
    setStatusFilter('all');
    setSearchTerm('');
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ export: 'csv' });
      if (periodFilter !== 'all') params.set('period', periodFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/v1/operacoes/batches?${params.toString()}`);
      if (!res.ok) throw new Error('Falha no download');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_lotes_fiorix_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Auditoria exportada em CSV com sucesso');
    } catch {
      toast.error('Erro ao exportar arquivo CSV');
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasActiveFilters = periodFilter !== 'all' || sourceFilter !== 'all' || statusFilter !== 'all' || searchTerm.trim() !== '';

  const getSourceBadge = (source: string) => {
    switch (source.toLowerCase()) {
      case 'bi':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">BI</span>;
      case 'produtividade':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Produtividade</span>;
      case 'metas':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Metas</span>;
      case 'tarefas':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Tarefas</span>;
      case 'retornos':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Retornos</span>;
      case 'impressoes':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">Impressões</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#151A2C] text-[#94A3B8] border border-[#1E293B]">{source}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'processed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)] font-mono">
            <CheckCircle2 className="h-3 w-3" /> Concluído
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 font-mono">
            <AlertTriangle className="h-3 w-3" /> Parcial
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F43F5E]/10 text-[#F43F5E] border border-[#F43F5E]/20 font-mono">
            <XCircle className="h-3 w-3" /> Falha
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 font-mono">
            <Clock className="h-3 w-3" /> {status}
          </span>
        );
    }
  };

  const formatSPTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' })}`;
  };

  const getTransitLatencyMs = (generatedAt: string, receivedAt: string): number => {
    const gen = new Date(generatedAt).getTime();
    const rec = new Date(receivedAt).getTime();
    return Math.max(0, rec - gen);
  };

  return (
    <div className="space-y-5 font-sans">
      {/* 1. CARDS DE RESUMO DA AUDITORIA (KPIS EM TEMPO REAL) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#111729] border border-[#1E293B] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">Lotes Auditados</span>
          <span className="text-xl font-bold font-mono text-[#F1F5F9] mt-1 block">
            {summary ? summary.totalBatches.toLocaleString('pt-BR') : pagination.total.toLocaleString('pt-BR')}
          </span>
          <span className="text-[10px] text-[#64748B] font-mono mt-0.5 block">
            {summary?.errorBatches && summary.errorBatches > 0 
              ? `${summary.errorBatches} lote(s) com erro` 
              : '0 erros registrados'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111729] border border-[#1E293B] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">Taxa de Sucesso</span>
          <span className="text-xl font-bold font-mono text-[#10B981] mt-1 block">
            {summary?.successRate !== undefined ? `${summary.successRate}%` : '100%'}
          </span>
          <span className="text-[10px] text-[#10B981] font-mono mt-0.5 block">Dentro da conformidade</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111729] border border-[#1E293B] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">Registros Ingeridos</span>
          <span className="text-xl font-bold font-mono text-cyan-400 mt-1 block">
            {summary?.totalRecords ? summary.totalRecords.toLocaleString('pt-BR') : '—'}
          </span>
          <span className="text-[10px] text-[#94A3B8] font-mono mt-0.5 block truncate">
            {summary ? `+${summary.recordsInserted.toLocaleString('pt-BR')} novos • ~${summary.recordsUpdated.toLocaleString('pt-BR')} alt` : 'sincronizados'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#111729] border border-[#1E293B] shadow-sm">
          <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">Duração Média / Lote</span>
          <span className="text-xl font-bold font-mono text-[#F1F5F9] mt-1 block">
            {summary?.avgDurationMs ? `${summary.avgDurationMs} ms` : '—'}
          </span>
          <span className="text-[10px] text-[#10B981] font-mono mt-0.5 block">Processamento SaaS normal</span>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS E BUSCA INTEGRADA */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#111729] p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Campo de Busca com Botão de Limpar */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por UUID, ID ou erro..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#151A2C] border border-[#1E293B] text-[#F1F5F9] placeholder-[#64748B] text-xs focus:outline-none focus:border-[#3B82F6] transition-all font-mono"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#64748B] hover:text-[#F1F5F9]"
                  title="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#F1F5F9] text-xs font-semibold border border-[#1E293B] transition-all active:scale-95 cursor-pointer"
            >
              Buscar
            </button>
          </form>

          {/* Menus Dropdown de Filtro */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Filtro por Período */}
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#151A2C] border border-[#1E293B] text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6] cursor-pointer"
            >
              <option value="all">Todos os Períodos</option>
              <option value="today">Hoje (desde 00:00)</option>
              <option value="yesterday">Ontem</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </select>

            {/* Filtro por Módulo */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#151A2C] border border-[#1E293B] text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6] cursor-pointer"
            >
              <option value="all">Todos os Módulos</option>
              <option value="bi">Módulo BI</option>
              <option value="produtividade">Produtividade</option>
              <option value="metas">Metas</option>
              <option value="tarefas">Tarefas</option>
              <option value="retornos">Retornos</option>
              <option value="impressoes">Impressões</option>
            </select>

            {/* Filtro por Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#151A2C] border border-[#1E293B] text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6] cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="completed">Concluídos</option>
              <option value="error">Apenas Erros</option>
              <option value="receiving">Em Processamento</option>
            </select>

            {/* Seletor de Itens por Página */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2.5 py-2 rounded-xl bg-[#151A2C] border border-[#1E293B] text-[#94A3B8] focus:outline-none focus:border-[#3B82F6] cursor-pointer font-mono"
              title="Itens por página"
            >
              <option value={20}>20 / pág</option>
              <option value={50}>50 / pág</option>
              <option value={100}>100 / pág</option>
            </select>

            {/* Limpar Filtros */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-medium transition-all active:scale-95 cursor-pointer"
                title="Limpar todos os filtros"
              >
                <FilterX className="h-3.5 w-3.5" />
                <span>Limpar</span>
              </button>
            )}

            {/* Exportar CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={exporting || loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#F1F5F9] border border-[#1E293B] font-medium transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Exportar auditoria filtrada em arquivo CSV"
            >
              <Download className={`h-3.5 w-3.5 text-[#3B82F6] ${exporting ? 'animate-bounce' : ''}`} />
              <span>{exporting ? 'Exportando...' : 'Exportar CSV'}</span>
            </button>

            {/* Recarregar */}
            <button
              type="button"
              onClick={() => fetchBatches(pagination.page)}
              disabled={loading}
              className="p-2 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#1E293B] transition-all disabled:opacity-40 cursor-pointer"
              title="Atualizar lista"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. TABELA DE AUDITORIA DE LOTES */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#111729] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-[#3B82F6]" />
            <h3 className="text-sm font-semibold text-[#F1F5F9] tracking-wide">
              Trilha de Auditoria & Lotes Sincronizados
            </h3>
          </div>
          <span className="text-xs font-mono text-[#64748B]">
            Total: <strong className="text-[#F1F5F9] font-semibold">{pagination.total.toLocaleString('pt-BR')}</strong> lotes indexados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E293B] text-[11px] uppercase tracking-wider text-[#64748B] font-semibold font-sans bg-[#151A2C]/30">
                <th className="py-3 px-4">Lote / Batch ID & Procedure</th>
                <th className="py-3 px-4">Módulo</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Registros Ingeridos</th>
                <th className="py-3 px-4">Duração</th>
                <th className="py-3 px-4">Recebido em (SP)</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-[#94A3B8]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#64748B] font-sans">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[#3B82F6]" />
                    Carregando histórico de lotes...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#64748B] font-sans">
                    Nenhum lote encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => {
                  const procedure = MODULE_PROCEDURES[batch.source.toLowerCase()];
                  const isError = batch.status === 'error';
                  const isSlow = batch.durationMs !== null && batch.durationMs > 5000;

                  return (
                    <tr key={batch.id} className="hover:bg-[#151A2C] transition-colors group">
                      {/* Lote / Batch ID com Cópia e Procedure */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#F1F5F9] font-semibold">
                            {batch.batchId.substring(0, 8)}...
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(batch.batchId)}
                            className="p-1 rounded hover:bg-[#1E293B] text-[#64748B] hover:text-[#F1F5F9] transition-colors cursor-pointer"
                            title="Copiar UUID completo"
                          >
                            {copiedId === batch.batchId ? (
                              <Check className="h-3 w-3 text-[#10B981]" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        {procedure && (
                          <span className="text-[10px] text-[#64748B] block mt-0.5 group-hover:text-cyan-400 transition-colors">
                            {procedure}
                          </span>
                        )}
                      </td>

                      {/* Módulo */}
                      <td className="py-3 px-4 font-sans">
                        {getSourceBadge(batch.source)}
                      </td>

                      {/* Status + Prévia de Erro se houver */}
                      <td className="py-3 px-4">
                        <div>{getStatusBadge(batch.status)}</div>
                        {isError && batch.errorMessage && (
                          <span className="text-[10px] text-rose-400 block mt-1 truncate max-w-xs" title={batch.errorMessage}>
                            {batch.errorMessage}
                          </span>
                        )}
                      </td>

                      {/* Registros Recebidos + Inseridos / Atualizados */}
                      <td className="py-3 px-4">
                        <span className="text-[#F1F5F9] font-semibold">
                          {batch.recordsReceived.toLocaleString('pt-BR')} reg{batch.recordsReceived > 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] text-[#64748B] block font-sans">
                          +{batch.recordsInserted} novos • ~{batch.recordsUpdated} alt
                        </span>
                      </td>

                      {/* Duração */}
                      <td className="py-3 px-4">
                        {batch.durationMs !== null ? (
                          <span className={isSlow ? 'text-[#F59E0B]' : 'text-[#10B981] font-semibold'}>
                            {batch.durationMs >= 1000 ? `${(batch.durationMs / 1000).toFixed(2)}s` : `${batch.durationMs}ms`}
                          </span>
                        ) : (
                          <span className="text-[#64748B]">—</span>
                        )}
                      </td>

                      {/* Recebido em */}
                      <td className="py-3 px-4 text-[#94A3B8]">
                        {formatSPTime(batch.receivedAt)}
                      </td>

                      {/* Ação */}
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => setSelectedBatch(batch)}
                          className="px-3 py-1 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#1E293B] text-[11px] font-semibold transition-all cursor-pointer"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. PAGINAÇÃO AVANÇADA */}
        <div className="p-4 border-t border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#94A3B8] font-sans">
          <span>
            Página <strong className="text-[#F1F5F9] font-mono">{pagination.page}</strong> de{' '}
            <strong className="text-[#F1F5F9] font-mono">{pagination.totalPages}</strong> ({pagination.total.toLocaleString('pt-BR')} registros)
          </span>

          <div className="flex items-center gap-1.5 font-mono">
            {/* Primeira Página */}
            <button
              type="button"
              onClick={() => fetchBatches(1)}
              disabled={pagination.page <= 1 || loading}
              className="p-1.5 rounded-lg bg-[#151A2C] hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#1E293B] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              title="Primeira página"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>

            {/* Anterior */}
            <button
              type="button"
              onClick={() => fetchBatches(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#151A2C] hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#1E293B] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </button>

            {/* Próxima */}
            <button
              type="button"
              onClick={() => fetchBatches(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#151A2C] hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#1E293B] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
            >
              Próxima <ChevronRight className="h-3.5 w-3.5" />
            </button>

            {/* Última Página */}
            <button
              type="button"
              onClick={() => fetchBatches(pagination.totalPages)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="p-1.5 rounded-lg bg-[#151A2C] hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#1E293B] disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              title="Última página"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. MODAL DE AUDITORIA DETALHADA DO LOTE */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl border border-[#1E293B] bg-[#111729] p-6 shadow-2xl space-y-5 text-[#F1F5F9]">
            {/* Header do Modal */}
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#151A2C] text-[#3B82F6] border border-[#1E293B]">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#F1F5F9]">
                    Auditoria de Lote de Sincronização
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Extração determinística do banco WEBRI SQL
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="p-1.5 rounded-lg hover:bg-[#151A2C] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="space-y-3 text-xs">
              {/* UUID */}
              <div className="p-3 rounded-xl bg-[#151A2C] border border-[#1E293B] flex items-center justify-between">
                <span className="text-[#64748B]">Batch UUID:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[#F1F5F9] font-semibold select-all">
                    {selectedBatch.batchId}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedBatch.batchId)}
                    className="p-1 rounded hover:bg-[#1E293B] text-[#64748B] hover:text-[#F1F5F9]"
                  >
                    {copiedId === selectedBatch.batchId ? <Check className="h-3 w-3 text-[#10B981]" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>

              {/* Grid 2x3 de Metadados */}
              <div className="grid grid-cols-2 gap-2.5 font-mono">
                <div className="p-3 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                  <span className="text-[#64748B] font-sans block text-[10px] uppercase">Módulo / Origem</span>
                  <div className="mt-1">{getSourceBadge(selectedBatch.source)}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                  <span className="text-[#64748B] font-sans block text-[10px] uppercase">Status de Execução</span>
                  <div className="mt-1">{getStatusBadge(selectedBatch.status)}</div>
                </div>

                <div className="p-3 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                  <span className="text-[#64748B] font-sans block text-[10px] uppercase">Novos Registros Inseridos</span>
                  <span className="text-[#10B981] font-bold text-sm mt-0.5 block">
                    +{selectedBatch.recordsInserted.toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                  <span className="text-[#64748B] font-sans block text-[10px] uppercase">Registros Atualizados</span>
                  <span className="text-cyan-400 font-bold text-sm mt-0.5 block">
                    ~{selectedBatch.recordsUpdated.toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                  <span className="text-[#64748B] font-sans block text-[10px] uppercase">Duração de Ingestão</span>
                  <span className="text-[#F1F5F9] font-bold mt-0.5 block">
                    {selectedBatch.durationMs !== null ? `${selectedBatch.durationMs} ms` : 'Não registrado'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                  <span className="text-[#64748B] font-sans block text-[10px] uppercase flex items-center gap-1">
                    <Wifi className="h-3 w-3 text-[#64748B]" />
                    Latência de Rede (Upload)
                  </span>
                  <span className="text-[#F1F5F9] font-bold mt-0.5 block">
                    {getTransitLatencyMs(selectedBatch.generatedAt, selectedBatch.receivedAt)} ms
                  </span>
                </div>
              </div>

              {/* Procedure */}
              {MODULE_PROCEDURES[selectedBatch.source.toLowerCase()] && (
                <div className="p-3 rounded-xl bg-[#151A2C] border border-[#1E293B] flex items-center justify-between">
                  <span className="text-[#64748B]">Procedure SQL:</span>
                  <span className="font-mono text-cyan-400 font-semibold">
                    {MODULE_PROCEDURES[selectedBatch.source.toLowerCase()]}
                  </span>
                </div>
              )}

              {/* Timestamps de Trânsito */}
              <div className="p-3 rounded-xl bg-[#151A2C] border border-[#1E293B] space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-[#64748B]">
                  <span>Gerado no Servidor do Cartório:</span>
                  <span className="text-[#F1F5F9]">{formatSPTime(selectedBatch.generatedAt)}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Recebido na Nuvem (SaaS):</span>
                  <span className="text-[#F1F5F9]">{formatSPTime(selectedBatch.receivedAt)}</span>
                </div>
                {selectedBatch.processedAt && (
                  <div className="flex justify-between text-[#64748B]">
                    <span>Processado com Sucesso:</span>
                    <span className="text-[#10B981]">{formatSPTime(selectedBatch.processedAt)}</span>
                  </div>
                )}
              </div>

              {/* Mensagem de Erro (se houver) */}
              {selectedBatch.errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <span className="font-semibold block mb-1">Causa da Falha:</span>
                  <p className="font-mono text-[11px] select-all">{selectedBatch.errorMessage}</p>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="flex justify-end pt-3 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="px-4 py-2 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#F1F5F9] text-xs font-semibold border border-[#1E293B] transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

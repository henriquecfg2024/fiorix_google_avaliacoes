'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Info,
  Copy,
  Check,
  X,
} from 'lucide-react';

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
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function BatchAuditSection() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchBatches = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      });
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (modeFilter !== 'all') params.set('syncMode', modeFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/v1/operacoes/batches?${params.toString()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data: BatchesResponse = await res.json();
        setBatches(data.batches);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Erro ao buscar histórico de lotes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches(1);
  }, [sourceFilter, statusFilter, modeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBatches(1);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white/5 text-white/70 border border-white/10">{source}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Concluído
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" /> Parcial
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" /> Falha
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="h-3 w-3" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros e Busca */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-4 sm:p-5 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por ID do lote (UUID)..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/8 text-white placeholder-white/40 text-xs focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-95"
            >
              Buscar
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtro por Módulo */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/8 text-white text-xs focus:outline-none focus:border-blue-500/50"
            >
              <option value="all" className="bg-[#0B1020] text-white">Todos os Módulos</option>
              <option value="bi" className="bg-[#0B1020] text-white">Módulo BI</option>
              <option value="produtividade" className="bg-[#0B1020] text-white">Produtividade</option>
              <option value="metas" className="bg-[#0B1020] text-white">Metas</option>
              <option value="tarefas" className="bg-[#0B1020] text-white">Tarefas</option>
            </select>

            {/* Filtro por Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/8 text-white text-xs focus:outline-none focus:border-blue-500/50"
            >
              <option value="all" className="bg-[#0B1020] text-white">Todos os Status</option>
              <option value="completed" className="bg-[#0B1020] text-white">Concluídos</option>
              <option value="partial" className="bg-[#0B1020] text-white">Parciais</option>
              <option value="error" className="bg-[#0B1020] text-white">Erros</option>
            </select>

            {/* Filtro por Modo */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/8 text-white text-xs focus:outline-none focus:border-blue-500/50"
            >
              <option value="all" className="bg-[#0B1020] text-white">Todos os Modos</option>
              <option value="incremental" className="bg-[#0B1020] text-white">Incremental</option>
              <option value="full" className="bg-[#0B1020] text-white">Carga Completa (Full)</option>
            </select>

            <button
              type="button"
              onClick={() => fetchBatches(pagination.page)}
              disabled={loading}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/8 text-white/60 hover:text-white border border-white/8 transition-all disabled:opacity-40"
              title="Atualizar lista"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Auditoria de Lotes */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 shadow-xl backdrop-blur-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Registro Histórico de Lotes & Chunks
            </h3>
          </div>
          <span className="text-xs font-mono text-white/50">
            Total: <strong className="text-white font-semibold">{pagination.total}</strong> lotes indexados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-white/80">
            <thead>
              <tr className="border-b border-white/8 text-[11px] uppercase tracking-wider text-white/40 font-semibold bg-white/[0.01]">
                <th className="py-3 px-4 font-medium">Lote / Batch ID</th>
                <th className="py-3 px-4 font-medium">Módulo</th>
                <th className="py-3 px-4 font-medium">Modo</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Registros</th>
                <th className="py-3 px-4 font-medium">Chunks</th>
                <th className="py-3 px-4 font-medium">Duração</th>
                <th className="py-3 px-4 font-medium">Recebido em</th>
                <th className="py-3 px-4 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-white/40 font-sans">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-400" />
                    Carregando histórico de lotes...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-white/40 font-sans">
                    Nenhum lote encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => {
                  const receivedDate = new Date(batch.receivedAt);
                  return (
                    <tr key={batch.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* ID do Lote com Cópia */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/90 font-semibold">
                            {batch.batchId.substring(0, 8)}...
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(batch.batchId)}
                            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                            title="Copiar UUID completo"
                          >
                            {copiedId === batch.batchId ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Módulo */}
                      <td className="py-3 px-4 font-sans">
                        {getSourceBadge(batch.source)}
                      </td>

                      {/* Modo */}
                      <td className="py-3 px-4">
                        <span className="text-[10px] uppercase font-semibold text-white/60 bg-white/5 px-2 py-0.5 rounded border border-white/6">
                          {batch.syncMode}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(batch.status)}
                      </td>

                      {/* Registros */}
                      <td className="py-3 px-4 font-semibold text-white">
                        {batch.recordsReceived.toLocaleString('pt-BR')}
                      </td>

                      {/* Chunks */}
                      <td className="py-3 px-4 text-white/60">
                        {batch.chunksReceived} / {batch.chunkCount}
                      </td>

                      {/* Duração */}
                      <td className="py-3 px-4">
                        {batch.durationMs !== null ? (
                          <span className={batch.durationMs > 3000 ? 'text-amber-400' : 'text-emerald-400 font-semibold'}>
                            {batch.durationMs >= 1000 ? `${(batch.durationMs / 1000).toFixed(1)}s` : `${batch.durationMs}ms`}
                          </span>
                        ) : (
                          <span className="text-white/40">-</span>
                        )}
                      </td>

                      {/* Data/Hora de Recebimento */}
                      <td className="py-3 px-4 text-white/60">
                        {receivedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                        {receivedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>

                      {/* Ação: Ver Detalhes */}
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => setSelectedBatch(batch)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-blue-600/20 text-white/70 hover:text-blue-300 border border-white/8 hover:border-blue-500/30 text-[11px] font-semibold transition-all"
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

        {/* Paginação */}
        <div className="p-4 border-t border-white/8 flex items-center justify-between text-xs text-white/60 font-sans">
          <span>
            Página <strong className="text-white">{pagination.page}</strong> de{' '}
            <strong className="text-white">{pagination.totalPages}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchBatches(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/8 text-white/80 hover:text-white border border-white/8 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </button>
            <button
              type="button"
              onClick={() => fetchBatches(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/8 text-white/80 hover:text-white border border-white/8 disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              Próxima <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Lote */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0B1020] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Detalhes do Lote de Sincronização
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-sans">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6 flex items-center justify-between">
                <span className="text-white/50">UUID do Lote:</span>
                <span className="font-mono text-white font-semibold select-all">
                  {selectedBatch.batchId}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6">
                  <span className="text-white/50 block text-[11px]">Módulo / Fonte</span>
                  <div className="mt-1">{getSourceBadge(selectedBatch.source)}</div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6">
                  <span className="text-white/50 block text-[11px]">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedBatch.status)}</div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6">
                  <span className="text-white/50 block text-[11px]">Modo de Envio</span>
                  <span className="font-mono text-white font-bold uppercase mt-1 block">
                    {selectedBatch.syncMode}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6">
                  <span className="text-white/50 block text-[11px]">Duração de Ingestão</span>
                  <span className="font-mono text-white font-bold mt-1 block">
                    {selectedBatch.durationMs !== null ? `${selectedBatch.durationMs} ms` : 'Não registrado'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6">
                  <span className="text-white/50 block text-[11px]">Registros Recebidos</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm mt-1 block">
                    {selectedBatch.recordsReceived.toLocaleString('pt-BR')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6">
                  <span className="text-white/50 block text-[11px]">Chunks Processados</span>
                  <span className="font-mono text-white font-bold mt-1 block">
                    {selectedBatch.chunksReceived} de {selectedBatch.chunkCount}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-white/60">
                  <span>Gerado no Cartório:</span>
                  <span className="text-white">{new Date(selectedBatch.generatedAt).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Recebido no SaaS:</span>
                  <span className="text-white">{new Date(selectedBatch.receivedAt).toLocaleString('pt-BR')}</span>
                </div>
                {selectedBatch.processedAt && (
                  <div className="flex justify-between text-white/60">
                    <span>Processado em:</span>
                    <span className="text-white">{new Date(selectedBatch.processedAt).toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>

              {selectedBatch.errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <span className="font-semibold block mb-1">Mensagem de Erro:</span>
                  <p className="font-mono text-[11px]">{selectedBatch.errorMessage}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
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

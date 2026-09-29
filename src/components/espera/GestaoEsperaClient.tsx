'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Clock3,
  CheckCircle2,
  AlertTriangle,
  Users,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  Search,
  Timer,
  Layers,
  TrendingUp,
  BarChart3,
  Settings,
  Radio,
  Activity,
  ArrowUpDown,
  Loader2,
  XCircle,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
type Periodo = 'hoje' | '7d' | 'mes';
type Aba = 'visao_geral' | 'dentro_sla' | 'fora_sla' | 'atendimentos';

interface SenhaRecord {
  id: string;
  senha: string;
  servico: string;
  fila: string;
  emissao: string;
  chamada: string;
  tempoEsperaMin: number | null;
  guiche: string;
  atendente: string;
  situacao: string;
}

interface Props {
  isAdmin?: boolean;
  isConfigured?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function GestaoEsperaClient({ isAdmin = false, isConfigured = true }: Props) {
  const [configured, setConfigured] = useState(isConfigured);
  const [periodo, setPeriodo] = useState<Periodo>('hoje');
  const [activeAba, setActiveAba] = useState<Aba>('visao_geral');
  const [filtroServico, setFiltroServico] = useState('');
  const [filtroFila, setFiltroFila] = useState('');
  const [filtroAtendente, setFiltroAtendente] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Sincronizar com prop do servidor quando alterar
  useEffect(() => {
    setConfigured(isConfigured);
  }, [isConfigured]);

  // Estado de dados reais
  const [allRecords, setAllRecords] = useState<SenhaRecord[]>([]);
  const [slaMinutes, setSlaMinutes] = useState(15);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [siteLabel, setSiteLabel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Buscar dados reais da API
  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setApiError(null);

    try {
      const res = await fetch(`/api/v1/espera/senhas?periodo=${periodo}`);
      const data = await res.json();

      if (data.configured === false) {
        setConfigured(false);
      } else if (data.configured === true || (data.records && res.ok)) {
        setConfigured(true);
      }

      if (!res.ok) {
        setApiError(data.error || 'Erro ao carregar dados.');
        setAllRecords([]);
        return;
      }

      if (data.error && data.records?.length === 0) {
        setApiError(data.error);
      }

      setAllRecords(data.records || []);
      setSlaMinutes(data.slaMinutes || 15);
      setLastSyncAt(data.lastSyncAt || null);
      setSiteLabel(data.siteLabel || null);
    } catch {
      setApiError('Erro de rede ao conectar com o servidor.');
      setAllRecords([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [periodo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cálculos derivados dos dados reais
  const recordsWithWait = useMemo(() => allRecords.filter((r) => r.tempoEsperaMin !== null), [allRecords]);
  const dentroSla = useMemo(() => recordsWithWait.filter((r) => (r.tempoEsperaMin || 0) <= slaMinutes), [recordsWithWait, slaMinutes]);
  const foraSla = useMemo(() => recordsWithWait.filter((r) => (r.tempoEsperaMin || 0) > slaMinutes), [recordsWithWait, slaMinutes]);

  const tempoMedio = useMemo(() => {
    if (recordsWithWait.length === 0) return 0;
    return Math.round(recordsWithWait.reduce((acc, r) => acc + (r.tempoEsperaMin || 0), 0) / recordsWithWait.length);
  }, [recordsWithWait]);

  const percDentroSla = useMemo(() => {
    if (recordsWithWait.length === 0) return 0;
    return Math.round((dentroSla.length / recordsWithWait.length) * 1000) / 10;
  }, [recordsWithWait, dentroSla]);

  // Contadores por situação (usa valores reais do NextQS, sem traduzir)
  const countBySituacao = useCallback((situacao: string) => {
    return allRecords.filter((r) => r.situacao.toLowerCase() === situacao.toLowerCase()).length;
  }, [allRecords]);

  // Filtros derivados dos dados reais
  const filterRecords = (records: SenhaRecord[]) => {
    let filtered = records;
    if (filtroServico) filtered = filtered.filter((r) => r.servico === filtroServico);
    if (filtroFila) filtered = filtered.filter((r) => r.fila === filtroFila);
    if (filtroAtendente) filtered = filtered.filter((r) => r.atendente === filtroAtendente);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) => r.senha.toLowerCase().includes(q) || r.atendente.toLowerCase().includes(q) || r.servico.toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  const servicosUnicos = useMemo(() => [...new Set(allRecords.map((r) => r.servico).filter((s) => s !== '—'))].sort(), [allRecords]);
  const filasUnicas = useMemo(() => [...new Set(allRecords.map((r) => r.fila).filter((f) => f !== '—'))].sort(), [allRecords]);
  const atendentesUnicos = useMemo(() => [...new Set(allRecords.map((r) => r.atendente).filter((a) => a !== '—'))].sort(), [allRecords]);

  const abas: { key: Aba; label: string }[] = [
    { key: 'visao_geral', label: 'Visão geral' },
    { key: 'dentro_sla', label: `Dentro do SLA (${dentroSla.length})` },
    { key: 'fora_sla', label: `Fora do SLA (${foraSla.length})` },
    { key: 'atendimentos', label: `Todos (${allRecords.length})` },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // ESTADO VAZIO: NextQS não configurado
  // ─────────────────────────────────────────────────────────────────────────
  if (!configured) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-amber-500/8 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
        <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
          <div className="pb-4 border-b border-white/8">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              <Clock3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>GESTÃO DE PRAZOS · NEXTQS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Gestão de Espera</h1>
            <p className="text-xs text-white/50 mt-1">Acompanhe o tempo de espera, o desempenho do atendimento e os indicadores da recepção.</p>
          </div>
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="max-w-lg w-full rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-10 text-center space-y-6 shadow-2xl">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Layers className="w-8 h-8 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-white">Integração NextQS não configurada</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Conecte o NextQS para visualizar os indicadores e relatórios de espera da sua organização.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fetchData()}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Verificando...' : 'Verificar conexão'}</span>
                </button>
                {isAdmin && (
                  <a href="/configuracoes/parametros?tab=integracoes"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95">
                    <Settings className="w-4 h-4" /><span>Configurar integração</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TABELA DE SENHAS (dados reais)
  // ─────────────────────────────────────────────────────────────────────────
  const renderSenhasTable = (records: SenhaRecord[]) => {
    const filtered = filterRecords(records);
    const sorted = [...filtered].sort((a, b) => {
      const aWait = a.tempoEsperaMin ?? 0;
      const bWait = b.tempoEsperaMin ?? 0;
      return sortDir === 'desc' ? bWait - aWait : aWait - bWait;
    });

    if (sorted.length === 0) {
      return (
        <div className="py-12 text-center text-slate-500 text-xs rounded-xl border border-white/6 bg-white/[0.02]">
          Nenhuma senha encontrada para os filtros e período selecionados.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Buscar por senha, atendente ou serviço..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-white/15 bg-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all" />
          </div>
          <button type="button" onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{sortDir === 'desc' ? 'Maior espera primeiro' : 'Menor espera primeiro'}</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
              <tr>
                <th className="py-3 px-4">Senha</th>
                <th className="py-3 px-3">Serviço</th>
                <th className="py-3 px-3">Fila</th>
                <th className="py-3 px-3">Emissão</th>
                <th className="py-3 px-3">Chamada</th>
                <th className="py-3 px-3 text-right">Espera</th>
                <th className="py-3 px-3">Guichê</th>
                <th className="py-3 px-3">Atendente</th>
                <th className="py-3 px-4">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-slate-300">
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-bold text-white font-mono">{r.senha}</td>
                  <td className="py-3 px-3">{r.servico}</td>
                  <td className="py-3 px-3">
                    {r.fila !== '—' ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10">{r.fila}</span>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400">{r.emissao}</td>
                  <td className="py-3 px-3 font-mono text-slate-400">{r.chamada}</td>
                  <td className="py-3 px-3 text-right">
                    {r.tempoEsperaMin !== null ? (
                      <span className={`font-bold font-mono ${r.tempoEsperaMin <= slaMinutes ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {r.tempoEsperaMin} min
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-3 font-mono">{r.guiche}</td>
                  <td className="py-3 px-3 text-white">{r.atendente}</td>
                  <td className="py-3 px-4">
                    {r.situacao !== '—' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-slate-300">
                        {r.situacao}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-slate-500 text-right">{sorted.length} de {records.length} registros</div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDERIZAÇÃO PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-amber-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              <Clock3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>GESTÃO DE PRAZOS · NEXTQS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Gestão de Espera</h1>
            <p className="text-xs text-white/50 mt-1">
              Dados reais da integração NextQS{siteLabel ? ` · Unidade: ${siteLabel}` : ''} — isolados por organização.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-0.5 bg-white/[0.03] border border-white/10 rounded-xl">
              {([
                { key: 'hoje' as Periodo, label: 'Hoje' },
                { key: '7d' as Periodo, label: '7 dias' },
                { key: 'mes' as Periodo, label: 'Mês' },
              ]).map((p) => (
                <button key={p.key} type="button" onClick={() => setPeriodo(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    periodo === p.key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:text-white'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>

            {lastSyncAt && (
              <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-emerald-400" />
                Sinc.: {new Date(lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            <button type="button" onClick={() => fetchData(true)} disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-40">
              {isRefreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-xs text-slate-400">Consultando NextQS...</span>
            </div>
          </div>
        )}

        {/* Erro da API */}
        {!isLoading && apiError && allRecords.length === 0 && (
          <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-amber-300">Não foi possível obter dados</h3>
            </div>
            <p className="text-xs text-amber-200/70">{apiError}</p>
            {isAdmin && (
              <a href="/configuracoes/parametros?tab=integracoes"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all">
                <Settings className="w-3.5 h-3.5" /><span>Verificar configuração</span>
              </a>
            )}
          </div>
        )}

        {/* Conteúdo com dados reais */}
        {!isLoading && (
          <>
            {/* Filtros */}
            {allRecords.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="font-semibold">Filtros:</span>
                </div>
                {servicosUnicos.length > 0 && (
                  <select value={filtroServico} onChange={(e) => setFiltroServico(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer">
                    <option value="">Todos os Serviços</option>
                    {servicosUnicos.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {filasUnicas.length > 0 && (
                  <select value={filtroFila} onChange={(e) => setFiltroFila(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer">
                    <option value="">Todas as Filas</option>
                    {filasUnicas.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                )}
                {atendentesUnicos.length > 0 && (
                  <select value={filtroAtendente} onChange={(e) => setFiltroAtendente(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/60 cursor-pointer">
                    <option value="">Todos os Atendentes</option>
                    {atendentesUnicos.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                )}
                {(filtroServico || filtroFila || filtroAtendente) && (
                  <button type="button" onClick={() => { setFiltroServico(''); setFiltroFila(''); setFiltroAtendente(''); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer">
                    Limpar filtros
                  </button>
                )}
              </div>
            )}

            {/* Cards KPI — calculados com dados reais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 space-y-3 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full pointer-events-none -mr-6 -mt-6" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Dentro do SLA (≤{slaMinutes} min)</span>
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-emerald-400 font-mono">{recordsWithWait.length > 0 ? `${percDentroSla}%` : '—'}</span>
                  {recordsWithWait.length > 0 && <span className="text-xs text-slate-400 mb-1">{dentroSla.length} senhas</span>}
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 space-y-3 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full pointer-events-none -mr-6 -mt-6" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tempo médio de espera</span>
                  <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20"><Timer className="w-4 h-4 text-blue-400" /></div>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-white font-mono">{recordsWithWait.length > 0 ? tempoMedio : '—'}</span>
                  {recordsWithWait.length > 0 && <span className="text-xs text-slate-400 mb-1">minutos</span>}
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 space-y-3 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full pointer-events-none -mr-6 -mt-6" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Senhas fora do SLA</span>
                  <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20"><AlertTriangle className="w-4 h-4 text-rose-400" /></div>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-rose-400 font-mono">{recordsWithWait.length > 0 ? foraSla.length : '—'}</span>
                  {recordsWithWait.length > 0 && <span className="text-xs text-slate-400 mb-1">senhas &gt;{slaMinutes} min</span>}
                </div>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 space-y-3 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full pointer-events-none -mr-6 -mt-6" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total de registros</span>
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20"><Users className="w-4 h-4 text-indigo-400" /></div>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-white font-mono">{allRecords.length}</span>
                  <span className="text-xs text-slate-400 mb-1">senhas</span>
                </div>
              </div>
            </div>

            {/* Abas */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-white/8 pb-2 overflow-x-auto">
              {abas.map((a) => (
                <button key={a.key} type="button" onClick={() => setActiveAba(a.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeAba === a.key
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border border-indigo-500/30'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}>
                  {a.label}
                </button>
              ))}
            </div>

            {/* Conteúdo da aba */}
            <div className="animate-in fade-in duration-200">
              {activeAba === 'visao_geral' && (
                <div className="space-y-6">
                  {allRecords.length > 0 && (
                    <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-400" />
                        <h3 className="text-sm font-bold text-white">Últimas Senhas Processadas</h3>
                        <span className="text-[10px] text-slate-500 font-mono">({allRecords.length} registros reais)</span>
                      </div>
                      {renderSenhasTable(allRecords.slice(0, 50))}
                    </div>
                  )}

                  {allRecords.length === 0 && !apiError && (
                    <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-10 shadow-xl text-center space-y-4">
                      <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-500/10 border border-white/10 flex items-center justify-center">
                        <Clock3 className="w-6 h-6 text-slate-500" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white">Nenhuma senha encontrada</h3>
                        <p className="text-xs text-slate-400">Nenhuma senha encontrada para o período selecionado. Tente alterar o filtro de período ou aguarde a próxima sincronização.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeAba === 'dentro_sla' && (
                <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Senhas Dentro do SLA (≤ {slaMinutes} min)</h3>
                    <span className="text-xs text-emerald-400 font-mono font-bold">{dentroSla.length} registros</span>
                  </div>
                  {renderSenhasTable(dentroSla)}
                </div>
              )}

              {activeAba === 'fora_sla' && (
                <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <h3 className="text-sm font-bold text-white">Senhas Fora do SLA (&gt; {slaMinutes} min)</h3>
                    <span className="text-xs text-rose-400 font-mono font-bold">{foraSla.length} registros</span>
                  </div>
                  {renderSenhasTable(foraSla)}
                </div>
              )}

              {activeAba === 'atendimentos' && (
                <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Todos os Registros</h3>
                    <span className="text-xs text-slate-400 font-mono font-bold">{allRecords.length} registros</span>
                  </div>
                  {renderSenhasTable(allRecords)}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Printer, BookOpen, Calendar, Filter, Download, MoreVertical,
  RotateCw, Search, CheckCircle2, AlertCircle, MinusCircle,
  SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronRight,
  Info, FileSpreadsheet, User, Users, Award
} from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_CONTROLE_IMPRESSOES } from '@/lib/controle-impressoes/mock-data';
import { StatusImpressaoItem, ImpressaoItemRow, ControleImpressoesData } from '@/types/controle-impressoes';

export function ControleImpressoesClient() {
  const [data, setData] = useState<ControleImpressoesData>(MOCK_CONTROLE_IMPRESSOES);
  const [loading, setLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  // Filters State
  const [visao, setVisao] = useState<'demanda' | 'producao'>('demanda');
  const [dataPreset, setDataPreset] = useState<'hoje' | 'ontem' | '7dias' | 'mesAtual' | 'mesAnterior' | 'personalizado'>('7dias');
  const [dataInicio, setDataInicio] = useState('2026-08-01');
  const [dataFim, setDataFim] = useState('2026-09-21');
  const [buscaNatureza, setBuscaNatureza] = useState('');
  const [tipoImpressaoFiltro, setTipoImpressaoFiltro] = useState<'todos' | 'certidao' | 'livro'>('todos');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'realizado'>('todos');
  const [activeCardLabel, setActiveCardLabel] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Fetch from Real API
  const fetchDados = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        dataInicio,
        dataFim,
        visao,
        busca: buscaNatureza,
        tipoImpressao: tipoImpressaoFiltro,
        status: statusFiltro,
        page: String(currentPage),
        pageSize: String(pageSize),
      });

      const res = await fetch(`/api/controle-impressoes?${params.toString()}`);
      if (res.ok) {
        const liveData = await res.json();
        if (liveData && liveData.itens) {
          setData(liveData);
        }
      }
    } catch (err) {
      console.warn('Fallback para mock devido a erro na API:', err);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, visao, buscaNatureza, tipoImpressaoFiltro, statusFiltro, currentPage, pageSize]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  // Adjust dates based on preset
  const handlePresetChange = (preset: typeof dataPreset) => {
    setDataPreset(preset);
    const now = new Date();
    const toYmd = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'hoje') {
      setDataInicio(toYmd(now));
      setDataFim(toYmd(now));
    } else if (preset === 'ontem') {
      const ontem = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      setDataInicio(toYmd(ontem));
      setDataFim(toYmd(ontem));
    } else if (preset === '7dias') {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDataInicio(toYmd(d7));
      setDataFim(toYmd(now));
    } else if (preset === 'mesAtual') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setDataInicio(toYmd(firstDay));
      setDataFim(toYmd(now));
    } else if (preset === 'mesAnterior') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      setDataInicio(toYmd(firstDayPrev));
      setDataFim(toYmd(lastDayPrev));
    }
    setCurrentPage(1);
  };

  const totalPages = Math.ceil((data.totalRegistros || 1) / pageSize) || 1;
  const paginatedRows = data.itens;

  const operadoresLivro = (data.operadores || [])
    .filter((op) => op.totalLivro > 0)
    .sort((a, b) => b.totalLivro - a.totalLivro);

  const operadoresCertidao = (data.operadores || [])
    .filter((op) => op.totalCertidao > 0)
    .sort((a, b) => b.totalCertidao - a.totalCertidao);

  const handleExport = (tipo = 'pendencias') => {
    toast.success(`Exportação de ${tipo} iniciada`, {
      description: `Planilha gerada com ${data.totalRegistros} registros selecionados.`,
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
    });
  };

  const limparFiltros = () => {
    setBuscaNatureza('');
    setStatusFiltro('todos');
    setTipoImpressaoFiltro('todos');
    setActiveCardLabel(null);
    setDataPreset('7dias');
    toast.success('Filtros restaurados para o padrão.');
  };

  // Handler para clique nos cards — filtra a tabela
  const handleCardClick = (
    tipo: 'livro' | 'certidao' | 'todos',
    status: 'todos' | 'pendente' | 'realizado',
    label: string
  ) => {
    const isSameFilter = tipoImpressaoFiltro === tipo && statusFiltro === status;
    if (isSameFilter) {
      // Segundo clique desfaz o filtro
      setTipoImpressaoFiltro('todos');
      setStatusFiltro('todos');
      setActiveCardLabel(null);
    } else {
      setTipoImpressaoFiltro(tipo === 'todos' ? 'todos' : tipo);
      setStatusFiltro(status);
      setActiveCardLabel(label);
      setCurrentPage(1);
      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
  };


  return (
    <div className="space-y-6">
      {/* ────────────────── TOP BAR / HEADER DO RELATÓRIO ────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>Gestão de Prazos</span>
            <span className="text-slate-600">&gt;</span>
            <span className="text-white font-semibold">Impressões</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mt-1">
            Controle de Impressões
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Painel de produtividade das impressões com base na data do último registro e data das impressões realizadas.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => toast.info('Filtros avançados', { description: 'Opções de visualização já expandidas no painel abaixo.' })}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#141B2D] hover:bg-[#1A233A] border border-white/10 text-xs font-medium text-slate-200 transition-colors shadow-sm"
          >
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filtros</span>
          </button>
          <button
            onClick={() => handleExport('relatório completo')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#141B2D] hover:bg-[#1A233A] border border-white/10 text-xs font-medium text-slate-200 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Exportar</span>
          </button>
          <button
            onClick={() => toast('Menu de opções', { description: 'Opções de visualização e layout.' })}
            className="p-2 rounded-lg bg-[#141B2D] hover:bg-[#1A233A] border border-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Banner discreto */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-[#0E1526]/80 border border-blue-500/20 text-xs">
        <div className="flex items-center gap-2 text-blue-300">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            Base principal do relatório: <strong className="font-semibold text-white">Data do Último Registro</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <span>Atualizado em: {data.ultimaSincronizacao}</span>
          <button
            onClick={() => {
              fetchDados();
              toast.success('Dados atualizados com sucesso');
            }}
            className="p-1 hover:text-white transition-colors"
            title="Recarregar dados"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ────────────────── BARRA DE FILTROS ────────────────── */}
      <div className="p-5 rounded-2xl bg-[#0c1222]/90 border border-white/10 backdrop-blur-md space-y-4 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Período */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Período do Último Registro
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#141B2D] border border-white/10 text-xs text-white shadow-inner">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setDataPreset('personalizado');
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer w-28 text-xs font-medium"
              />
              <span className="text-slate-400 text-xs font-medium">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setDataPreset('personalizado');
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer w-28 text-xs font-medium"
              />
              <Calendar className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
            </div>
          </div>

          {/* Visão */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Visão
            </label>
            <div className="flex p-1 rounded-lg bg-[#141B2D] border border-white/10 text-xs shadow-inner">
              <button
                onClick={() => setVisao('demanda')}
                className={`flex-1 py-1.5 px-2.5 rounded-md font-semibold transition-all ${
                  visao === 'demanda'
                    ? 'bg-[#5b21b6] text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Demanda (Último Reg.)
              </button>
              <button
                onClick={() => setVisao('producao')}
                className={`flex-1 py-1.5 px-2.5 rounded-md font-semibold transition-all ${
                  visao === 'producao'
                    ? 'bg-[#5b21b6] text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Produção (Data Impr.)
              </button>
            </div>
          </div>

          {/* Tipo / Natureza / Protocolo / Livro */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Buscar Protocolo / Livro / Natureza
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: 644377, MAT, Escritura..."
                value={buscaNatureza}
                onChange={(e) => setBuscaNatureza(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetchDados();
                  }
                }}
                className="w-full px-3.5 py-2 pl-9 rounded-lg bg-[#141B2D] border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Tipo de Impressão */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Impressão
            </label>
            <select
              value={tipoImpressaoFiltro}
              onChange={(e) => setTipoImpressaoFiltro(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg bg-[#141B2D] border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer shadow-inner"
            >
              <option value="todos">Todos os tipos</option>
              <option value="certidao">Certidão de Registro</option>
              <option value="livro">Ato no Livro</option>
            </select>
          </div>

          {/* Status + Ações */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Status
            </label>
            <div className="flex gap-2">
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-[#141B2D] border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer shadow-inner"
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="realizado">Realizado</option>
              </select>
              <button
                onClick={() => {
                  fetchDados();
                  toast.success('Filtros aplicados com sucesso.');
                }}
                className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-xs font-bold text-white whitespace-nowrap transition-all shadow-md shadow-indigo-500/25 active:scale-95"
              >
                Filtrar
              </button>
            </div>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex items-center justify-between pt-3 border-t border-white/8 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {(['hoje', 'ontem', '7dias', 'mesAtual', 'mesAnterior', 'personalizado'] as const).map((preset) => {
              const labels = {
                hoje: 'Hoje',
                ontem: 'Ontem',
                '7dias': 'Últimos 7 dias',
                mesAtual: 'Mês atual',
                mesAnterior: 'Mês anterior',
                personalizado: 'Personalizado'
              };
              const active = dataPreset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => handlePresetChange(preset)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-[#3b1578] text-purple-100 border border-purple-400/50 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          <button
            onClick={limparFiltros}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Limpar filtros</span>
          </button>
        </div>
      </div>

      {/* ────────────────── 2 COLUNAS DE FLUXO (LIVRO E CERTIDÃO) COM SEUS RESPECTIVOS OPERADORES ────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        {/* COLUNA 1: FLUXO DO LIVRO (ÂMBAR) */}
        <div className="flex flex-col gap-4">
          {/* CARD 1: IMPRESSÃO DEFINITIVA DO ATO NO LIVRO (ÂMBAR) */}
          <div className="rounded-2xl bg-[#171208]/90 border border-amber-500/35 p-6 shadow-xl shadow-amber-950/20 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shadow-inner">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-amber-400">
                    Impressão Definitiva do Ato no Livro
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Fluxo de impressão física dos atos no livro</p>
                </div>
              </div>
              <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 uppercase tracking-wider">
                Livro
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pb-4">
              {/* Demanda */}
              <div
                onClick={() => handleCardClick('livro', 'todos', 'Livro – Demanda total')}
                className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                  activeCardLabel === 'Livro – Demanda total'
                    ? 'bg-amber-500/10 border-amber-400/60 ring-1 ring-amber-400/40'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-amber-400/30'
                }`}
                title="Clique para filtrar por demanda"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Demanda</span>
                  <span className="text-[11px] text-slate-400 block truncate leading-tight">(Último Registro)</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight group-hover:text-amber-200 transition-colors">{data.livroStats.demanda}</span>
                  <span className="text-xs text-slate-400 font-medium">livros</span>
                </div>
              </div>

              {/* Produzidas */}
              <div
                onClick={() => handleCardClick('livro', 'realizado', 'Livro – Produzidas')}
                className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                  activeCardLabel === 'Livro – Produzidas'
                    ? 'bg-emerald-500/10 border-emerald-400/60 ring-1 ring-emerald-400/40'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-emerald-400/30'
                }`}
                title="Clique para filtrar por produzidas"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Produzidas</span>
                  <span className="text-[11px] text-slate-400 block truncate leading-tight">(Data Impressão)</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl xl:text-3xl font-extrabold text-amber-300 tracking-tight group-hover:text-emerald-300 transition-colors">{data.livroStats.produzidas}</span>
                  <span className="text-xs text-slate-400 font-medium">livros</span>
                </div>
              </div>

              {/* Pendências */}
              <div
                onClick={() => handleCardClick('livro', 'pendente', 'Livro – Pendências')}
                className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                  activeCardLabel === 'Livro – Pendências'
                    ? 'bg-rose-500/15 border-rose-400/60 ring-1 ring-rose-400/40'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-rose-400/30'
                }`}
                title="Clique para filtrar por pendências"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Pendências</span>
                  <span className="text-[11px] text-rose-400/90 block truncate leading-tight">(Saldo Atual)</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl xl:text-3xl font-extrabold text-rose-400 tracking-tight">{data.livroStats.pendencias}</span>
                  <span className="text-xs text-slate-400 font-medium">livros</span>
                </div>
              </div>

              {/* Saldo Operacional */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Saldo Operac.</span>
                  <span className="text-[11px] text-slate-400 block truncate leading-tight">(Prod. - Dem.)</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={`text-2xl xl:text-3xl font-extrabold tracking-tight ${data.livroStats.saldoOperacional >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {data.livroStats.saldoOperacional}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">livros</span>
                </div>
              </div>

              {/* Taxa de Atendimento */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Taxa Atend.</span>
                  <span className="text-[11px] text-slate-400 block truncate leading-tight">Eficiência</span>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight">{data.livroStats.taxaAtendimento}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-amber-950/80 rounded-full mt-2 overflow-hidden border border-amber-500/20">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, data.livroStats.taxaAtendimento)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tempo Médio */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Tempo Médio</span>
                  <span className="text-[11px] text-slate-400 block truncate leading-tight">para Impressão</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight">0,8</span>
                  <span className="text-xs text-slate-400 font-medium">dia</span>
                </div>
              </div>
            </div>

            <div className="pt-3.5 border-t border-white/10 text-xs text-slate-300 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Backlog início do período:</span>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 font-bold font-mono text-xs">
                  {data.livroStats.backlogInicio} livros
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Backlog final do período:</span>
                <span className="px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-300 font-bold font-mono text-xs">
                  {data.livroStats.backlogFinal} livros
                </span>
              </div>
            </div>
          </div>

          {/* CARD DE PRODUÇÃO DO OPERADOR DO LIVRO (ANTONIO) */}
          <div className="rounded-2xl bg-[#171208]/90 border border-amber-500/30 p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                  <User className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">Produção por Operador · Livro</h3>
                  <p className="text-[11px] text-slate-400">Atos impressos fisicamente no Livro no período</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/25">
                {operadoresLivro.length} {operadoresLivro.length === 1 ? 'operador' : 'operadores'}
              </span>
            </div>

            {operadoresLivro.length > 0 ? (
              <div className="space-y-2.5">
                {operadoresLivro.map((op) => {
                  const maxLivro = operadoresLivro[0]?.totalLivro || 1;
                  const pct = Math.round((op.totalLivro / maxLivro) * 100);
                  return (
                    <div key={op.nome} className="rounded-xl bg-white/[0.03] border border-amber-500/15 p-3.5 flex flex-col gap-2.5 hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-amber-300" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{op.nome}</p>
                            <p className="text-[10px] text-slate-400">Operador de Impressão</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black font-mono text-amber-300">{op.totalLivro}</span>
                          <span className="text-[10px] text-slate-400 block -mt-1 font-medium">atos impressos</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-amber-950/60 rounded-full overflow-hidden border border-amber-500/20">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400">
                Nenhum ato impresso no livro no período selecionado.
              </div>
            )}
          </div>
        </div>

        {/* COLUNA 2: FLUXO DA CERTIDÃO (CIANO) */}
        <div className="flex flex-col gap-4">
          {/* CARD 2: IMPRESSÃO DE CERTIDÃO DE REGISTRO (CIANO) */}
          <div className="rounded-2xl bg-[#0c1427]/90 border border-cyan-500/35 p-6 shadow-xl shadow-cyan-950/20 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-600" />
            
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-inner">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-cyan-400">
                    Impressão de Certidão de Registro
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Fluxo de emissão e controle das certidões</p>
                </div>
              </div>
              <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 uppercase tracking-wider">
                Certidão
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pb-4">
              {/* Demanda Certidão */}
              <div
                onClick={() => handleCardClick('certidao', 'todos', 'Certidão – Demanda total')}
                className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                  activeCardLabel === 'Certidão – Demanda total'
                    ? 'bg-cyan-500/10 border-cyan-400/60 ring-1 ring-cyan-400/40'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-cyan-400/30'
                }`}
                title="Clique para filtrar por demanda"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Demanda</span>
                  <span className="text-[11px] text-slate-400 block truncate leading-tight">(Último Registro)</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight group-hover:text-cyan-200 transition-colors">{data.certidaoStats.demanda}</span>
                  <span className="text-xs text-slate-400 font-medium">livros</span>
                </div>
              </div>

              {/* Produzidas Certidão */}
              <div
                onClick={() => handleCardClick('certidao', 'realizado', 'Certidão – Produzidas')}
                className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                  activeCardLabel === 'Certidão – Produzidas'
                    ? 'bg-emerald-500/10 border-emerald-400/60 ring-1 ring-emerald-400/40'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-emerald-400/30'
                }`}
                title="Clique para filtrar por produzidas"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Produzidas</span>
                  <span className="text-[11px] text-slate-400 block truncate leading-tight">(Data Impressão)</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl xl:text-3xl font-extrabold text-cyan-300 tracking-tight group-hover:text-emerald-300 transition-colors">{data.certidaoStats.produzidas}</span>
                  <span className="text-xs text-slate-400 font-medium">livros</span>
                </div>
              </div>

              {/* Pendências Certidão */}
              <div
                onClick={() => handleCardClick('certidao', 'pendente', 'Certidão – Pendências')}
                className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                  activeCardLabel === 'Certidão – Pendências'
                    ? 'bg-rose-500/15 border-rose-400/60 ring-1 ring-rose-400/40'
                    : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-rose-400/30'
                }`}
                title="Clique para filtrar por pendências"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Pendências</span>
                  <span className="text-[11px] text-rose-400/90 block truncate leading-tight">(Saldo Atual)</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl xl:text-3xl font-extrabold text-rose-400 tracking-tight">{data.certidaoStats.pendencias}</span>
                  <span className="text-xs text-slate-400 font-medium">livros</span>
                </div>
              </div>

              {/* Saldo Operacional */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Saldo Operac.</span>
                  <span className="text-[11px] text-slate-400 block truncate leading-tight">(Prod. - Dem.)</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className={`text-2xl xl:text-3xl font-extrabold tracking-tight ${data.certidaoStats.saldoOperacional >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {data.certidaoStats.saldoOperacional}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">livros</span>
                </div>
              </div>

              {/* Taxa de Atendimento */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Taxa Atend.</span>
                  <span className="text-[11px] text-slate-400 block truncate leading-tight">Eficiência</span>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight">{data.certidaoStats.taxaAtendimento}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-cyan-950/80 rounded-full mt-2 overflow-hidden border border-cyan-500/20">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, data.certidaoStats.taxaAtendimento)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tempo Médio */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">Tempo Médio</span>
                  <span className="text-[11px] text-slate-400 block truncate leading-tight">para Impressão</span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight">1,3</span>
                  <span className="text-xs text-slate-400 font-medium">dias</span>
                </div>
              </div>
            </div>

            <div className="pt-3.5 border-t border-white/10 text-xs text-slate-300 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Backlog início do período:</span>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 font-bold font-mono text-xs">
                  {data.certidaoStats.backlogInicio} livros
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Backlog final do período:</span>
                <span className="px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-300 font-bold font-mono text-xs">
                  {data.certidaoStats.backlogFinal} livros
                </span>
              </div>
            </div>
          </div>

          {/* CARD DE PRODUÇÃO DO OPERADOR DA CERTIDÃO (DAVID) */}
          <div className="rounded-2xl bg-[#0c1427]/90 border border-cyan-500/30 p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                  <User className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Produção por Operador · Certidão</h3>
                  <p className="text-[11px] text-slate-400">Certidões de Registro emitidas/preparadas no período</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-cyan-400/90 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/25">
                {operadoresCertidao.length} {operadoresCertidao.length === 1 ? 'operador' : 'operadores'}
              </span>
            </div>

            {operadoresCertidao.length > 0 ? (
              <div className="space-y-2.5">
                {operadoresCertidao.map((op) => {
                  const maxCertidao = operadoresCertidao[0]?.totalCertidao || 1;
                  const pct = Math.round((op.totalCertidao / maxCertidao) * 100);
                  return (
                    <div key={op.nome} className="rounded-xl bg-white/[0.03] border border-cyan-500/15 p-3.5 flex flex-col gap-2.5 hover:bg-white/[0.05] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-cyan-300" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{op.nome}</p>
                            <p className="text-[10px] text-slate-400">Operador de Certidões</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black font-mono text-cyan-300">{op.totalCertidao}</span>
                          <span className="text-[10px] text-slate-400 block -mt-1 font-medium">certidões emitidas</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-cyan-950/60 rounded-full overflow-hidden border border-cyan-500/20">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-600 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400">
                Nenhuma certidão emitida no período selecionado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────── TABELA DE SITUAÇÃO DAS IMPRESSÕES ────────────────── */}
      <div ref={tableRef} className="w-full rounded-2xl bg-[#0c1222]/90 border border-white/10 p-6 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 flex-wrap gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-100">
              Pendências e Situação das Impressões
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">(base: Data do Último Registro)</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-3 py-1 rounded-lg bg-slate-800/90 border border-white/15 text-xs text-slate-200 font-mono font-semibold">
              {data.totalRegistros} {data.totalRegistros === 1 ? 'registro' : 'registros'}
            </span>
            {activeCardLabel && (
              <div className="flex items-center gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-xs font-semibold">
                  Filtro: {activeCardLabel}
                </span>
                <button
                  onClick={() => { setTipoImpressaoFiltro('todos'); setStatusFiltro('todos'); setActiveCardLabel(null); }}
                  className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded border border-white/10 hover:bg-white/5 transition-colors"
                >
                  × Limpar
                </button>
              </div>
            )}
            <button
              onClick={() => toast.info('Personalizar colunas', { description: 'Todas as colunas essenciais estão visíveis.' })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141B2D] hover:bg-[#1A233A] border border-white/15 text-xs font-medium text-slate-200 transition-colors shadow-sm"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>Personalizar colunas</span>
            </button>
          </div>
        </div>

        {/* Tabela Responsiva com Distribuição Equilibrada */}
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full table-fixed text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-semibold text-slate-300">
                <th className="py-3 px-3.5 whitespace-nowrap w-[8%]">Protocolo</th>
                <th className="py-3 px-3.5 whitespace-nowrap w-[9%]">Nº Livro</th>
                <th className="py-3 px-3.5 whitespace-nowrap w-[14%]">Tipo / Natureza</th>
                <th className="py-3 px-3.5 whitespace-nowrap w-[8%]">Data Entrada</th>
                <th className="py-3 px-3.5 whitespace-nowrap w-[13%]">Etapa Atual</th>
                <th className="py-3 px-3.5 whitespace-nowrap w-[11%]">Último Registro</th>
                <th className="py-3 px-3.5 whitespace-nowrap w-[10%]">Certidão Registro</th>
                <th className="py-3 px-3.5 whitespace-nowrap w-[11%]">Impressão no Livro</th>
                <th className="py-3 px-3.5 whitespace-nowrap w-[10%]">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> Impresso por</span>
                </th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap w-[6%]">Dias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs sm:text-[13px]">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 text-sm font-medium">
                    Nenhum registro encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.04] transition-colors">
                    {/* Protocolo */}
                    <td className="py-3.5 px-3.5 font-mono font-bold text-white whitespace-nowrap text-sm">
                      {row.protocolo}
                    </td>

                    {/* Nº Livro */}
                    <td className="py-3.5 px-3.5 font-mono font-semibold text-slate-200 whitespace-nowrap text-xs sm:text-sm">
                      {row.numeroLivro}
                    </td>

                    {/* Tipo / Natureza Badge */}
                    <td className="py-3.5 px-3.5">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-[#221544] border border-purple-500/35 text-xs font-semibold text-purple-200 shadow-sm whitespace-nowrap">
                        {row.tipoNatureza}
                      </span>
                    </td>

                    {/* Data Entrada */}
                    <td className="py-3.5 px-3.5 font-mono text-xs text-slate-300 whitespace-nowrap">
                      {row.dataEntrada || '-'}
                    </td>

                    {/* Etapa Atual Badge */}
                    <td className="py-3.5 px-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-950/40 border border-cyan-500/25 text-cyan-200 shadow-sm whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 animate-pulse" />
                        {row.etapaAtual || 'Impressão'}
                      </span>
                    </td>

                    {/* Último Registro */}
                    <td className="py-3.5 px-3.5 font-mono text-xs text-slate-300 whitespace-nowrap">
                      {row.ultimoRegistro}
                    </td>

                    {/* Certidão Registro Status */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      {row.certidaoStatus === 'REALIZADO' && (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-emerald-300 text-xs sm:text-[13px]">Realizado</span>
                            {row.certidaoData && (
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{row.certidaoData}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {row.certidaoStatus === 'PENDENTE' && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold text-xs">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Pendente</span>
                        </div>
                      )}
                      {row.certidaoStatus === 'NAO_APLICAVEL' && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                          <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Não aplicável</span>
                        </div>
                      )}
                    </td>

                    {/* Impressão no Livro Status */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      {row.livroStatus === 'REALIZADO' && (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold text-emerald-300 text-xs sm:text-[13px]">Realizado</span>
                            {row.livroData && (
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{row.livroData}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {row.livroStatus === 'PENDENTE' && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold text-xs">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Pendente</span>
                        </div>
                      )}
                      {row.livroStatus === 'NAO_APLICAVEL' && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                          <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Não aplicável</span>
                        </div>
                      )}
                    </td>

                    {/* Impresso por */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      {(() => {
                        const resp = tipoImpressaoFiltro === 'certidao'
                          ? (row.certidaoResponsavel || row.livroResponsavel)
                          : (row.livroResponsavel || row.certidaoResponsavel);

                        if (!resp) return <span className="text-slate-600 text-xs">—</span>;

                        return (
                          <div className="flex flex-col gap-0.5" title={`Livro: ${row.livroResponsavel || '-'} | Certidão: ${row.certidaoResponsavel || '-'}`}>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                                <User className="w-2.5 h-2.5 text-violet-400" />
                              </div>
                              <span className="text-xs text-slate-200 truncate max-w-[120px] font-medium">
                                {resp}
                              </span>
                            </div>
                            {row.livroResponsavel && row.certidaoResponsavel && row.livroResponsavel !== row.certidaoResponsavel && tipoImpressaoFiltro === 'todos' && (
                              <span className="text-[10px] text-slate-400 pl-6 truncate max-w-[130px]">
                                Cert: {row.certidaoResponsavel}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Dias Pendente */}
                    <td className="py-3.5 px-3.5 text-center font-mono whitespace-nowrap">
                      {row.diasPendente > 0 ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs sm:text-[13px]">
                          {row.diasPendente}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs sm:text-[13px]">0</span>
                      )}
                    </td>
                  </tr>

                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10 text-xs sm:text-sm text-slate-300 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-400 font-medium">Linhas por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#141B2D] border border-white/15 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="font-mono text-slate-400">
            {data.totalRegistros === 0
              ? '0 de 0'
              : `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, data.totalRegistros)} de ${data.totalRegistros}`}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md bg-[#141B2D] border border-white/15 text-slate-300 hover:text-white hover:bg-[#1A233A] disabled:opacity-40 disabled:hover:bg-[#141B2D] transition-colors"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 rounded-md bg-[#6366f1] text-white font-bold text-xs font-mono shadow-sm">
              {currentPage}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md bg-[#141B2D] border border-white/15 text-slate-300 hover:text-white hover:bg-[#1A233A] disabled:opacity-40 disabled:hover:bg-[#141B2D] transition-colors"
              title="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

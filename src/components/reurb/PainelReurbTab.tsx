'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileJson,
  Layers,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ReurbConsultaFiltros,
  ReurbDataReferencia,
  ReurbModalidade,
  ReurbPainelDTO,
  ReurbRegularizacaoResumo,
  ReurbSituacaoValidacao,
} from '@/lib/reurb/types';
import {
  buildAnosDisponiveis,
  filtrarProcessosPainel,
  formatarDataBr,
  gerarHtmlImpressaoPainel,
  hasActivePainelFilters,
  imprimirHtmlA4,
  INITIAL_PAINEL_COLUMN_FILTERS,
  labelModalidade,
  labelStatusImportacaoOnr,
  MESES_NOMES,
  type PainelColumnFilters,
} from './reurb-ui-helpers';

interface ConsultaResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  itens: ReurbRegularizacaoResumo[];
}

interface PainelReurbTabProps {
  filtros: ReurbConsultaFiltros;
  selectedIds: string[];
  canExportJson: boolean;
  isReadOnly: boolean;
  incluirArt69: boolean;
  generating: boolean;
  refreshKey: number;
  onUpdateFiltros: (patch: Partial<ReurbConsultaFiltros>) => void;
  onToggleSelect: (id: string) => void;
  onSelectMany: (ids: string[], checked: boolean) => void;
  onClearSelection: () => void;
  onToggleArt69: (checked: boolean) => void;
  onGerarLote: () => void;
  onOpenDetalhe: (id: string) => void;
}

export function PainelReurbTab({
  filtros,
  selectedIds,
  canExportJson,
  isReadOnly,
  incluirArt69,
  generating,
  refreshKey,
  onUpdateFiltros,
  onToggleSelect,
  onSelectMany,
  onClearSelection,
  onToggleArt69,
  onGerarLote,
  onOpenDetalhe,
}: PainelReurbTabProps) {
  const [painelData, setPainelData] = useState<ReurbPainelDTO | null>(null);
  const [painelLoading, setPainelLoading] = useState(true);
  const [painelError, setPainelError] = useState<string | null>(null);

  const [consultaData, setConsultaData] = useState<ConsultaResponse | null>(null);
  const [consultaLoading, setConsultaLoading] = useState(false);
  const [consultaError, setConsultaError] = useState<string | null>(null);

  const [buscaLocal, setBuscaLocal] = useState(filtros.busca || '');
  const [showAvancados, setShowAvancados] = useState(false);
  const [columnFilters, setColumnFilters] = useState<PainelColumnFilters>(
    INITIAL_PAINEL_COLUMN_FILTERS
  );
  const printCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      printCleanupRef.current?.();
      printCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    setBuscaLocal(filtros.busca || '');
  }, [filtros.busca]);

  const showKpis = filtros.ano !== null && !filtros.dataDe && !filtros.dataAte;

  const usaConsultaServidor =
    filtros.ano === null ||
    Boolean(filtros.dataDe) ||
    Boolean(filtros.dataAte) ||
    Boolean(filtros.busca?.trim()) ||
    Boolean(filtros.tipoData && filtros.tipoData !== 'registro') ||
    Boolean(filtros.modalidade && filtros.modalidade !== 'TODAS') ||
    Boolean(filtros.situacao && filtros.situacao !== 'TODAS');

  useEffect(() => {
    if (!showKpis || !filtros.ano) {
      setPainelData(null);
      setPainelLoading(false);
      setPainelError(null);
      return;
    }

    let cancelled = false;
    setPainelLoading(true);
    setPainelError(null);

    const qs = new URLSearchParams({
      ano: String(filtros.ano),
      mes: filtros.mes === 'todos' || !filtros.mes ? 'todos' : String(filtros.mes),
    });

    fetch(`/api/reurb/painel?${qs.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Falha ao carregar o Painel REURB.');
        return body as ReurbPainelDTO;
      })
      .then((payload) => {
        if (!cancelled) setPainelData(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setPainelError(err instanceof Error ? err.message : 'Erro ao consultar indicadores REURB.');
        }
      })
      .finally(() => {
        if (!cancelled) setPainelLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showKpis, filtros.ano, filtros.mes, refreshKey]);

  useEffect(() => {
    if (!usaConsultaServidor) {
      setConsultaData(null);
      setConsultaLoading(false);
      setConsultaError(null);
      return;
    }

    let cancelled = false;
    setConsultaLoading(true);
    setConsultaError(null);

    const qs = new URLSearchParams();
    if (filtros.dataDe) qs.set('dataDe', filtros.dataDe);
    if (filtros.dataAte) qs.set('dataAte', filtros.dataAte);
    if (filtros.ano) qs.set('ano', String(filtros.ano));
    else qs.set('ano', 'todos');
    if (filtros.mes === 'todos' || !filtros.mes) qs.set('mes', 'todos');
    else qs.set('mes', String(filtros.mes));
    if (filtros.tipoData) qs.set('tipoData', filtros.tipoData);
    if (filtros.busca) qs.set('busca', filtros.busca);
    if (filtros.modalidade && filtros.modalidade !== 'TODAS') {
      qs.set('modalidade', filtros.modalidade);
    }
    if (filtros.situacao && filtros.situacao !== 'TODAS') {
      qs.set('situacao', filtros.situacao);
    }
    qs.set('page', String(filtros.page || 1));
    qs.set('pageSize', String(filtros.pageSize || 50));

    fetch(`/api/reurb/processos?${qs.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Erro ao consultar processos REURB.');
        return body as ConsultaResponse;
      })
      .then((payload) => {
        if (!cancelled) setConsultaData(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setConsultaError(err instanceof Error ? err.message : 'Erro ao listar regularizações.');
        }
      })
      .finally(() => {
        if (!cancelled) setConsultaLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [usaConsultaServidor, filtros, refreshKey]);

  const anos = buildAnosDisponiveis(filtros.ano || new Date().getFullYear());
  const crossMonthItems =
    painelData?.derivadasPeriodoResumo.itens.filter((item) => item.deOutroMes) || [];

  const baseProcessos = useMemo(
    () => (usaConsultaServidor ? consultaData?.itens ?? [] : painelData?.processosPeriodo ?? []),
    [usaConsultaServidor, consultaData, painelData]
  );

  const processosFiltrados = useMemo(
    () => filtrarProcessosPainel(baseProcessos, columnFilters),
    [baseProcessos, columnFilters]
  );

  const tableLoading = usaConsultaServidor ? consultaLoading : painelLoading;
  const activeError = usaConsultaServidor ? consultaError : painelError;

  const filtrosColunaAtivos = hasActivePainelFilters(columnFilters);
  const qtdAvancadosAtivos = [
    filtros.tipoData && filtros.tipoData !== 'registro',
    filtros.modalidade && filtros.modalidade !== 'TODAS',
    filtros.situacao && filtros.situacao !== 'TODAS',
    Boolean(filtros.dataDe),
    Boolean(filtros.dataAte),
  ].filter(Boolean).length;

  const totalDerivadasFiltradas = useMemo(
    () => processosFiltrados.reduce((acc, item) => acc + item.qtdDerivadasLista, 0),
    [processosFiltrados]
  );

  const selectedSet = new Set(selectedIds);
  const filteredIds = processosFiltrados.map((item) => item.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id));

  const kpiAtivo =
    filtros.tipoData === 'abertura_derivada'
      ? 'derivadasAbertas'
      : filtros.situacao === 'APTO'
        ? 'aptas'
        : filtros.situacao === 'PENDENTE'
          ? 'pendencias'
          : 'registradas';

  function handleClearColumnFilters() {
    setColumnFilters(INITIAL_PAINEL_COLUMN_FILTERS);
  }

  function handleClearAvancados() {
    setBuscaLocal('');
    onUpdateFiltros({
      dataDe: null,
      dataAte: null,
      busca: null,
      tipoData: 'registro',
      modalidade: 'TODAS',
      situacao: 'TODAS',
      page: 1,
    });
  }

  function handleImprimirFiltrados() {
    if (processosFiltrados.length === 0) return;
    printCleanupRef.current?.();
    printCleanupRef.current = imprimirHtmlA4(
      gerarHtmlImpressaoPainel({
        ano: filtros.ano ?? null,
        mes: filtros.mes ?? 'todos',
        processos: processosFiltrados,
        totalPeriodo: usaConsultaServidor ? consultaData?.total ?? baseProcessos.length : baseProcessos.length,
        filters: columnFilters,
      })
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra unificada de Período, Busca rápida e Filtros avançados */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] p-4 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0">
            <div>
              <label htmlFor="reurb-painel-ano" className="block text-[11px] font-medium text-slate-400 mb-1">
                Ano
              </label>
              <select
                id="reurb-painel-ano"
                value={filtros.ano ? String(filtros.ano) : 'todos'}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateFiltros({
                    ano: val === 'todos' ? null : Number(val),
                    mes: val === 'todos' ? 'todos' : filtros.mes ?? 'todos',
                    dataDe: null,
                    dataAte: null,
                    page: 1,
                  });
                }}
                className="rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
              >
                <option value="todos">Todos os anos</option>
                {anos.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reurb-painel-mes" className="block text-[11px] font-medium text-slate-400 mb-1">
                Mês
              </label>
              <select
                id="reurb-painel-mes"
                value={filtros.mes === 'todos' || !filtros.mes ? 'todos' : String(filtros.mes)}
                disabled={filtros.ano === null}
                onChange={(e) =>
                  onUpdateFiltros({
                    mes: e.target.value === 'todos' ? 'todos' : Number(e.target.value),
                    dataDe: null,
                    dataAte: null,
                    page: 1,
                  })
                }
                className="rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none disabled:opacity-50"
              >
                <option value="todos">
                  {filtros.ano ? `Ano inteiro (${filtros.ano})` : 'Todos os meses'}
                </option>
                {MESES_NOMES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[240px] max-w-md">
              <label htmlFor="reurb-busca-rapida" className="block text-[11px] font-medium text-slate-400 mb-1">
                Busca (matriz, derivada, protocolo ou empreendimento)
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    id="reurb-busca-rapida"
                    type="text"
                    value={buscaLocal}
                    onChange={(e) => setBuscaLocal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onUpdateFiltros({ busca: buscaLocal.trim() || null, page: 1 });
                      }
                    }}
                    placeholder="Ex.: 268819, 644354, Crispin..."
                    className="w-full rounded-xl border border-white/15 bg-[#070A12] pl-8 pr-2.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateFiltros({ busca: buscaLocal.trim() || null, page: 1 })}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
                >
                  Filtrar
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAvancados((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
              showAvancados || qtdAvancadosAtivos > 0
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros avançados
            {qtdAvancadosAtivos > 0 && (
              <span className="rounded-full bg-cyan-500/25 px-1.5 py-0.5 text-[10px] font-bold text-cyan-100">
                {qtdAvancadosAtivos}
              </span>
            )}
          </button>
        </div>

        {showAvancados && (
          <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div>
              <label htmlFor="reurb-tipo-data" className="block text-[11px] text-slate-400 mb-1">
                Data de referência
              </label>
              <select
                id="reurb-tipo-data"
                value={filtros.tipoData || 'registro'}
                onChange={(e) =>
                  onUpdateFiltros({
                    tipoData: e.target.value as ReurbDataReferencia,
                    page: 1,
                  })
                }
                className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
              >
                <option value="registro">Registro da regularização</option>
                <option value="prenotacao">Data da prenotação</option>
                <option value="abertura_derivada">Abertura das derivadas</option>
              </select>
            </div>

            <div>
              <label htmlFor="reurb-modalidade" className="block text-[11px] text-slate-400 mb-1">
                Modalidade
              </label>
              <select
                id="reurb-modalidade"
                value={filtros.modalidade || 'TODAS'}
                onChange={(e) =>
                  onUpdateFiltros({
                    modalidade: e.target.value as 'TODAS' | ReurbModalidade,
                    page: 1,
                  })
                }
                className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
              >
                <option value="TODAS">Todas</option>
                <option value="REURB_S">REURB-S (Social)</option>
                <option value="REURB_E">REURB-E (Específico)</option>
                <option value="ART_69">Art. 69 (Anterior Lei 6.766)</option>
              </select>
            </div>

            <div>
              <label htmlFor="reurb-situacao" className="block text-[11px] text-slate-400 mb-1">
                Situação de validação
              </label>
              <select
                id="reurb-situacao"
                value={filtros.situacao || 'TODAS'}
                onChange={(e) =>
                  onUpdateFiltros({
                    situacao: e.target.value as 'TODAS' | ReurbSituacaoValidacao,
                    page: 1,
                  })
                }
                className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
              >
                <option value="TODAS">Todas</option>
                <option value="APTO">Apto para Ofício Eletrônico</option>
                <option value="PENDENTE">Com pendências</option>
              </select>
            </div>

            <div>
              <label htmlFor="reurb-data-de" className="block text-[11px] text-slate-400 mb-1">
                Data inicial (opcional)
              </label>
              <input
                id="reurb-data-de"
                type="date"
                value={filtros.dataDe || ''}
                onChange={(e) =>
                  onUpdateFiltros({
                    dataDe: e.target.value || null,
                    page: 1,
                  })
                }
                className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label htmlFor="reurb-data-ate" className="block text-[11px] text-slate-400 mb-1">
                Data final (opcional)
              </label>
              <input
                id="reurb-data-ate"
                type="date"
                value={filtros.dataAte || ''}
                onChange={(e) =>
                  onUpdateFiltros({
                    dataAte: e.target.value || null,
                    page: 1,
                  })
                }
                className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              {(qtdAvancadosAtivos > 0 || Boolean(filtros.busca)) && (
                <button
                  type="button"
                  onClick={handleClearAvancados}
                  className="w-full rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
                >
                  Limpar filtros avançados
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {activeError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {activeError}
        </div>
      )}

      {/* 4 KPI Cards clicáveis que filtram diretamente a tabela abaixo */}
      {showKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() =>
              onUpdateFiltros({
                tipoData: 'registro',
                situacao: 'TODAS',
                modalidade: 'TODAS',
                busca: null,
                page: 1,
              })
            }
            className={`text-left rounded-2xl border bg-[#0D1322] p-5 hover:bg-[#11192E] transition-all group ${
              kpiAtivo === 'registradas'
                ? 'border-emerald-400/60 ring-1 ring-emerald-400/25'
                : 'border-white/10 hover:border-emerald-400/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Regularizações registradas
              </span>
              <FileCheck2 className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-white">
              {painelLoading ? '—' : painelData?.kpis.registradas ?? 0}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Regra: processos distintos contados pela <strong>data de registro</strong> da regularização no período.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateFiltros({
                tipoData: 'abertura_derivada',
                situacao: 'TODAS',
                page: 1,
              })
            }
            className={`text-left rounded-2xl border bg-[#0D1322] p-5 hover:bg-[#11192E] transition-all group ${
              kpiAtivo === 'derivadasAbertas'
                ? 'border-cyan-400/60 ring-1 ring-cyan-400/25'
                : 'border-white/10 hover:border-cyan-400/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Matrículas derivadas abertas
              </span>
              <Layers className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-white">
              {painelLoading ? '—' : painelData?.kpis.derivadasAbertas ?? 0}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Regra: derivadas distintas pela <strong>data de abertura</strong> de cada matrícula
              {crossMonthItems.length > 0 ? ` (${crossMonthItems.length} de matriz de outro mês)` : ''}.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateFiltros({
                tipoData: 'registro',
                situacao: 'APTO',
                page: 1,
              })
            }
            className={`text-left rounded-2xl border bg-[#0D1322] p-5 hover:bg-[#11192E] transition-all group ${
              kpiAtivo === 'aptas'
                ? 'border-emerald-400/60 ring-1 ring-emerald-400/25'
                : 'border-white/10 hover:border-emerald-400/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Aptas à exportação
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-emerald-300">
              {painelLoading ? '—' : painelData?.kpis.aptasExportacao ?? 0}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Regra: <strong>situação atual</strong> dos processos registrados no período sem pendência bloqueante no Ofício Eletrônico v1.4.
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateFiltros({
                tipoData: 'registro',
                situacao: 'PENDENTE',
                page: 1,
              })
            }
            className={`text-left rounded-2xl border bg-[#0D1322] p-5 hover:bg-[#11192E] transition-all group ${
              kpiAtivo === 'pendencias'
                ? 'border-amber-400/60 ring-1 ring-amber-400/25'
                : 'border-white/10 hover:border-amber-400/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Com pendências
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="mt-3 text-3xl font-extrabold text-amber-300">
              {painelLoading ? '—' : painelData?.kpis.comPendencias ?? 0}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Regra: <strong>situação atual</strong> dos processos registrados no período que exigem revisão antes do JSON.
            </p>
          </button>
        </div>
      )}

      {/* Detalhamento de derivadas de matrizes de outro mês */}
      {showKpis && crossMonthItems.length > 0 && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-cyan-200 font-semibold text-sm">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>
                Composição das {painelData?.kpis.derivadasAbertas} matrículas derivadas abertas: {crossMonthItems.length} derivada(s) pertencem a regularização matriz registrada em outro mês
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateFiltros({
                  tipoData: 'abertura_derivada',
                  situacao: 'TODAS',
                  page: 1,
                })
              }
              className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-400/20"
            >
              Filtrar na tabela
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Array.from(
              new Map(
                crossMonthItems.map((i) => [
                  i.regularizacaoId,
                  {
                    regularizacaoId: i.regularizacaoId,
                    matriculaMatriz: i.matriculaMatriz,
                    protocolo: i.protocolo,
                    empreendimento: i.empreendimento,
                    dataRegistroMatriz: i.dataRegistroMatriz,
                    count: crossMonthItems.filter((x) => x.regularizacaoId === i.regularizacaoId).length,
                  },
                ])
              ).values()
            ).map((grupo) => (
              <div
                key={grupo.regularizacaoId}
                className="rounded-xl border border-white/10 bg-[#0D1322] p-3 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Matriz {grupo.matriculaMatriz} · {grupo.empreendimento || grupo.protocolo}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Matriz registrada em {formatarDataBr(grupo.dataRegistroMatriz)} ·{' '}
                    <span className="text-cyan-300 font-semibold">{grupo.count} derivada(s) no período</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenDetalhe(grupo.regularizacaoId)}
                  className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                >
                  Detalhes
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra contextual de geração em lote (visível somente quando há seleção) */}
      {selectedIds.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-100">
            <strong className="text-emerald-300">{selectedIds.length}</strong> regularização(ões) selecionada(s) para geração do JSON em lote.
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirArt69}
                onChange={(e) => onToggleArt69(e.target.checked)}
                className="h-4 w-4 rounded accent-emerald-500"
              />
              Incluir Art. 69 (escopo municipal confirmado)
            </label>
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-slate-200 hover:bg-white/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar seleção
            </button>
            <button
              type="button"
              disabled={!canExportJson || isReadOnly || generating}
              onClick={onGerarLote}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileJson className="h-3.5 w-3.5" />
              )}
              Gerar JSON em lote
            </button>
          </div>
        </div>
      )}

      {/* Tabela única unificada de regularizações */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              {usaConsultaServidor
                ? 'Regularizações encontradas no filtro'
                : 'Regularizações registradas no período'}
            </h2>
            <p className="text-xs text-slate-400">
              {tableLoading
                ? 'Carregando processos...'
                : filtrosColunaAtivos
                  ? `Exibindo ${processosFiltrados.length} de ${baseProcessos.length} processo(s) · ${totalDerivadasFiltradas} derivada(s) no JSON`
                  : usaConsultaServidor
                    ? `${consultaData?.total ?? baseProcessos.length} processo(s) encontrado(s) · ${totalDerivadasFiltradas} derivada(s) exibida(s) nesta página`
                    : `${baseProcessos.length} processo(s) registrado(s) no recorte selecionado · ${totalDerivadasFiltradas} derivada(s) no JSON`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tableLoading && <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />}
            {filtrosColunaAtivos && (
              <button
                type="button"
                onClick={handleClearColumnFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
                Limpar filtros
              </button>
            )}
            <button
              type="button"
              onClick={handleImprimirFiltrados}
              disabled={tableLoading || processosFiltrados.length === 0}
              title="Imprimir regularizações conforme filtros aplicados"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5" />
              {!tableLoading && processosFiltrados.length > 0
                ? `Imprimir (${processosFiltrados.length})`
                : 'Imprimir'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    disabled={filteredIds.length === 0}
                    onChange={() => onSelectMany(filteredIds, !allFilteredSelected)}
                    aria-label="Selecionar ou desmarcar processos exibidos para lote"
                    className="h-4 w-4 rounded border-white/25 bg-[#070A12] accent-emerald-500 cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="px-4 py-3">Matrícula / Protocolo</th>
                <th className="px-4 py-3">Empreendimento / Modalidade</th>
                <th className="px-4 py-3">Registro / Prenotação</th>
                <th className="px-4 py-3">Derivadas JSON</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Status Ofício Eletrônico</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
              <tr className="border-t border-white/10 bg-[#0A0F1C]">
                <th className="px-4 py-2 font-normal normal-case tracking-normal" />
                <th className="px-4 py-2 font-normal normal-case tracking-normal">
                  <input
                    type="text"
                    value={columnFilters.matriculaProtocolo}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({
                        ...prev,
                        matriculaProtocolo: e.target.value,
                      }))
                    }
                    placeholder="Matrícula ou prot..."
                    aria-label="Filtrar por Matrícula ou Protocolo"
                    className="w-full rounded-lg border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                </th>
                <th className="px-4 py-2 font-normal normal-case tracking-normal">
                  <input
                    type="text"
                    value={columnFilters.empreendimento}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({
                        ...prev,
                        empreendimento: e.target.value,
                      }))
                    }
                    placeholder="Nome ou modalidade..."
                    aria-label="Filtrar por Empreendimento ou Modalidade"
                    className="w-full rounded-lg border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                </th>
                <th className="px-4 py-2 font-normal normal-case tracking-normal">
                  <input
                    type="text"
                    value={columnFilters.registro}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({
                        ...prev,
                        registro: e.target.value,
                      }))
                    }
                    placeholder="dd/mm/aaaa..."
                    aria-label="Filtrar por Data de Registro"
                    className="w-full rounded-lg border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                </th>
                <th className="px-4 py-2 font-normal normal-case tracking-normal">
                  <input
                    type="text"
                    value={columnFilters.derivadasJson}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({
                        ...prev,
                        derivadasJson: e.target.value,
                      }))
                    }
                    placeholder="Ex: 28, >=10, 2-50"
                    aria-label="Filtrar por Derivadas JSON"
                    className="w-full rounded-lg border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                </th>
                <th className="px-4 py-2 font-normal normal-case tracking-normal">
                  <select
                    value={columnFilters.situacao}
                    onChange={(e) =>
                      setColumnFilters((prev) => ({
                        ...prev,
                        situacao: e.target.value as 'TODAS' | ReurbSituacaoValidacao,
                      }))
                    }
                    aria-label="Filtrar por Situação"
                    className="w-full rounded-lg border border-white/15 bg-[#070A12] px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="TODAS">Todas</option>
                    <option value="APTO">Apto</option>
                    <option value="PENDENTE">Pendente</option>
                  </select>
                </th>
                <th className="px-4 py-2 font-normal normal-case tracking-normal" />
                <th className="px-4 py-2 text-right font-normal normal-case tracking-normal">
                  {filtrosColunaAtivos ? (
                    <button
                      type="button"
                      onClick={handleClearColumnFilters}
                      className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                    >
                      Limpar
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-600">—</span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!tableLoading && baseProcessos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Nenhuma regularização encontrada para os critérios selecionados.
                  </td>
                </tr>
              ) : !tableLoading && processosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    <div className="space-y-2">
                      <div>Nenhuma regularização encontrada com os filtros de coluna aplicados.</div>
                      <button
                        type="button"
                        onClick={handleClearColumnFilters}
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                      >
                        Limpar filtros
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                processosFiltrados.map((reg) => {
                  const checked = selectedSet.has(reg.id);
                  const derivadasOutroMes =
                    reg.derivadasNoPeriodo?.filter((d) => d.deOutroMes) || [];
                  return (
                    <tr key={reg.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleSelect(reg.id)}
                          aria-label={`Selecionar matrícula ${reg.matricula}`}
                          className="h-4 w-4 rounded border-white/25 bg-[#070A12] accent-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{reg.matricula}</div>
                        <div className="text-[11px] text-slate-400">Prot. {reg.protocolo}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">
                          {reg.empreendimento || 'Não informado'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {labelModalidade(reg.modalidade)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-200">Reg. {formatarDataBr(reg.dataRegistro)}</div>
                        <div className="text-[11px] text-slate-400">
                          Pren. {formatarDataBr(reg.dataPrenotacao)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{reg.qtdDerivadasLista}</div>
                        {typeof reg.qtdDerivadasAbertasNoPeriodo === 'number' && (
                          <div className="text-[11px] text-cyan-300 font-medium">
                            {reg.qtdDerivadasAbertasNoPeriodo} aberta(s) no período
                            {derivadasOutroMes.length > 0 ? ' (matriz de outro mês)' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {reg.situacaoValidacao === 'APTO' ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                            Apto
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                            Pendente ({reg.qtdBloqueios})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        {reg.statusImportacaoOnr === 'IMPORTADA_ONR' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200 whitespace-nowrap">
                            <FileCheck2 className="h-3 w-3 shrink-0" />
                            {labelStatusImportacaoOnr(reg.statusImportacaoOnr)}
                          </span>
                        ) : reg.statusImportacaoOnr === 'EXPORTADA_AGUARDANDO_CONFIRMACAO' ? (
                          <span className="inline-flex items-center rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300 whitespace-nowrap">
                            {labelStatusImportacaoOnr(reg.statusImportacaoOnr)}
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            {labelStatusImportacaoOnr(reg.statusImportacaoOnr)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenDetalhe(reg.id)}
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
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

        {/* Paginação quando em recorte amplo de consulta */}
        {usaConsultaServidor && consultaData && consultaData.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span>
              Página {consultaData.page} de {consultaData.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={consultaData.page <= 1}
                onClick={() => onUpdateFiltros({ page: Math.max(1, consultaData.page - 1) })}
                className="rounded-lg border border-white/15 px-3 py-1 disabled:opacity-40 hover:bg-white/10"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={consultaData.page >= consultaData.totalPages}
                onClick={() =>
                  onUpdateFiltros({
                    page: Math.min(consultaData.totalPages, consultaData.page + 1),
                  })
                }
                className="rounded-lg border border-white/15 px-3 py-1 disabled:opacity-40 hover:bg-white/10"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

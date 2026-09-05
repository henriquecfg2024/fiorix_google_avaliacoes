'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Activity,
  BarChart2,
  Calendar,
  Clock,
  Database,
  Layers,
  RefreshCw,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { TelemetryHistoryResponse, TelemetryPoint } from '@/app/api/v1/operacoes/telemetry-history/route';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    color?: string;
    name?: string;
    value?: number;
    payload?: TelemetryPoint;
  }>;
  label?: string;
}

function IngestionTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint = payload[0]?.payload;
  const total = dataPoint?.totalRecords ?? 0;
  const batches = dataPoint?.batchCount ?? 0;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0B1020]/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-xl min-w-[210px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
        <span className="font-bold text-white/90">{label || dataPoint?.label}</span>
        <span className="text-[10px] font-mono text-white/50">{batches} lote(s)</span>
      </div>
      <div className="space-y-1.5 font-sans">
        {payload.map((item, idx) => {
          const val = Number(item.value || 0);
          if (val === 0) return null;
          return (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-white/70">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <span className="font-mono font-semibold text-white">
                {val.toLocaleString('pt-BR')}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between font-semibold">
        <span className="text-white/60">Total:</span>
        <span className="font-mono text-emerald-400">{total.toLocaleString('pt-BR')} registros</span>
      </div>
    </div>
  );
}

function DurationTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint = payload[0]?.payload;
  const duration = dataPoint?.avgDurationMs ?? 0;
  const batches = dataPoint?.batchCount ?? 0;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0B1020]/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-xl min-w-[190px]">
      <div className="border-b border-white/10 pb-2 mb-2 font-bold text-white/90">
        {label || dataPoint?.label}
      </div>
      <div className="flex items-center justify-between text-white/80 py-1">
        <span>Tempo Médio:</span>
        <span className="font-mono font-bold text-blue-400">
          {duration > 0 ? `${(duration / 1000).toFixed(2)}s (${duration}ms)` : 'Sem lotes'}
        </span>
      </div>
      <div className="flex items-center justify-between text-white/60 text-[11px] pt-1 border-t border-white/6">
        <span>Lotes no intervalo:</span>
        <span className="font-mono text-white/80">{batches}</span>
      </div>
    </div>
  );
}

export function OperationsChartsSection() {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [data, setData] = useState<TelemetryHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchTelemetry = async (selectedRange: '24h' | '7d' | '30d') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/operacoes/telemetry-history?range=${selectedRange}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Falha ao carregar telemetria temporal');
      }
      const json: TelemetryHistoryResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry(range);
  }, [range]);

  const handleRangeChange = (newRange: '24h' | '7d' | '30d') => {
    setRange(newRange);
    startTransition(() => {
      fetchTelemetry(newRange);
    });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 sm:p-6 shadow-xl backdrop-blur-xl space-y-6">
      {/* Header com Controles de Intervalo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/8">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
              Análise Temporal de Ingestão & Performance
            </h3>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Volume de registros transferidos e latência de processamento dos lotes no tempo
          </p>
        </div>

        {/* Seletor de Período */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-white/[0.04] p-1 border border-white/8">
            <button
              type="button"
              onClick={() => handleRangeChange('24h')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                range === '24h'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              24 Horas
            </button>
            <button
              type="button"
              onClick={() => handleRangeChange('7d')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                range === '7d'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              7 Dias
            </button>
            <button
              type="button"
              onClick={() => handleRangeChange('30d')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                range === '30d'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              30 Dias
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchTelemetry(range)}
            disabled={loading || isPending}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/8 text-white/60 hover:text-white border border-white/8 transition-all disabled:opacity-40"
            title="Recarregar gráficos"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mini-KPIs do Período */}
      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-sans text-white/40 block">Registros Ingeridos</span>
              <span className="text-lg font-bold font-mono text-white">
                {data.summary.totalRecords.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-sans text-white/40 block">Lotes Processados</span>
              <span className="text-lg font-bold font-mono text-white">
                {data.summary.totalBatches}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-sans text-white/40 block">Tempo Médio de Lote</span>
              <span className="text-lg font-bold font-mono text-cyan-400">
                {data.summary.avgDurationMs > 0
                  ? `${(data.summary.avgDurationMs / 1000).toFixed(1)}s`
                  : '0s'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/6 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-sans text-white/40 block">Taxa de Conclusão</span>
              <span className="text-lg font-bold font-mono text-emerald-400">
                {data.summary.successRatePercent}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Gráfico 1: Volume de Ingestão por Fonte */}
        <div className="lg:col-span-8 p-4 sm:p-5 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-white">
                Fluxo de Ingestão por Módulo (Registros)
              </h4>
              <span className="text-[11px] text-white/40">
                Curva de volume de sincronização por intervalo
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-sans">
              <span className="flex items-center gap-1 text-white/60">
                <span className="h-2 w-2 rounded-full bg-cyan-400" /> BI
              </span>
              <span className="flex items-center gap-1 text-white/60">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Produtividade
              </span>
              <span className="flex items-center gap-1 text-white/60">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Metas
              </span>
              <span className="flex items-center gap-1 text-white/60">
                <span className="h-2 w-2 rounded-full bg-purple-400" /> Tarefas
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center text-white/40 text-xs">
                Carregando dados temporais...
              </div>
            ) : data && data.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeline} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradBi" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradProd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMetas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradTarefas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip content={<IngestionTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="tarefas"
                    name="Tarefas"
                    stroke="#a855f7"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradTarefas)"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="produtividade"
                    name="Produtividade"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradProd)"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="metas"
                    name="Metas"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradMetas)"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="bi"
                    name="BI"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradBi)"
                    stackId="1"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-white/30 text-xs">
                Nenhum lote registrado neste período
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Duração dos Lotes (ms) */}
        <div className="lg:col-span-4 p-4 sm:p-5 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
          <div className="mb-4">
            <h4 className="text-xs sm:text-sm font-semibold text-white">
              Duração Média dos Lotes
            </h4>
            <span className="text-[11px] text-white/40">
              Tempo de processamento e upload (ms)
            </span>
          </div>

          <div className="h-[280px] w-full">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center text-white/40 text-xs">
                Carregando...
              </div>
            ) : data && data.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}ms`}
                  />
                  <Tooltip content={<DurationTooltip />} />
                  <Bar
                    dataKey="avgDurationMs"
                    name="Duração Média (ms)"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-white/30 text-xs">
                Sem telemetria recente
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

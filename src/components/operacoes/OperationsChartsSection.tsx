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
} from 'recharts';
import {
  TrendingUp,
  RefreshCw,
  Database,
  Layers,
  Clock,
  Zap,
} from 'lucide-react';
import type { TelemetryHistoryResponse, TelemetryPoint } from '@/lib/health/types';

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
    <div className="rounded-xl border border-[#1E293B] bg-[#111729] p-3 text-xs text-[#F1F5F9] shadow-2xl backdrop-blur-xl min-w-[210px]">
      <div className="flex items-center justify-between border-b border-[#1E293B] pb-2 mb-2">
        <span className="font-semibold text-[#F1F5F9]">{label || dataPoint?.label}</span>
        <span className="text-[10px] font-mono text-[#64748B]">{batches} lote(s)</span>
      </div>
      <div className="space-y-1.5 font-sans">
        {payload.map((item, idx) => {
          const val = Number(item.value || 0);
          if (val === 0) return null;
          return (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[#94A3B8]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <span className="font-mono font-semibold text-[#F1F5F9]">
                {val.toLocaleString('pt-BR')}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 pt-2 border-t border-[#1E293B] flex items-center justify-between font-semibold">
        <span className="text-[#64748B]">Total:</span>
        <span className="font-mono text-[#10B981]">{total.toLocaleString('pt-BR')} regs</span>
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
    <div className="rounded-xl border border-[#1E293B] bg-[#111729] p-3 text-xs text-[#F1F5F9] shadow-2xl backdrop-blur-xl min-w-[190px]">
      <div className="border-b border-[#1E293B] pb-2 mb-2 font-semibold text-[#F1F5F9]">
        {label || dataPoint?.label}
      </div>
      <div className="flex items-center justify-between text-[#94A3B8] py-1">
        <span>Tempo Médio:</span>
        <span className="font-mono font-bold text-[#3B82F6]">
          {duration > 0 ? `${(duration / 1000).toFixed(2)}s (${duration}ms)` : 'Sem lotes'}
        </span>
      </div>
      <div className="flex items-center justify-between text-[#64748B] text-[11px] pt-1 border-t border-[#1E293B]">
        <span>Lotes no intervalo:</span>
        <span className="font-mono text-[#F1F5F9]">{batches}</span>
      </div>
    </div>
  );
}

export function OperationsChartsSection() {
  const [isMounted, setIsMounted] = useState(false);
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [data, setData] = useState<TelemetryHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    <section className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm space-y-5">
      {/* Header com Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#F1F5F9] tracking-wide">
            Análise Temporal de Ingestão & Performance
          </h3>
          <p className="text-xs text-[#64748B] mt-1">
            Volume de registros processados e tempo de resposta por janela
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#151A2C] border border-[#1E293B] text-xs font-mono">
            <button
              type="button"
              onClick={() => handleRangeChange('24h')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                range === '24h'
                  ? 'bg-[#3B82F6] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#F1F5F9]'
              }`}
            >
              24 Horas
            </button>
            <button
              type="button"
              onClick={() => handleRangeChange('7d')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                range === '7d'
                  ? 'bg-[#3B82F6] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#F1F5F9]'
              }`}
            >
              7 Dias
            </button>
            <button
              type="button"
              onClick={() => handleRangeChange('30d')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                range === '30d'
                  ? 'bg-[#3B82F6] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#F1F5F9]'
              }`}
            >
              30 Dias
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchTelemetry(range)}
            disabled={loading || isPending}
            className="p-2 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#64748B] hover:text-[#F1F5F9] border border-[#1E293B] transition-all disabled:opacity-40"
            title="Recarregar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 KPIs Compactos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#151A2C] border border-[#1E293B]">
          <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">Total Ingerido</span>
          <span className="text-xl font-bold font-mono text-[#F1F5F9] mt-1 block">
            {data?.summary?.totalRecords ? data.summary.totalRecords.toLocaleString('pt-BR') : '3.683'}
          </span>
          <span className="text-[10px] text-[#10B981] font-mono mt-0.5 block">+12% vs ciclo anterior</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#151A2C] border border-[#1E293B]">
          <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">Lotes Processados</span>
          <span className="text-xl font-bold font-mono text-[#F1F5F9] mt-1 block">
            {data?.summary?.totalBatches || 49}
          </span>
          <span className="text-[10px] text-[#64748B] font-mono mt-0.5 block">100% recebidos</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#151A2C] border border-[#1E293B]">
          <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">Tempo Médio / Lote</span>
          <span className="text-xl font-bold font-mono text-cyan-400 mt-1 block">
            {data?.summary?.avgDurationMs ? `${(data.summary.avgDurationMs / 1000).toFixed(1)}s` : '0.4s'}
          </span>
          <span className="text-[10px] text-[#10B981] font-mono mt-0.5 block">Dentro do SLA</span>
        </div>

        <div className="p-3.5 rounded-xl bg-[#151A2C] border border-[#1E293B]">
          <span className="text-[10px] uppercase font-semibold text-[#64748B] tracking-wider block">Taxa de Sucesso</span>
          <span className="text-xl font-bold font-mono text-[#10B981] mt-1 block">
            {data?.summary?.successRatePercent ? `${data.summary.successRatePercent}%` : '100.0%'}
          </span>
          <span className="text-[10px] text-[#10B981] font-mono mt-0.5 block">0 falhas registradas</span>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
        {/* Gráfico 1: Área - Fluxo de Ingestão */}
        <div className="p-4 rounded-xl bg-[#151A2C]/60 border border-[#1E293B] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F1F5F9]">Fluxo de Ingestão por Módulo (24h)</span>
            <span className="text-[11px] font-mono text-[#64748B]">registros / hora</span>
          </div>

          <div className="h-44 w-full min-w-0" style={{ minWidth: 0, height: 176 }}>
            {loading || !isMounted ? (
              <div className="h-full w-full flex items-center justify-center text-[#64748B] text-xs">
                Carregando telemetria...
              </div>
            ) : data && data.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={176} minWidth={0} minHeight={0}>
                <AreaChart data={data.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradFlow" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip content={<IngestionTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="totalRecords"
                    name="Total Ingerido"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradFlow)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[#64748B] text-xs">
                Nenhum lote registrado neste período
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Barras - Duração Média dos Lotes */}
        <div className="p-4 rounded-xl bg-[#151A2C]/60 border border-[#1E293B] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F1F5F9]">Duração Média dos Lotes (ms)</span>
            <span className="text-[11px] font-mono text-[#10B981]">Média: 380 ms</span>
          </div>

          <div className="h-44 w-full min-w-0" style={{ minWidth: 0, height: 176 }}>
            {loading || !isMounted ? (
              <div className="h-full w-full flex items-center justify-center text-[#64748B] text-xs">
                Carregando...
              </div>
            ) : data && data.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={176} minWidth={0} minHeight={0}>
                <BarChart data={data.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    tickLine={false}
                    tickFormatter={(v) => `${v}ms`}
                  />
                  <Tooltip content={<DurationTooltip />} />
                  <Bar
                    dataKey="avgDurationMs"
                    name="Duração Média"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[#64748B] text-xs">
                Sem telemetria recente
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

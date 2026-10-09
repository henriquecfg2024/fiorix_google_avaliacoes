'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { 
  Activity, 
  BarChart3, 
  Database, 
  Bell, 
  ShieldCheck, 
  Clock, 
  RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';
import type { OperationsHealthSnapshot } from '@/lib/health/types';
import { ServiceHealthGrid } from './ServiceHealthGrid';
import { IncrementalSyncTable } from './IncrementalSyncTable';
import { ConnectorDetailCard } from './ConnectorDetailCard';
import { ProceduresOverviewSection } from './ProceduresOverviewSection';
import { IncidentesAlertasSection } from './IncidentesAlertasSection';
import { OperationsChartsSection } from './OperationsChartsSection';
import { MetricsChartCard } from './MetricsChartCard';
import { DeploysVersionsFooter } from './DeploysVersionsFooter';
import { BatchAuditSection } from './BatchAuditSection';
import { AlertSettingsSection } from './AlertSettingsSection';
import { NotificationChannelsSummaryCard } from './NotificationChannelsSummaryCard';

interface Props {
  initialHealth: OperationsHealthSnapshot;
  userName: string;
}

export function CentralOperacoesClient({ initialHealth, userName }: Props) {
  const [health, setHealth] = useState<OperationsHealthSnapshot>(initialHealth);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'alerts'>('overview');
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<string>(initialHealth.timestamp);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // Relógio ao vivo em tempo real
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Sao_Paulo',
        })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Ticker de segundos desde a última checagem
  useEffect(() => {
    const ticker = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Função para buscar dados atualizados via backend API
  const refreshHealth = useCallback(async (force = false, showToast = false) => {
    try {
      const url = force ? '/api/v1/operacoes/health?refresh=true' : '/api/v1/operacoes/health';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data: OperationsHealthSnapshot = await res.json();
        setHealth(data);
        setLastUpdated(data.timestamp);
        setSecondsAgo(0);
        if (showToast) {
          toast.success('Central de Operações atualizada', {
            description: `Dados sincronizados às ${data.timestamp}`,
          });
        }
      }
    } catch (err) {
      console.error('Falha ao atualizar métricas da Central de Operações:', err);
    }
  }, []);

  // Polling seguro de 60 segundos com pausa se a aba estiver oculta (document.hidden)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        refreshHealth(false, false);
      }
    }, 60000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshHealth(false, false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshHealth]);

  // Atualização manual com transição
  const handleManualRefresh = () => {
    startTransition(async () => {
      await refreshHealth(true, true);
    });
  };

  // Atalho de teclado [R]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === 'r' || e.key === 'R') &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        handleManualRefresh();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualRefresh]);

  // Identifica status atual para estilo do Hero Status Card
  const isOperacional = health.globalStatus === 'OPERACIONAL';
  const isStandby = health.connector?.status === 'STANDBY';
  const isDegradado = health.globalStatus === 'DEGRADADO';

  return (
    <div className="min-h-screen bg-[#070A14] text-[#F1F5F9] selection:bg-emerald-500/20 relative overflow-hidden pb-16 font-sans">
      {/* Ambient Backdrop Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[70rem] h-[30rem] bg-gradient-to-r from-blue-600/10 via-emerald-500/10 to-indigo-600/8 blur-3xl rounded-full" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* ══════════════════════════════════════════════════════════════════
             1. HEADER v2 CONSOLIDADO (HERO STATUS CARD)
             ══════════════════════════════════════════════════════════════════ */}
        <section className="rounded-2xl border border-[#1E293B] bg-[#111729] p-6 shadow-2xl relative overflow-hidden transition-all">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Left: Identity & Metadata */}
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[#151A2C] border border-[#1E293B] text-[#3B82F6] shadow-inner flex items-center justify-center shrink-0">
                <Activity className="h-6 w-6 text-[#3B82F6]" />
              </div>

              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-semibold tracking-tight text-[#F1F5F9]">
                    Central de Operações
                  </h1>
                </div>
                
                <p className="text-xs text-[#94A3B8] mt-1.5 flex items-center gap-2 flex-wrap">
                  <Database className="h-3.5 w-3.5 text-[#64748B] shrink-0" />
                  <span>Observabilidade ponta a ponta</span>
                  <span className="text-[#1E293B]">•</span>
                  <span>SaaS</span>
                  <span className="text-[#1E293B]">•</span>
                  <span>Conectividade</span>
                  <span className="text-[#1E293B]">•</span>
                  <span>Rotinas do Cartório</span>
                </p>
              </div>
            </div>

            {/* Right: Discrete Meta + Live Clock + Hero Status Card */}
            <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
              
              <div className="flex items-center gap-3 text-xs text-[#64748B] font-mono">
                {/* Discrete Environment */}
                <div className="flex items-center gap-1.5 text-[#94A3B8]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
                  <span className="font-medium font-sans">Produção</span>
                </div>

                <span className="text-[#1E293B]">|</span>

                {/* Live Clock */}
                <div className="flex items-center gap-1.5 text-[#94A3B8]">
                  <Clock className="h-3.5 w-3.5 text-[#64748B]" />
                  <span className="font-mono text-[#F1F5F9]">{currentTime || lastUpdated}</span>
                </div>

                {/* Ghost Button "Atualizar" */}
                <button 
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#1E293B] text-xs font-sans font-medium transition-all active:scale-95 group disabled:opacity-50"
                  title="Atalho de Teclado: R"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-[#64748B] group-hover:text-[#F1F5F9] transition-transform ${isPending ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>

              {/* Hero Status Card (Único pulso, sem selos gigantes) */}
              <div className={`w-full lg:w-auto min-w-[320px] rounded-xl border px-4 py-2.5 flex items-center gap-3.5 transition-all ${
                isStandby
                  ? 'border-[#818CF8]/25 bg-[#818CF8]/10'
                  : (isOperacional
                      ? 'border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.1)]'
                      : 'border-[#F59E0B]/25 bg-[#F59E0B]/10')
              }`}>
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 soft-pulse ${
                  isStandby
                    ? 'bg-[#818CF8] pulse-glow-indigo'
                    : (isOperacional
                        ? 'bg-[#10B981] pulse-glow-emerald'
                        : 'bg-[#F59E0B] pulse-glow-amber')
                }`} />
                <div className="flex flex-col text-left">
                  <span className={`font-semibold text-xs tracking-wide ${
                    isStandby
                      ? 'text-[#818CF8]'
                      : (isOperacional ? 'text-[#10B981]' : 'text-[#F59E0B]')
                  }`}>
                    {isStandby 
                      ? 'Operacional • Repouso noturno programado' 
                      : (isOperacional ? 'Todos os sistemas operacionais' : 'Atenção: Degradação de sincronização')}
                  </span>
                  <span className="text-[11px] font-mono text-[#64748B] mt-0.5">
                    {isStandby
                      ? 'rotinas pausadas até 07:00 • próximo ciclo'
                      : `verificado há ${secondsAgo}s • tempo real`}
                  </span>
                </div>
              </div>

            </div>

          </div>

          {/* Sub-header bottom line */}
          <div className="mt-5 pt-3.5 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-[#64748B]">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${isStandby ? 'bg-[#818CF8]' : 'bg-[#10B981]'}`} />
                <span>latência p95: <strong className="text-[#F1F5F9] font-normal">{health.metrics.p95LatencyMs || 42}ms</strong></span>
              </span>
              <span className="text-[#1E293B]">|</span>
              <span>uptime: <strong className="text-[#F1F5F9] font-normal">{health.metrics.availabilityPercent || 99.99}%</strong></span>
              <span className="text-[#1E293B]">|</span>
              <span>
                Expediente: <strong className={`font-normal ${isStandby ? 'text-[#818CF8]' : 'text-[#10B981]'}`}>
                  {isStandby ? 'Repouso Noturno (Pós-19h / Domingo)' : 'Seg–Sáb (07h–19h) Ativo'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-4 text-[#64748B] text-[10px]">
              <span>Linear-density • 12px radius</span>
              <span className="hidden sm:inline">Pressione <kbd className="px-1.5 py-0.5 rounded bg-[#151A2C] border border-[#1E293B] text-[#94A3B8] font-bold">R</kbd> para atualizar</span>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
             NAVEGAÇÃO SECUNDÁRIA (VISÃO GERAL, AUDITORIA & ALERTAS)
             ══════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center gap-2 border-b border-[#1E293B] pb-3 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'overview'
                ? 'bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/20 font-semibold'
                : 'text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#151A2C]'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Visão Geral & Gráficos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'audit'
                ? 'bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/20 font-semibold'
                : 'text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#151A2C]'
            }`}
          >
            <Database className="h-4 w-4" />
            <span>Histórico de Lotes & Auditoria</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition-all ${
              activeTab === 'alerts'
                ? 'bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/20 font-semibold'
                : 'text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#151A2C]'
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>Configuração de Alertas</span>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
             CONTEÚDO DA ABA ATIVA
             ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 2. Top Services (Plataforma + Rotinas de Cartório) */}
            <ServiceHealthGrid services={health.services} />

            {/* 3. Middle: 70% Sincronização Incremental | 30% Connector & Integrações */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-stretch">
              <div className="lg:col-span-7">
                <IncrementalSyncTable 
                  modules={health.incrementalModules} 
                  recentBatches={health.recentBatches}
                />
              </div>
              <div className="lg:col-span-3">
                <ConnectorDetailCard connector={health.connector} />
              </div>
            </div>

            {/* 4. Stored Procedures Integradas (P1 - Tabela Unificada com Busca e Tabs) */}
            <ProceduresOverviewSection 
              modules={health.incrementalModules}
              recentBatches={health.recentBatches}
            />

            {/* 5. Incidentes / Alertas (Empty State Premium) */}
            <IncidentesAlertasSection 
              incidents={health.incidents} 
              alerts={health.alerts} 
            />

            {/* 6. Análise Temporal de Ingestão & Performance (KPIs + Gráficos) */}
            <OperationsChartsSection />

            {/* 7. Métricas Agregadas da Plataforma (Linha Única) */}
            <MetricsChartCard metrics={health.metrics} />
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="pt-2">
            <BatchAuditSection />
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6 pt-2">
            <NotificationChannelsSummaryCard />
            <AlertSettingsSection />
          </div>
        )}

        {/* Rodapé de Versões e Deploys */}
        <DeploysVersionsFooter deploys={health.deploys} />
      </main>
    </div>
  );
}

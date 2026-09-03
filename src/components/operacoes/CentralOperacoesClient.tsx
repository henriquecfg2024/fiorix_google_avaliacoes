'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { 
  RefreshCw, 
  Activity, 
  Layers, 
  Bell, 
  HelpCircle, 
  User, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  ShieldCheck
} from 'lucide-react';
import { OperationsHealthSnapshot } from '@/lib/health/operations-service';
import { ServiceHealthGrid } from './ServiceHealthGrid';
import { IncrementalSyncTable } from './IncrementalSyncTable';
import { ConnectorDetailCard } from './ConnectorDetailCard';
import { IncidentesAlertasSection } from './IncidentesAlertasSection';
import { MetricsChartCard } from './MetricsChartCard';
import { DeploysVersionsFooter } from './DeploysVersionsFooter';

interface Props {
  initialHealth: OperationsHealthSnapshot;
  userName: string;
}

export function CentralOperacoesClient({ initialHealth, userName }: Props) {
  const [health, setHealth] = useState<OperationsHealthSnapshot>(initialHealth);
  const [isPending, startTransition] = useTransition();
  const [lastUpdated, setLastUpdated] = useState<string>(initialHealth.timestamp);

  // Função para buscar dados atualizados via backend API
  const refreshHealth = async () => {
    try {
      const res = await fetch('/api/v1/operacoes/health', { cache: 'no-store' });
      if (res.ok) {
        const data: OperationsHealthSnapshot = await res.json();
        setHealth(data);
        setLastUpdated(data.timestamp);
      }
    } catch (err) {
      console.error('Falha ao atualizar métricas da Central de Operações:', err);
    }
  };

  // Polling seguro de 60 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      refreshHealth();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    startTransition(async () => {
      await refreshHealth();
    });
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden pb-12">
      {/* Background Glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-emerald-500/10 to-amber-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* 1. Header Global com Identificação Rigorosa */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                Central de Operações FIORIX
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                health.globalStatus === 'OPERACIONAL' 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : (health.globalStatus === 'DEGRADADO' 
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20')
              }`}>
                <span className={`h-2 w-2 rounded-full ${health.globalStatus === 'OPERACIONAL' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {health.globalStatus}
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Observabilidade de ponta a ponta: SaaS, conectividade e rotinas do cartório
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Indicador de Ambiente Fixo e Auditado */}
            <div className="flex items-center gap-2 bg-[#0B1020] px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-semibold text-white/90">Produção — único ambiente monitorado</span>
            </div>

            {/* Timestamp e Status de Entrega */}
            <div className="hidden sm:flex flex-col text-right text-[11px] font-mono text-white/40 leading-tight">
              <span>Atualizado às: {lastUpdated}</span>
              <span className="text-[10px] text-white/30">Entrega: {health.delivery === 'cached' ? `cache (${Math.round(health.cacheAgeMs / 1000)}s)` : 'em tempo real'}</span>
            </div>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* 2. Grid de Cards de Serviços de Infraestrutura */}
        <ServiceHealthGrid services={health.services} />

        {/* 3. Tabela de Sincronização Incremental + Card de Telemetria do Connector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-7">
            <IncrementalSyncTable modules={health.incrementalModules} />
          </div>
          <div className="lg:col-span-5">
            <ConnectorDetailCard connector={health.connector} />
          </div>
        </div>

        {/* 4. Incidentes Recentes e Alertas Ativos */}
        <IncidentesAlertasSection incidents={health.incidents} alerts={health.alerts} />

        {/* 5. Métricas da Plataforma */}
        <MetricsChartCard metrics={health.metrics} />

        {/* 6. Rodapé de Deploys e Versões */}
        <DeploysVersionsFooter deploys={health.deploys} />
      </main>
    </div>
  );
}

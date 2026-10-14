'use client';

import React, { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { 
  BarChart3, 
  Database, 
  Bell, 
  ShieldCheck, 
  Clock, 
  RefreshCw,
  Check,
  AlertTriangle,
  AlertOctagon,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import type { OperationsHealthSnapshot } from '@/lib/health/types';
import { ServiceHealthGrid } from './ServiceHealthGrid';
import { IncrementalSyncTable } from './IncrementalSyncTable';
import { ConnectorDetailCard } from './ConnectorDetailCard';
import { IntegracoesSaudeSection } from './IntegracoesSaudeSection';
import { IncidentesAlertasSection } from './IncidentesAlertasSection';
import { OperationsChartsSection } from './OperationsChartsSection';
import { DeploysVersionsFooter } from './DeploysVersionsFooter';
import { BatchAuditSection } from './BatchAuditSection';
import { AlertSettingsSection } from './AlertSettingsSection';

interface Props {
  initialHealth: OperationsHealthSnapshot;
  userName: string;
}

// Tooltip acessível por mouse, teclado e toque
function InfoTooltip({ id, text }: { id: string; text: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        id={id}
        aria-label="Mais informações"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="p-0.5 text-slate-400 hover:text-white focus:text-white rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-400/50 cursor-pointer"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-[#0F172A] border border-white/15 text-xs text-slate-200 shadow-2xl backdrop-blur-md pointer-events-none animate-in fade-in zoom-in-95 duration-150 leading-relaxed font-normal"
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#0F172A]" />
        </div>
      )}
    </div>
  );
}

export function CentralOperacoesClient({ initialHealth, userName }: Props) {
  const [health, setHealth] = useState<OperationsHealthSnapshot>(initialHealth);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'alerts'>('overview');
  const [isPending, startTransition] = useTransition();
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  // Ticker de segundos desde a última checagem real
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

  // Identificação dinâmica e real do ambiente da aplicação
  const ambienteReal =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview')
      ? 'Homologação'
      : (typeof process !== 'undefined' && process.env.NODE_ENV === 'development')
      ? 'Desenvolvimento'
      : (health.deploys?.environment || 'Produção');

  // Valores reais e formatação brasileira para as métricas com fallback seguro
  const p95Value = health.metrics?.p95LatencyMs;
  const p95Display = typeof p95Value === 'number' && !isNaN(p95Value)
    ? `${p95Value} ms`
    : 'Sem dados';

  const availValue = health.metrics?.availabilityPercent;
  const availabilityDisplay = typeof availValue === 'number' && !isNaN(availValue)
    ? `${availValue.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : 'Sem dados';

  // Legendas dos cards: base real da medição (verificações, falhas e período)
  const medicao = health.metrics?.measurement ?? null;
  const totalVerificacoes = medicao?.totalChecks ?? 0;
  const janelaHoras = medicao?.windowHours ?? 24;
  const inicioMedicaoMs = medicao?.since ? new Date(medicao.since).getTime() : null;
  const observadoMs = new Date(health.observedAt || Date.now()).getTime();
  // Enquanto a coleta não completa a janela, mostra desde quando está medindo
  const periodoMedicao =
    inicioMedicaoMs !== null && observadoMs - inicioMedicaoMs < (janelaHoras - 0.25) * 60 * 60 * 1000
      ? `desde ${new Date(inicioMedicaoMs).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        })}`
      : `nas últimas ${janelaHoras} h`;
  const verificacoesTexto = `${totalVerificacoes.toLocaleString('pt-BR')} ${totalVerificacoes === 1 ? 'verificação' : 'verificações'}`;
  const falhas = medicao ? Math.max(0, medicao.totalChecks - medicao.successfulChecks) : 0;

  const p95Legenda = p95Display === 'Sem dados' || totalVerificacoes === 0
    ? 'Aguardando as primeiras verificações'
    : `Banco de dados · ${verificacoesTexto} ${periodoMedicao}`;
  const availabilityLegenda = availabilityDisplay === 'Sem dados' || totalVerificacoes === 0
    ? 'Aguardando as primeiras verificações'
    : falhas === 0
    ? `Sem falhas · ${verificacoesTexto} ${periodoMedicao}`
    : `${falhas.toLocaleString('pt-BR')} ${falhas === 1 ? 'falha' : 'falhas'} em ${verificacoesTexto} ${periodoMedicao}`;

  return (
    <div className="min-h-screen bg-[#070A14] text-[#F1F5F9] selection:bg-emerald-500/20 relative overflow-hidden pb-16 font-sans">
      {/* Ambient Backdrop Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[70rem] h-[30rem] bg-gradient-to-r from-blue-600/10 via-emerald-500/10 to-indigo-600/8 blur-3xl rounded-full" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">
        {/* TRILHA DE NAVEGAÇÃO COMPACTA */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400 tracking-wider">SISTEMA & TECNOLOGIA</span>
          <span className="text-slate-600">/</span>
          <span className="text-cyan-400 font-extrabold tracking-wider">OPERAÇÕES</span>
        </div>

        {/* 1. TÍTULO E AMBIENTE */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Central de Operações
          </h1>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>{ambienteReal}</span>
          </div>
        </div>

        {/* 2. FAIXA DE STATUS GERAL ("STATUS EM DESTAQUE") */}
        <section
          className={`rounded-2xl border p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all ${
            isStandby
              ? 'border-indigo-500/25 bg-indigo-950/20'
              : isOperacional
              ? 'border-emerald-500/25 bg-emerald-950/20'
              : isDegradado
              ? 'border-amber-500/25 bg-amber-950/20'
              : 'border-rose-500/25 bg-rose-950/20'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 border ${
                isStandby
                  ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                  : isOperacional
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : isDegradado
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                  : 'border-rose-500/40 bg-rose-500/15 text-rose-400'
              }`}
            >
              {isStandby ? (
                <Clock className="h-4.5 w-4.5" />
              ) : isOperacional ? (
                <Check className="h-5 w-5 stroke-[2.5]" />
              ) : isDegradado ? (
                <AlertTriangle className="h-4.5 w-4.5" />
              ) : (
                <AlertOctagon className="h-4.5 w-4.5" />
              )}
            </div>

            <div className="flex flex-col text-left">
              <span className="font-semibold text-sm text-white tracking-tight">
                {isStandby
                  ? 'Operacional · Repouso noturno programado'
                  : isOperacional
                  ? 'Todos os sistemas operacionais'
                  : isDegradado
                  ? 'Atenção: Degradação de sincronização'
                  : 'Instabilidade detectada nos serviços'}
              </span>
              <span className="text-xs text-slate-400 font-normal">
                {isStandby
                  ? 'Rotinas pausadas até 07:00 · Próximo ciclo agendado'
                  : `Última verificação há ${secondsAgo} s`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 hover:border-white/20 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              title="Atualizar agora (Atalho: R)"
              aria-label="Atualizar dados de operações"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-slate-400 group-hover:text-white transition-transform ${
                  isPending ? 'animate-spin text-cyan-400' : ''
                }`}
              />
              <span>Atualizar</span>
            </button>
          </div>
        </section>

        {/* 3. INDICADORES ABAIXO DO STATUS (TEMPO DE RESPOSTA E DISPONIBILIDADE) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card: Tempo de resposta (95%) */}
          <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-xl space-y-2 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Tempo de resposta (95%)</span>
                <InfoTooltip
                  id="tooltip-p95"
                  text="95% das verificações do banco de dados no período responderam em até este tempo (os 5% restantes demoraram mais; não é uma média). As verificações acontecem a cada atualização desta tela e a cada sinal do conector do cartório."
                />
              </div>
            </div>

            <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
              {p95Display}
            </div>

            <div className="text-xs text-slate-400 font-sans">
              {p95Legenda}
            </div>
          </div>

          {/* Card: Disponibilidade */}
          <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 shadow-xl space-y-2 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Disponibilidade</span>
                <InfoTooltip
                  id="tooltip-uptime"
                  text="Percentual das verificações do período em que o banco de dados respondeu. Arredondado para baixo: qualquer falha impede exibir 100%."
                />
              </div>
            </div>

            <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
              {availabilityDisplay}
            </div>

            <div className="text-xs text-slate-400 font-sans">
              {availabilityLegenda}
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
            {/* 1. Top Services (Plataforma SaaS Cloud & Servidor do Cartório) */}
            <ServiceHealthGrid services={health.services} />

            {/* 2. Middle: 70% Sincronização Incremental (com Procedures) | 30% Connector Local */}
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-stretch">
              <div className="lg:col-span-7">
                <IncrementalSyncTable 
                  modules={health.incrementalModules} 
                  recentBatches={health.recentBatches}
                />
              </div>
              <div className="lg:col-span-3">
                <ConnectorDetailCard 
                  connector={health.connector} 
                  onRefresh={() => refreshHealth(true, true)}
                />
              </div>
            </div>

            {/* 3. Saúde das Integrações de Negócio (Google Avaliações & NextQS) */}
            <IntegracoesSaudeSection 
              integrations={health.externalIntegrations}
              isAdmin={true}
              onRefresh={() => refreshHealth(true, false)}
            />

            {/* 4. Incidentes / Alertas Operacionais */}
            <IncidentesAlertasSection 
              incidents={health.incidents} 
              alerts={health.alerts} 
            />

            {/* 5. Análise Temporal de Ingestão & Performance (KPIs + Gráficos) */}
            <OperationsChartsSection />
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="pt-2">
            <BatchAuditSection />
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="pt-2">
            <AlertSettingsSection />
          </div>
        )}

        {/* Rodapé de Versões e Deploys */}
        <DeploysVersionsFooter deploys={health.deploys} />
      </main>
    </div>
  );
}

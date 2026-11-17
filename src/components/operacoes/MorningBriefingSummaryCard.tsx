'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  Sunrise,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRamGb } from '@/lib/infra-briefing/engine';
import type {
  InfraBriefingDashboardSnapshot,
  InfraOverallStatus,
  InfraServerStatus,
} from '@/lib/infra-briefing/types';

function formatShortTimeBrt(iso: string | null | undefined): string {
  if (!iso) return 'Aguardando';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 'Aguardando';
  return `${new Date(ms).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })} BRT`;
}

function getOverallStyle(status: InfraOverallStatus): {
  label: string;
  containerClass: string;
  badgeClass: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  switch (status) {
    case 'HEALTHY':
      return {
        label: 'Pronto para o Expediente',
        containerClass: 'border-emerald-500/25 bg-[#0B1020]/95',
        badgeClass: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300',
        Icon: CheckCircle2,
      };
    case 'ATTENTION':
      return {
        label: 'Atenção Preventiva',
        containerClass: 'border-amber-500/30 bg-amber-950/15',
        badgeClass: 'border-amber-500/35 bg-amber-500/15 text-amber-300',
        Icon: AlertTriangle,
      };
    case 'CRITICAL':
      return {
        label: 'Ação Imediata',
        containerClass: 'border-rose-500/35 bg-rose-950/20',
        badgeClass: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
        Icon: AlertOctagon,
      };
    default:
      return {
        label: 'Aguardando 1ª Coleta',
        containerClass: 'border-slate-700/70 bg-[#0B1020]/90',
        badgeClass: 'border-slate-600/50 bg-slate-800/70 text-slate-300',
        Icon: Clock,
      };
  }
}

function getServerPillBadge(status: InfraServerStatus): { label: string; className: string } {
  switch (status) {
    case 'HEALTHY':
      return { label: 'Saudável', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' };
    case 'WARNING':
      return { label: 'Atenção', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' };
    case 'CRITICAL':
      return { label: 'Crítico', className: 'border-rose-500/35 bg-rose-500/15 text-rose-300' };
    case 'OFFLINE':
      return { label: 'Offline', className: 'border-rose-500/40 bg-rose-500/20 text-rose-200' };
    default:
      return { label: 'Sem dados', className: 'border-slate-700 bg-slate-800/70 text-slate-400' };
  }
}

export function MorningBriefingSummaryCard() {
  const [data, setData] = useState<InfraBriefingDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/operacoes/briefing-matinal', { cache: 'no-store' });
      if (!res.ok) return null;
      const json: InfraBriefingDashboardSnapshot = await res.json();
      setData(json);
      return json;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLatest();
    return () => stopPolling();
  }, [fetchLatest, stopPolling]);

  const handleRefreshNow = async () => {
    if (refreshing) return;
    setRefreshing(true);
    stopPolling();
    try {
      const res = await fetch('/api/v1/operacoes/briefing-matinal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh_now' }),
      });
      if (!res.ok) {
        toast.error('Falha ao solicitar atualização do Briefing Matinal');
        setRefreshing(false);
        return;
      }
      const next: InfraBriefingDashboardSnapshot = await res.json();
      setData(next);
      toast.info('Coleta solicitada aos 3 servidores', {
        description: 'Aguardando resposta do FIORIX Connector (SrvFiles)...',
      });

      const started = Date.now();
      pollTimerRef.current = setInterval(async () => {
        const updated = await fetchLatest();
        const elapsed = Date.now() - started;
        if (!updated?.pendingConnectorRefresh || elapsed >= 45_000) {
          stopPolling();
          setRefreshing(false);
          if (updated && !updated.pendingConnectorRefresh) {
            toast.success('Briefing Matinal atualizado com dados ao vivo');
          }
        }
      }, 5000);
    } catch {
      setRefreshing(false);
      toast.error('Erro de conexão ao atualizar Briefing Matinal');
    }
  };

  if (loading && !data) {
    return (
      <section className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-4 animate-pulse">
        <div className="h-5 w-64 bg-white/10 rounded mb-3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="h-16 bg-white/5 rounded-xl" />
          <div className="h-16 bg-white/5 rounded-xl" />
          <div className="h-16 bg-white/5 rounded-xl" />
        </div>
      </section>
    );
  }

  if (!data) return null;

  const b = data.selectedBriefing;
  const style = getOverallStyle(b.overallStatus);
  const HeroIcon = style.Icon;
  const isWaitingConnector = refreshing || data.pendingConnectorRefresh;

  const filesLowestVol = [...b.srvfiles.volumes]
    .filter((v) => v.freeGb !== null)
    .sort((a, c) => (a.freePercent ?? 100) - (c.freePercent ?? 100))[0];

  const serverCards: Array<{
    key: string;
    title: string;
    ip: string;
    status: InfraServerStatus;
    summary: string;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: 'srvsql',
      title: 'SRVSQL',
      ip: b.srvsql.host || '10.0.0.25',
      status: b.srvsql.status,
      Icon: Database,
      summary: b.srvsql.sqlReachable
        ? `CPU ${b.srvsql.cpuTotalPercent ?? '--'}% · PLE ${b.srvsql.pleSeconds ?? '--'}s · Bloq ${b.srvsql.blockedRequestsCount ?? 0}`
        : b.srvsql.headline,
    },
    {
      key: 'srvfiles',
      title: 'SRVFILES',
      ip: b.srvfiles.lanIp || '10.0.0.40',
      status: b.srvfiles.status,
      Icon: HardDrive,
      summary: b.srvfiles.available
        ? `RAM livre ${formatRamGb(b.srvfiles.freeRamMb)}${filesLowestVol ? ` · ${filesLowestVol.mountPoint} ${filesLowestVol.freeGb}GB` : ''}`
        : b.srvfiles.headline,
    },
    {
      key: 'srvsiplania',
      title: b.srvsiplania.name || 'SRVSIPLANIA',
      ip: b.srvsiplania.host || '10.0.0.6',
      status: b.srvsiplania.status,
      Icon: Cpu,
      summary: b.srvsiplania.available
        ? `Portal ${b.srvsiplania.webReachable ? `${b.srvsiplania.webLatencyMs ?? 0}ms` : 'OFF'} · PG ${b.srvsiplania.postgresReachable ? `${b.srvsiplania.postgresLatencyMs ?? 0}ms` : 'OFF'}`
        : b.srvsiplania.headline,
    },
  ];

  return (
    <section
      className={`rounded-2xl border p-4 shadow-xl space-y-3 transition-all ${style.containerClass}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-9 w-9 rounded-xl border border-amber-400/25 bg-amber-500/10 text-amber-300 flex items-center justify-center shrink-0">
            <Sunrise className="h-4.5 w-4.5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                Briefing Matinal da Infraestrutura (07:15 BRT)
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${style.badgeClass}`}
              >
                <HeroIcon className="h-3 w-3" />
                {style.label}
              </span>
              {b.isOfficial0715 && (
                <span className="px-2 py-0.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px] font-semibold">
                  Oficial 07:15
                </span>
              )}
              <span className="text-[11px] font-mono text-slate-400">
                {formatShortTimeBrt(data.liveObservedAt)}
              </span>
            </div>
            <p className="text-xs text-slate-300">{b.executiveHeadline}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRefreshNow}
            disabled={isWaitingConnector}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isWaitingConnector ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>{isWaitingConnector ? 'Coletando...' : 'Atualizar Briefing'}</span>
          </button>

          <Link
            href="/sistema/briefing-matinal"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-500/30 text-xs font-semibold transition-all"
          >
            <span>Ver Briefing Completo</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {serverCards.map((srv) => {
          const pill = getServerPillBadge(srv.status);
          const SrvIcon = srv.Icon;
          return (
            <Link
              key={srv.key}
              href="/sistema/briefing-matinal"
              className="rounded-xl border border-white/10 bg-[#070B16]/85 hover:border-white/20 p-3 flex items-start justify-between gap-2 transition-colors"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <SrvIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-white">{srv.title}</span>
                  <span className="text-[11px] font-mono text-slate-500">({srv.ip})</span>
                </div>
                <div className="text-xs text-slate-300 truncate" title={srv.summary}>
                  {srv.summary}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${pill.className}`}>
                {pill.label}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
        <span className="inline-flex items-center gap-1">
          <Server className="h-3 w-3" />
          Consolidação diária automática seg–sáb às 07:15 BRT com histórico de 90 dias.
        </span>
        {data.connectorInstalledVersion && data.latestReleaseVersion && data.connectorInstalledVersion !== data.latestReleaseVersion && (
          <span className="text-amber-300 font-medium">
            Connector em {data.connectorInstalledVersion} · auto-update para {data.latestReleaseVersion} em andamento
          </span>
        )}
      </div>
    </section>
  );
}

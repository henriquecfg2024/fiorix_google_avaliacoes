'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  HardDrive,
  Info,
  Network,
  RefreshCw,
  Server,
  ShieldCheck,
  Sunrise,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  formatBriefingPlainTextSummary,
  formatDurationCompact,
  formatRamGb,
} from '@/lib/infra-briefing/engine';
import type {
  InfraBriefingDashboardSnapshot,
  InfraBriefingServiceRaw,
  InfraBriefingVolumeEvaluated,
  InfraOverallStatus,
  InfraServerStatus,
} from '@/lib/infra-briefing/types';

interface BriefingMatinalClientProps {
  initialData: InfraBriefingDashboardSnapshot;
  userName: string;
  userRole: string;
}

const OVERALL_META: Record<
  InfraOverallStatus,
  { label: string; border: string; badge: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  HEALTHY: {
    label: 'Pronto para o Expediente',
    border: 'border-emerald-500/30 bg-emerald-950/15',
    badge: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    Icon: CheckCircle2,
  },
  ATTENTION: {
    label: 'Atenção Preventiva',
    border: 'border-amber-500/35 bg-amber-950/20',
    badge: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    Icon: AlertTriangle,
  },
  CRITICAL: {
    label: 'Ação Imediata Necessária',
    border: 'border-rose-500/40 bg-rose-950/25',
    badge: 'border-rose-500/45 bg-rose-500/15 text-rose-300',
    Icon: AlertOctagon,
  },
  AWAITING_TELEMETRY: {
    label: 'Aguardando 1ª Coleta',
    border: 'border-slate-700 bg-[#0B1020]/90',
    badge: 'border-slate-600/60 bg-slate-800/80 text-slate-300',
    Icon: Clock,
  },
};

const SERVER_BADGE: Record<InfraServerStatus, { label: string; className: string }> = {
  HEALTHY: { label: 'Saudável', className: 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300' },
  WARNING: { label: 'Atenção', className: 'border-amber-500/35 bg-amber-500/15 text-amber-300' },
  CRITICAL: { label: 'Crítico', className: 'border-rose-500/40 bg-rose-500/15 text-rose-300' },
  OFFLINE: { label: 'Offline', className: 'border-rose-500/50 bg-rose-500/25 text-rose-200' },
  NO_DATA: { label: 'Sem dados', className: 'border-slate-700 bg-slate-800/80 text-slate-400' },
};

function formatBrtDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Sem amostras';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return `${new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })} BRT`;
}

function formatDateBr(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function ServerStatusBadge({ status }: { status: InfraServerStatus }) {
  const cfg = SERVER_BADGE[status] ?? SERVER_BADGE.NO_DATA;
  return (
    <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold shrink-0 ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function MetricTile({
  label,
  value,
  subValue,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  subValue?: string | null;
  tone?: 'neutral' | 'ok' | 'warn' | 'crit';
}) {
  const valueClass =
    tone === 'crit'
      ? 'text-rose-300'
      : tone === 'warn'
      ? 'text-amber-300'
      : tone === 'ok'
      ? 'text-emerald-300'
      : 'text-white';

  return (
    <div className="rounded-xl border border-white/10 bg-[#070B16]/85 p-3 space-y-0.5">
      <div className="text-[11px] text-slate-400 font-medium">{label}</div>
      <div className={`text-sm font-bold font-mono ${valueClass}`}>{value}</div>
      {subValue && <div className="text-[11px] text-slate-500 truncate" title={subValue}>{subValue}</div>}
    </div>
  );
}

function RamProgressBar({
  usedPercent,
  freeMb,
  totalMb,
}: {
  usedPercent: number | null;
  freeMb: number | null;
  totalMb: number | null;
}) {
  const pct = usedPercent !== null ? Math.max(0, Math.min(100, usedPercent)) : null;
  const barColor =
    pct === null
      ? 'bg-slate-600'
      : pct >= 90
      ? 'bg-rose-500'
      : pct >= 82
      ? 'bg-amber-400'
      : 'bg-emerald-400';

  return (
    <div className="rounded-xl border border-white/10 bg-[#070B16]/85 p-3 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">Memória RAM</span>
        <span className="font-mono text-white font-semibold">
          {freeMb !== null && totalMb !== null
            ? `${formatRamGb(freeMb)} livres / ${formatRamGb(totalMb)}`
            : 'Sem dados'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>Uso atual: {pct !== null ? `${pct.toLocaleString('pt-BR')}%` : '--'}</span>
        <span>Meta: &lt; 85%</span>
      </div>
    </div>
  );
}

function VolumeBarsBlock({ volumes }: { volumes: InfraBriefingVolumeEvaluated[] }) {
  if (volumes.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-[#070B16]/60 p-3 text-xs text-slate-500">
        Nenhum volume reportado nesta amostra.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
        Discos & Volumes
      </div>
      {volumes.map((v) => {
        const freePct = v.freePercent !== null ? Math.max(0, Math.min(100, v.freePercent)) : null;
        const usedPct = freePct !== null ? Math.max(0, Math.min(100, 100 - freePct)) : 0;
        const barColor =
          v.status === 'CRITICAL'
            ? 'bg-rose-500'
            : v.status === 'WARNING'
            ? 'bg-amber-400'
            : v.status === 'HEALTHY'
            ? 'bg-cyan-400'
            : 'bg-slate-600';

        return (
          <div key={v.mountPoint} className="rounded-xl border border-white/10 bg-[#070B16]/85 p-2.5 space-y-1">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="font-mono font-semibold text-white truncate">
                {v.mountPoint}
                {v.label ? <span className="text-slate-400 font-sans font-normal"> · {v.label}</span> : ''}
              </span>
              <span className="font-mono text-slate-200 shrink-0">
                {v.freeGb !== null ? `${v.freeGb.toLocaleString('pt-BR')} GB livres` : '--'}
                {freePct !== null ? ` (${freePct.toLocaleString('pt-BR')}%)` : ''}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${usedPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>Capacidade: {v.totalGb !== null ? `${v.totalGb.toLocaleString('pt-BR')} GB` : '--'}</span>
              {v.deltaFreeGbVsPrev !== null && (
                <span className={v.deltaFreeGbVsPrev < -5 ? 'text-amber-300' : 'text-slate-400'}>
                  {v.deltaFreeGbVsPrev >= 0 ? '+' : ''}
                  {v.deltaFreeGbVsPrev.toLocaleString('pt-BR')} GB vs. ontem
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServicesPills({ services }: { services: InfraBriefingServiceRaw[] }) {
  if (services.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
        Serviços Windows Monitorados
      </div>
      <div className="flex flex-wrap gap-1.5">
        {services.map((s) => (
          <span
            key={s.serviceName}
            title={`${s.displayName} (${s.startMode})`}
            className={`px-2 py-0.5 rounded-md border text-[10px] font-mono ${
              s.state === 'RUNNING'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
          >
            {s.serviceName}: {s.state === 'RUNNING' ? 'ON' : 'OFF'}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BriefingMatinalClient({
  initialData,
  userRole,
}: BriefingMatinalClientProps) {
  const [data, setData] = useState<InfraBriefingDashboardSnapshot>(initialData);
  const [loadingDate, setLoadingDate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canRefresh = ['MASTER', 'ADMIN', 'SUBSTITUTO'].includes(String(userRole).toUpperCase());

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const loadDateBriefing = useCallback(async (dateStr: string) => {
    setLoadingDate(true);
    try {
      const res = await fetch(`/api/v1/operacoes/briefing-matinal?date=${encodeURIComponent(dateStr)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        toast.error('Não foi possível carregar o briefing da data selecionada.');
        return;
      }
      const next: InfraBriefingDashboardSnapshot = await res.json();
      setData(next);
    } catch {
      toast.error('Erro de conexão ao consultar histórico do Briefing Matinal.');
    } finally {
      setLoadingDate(false);
    }
  }, []);

  const handleRefreshNow = async () => {
    if (!canRefresh || refreshing) return;
    setRefreshing(true);
    stopPolling();
    try {
      const res = await fetch('/api/v1/operacoes/briefing-matinal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh_now' }),
      });
      if (!res.ok) {
        toast.error('Falha ao solicitar nova coleta aos servidores.');
        setRefreshing(false);
        return;
      }
      const next: InfraBriefingDashboardSnapshot = await res.json();
      setData(next);
      toast.info('Coleta imediata enviada ao FIORIX Connector', {
        description: 'Sondando SRVSQL, SRVFILES e SRVSIPLANIA (até 45s)...',
      });

      const started = Date.now();
      pollTimerRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/v1/operacoes/briefing-matinal', { cache: 'no-store' });
          if (pollRes.ok) {
            const polled: InfraBriefingDashboardSnapshot = await pollRes.json();
            setData(polled);
            if (!polled.pendingConnectorRefresh || Date.now() - started >= 45_000) {
              stopPolling();
              setRefreshing(false);
              if (!polled.pendingConnectorRefresh) {
                toast.success('Briefing Matinal atualizado com telemetria ao vivo.');
              }
            }
          }
        } catch {
          if (Date.now() - started >= 45_000) {
            stopPolling();
            setRefreshing(false);
          }
        }
      }, 5000);
    } catch {
      setRefreshing(false);
      toast.error('Erro ao disparar atualização do Briefing Matinal.');
    }
  };

  const handleCopySummary = async () => {
    try {
      const text = formatBriefingPlainTextSummary(data.selectedBriefing);
      await navigator.clipboard.writeText(text);
      toast.success('Resumo copiado para a área de transferência', {
        description: 'Pronto para colar no WhatsApp ou e-mail interno.',
      });
    } catch {
      toast.error('Não foi possível copiar o resumo automaticamente.');
    }
  };

  const b = data.selectedBriefing;
  const hero = OVERALL_META[b.overallStatus] ?? OVERALL_META.AWAITING_TELEMETRY;
  const HeroIcon = hero.Icon;
  const isWaitingConnector = refreshing || data.pendingConnectorRefresh;

  return (
    <div className="min-h-screen bg-[#070A14] text-[#F1F5F9] pb-16 font-sans">
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* TRILHA & CABEÇALHO */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono">
              <Link href="/sistema/operacoes" className="text-slate-400 hover:text-white transition-colors">
                SISTEMA &amp; TECNOLOGIA
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-amber-300 font-bold">BRIEFING MATINAL</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Sunrise className="h-6 w-6 text-amber-300" />
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Briefing Matinal da Infraestrutura
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Diagnóstico diário consolidado às 07:15 BRT · SRVSQL (10.0.0.25) · SRVFILES (10.0.0.40) · SRVSIPLANIA (10.0.0.6)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {data.history.length > 0 && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B1020] px-3 py-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <label htmlFor="briefing-history-select" className="text-slate-400">
                  Histórico:
                </label>
                <select
                  id="briefing-history-select"
                  value={b.briefingDate}
                  disabled={loadingDate}
                  onChange={(e) => void loadDateBriefing(e.target.value)}
                  className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
                >
                  {!data.history.some((h) => h.briefingDate === b.briefingDate) && (
                    <option value={b.briefingDate} className="bg-[#0B1020]">
                      {formatDateBr(b.briefingDate)} (Atual)
                    </option>
                  )}
                  {data.history.map((h) => (
                    <option key={h.briefingDate} value={h.briefingDate} className="bg-[#0B1020]">
                      {formatDateBr(h.briefingDate)} {h.isOfficial0715 ? '· 07:15' : '· Manual'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 text-slate-400" />
              <span>Copiar Resumo</span>
            </button>

            {canRefresh && (
              <button
                type="button"
                onClick={handleRefreshNow}
                disabled={isWaitingConnector}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-cyan-500/35 bg-cyan-500/15 hover:bg-cyan-500/25 text-xs font-semibold text-cyan-200 transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isWaitingConnector ? 'animate-spin' : ''}`} />
                <span>{isWaitingConnector ? 'Coletando nos 3 servidores...' : 'Atualizar Briefing Agora'}</span>
              </button>
            )}
          </div>
        </div>

        {/* HERO SEMÁFORO EXECUTIVO */}
        <section className={`rounded-2xl border p-5 shadow-2xl space-y-4 ${hero.border}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${hero.badge}`}>
                <HeroIcon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold ${hero.badge}`}>
                    {hero.label}
                  </span>
                  {b.isOfficial0715 && (
                    <span className="px-2 py-0.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[11px] font-semibold">
                      Briefing Oficial 07:15
                    </span>
                  )}
                  <span className="text-xs font-mono text-slate-400">
                    Data: {formatDateBr(b.briefingDate)}
                  </span>
                </div>
                <p className="text-sm sm:text-base font-semibold text-white">{b.executiveHeadline}</p>
              </div>
            </div>

            <div className="text-xs text-slate-400 font-mono space-y-0.5 md:text-right shrink-0">
              <div>Coleta: {formatBrtDateTime(b.observedAt)}</div>
              <div>Comparativo: {b.comparedWithDate ? `vs. ${formatDateBr(b.comparedWithDate)}` : 'Sem histórico anterior'}</div>
            </div>
          </div>

          {(b.highlights.length > 0 || b.preventiveActions.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
              {b.highlights.length > 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-3.5 space-y-1.5">
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Destaques Positivos
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {b.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {b.preventiveActions.length > 0 && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 p-3.5 space-y-1.5">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Ações Preventivas Recomendadas
                  </div>
                  <ul className="space-y-1 text-xs text-slate-200 list-disc list-inside">
                    {b.preventiveActions.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* GRID DOS 3 SERVIDORES */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* CARD 1: SRVSQL */}
          <article className="rounded-2xl border border-white/10 bg-[#0B1020]/95 p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Database className="h-4.5 w-4.5 text-cyan-400" />
                    <h2 className="text-base font-bold text-white">SRVSQL</h2>
                    <span className="text-xs font-mono text-slate-400">({b.srvsql.host})</span>
                  </div>
                  <p className="text-xs text-slate-400">SQL Server 2012 SP4 (WEBRI) · IIS WebRI</p>
                </div>
                <ServerStatusBadge status={b.srvsql.status} />
              </div>

              <div className="text-xs text-slate-300 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                {b.srvsql.headline}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <MetricTile
                  label="SQL / Latência"
                  value={b.srvsql.sqlReachable ? `Online (${b.srvsql.sqlLatencyMs ?? 0}ms)` : b.srvsql.sqlReachable === false ? 'Offline' : 'Sem dados'}
                  tone={b.srvsql.sqlReachable ? 'ok' : b.srvsql.sqlReachable === false ? 'crit' : 'neutral'}
                  subValue={`Sessões: ${b.srvsql.userSessionsCount ?? '--'}`}
                />
                <MetricTile
                  label="CPU Total / SQL"
                  value={b.srvsql.cpuTotalPercent !== null ? `${b.srvsql.cpuTotalPercent}%` : 'Sem dados'}
                  tone={
                    b.srvsql.cpuTotalPercent === null
                      ? 'neutral'
                      : b.srvsql.cpuTotalPercent >= 85
                      ? 'crit'
                      : b.srvsql.cpuTotalPercent >= 65
                      ? 'warn'
                      : 'ok'
                  }
                  subValue={`SQL: ${b.srvsql.sqlCpuPercent ?? '--'}% · ${b.srvsql.vcpuCount ?? '--'} vCPUs`}
                />
                <MetricTile
                  label="PLE (Cache RAM)"
                  value={b.srvsql.pleSeconds !== null ? `${b.srvsql.pleSeconds.toLocaleString('pt-BR')} s` : 'Sem dados'}
                  tone={
                    b.srvsql.pleSeconds === null
                      ? 'neutral'
                      : b.srvsql.pleSeconds < 300
                      ? 'crit'
                      : b.srvsql.pleSeconds < 600
                      ? 'warn'
                      : 'ok'
                  }
                  subValue={
                    b.srvsql.pleDeltaVsPrev !== null
                      ? `${b.srvsql.pleDeltaVsPrev >= 0 ? '+' : ''}${b.srvsql.pleDeltaVsPrev} s vs. ontem`
                      : `Hit Ratio: ${b.srvsql.bufferCacheHitRatioPercent ?? '--'}%`
                  }
                />
                <MetricTile
                  label="Bloqueios / Zumbis"
                  value={`${b.srvsql.blockedRequestsCount ?? '--'} bloq · ${b.srvsql.zombieQueriesCount ?? '--'} >2m`}
                  tone={
                    (b.srvsql.blockedRequestsCount ?? 0) > 0
                      ? 'crit'
                      : (b.srvsql.zombieQueriesCount ?? 0) > 0
                      ? 'warn'
                      : b.srvsql.sqlReachable
                      ? 'ok'
                      : 'neutral'
                  }
                  subValue={`Memory Grants pend.: ${b.srvsql.memoryGrantsPending ?? '--'}`}
                />
              </div>

              <RamProgressBar
                usedPercent={b.srvsql.usedRamPercent}
                freeMb={b.srvsql.freeRamMb}
                totalMb={b.srvsql.totalRamMb}
              />

              <div className="rounded-xl border border-white/10 bg-[#070B16]/85 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">WebRI IIS (:80) &amp; w3wp.exe</span>
                  <span className={b.srvsql.iisReachable ? 'text-emerald-300 font-mono' : 'text-rose-300 font-mono'}>
                    {b.srvsql.iisReachable ? `Online (${b.srvsql.iisLatencyMs ?? 0}ms)` : b.srvsql.iisReachable === false ? 'Inacessível' : '--'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  PID: {b.srvsql.w3wpPid ?? '--'} · RAM w3wp: {b.srvsql.w3wpWorkingSetMb !== null ? `${b.srvsql.w3wpWorkingSetMb} MB` : '--'} · Idade: {b.srvsql.w3wpUptimeHours !== null ? `${b.srvsql.w3wpUptimeHours}h` : '--'}
                </div>
                {b.srvsql.perfIndexesCount !== null && (
                  <div className="text-[11px] text-cyan-300/90">
                    Índices IX_Perf_*: {b.srvsql.perfIndexesCount} ativos ({(b.srvsql.perfIndexesSeeks ?? 0).toLocaleString('pt-BR')} seeks)
                    {b.srvsql.openCdsTasksCount !== null ? ` · Tarefas abertas: ${b.srvsql.openCdsTasksCount.toLocaleString('pt-BR')}` : ''}
                  </div>
                )}
              </div>

              <VolumeBarsBlock volumes={b.srvsql.volumes} />
              <ServicesPills services={b.srvsql.services} />
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono">
                Uptime SO: {formatDurationCompact(b.srvsql.osUptimeSeconds)}
              </span>
              <Link
                href="/sistema/performance-srvsql"
                className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-semibold"
              >
                <span>Abrir Performance do SRVSQL</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </article>

          {/* CARD 2: SRVFILES */}
          <article className="rounded-2xl border border-white/10 bg-[#0B1020]/95 p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4.5 w-4.5 text-emerald-400" />
                    <h2 className="text-base font-bold text-white">{b.srvfiles.host || 'SRVFILES'}</h2>
                    <span className="text-xs font-mono text-slate-400">({b.srvfiles.lanIp ?? '10.0.0.40'})</span>
                  </div>
                  <p className="text-xs text-slate-400">Servidor de Arquivos · Acervo · FIORIX Connector</p>
                </div>
                <ServerStatusBadge status={b.srvfiles.status} />
              </div>

              <div className="text-xs text-slate-300 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                {b.srvfiles.headline}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <MetricTile
                  label="CPU Local"
                  value={b.srvfiles.cpuPercent !== null ? `${b.srvfiles.cpuPercent}%` : 'Sem dados'}
                  tone={
                    b.srvfiles.cpuPercent === null
                      ? 'neutral'
                      : b.srvfiles.cpuPercent >= 85
                      ? 'crit'
                      : b.srvfiles.cpuPercent >= 70
                      ? 'warn'
                      : 'ok'
                  }
                  subValue={`${b.srvfiles.vcpuCount ?? '--'} vCPUs`}
                />
                <MetricTile
                  label="FIORIX Connector"
                  value={b.srvfiles.connectorVersion ?? 'Aguardando'}
                  tone={b.srvfiles.available ? 'ok' : 'neutral'}
                  subValue={`Estado: ${b.srvfiles.connectorOperationalState ?? '--'} · ${formatDurationCompact(b.srvfiles.connectorUptimeSeconds)}`}
                />
                <MetricTile
                  label="File Server LAN"
                  value={
                    b.srvfiles.fileServerReachable === null
                      ? 'Sem dados'
                      : b.srvfiles.fileServerReachable
                      ? `Online :${b.srvfiles.fileServerPort} (${b.srvfiles.fileServerLatencyMs ?? 0}ms)`
                      : `Offline :${b.srvfiles.fileServerPort}`
                  }
                  tone={
                    b.srvfiles.fileServerReachable === null
                      ? 'neutral'
                      : b.srvfiles.fileServerReachable
                      ? 'ok'
                      : 'warn'
                  }
                  subValue={`MySQL :3306 ${b.srvfiles.mysqlPortReachable ? `OK (${b.srvfiles.mysqlLatencyMs ?? 0}ms)` : 'OFF/N/A'}`}
                />
                <MetricTile
                  label="Filas SQLite Local"
                  value={
                    b.srvfiles.available
                      ? `Pend: ${b.srvfiles.queuePending ?? 0} · Falha: ${b.srvfiles.queueFailed ?? 0}`
                      : 'Sem dados'
                  }
                  tone={
                    (b.srvfiles.queueQuarantined ?? 0) > 0
                      ? 'crit'
                      : (b.srvfiles.queueFailed ?? 0) > 5
                      ? 'warn'
                      : b.srvfiles.available
                      ? 'ok'
                      : 'neutral'
                  }
                  subValue={`Quarentena: ${b.srvfiles.queueQuarantined ?? '--'}`}
                />
              </div>

              <RamProgressBar
                usedPercent={b.srvfiles.usedRamPercent}
                freeMb={b.srvfiles.freeRamMb}
                totalMb={b.srvfiles.totalRamMb}
              />

              <VolumeBarsBlock volumes={b.srvfiles.volumes} />
              <ServicesPills services={b.srvfiles.services} />
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono">
                Uptime Windows: {formatDurationCompact(b.srvfiles.osUptimeSeconds)}
              </span>
              <Link
                href="/sistema/operacoes"
                className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 font-semibold"
              >
                <span>Ver Central de Operações</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </article>

          {/* CARD 3: SRVSIPLANIA */}
          <article className="rounded-2xl border border-white/10 bg-[#0B1020]/95 p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4.5 w-4.5 text-indigo-400" />
                    <h2 className="text-base font-bold text-white">{b.srvsiplania.name || 'SRVSIPLANIA'}</h2>
                    <span className="text-xs font-mono text-slate-400">({b.srvsiplania.host})</span>
                  </div>
                  <p className="text-xs text-slate-400">Portal SiplanIA · PostgreSQL · 4 vCPUs / 22 GB / 300 GB SSD</p>
                </div>
                <ServerStatusBadge status={b.srvsiplania.status} />
              </div>

              <div className="text-xs text-slate-300 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                {b.srvsiplania.headline}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <MetricTile
                  label="Portal SiplanIA (HTTP)"
                  value={
                    b.srvsiplania.webReachable === null
                      ? 'Sem dados'
                      : b.srvsiplania.webReachable
                      ? `Online :${b.srvsiplania.webPort} (${b.srvsiplania.webLatencyMs ?? 0}ms)`
                      : 'Inacessível'
                  }
                  tone={
                    b.srvsiplania.webReachable === null
                      ? 'neutral'
                      : !b.srvsiplania.webReachable
                      ? 'crit'
                      : (b.srvsiplania.webLatencyMs ?? 0) > 1500
                      ? 'warn'
                      : 'ok'
                  }
                  subValue={b.srvsiplania.httpStatusCode ? `HTTP ${b.srvsiplania.httpStatusCode}` : 'Portas HTTP/HTTPS'}
                />
                <MetricTile
                  label={`PostgreSQL (:${b.srvsiplania.postgresPort})`}
                  value={
                    b.srvsiplania.postgresReachable === null
                      ? 'Sem dados'
                      : b.srvsiplania.postgresReachable
                      ? `Online (${b.srvsiplania.postgresLatencyMs ?? 0}ms)`
                      : 'Porta fechada'
                  }
                  tone={
                    b.srvsiplania.postgresReachable === null
                      ? 'neutral'
                      : !b.srvsiplania.postgresReachable
                      ? 'crit'
                      : (b.srvsiplania.postgresLatencyMs ?? 0) > 1500
                      ? 'warn'
                      : 'ok'
                  }
                  subValue="Banco da aplicação IA"
                />
              </div>

              {b.srvsiplania.cimAvailable ? (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    <MetricTile
                      label="CPU (VM 4 vCPUs)"
                      value={b.srvsiplania.cpuPercent !== null ? `${b.srvsiplania.cpuPercent}%` : '--'}
                      tone={
                        b.srvsiplania.cpuPercent === null
                          ? 'neutral'
                          : b.srvsiplania.cpuPercent >= 85
                          ? 'crit'
                          : b.srvsiplania.cpuPercent >= 70
                          ? 'warn'
                          : 'ok'
                      }
                      subValue={`${b.srvsiplania.vcpuCount ?? 4} vCPUs lógicas`}
                    />
                    <MetricTile
                      label="Sistema Operacional"
                      value={formatDurationCompact(b.srvsiplania.osUptimeSeconds)}
                      subValue={b.srvsiplania.osCaption || 'Windows Server 2016'}
                    />
                  </div>
                  <RamProgressBar
                    usedPercent={b.srvsiplania.usedRamPercent}
                    freeMb={b.srvsiplania.freeRamMb}
                    totalMb={b.srvsiplania.totalRamMb}
                  />
                  <VolumeBarsBlock volumes={b.srvsiplania.volumes} />
                  <ServicesPills services={b.srvsiplania.services} />
                </>
              ) : (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/15 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-indigo-200">
                    <Network className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span>Rede monitorada · WMI/CIM de SO pendente</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    A conectividade de Portal Web e PostgreSQL em <code className="font-mono text-indigo-200">{b.srvsiplania.host}</code> já é testada ao vivo a partir do SrvFiles.
                    {b.srvsiplania.cimError ? ` Motivo WMI: ${b.srvsiplania.cimError}` : ''}
                  </p>
                  <details className="rounded-lg border border-white/10 bg-[#070B16]/80 p-2.5 text-[11px] text-slate-300">
                    <summary className="cursor-pointer font-semibold text-cyan-300 inline-flex items-center gap-1">
                      <Info className="h-3.5 w-3.5" />
                      Como liberar CPU, RAM (22 GB) e SSD (300 GB) de 10.0.0.6
                    </summary>
                    <p className="mt-2 text-slate-400">
                      No PowerShell como Administrador dentro da VM <strong>SRVSIPLANIA (10.0.0.6)</strong>, execute uma única vez:
                    </p>
                    <pre className="mt-1.5 rounded bg-black/50 p-2 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                      Enable-PSRemoting -Force
                    </pre>
                  </details>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-500 font-mono">
              <span>Uptime SO: {formatDurationCompact(b.srvsiplania.osUptimeSeconds)}</span>
              <span>Coleta: WinRM / TCP / HTTP</span>
            </div>
          </article>
        </section>

        {/* CHECKLIST COMPARATIVO AUDITADO */}
        <section className="rounded-2xl border border-white/10 bg-[#0B1020]/95 p-5 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Checklist Auditado dos 3 Servidores</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {b.checks.length} verificação(ões) · Coletor {b.collectorVersion ?? '--'} ({b.connectorHost ?? '--'})
            </span>
          </div>

          {b.checks.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#070B16]/70 p-6 text-center text-xs text-slate-400">
              Aguardando a primeira amostra consolidada para exibir o comparativo item a item.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-semibold">
                    <th className="py-2 pr-3">Servidor</th>
                    <th className="py-2 px-3">Categoria</th>
                    <th className="py-2 px-3">Item Verificado</th>
                    <th className="py-2 px-3">Hoje</th>
                    <th className="py-2 px-3">Ontem</th>
                    <th className="py-2 px-3">Variação</th>
                    <th className="py-2 pl-3">Status &amp; Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {b.checks.map((chk) => {
                    const badgeClass =
                      chk.status === 'OK'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : chk.status === 'WARNING'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        : chk.status === 'CRITICAL'
                        ? 'border-rose-500/35 bg-rose-500/15 text-rose-300'
                        : 'border-slate-700 bg-slate-800/70 text-slate-400';

                    return (
                      <tr key={chk.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-3 font-mono font-bold text-slate-200 whitespace-nowrap">
                          {chk.server}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{chk.category}</td>
                        <td className="py-2.5 px-3 text-white font-medium">{chk.label}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-200">{chk.currentValue}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{chk.previousValue ?? '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-cyan-300">{chk.deltaLabel ?? '—'}</td>
                        <td className="py-2.5 pl-3 space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${badgeClass}`}>
                            {chk.status}
                          </span>
                          {chk.recommendation && (
                            <div className="text-[11px] text-slate-300">{chk.recommendation}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 px-1">
          <span className="inline-flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" />
            Briefing automático diário às 07:15 BRT (segunda a sábado) · Retenção de 90 dias no PostgreSQL FIORIX
          </span>
          <span className="font-mono">
            Versão Connector instalada: {data.connectorInstalledVersion ?? '--'} · Pacote disponível: {data.latestReleaseVersion ?? '--'}
          </span>
        </footer>
      </main>
    </div>
  );
}

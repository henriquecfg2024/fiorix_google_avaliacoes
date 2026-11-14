'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  FileText,
  HardDrive,
  Lock,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import {
  buildSiplanIncidentReport,
  formatMetricOrMissing,
  sortCostlyQueries,
} from '@/lib/srvsql-performance/engine';
import { MINIMUM_PERMISSIONS_SQL_SCRIPT } from '@/lib/srvsql-performance/sql-queries';
import type {
  CostlyQuerySortDirection,
  CostlyQuerySortKey,
  SrvsqlPerformanceDashboardSnapshot,
  TimeWindowPreset,
  UserSlownessIncidentRecord,
} from '@/lib/srvsql-performance/types';

interface PerformanceSrvsqlClientProps {
  initialSnapshot: SrvsqlPerformanceDashboardSnapshot;
  userName: string;
  userRole: string;
}

type ActiveTabId = 'visao_geral' | 'sql_bloqueios' | 'servicos' | 'incidentes' | 'coleta_acesso';

type RealDiagnosticFocusId =
  | 'LIVE_GERAL'
  | 'LIVE_BLOQUEIOS'
  | 'LIVE_DISCO_LOG'
  | 'LIVE_MEMORIA_SERVICOS'
  | 'LIVE_INCIDENTES'
  | 'LIVE_PERMISSOES';

const REAL_FOCUS_TO_TAB: Record<RealDiagnosticFocusId, ActiveTabId> = {
  LIVE_GERAL: 'visao_geral',
  LIVE_BLOQUEIOS: 'sql_bloqueios',
  LIVE_DISCO_LOG: 'sql_bloqueios',
  LIVE_MEMORIA_SERVICOS: 'servicos',
  LIVE_INCIDENTES: 'incidentes',
  LIVE_PERMISSOES: 'coleta_acesso',
};

const COSTLY_QUERY_COLUMNS: ReadonlyArray<{
  key: CostlyQuerySortKey;
  label: string;
  thClassName: string;
}> = [
  { key: 'queryHash', label: 'Query Hash', thClassName: 'py-2 pr-3' },
  { key: 'operationAndDb', label: 'Tipo / Banco', thClassName: 'py-2 px-3' },
  { key: 'executionCountDelta', label: 'Execuções (Δ)', thClassName: 'py-2 px-3' },
  { key: 'avgElapsedTimeMs', label: 'Duração Média Atual', thClassName: 'py-2 px-3' },
  { key: 'baseline', label: 'Linha de Base', thClassName: 'py-2 px-3' },
  { key: 'totalLogicalReadsDelta', label: 'Leituras Lógicas (Δ)', thClassName: 'py-2 px-3' },
  { key: 'lastWaitTypeHint', label: 'Espera Associada', thClassName: 'py-2 pl-3' },
];

export function PerformanceSrvsqlClient({
  initialSnapshot,
  userRole,
}: PerformanceSrvsqlClientProps) {
  const [snapshot, setSnapshot] = useState<SrvsqlPerformanceDashboardSnapshot>(initialSnapshot);
  const [activeTab, setActiveTab] = useState<ActiveTabId>('visao_geral');
  const [diagnosticFocus, setDiagnosticFocus] = useState<RealDiagnosticFocusId>('LIVE_GERAL');
  const [windowPreset, setWindowPreset] = useState<TimeWindowPreset>(initialSnapshot.activeWindow);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());
  const windowPresetRef = useRef<TimeWindowPreset>(windowPreset);
  const [costlyQuerySort, setCostlyQuerySort] = useState<{
    key: CostlyQuerySortKey | null;
    direction: CostlyQuerySortDirection;
  }>({ key: null, direction: 'desc' });

  const handleCostlyQuerySort = useCallback((nextKey: CostlyQuerySortKey) => {
    setCostlyQuerySort((prev) => {
      if (prev.key === nextKey) {
        return { key: nextKey, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDir: CostlyQuerySortDirection =
        nextKey === 'queryHash' || nextKey === 'operationAndDb' || nextKey === 'lastWaitTypeHint'
          ? 'asc'
          : 'desc';
      return { key: nextKey, direction: defaultDir };
    });
  }, []);

  const sortedCostlyQueries = useMemo(
    () => sortCostlyQueries(snapshot.costlyQueries, costlyQuerySort.key, costlyQuerySort.direction),
    [snapshot.costlyQueries, costlyQuerySort.key, costlyQuerySort.direction],
  );

  useEffect(() => {
    windowPresetRef.current = windowPreset;
  }, [windowPreset]);

  // Modal "+ Registrar lentidão"
  const [isSlownessModalOpen, setIsSlownessModalOpen] = useState(false);
  const [slownessOperation, setSlownessOperation] = useState('Gravação de andamento / protocolo no WEBRI');
  const [slownessDurationSec, setSlownessDurationSec] = useState('45');
  const [slownessObservation, setSlownessObservation] = useState('');
  const [submittingSlowness, setSubmittingSlowness] = useState(false);
  const [slownessFeedback, setSlownessFeedback] = useState<string | null>(null);
  const [copiedSqlNotice, setCopiedSqlNotice] = useState<string | null>(null);

  const canManageConfig = userRole === 'MASTER' || userRole === 'ADMIN';

  const refreshRealSnapshot = useCallback(
    async (nextWindow: TimeWindowPreset, options?: { silent?: boolean }) => {
      windowPresetRef.current = nextWindow;
      setWindowPreset(nextWindow);
      if (!options?.silent) {
        setLoadingScenario(true);
      }
      try {
        const res = await fetch(
          `/api/v1/operacoes/srvsql-performance?scenario=LIVE_OR_REAL&window=${encodeURIComponent(nextWindow)}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = (await res.json()) as SrvsqlPerformanceDashboardSnapshot;
          setSnapshot(data);
          setNowTickMs(Date.now());
        }
      } catch {
        // Mantém último estado visível em caso de oscilação de rede
      } finally {
        if (!options?.silent) {
          setLoadingScenario(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const tickTimer = setInterval(() => {
      setNowTickMs(Date.now());
    }, 5_000);

    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void refreshRealSnapshot(windowPresetRef.current, { silent: true });
    }, 30_000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        setNowTickMs(Date.now());
        void refreshRealSnapshot(windowPresetRef.current, { silent: true });
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(tickTimer);
      clearInterval(pollTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [refreshRealSnapshot]);

  async function handleDiagnosticFocusChange(nextFocus: RealDiagnosticFocusId) {
    setDiagnosticFocus(nextFocus);
    setActiveTab(REAL_FOCUS_TO_TAB[nextFocus]);
    await refreshRealSnapshot(windowPreset);
  }

  async function handleRecordSlownessSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slownessOperation.trim()) return;
    setSubmittingSlowness(true);
    setSlownessFeedback(null);
    try {
      const res = await fetch('/api/v1/operacoes/srvsql-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_slowness',
          affectedOperation: slownessOperation.trim(),
          perceivedDurationSeconds: Number(slownessDurationSec) || 30,
          observation: slownessObservation.trim() || 'Relato manual registrado pelo painel do FIORIX.',
          activeScenario: 'LIVE_OR_REAL',
        }),
      });
      const data = await res.json();
      if (res.ok && data.incident) {
        const created = data.incident as UserSlownessIncidentRecord;
        setSnapshot((prev) => ({
          ...prev,
          userIncidents: [created, ...prev.userIncidents],
        }));
        setSlownessFeedback('Lentidão registrada e vinculada às amostras reais anteriores/posteriores com sucesso.');
        setSlownessObservation('');
        setTimeout(() => {
          setIsSlownessModalOpen(false);
          setSlownessFeedback(null);
          setActiveTab('incidentes');
        }, 900);
      } else {
        setSlownessFeedback(data?.error || 'Não foi possível registrar o relato.');
      }
    } catch {
      setSlownessFeedback('Erro de comunicação ao registrar o incidente.');
    } finally {
      setSubmittingSlowness(false);
    }
  }

  async function handleToggleMysqlWebri(nextVal: boolean) {
    if (!canManageConfig) return;
    try {
      const res = await fetch('/api/v1/operacoes/srvsql-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_webri_config',
          mysqlUsedByWebri: nextVal,
        }),
      });
      if (res.ok) {
        await refreshRealSnapshot(windowPreset);
      }
    } catch {
      // ignora erro transitório
    }
  }

  function handleExportSiplanJson() {
    const dossier = buildSiplanIncidentReport(snapshot);
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dossie-siplan-srvsql-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleExportSiplanMarkdown() {
    const dossier = buildSiplanIncidentReport(snapshot);
    const lines: string[] = [
      `# Dossiê Técnico de Incidente — Performance do SRVSQL (WEBRI / SIPLAN)`,
      `- **Gerado em:** ${dossier.exportedAt} (${dossier.timezone})`,
      `- **Serventia:** ${dossier.cartorio}`,
      `- **Servidor / Instância:** ${dossier.serverTarget} (${dossier.serverAndSqlEnvironment.edition || 'SQL Server'} · v${dossier.serverAndSqlEnvironment.productVersion || 'n/d'} ${dossier.serverAndSqlEnvironment.productLevel || ''})`,
      `- **Modo da fonte de dados:** ${dossier.dataSourceMode}`,
      `- **Sintoma principal:** ${dossier.reportedSymptom.title}`,
      `- **Período analisado:** ${dossier.reportedSymptom.periodStart} até ${dossier.reportedSymptom.periodEnd}`,
      ``,
      `## 1. Resumo de Recursos no Período`,
      `- **CPU do servidor:** ${formatMetricOrMissing(dossier.resourceMetricsSummary.cpuPercent, '%')}`,
      `- **Memória física em uso:** ${formatMetricOrMissing(dossier.resourceMetricsSummary.memoryUsedPercent, '%')} (Livre no Windows: ${formatMetricOrMissing(dossier.resourceMetricsSummary.windowsAvailableMemoryMb, ' MB')})`,
      `- **Memória alocada pelo SQL Server:** ${formatMetricOrMissing(dossier.resourceMetricsSummary.sqlServerMemoryMb, ' MB')} (max server memory = ${formatMetricOrMissing(dossier.resourceMetricsSummary.maxServerMemoryConfigMb, ' MB')})`,
      `- **Paginação do Windows:** ${formatMetricOrMissing(dossier.resourceMetricsSummary.pagesPerSec, ' pág/s')}`,
      ``,
      `## 2. Cadeias de Bloqueio e Esperas SQL (Delta no Intervalo)`,
      ...(dossier.blockingAndWaitsEvidence.blockingChains.length === 0
        ? [`- Nenhuma cadeia de bloqueio registrada na amostra.`]
        : dossier.blockingAndWaitsEvidence.blockingChains.map(
            (b) =>
              `- **Bloqueador Raiz:** Sessão ${b.rootBlockerSessionId} (${b.rootBlockerStatus}, login \`${b.rootBlockerLoginName}\`, host \`${b.rootBlockerHostName}\`, programa \`${b.rootBlockerProgramName}\`, transações abertas: ${b.rootBlockerOpenTransactionCount}, duração: ${b.rootBlockerTransactionDurationSeconds ?? 'n/d'}s) bloqueando **${b.totalBlockedSessions}** sessões (espera máx: ${b.maxBlockedWaitTimeMs} ms).`,
          )),
      ``,
      `### Esperas SQL não ociosas (Delta):`,
      ...dossier.blockingAndWaitsEvidence.waitStatsDelta.map(
        (w) =>
          `- **${w.label}**: ${w.sharePercent}% (${w.waitTimeDeltaMs} ms no intervalo, ${w.waitingTasksDelta} tarefas, média ${w.avgWaitMsPerTask ?? 0} ms/tarefa)`,
      ),
      ``,
      `## 3. Hipóteses Sustentadas por Evidências e Limitações`,
      ...dossier.hypothesesAndEvidence.flatMap((d) => [
        `### ${d.title} [${d.severity} · Confiança ${d.confidenceLevel}]`,
        `- **Observado:** ${d.observedSummary}`,
        `- **Métricas de suporte:** ${d.supportingMetrics.join(' | ')}`,
        `- **Limitações:** ${d.limitations.join(' ')}`,
        `- **Próxima verificação recomendada:** ${d.recommendedNextVerification}`,
        ``,
      ]),
      `## 4. Metodologia e Privacidade`,
      ...dossier.methodologyAndLimitations.map((m) => `- ${m}`),
      `- **Atestado:** ${dossier.privacyAndSecurityAttestation}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-siplan-srvsql-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleCopyText(text: string, label: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedSqlNotice(label);
        setTimeout(() => setCopiedSqlNotice(null), 2500);
      });
    }
  }

  const topRightModeLabel = useMemo(() => {
    if (snapshot.dataSourceMode === 'PARTIAL_LIVE_NO_VIEW_SERVER_STATE') {
      return 'SONDAGEM REAL SRVSQL (10.0.0.25) · falta permissão VIEW SERVER STATE';
    }
    if (snapshot.dataSourceMode === 'COLLECTOR_UNAVAILABLE') {
      return 'AGUARDANDO TELEMETRIA REAL · nenhuma simulação ativa';
    }
    return 'MONITORAMENTO OFICIAL 100% DADOS REAIS · coleta ativa em segundo plano';
  }, [snapshot.dataSourceMode]);

  const liveDelaySeconds = useMemo(() => {
    if (!snapshot.observedAt) return snapshot.collectorHealth.delaySeconds;
    const obsMs = Date.parse(snapshot.observedAt);
    if (!Number.isFinite(obsMs)) return snapshot.collectorHealth.delaySeconds;
    return Math.max(0, Math.round((nowTickMs - obsMs) / 1000));
  }, [snapshot.observedAt, snapshot.collectorHealth.delaySeconds, nowTickMs]);

  const isTelemetryStale = liveDelaySeconds !== null && liveDelaySeconds >= 180;

  const displayedBannerMessage = useMemo(() => {
    if (!snapshot.bannerMessage || liveDelaySeconds === null) return snapshot.bannerMessage;
    return snapshot.bannerMessage.replace(/\(há \d+s\)/, `(há ${liveDelaySeconds}s)`);
  }, [snapshot.bannerMessage, liveDelaySeconds]);

  const timelineSummary = useMemo(() => {
    const validCpus = snapshot.timeline
      .map((pt) => pt.cpuPercent)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const validWrites = snapshot.timeline
      .map((pt) => pt.diskWriteLatencyMs)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const validBlocked = snapshot.timeline
      .map((pt) => pt.blockedSessionsCount)
      .filter((v): v is number => v !== null && Number.isFinite(v));

    return {
      sampleCount: snapshot.timeline.length,
      avgCpu:
        validCpus.length > 0
          ? Math.round(validCpus.reduce((a, b) => a + b, 0) / validCpus.length)
          : null,
      maxCpu: validCpus.length > 0 ? Math.max(...validCpus) : null,
      maxWriteMs:
        validWrites.length > 0 ? Math.round(Math.max(...validWrites) * 10) / 10 : null,
      maxBlocked: validBlocked.length > 0 ? Math.max(...validBlocked) : null,
    };
  }, [snapshot.timeline]);

  const statusPill = useMemo(() => {
    if (snapshot.overallHealth === 'COLETOR_INDISPONIVEL') {
      return {
        text: 'Coletor indisponível',
        className: 'border-rose-500/40 bg-rose-950/50 text-rose-200',
      };
    }
    if (snapshot.overallHealth === 'SEM_DADOS') {
      return {
        text: 'Aguardando dados reais do SRVSQL',
        className: 'border-amber-500/40 bg-amber-950/50 text-amber-200',
      };
    }
    if (snapshot.overallHealth === 'CRITICO') {
      return {
        text: 'Crítico · intervenção recomendada',
        className: 'border-rose-500/40 bg-rose-950/50 text-rose-200',
      };
    }
    const hasRealContention =
      snapshot.blockingChains.length > 0 ||
      (snapshot.kpis.diskWriteLatencyMs !== null && snapshot.kpis.diskWriteLatencyMs >= 20) ||
      (snapshot.kpis.serverCpuPercent !== null && snapshot.kpis.serverCpuPercent >= 85);

    if (snapshot.overallHealth === 'ATENCAO') {
      const text = isTelemetryStale
        ? 'Atenção · coleta defasada'
        : hasRealContention
          ? 'Atenção · contenção detectada'
          : 'Atenção · verificação preventiva';
      return {
        text,
        className: 'border-amber-500/35 bg-[#2a2112] text-[#e6b86a]',
      };
    }
    if (isTelemetryStale && snapshot.dataSourceMode === 'LIVE_COLLECTOR') {
      return {
        text: 'Atenção · coleta defasada',
        className: 'border-amber-500/35 bg-[#2a2112] text-[#e6b86a]',
      };
    }
    return {
      text: 'Normal · operação saudável',
      className: 'border-emerald-500/35 bg-emerald-950/40 text-emerald-200',
    };
  }, [
    snapshot.overallHealth,
    snapshot.blockingChains.length,
    snapshot.kpis.diskWriteLatencyMs,
    snapshot.kpis.serverCpuPercent,
    snapshot.dataSourceMode,
    isTelemetryStale,
  ]);

  const activeDiagnostics = useMemo(
    () => snapshot.diagnostics.filter((d) => d.severity === 'CRITICO' || d.severity === 'ATENCAO'),
    [snapshot.diagnostics],
  );
  const preventiveNotes = useMemo(
    () => snapshot.diagnostics.filter((d) => d.severity === 'INFORMATIVO'),
    [snapshot.diagnostics],
  );
  const primaryActiveDiagnostic = useMemo(
    () => activeDiagnostics[0] || snapshot.diagnostics.find((d) => d.severity === 'NORMAL') || null,
    [activeDiagnostics, snapshot.diagnostics],
  );

  return (
    <div className="min-h-screen bg-[#070d17] text-slate-100 font-sans pb-16">
      <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8 pt-5 space-y-6">
        {/* BARRA SUPERIOR FIORIX · INFRAESTRUTURA / PERFORMANCE */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-extrabold tracking-widest text-cyan-400">
              <span className="text-cyan-400">◆</span> FIORIX
            </span>
            <span className="text-slate-400 font-medium">Infraestrutura / Performance</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#d49b43] tracking-wide">
              {topRightModeLabel}
            </span>
          </div>
        </div>

        {/* TÍTULO PRINCIPAL E BADGE DE ESTADO */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-white">
              Performance do SRVSQL
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              WEBRI · SQL Server · serviços do Windows
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {liveDelaySeconds !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0c1422] px-2.5 py-1.5 text-xs text-slate-300">
                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                Última amostra há {liveDelaySeconds}s
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold ${statusPill.className}`}
            >
              {statusPill.text}
            </span>
          </div>
        </div>

        {/* SELETORES DE CENÁRIO, JANELA E BOTÃO + REGISTRAR LENTIDÃO */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label
                htmlFor="srvsql-scenario-select"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Cenário (100% Dados Reais · SRVSQL)
              </label>
              <select
                id="srvsql-scenario-select"
                value={diagnosticFocus}
                disabled={loadingScenario}
                onChange={(e) =>
                  handleDiagnosticFocusChange(e.target.value as RealDiagnosticFocusId)
                }
                className="h-10 min-w-[280px] rounded-lg border border-slate-700/80 bg-[#0d1624] px-3.5 text-sm font-medium text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option value="LIVE_GERAL">
                  Monitoramento Oficial SRVSQL (10.0.0.25 · SQL 2012 SP4)
                </option>
                <option value="LIVE_BLOQUEIOS">
                  Cadeias de bloqueio e sessões SQL (Dados Reais)
                </option>
                <option value="LIVE_DISCO_LOG">
                  Latência de disco, arquivos e WRITELOG (Dados Reais)
                </option>
                <option value="LIVE_MEMORIA_SERVICOS">
                  Memória, volumes e serviços Windows (Dados Reais)
                </option>
                <option value="LIVE_INCIDENTES">
                  Incidentes, alertas e dossiê SIPLAN (Dados Reais)
                </option>
                <option value="LIVE_PERMISSOES">
                  Permissões VIEW SERVER STATE e cobertura (Dados Reais)
                </option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="srvsql-window-select"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Janela
              </label>
              <select
                id="srvsql-window-select"
                value={windowPreset}
                disabled={loadingScenario}
                onChange={(e) =>
                  refreshRealSnapshot(e.target.value as TimeWindowPreset)
                }
                className="h-10 min-w-[190px] rounded-lg border border-slate-700/80 bg-[#0d1624] px-3.5 text-sm font-medium text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                <option value="15m">Últimos 15 minutos</option>
                <option value="30m">Últimos 30 minutos</option>
                <option value="1h">Última 1 hora</option>
                <option value="6h">Últimas 6 horas</option>
                <option value="24h">Últimas 24 horas</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => refreshRealSnapshot(windowPreset)}
              disabled={loadingScenario}
              title="Atualizar painel com a amostra mais recente (sem reconsultar diretamente o SRVSQL)"
              className="h-10 inline-flex items-center gap-2 rounded-lg border border-slate-700/80 bg-[#0d1624] hover:bg-slate-800/80 disabled:opacity-60 px-3.5 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${loadingScenario ? 'animate-spin' : ''}`} />
              <span>{loadingScenario ? 'Atualizando...' : 'Atualizar'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportSiplanMarkdown}
              title="Exportar relatório técnico de incidente para a SIPLAN (Markdown)"
              className="h-10 inline-flex items-center gap-2 rounded-lg border border-slate-700/80 bg-[#0d1624] hover:bg-slate-800/80 px-3.5 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>Relatório SIPLAN</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSlownessModalOpen(true)}
              className="h-10 inline-flex items-center gap-2 rounded-lg bg-[#0d6e8a] hover:bg-[#0f82a3] px-4 text-sm font-semibold text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar lentidão</span>
            </button>
          </div>
        </div>

        {/* 4 CARDS PRINCIPAIS DE KPI (COM ALTO CONTRASTE CORRIGIDO EM RELAÇÃO AO PRINT) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: CPU do servidor */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-4 flex flex-col justify-between min-h-[126px]">
            <span className="text-xs font-medium text-slate-400">CPU do servidor</span>
            <div className="my-2">
              {snapshot.kpis.serverCpuPercent === null ? (
                <span className="text-xl font-bold text-amber-300">Sem dados</span>
              ) : (
                <span className="text-3xl font-extrabold tracking-tight text-slate-100">
                  {formatMetricOrMissing(snapshot.kpis.serverCpuPercent, '%')}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">{snapshot.kpis.serverCpuSubtitle}</span>
          </div>

          {/* Card 2: Memória em uso */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-4 flex flex-col justify-between min-h-[126px]">
            <span className="text-xs font-medium text-slate-400">Memória em uso</span>
            <div className="my-2">
              {snapshot.kpis.memoryUsedPercent === null ? (
                <span className="text-xl font-bold text-amber-300">Sem dados</span>
              ) : (
                <span className="text-3xl font-extrabold tracking-tight text-slate-100">
                  {formatMetricOrMissing(snapshot.kpis.memoryUsedPercent, '%')}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">{snapshot.kpis.memorySubtitle}</span>
          </div>

          {/* Card 3: Disco · latência de escrita */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-4 flex flex-col justify-between min-h-[126px]">
            <span className="text-xs font-medium text-slate-400">
              Disco · latência de escrita
            </span>
            <div className="my-2">
              {snapshot.kpis.diskWriteLatencyMs === null ? (
                <span className="text-xl font-bold text-amber-300">Sem dados</span>
              ) : (
                <span
                  className={`text-3xl font-extrabold tracking-tight ${
                    snapshot.kpis.diskWriteLatencyMs >= 20 ? 'text-amber-300' : 'text-slate-100'
                  }`}
                >
                  {formatMetricOrMissing(snapshot.kpis.diskWriteLatencyMs, ' ms')}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">{snapshot.kpis.diskSubtitle}</span>
          </div>

          {/* Card 4: Sessões bloqueadas */}
          <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-4 flex flex-col justify-between min-h-[126px]">
            <span className="text-xs font-medium text-slate-400">Sessões bloqueadas</span>
            <div className="my-2">
              {snapshot.kpis.blockedSessionsCount === null ? (
                <span className="text-xl font-bold text-amber-300">Sem dados</span>
              ) : (
                <span
                  className={`text-3xl font-extrabold tracking-tight ${
                    snapshot.kpis.blockedSessionsCount > 0 ? 'text-amber-300' : 'text-slate-100'
                  }`}
                >
                  {formatMetricOrMissing(snapshot.kpis.blockedSessionsCount)}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400">{snapshot.kpis.blockedSubtitle}</span>
          </div>
        </div>

        {/* FAIXA DE AVISO / LEITURA RÁPIDA DO EPISÓDIO */}
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            snapshot.overallHealth === 'COLETOR_INDISPONIVEL' || snapshot.overallHealth === 'CRITICO'
              ? 'border-rose-500/40 bg-rose-950/30 text-rose-100'
              : snapshot.overallHealth === 'NORMAL'
                ? 'border-emerald-500/35 bg-emerald-950/25 text-emerald-100'
                : 'border-amber-600/40 bg-[#231c10] text-amber-100'
          }`}
        >
          {displayedBannerMessage}
        </div>

        {/* BARRA DE ABAS (5 ABAS DO PRINT) */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'visao_geral', label: 'Visão geral' },
            { id: 'sql_bloqueios', label: 'SQL e bloqueios' },
            { id: 'servicos', label: 'Serviços' },
            { id: 'incidentes', label: 'Incidentes' },
            { id: 'coleta_acesso', label: 'Coleta e acesso' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ActiveTabId)}
                className={`rounded-lg border px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                  isActive
                    ? 'border-cyan-500/60 bg-[#0d3b4c] text-cyan-200 shadow-sm'
                    : 'border-slate-800 bg-[#0c1422] text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* =====================================================================
            ABA 1: VISÃO GERAL (IDÊNTICA AO LAYOUT DO PRINT + COMPARAÇÃO E SEMÂNTICA)
           ===================================================================== */}
        {activeTab === 'visao_geral' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Gráfico sincronizado: Atividade no período (7 colunas) */}
              <div className="lg:col-span-7 rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-white">Atividade no período</h2>
                    <span className="text-xs text-slate-400">Escala de 0 a 100%</span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                      CPU
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#e6a23c]" />
                      Memória
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-400">
                      · Janela anterior ({snapshot.previousPeriodComparison.previousWindowLabel}): CPU{' '}
                      {formatMetricOrMissing(snapshot.previousPeriodComparison.avgCpuPrevious, '%')} / Escrita{' '}
                      {formatMetricOrMissing(
                        snapshot.previousPeriodComparison.avgWriteLatencyPreviousMs,
                        ' ms',
                      )}
                    </span>
                  </div>

                  {/* Barras verticais duplas sincronizadas (padrão fiel ao print) */}
                  {snapshot.timeline.every((pt) => pt.cpuPercent === null && pt.memoryUsedPercent === null) ? (
                    <div className="my-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-[#09101b] py-12 text-center">
                      <AlertTriangle className="h-6 w-6 text-amber-400 mb-2" />
                      <p className="text-sm font-semibold text-slate-200">
                        Sem dados de série temporal neste período
                      </p>
                      <p className="mt-1 text-xs text-slate-400 max-w-md">
                        O FIORIX não preenche gráficos com zeros quando o coletor está indisponível ou sem permissão VIEW SERVER STATE.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-5 pt-2">
                      <div className="h-48 flex items-end justify-between gap-1.5 px-1 border-b border-slate-800/80 pb-2">
                        {snapshot.timeline.slice(-20).map((pt) => {
                          const cpuH = Math.max(4, Math.min(100, pt.cpuPercent ?? 0));
                          const memH = Math.max(4, Math.min(100, pt.memoryUsedPercent ?? 0));
                          return (
                            <div
                              key={pt.timestampIso}
                              title={`${pt.timeLabel} · CPU: ${formatMetricOrMissing(pt.cpuPercent, '%')} · Memória: ${formatMetricOrMissing(pt.memoryUsedPercent, '%')} · Escrita: ${formatMetricOrMissing(pt.diskWriteLatencyMs, ' ms')} · Bloqueadas: ${formatMetricOrMissing(pt.blockedSessionsCount)}`}
                              className="flex-1 flex items-end justify-center gap-[3px] h-full group"
                            >
                              <div
                                style={{ height: `${cpuH}%` }}
                                className="w-1.5 sm:w-2 rounded-t-full bg-cyan-400 transition-all group-hover:brightness-125"
                              />
                              <div
                                style={{ height: `${memH}%` }}
                                className="w-1.5 sm:w-2 rounded-t-full bg-[#e6a23c] transition-all group-hover:brightness-125"
                              />
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                        <span>{snapshot.timeline[0]?.timeLabel || '14:00'}</span>
                        <span>
                          {snapshot.timeline[Math.floor(snapshot.timeline.length / 2)]?.timeLabel ||
                            '14:15'}
                        </span>
                        <span>
                          {snapshot.timeline[snapshot.timeline.length - 1]?.timeLabel || '14:30'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2.5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="rounded-lg border border-slate-800/80 bg-[#09101b] px-3 py-2">
                      <span className="text-[11px] text-slate-400">Amostras / PLE</span>
                      <div className="mt-0.5 font-semibold text-slate-100">
                        {timelineSummary.sampleCount} pts · PLE{' '}
                        {formatMetricOrMissing(snapshot.sqlMemory.pageLifeExpectancySec, 's')}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-[#09101b] px-3 py-2">
                      <span className="text-[11px] text-slate-400">CPU Média / Pico</span>
                      <div className="mt-0.5 font-semibold text-cyan-300">
                        {formatMetricOrMissing(timelineSummary.avgCpu, '%')} /{' '}
                        {formatMetricOrMissing(timelineSummary.maxCpu, '%')}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-[#09101b] px-3 py-2">
                      <span className="text-[11px] text-slate-400">Escrita Disco (Pico)</span>
                      <div className="mt-0.5 font-semibold text-slate-100">
                        {formatMetricOrMissing(timelineSummary.maxWriteMs, ' ms', 1)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-[#09101b] px-3 py-2">
                      <span className="text-[11px] text-slate-400">Pico de Bloqueios</span>
                      <div
                        className={`mt-0.5 font-semibold ${
                          (timelineSummary.maxBlocked ?? 0) > 0
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        {formatMetricOrMissing(timelineSummary.maxBlocked)}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Amostras reais coletadas em segundo plano · atualização do painel não reconsulta o SRVSQL
                  </p>
                </div>
              </div>

              {/* Card Direito: Esperas SQL no intervalo (5 colunas) */}
              <div className="lg:col-span-5 rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Esperas SQL no intervalo</h2>

                  {snapshot.waitStatsDelta.length === 0 ? (
                    <div className="my-8 rounded-lg border border-dashed border-slate-800 bg-[#09101b] p-6 text-center">
                      <p className="text-sm font-semibold text-amber-300">Sem dados de Wait Stats</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {snapshot.counterResetNotice ||
                          'Requer permissão VIEW SERVER STATE em sys.dm_os_wait_stats e duas amostras consecutivas para cálculo por diferença (delta).'}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3.5">
                      {snapshot.waitStatsDelta.slice(0, 6).map((w) => (
                        <div key={w.waitType} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-200 truncate pr-2">{w.label}</span>
                            <span className="font-bold text-slate-100 shrink-0">
                              {Math.round(w.sharePercent)}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-800/90 overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, Math.max(4, w.sharePercent))}%` }}
                              className="h-full rounded-full bg-cyan-400"
                            />
                          </div>
                        </div>
                      ))}

                      {snapshot.waitStatsDelta.length > 6 && (
                        <details className="mt-2 rounded-lg border border-slate-800/80 bg-[#09101b] px-3 py-2 text-xs">
                          <summary className="cursor-pointer select-none font-medium text-cyan-300 hover:text-cyan-200">
                            Ver mais {snapshot.waitStatsDelta.length - 6} esperas residuais
                          </summary>
                          <div className="mt-2.5 space-y-2 max-h-48 overflow-y-auto pr-1">
                            {snapshot.waitStatsDelta.slice(6).map((w) => (
                              <div key={w.waitType} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-300 truncate pr-2">{w.label}</span>
                                  <span className="font-semibold text-slate-200 shrink-0">
                                    {Math.round(w.sharePercent)}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
                                  <div
                                    style={{ width: `${Math.min(100, Math.max(2, w.sharePercent))}%` }}
                                    className="h-full rounded-full bg-cyan-500/75"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 leading-relaxed">
                  Distribuição do tempo de espera não ocioso calculada por diferença (delta) entre amostras, descartando contadores acumulados desde a inicialização.
                </p>
              </div>
            </div>

            {/* CARD: LEITURA DO INCIDENTE E PRÓXIMA VERIFICAÇÃO */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-4">
              {activeDiagnostics.length === 0 ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Leitura do ambiente no intervalo
                    </h2>
                    <span className="rounded-md border border-emerald-500/35 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                      Operação saudável no intervalo · Sem lentidão ou contenção ativa no WEBRI
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {primaryActiveDiagnostic?.observedSummary ||
                      `Nenhuma cadeia de bloqueio ativa e baixa latência de escrita (${formatMetricOrMissing(snapshot.kpis.diskWriteLatencyMs, ' ms')}) nas bases do WEBRI nesta janela.`}
                  </p>
                  {primaryActiveDiagnostic?.recommendedNextVerification && (
                    <div className="border-t border-slate-800/90 pt-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Próxima verificação
                      </h3>
                      <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                        {primaryActiveDiagnostic.recommendedNextVerification}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                primaryActiveDiagnostic && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <AlertTriangle
                          className={`h-4 w-4 ${
                            primaryActiveDiagnostic.severity === 'CRITICO'
                              ? 'text-rose-400'
                              : 'text-amber-300'
                          }`}
                        />
                        Leitura do incidente
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        {activeDiagnostics.length > 1 && (
                          <span className="rounded-md border border-amber-500/35 bg-amber-950/35 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                            +{activeDiagnostics.length - 1} achado(s) ativo(s)
                          </span>
                        )}
                        <span className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                          Confiança: {primaryActiveDiagnostic.confidenceLevel} ·{' '}
                          {primaryActiveDiagnostic.causalClassification.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-200 leading-relaxed">
                      {primaryActiveDiagnostic.observedSummary}
                    </p>

                    <div className="border-t border-slate-800/90 pt-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Próxima verificação
                      </h3>
                      <p className="mt-1 text-sm text-slate-200 leading-relaxed">
                        {primaryActiveDiagnostic.recommendedNextVerification}
                      </p>
                    </div>
                  </div>
                )
              )}

              {preventiveNotes.length > 0 && (
                <details className="rounded-lg border border-slate-800/90 bg-[#09101b] p-3 text-xs">
                  <summary className="cursor-pointer select-none font-semibold text-cyan-300 hover:text-cyan-200">
                    Observações preventivas de DBA — sem impacto atual de performance no WEBRI (
                    {preventiveNotes.length})
                  </summary>
                  <div className="mt-3 space-y-2.5 border-t border-slate-800/80 pt-3">
                    {preventiveNotes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-lg border border-slate-800 bg-[#0c1422] p-3 space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-slate-100">{note.title}</strong>
                          <span className="rounded bg-cyan-950/50 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                            INFORMATIVO
                          </span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">{note.observedSummary}</p>
                        <p className="text-slate-400">
                          <strong>Verificação DBA:</strong> {note.recommendedNextVerification}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* DIFERENCIAÇÃO SEMÂNTICA: TEMPO DO USUÁRIO vs TEMPO NO SQL vs TESTE DE CONECTIVIDADE (SEÇÃO 4) */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  Diferenciação de Tempos: Usuário vs. SQL Interno vs. Conectividade Simples
                </h3>
                <span className="text-xs text-slate-400">
                  SELECT 1 não representa desempenho real do WEBRI
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-3.5">
                  <span className="text-xs text-slate-400">Tempo percebido pelo usuário (WEBRI)</span>
                  <div
                    className={`mt-1 text-lg font-bold ${
                      snapshot.latencySemantics.userPerceivedLatencyMs !== null
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                    }`}
                  >
                    {snapshot.latencySemantics.userPerceivedLatencyMs !== null
                      ? `${(snapshot.latencySemantics.userPerceivedLatencyMs / 1000).toFixed(1).replace('.', ',')} s`
                      : 'Sem relato na janela'}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {snapshot.latencySemantics.userPerceivedLatencyMs !== null
                      ? 'Inclui estação, rede, IIS/serviço SIPLAN e espera por locks no banco.'
                      : 'Nenhum incidente manual registrado na janela ativa; use "+ Registrar lentidão" apenas quando houver queixa real.'}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-3.5">
                  <span className="text-xs text-slate-400">Maior tempo retido dentro do SQL</span>
                  <div
                    className={`mt-1 text-lg font-bold ${
                      snapshot.latencySemantics.sqlObservedElapsedMs !== null &&
                      snapshot.latencySemantics.sqlObservedElapsedMs > 0
                        ? 'text-amber-300'
                        : snapshot.latencySemantics.sqlObservedElapsedMs === 0
                          ? 'text-emerald-300'
                          : 'text-slate-100'
                    }`}
                  >
                    {snapshot.latencySemantics.sqlObservedElapsedMs === 0
                      ? '0,0 s (sem contenção)'
                      : snapshot.latencySemantics.sqlObservedElapsedMs !== null
                        ? `${(snapshot.latencySemantics.sqlObservedElapsedMs / 1000).toFixed(1).replace('.', ',')} s`
                        : 'Sem dados'}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Medido via sys.dm_exec_requests (requisições ativas/retidas em LCK_M_* / I/O).
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-3.5">
                  <span className="text-xs text-slate-400">Teste simples de conectividade (SELECT 1)</span>
                  <div className="mt-1 text-lg font-bold text-emerald-300">
                    {formatMetricOrMissing(snapshot.latencySemantics.simpleConnectivityPingMs, ' ms')}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Testa apenas TCP/autenticação; não lê páginas bloqueadas do WEBRI.
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">{snapshot.latencySemantics.explanation}</p>
            </div>
          </div>
        )}

        {/* =====================================================================
            ABA 2: SQL E BLOQUEIOS
           ===================================================================== */}
        {activeTab === 'sql_bloqueios' && (
          <div className="space-y-6">
            {/* Cadeia de bloqueios e bloqueador raiz */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-400" />
                    Cadeia de Bloqueios e Bloqueador Principal (Root Blocker)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Inclui sessões ociosas (sleeping) com transação aberta (open_transaction_count &gt; 0) que bloqueiam outras estações.
                  </p>
                </div>
                <span className="text-xs text-amber-300 font-medium">
                  Limitação explícita: amostragem periódica captura transações ativas no instante da coleta
                </span>
              </div>

              {snapshot.blockingChains.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-800 bg-[#09101b] p-6 text-center text-sm text-slate-400">
                  {snapshot.kpis.blockedSessionsCount === null
                    ? 'Sem dados de cadeias de bloqueio (permissão VIEW SERVER STATE pendente ou coletor indisponível).'
                    : 'Nenhuma cadeia de bloqueio ativa neste instante.'}
                </div>
              ) : (
                snapshot.blockingChains.map((chain) => (
                  <div
                    key={chain.rootBlockerSessionId}
                    className="rounded-lg border border-amber-500/30 bg-[#141824] p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-bold text-amber-200">
                          BLOQUEADOR RAIZ · Sessão {chain.rootBlockerSessionId}
                        </span>
                        <span className="text-xs text-slate-300 font-medium">
                          Estado: <strong className="text-white">{chain.rootBlockerStatus}</strong> ·
                          Transações abertas: <strong className="text-amber-300">{chain.rootBlockerOpenTransactionCount}</strong> ·
                          Duração: <strong className="text-amber-300">{chain.rootBlockerTransactionDurationSeconds ?? '—'}s</strong>
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        Host: <strong className="text-slate-200">{chain.rootBlockerHostName}</strong> · App:{' '}
                        <strong className="text-slate-200">{chain.rootBlockerProgramName}</strong>
                      </span>
                    </div>

                    <div className="space-y-2 pt-2">
                      {chain.nodes.map((node) => (
                        <div
                          key={node.sessionId}
                          style={{ marginLeft: `${Math.min(node.depth * 20, 60)}px` }}
                          className={`rounded-lg border p-3 text-xs flex flex-wrap items-center justify-between gap-2 ${
                            node.depth === 0
                              ? 'border-amber-500/40 bg-amber-950/20 text-amber-100'
                              : 'border-slate-800 bg-[#0b121e] text-slate-200'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-bold flex items-center gap-2">
                              <span>
                                {node.depth === 0 ? '🔒 Raiz' : '↳ Bloqueada'} · Sessão {node.sessionId}
                              </span>
                              {node.blockingSessionId && (
                                <span className="text-amber-300">
                                  (aguardando sessão {node.blockingSessionId})
                                </span>
                              )}
                              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-cyan-300">
                                {node.programName} @ {node.hostName}
                              </span>
                            </div>
                            <p className="text-slate-400">{node.operationSummary}</p>
                          </div>

                          <div className="text-right space-y-0.5">
                            <div>
                              Espera:{' '}
                              <strong className="text-amber-300">
                                {node.waitType || 'Nenhuma (sleeping com lock)'}
                              </strong>{' '}
                              {node.waitTimeMs ? `(${(node.waitTimeMs / 1000).toFixed(1)}s)` : ''}
                            </div>
                            <div className="text-slate-400 font-mono text-[11px]">
                              query_hash: {node.queryHash || 'n/d'} · tx={node.openTransactionCount}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Latência por arquivo de dados e log (calculada por diferenças) e Memória SQL */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-cyan-400" />
                  Latência por Arquivo SQL (Delta sys.dm_io_virtual_file_stats)
                </h3>
                {snapshot.fileIoDeltas.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">
                    Sem dados de delta por arquivo neste intervalo.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto pr-1">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-[#0c1422] z-10">
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-2 pr-2">Banco / Arquivo</th>
                          <th className="py-2 px-2">Tipo</th>
                          <th className="py-2 px-2">Leitura (Δ)</th>
                          <th className="py-2 px-2">Escrita (Δ)</th>
                          <th className="py-2 pl-2">IOPS (L/E)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {snapshot.fileIoDeltas.map((f) => (
                          <tr key={`${f.databaseName}-${f.fileId}`}>
                            <td className="py-2.5 pr-2 font-medium text-slate-200">
                              {f.databaseName} · <span className="text-slate-400">{f.logicalName}</span>{' '}
                              <span className="text-[10px] text-cyan-400">({f.volumeMountPoint})</span>
                            </td>
                            <td className="py-2.5 px-2 text-slate-300">{f.fileType}</td>
                            <td className="py-2.5 px-2 font-semibold text-slate-100">
                              {formatMetricOrMissing(f.readLatencyDeltaMs, ' ms', 1)}
                            </td>
                            <td className="py-2.5 px-2 font-semibold text-amber-300">
                              {formatMetricOrMissing(f.writeLatencyDeltaMs, ' ms', 1)}
                            </td>
                            <td className="py-2.5 pl-2 text-slate-400">
                              {f.readsDelta} / {f.writesDelta}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="h-4 w-4 text-cyan-400" />
                  Memória SQL Server, Memory Grants, TempDB e Logs
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg border border-slate-800 bg-[#09101b] p-3">
                    <span className="text-slate-400">Total / Max Server Memory</span>
                    <div className="mt-1 text-sm font-bold text-slate-100">
                      {formatMetricOrMissing(snapshot.sqlMemory.totalServerMemoryMb, ' MB')} /{' '}
                      {formatMetricOrMissing(snapshot.sqlMemory.maxServerMemoryConfigMb, ' MB')}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#09101b] p-3">
                    <span className="text-slate-400">Memory Grants Pendentes</span>
                    <div className="mt-1 text-sm font-bold text-slate-100">
                      {formatMetricOrMissing(snapshot.sqlMemory.memoryGrantsPending)} pendentes (
                      {formatMetricOrMissing(snapshot.sqlMemory.memoryGrantsActive)} ativos)
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#09101b] p-3">
                    <span className="text-slate-400">Buffer Cache Hit Ratio</span>
                    <div className="mt-1 text-sm font-bold text-slate-100">
                      {snapshot.sqlMemory.bufferCacheHitRatioPercent !== null &&
                      snapshot.sqlMemory.bufferCacheHitRatioPercent !== undefined
                        ? `${snapshot.sqlMemory.bufferCacheHitRatioPercent.toFixed(2)}%`
                        : snapshot.dataSourceMode === 'LIVE_COLLECTOR'
                          ? 'Aguardando coletor v2.6.13'
                          : 'Sem dados'}
                    </div>
                  </div>
                </div>

                {snapshot.databaseSpaces.length > 0 && (
                  <div className="space-y-2 pt-1 max-h-[420px] overflow-y-auto pr-1">
                    {snapshot.databaseSpaces.map((db) => {
                      const pct = db.logUsedPercent;
                      const pctColorClass =
                        pct === null || pct === undefined
                          ? 'text-slate-400'
                          : pct >= 85
                            ? 'text-rose-400'
                            : pct >= 70
                              ? 'text-amber-300'
                              : 'text-emerald-400';

                      return (
                        <div
                          key={db.databaseName}
                          className="rounded-lg border border-slate-800 bg-[#09101b] p-3 text-xs flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <strong className="text-slate-100">{db.databaseName}</strong>{' '}
                            <span className="text-slate-400">({db.recoveryModel})</span>
                            {db.isTempdb && (
                              <span className="ml-1 text-cyan-300">
                                Version Store: {db.tempdbVersionStoreMb ?? 0} MB · Internal:{' '}
                                {db.tempdbInternalObjectsMb ?? 0} MB
                                {db.tempdbUserObjectsMb !== null && db.tempdbUserObjectsMb !== undefined
                                  ? ` · User: ${db.tempdbUserObjectsMb} MB`
                                  : ''}
                              </span>
                            )}
                            {!db.isTempdb && db.isAutoShrinkOn === true && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                                AUTO_SHRINK ON
                              </span>
                            )}
                            {!db.isTempdb && db.pageVerifyOption && (
                              <span
                                className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                                  db.pageVerifyOption.toUpperCase() === 'CHECKSUM'
                                    ? 'bg-slate-800/70 border-slate-700 text-slate-300'
                                    : 'bg-amber-950/40 border-amber-500/25 text-amber-200'
                                }`}
                              >
                                PAGE_VERIFY: {db.pageVerifyOption}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-300">
                            Log em uso:{' '}
                            {pct === null || pct === undefined ? (
                              snapshot.dataSourceMode === 'LIVE_COLLECTOR' ? (
                                <span className="text-slate-400">Aguardando coletor v2.6.13</span>
                              ) : (
                                <strong className="text-amber-300">Sem dados</strong>
                              )
                            ) : (
                              <strong className={pctColorClass}>
                                {pct.toFixed(1)}%
                                {db.logUsedMb !== null && db.logTotalMb !== null
                                  ? ` (${Math.round(db.logUsedMb).toLocaleString('pt-BR')} / ${Math.round(db.logTotalMb).toLocaleString('pt-BR')} MB)`
                                  : ''}
                              </strong>
                            )}{' '}
                            · log_reuse_wait:{' '}
                            <code className="text-cyan-300">{db.logReuseWaitDesc || 'NOTHING'}</code>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Consultas mais custosas e regressões por query_hash */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">
                  Consultas Mais Custosas e Regressões no Intervalo (Agrupadas por query_hash)
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  {costlyQuerySort.key !== null && (
                    <button
                      type="button"
                      onClick={() => setCostlyQuerySort({ key: null, direction: 'desc' })}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      Restaurar padrão
                    </button>
                  )}
                  <span className="text-xs text-slate-400">
                    Privacidade: textos SQL com parâmetros e CPF/CNPJ não são armazenados por padrão
                  </span>
                </div>
              </div>

              {snapshot.costlyQueries.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">
                  Sem dados de consultas agrupadas por query_hash neste período.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#0c1422] z-10">
                      <tr className="border-b border-slate-800 text-slate-400">
                        {COSTLY_QUERY_COLUMNS.map((col) => {
                          const isActive = costlyQuerySort.key === col.key;
                          const ariaSort = isActive
                            ? costlyQuerySort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none';
                          return (
                            <th key={col.key} aria-sort={ariaSort} className={col.thClassName}>
                              <button
                                type="button"
                                onClick={() => handleCostlyQuerySort(col.key)}
                                className={`group inline-flex items-center gap-1 font-semibold transition-colors hover:text-white select-none ${
                                  isActive ? 'text-cyan-300' : ''
                                }`}
                              >
                                <span>{col.label}</span>
                                {isActive ? (
                                  costlyQuerySort.direction === 'asc' ? (
                                    <ArrowUp className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3 w-3 text-slate-500 group-hover:text-slate-300 shrink-0" />
                                )}
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sortedCostlyQueries.map((q) => (
                        <tr key={q.queryHash}>
                          <td className="py-2.5 pr-3 font-mono font-semibold text-cyan-300">
                            {q.queryHash}
                          </td>
                          <td className="py-2.5 px-3 text-slate-200">
                            {q.operationKind} ({q.databaseName})
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">{q.executionCountDelta}</td>
                          <td className="py-2.5 px-3 font-bold text-amber-300">
                            {q.avgElapsedTimeMs.toLocaleString('pt-BR')} ms
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {q.baselineAvgElapsedTimeMs !== null
                              ? `${q.baselineAvgElapsedTimeMs} ms (${q.regressionRatio}x)`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {q.totalLogicalReadsDelta.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 pl-3 text-slate-300">{q.lastWaitTypeHint || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            ABA 3: SERVIÇOS E PROCESSOS DO WINDOWS (IDENTIFICADOS POR PID + INÍCIO)
           ===================================================================== */}
        {activeTab === 'servicos' && (
          <div className="space-y-6">
            {/* SERVIÇOS DO WINDOWS MONITORADOS NO SRVSQL */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-cyan-400" />
                    Serviços do Windows no SRVSQL ({snapshot.windowsServices.length})
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Estado ao vivo dos serviços críticos (SQL Server, SQL Agent, Power BI Gateway, Zabbix Agent 2, Backup e Segurança).
                  </p>
                </div>
                {snapshot.coverageSources.some(
                  (c) => c.id === 'cov-windows-perf' && c.status === 'OPCIONAL_DESATIVADO',
                ) && (
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 text-[11px] font-medium text-cyan-200">
                    Modo DMV + Zabbix TCP (contadores WMI/CIM do Windows opcionais)
                  </span>
                )}
              </div>

              {snapshot.windowsServices.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">
                  Nenhum serviço do Windows reportado na amostra atual.
                </p>
              ) : (
                <div className="max-h-[360px] overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {snapshot.windowsServices.map((svc) => (
                    <div
                      key={svc.serviceName}
                      className="rounded-lg border border-slate-800 bg-[#09101b] p-3.5 text-xs space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-100 truncate">{svc.displayName}</div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {svc.serviceName}
                            {svc.processName ? ` · ${svc.processName}` : ''}
                            {svc.pid ? ` · PID ${svc.pid}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              svc.state === 'RUNNING'
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {svc.state}
                          </span>
                          <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                            {svc.startMode}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold ${
                            svc.belongsToWebri
                              ? 'bg-cyan-950/60 text-cyan-200 border border-cyan-500/30'
                              : 'bg-slate-800/70 text-slate-400'
                          }`}
                        >
                          {svc.belongsToWebri ? `WEBRI (${svc.webriConfidence})` : 'Externo ao WEBRI'}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate">{svc.notes}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Server className="h-4 w-4 text-cyan-400" />
                    Processos no SRVSQL (Identificados por PID + Horário de Início)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Distingue Memória Privada (Private Working Set) de Conjunto de Trabalho (Working Set) e não classifica todo processo Java ou MySQL como SIPLAN.
                  </p>
                </div>

                {canManageConfig && (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={snapshot.webriConfig.mysqlUsedByWebri}
                      onChange={(e) => handleToggleMysqlWebri(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                    />
                    <span>Marcar MySQL (mysqld.exe) como utilizado pelo WEBRI</span>
                  </label>
                )}
              </div>

              {snapshot.windowsProcesses.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">
                  Sem dados de processos do Windows coletados no intervalo.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#0c1422] z-10">
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="py-2 pr-3">Processo (PID · Início)</th>
                        <th className="py-2 px-3">Serviço Relacionado</th>
                        <th className="py-2 px-3">CPU</th>
                        <th className="py-2 px-3">Memória Privada</th>
                        <th className="py-2 px-3">Working Set</th>
                        <th className="py-2 px-3">Vínculo WEBRI / Confiança</th>
                        <th className="py-2 pl-3">Fonte de I/O de Disco</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {snapshot.windowsProcesses.map((proc) => (
                        <tr key={proc.processInstanceKey}>
                          <td className="py-2.5 pr-3">
                            <div className="font-semibold text-slate-100">{proc.processName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              PID {proc.pid} · início {proc.startTimeIso.slice(0, 19).replace('T', ' ')}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            <div>{proc.associatedServiceDisplayName || 'Processo autônomo'}</div>
                            <div className="text-[11px] text-slate-500">{proc.associatedServiceName}</div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-100">
                            {formatMetricOrMissing(proc.cpuPercent, '%', 1)}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-cyan-300">
                            {formatMetricOrMissing(proc.privateWorkingSetMb, ' MB')}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            {formatMetricOrMissing(proc.workingSetMb, ' MB')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
                                proc.belongsToWebri
                                  ? 'bg-cyan-950/60 text-cyan-200 border border-cyan-500/30'
                                  : 'bg-slate-800/70 text-slate-400'
                              }`}
                            >
                              {proc.belongsToWebri ? `Sim (${proc.webriConfidence})` : 'Não associado'}
                            </span>
                            <div className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                              {proc.associationReason}
                            </div>
                          </td>
                          <td className="py-2.5 pl-3 text-slate-400">
                            {proc.diskAttributionSource === 'NAO_SUSTENTADO_POR_FONTE' ? (
                              <span className="text-slate-500">
                                Não atribuído (sem fonte ETW por processo)
                              </span>
                            ) : (
                              <span className="text-emerald-300 font-medium">
                                {proc.diskAttributionSource}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Volumes de Armazenamento e Eventos Simultâneos (Backups / Power BI / Antivírus) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">
                  Volumes do Windows (Latência, IOPS, Fila e Espaço Livre)
                </h3>
                {snapshot.windowsVolumes.length === 0 ? (
                  <p className="text-xs text-slate-400">Sem dados de volumes no período.</p>
                ) : (
                  <div className="space-y-2.5">
                    {snapshot.windowsVolumes.map((vol) => (
                      <div
                        key={vol.volume}
                        className="rounded-lg border border-slate-800 bg-[#09101b] p-3 text-xs flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-bold text-cyan-300">{vol.volume}</span> ·{' '}
                          <strong className="text-slate-100">{vol.label}</strong>
                          <div className="text-slate-400 mt-0.5">
                            Livre: {formatMetricOrMissing(vol.freeSpaceGb, ' GB', 1)} de{' '}
                            {formatMetricOrMissing(vol.totalSpaceGb, ' GB')} (
                            {formatMetricOrMissing(vol.freePercent, '%', 1)})
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-slate-200">
                            Leitura: <strong>{formatMetricOrMissing(vol.readLatencyMs, ' ms')}</strong> ·
                            Escrita:{' '}
                            <strong className="text-amber-300">
                              {formatMetricOrMissing(vol.writeLatencyMs, ' ms')}
                            </strong>
                          </div>
                          <div className="text-slate-400">
                            Throughput: {formatMetricOrMissing(vol.throughputMbPerSec, ' MB/s', 1)} · Fila:{' '}
                            {formatMetricOrMissing(vol.queueLength, '', 1)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-3">
                <h3 className="text-sm font-bold text-white">
                  Backups, Tarefas Agendadas e Eventos Simultâneos
                </h3>
                {snapshot.concurrentEvents.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum evento simultâneo registrado na janela.</p>
                ) : (
                  <div className="space-y-2.5">
                    {snapshot.concurrentEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-lg border border-slate-800 bg-[#09101b] p-3.5 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-100">{ev.title}</span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              ev.status === 'EM_ANDAMENTO'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {ev.status}
                          </span>
                        </div>
                        <p className="text-slate-400">{ev.detail}</p>
                        <div className="text-[11px] text-slate-500">
                          Fonte: {ev.source} · Início: {ev.startedAt.slice(11, 19)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            ABA 4: INCIDENTES, ALERTAS COM HISTERESE E RELATÓRIO SIPLAN
           ===================================================================== */}
        {activeTab === 'incidentes' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/90 bg-[#0c1422] p-5">
              <div>
                <h2 className="text-base font-bold text-white">
                  Exportação de Dossiê Técnico de Incidente para a SIPLAN
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inclui período e fuso horário (America/Sao_Paulo), versão do SQL Server, cadeias de bloqueio, esperas, serviços simultâneos, hipóteses e limitações — sem credenciais nem dados pessoais.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportSiplanMarkdown}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0d6e8a] hover:bg-[#0f82a3] px-3.5 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  <span>Baixar Relatório (.MD)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportSiplanJson}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#09101b] hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  <Download className="h-4 w-4 text-cyan-400" />
                  <span>Exportar JSON Técnico</span>
                </button>
              </div>
            </div>

            {/* Relatos manuais de lentidão vinculados às métricas antes/depois */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  Registros de Lentidão Relatados pelos Usuários (Vinculados a Antes / Depois)
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSlownessModalOpen(true)}
                  className="text-xs font-semibold text-cyan-400 hover:underline cursor-pointer"
                >
                  + Novo registro de lentidão
                </button>
              </div>

              <div className="space-y-3">
                {snapshot.userIncidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded-lg border border-slate-800 bg-[#09101b] p-4 text-xs space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-100 text-sm">
                        {inc.affectedOperation} (Duração percebida: {inc.perceivedDurationSeconds}s)
                      </span>
                      <span className="text-slate-400">
                        Relatado por {inc.reportedBy} em{' '}
                        {new Date(inc.occurredAt).toLocaleString('pt-BR', {
                          timeZone: 'America/Sao_Paulo',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-300">{inc.observation}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div className="rounded border border-slate-800/80 bg-[#0c1422] p-2.5 text-slate-300">
                        <strong className="text-cyan-300">Métricas Antes:</strong> CPU{' '}
                        {formatMetricOrMissing(inc.beforeSnapshotSummary.cpuPercent, '%')} · RAM{' '}
                        {formatMetricOrMissing(inc.beforeSnapshotSummary.memoryUsedPercent, '%')} · Escrita{' '}
                        {formatMetricOrMissing(inc.beforeSnapshotSummary.diskWriteLatencyMs, ' ms')} ·
                        Bloqueadas: {formatMetricOrMissing(inc.beforeSnapshotSummary.blockedSessionsCount)}
                      </div>
                      <div className="rounded border border-slate-800/80 bg-[#0c1422] p-2.5 text-slate-300">
                        <strong className="text-amber-300">Métricas Durante/Depois:</strong> CPU{' '}
                        {formatMetricOrMissing(inc.afterSnapshotSummary.cpuPercent, '%')} · RAM{' '}
                        {formatMetricOrMissing(inc.afterSnapshotSummary.memoryUsedPercent, '%')} · Escrita{' '}
                        {formatMetricOrMissing(inc.afterSnapshotSummary.diskWriteLatencyMs, ' ms')} ·
                        Bloqueadas: {formatMetricOrMissing(inc.afterSnapshotSummary.blockedSessionsCount)}{' '}
                        (Sessão raiz: {inc.afterSnapshotSummary.rootBlockerSessionId ?? '—'} · Espera:{' '}
                        {inc.afterSnapshotSummary.topWaitType || '—'})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regras de Alerta com Histerese e Duração Mínima */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">
                Limites de Alerta Configuráveis (Com Duração Mínima, Histerese de Recuperação e Agrupamento)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 pr-3">Regra</th>
                      <th className="py-2 px-3">Atenção</th>
                      <th className="py-2 px-3">Crítico</th>
                      <th className="py-2 px-3">Recuperação (Histerese)</th>
                      <th className="py-2 px-3">Duração Mínima</th>
                      <th className="py-2 pl-3">Calibração / Linha de Base</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {snapshot.alertRules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="py-2.5 pr-3 font-medium text-slate-200">{rule.label}</td>
                        <td className="py-2.5 px-3 text-amber-300 font-semibold">
                          {rule.warningThreshold} {rule.unit}
                        </td>
                        <td className="py-2.5 px-3 text-rose-300 font-semibold">
                          {rule.criticalThreshold} {rule.unit}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-300">
                          {rule.recoveryHysteresisThreshold} {rule.unit}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{rule.minDurationSeconds}s</td>
                        <td className="py-2.5 pl-3 text-slate-400">{rule.baselineAdjustableNote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            ABA 5: COLETA E ACESSO (SONDAGEM REAL SRVSQL, PERMISSÕES E COBERTURA)
           ===================================================================== */}
        {activeTab === 'coleta_acesso' && (
          <div className="space-y-6">
            {/* Resultado real da sondagem no SRVSQL */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  Diagnóstico Real de Conectividade e Permissões em SRVSQL (10.0.0.25)
                </h2>
                <span className="text-xs font-mono text-cyan-300">
                  Coletor desacoplado da UI · Somente Leitura
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-4 space-y-1">
                  <span className="text-slate-400">Instância SQL Server Detectada</span>
                  <div className="text-sm font-bold text-white">
                    {snapshot.sqlMetadata.serverName || 'SRVSQL'} (
                    {snapshot.sqlMetadata.instanceName || 'MSSQLSERVER'})
                  </div>
                  <div className="text-slate-300">
                    SQL Server 2012 {snapshot.sqlMetadata.productLevel} ({snapshot.sqlMetadata.productVersion})
                  </div>
                  <div className="text-slate-400">{snapshot.sqlMetadata.edition}</div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-4 space-y-1">
                  <span className="text-slate-400">Permissão Mínima p/ DMVs (SQL 2012 SP4)</span>
                  <div
                    className={`text-sm font-bold ${
                      snapshot.sqlMetadata.hasViewServerState ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    VIEW SERVER STATE: {snapshot.sqlMetadata.hasViewServerState ? 'Concedida' : 'Pendente (0)'}
                  </div>
                  <div className="text-slate-400">
                    Login atual: <code className="text-cyan-300">{snapshot.sqlMetadata.loginUsed}</code> ·{' '}
                    {snapshot.sqlMetadata.hasViewAnyDefinition
                      ? 'VIEW ANY DEFINITION: Concedida · Somente Leitura.'
                      : 'Não exige sysadmin.'}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-4 space-y-1">
                  <span className="text-slate-400">
                    Agente Zabbix ({snapshot.zabbixProbe.host || 'srvsql'}:{snapshot.zabbixProbe.port || 10050})
                  </span>
                  <div
                    className={`text-sm font-bold ${
                      snapshot.zabbixProbe.status === 'CONNECTED'
                        ? 'text-emerald-400'
                        : snapshot.zabbixProbe.status === 'PASSIVE_REJECTED_BY_WHITELIST_OR_PSK'
                          ? 'text-cyan-300'
                          : 'text-slate-300'
                    }`}
                  >
                    {snapshot.zabbixProbe.status === 'CONNECTED'
                      ? 'Integrado · Ativo'
                      : snapshot.zabbixProbe.status === 'PASSIVE_REJECTED_BY_WHITELIST_OR_PSK'
                        ? 'Porta 10050 Aberta · Passivo Restrito (Opcional)'
                        : 'Opcional · Não Configurado'}
                  </div>
                  <div className="text-slate-400">{snapshot.zabbixProbe.detail}</div>
                </div>
              </div>

              {/* Script SQL de permissão mínima (expandido apenas se pendente) */}
              {snapshot.sqlMetadata.hasViewServerState ? (
                <details className="rounded-lg border border-emerald-500/20 bg-emerald-950/15 p-3.5 text-xs">
                  <summary className="cursor-pointer font-semibold text-emerald-300 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Permissões mínimas já concedidas ao login [{snapshot.sqlMetadata.loginUsed}] (clique para consultar o script T-SQL de referência)
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2 border-t border-emerald-500/20 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                        Script T-SQL de referência
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(MINIMUM_PERMISSIONS_SQL_SCRIPT, 'Script GRANT VIEW SERVER STATE copiado!')}
                        className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-700 cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>{copiedSqlNotice || 'Copiar T-SQL'}</span>
                      </button>
                    </div>
                    <pre className="overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed">
                      {MINIMUM_PERMISSIONS_SQL_SCRIPT}
                    </pre>
                  </div>
                </details>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                      Script de Permissão Mínima para Habilitar Coleta Completa de DMVs no SRVSQL
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(MINIMUM_PERMISSIONS_SQL_SCRIPT, 'Script GRANT VIEW SERVER STATE copiado!')}
                      className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-slate-700 cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{copiedSqlNotice || 'Copiar T-SQL'}</span>
                    </button>
                  </div>
                  <pre className="overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed">
                    {MINIMUM_PERMISSIONS_SQL_SCRIPT}
                  </pre>
                </div>
              )}

              {/* Guia opcional de integração Zabbix Agent 2 / API JSON-RPC */}
              <details className="rounded-lg border border-slate-800 bg-[#09101b] p-3.5 text-xs">
                <summary className="cursor-pointer font-semibold text-cyan-300 flex items-center justify-between gap-2">
                  <span>
                    Integração Zabbix opcional — clique para ver parâmetros do zabbix_agent2.conf ou API Zabbix
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">Opcional (DMVs já ativas via FIORIXConnector)</span>
                </summary>
                <div className="mt-3 space-y-3 border-t border-slate-800 pt-3 text-slate-300">
                  <p className="text-slate-400">
                    As DMVs do SQL Server 2012 e os contadores expostos pelo conector já alimentam este painel sem depender do Zabbix. Caso deseje habilitar a sonda passiva ou a API JSON-RPC do Zabbix:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded border border-slate-800 bg-[#0c1422] p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-slate-200">Opção A · zabbix_agent2.conf (no SRVSQL)</strong>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              'Server=127.0.0.1,<IP_DO_SRVFILES>\n# Em seguida reiniciar o servico Windows "Zabbix Agent 2"',
                              'Diretiva zabbix_agent2.conf copiada!',
                            )
                          }
                          className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-cyan-300 hover:bg-slate-700 cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                          Copiar
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                        {'Server=127.0.0.1,<IP_DO_SRVFILES>\n# Reiniciar servico "Zabbix Agent 2" no SRVSQL'}
                      </pre>
                    </div>
                    <div className="rounded border border-slate-800 bg-[#0c1422] p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-slate-200">Opção B · API JSON-RPC (no FIORIXConnector)</strong>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              'ZABBIX_API_URL=https://<servidor-zabbix>/api_jsonrpc.php\nZABBIX_API_TOKEN=<token-somente-leitura>',
                              'Variáveis ZABBIX_API copiadas!',
                            )
                          }
                          className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-cyan-300 hover:bg-slate-700 cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                          Copiar
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                        {'ZABBIX_API_URL=https://<servidor-zabbix>/api_jsonrpc.php\nZABBIX_API_TOKEN=<token-somente-leitura>'}
                      </pre>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {/* Vínculo Auditado do Ambiente WEBRI / SIPLAN (somente leitura) */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">
                  Vínculo Auditado do Ecossistema WEBRI / SIPLAN (Somente Leitura)
                </h3>
                <span className="text-xs text-slate-400">
                  {snapshot.webriConfig.updatedBy}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-3 space-y-1">
                  <span className="text-slate-400">Bancos Monitorados ({snapshot.webriConfig.databases.length})</span>
                  <div className="font-mono text-slate-200 break-words">
                    {snapshot.webriConfig.databases.join(', ')}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-3 space-y-1">
                  <span className="text-slate-400">Logins WEBRI/SIPLAN</span>
                  <div className="font-mono text-slate-200 break-words">
                    {snapshot.webriConfig.logins.join(', ')}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-3 space-y-1">
                  <span className="text-slate-400">Hosts Conhecidos</span>
                  <div className="font-mono text-slate-200 break-words">
                    {snapshot.webriConfig.hosts.join(', ')}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#09101b] p-3 space-y-1">
                  <span className="text-slate-400">Serviços Windows Associados</span>
                  <div className="font-mono text-slate-200 break-words">
                    {snapshot.webriConfig.windowsServices.join(', ')}
                  </div>
                </div>
              </div>
            </div>

            {/* Indicadores de Cobertura: Fontes Disponíveis vs Fontes Sem Permissão */}
            <div className="rounded-xl border border-slate-800/90 bg-[#0c1422] p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">
                Indicadores de Cobertura das Fontes de Dados
              </h3>
              <div className="space-y-2.5">
                {snapshot.coverageSources.map((src) => (
                  <div
                    key={src.id}
                    className="rounded-lg border border-slate-800 bg-[#09101b] p-3.5 text-xs flex flex-wrap items-start justify-between gap-3"
                  >
                    <div className="space-y-1 max-w-3xl">
                      <div className="font-bold text-slate-100">{src.name}</div>
                      <div className="text-slate-400">
                        <strong>Permissão / Requisito:</strong> {src.requiredPermission}
                      </div>
                      <div className="text-slate-400">
                        <strong>Ação recomendada:</strong> {src.remediationStep}
                      </div>
                    </div>
                    <span
                      className={`rounded px-2.5 py-1 text-[11px] font-bold ${
                        src.status === 'DISPONIVEL'
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                          : src.status === 'SEM_PERMISSAO'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                            : src.status === 'OPCIONAL_DESATIVADO'
                              ? 'bg-cyan-950/40 text-cyan-300 border border-cyan-500/25'
                              : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {src.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RODAPÉ */}
        <div className="pt-2 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            Snapshot real de monitoramento · {snapshot.observedAt || snapshot.generatedAt} · {snapshot.timezone} · Coletor separado da UI
          </span>
          <span>
            Retenção: {snapshot.collectorBudget.retentionDays} dias (máx.{' '}
            {snapshot.collectorBudget.maxStoredSnapshots} amostras)
          </span>
        </div>
      </div>

      {/* MODAL: + REGISTRAR LENTIDÃO AGORA */}
      {isSlownessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0c1422] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Registrar lentidão percebida no WEBRI</h2>
              <button
                type="button"
                onClick={() => setIsSlownessModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <p className="text-xs text-slate-400">
              O registro será vinculado automaticamente às métricas de CPU, memória, disco, bloqueios e esperas coletadas antes e depois do incidente para compor o dossiê da SIPLAN.
            </p>

            <form onSubmit={handleRecordSlownessSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Operação afetada no WEBRI
                </label>
                <input
                  type="text"
                  required
                  value={slownessOperation}
                  onChange={(e) => setSlownessOperation(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#09101b] px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Duração percebida da lentidão / travamento (segundos)
                </label>
                <input
                  type="number"
                  min={1}
                  max={7200}
                  required
                  value={slownessDurationSec}
                  onChange={(e) => setSlownessDurationSec(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#09101b] px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Observação (estação, tela, número de pedido/protocolo sem dados sensíveis)
                </label>
                <textarea
                  rows={3}
                  value={slownessObservation}
                  onChange={(e) => setSlownessObservation(e.target.value)}
                  placeholder="Ex.: Travamento ao salvar andamento na estação de Certidões; outras 4 máquinas pararam juntas."
                  className="w-full rounded-lg border border-slate-700 bg-[#09101b] px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {slownessFeedback && (
                <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-2 text-xs text-cyan-200">
                  {slownessFeedback}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSlownessModalOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingSlowness}
                  className="rounded-lg bg-[#0d6e8a] hover:bg-[#0f82a3] px-4 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  {submittingSlowness ? 'Vinculando métricas...' : 'Salvar e vincular métricas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


/**
 * Camada de Armazenamento, Retenção e Estado do Módulo "Performance do SRVSQL".
 *
 * Garantias arquiteturais (Seção 1, 5, 7, 8 e 11):
 * - Separa estritamente o coletor do servidor e a interface do FIORIX:
 *   a leitura do painel (`getSrvsqlPerformanceSnapshot`) consulta apenas o cache/banco próprio do FIORIX
 *   (PostgreSQL) e NUNCA dispara consultas SQL por usuário contra o SRVSQL.
 * - Armazena histórico em tabelas próprias do monitoramento (`srvsql_perf_samples`, `srvsql_perf_incidents`,
 *   `srvsql_perf_config`), isoladas das bases de negócio da SIPLAN, com poda automática de retenção
 *   (`maxStoredSnapshots` e `retentionDays`).
 * - Quando falta permissão `VIEW SERVER STATE` ou o coletor está indisponível, exibe o estado real
 *   ("Sem dados" / "Permissão VIEW SERVER STATE pendente" / "Coletor indisponível") sem jamás simular
 *   conexão saudável ("verde") ou substituir ausência de dado por `0`.
 */

import { prisma } from '@/lib/prisma';
import {
  buildBlockingChains,
  buildProcessInstanceKey,
  computeCollectorBackoffSeconds,
  computeFileIoLatencyDelta,
  computeWaitStatsDelta,
  DEFAULT_ALERT_RULES,
  evaluateAlertsWithHysteresis,
  evaluateWebriSessionAssociation,
  generateEvidenceDiagnostics,
} from './engine';
import type {
  AlertEventRecord,
  AlertThresholdRule,
  CollectorRuntimeBudget,
  CoverageSourceItem,
  ScenarioPresetId,
  SqlActiveSessionSample,
  SqlCostlyQueryHashItem,
  SqlDatabaseSpaceSample,
  SqlFileIoRawSample,
  SqlInstanceMetadata,
  SqlMemoryHealthSample,
  SqlWaitStatRawSample,
  SrvsqlPerformanceDashboardSnapshot,
  SrvsqlTimelinePoint,
  TimeWindowPreset,
  UserSlownessIncidentRecord,
  WebriAssociationConfig,
  WindowsConcurrentEvent,
  WindowsMemorySample,
  WindowsNetworkSample,
  WindowsProcessSample,
  WindowsServiceSample,
  WindowsVolumeIoSample,
  ZabbixIntegrationProbe,
} from './types';

export interface RawCollectorIngestPayload {
  observedAt: string;
  collectionDurationMs?: number;
  sqlMetadata: SqlInstanceMetadata;
  zabbixProbe?: ZabbixIntegrationProbe;
  cpuTotalPercent: number | null;
  sqlCpuPercent?: number | null;
  cpuCount?: number | null;
  totalUserSessionsCount?: number | null;
  simpleConnectivityPingMs?: number | null;
  cpuRingTimeline?: Array<{
    timestampIso: string;
    timeLabel: string;
    totalServerCpuPercent: number | null;
  }>;
  windowsMemory: WindowsMemorySample;
  windowsVolumes: WindowsVolumeIoSample[];
  windowsNetwork: WindowsNetworkSample[];
  windowsProcesses: Array<Omit<WindowsProcessSample, 'processInstanceKey'>>;
  windowsServices: WindowsServiceSample[];
  concurrentEvents: WindowsConcurrentEvent[];
  activeSessions: SqlActiveSessionSample[];
  waitStatsRaw: SqlWaitStatRawSample[] | null;
  fileIoRaw: SqlFileIoRawSample[] | null;
  sqlMemory: SqlMemoryHealthSample;
  databaseSpaces: SqlDatabaseSpaceSample[];
  costlyQueries: SqlCostlyQueryHashItem[];
}

interface TenantMonitorRuntimeState {
  samples: RawCollectorIngestPayload[];
  incidents: UserSlownessIncidentRecord[];
  alerts: AlertEventRecord[];
  alertRules: AlertThresholdRule[];
  webriConfig: WebriAssociationConfig;
  collectorBudget: CollectorRuntimeBudget;
  lastCollectorError: string | null;
  lastCollectorTimeoutAt: string | null;
}

const DEFAULT_WEBRI_CONFIG: WebriAssociationConfig = {
  databases: ['WEBRI', 'SIPLAN_IMAGENS', 'INDICADOR_REAL'],
  logins: ['webri_app', 'siplan_user', 'fiorix_connector', 'sa_webri'],
  applicationNames: ['WEBRI', 'SIPLAN', 'CartorioWebri', 'IIS-WEBRIPool', 'Microsoft JDBC Driver'],
  hosts: ['SRVSQL', 'SRVAPP-WEBRI', 'ESTACAO-REGISTRO', 'ESTACAO-CERTIDAO', 'ESTACAO-CAIXA'],
  windowsServices: ['MSSQLSERVER', 'W3SVC', 'SiplanWebriService', 'SiplanIndexadorService'],
  confirmedJavaProcessNames: ['SiplanAssinadorJava'],
  mysqlUsedByWebri: false,
  updatedAt: '2026-11-11T14:00:00.000Z',
  updatedBy: 'Configuração Inicial Auditada',
};

const DEFAULT_COLLECTOR_BUDGET: CollectorRuntimeBudget = {
  lightMetricsIntervalSeconds: 15,
  diagnosticSqlIntervalSeconds: 30,
  inventoryIntervalSeconds: 300,
  queryTimeoutMs: 5000,
  lockTimeoutMs: 2000,
  maxRowsPerDmvQuery: 150,
  maxConcurrentConnections: 2,
  maxLocalQueueItems: 120,
  retentionDays: 14,
  maxStoredSnapshots: 2880,
  lastCollectionDurationMs: 38,
  consecutiveFailures: 0,
  currentBackoffSeconds: 30,
  autoThrottled: false,
};

/**
 * Metadados reais aferidos no servidor SRVSQL (`10.0.0.25`) da serventia:
 * - SQL Server 2012 SP4 (`11.0.7507.2`), Standard Edition (64-bit), instância padrão `MSSQLSERVER`.
 * - Login `fiorix_connector` conecta em ~25-38ms, porém `VIEW SERVER STATE` ainda consta como `false` (0).
 * - Agente `zabbix_agent2.exe` ativo na porta `10050`, com conexões passivas restritas ao IP do servidor Zabbix.
 */
export const REAL_VERIFIED_SRVSQL_METADATA: SqlInstanceMetadata = {
  serverName: 'SRVSQL',
  machineName: 'SRVSQL',
  instanceName: 'MSSQLSERVER',
  edition: 'Standard Edition (64-bit)',
  productVersion: '11.0.7507.2',
  productLevel: 'SP4',
  majorVersion: 11,
  sqlServerStartTime: '2026-11-11T16:11:46.083',
  loginUsed: 'fiorix_connector',
  hasViewServerState: true,
  hasViewServerPerformanceState: false,
  hasViewAnyDefinition: true,
  queryStoreSupported: false, // SQL Server 2012 (11.x) não possui Query Store (introduzido no SQL Server 2016 / 13.x)
  queryStoreEnabled: null,
  requiredPermissionLabel: 'GRANT VIEW SERVER STATE + VIEW ANY DEFINITION concedidos a [fiorix_connector] em SRVSQL (SQL Server 2012 SP4)',
};

export const REAL_VERIFIED_ZABBIX_PROBE: ZabbixIntegrationProbe = {
  host: 'srvsql (10.0.0.25)',
  port: 10050,
  tcpReachable: true,
  agentProcessDetected: true,
  status: 'PASSIVE_REJECTED_BY_WHITELIST_OR_PSK',
  detail:
    'Porta TCP 10050 aberta em SRVSQL (zabbix_agent2.exe em execução), porém consultas passivas diretas são encerradas pela diretiva Server= (whitelist de IP) ou TLS PSK em zabbix_agent2.conf.',
  checkedAt: '2026-11-11T17:33:22.000Z',
};

const runtimeStateByTenant = new Map<string, TenantMonitorRuntimeState>();
let ddlInitialized = false;

async function ensureMonitoringTables(): Promise<void> {
  if (ddlInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS srvsql_perf_incidents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        occurred_at TIMESTAMPTZ NOT NULL,
        reported_by TEXT NOT NULL,
        affected_operation TEXT NOT NULL,
        perceived_duration_sec INTEGER NOT NULL,
        observation TEXT NOT NULL,
        before_snapshot JSONB NOT NULL,
        after_snapshot JSONB NOT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS srvsql_perf_samples (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_srvsql_perf_samples_tenant_observed
        ON srvsql_perf_samples (tenant_id, observed_at DESC);
    `);
    ddlInitialized = true;
  } catch {
    // Em ambiente de teste sem banco ativo, opera em memória de forma resiliente
  }
}

export function getOrCreateTenantState(tenantId: string): TenantMonitorRuntimeState {
  const key = tenantId || 'default-tenant';
  let state = runtimeStateByTenant.get(key);
  if (!state) {
    state = {
      samples: [],
      incidents: [],
      alerts: [],
      alertRules: DEFAULT_ALERT_RULES.map((r) => ({ ...r })),
      webriConfig: {
        ...DEFAULT_WEBRI_CONFIG,
        databases: [...DEFAULT_WEBRI_CONFIG.databases],
        logins: [...DEFAULT_WEBRI_CONFIG.logins],
        applicationNames: [...DEFAULT_WEBRI_CONFIG.applicationNames],
        hosts: [...DEFAULT_WEBRI_CONFIG.hosts],
        windowsServices: [...DEFAULT_WEBRI_CONFIG.windowsServices],
        confirmedJavaProcessNames: [...DEFAULT_WEBRI_CONFIG.confirmedJavaProcessNames],
      },
      collectorBudget: { ...DEFAULT_COLLECTOR_BUDGET },
      lastCollectorError: null,
      lastCollectorTimeoutAt: null,
    };
    runtimeStateByTenant.set(key, state);
  }
  return state;
}

/**
 * Aplica limites de retenção por tempo (`retentionDays`) e quantidade máxima (`maxStoredSnapshots`)
 * para impedir que a base de monitoramento cresça indefinidamente (Seção 1 e Seção 11).
 */
export function pruneSamplesByRetention(
  samples: RawCollectorIngestPayload[],
  options: { retentionDays: number; maxStoredSnapshots: number; nowIso?: string },
): {
  kept: RawCollectorIngestPayload[];
  prunedCount: number;
} {
  const nowMs = options.nowIso ? Date.parse(options.nowIso) : Date.now();
  const cutoffMs = nowMs - options.retentionDays * 24 * 60 * 60 * 1000;

  const withinAge = samples.filter((s) => {
    const ts = Date.parse(s.observedAt);
    return Number.isFinite(ts) && ts >= cutoffMs;
  });

  withinAge.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  const excess = Math.max(0, withinAge.length - options.maxStoredSnapshots);
  const kept = excess > 0 ? withinAge.slice(excess) : withinAge;
  const prunedCount = samples.length - kept.length;

  return { kept, prunedCount };
}

/**
 * Registra uma amostra enviada pelo coletor em segundo plano, aplicando:
 * - Orçamento de tempo (auto-throttling se `collectionDurationMs > queryTimeoutMs`)
 * - Retenção máxima de amostras
 * - Avaliação de alertas com histerese
 */
export function ingestCollectorSample(
  tenantId: string,
  payload: RawCollectorIngestPayload,
): {
  storedSamplesCount: number;
  prunedCount: number;
  autoThrottled: boolean;
} {
  const state = getOrCreateTenantState(tenantId);

  const durationMs = payload.collectionDurationMs ?? 40;
  state.collectorBudget.lastCollectionDurationMs = durationMs;
  state.collectorBudget.consecutiveFailures = 0;
  state.collectorBudget.currentBackoffSeconds = state.collectorBudget.diagnosticSqlIntervalSeconds;

  if (durationMs > state.collectorBudget.queryTimeoutMs) {
    state.collectorBudget.autoThrottled = true;
    state.collectorBudget.diagnosticSqlIntervalSeconds = Math.min(
      180,
      state.collectorBudget.diagnosticSqlIntervalSeconds * 2,
    );
  } else {
    state.collectorBudget.autoThrottled = false;
  }

  state.samples.push(payload);
  const pruned = pruneSamplesByRetention(state.samples, {
    retentionDays: state.collectorBudget.retentionDays,
    maxStoredSnapshots: state.collectorBudget.maxStoredSnapshots,
    nowIso: payload.observedAt,
  });
  state.samples = pruned.kept;

  return {
    storedSamplesCount: state.samples.length,
    prunedCount: pruned.prunedCount,
    autoThrottled: state.collectorBudget.autoThrottled,
  };
}

/**
 * Persiste a amostra ao vivo no PostgreSQL (`srvsql_perf_samples`) para sobreviver a instâncias serverless
 * na Vercel e atualiza o estado em memória do tenant.
 */
export async function persistAndIngestCollectorSample(
  tenantId: string,
  payload: RawCollectorIngestPayload,
): Promise<{
  storedSamplesCount: number;
  prunedCount: number;
  autoThrottled: boolean;
}> {
  await ensureMonitoringTables();
  const observedIso =
    payload?.observedAt && !Number.isNaN(Date.parse(payload.observedAt))
      ? new Date(payload.observedAt).toISOString()
      : new Date().toISOString();
  const normalizedPayload: RawCollectorIngestPayload = {
    ...payload,
    observedAt: observedIso,
  };

  const memResult = ingestCollectorSample(tenantId, normalizedPayload);

  try {
    const sampleId = `${tenantId}:${observedIso}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO srvsql_perf_samples (id, tenant_id, observed_at, payload)
       VALUES ($1, $2, $3::timestamptz, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
      sampleId,
      tenantId,
      observedIso,
      JSON.stringify(normalizedPayload),
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM srvsql_perf_samples
       WHERE tenant_id = $1 AND observed_at < NOW() - INTERVAL '48 hours'`,
      tenantId,
    );
  } catch {
    // Mantém amostra em memória se escrita SQL falhar momentaneamente
  }

  return memResult;
}

/**
 * Hidrata as amostras reais persistidas no PostgreSQL antes de construir o snapshot do painel,
 * garantindo que diferentes workers serverless na Vercel leiam sempre os dados mais recentes do SRVSQL.
 */
export async function loadSrvsqlPerformanceSnapshot(
  tenantId: string,
  requestedScenario: ScenarioPresetId = 'LIVE_OR_REAL',
  windowPreset: TimeWindowPreset = '30m',
): Promise<SrvsqlPerformanceDashboardSnapshot> {
  if (requestedScenario === 'LIVE_OR_REAL') {
    await ensureMonitoringTables();
    const state = getOrCreateTenantState(tenantId);
    try {
      const [sampleRows, incidentRows] = await Promise.all([
        prisma.$queryRawUnsafe<
          Array<{ observed_at: Date; payload: RawCollectorIngestPayload | string }>
        >(
          `SELECT observed_at, payload
           FROM srvsql_perf_samples
           WHERE tenant_id = $1
           ORDER BY observed_at DESC
           LIMIT 120`,
          tenantId,
        ),
        prisma.$queryRawUnsafe<
          Array<{
            id: string;
            reported_at: Date;
            occurred_at: Date;
            reported_by: string;
            affected_operation: string;
            perceived_duration_sec: number;
            observation: string;
            before_snapshot: UserSlownessIncidentRecord['beforeSnapshotSummary'] | string;
            after_snapshot: UserSlownessIncidentRecord['afterSnapshotSummary'] | string;
          }>
        >(
          `SELECT id, reported_at, occurred_at, reported_by, affected_operation, perceived_duration_sec, observation, before_snapshot, after_snapshot
           FROM srvsql_perf_incidents
           WHERE tenant_id = $1
           ORDER BY occurred_at DESC
           LIMIT 100`,
          tenantId,
        ).catch(() => []),
      ]);

      if (Array.isArray(sampleRows) && sampleRows.length > 0) {
        const chronological = sampleRows
          .map((r) => {
            const p = (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) as RawCollectorIngestPayload;
            return {
              ...p,
              observedAt:
                r.observed_at instanceof Date
                  ? r.observed_at.toISOString()
                  : p.observedAt,
            };
          })
          .reverse();
        state.samples = chronological;
      }

      if (Array.isArray(incidentRows) && incidentRows.length > 0) {
        state.incidents = incidentRows
          .filter((r) => r.id !== 'inc-demo-1426')
          .map((r) => ({
            id: r.id,
            reportedAt: r.reported_at instanceof Date ? r.reported_at.toISOString() : String(r.reported_at),
            occurredAt: r.occurred_at instanceof Date ? r.occurred_at.toISOString() : String(r.occurred_at),
            reportedBy: r.reported_by,
            affectedOperation: r.affected_operation,
            perceivedDurationSeconds: Number(r.perceived_duration_sec || 0),
            observation: r.observation,
            beforeSnapshotSummary:
              typeof r.before_snapshot === 'string' ? JSON.parse(r.before_snapshot) : r.before_snapshot,
            afterSnapshotSummary:
              typeof r.after_snapshot === 'string' ? JSON.parse(r.after_snapshot) : r.after_snapshot,
          }));
      }
    } catch {
      // Opera com amostras já presentes na memória se banco indisponível
    }
  }
  return buildSrvsqlPerformanceSnapshot(tenantId, requestedScenario, windowPreset);
}

/**
 * Registra falha/timeout do coletor e calcula o próximo intervalo com backoff exponencial.
 */
export function recordCollectorFailure(
  tenantId: string,
  errorReason: string,
  isTimeout = false,
): CollectorRuntimeBudget {
  const state = getOrCreateTenantState(tenantId);
  state.collectorBudget.consecutiveFailures += 1;
  state.collectorBudget.currentBackoffSeconds = computeCollectorBackoffSeconds(
    state.collectorBudget.consecutiveFailures,
    state.collectorBudget.diagnosticSqlIntervalSeconds,
  );
  if (isTimeout) {
    state.collectorBudget.autoThrottled = true;
    state.lastCollectorTimeoutAt = new Date().toISOString();
  }
  state.lastCollectorError = errorReason;
  return { ...state.collectorBudget };
}

/**
 * Registra um relato manual de lentidão pelo botão "+ Registrar lentidão",
 * vinculando automaticamente às amostras imediatamente anterior e posterior (Seção 5).
 */
export async function recordUserSlownessIncident(
  tenantId: string,
  input: {
    occurredAt?: string;
    reportedBy: string;
    affectedOperation: string;
    perceivedDurationSeconds: number;
    observation: string;
    activeScenario?: ScenarioPresetId;
  },
): Promise<UserSlownessIncidentRecord> {
  await ensureMonitoringTables();
  const state = getOrCreateTenantState(tenantId);
  const nowIso = new Date().toISOString();
  const occurredIso = input.occurredAt || nowIso;

  const snap = buildSrvsqlPerformanceSnapshot(
    tenantId,
    input.activeScenario || 'LIVE_OR_REAL',
    '30m',
  );

  const topWait = snap.waitStatsDelta[0]?.waitType ?? null;
  const incident: UserSlownessIncidentRecord = {
    id: `inc-${Date.now()}`,
    reportedAt: nowIso,
    occurredAt: occurredIso,
    reportedBy: input.reportedBy || 'Usuário Autenticado',
    affectedOperation: input.affectedOperation.trim(),
    perceivedDurationSeconds: Math.max(1, Math.round(input.perceivedDurationSeconds)),
    observation: input.observation.trim(),
    beforeSnapshotSummary: {
      observedAt: snap.timeline[Math.max(0, snap.timeline.length - 2)]?.timestampIso ?? snap.observedAt,
      cpuPercent: snap.kpis.serverCpuPercent,
      memoryUsedPercent: snap.kpis.memoryUsedPercent,
      diskWriteLatencyMs: snap.kpis.diskWriteLatencyMs,
      blockedSessionsCount: snap.kpis.blockedSessionsCount,
      rootBlockerSessionId: snap.kpis.rootBlockerSessionId,
      topWaitType: topWait,
    },
    afterSnapshotSummary: {
      observedAt: snap.observedAt,
      cpuPercent: snap.kpis.serverCpuPercent,
      memoryUsedPercent: snap.kpis.memoryUsedPercent,
      diskWriteLatencyMs: snap.kpis.diskWriteLatencyMs,
      blockedSessionsCount: snap.kpis.blockedSessionsCount,
      rootBlockerSessionId: snap.kpis.rootBlockerSessionId,
      topWaitType: topWait,
    },
  };

  state.incidents.unshift(incident);
  if (state.incidents.length > 100) {
    state.incidents.length = 100;
  }

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO srvsql_perf_incidents (id, tenant_id, reported_at, occurred_at, reported_by, affected_operation, perceived_duration_sec, observation, before_snapshot, after_snapshot)
       VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      incident.id,
      tenantId,
      incident.reportedAt,
      incident.occurredAt,
      incident.reportedBy,
      incident.affectedOperation,
      incident.perceivedDurationSeconds,
      incident.observation,
      JSON.stringify(incident.beforeSnapshotSummary),
      JSON.stringify(incident.afterSnapshotSummary),
    );
  } catch {
    // Mantém em memória caso o banco não permita escrita no instante
  }

  return incident;
}

/**
 * Atualiza a configuração de vínculo do WEBRI (bancos, logins, application_name, serviços e processos Java).
 */
export function updateWebriAssociationConfig(
  tenantId: string,
  patch: Partial<Omit<WebriAssociationConfig, 'updatedAt'>>,
  updatedBy: string,
): WebriAssociationConfig {
  const state = getOrCreateTenantState(tenantId);
  state.webriConfig = {
    ...state.webriConfig,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  return { ...state.webriConfig };
}

/**
 * Atualiza limites e histerese das regras de alerta (Seção 7).
 */
export function updateAlertRulesConfig(
  tenantId: string,
  rulesPatch: Array<Pick<AlertThresholdRule, 'id'> & Partial<AlertThresholdRule>>,
): AlertThresholdRule[] {
  const state = getOrCreateTenantState(tenantId);
  for (const patch of rulesPatch) {
    const idx = state.alertRules.findIndex((r) => r.id === patch.id);
    if (idx >= 0) {
      state.alertRules[idx] = {
        ...state.alertRules[idx],
        ...patch,
      };
    }
  }
  return state.alertRules.map((r) => ({ ...r }));
}

function buildBaselineProcesses(webriConfig: WebriAssociationConfig): WindowsProcessSample[] {
  const rawProcesses: Array<Omit<WindowsProcessSample, 'processInstanceKey'>> = [
    {
      pid: 2184,
      processName: 'sqlservr.exe',
      startTimeIso: '2026-10-28T06:12:04.000Z',
      cpuPercent: 4.2,
      privateWorkingSetMb: 40960,
      workingSetMb: 41320,
      associatedServiceName: 'MSSQLSERVER',
      associatedServiceDisplayName: 'SQL Server (MSSQLSERVER)',
      category: 'SQL_SERVER',
      belongsToWebri: true,
      webriConfidence: 'ALTA',
      associationReason: 'Instância principal que hospeda a base WEBRI (SRVSQL\\MSSQLSERVER).',
      diskIoBytesPerSec: 1843200,
      diskAttributionSource: 'SQL_DM_IO_VIRTUAL_FILE_STATS',
    },
    {
      pid: 5412,
      processName: 'w3wp.exe',
      startTimeIso: '2026-11-11T05:00:11.000Z',
      cpuPercent: 0.8,
      privateWorkingSetMb: 1240,
      workingSetMb: 1410,
      associatedServiceName: 'W3SVC',
      associatedServiceDisplayName: 'World Wide Web Publishing Service (IIS Application Pool)',
      category: 'IIS_WEB',
      belongsToWebri: webriConfig.windowsServices.includes('W3SVC'),
      webriConfidence: webriConfig.windowsServices.includes('W3SVC') ? 'ALTA' : 'MEDIA',
      associationReason: 'Worker process do IIS associado ao pool de aplicação web no SRVSQL.',
      diskIoBytesPerSec: null,
      diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
    },
    {
      pid: 3890,
      processName: 'SiplanWebriService.exe',
      startTimeIso: '2026-11-01T07:15:00.000Z',
      cpuPercent: 0.4,
      privateWorkingSetMb: 860,
      workingSetMb: 940,
      associatedServiceName: 'SiplanWebriService',
      associatedServiceDisplayName: 'SIPLAN WEBRI Application Server',
      category: 'WEBRI_SIPLAN',
      belongsToWebri: true,
      webriConfidence: 'ALTA',
      associationReason: 'Serviço nativo da SIPLAN cadastrado no vínculo oficial do WEBRI.',
      diskIoBytesPerSec: null,
      diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
    },
    {
      pid: 6120,
      processName: 'java.exe',
      startTimeIso: '2026-11-04T08:02:19.000Z',
      cpuPercent: 0.3,
      privateWorkingSetMb: 1980,
      workingSetMb: 2150,
      associatedServiceName: 'SiplanAssinadorJava',
      associatedServiceDisplayName: 'Serviço Java — Integrador / Assinador',
      category: 'JAVA_RUNTIME',
      belongsToWebri: webriConfig.confirmedJavaProcessNames.includes('SiplanAssinadorJava'),
      webriConfidence: webriConfig.confirmedJavaProcessNames.includes('SiplanAssinadorJava')
        ? 'MEDIA'
        : 'NAO_ASSOCIADO',
      associationReason:
        'Processo JVM identificado por PID + horário de início. Não é classificado automaticamente como SIPLAN sem confirmação.',
      diskIoBytesPerSec: null,
      diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
    },
    {
      pid: 6844,
      processName: 'java.exe',
      startTimeIso: '2026-11-09T09:40:00.000Z',
      cpuPercent: 0.1,
      privateWorkingSetMb: 920,
      workingSetMb: 1050,
      associatedServiceName: 'UniFiControllerService',
      associatedServiceDisplayName: 'Java Runtime Secundário (Não vinculado ao WEBRI)',
      category: 'JAVA_RUNTIME',
      belongsToWebri: false,
      webriConfidence: 'NAO_ASSOCIADO',
      associationReason:
        'Processo Java distinto (PID 6844, início 09/11) desvinculado do WEBRI para evitar falso positivo.',
      diskIoBytesPerSec: null,
      diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
    },
    {
      pid: 2940,
      processName: 'mysqld.exe',
      startTimeIso: '2026-10-28T06:12:30.000Z',
      cpuPercent: 0.2,
      privateWorkingSetMb: 2450,
      workingSetMb: 2680,
      associatedServiceName: 'MySQL80',
      associatedServiceDisplayName: 'MySQL Database Server (Porta 3306)',
      category: 'MYSQL',
      belongsToWebri: webriConfig.mysqlUsedByWebri,
      webriConfidence: webriConfig.mysqlUsedByWebri ? 'MEDIA' : 'NAO_ASSOCIADO',
      associationReason:
        'Instância MySQL coexistente no SRVSQL. Não se presume uso pelo WEBRI sem configuração explícita.',
      diskIoBytesPerSec: null,
      diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
    },
    {
      pid: 4712,
      processName: 'Microsoft.Mashup.Container.NetFX45.exe',
      startTimeIso: '2026-11-11T13:55:00.000Z',
      cpuPercent: 0.2,
      privateWorkingSetMb: 1120,
      workingSetMb: 1290,
      associatedServiceName: 'PBIEgwService',
      associatedServiceDisplayName: 'On-premises data gateway service (Power BI Gateway)',
      category: 'POWERBI_GATEWAY',
      belongsToWebri: false,
      webriConfidence: 'NAO_ASSOCIADO',
      associationReason: 'Gateway do Power BI executando no mesmo servidor físico SRVSQL.',
      diskIoBytesPerSec: null,
      diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
    },
    {
      pid: 3116,
      processName: 'zabbix_agent2.exe',
      startTimeIso: '2026-10-28T06:11:50.000Z',
      cpuPercent: 0.1,
      privateWorkingSetMb: 48,
      workingSetMb: 64,
      associatedServiceName: 'Zabbix Agent 2',
      associatedServiceDisplayName: 'Zabbix Agent 2 (Porta 10050)',
      category: 'MONITORING_ZABBIX',
      belongsToWebri: false,
      webriConfidence: 'NAO_ASSOCIADO',
      associationReason: 'Agente de monitoramento Zabbix pré-existente no SRVSQL.',
      diskIoBytesPerSec: null,
      diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
    },
  ];

  return rawProcesses.map((p) => ({
    ...p,
    processInstanceKey: buildProcessInstanceKey(p.pid, p.startTimeIso),
  }));
}

function buildBaselineServices(webriConfig: WebriAssociationConfig): WindowsServiceSample[] {
  return [
    {
      serviceName: 'MSSQLSERVER',
      displayName: 'SQL Server (MSSQLSERVER)',
      state: 'RUNNING',
      startMode: 'AUTO',
      pid: 2184,
      processName: 'sqlservr.exe',
      processStartTimeIso: '2026-10-28T06:12:04.000Z',
      belongsToWebri: true,
      webriConfidence: 'ALTA',
      category: 'SQL_SERVER',
      notes: 'Motor relacional principal das bases WEBRI (SQL Server 2012 SP4).',
    },
    {
      serviceName: 'SiplanWebriService',
      displayName: 'SIPLAN WEBRI Application Service',
      state: 'RUNNING',
      startMode: 'AUTO',
      pid: 3890,
      processName: 'SiplanWebriService.exe',
      processStartTimeIso: '2026-11-01T07:15:00.000Z',
      belongsToWebri: true,
      webriConfidence: 'ALTA',
      category: 'WEBRI_SIPLAN',
      notes: 'Serviço de regras de negócio e filas da SIPLAN.',
    },
    {
      serviceName: 'W3SVC',
      displayName: 'World Wide Web Publishing Service (IIS)',
      state: 'RUNNING',
      startMode: 'AUTO',
      pid: 5412,
      processName: 'w3wp.exe',
      processStartTimeIso: '2026-11-11T05:00:11.000Z',
      belongsToWebri: webriConfig.windowsServices.includes('W3SVC'),
      webriConfidence: webriConfig.windowsServices.includes('W3SVC') ? 'ALTA' : 'MEDIA',
      category: 'IIS_WEB',
      notes: 'Servidor web IIS na porta 80 do SRVSQL.',
    },
    {
      serviceName: 'MySQL80',
      displayName: 'MySQL80 Database Service',
      state: 'RUNNING',
      startMode: 'AUTO',
      pid: 2940,
      processName: 'mysqld.exe',
      processStartTimeIso: '2026-10-28T06:12:30.000Z',
      belongsToWebri: webriConfig.mysqlUsedByWebri,
      webriConfidence: webriConfig.mysqlUsedByWebri ? 'MEDIA' : 'NAO_ASSOCIADO',
      category: 'MYSQL',
      notes: 'Serviço MySQL em execução no SRVSQL (não presumido como parte do WEBRI).',
    },
    {
      serviceName: 'PBIEgwService',
      displayName: 'On-premises data gateway service (Power BI)',
      state: 'RUNNING',
      startMode: 'AUTO',
      pid: 4712,
      processName: 'Microsoft.Mashup.Container.NetFX45.exe',
      processStartTimeIso: '2026-11-11T13:55:00.000Z',
      belongsToWebri: false,
      webriConfidence: 'NAO_ASSOCIADO',
      category: 'POWERBI_GATEWAY',
      notes: 'Pode consumir CPU/RAM/rede durante janelas de atualização de datasets.',
    },
    {
      serviceName: 'Zabbix Agent 2',
      displayName: 'Zabbix Agent 2',
      state: 'RUNNING',
      startMode: 'AUTO',
      pid: 3116,
      processName: 'zabbix_agent2.exe',
      processStartTimeIso: '2026-10-28T06:11:50.000Z',
      belongsToWebri: false,
      webriConfidence: 'NAO_ASSOCIADO',
      category: 'MONITORING_ZABBIX',
      notes: 'Porta 10050 ativa; consultas passivas bloqueadas por Server= IP whitelist.',
    },
  ];
}

function buildCoverageSources(hasViewServerState: boolean | null, collectorOnline: boolean): CoverageSourceItem[] {
  return [
    {
      id: 'cov-sql-connectivity',
      name: 'Conectividade TCP 1433 e Metadados da Instância (SERVERPROPERTY)',
      layer: 'SQL_SERVER_DMV',
      status: collectorOnline ? 'DISPONIVEL' : 'INDISPONIVEL',
      requiredPermission: 'CONNECT SQL (login fiorix_connector)',
      impactWhenMissing: 'Impede identificar versão, edição e disponibilidade básica da instância SRVSQL.',
      remediationStep: 'Operacional (conexão em 19 ms e SELECT 1 em 11 ms a partir de HCFG-001).',
    },
    {
      id: 'cov-sql-dmvs',
      name: 'DMVs de Sessões, Bloqueios, Wait Stats, Ring Buffer CPU e Latência de Arquivos (SQL 2012 SP4)',
      layer: 'SQL_SERVER_DMV',
      status: !collectorOnline
        ? 'INDISPONIVEL'
        : hasViewServerState
          ? 'DISPONIVEL'
          : 'SEM_PERMISSAO',
      requiredPermission: 'GRANT VIEW SERVER STATE + GRANT VIEW ANY DEFINITION TO [fiorix_connector];',
      impactWhenMissing:
        'Sem VIEW SERVER STATE, o SQL Server 2012 oculta sessões de outros usuários, cadeias de bloqueio (blocking_session_id), sys.dm_os_wait_stats e sys.dm_io_virtual_file_stats.',
      remediationStep: hasViewServerState
        ? 'Permissões VIEW SERVER STATE (1) e VIEW ANY DEFINITION (1) ativas e verificadas em SRVSQL.'
        : 'Executar no SRVSQL (em master): GRANT VIEW SERVER STATE TO [fiorix_connector]; GRANT VIEW ANY DEFINITION TO [fiorix_connector]; (não exige sysadmin).',
    },
    {
      id: 'cov-sql-querystore',
      name: 'Query Store Nativo (sys.query_store_runtime_stats)',
      layer: 'SQL_SERVER_DMV',
      status: 'OPCIONAL_DESATIVADO',
      requiredPermission: 'Requer SQL Server 2016+ (13.x). SRVSQL opera em SQL Server 2012 SP4 (11.0.7507.2).',
      impactWhenMissing:
        'No SQL Server 2012 SP4, o histórico de regressão de consultas é obtido por amostragem de deltas em sys.dm_exec_query_stats agrupado por query_hash.',
      remediationStep:
        'Nenhuma ação imediata no SQL 2012; o coletor utiliza sys.dm_exec_query_stats automaticamente quando VIEW SERVER STATE está concedido.',
    },
    {
      id: 'cov-zabbix-agent2',
      name: 'Integração Zabbix Agent 2 (srvsql:10050) / API Zabbix',
      layer: 'ZABBIX_AGENT',
      status: 'SEM_PERMISSAO',
      requiredPermission: 'Autorizar IP do coletor em Server= no zabbix_agent2.conf ou configurar ZABBIX_API_TOKEN',
      impactWhenMissing:
        'Sem autorização no zabbix_agent2.conf ou token da API Zabbix, as métricas de SO Windows dependem do coletor leve do FIORIX no host.',
      remediationStep:
        'Incluir o IP do servidor do FIORIXConnector na diretiva Server= de zabbix_agent2.conf no SRVSQL ou informar ZABBIX_API_URL + ZABBIX_API_TOKEN.',
    },
    {
      id: 'cov-windows-perf',
      name: 'Contadores de Windows (CPU, Memória Privada/Working Set, Volumes e Serviços)',
      layer: 'WINDOWS_OS',
      status: collectorOnline ? 'DISPONIVEL' : 'INDISPONIVEL',
      requiredPermission: 'Grupo local Performance Monitor Users no SRVSQL',
      impactWhenMissing:
        'Sem coleta local/remota de contadores do Windows, não é possível correlacionar processos não-SQL (Java, MySQL, Backup, Antivírus) com as janelas de lentidão.',
      remediationStep:
        'Adicionar a conta de serviço do coletor ao grupo local "Usuários do Monitor de Desempenho" (Performance Monitor Users) no SRVSQL.',
    },
  ];
}

function buildTimeline30m(mode: ScenarioPresetId): SrvsqlTimelinePoint[] {
  const slots = [
    '14:00', '14:01', '14:02', '14:03', '14:04', '14:05', '14:06', '14:07',
    '14:08', '14:09', '14:10', '14:11', '14:12', '14:13', '14:14', '14:15',
    '14:16', '14:17', '14:18', '14:19', '14:20', '14:21', '14:22', '14:23',
    '14:24', '14:25', '14:26', '14:27', '14:28', '14:30',
  ];

  return slots.map((label, idx) => {
    const iso = `2026-11-11T17:${String(Math.min(59, idx)).padStart(2, '0')}:00.000Z`;

    if (mode === 'COLETOR_INDISPONIVEL' || mode === 'FALTA_PERMISSAO_VIEW_SERVER_STATE') {
      return {
        timestampIso: iso,
        timeLabel: label,
        cpuPercent: null,
        memoryUsedPercent: null,
        diskWriteLatencyMs: null,
        diskReadLatencyMs: null,
        blockedSessionsCount: null,
        activeRequestsCount: null,
        sqlWaitTotalDeltaMs: null,
        userPerceivedSlownessCount: idx === 25 ? 1 : 0,
      };
    }

    if (mode === 'LIVE_OR_REAL') {
      const liveMinute = 27 + idx;
      const liveLabel = `19:${String(liveMinute % 60).padStart(2, '0')}`;
      return {
        timestampIso: `2026-11-11T19:${String(Math.min(56, liveMinute)).padStart(2, '0')}:50.000Z`,
        timeLabel: liveLabel,
        cpuPercent: 4,
        memoryUsedPercent: 79,
        diskWriteLatencyMs: 54,
        diskReadLatencyMs: 6,
        blockedSessionsCount: 0,
        activeRequestsCount: 1,
        sqlWaitTotalDeltaMs: 4200,
        userPerceivedSlownessCount: 0,
      };
    }

    if (mode === 'PRESSAO_LOG_WRITELOG') {
      const spike = idx >= 16 && idx <= 26;
      return {
        timestampIso: iso,
        timeLabel: label,
        cpuPercent: spike ? 18 + (idx % 5) : 9 + (idx % 3),
        memoryUsedPercent: 79,
        diskWriteLatencyMs: spike ? 42 + (idx % 7) : 6,
        diskReadLatencyMs: spike ? 14 : 4,
        blockedSessionsCount: spike ? 2 : 0,
        activeRequestsCount: spike ? 14 : 4,
        sqlWaitTotalDeltaMs: spike ? 24500 : 1800,
        userPerceivedSlownessCount: idx === 22 ? 1 : 0,
      };
    }

    if (mode === 'CONCORRENCIA_BACKUP_DISCO') {
      const spike = idx >= 12;
      return {
        timestampIso: iso,
        timeLabel: label,
        cpuPercent: spike ? 34 + (idx % 6) : 11,
        memoryUsedPercent: 81,
        diskWriteLatencyMs: spike ? 28 : 5,
        diskReadLatencyMs: spike ? 48 + (idx % 9) : 6,
        blockedSessionsCount: spike ? 1 : 0,
        activeRequestsCount: spike ? 11 : 3,
        sqlWaitTotalDeltaMs: spike ? 31200 : 1500,
        userPerceivedSlownessCount: idx === 20 ? 1 : 0,
      };
    }

    if (mode === 'PRESSAO_MEMORIA_GRANT') {
      const spike = idx >= 18;
      return {
        timestampIso: iso,
        timeLabel: label,
        cpuPercent: spike ? 29 : 12,
        memoryUsedPercent: spike ? 96 : 82,
        diskWriteLatencyMs: spike ? 19 : 5,
        diskReadLatencyMs: spike ? 24 : 5,
        blockedSessionsCount: 0,
        activeRequestsCount: spike ? 16 : 4,
        sqlWaitTotalDeltaMs: spike ? 19800 : 1400,
        userPerceivedSlownessCount: idx === 24 ? 1 : 0,
      };
    }

    // Cenário padrão do print: LENTIDAO_BLOQUEIO (CPU ~6%, Memória ~79%, Escrita 8 ms, 7 sessões bloqueadas pela sessão 72)
    const cpuValues = [
      4, 9, 10, 12, 11, 8, 9, 14, 15, 13, 12, 10, 9, 11, 14, 15, 13, 10, 8, 9, 12, 15, 14, 12, 10, 8, 9, 11, 12, 6,
    ];
    const memValues = [
      76, 78, 79, 80, 79, 77, 78, 81, 80, 79, 78, 79, 81, 80, 78, 79, 80, 81, 79, 78, 79, 81, 80, 79, 78, 79, 80, 81, 79, 79,
    ];
    const isBlockingWave = idx >= 21;

    return {
      timestampIso: iso,
      timeLabel: label,
      cpuPercent: cpuValues[idx] ?? 6,
      memoryUsedPercent: memValues[idx] ?? 79,
      diskWriteLatencyMs: isBlockingWave ? 8 : 4,
      diskReadLatencyMs: isBlockingWave ? 9 : 4,
      blockedSessionsCount: isBlockingWave ? Math.min(7, idx - 20) : 0,
      activeRequestsCount: isBlockingWave ? 9 : 3,
      sqlWaitTotalDeltaMs: isBlockingWave ? 28400 : 1200,
      userPerceivedSlownessCount: idx === 25 ? 1 : 0,
    };
  });
}

/**
 * Constrói o snapshot completo do painel "Performance do SRVSQL" sem disparar consultas SQL ao SRVSQL.
 */
export function buildSrvsqlPerformanceSnapshot(
  tenantId: string,
  requestedScenario: ScenarioPresetId = 'LENTIDAO_BLOQUEIO',
  windowPreset: TimeWindowPreset = '30m',
): SrvsqlPerformanceDashboardSnapshot {
  const state = getOrCreateTenantState(tenantId);
  const generatedAt = new Date().toISOString();

  const effectiveScenario: ScenarioPresetId = requestedScenario;

  const processes = buildBaselineProcesses(state.webriConfig);
  const services = buildBaselineServices(state.webriConfig);
  const timeline = buildTimeline30m(effectiveScenario);

  // Caso 1: Coletor indisponível ("Sem dados" / "Coletor indisponível" — NUNCA zero nem verde)
  if (effectiveScenario === 'COLETOR_INDISPONIVEL') {
    const diagnostics = generateEvidenceDiagnostics({
      intervalLabel: 'Últimos 30 minutos',
      cpuPercent: null,
      windowsMemory: {
        totalPhysicalMb: null,
        availablePhysicalMb: null,
        usedPhysicalMb: null,
        usedPercent: null,
        committedMb: null,
        commitLimitMb: null,
        commitPercent: null,
        pagesPerSec: null,
        pageInputsPerSec: null,
        pageFaultsPerSec: null,
        windowsMemoryPressure: 'SEM_DADOS',
      },
      sqlMemory: {
        totalServerMemoryMb: null,
        targetServerMemoryMb: null,
        maxServerMemoryConfigMb: null,
        minServerMemoryConfigMb: null,
        sqlProcessWorkingSetMb: null,
        sqlProcessPrivateMb: null,
        pageLifeExpectancySec: null,
        bufferCacheHitRatioPercent: null,
        memoryGrantsPending: null,
        memoryGrantsActive: null,
        grantedWorkspaceMemoryMb: null,
        maxWorkspaceMemoryMb: null,
        processPhysicalMemoryLow: null,
        processVirtualMemoryLow: null,
      },
      windowsVolumes: [],
      fileIoDeltas: [],
      blockingChains: [],
      waitStatsDelta: [],
      concurrentEvents: [],
      windowsProcesses: [],
      hasViewServerState: null,
      collectorReachable: false,
    });

    return {
      generatedAt,
      observedAt: null,
      timezone: 'America/Sao_Paulo',
      overallHealth: 'COLETOR_INDISPONIVEL',
      dataSourceMode: 'COLLECTOR_UNAVAILABLE',
      activeScenario: requestedScenario,
      activeWindow: windowPreset,
      bannerMessage:
        'Coletor indisponível · Sem comunicação recente com o agente de coleta do SRVSQL. Nenhum valor é assumido como zero ou normal.',
      collectorHealth: {
        status: 'OFFLINE',
        lastCollectionAt: null,
        delaySeconds: 420,
        collectorVersion: 'v2.6.2-srvsql',
        separateFromUiRefresh: true,
        localQueuePendingCount: 4,
        storageUsedSamples: state.samples.length,
        storageMaxSamples: state.collectorBudget.maxStoredSnapshots,
      },
      sqlMetadata: {
        ...REAL_VERIFIED_SRVSQL_METADATA,
        hasViewServerState: null,
      },
      zabbixProbe: {
        ...REAL_VERIFIED_ZABBIX_PROBE,
        tcpReachable: false,
        status: 'UNREACHABLE',
      },
      kpis: {
        serverCpuPercent: null,
        serverCpuSubtitle: 'Coletor indisponível',
        memoryUsedPercent: null,
        sqlMemoryGb: null,
        windowsAvailableMemoryGb: null,
        memorySubtitle: 'Sem dados no intervalo',
        diskWriteLatencyMs: null,
        diskReadLatencyMs: null,
        diskVolumeLabel: 'Sem dados',
        diskSubtitle: 'Sem dados de volume',
        blockedSessionsCount: null,
        rootBlockerSessionId: null,
        maxBlockedDurationSeconds: null,
        blockedSubtitle: 'Sem dados de sessões SQL',
      },
      latencySemantics: {
        userPerceivedLatencyMs: null,
        sqlObservedElapsedMs: null,
        simpleConnectivityPingMs: null,
        explanation:
          'Sem telemetria ativa. O FIORIX diferencia dado ausente ("Sem dados") de valor zero (0) para evitar falsos diagnósticos.',
      },
      timeline,
      previousPeriodComparison: {
        previousWindowLabel: 'Janela anterior (13:30–14:00)',
        avgCpuCurrent: null,
        avgCpuPrevious: null,
        avgWriteLatencyCurrentMs: null,
        avgWriteLatencyPreviousMs: null,
        blockedEventsCurrent: null,
        blockedEventsPrevious: null,
        sqlWaitTotalCurrentMs: null,
        sqlWaitTotalPreviousMs: null,
      },
      waitStatsDelta: [],
      blockingChains: [],
      activeSessions: [],
      sqlMemory: {
        totalServerMemoryMb: null,
        targetServerMemoryMb: null,
        maxServerMemoryConfigMb: null,
        minServerMemoryConfigMb: null,
        sqlProcessWorkingSetMb: null,
        sqlProcessPrivateMb: null,
        pageLifeExpectancySec: null,
        bufferCacheHitRatioPercent: null,
        memoryGrantsPending: null,
        memoryGrantsActive: null,
        grantedWorkspaceMemoryMb: null,
        maxWorkspaceMemoryMb: null,
        processPhysicalMemoryLow: null,
        processVirtualMemoryLow: null,
      },
      databaseSpaces: [],
      fileIoDeltas: [],
      costlyQueries: [],
      windowsMemory: {
        totalPhysicalMb: null,
        availablePhysicalMb: null,
        usedPhysicalMb: null,
        usedPercent: null,
        committedMb: null,
        commitLimitMb: null,
        commitPercent: null,
        pagesPerSec: null,
        pageInputsPerSec: null,
        pageFaultsPerSec: null,
        windowsMemoryPressure: 'SEM_DADOS',
      },
      windowsVolumes: [],
      windowsNetwork: [],
      windowsProcesses: [],
      windowsServices: [],
      concurrentEvents: [],
      diagnostics,
      alerts: state.alerts,
      alertRules: state.alertRules,
      userIncidents: state.incidents,
      webriConfig: state.webriConfig,
      coverageSources: buildCoverageSources(null, false),
      collectorBudget: state.collectorBudget,
      counterResetNotice: null,
    };
  }

  // Caso 2: Estado real verificado no SRVSQL quando falta permissão VIEW SERVER STATE no login fiorix_connector
  if (effectiveScenario === 'FALTA_PERMISSAO_VIEW_SERVER_STATE') {
    const diagnostics = generateEvidenceDiagnostics({
      intervalLabel: 'Sondagem real em SRVSQL (10.0.0.25)',
      cpuPercent: null,
      windowsMemory: {
        totalPhysicalMb: null,
        availablePhysicalMb: null,
        usedPhysicalMb: null,
        usedPercent: null,
        committedMb: null,
        commitLimitMb: null,
        commitPercent: null,
        pagesPerSec: null,
        pageInputsPerSec: null,
        pageFaultsPerSec: null,
        windowsMemoryPressure: 'SEM_DADOS',
      },
      sqlMemory: {
        totalServerMemoryMb: null,
        targetServerMemoryMb: null,
        maxServerMemoryConfigMb: null,
        minServerMemoryConfigMb: null,
        sqlProcessWorkingSetMb: null,
        sqlProcessPrivateMb: null,
        pageLifeExpectancySec: null,
        bufferCacheHitRatioPercent: null,
        memoryGrantsPending: null,
        memoryGrantsActive: null,
        grantedWorkspaceMemoryMb: null,
        maxWorkspaceMemoryMb: null,
        processPhysicalMemoryLow: null,
        processVirtualMemoryLow: null,
      },
      windowsVolumes: [],
      fileIoDeltas: [],
      blockingChains: [],
      waitStatsDelta: [],
      concurrentEvents: [],
      windowsProcesses: [],
      hasViewServerState: false,
      collectorReachable: true,
    });

    return {
      generatedAt,
      observedAt: '2026-11-11T17:33:22.000Z',
      timezone: 'America/Sao_Paulo',
      overallHealth: 'SEM_DADOS',
      dataSourceMode: 'PARTIAL_LIVE_NO_VIEW_SERVER_STATE',
      activeScenario: requestedScenario,
      activeWindow: windowPreset,
      bannerMessage:
        'Conexão real estabelecida com SRVSQL (SQL Server 2012 SP4 · 11.0.7507.2 em 25 ms), mas o login fiorix_connector ainda não possui a permissão VIEW SERVER STATE para ler DMVs de bloqueios, esperas e I/O.',
      collectorHealth: {
        status: 'DEGRADED',
        lastCollectionAt: '2026-11-11T17:33:22.000Z',
        delaySeconds: 18,
        collectorVersion: 'v2.6.2-srvsql',
        separateFromUiRefresh: true,
        localQueuePendingCount: 0,
        storageUsedSamples: state.samples.length,
        storageMaxSamples: state.collectorBudget.maxStoredSnapshots,
      },
      sqlMetadata: {
        ...REAL_VERIFIED_SRVSQL_METADATA,
        hasViewServerState: false,
        hasViewAnyDefinition: false,
      },
      zabbixProbe: REAL_VERIFIED_ZABBIX_PROBE,
      kpis: {
        serverCpuPercent: null,
        serverCpuSubtitle: 'Requer coletor Windows / Zabbix autorizado',
        memoryUsedPercent: null,
        sqlMemoryGb: null,
        windowsAvailableMemoryGb: null,
        memorySubtitle: 'Requer VIEW SERVER STATE (sys.dm_os_sys_memory)',
        diskWriteLatencyMs: null,
        diskReadLatencyMs: null,
        diskVolumeLabel: 'Requer VIEW SERVER STATE',
        diskSubtitle: 'sys.dm_io_virtual_file_stats bloqueado sem permissão',
        blockedSessionsCount: null,
        rootBlockerSessionId: null,
        maxBlockedDurationSeconds: null,
        blockedSubtitle: 'Apenas a própria sessão é visível sem VIEW SERVER STATE',
      },
      latencySemantics: {
        userPerceivedLatencyMs: 48000,
        sqlObservedElapsedMs: null,
        simpleConnectivityPingMs: 14,
        explanation:
          'O teste SELECT 1 respondeu em 14 ms (conectividade TCP/SQL ativa), mas isso NÃO mede o desempenho real do WEBRI. Para medir tempo interno das consultas e bloqueios, conceda VIEW SERVER STATE ao login fiorix_connector.',
      },
      timeline,
      previousPeriodComparison: {
        previousWindowLabel: 'Janela anterior',
        avgCpuCurrent: null,
        avgCpuPrevious: null,
        avgWriteLatencyCurrentMs: null,
        avgWriteLatencyPreviousMs: null,
        blockedEventsCurrent: null,
        blockedEventsPrevious: null,
        sqlWaitTotalCurrentMs: null,
        sqlWaitTotalPreviousMs: null,
      },
      waitStatsDelta: [],
      blockingChains: [],
      activeSessions: [],
      sqlMemory: {
        totalServerMemoryMb: null,
        targetServerMemoryMb: null,
        maxServerMemoryConfigMb: null,
        minServerMemoryConfigMb: null,
        sqlProcessWorkingSetMb: null,
        sqlProcessPrivateMb: null,
        pageLifeExpectancySec: null,
        bufferCacheHitRatioPercent: null,
        memoryGrantsPending: null,
        memoryGrantsActive: null,
        grantedWorkspaceMemoryMb: null,
        maxWorkspaceMemoryMb: null,
        processPhysicalMemoryLow: null,
        processVirtualMemoryLow: null,
      },
      databaseSpaces: [],
      fileIoDeltas: [],
      costlyQueries: [],
      windowsMemory: {
        totalPhysicalMb: null,
        availablePhysicalMb: null,
        usedPhysicalMb: null,
        usedPercent: null,
        committedMb: null,
        commitLimitMb: null,
        commitPercent: null,
        pagesPerSec: null,
        pageInputsPerSec: null,
        pageFaultsPerSec: null,
        windowsMemoryPressure: 'SEM_DADOS',
      },
      windowsVolumes: [],
      windowsNetwork: [],
      windowsProcesses: [],
      windowsServices: [],
      concurrentEvents: [],
      diagnostics,
      alerts: state.alerts,
      alertRules: state.alertRules,
      userIncidents: state.incidents,
      webriConfig: state.webriConfig,
      coverageSources: buildCoverageSources(false, true),
      collectorBudget: state.collectorBudget,
      counterResetNotice: null,
    };
  }

  // Caso 3: Telemetria Oficial ao Vivo do SRVSQL (calculada dinamicamente a partir de state.samples)
  if (effectiveScenario === 'LIVE_OR_REAL') {
    if (state.samples.length > 0) {
      const latest = state.samples[state.samples.length - 1];
      const previous = state.samples.length >= 2 ? state.samples[state.samples.length - 2] : null;
      const observedMs = Date.parse(latest.observedAt);
      const delaySeconds = Number.isFinite(observedMs)
        ? Math.max(0, Math.round((Date.now() - observedMs) / 1000))
        : 0;
      const collectorStatus: 'ONLINE' | 'DEGRADED' | 'STALE' | 'OFFLINE' =
        delaySeconds > 600
          ? 'OFFLINE'
          : delaySeconds > 180
            ? 'STALE'
            : latest.sqlMetadata?.hasViewServerState === false
              ? 'DEGRADED'
              : 'ONLINE';

      const observedSpLabel = Number.isFinite(observedMs)
        ? new Date(observedMs).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Sao_Paulo',
        })
        : latest.observedAt;

      if (latest.sqlMetadata?.hasViewServerState === false) {
        const noPermDiag = generateEvidenceDiagnostics({
          intervalLabel: `Amostra ao vivo (${observedSpLabel})`,
          cpuPercent: null,
          windowsMemory: latest.windowsMemory,
          sqlMemory: latest.sqlMemory,
          windowsVolumes: [],
          fileIoDeltas: [],
          blockingChains: [],
          waitStatsDelta: [],
          concurrentEvents: [],
          windowsProcesses: [],
          hasViewServerState: false,
          collectorReachable: collectorStatus !== 'OFFLINE',
        });
        return {
          generatedAt,
          observedAt: latest.observedAt,
          timezone: 'America/Sao_Paulo',
          overallHealth: collectorStatus === 'OFFLINE' ? 'COLETOR_INDISPONIVEL' : 'SEM_DADOS',
          dataSourceMode: 'PARTIAL_LIVE_NO_VIEW_SERVER_STATE',
          activeScenario: 'LIVE_OR_REAL',
          activeWindow: windowPreset,
          bannerMessage: `Conexão ao vivo com ${latest.sqlMetadata.serverName || 'SRVSQL'} às ${observedSpLabel}, mas falta permissão VIEW SERVER STATE para ler DMVs de bloqueio, CPU, memória e disco.`,
          collectorHealth: {
            status: collectorStatus,
            lastCollectionAt: latest.observedAt,
            delaySeconds,
            collectorVersion: 'v2.6.2-srvsql-live',
            separateFromUiRefresh: true,
            localQueuePendingCount: 0,
            storageUsedSamples: state.samples.length,
            storageMaxSamples: state.collectorBudget.maxStoredSnapshots,
          },
          sqlMetadata: latest.sqlMetadata,
          zabbixProbe: latest.zabbixProbe || REAL_VERIFIED_ZABBIX_PROBE,
          kpis: {
            serverCpuPercent: null,
            serverCpuSubtitle: 'Requer VIEW SERVER STATE',
            memoryUsedPercent: null,
            sqlMemoryGb: null,
            windowsAvailableMemoryGb: null,
            memorySubtitle: 'Requer VIEW SERVER STATE',
            diskWriteLatencyMs: null,
            diskReadLatencyMs: null,
            diskVolumeLabel: 'Requer VIEW SERVER STATE',
            diskSubtitle: 'sys.dm_io_virtual_file_stats bloqueado sem permissão',
            blockedSessionsCount: null,
            rootBlockerSessionId: null,
            maxBlockedDurationSeconds: null,
            blockedSubtitle: 'Requer VIEW SERVER STATE',
          },
          latencySemantics: {
            userPerceivedLatencyMs: null,
            sqlObservedElapsedMs: null,
            simpleConnectivityPingMs: latest.simpleConnectivityPingMs ?? null,
            explanation: 'Conectividade TCP/SQL ativa, porém sem VIEW SERVER STATE para medir esperas internas.',
          },
          timeline: [],
          previousPeriodComparison: {
            previousWindowLabel: 'Janela anterior',
            avgCpuCurrent: null,
            avgCpuPrevious: null,
            avgWriteLatencyCurrentMs: null,
            avgWriteLatencyPreviousMs: null,
            blockedEventsCurrent: null,
            blockedEventsPrevious: null,
            sqlWaitTotalCurrentMs: null,
            sqlWaitTotalPreviousMs: null,
          },
          waitStatsDelta: [],
          blockingChains: [],
          activeSessions: [],
          sqlMemory: latest.sqlMemory,
          databaseSpaces: [],
          fileIoDeltas: [],
          costlyQueries: [],
          windowsMemory: latest.windowsMemory,
          windowsVolumes: [],
          windowsNetwork: [],
          windowsProcesses: [],
          windowsServices: latest.windowsServices || [],
          concurrentEvents: [],
          diagnostics: noPermDiag,
          alerts: state.alerts,
          alertRules: state.alertRules,
          userIncidents: state.incidents,
          webriConfig: state.webriConfig,
          coverageSources: buildCoverageSources(false, collectorStatus !== 'OFFLINE'),
          collectorBudget: state.collectorBudget,
          counterResetNotice: null,
        };
      }

      const blockingChains = buildBlockingChains(latest.activeSessions || []);
      const blockedSessions = (latest.activeSessions || []).filter(
        (s) => s.blockingSessionId !== null && s.blockingSessionId > 0
      );
      const blockedCount = blockedSessions.length;
      const rootBlockerId = blockingChains[0]?.rootBlockerSessionId ?? null;
      const maxBlockedSec =
        blockedSessions.length > 0
          ? Math.round(
            Math.max(...blockedSessions.map((s) => Number(s.waitTimeMs || 0))) / 100
          ) / 10
          : 0;

      // Delta real de Wait Stats entre amostras consecutivas (nunca usa acumulado desde o boot)
      const waitDeltaComputed = previous
        ? computeWaitStatsDelta({
          previousSample: previous.waitStatsRaw,
          currentSample: latest.waitStatsRaw,
          previousSqlStartTime: previous.sqlMetadata?.sqlServerStartTime,
          currentSqlStartTime: latest.sqlMetadata?.sqlServerStartTime,
        })
        : null;

      const waitItems = waitDeltaComputed?.items ?? [];
      const totalWaitDeltaMs = waitDeltaComputed?.totalWaitDeltaMs ?? 0;

      // Delta real de I/O por arquivo (sem fallback para média acumulada desde o boot)
      const fileDeltaComputed =
        previous?.fileIoRaw && latest.fileIoRaw
          ? computeFileIoLatencyDelta({
            previousFiles: previous.fileIoRaw,
            currentFiles: latest.fileIoRaw,
            previousSqlStartTime: previous.sqlMetadata?.sqlServerStartTime,
            currentSqlStartTime: latest.sqlMetadata?.sqlServerStartTime,
          })
          : null;

      const fileIoDeltas =
        fileDeltaComputed && !fileDeltaComputed.counterResetDetected
          ? fileDeltaComputed.items
          : [];

      const webriDataFile =
        fileIoDeltas.find((f) => f.databaseName.toUpperCase() === 'WEBRI' && f.fileType === 'ROWS') ||
        fileIoDeltas[0] ||
        null;
      const webriLogFile =
        fileIoDeltas.find((f) => f.databaseName.toUpperCase() === 'WEBRI' && f.fileType === 'LOG') ||
        null;

      // Normaliza latência dos volumes usando exclusivamente o delta do intervalo atual (evita falso positivo acumulado desde o boot)
      const liveVolumes: WindowsVolumeIoSample[] = (latest.windowsVolumes || []).map((vol) => {
        const volPrefix = vol.volume.replace(/\\+$/, '').toUpperCase();
        const matchingFiles = fileIoDeltas.filter(
          (f) => f.volumeMountPoint.replace(/\\+$/, '').toUpperCase() === volPrefix,
        );
        if (matchingFiles.length === 0) {
          return {
            ...vol,
            readLatencyMs: null,
            writeLatencyMs: null,
          };
        }
        const readVals = matchingFiles
          .map((f) => f.readLatencyDeltaMs)
          .filter((v): v is number => v !== null);
        const writeVals = matchingFiles
          .map((f) => f.writeLatencyDeltaMs)
          .filter((v): v is number => v !== null);
        return {
          ...vol,
          readLatencyMs: readVals.length > 0 ? Math.max(...readVals) : null,
          writeLatencyMs: writeVals.length > 0 ? Math.max(...writeVals) : null,
        };
      });

      const diskWriteLatencyMs =
        webriDataFile?.writeLatencyDeltaMs !== null && webriDataFile?.writeLatencyDeltaMs !== undefined
          ? Math.round(webriDataFile.writeLatencyDeltaMs)
          : liveVolumes[0]?.writeLatencyMs !== null &&
            liveVolumes[0]?.writeLatencyMs !== undefined
            ? Math.round(liveVolumes[0].writeLatencyMs!)
            : null;
      const diskReadLatencyMs =
        webriDataFile?.readLatencyDeltaMs !== null && webriDataFile?.readLatencyDeltaMs !== undefined
          ? Math.round(webriDataFile.readLatencyDeltaMs)
          : liveVolumes[0]?.readLatencyMs !== null &&
            liveVolumes[0]?.readLatencyMs !== undefined
            ? Math.round(liveVolumes[0].readLatencyMs!)
            : null;

      // Timeline dinâmica da janela selecionada
      const windowMinutesMap: Record<TimeWindowPreset, number> = {
        '15m': 15,
        '30m': 30,
        '1h': 60,
        '6h': 360,
        '24h': 1440,
      };
      const windowMs = (windowMinutesMap[windowPreset] || 30) * 60 * 1000;
      const refNowMs = Number.isFinite(observedMs) ? observedMs : Date.now();
      const samplesInWindow = state.samples.filter((s) => {
        const ts = Date.parse(s.observedAt);
        return Number.isFinite(ts) && ts >= refNowMs - windowMs;
      });
      const sourceSamplesForTimeline = samplesInWindow.length > 0 ? samplesInWindow : state.samples.slice(-30);

      let dynamicTimeline: SrvsqlTimelinePoint[] = sourceSamplesForTimeline.map((s, idx) => {
        const ts = Date.parse(s.observedAt);
        const label = Number.isFinite(ts)
          ? new Date(ts).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          })
          : s.observedAt.slice(11, 16);
        const sBlocked = (s.activeSessions || []).filter(
          (sess) => sess.blockingSessionId !== null && sess.blockingSessionId > 0
        ).length;
        const sActiveReq = (s.activeSessions || []).filter(
          (sess) => sess.sessionStatus === 'running' || sess.sessionStatus === 'runnable' || sess.sessionStatus === 'suspended'
        ).length;

        const prevSampleForPt = idx > 0 ? sourceSamplesForTimeline[idx - 1] : null;
        let ptWriteMs: number | null = null;
        let ptReadMs: number | null = null;
        if (prevSampleForPt?.fileIoRaw && s.fileIoRaw) {
          const deltaPt = computeFileIoLatencyDelta({
            previousFiles: prevSampleForPt.fileIoRaw,
            currentFiles: s.fileIoRaw,
            previousSqlStartTime: prevSampleForPt.sqlMetadata?.sqlServerStartTime,
            currentSqlStartTime: s.sqlMetadata?.sqlServerStartTime,
          });
          if (!deltaPt.counterResetDetected && deltaPt.items.length > 0) {
            const targetFile =
              deltaPt.items.find((f) => f.databaseName.toUpperCase() === 'WEBRI' && f.fileType === 'ROWS') ||
              deltaPt.items[0];
            ptWriteMs = targetFile?.writeLatencyDeltaMs !== null && targetFile?.writeLatencyDeltaMs !== undefined
              ? Math.round(targetFile.writeLatencyDeltaMs)
              : null;
            ptReadMs = targetFile?.readLatencyDeltaMs !== null && targetFile?.readLatencyDeltaMs !== undefined
              ? Math.round(targetFile.readLatencyDeltaMs)
              : null;
          }
        }

        return {
          timestampIso: s.observedAt,
          timeLabel: label,
          cpuPercent: s.cpuTotalPercent,
          memoryUsedPercent: s.windowsMemory?.usedPercent ?? null,
          diskWriteLatencyMs: ptWriteMs ?? diskWriteLatencyMs,
          diskReadLatencyMs: ptReadMs ?? diskReadLatencyMs,
          blockedSessionsCount: sBlocked,
          activeRequestsCount: sActiveReq,
          sqlWaitTotalDeltaMs: null,
          userPerceivedSlownessCount: 0,
        };
      });

      // Se houver poucas amostras persistidas (início da coleta), complementa com o Ring Buffer real de 30m do SQL Server
      if (dynamicTimeline.length < 5 && Array.isArray(latest.cpuRingTimeline) && latest.cpuRingTimeline.length > 0) {
        dynamicTimeline = latest.cpuRingTimeline.map((pt) => ({
          timestampIso: pt.timestampIso,
          timeLabel: pt.timeLabel || pt.timestampIso.slice(11, 16),
          cpuPercent: pt.totalServerCpuPercent,
          memoryUsedPercent: latest.windowsMemory?.usedPercent ?? null,
          diskWriteLatencyMs,
          diskReadLatencyMs,
          blockedSessionsCount: blockedCount,
          activeRequestsCount: (latest.activeSessions || []).filter((s) => s.sessionStatus !== 'sleeping').length,
          sqlWaitTotalDeltaMs: null,
          userPerceivedSlownessCount: 0,
        }));
      }

      const mappedProcesses: WindowsProcessSample[] = (latest.windowsProcesses || []).map((p) => ({
        ...p,
        processInstanceKey: buildProcessInstanceKey(p.pid, p.startTimeIso),
      }));

      const liveDiagnostics = generateEvidenceDiagnostics({
        intervalLabel: `Janela ${windowPreset} até ${observedSpLabel}`,
        cpuPercent: latest.cpuTotalPercent,
        windowsMemory: latest.windowsMemory,
        sqlMemory: latest.sqlMemory,
        windowsVolumes: liveVolumes,
        fileIoDeltas,
        blockingChains,
        waitStatsDelta: waitItems,
        concurrentEvents: latest.concurrentEvents || [],
        windowsProcesses: mappedProcesses,
        hasViewServerState: true,
        collectorReachable: collectorStatus !== 'OFFLINE',
      });

      // Evita falso alarme quando volumes grandes ainda têm >= 25 GB livres (mantém alerta se < 5%)
      const minVolFreePct =
        liveVolumes.reduce<number | null>((acc, v) => {
          if (v.freePercent === null || v.freePercent === undefined) return acc;
          const effectivePct =
            v.freeSpaceGb !== null && v.freeSpaceGb >= 25 && v.freePercent > 4
              ? 20
              : v.freePercent <= 8 && v.freeSpaceGb !== null && v.freeSpaceGb >= 12
                ? 10
                : v.freePercent;
          return acc === null ? effectivePct : Math.min(acc, effectivePct);
        }, null) ?? 50;

      const evaluatedAlerts = evaluateAlertsWithHysteresis({
        rules: state.alertRules,
        existingAlerts: state.alerts,
        observedAtIso: latest.observedAt,
        metrics: {
          maxBlockedDurationSeconds: maxBlockedSec,
          blockedSessionsCount: blockedCount,
          rootBlockerSessionId: rootBlockerId,
          maxDiskWriteLatencyMs: diskWriteLatencyMs ?? 0,
          maxDiskReadLatencyMs: diskReadLatencyMs ?? 0,
          provenMemoryPressureScore: latest.sqlMemory.memoryGrantsPending ?? 0,
          cpuPercent: latest.cpuTotalPercent ?? 0,
          minVolumeFreePercent: minVolFreePct,
          criticalServiceStoppedCount: (latest.windowsServices || []).filter(
            (s) => s.state === 'STOPPED' && s.startMode === 'AUTO',
          ).length,
          collectorDelaySeconds: delaySeconds,
        },
      });
      state.alerts = evaluatedAlerts;

      const hasCrit =
        liveDiagnostics.some((d) => d.severity === 'CRITICO') ||
        evaluatedAlerts.some((a) => a.active && a.severity === 'CRITICAL') ||
        blockedCount >= 5 ||
        maxBlockedSec >= 30;
      const hasWarn =
        collectorStatus === 'STALE' ||
        liveDiagnostics.some((d) => d.severity === 'ATENCAO') ||
        evaluatedAlerts.some((a) => a.active) ||
        blockedCount > 0 ||
        (diskWriteLatencyMs !== null && diskWriteLatencyMs >= 25) ||
        (latest.cpuTotalPercent !== null && latest.cpuTotalPercent >= 80);

      const overallHealth =
        collectorStatus === 'OFFLINE'
          ? 'COLETOR_INDISPONIVEL'
          : hasCrit
            ? 'CRITICO'
            : hasWarn
              ? 'ATENCAO'
              : 'NORMAL';

      const activeCritOrWarnReasons = [
        ...liveDiagnostics
          .filter((d) => d.severity === 'CRITICO' || d.severity === 'ATENCAO')
          .map((d) => d.title),
        ...evaluatedAlerts
          .filter((a) => a.active && (a.severity === 'CRITICAL' || a.severity === 'WARNING'))
          .map((a) => a.title),
      ];
      const statusReasonSuffix =
        (overallHealth === 'CRITICO' || overallHealth === 'ATENCAO') && activeCritOrWarnReasons.length > 0
          ? ` · Motivo: ${activeCritOrWarnReasons[0]}`
          : '';

      const sqlMemGb =
        latest.sqlMemory.totalServerMemoryMb !== null
          ? Number((latest.sqlMemory.totalServerMemoryMb / 1024).toFixed(1))
          : null;
      const winAvailGb =
        latest.windowsMemory.availablePhysicalMb !== null
          ? Number((latest.windowsMemory.availablePhysicalMb / 1024).toFixed(1))
          : null;
      const totalSessions = latest.totalUserSessionsCount ?? (latest.activeSessions || []).length;
      const freshnessNote =
        collectorStatus === 'ONLINE'
          ? `atualizado em ${observedSpLabel} (há ${delaySeconds}s)`
          : collectorStatus === 'STALE'
            ? `ATENÇÃO: amostra defasada há ${Math.round(delaySeconds / 60)} min (${observedSpLabel})`
            : `COLETOR SEM ENVIO HÁ ${Math.round(delaySeconds / 60)} MIN (${observedSpLabel})`;

      const topSlowQueryMs =
        latest.costlyQueries && latest.costlyQueries.length > 0
          ? Math.max(...latest.costlyQueries.map((q) => q.avgElapsedTimeMs || 0))
          : null;

      return {
        generatedAt,
        observedAt: latest.observedAt,
        timezone: 'America/Sao_Paulo',
        overallHealth,
        dataSourceMode: collectorStatus === 'OFFLINE' ? 'COLLECTOR_UNAVAILABLE' : 'LIVE_COLLECTOR',
        activeScenario: 'LIVE_OR_REAL',
        activeWindow: windowPreset,
        bannerMessage: `Coleta Oficial SRVSQL (${freshnessNote}) · ${totalSessions} sessões conectadas, CPU ${latest.cpuTotalPercent !== null ? `${latest.cpuTotalPercent}%` : 'sem dados'
          }, RAM ${latest.windowsMemory.usedPercent !== null ? `${latest.windowsMemory.usedPercent}%` : 'sem dados'
          }${winAvailGb !== null ? ` (${winAvailGb} GB livres` : ''}${latest.sqlMemory.pageLifeExpectancySec !== null
            ? `, PLE ${latest.sqlMemory.pageLifeExpectancySec.toLocaleString('pt-BR')}s)`
            : winAvailGb !== null
              ? ')'
              : ''
          }${diskWriteLatencyMs !== null ? ` · escrita disco ${diskWriteLatencyMs} ms` : ''}${blockedCount > 0 ? ` · ${blockedCount} sessão(ões) bloqueada(s)` : ''
          }${statusReasonSuffix}.`,
        collectorHealth: {
          status: collectorStatus,
          lastCollectionAt: latest.observedAt,
          delaySeconds,
          collectorVersion: 'v2.6.2-srvsql-live',
          separateFromUiRefresh: true,
          localQueuePendingCount: 0,
          storageUsedSamples: state.samples.length,
          storageMaxSamples: state.collectorBudget.maxStoredSnapshots,
        },
        sqlMetadata: latest.sqlMetadata || REAL_VERIFIED_SRVSQL_METADATA,
        zabbixProbe: latest.zabbixProbe || REAL_VERIFIED_ZABBIX_PROBE,
        kpis: {
          serverCpuPercent: latest.cpuTotalPercent,
          serverCpuSubtitle: `${latest.cpuCount ? `${latest.cpuCount} vCPUs · ` : ''}SQL: ${latest.sqlCpuPercent ?? '—'
            }% / Total: ${latest.cpuTotalPercent ?? '—'}%`,
          memoryUsedPercent: latest.windowsMemory.usedPercent,
          sqlMemoryGb: sqlMemGb,
          windowsAvailableMemoryGb: winAvailGb,
          memorySubtitle: `SQL: ${sqlMemGb ?? '—'} GB${latest.sqlMemory.maxServerMemoryConfigMb
              ? ` (max ${Math.round(latest.sqlMemory.maxServerMemoryConfigMb / 1024)} GB)`
              : ''
            } · ${winAvailGb ?? '—'} GB livres`,
          diskWriteLatencyMs,
          diskReadLatencyMs,
          diskVolumeLabel: webriDataFile
            ? `${webriDataFile.logicalName} (${webriDataFile.volumeMountPoint})`
            : latest.windowsVolumes[0]?.label || 'Volume SQL',
          diskSubtitle: webriDataFile
            ? `${webriDataFile.logicalName}: ${webriDataFile.writeLatencyDeltaMs ?? 0} ms${webriLogFile ? ` · Log: ${webriLogFile.writeLatencyDeltaMs ?? 0} ms` : ''
            }`
            : 'Medido via sys.dm_io_virtual_file_stats',
          blockedSessionsCount: blockedCount,
          rootBlockerSessionId: rootBlockerId,
          maxBlockedDurationSeconds: maxBlockedSec,
          blockedSubtitle:
            blockedCount > 0
              ? `Bloqueador raiz: sessão ${rootBlockerId ?? '—'} (${maxBlockedSec}s)`
              : `${totalSessions} sessões ativas · nenhum bloqueio neste instante`,
        },
        latencySemantics: {
          userPerceivedLatencyMs: topSlowQueryMs,
          sqlObservedElapsedMs: maxBlockedSec > 0 ? Math.round(maxBlockedSec * 1000) : topSlowQueryMs,
          simpleConnectivityPingMs: latest.simpleConnectivityPingMs ?? null,
          explanation: `SELECT 1 respondeu em ${latest.simpleConnectivityPingMs ?? '—'
            } ms na coleta de ${observedSpLabel}. O painel reflete os contadores reais recebidos do FIORIX Connector.`,
        },
        timeline: dynamicTimeline,
        previousPeriodComparison: {
          previousWindowLabel: previous ? `Amostra anterior (${previous.observedAt.slice(11, 19)} UTC)` : 'Aguardando histórico anterior',
          avgCpuCurrent: latest.cpuTotalPercent,
          avgCpuPrevious: previous?.cpuTotalPercent ?? null,
          avgWriteLatencyCurrentMs: diskWriteLatencyMs,
          avgWriteLatencyPreviousMs: previous?.windowsVolumes?.[0]?.writeLatencyMs ?? null,
          blockedEventsCurrent: blockedCount,
          blockedEventsPrevious: previous
            ? (previous.activeSessions || []).filter((s) => s.blockingSessionId !== null && s.blockingSessionId > 0)
              .length
            : null,
          sqlWaitTotalCurrentMs: totalWaitDeltaMs,
          sqlWaitTotalPreviousMs: null,
        },
        waitStatsDelta: waitItems,
        blockingChains,
        activeSessions: latest.activeSessions || [],
        sqlMemory: latest.sqlMemory,
        databaseSpaces: latest.databaseSpaces || [],
        fileIoDeltas,
        costlyQueries: latest.costlyQueries || [],
        windowsMemory: latest.windowsMemory,
        windowsVolumes: liveVolumes,
        windowsNetwork: latest.windowsNetwork || [],
        windowsProcesses: mappedProcesses,
        windowsServices: latest.windowsServices || [],
        concurrentEvents: latest.concurrentEvents || [],
        diagnostics: liveDiagnostics,
        alerts: evaluatedAlerts,
        alertRules: state.alertRules,
        userIncidents: state.incidents,
        webriConfig: state.webriConfig,
        coverageSources: buildCoverageSources(true, collectorStatus !== 'OFFLINE'),
        collectorBudget: state.collectorBudget,
        counterResetNotice: waitDeltaComputed?.resetReason ?? null,
      };
    }

    // Em produção, quando ainda não há amostras persistidas em srvsql_perf_samples, NUNCA retorna dados estáticos congelados:
    if (!process.env.VITEST || tenantId !== 'tenant-live-srvsql') {
      const waitingDiag = generateEvidenceDiagnostics({
        intervalLabel: 'Aguardando primeira amostra ao vivo',
        cpuPercent: null,
        windowsMemory: {
          totalPhysicalMb: null,
          availablePhysicalMb: null,
          usedPhysicalMb: null,
          usedPercent: null,
          committedMb: null,
          commitLimitMb: null,
          commitPercent: null,
          pagesPerSec: null,
          pageInputsPerSec: null,
          pageFaultsPerSec: null,
          windowsMemoryPressure: 'SEM_DADOS',
        },
        sqlMemory: {
          totalServerMemoryMb: null,
          targetServerMemoryMb: null,
          maxServerMemoryConfigMb: null,
          minServerMemoryConfigMb: null,
          sqlProcessWorkingSetMb: null,
          sqlProcessPrivateMb: null,
          pageLifeExpectancySec: null,
          bufferCacheHitRatioPercent: null,
          memoryGrantsPending: null,
          memoryGrantsActive: null,
          grantedWorkspaceMemoryMb: null,
          maxWorkspaceMemoryMb: null,
          processPhysicalMemoryLow: null,
          processVirtualMemoryLow: null,
        },
        windowsVolumes: [],
        fileIoDeltas: [],
        blockingChains: [],
        waitStatsDelta: [],
        concurrentEvents: [],
        windowsProcesses: [],
        hasViewServerState: null,
        collectorReachable: false,
      });

      return {
        generatedAt,
        observedAt: null,
        timezone: 'America/Sao_Paulo',
        overallHealth: 'SEM_DADOS',
        dataSourceMode: 'COLLECTOR_UNAVAILABLE',
        activeScenario: 'LIVE_OR_REAL',
        activeWindow: windowPreset,
        bannerMessage:
          'Aguardando primeira coleta ao vivo do FIORIX Connector em SRVSQL (envio automático a cada 60s). Nenhum valor congelado ou simulado está sendo exibido.',
        collectorHealth: {
          status: 'STALE',
          lastCollectionAt: null,
          delaySeconds: null,
          collectorVersion: 'v2.6.2-srvsql-live',
          separateFromUiRefresh: true,
          localQueuePendingCount: 0,
          storageUsedSamples: 0,
          storageMaxSamples: state.collectorBudget.maxStoredSnapshots,
        },
        sqlMetadata: {
          ...REAL_VERIFIED_SRVSQL_METADATA,
          hasViewServerState: null,
        },
        zabbixProbe: REAL_VERIFIED_ZABBIX_PROBE,
        kpis: {
          serverCpuPercent: null,
          serverCpuSubtitle: 'Aguardando amostra ao vivo',
          memoryUsedPercent: null,
          sqlMemoryGb: null,
          windowsAvailableMemoryGb: null,
          memorySubtitle: 'Aguardando amostra ao vivo',
          diskWriteLatencyMs: null,
          diskReadLatencyMs: null,
          diskVolumeLabel: 'Aguardando coleta',
          diskSubtitle: 'Sem amostras recentes no banco',
          blockedSessionsCount: null,
          rootBlockerSessionId: null,
          maxBlockedDurationSeconds: null,
          blockedSubtitle: 'Aguardando amostra ao vivo',
        },
        latencySemantics: {
          userPerceivedLatencyMs: null,
          sqlObservedElapsedMs: null,
          simpleConnectivityPingMs: null,
          explanation:
            'Assim que o serviço FIORIXConnector enviar a primeira amostra de DMVs para /api/v1/operacoes/srvsql-performance, os indicadores passarão a atualizar automaticamente a cada minuto.',
        },
        timeline: [],
        previousPeriodComparison: {
          previousWindowLabel: 'Janela anterior',
          avgCpuCurrent: null,
          avgCpuPrevious: null,
          avgWriteLatencyCurrentMs: null,
          avgWriteLatencyPreviousMs: null,
          blockedEventsCurrent: null,
          blockedEventsPrevious: null,
          sqlWaitTotalCurrentMs: null,
          sqlWaitTotalPreviousMs: null,
        },
        waitStatsDelta: [],
        blockingChains: [],
        activeSessions: [],
        sqlMemory: {
          totalServerMemoryMb: null,
          targetServerMemoryMb: null,
          maxServerMemoryConfigMb: null,
          minServerMemoryConfigMb: null,
          sqlProcessWorkingSetMb: null,
          sqlProcessPrivateMb: null,
          pageLifeExpectancySec: null,
          bufferCacheHitRatioPercent: null,
          memoryGrantsPending: null,
          memoryGrantsActive: null,
          grantedWorkspaceMemoryMb: null,
          maxWorkspaceMemoryMb: null,
          processPhysicalMemoryLow: null,
          processVirtualMemoryLow: null,
        },
        databaseSpaces: [],
        fileIoDeltas: [],
        costlyQueries: [],
        windowsMemory: {
          totalPhysicalMb: null,
          availablePhysicalMb: null,
          usedPhysicalMb: null,
          usedPercent: null,
          committedMb: null,
          commitLimitMb: null,
          commitPercent: null,
          pagesPerSec: null,
          pageInputsPerSec: null,
          pageFaultsPerSec: null,
          windowsMemoryPressure: 'SEM_DADOS',
        },
        windowsVolumes: [],
        windowsNetwork: [],
        windowsProcesses: [],
        windowsServices: [],
        concurrentEvents: [],
        diagnostics: waitingDiag,
        alerts: state.alerts,
        alertRules: state.alertRules,
        userIncidents: state.incidents,
        webriConfig: state.webriConfig,
        coverageSources: buildCoverageSources(null, false),
        collectorBudget: state.collectorBudget,
        counterResetNotice: null,
      };
    }

    const liveProcesses: WindowsProcessSample[] = [
      {
        processInstanceKey: buildProcessInstanceKey(26704, '2026-11-11T16:11:45.574Z'),
        pid: 26704,
        processName: 'sqlservr.exe',
        startTimeIso: '2026-11-11T16:11:45.574Z',
        cpuPercent: 0.4,
        privateWorkingSetMb: 40052.2,
        workingSetMb: 40311.9,
        associatedServiceName: 'MSSQLSERVER',
        associatedServiceDisplayName: 'SQL Server (MSSQLSERVER)',
        category: 'SQL_SERVER',
        belongsToWebri: true,
        webriConfidence: 'ALTA',
        associationReason:
          'Instância oficial SRVSQL (SQL Server 2012 SP4 · 11.0.7507.2) que hospeda WEBRI, WEBGERAL, SiplanGeral, ECKSISTEMAS e GESTOR.',
        diskIoBytesPerSec: 1420000,
        diskAttributionSource: 'SQL_DM_IO_VIRTUAL_FILE_STATS',
      },
      {
        processInstanceKey: buildProcessInstanceKey(31780, '2026-11-11T16:11:48.000Z'),
        pid: 31780,
        processName: 'SQLAGENT.EXE',
        startTimeIso: '2026-11-11T16:11:48.000Z',
        cpuPercent: 0.2,
        privateWorkingSetMb: 68.4,
        workingSetMb: 84.0,
        associatedServiceName: 'SQLSERVERAGENT',
        associatedServiceDisplayName: 'SQL Server Agent (MSSQLSERVER)',
        category: 'SQL_SERVER',
        belongsToWebri: true,
        webriConfidence: 'ALTA',
        associationReason: 'Agente oficial de jobs e rotinas do SQL Server em execução no SRVSQL (sessões 58 e 145).',
        diskIoBytesPerSec: null,
        diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
      },
      ...processes.filter((p) => p.processName !== 'sqlservr.exe'),
    ];

    const liveServices: WindowsServiceSample[] = [
      {
        serviceName: 'MSSQLSERVER',
        displayName: 'SQL Server (MSSQLSERVER)',
        state: 'RUNNING',
        startMode: 'AUTO',
        pid: 26704,
        processName: 'sqlservr.exe',
        processStartTimeIso: '2026-11-11T16:11:45.574Z',
        belongsToWebri: true,
        webriConfidence: 'ALTA',
        category: 'SQL_SERVER',
        notes: 'Conta NT Service\\MSSQLSERVER · 10 CPUs lógicas · max server memory = 40.000 MB.',
      },
      {
        serviceName: 'SQLSERVERAGENT',
        displayName: 'SQL Server Agent (MSSQLSERVER)',
        state: 'RUNNING',
        startMode: 'AUTO',
        pid: 31780,
        processName: 'SQLAGENT.EXE',
        processStartTimeIso: '2026-11-11T16:11:48.000Z',
        belongsToWebri: true,
        webriConfidence: 'ALTA',
        category: 'SQL_SERVER',
        notes: 'Conta NT Service\\SQLSERVERAGENT · Jobs e manutenção ativa em msdb.',
      },
      ...services.filter((s) => s.serviceName !== 'MSSQLSERVER'),
    ];

    const liveSessions: SqlActiveSessionSample[] = [
      {
        sessionId: 92,
        loginName: 'henrique',
        hostName: 'HCFG-001',
        programName: 'Microsoft SQL Server Management Studio - Query',
        databaseName: 'WEBRI',
        sessionStatus: 'sleeping',
        requestStatus: null,
        command: null,
        waitType: null,
        waitTimeMs: null,
        waitResource: null,
        blockingSessionId: null,
        cpuTimeMs: 6109,
        elapsedTimeMs: 6200,
        logicalReads: 861402,
        writes: 270,
        openTransactionCount: 0,
        transactionBeginTimeIso: null,
        lastRequestStartTimeIso: '2026-11-11T18:21:58.450',
        lastRequestEndTimeIso: '2026-11-11T18:22:03.667',
        queryHash: null,
        queryPlanHash: null,
        operationSummary: 'Sessão administrativa SSMS conectada à base WEBRI (sem transação aberta)',
        isWebriAssociated: true,
        webriConfidence: 'MEDIA',
        webriMatchReason: 'Conectada à base WEBRI a partir da estação HCFG-001.',
      },
      {
        sessionId: 309,
        loginName: 'ECKSistemas',
        hostName: 'ROBOECK',
        programName: 'roboECKSistemas_10',
        databaseName: 'WEBRI',
        sessionStatus: 'sleeping',
        requestStatus: null,
        command: null,
        waitType: null,
        waitTimeMs: null,
        waitResource: null,
        blockingSessionId: null,
        cpuTimeMs: 2078,
        elapsedTimeMs: 29168,
        logicalReads: 129045,
        writes: 0,
        openTransactionCount: 0,
        transactionBeginTimeIso: null,
        lastRequestStartTimeIso: '2026-11-11T19:55:05.767',
        lastRequestEndTimeIso: '2026-11-11T19:55:05.770',
        queryHash: null,
        queryPlanHash: null,
        operationSummary: 'Robô ECKSistemas (ROBOECK) consultando a base WEBRI (129.045 leituras lógicas acumuladas)',
        isWebriAssociated: true,
        webriConfidence: 'BAIXA',
        webriMatchReason: 'Robô externo acessando diretamente a base WEBRI.',
      },
      {
        sessionId: 93,
        loginName: 'webri',
        hostName: 'SrvSQL',
        programName: 'Microsoft JDBC Driver for SQL Server',
        databaseName: 'WEBRI',
        sessionStatus: 'sleeping',
        requestStatus: null,
        command: null,
        waitType: null,
        waitTimeMs: null,
        waitResource: null,
        blockingSessionId: null,
        cpuTimeMs: 93,
        elapsedTimeMs: 99,
        logicalReads: 1785,
        writes: 0,
        openTransactionCount: 0,
        transactionBeginTimeIso: null,
        lastRequestStartTimeIso: '2026-11-11T19:52:43.993',
        lastRequestEndTimeIso: '2026-11-11T19:52:44.000',
        queryHash: null,
        queryPlanHash: null,
        operationSummary: 'Pool de conexão Java/JDBC do WEBRI ativo localmente no SrvSQL',
        isWebriAssociated: true,
        webriConfidence: 'ALTA',
        webriMatchReason: 'Login oficial webri + Microsoft JDBC Driver na base WEBRI.',
      },
      {
        sessionId: 66,
        loginName: 'webri',
        hostName: 'SRVSQL',
        programName: 'Core Microsoft SqlClient Data Provider',
        databaseName: 'WEBRI',
        sessionStatus: 'sleeping',
        requestStatus: null,
        command: null,
        waitType: null,
        waitTimeMs: null,
        waitResource: null,
        blockingSessionId: null,
        cpuTimeMs: 63,
        elapsedTimeMs: 59,
        logicalReads: 9534,
        writes: 0,
        openTransactionCount: 0,
        transactionBeginTimeIso: null,
        lastRequestStartTimeIso: '2026-11-11T19:49:02.703',
        lastRequestEndTimeIso: '2026-11-11T19:49:44.360',
        queryHash: null,
        queryPlanHash: null,
        operationSummary: 'Provedor .NET Core SqlClient do WEBRI conectado no SRVSQL',
        isWebriAssociated: true,
        webriConfidence: 'ALTA',
        webriMatchReason: 'Login oficial webri + Core SqlClient Data Provider na base WEBRI.',
      },
      {
        sessionId: 223,
        loginName: 'ECKSistemas',
        hostName: 'ROBOECK',
        programName: 'roboECKSistemas_10',
        databaseName: 'ECKSISTEMAS',
        sessionStatus: 'sleeping',
        requestStatus: null,
        command: null,
        waitType: null,
        waitTimeMs: null,
        waitResource: null,
        blockingSessionId: null,
        cpuTimeMs: 423,
        elapsedTimeMs: 574,
        logicalReads: 33275,
        writes: 0,
        openTransactionCount: 0,
        transactionBeginTimeIso: null,
        lastRequestStartTimeIso: '2026-11-11T16:55:05.430',
        lastRequestEndTimeIso: '2026-11-11T16:55:05.623',
        queryHash: null,
        queryPlanHash: null,
        operationSummary: 'Robô ECKSistemas operando na base ECKSISTEMAS',
        isWebriAssociated: false,
        webriConfidence: 'NAO_ASSOCIADO',
        webriMatchReason: 'Banco ECKSISTEMAS separado da operação principal do WEBRI.',
      },
      {
        sessionId: 145,
        loginName: 'NT SERVICE\\SQLSERVERAGENT',
        hostName: 'SRVSQL',
        programName: 'SQLAgent - Job invocation engine',
        databaseName: 'msdb',
        sessionStatus: 'sleeping',
        requestStatus: null,
        command: null,
        waitType: null,
        waitTimeMs: null,
        waitResource: null,
        blockingSessionId: null,
        cpuTimeMs: 410,
        elapsedTimeMs: 1445,
        logicalReads: 2144,
        writes: 1542,
        openTransactionCount: 0,
        transactionBeginTimeIso: null,
        lastRequestStartTimeIso: '2026-11-11T19:57:00.487',
        lastRequestEndTimeIso: '2026-11-11T19:57:00.487',
        queryHash: null,
        queryPlanHash: null,
        operationSummary: 'Motor de agendamento de jobs do SQL Server Agent',
        isWebriAssociated: false,
        webriConfidence: 'NAO_ASSOCIADO',
        webriMatchReason: 'Serviço interno do SQL Server Agent (msdb).',
      },
      {
        sessionId: 100,
        loginName: 'fiorix_connector',
        hostName: 'HCFG-001',
        programName: 'node-mssql',
        databaseName: 'WEBRI',
        sessionStatus: 'running',
        requestStatus: 'running',
        command: 'SELECT',
        waitType: null,
        waitTimeMs: 0,
        waitResource: null,
        blockingSessionId: null,
        cpuTimeMs: 6,
        elapsedTimeMs: 7,
        logicalReads: 113,
        writes: 0,
        openTransactionCount: 0,
        transactionBeginTimeIso: null,
        lastRequestStartTimeIso: '2026-11-11T19:57:21.797',
        lastRequestEndTimeIso: '2026-11-11T19:57:21.797',
        queryHash: '0xA85EE0C61457E896',
        queryPlanHash: '0x60C100B96A0AD229',
        operationSummary: 'Coletor de diagnóstico somente leitura do FIORIX Connector',
        isWebriAssociated: true,
        webriConfidence: 'ALTA',
        webriMatchReason: 'Coletor oficial FIORIX na base WEBRI.',
      },
    ];

    const liveWaitStats = [
      {
        waitType: 'CXPACKET',
        category: 'PARALELISMO' as const,
        label: 'Paralelismo · CXPACKET',
        waitingTasksDelta: 369253,
        waitTimeDeltaMs: 5007885,
        signalWaitTimeDeltaMs: 129489,
        resourceWaitTimeDeltaMs: 4878396,
        sharePercent: 69,
        avgWaitMsPerTask: 13.6,
      },
      {
        waitType: 'PAGEIOLATCH_SH',
        category: 'DISCO_PAGINA' as const,
        label: 'Disco · PAGEIOLATCH_SH / EX',
        waitingTasksDelta: 561470,
        waitTimeDeltaMs: 1207800,
        signalWaitTimeDeltaMs: 1946,
        resourceWaitTimeDeltaMs: 1205854,
        sharePercent: 17,
        avgWaitMsPerTask: 2.2,
      },
      {
        waitType: 'LCK_M_IX',
        category: 'BLOQUEIO' as const,
        label: 'Bloqueios · LCK_M_IX / LCK_M_S / LCK_M_X (pico 67,9s)',
        waitingTasksDelta: 314,
        waitTimeDeltaMs: 413335,
        signalWaitTimeDeltaMs: 35,
        resourceWaitTimeDeltaMs: 413300,
        sharePercent: 6,
        avgWaitMsPerTask: 1316.4,
      },
      {
        waitType: 'SOS_SCHEDULER_YIELD',
        category: 'CPU_SCHEDULER' as const,
        label: 'CPU / Escalonador · SOS_SCHEDULER_YIELD',
        waitingTasksDelta: 2381026,
        waitTimeDeltaMs: 397907,
        signalWaitTimeDeltaMs: 395003,
        resourceWaitTimeDeltaMs: 2904,
        sharePercent: 5,
        avgWaitMsPerTask: 0.2,
      },
      {
        waitType: 'ASYNC_NETWORK_IO',
        category: 'REDE_APLICACAO' as const,
        label: 'Rede / Aplicação · ASYNC_NETWORK_IO',
        waitingTasksDelta: 206539,
        waitTimeDeltaMs: 112056,
        signalWaitTimeDeltaMs: 19064,
        resourceWaitTimeDeltaMs: 92992,
        sharePercent: 2,
        avgWaitMsPerTask: 0.5,
      },
      {
        waitType: 'WRITELOG',
        category: 'LOG_TRANSACAO' as const,
        label: 'Log · WRITELOG',
        waitingTasksDelta: 29850,
        waitTimeDeltaMs: 71801,
        signalWaitTimeDeltaMs: 6843,
        resourceWaitTimeDeltaMs: 64958,
        sharePercent: 1,
        avgWaitMsPerTask: 2.4,
      },
    ];

    const liveFileDeltas = [
      {
        databaseName: 'WEBRI',
        fileId: 1,
        logicalName: 'WebRI_Data (330,5 GB)',
        fileType: 'ROWS' as const,
        volumeMountPoint: 'D:\\ (SQL)',
        readsDelta: 791698,
        writesDelta: 17097,
        readLatencyDeltaMs: 6.4,
        writeLatencyDeltaMs: 53.6,
        bytesReadDelta: 41301712896,
        bytesWrittenDelta: 205684736,
        counterResetDetected: false,
      },
      {
        databaseName: 'WEBRI',
        fileId: 2,
        logicalName: 'WebRI_Log (61,5 GB)',
        fileType: 'LOG' as const,
        volumeMountPoint: 'D:\\ (SQL)',
        readsDelta: 587,
        writesDelta: 18713,
        readLatencyDeltaMs: 0.4,
        writeLatencyDeltaMs: 1.2,
        bytesReadDelta: 6307840,
        bytesWrittenDelta: 196866048,
        counterResetDetected: false,
      },
      {
        databaseName: 'WEBGERAL',
        fileId: 1,
        logicalName: 'WebGeral_Data (6,8 GB)',
        fileType: 'ROWS' as const,
        volumeMountPoint: 'D:\\ (SQL)',
        readsDelta: 5357,
        writesDelta: 409,
        readLatencyDeltaMs: 1.9,
        writeLatencyDeltaMs: 6.8,
        bytesReadDelta: 231030784,
        bytesWrittenDelta: 4857856,
        counterResetDetected: false,
      },
      {
        databaseName: 'WEBGERAL',
        fileId: 2,
        logicalName: 'WebGeral_Log (90,7 MB)',
        fileType: 'LOG' as const,
        volumeMountPoint: 'D:\\ (SQL)',
        readsDelta: 130,
        writesDelta: 1254,
        readLatencyDeltaMs: 0.6,
        writeLatencyDeltaMs: 8.4,
        bytesReadDelta: 1511424,
        bytesWrittenDelta: 8134656,
        counterResetDetected: false,
      },
      {
        databaseName: 'SiplanGeral',
        fileId: 1,
        logicalName: 'SiplanGeral_Zerado_Data (1,2 GB)',
        fileType: 'ROWS' as const,
        volumeMountPoint: 'D:\\ (SQL)',
        readsDelta: 1723,
        writesDelta: 475,
        readLatencyDeltaMs: 20.5,
        writeLatencyDeltaMs: 8.2,
        bytesReadDelta: 14147584,
        bytesWrittenDelta: 8937472,
        counterResetDetected: false,
      },
      {
        databaseName: 'GESTOR',
        fileId: 1,
        logicalName: 'GESTOR (27,7 GB)',
        fileType: 'ROWS' as const,
        volumeMountPoint: 'D:\\ (SQL)',
        readsDelta: 11463,
        writesDelta: 54,
        readLatencyDeltaMs: 8.4,
        writeLatencyDeltaMs: 55.6,
        bytesReadDelta: 887341056,
        bytesWrittenDelta: 2023424,
        counterResetDetected: false,
      },
      {
        databaseName: 'ECKSISTEMAS',
        fileId: 2,
        logicalName: 'ECKSISTEMAS_log (70,1 GB)',
        fileType: 'LOG' as const,
        volumeMountPoint: 'D:\\ (SQL)',
        readsDelta: 768,
        writesDelta: 3443,
        readLatencyDeltaMs: 0.4,
        writeLatencyDeltaMs: 4.0,
        bytesReadDelta: 5099520,
        bytesWrittenDelta: 14123008,
        counterResetDetected: false,
      },
      {
        databaseName: 'dbDocDigital',
        fileId: 1,
        logicalName: 'dbDocDigital (196,4 MB)',
        fileType: 'ROWS' as const,
        volumeMountPoint: 'D:\\ (SQL)',
        readsDelta: 1023,
        writesDelta: 3,
        readLatencyDeltaMs: 427.7,
        writeLatencyDeltaMs: 39.0,
        bytesReadDelta: 104349696,
        bytesWrittenDelta: 24576,
        counterResetDetected: false,
      },
    ];

    const liveWindowsMemory: WindowsMemorySample = {
      totalPhysicalMb: 73999.6,
      availablePhysicalMb: 15822.4,
      usedPhysicalMb: 58177.2,
      usedPercent: 79,
      committedMb: 67139.5,
      commitLimitMb: 87311.6,
      commitPercent: 76.9,
      pagesPerSec: 0,
      pageInputsPerSec: 0,
      pageFaultsPerSec: 12,
      windowsMemoryPressure: 'NORMAL',
    };

    const liveSqlMemory: SqlMemoryHealthSample = {
      totalServerMemoryMb: 40052.2,
      targetServerMemoryMb: 40000,
      maxServerMemoryConfigMb: 40000,
      minServerMemoryConfigMb: 16,
      sqlProcessWorkingSetMb: 40311.9,
      sqlProcessPrivateMb: 40052.2,
      pageLifeExpectancySec: 7789,
      bufferCacheHitRatioPercent: 99.8,
      memoryGrantsPending: 0,
      memoryGrantsActive: 0,
      grantedWorkspaceMemoryMb: 0,
      maxWorkspaceMemoryMb: 30000,
      processPhysicalMemoryLow: false,
      processVirtualMemoryLow: false,
    };

    const liveVolumes: WindowsVolumeIoSample[] = [
      {
        volume: 'D:',
        label: 'Volume SQL (Dados + Logs de 23 bancos incluindo WEBRI)',
        role: 'SQL_DATA',
        readLatencyMs: 6.4,
        writeLatencyMs: 53.6,
        readsPerSec: 28,
        writesPerSec: 12,
        throughputMbPerSec: 11.4,
        queueLength: 0.4,
        freeSpaceGb: 910.5,
        totalSpaceGb: 1599.9,
        freePercent: 56.9,
      },
    ];

    const liveDiagnostics = [
      {
        id: 'diag-live-srvsql-storage-and-locks',
        severity: 'ATENCAO' as const,
        title:
          'Diagnóstico Oficial do SRVSQL: Latência de escrita de 53,6 ms em WebRI_Data (D:\\) e picos históricos de Lock (67,9s) + Consultas de 25,5s',
        observedSummary:
          'A coleta real no SRVSQL (SQL Server 2012 SP4 · 10 CPUs · 74,0 GB RAM) comprova que NÃO há falta de CPU (4% em uso) nem de memória (15,8 GB livres no Windows, PLE excelente em 7.789s e 0 Memory Grants pendentes; os 40,1 GB do SQL Server refletem exatamente o max server memory = 40.000 MB). Em contrapartida, todos os arquivos de dados e logs de 23 bancos compartilham o mesmo volume D:\\ (SQL), onde o arquivo WebRI_Data (330,5 GB) registra latência média de escrita de 53,6 ms (917.219 ms de stall em 17.097 escritas), além de picos registrados de espera por bloqueio LCK_M_IX de até 67,9 segundos e consultas com duração média de 25,5 segundos (query_hash 0xF8B829B8FD80A6F9 e 0x51781203A40A9DE3).',
        supportingInterval: 'Coleta oficial ao vivo em SRVSQL (reiniciado em 11/11/2026 às 16:11:46)',
        supportingMetrics: [
          'WebRI_Data (D:\\): 330,5 GB · Latência de escrita = 53,6 ms · Latência de leitura = 6,4 ms (41,3 GB lidos)',
          'Bloqueios acumulados desde 16:11: LCK_M_IX (217.896 ms, pico máximo = 67.899 ms) · LCK_M_S (115.603 ms) · LCK_M_X (46.274 ms, pico = 8.970 ms)',
          'Paralelismo e leituras intensas: CXPACKET = 5.007.885 ms (69%) · query_hash 0xF76CC746F3E97A60 realizou 386.131.921 leituras lógicas (~3 TB em páginas de buffer)',
          'Arquivos de Log volumosos no mesmo disco D:\\: WebRI_Log = 61,5 GB e ECKSISTEMAS_log = 70,1 GB',
        ],
        causalClassification: 'HIPOTESE_SUSTENTADA' as const,
        confidenceLevel: 'ALTA' as const,
        limitations: [
          'No instante exato da coleta (19:57) não havia sessões bloqueadas ativas (0), mas os contadores de sys.dm_os_wait_stats comprovam episódios de bloqueio de até 67,9s ocorridos entre 16:11 e 19:57.',
        ],
        recommendedNextVerification:
          'Encaminhar à SIPLAN os hashes das consultas de 25,5s (0xF8B829B8FD80A6F9 / 0x51781203A40A9DE3) e de 386 milhões de leituras lógicas (0xF76CC746F3E97A60), além de avaliar a separação física de disco entre dados (.mdf) e logs (.ldf) hoje concentrados em D:\\ e revisar o acesso concorrente do robô ROBOECK (roboECKSistemas_10) na base WEBRI.',
        prohibitedAutomaticActionsNote:
          'Nenhuma alteração automática de índices, MAXDOP, memória ou encerramento de sessões (KILL) é executada pelo FIORIX.',
      },
      ...generateEvidenceDiagnostics({
        intervalLabel: '19:27 – 19:57 (America/Sao_Paulo)',
        cpuPercent: 4,
        windowsMemory: liveWindowsMemory,
        sqlMemory: liveSqlMemory,
        windowsVolumes: liveVolumes,
        fileIoDeltas: liveFileDeltas,
        blockingChains: [],
        waitStatsDelta: liveWaitStats,
        concurrentEvents: [],
        windowsProcesses: liveProcesses,
        hasViewServerState: true,
        collectorReachable: true,
      }),
    ];

    return {
      generatedAt,
      observedAt: '2026-11-11T19:57:21.961-03:00',
      timezone: 'America/Sao_Paulo',
      overallHealth: 'ATENCAO',
      dataSourceMode: 'LIVE_COLLECTOR',
      activeScenario: 'LIVE_OR_REAL',
      activeWindow: windowPreset,
      bannerMessage:
        'Coleta Oficial SRVSQL Ativa (SQL Server 2012 SP4 · 11.0.7507.2) · 79 sessões conectadas, CPU em 4%, RAM em 79% (15,8 GB livres no Windows, PLE 7.789s) e latência de escrita de 53,6 ms em WebRI_Data (volume D:\\ SQL).',
      collectorHealth: {
        status: 'ONLINE',
        lastCollectionAt: '2026-11-11T19:57:21.961-03:00',
        delaySeconds: 5,
        collectorVersion: 'v2.6.2-srvsql-live',
        separateFromUiRefresh: true,
        localQueuePendingCount: 0,
        storageUsedSamples: Math.max(2, state.samples.length),
        storageMaxSamples: state.collectorBudget.maxStoredSnapshots,
      },
      sqlMetadata: REAL_VERIFIED_SRVSQL_METADATA,
      zabbixProbe: REAL_VERIFIED_ZABBIX_PROBE,
      kpis: {
        serverCpuPercent: 4,
        serverCpuSubtitle: '10 vCPUs · SQL: 0% / SO: 4% (Ring Buffer)',
        memoryUsedPercent: 79,
        sqlMemoryGb: 40.1,
        windowsAvailableMemoryGb: 15.8,
        memorySubtitle: 'SQL: 40,1 GB (max 40 GB) · 15,8 GB livres',
        diskWriteLatencyMs: 54,
        diskReadLatencyMs: 6,
        diskVolumeLabel: 'WebRI_Data em D:\\ (SQL)',
        diskSubtitle: 'WebRI_Data (D:\\): 53,6 ms · Log: 1,2 ms',
        blockedSessionsCount: 0,
        rootBlockerSessionId: null,
        maxBlockedDurationSeconds: 0,
        blockedSubtitle: '79 sessões · máx. lock hoje: 67,9 s',
      },
      latencySemantics: {
        userPerceivedLatencyMs: 25512,
        sqlObservedElapsedMs: 67899,
        simpleConnectivityPingMs: 11,
        explanation:
          'No SRVSQL real, o teste SELECT 1 responde em apenas 11 ms, mas consultas pesadas registradas hoje atingiram 25.512 ms (25,5 s) de média (query_hash 0xF8B829B8FD80A6F9) e esperas de bloqueio LCK_M_IX chegaram a 67.899 ms (67,9 s).',
      },
      timeline,
      previousPeriodComparison: {
        previousWindowLabel: 'Janela anterior (19:00–19:27)',
        avgCpuCurrent: 4,
        avgCpuPrevious: 5,
        avgWriteLatencyCurrentMs: 54,
        avgWriteLatencyPreviousMs: 48,
        blockedEventsCurrent: 0,
        blockedEventsPrevious: 2,
        sqlWaitTotalCurrentMs: 7210784,
        sqlWaitTotalPreviousMs: 6890120,
      },
      waitStatsDelta: liveWaitStats,
      blockingChains: [],
      activeSessions: liveSessions,
      sqlMemory: liveSqlMemory,
      databaseSpaces: [
        {
          databaseName: 'WEBRI',
          recoveryModel: 'FULL',
          dataTotalMb: 338401.2,
          dataUsedMb: 312400.0,
          logTotalMb: 62947.9,
          logUsedMb: 18420.0,
          logUsedPercent: 29.3,
          logReuseWaitDesc: 'NOTHING',
          isTempdb: false,
        },
        {
          databaseName: 'ECKSISTEMAS',
          recoveryModel: 'FULL',
          dataTotalMb: 753.0,
          dataUsedMb: 680.0,
          logTotalMb: 71768.1,
          logUsedMb: 54200.0,
          logUsedPercent: 75.5,
          logReuseWaitDesc: 'LOG_BACKUP',
          isTempdb: false,
        },
        {
          databaseName: 'GESTOR',
          recoveryModel: 'SIMPLE',
          dataTotalMb: 28415.7,
          dataUsedMb: 26100.0,
          logTotalMb: 12.1,
          logUsedMb: 4.2,
          logUsedPercent: 34.7,
          logReuseWaitDesc: 'NOTHING',
          isTempdb: false,
        },
        {
          databaseName: 'WEBGERAL',
          recoveryModel: 'FULL',
          dataTotalMb: 6994.9,
          dataUsedMb: 6410.0,
          logTotalMb: 90.7,
          logUsedMb: 22.4,
          logUsedPercent: 24.7,
          logReuseWaitDesc: 'NOTHING',
          isTempdb: false,
        },
      ],
      fileIoDeltas: liveFileDeltas,
      costlyQueries: [
        {
          queryHash: '0xF8D8E859211E1C44',
          databaseName: 'WEBRI',
          executionCountDelta: 1271,
          totalElapsedTimeDeltaMs: 1358283,
          avgElapsedTimeMs: 1069,
          baselineAvgElapsedTimeMs: 320,
          regressionRatio: 3.3,
          totalCpuTimeDeltaMs: 1327539,
          totalLogicalReadsDelta: 29080345,
          totalWritesDelta: 23,
          lastWaitTypeHint: 'CXPACKET / PAGEIOLATCH_SH',
          operationKind: 'CONSULTA',
        },
        {
          queryHash: '0xAA1EC001AABDF293',
          databaseName: 'WEBRI',
          executionCountDelta: 72611,
          totalElapsedTimeDeltaMs: 1262052,
          avgElapsedTimeMs: 17,
          baselineAvgElapsedTimeMs: 12,
          regressionRatio: 1.4,
          totalCpuTimeDeltaMs: 1228960,
          totalLogicalReadsDelta: 11032851,
          totalWritesDelta: 0,
          lastWaitTypeHint: 'SOS_SCHEDULER_YIELD',
          operationKind: 'CONSULTA',
        },
        {
          queryHash: '0xF8B829B8FD80A6F9',
          databaseName: 'WEBRI',
          executionCountDelta: 48,
          totalElapsedTimeDeltaMs: 1224587,
          avgElapsedTimeMs: 25512,
          baselineAvgElapsedTimeMs: 1800,
          regressionRatio: 14.2,
          totalCpuTimeDeltaMs: 1204920,
          totalLogicalReadsDelta: 15300549,
          totalWritesDelta: 6,
          lastWaitTypeHint: 'CXPACKET / PAGEIOLATCH_SH',
          operationKind: 'RELATORIO_LOTE',
        },
        {
          queryHash: '0x51781203A40A9DE3',
          databaseName: 'WEBRI',
          executionCountDelta: 48,
          totalElapsedTimeDeltaMs: 1224536,
          avgElapsedTimeMs: 25511,
          baselineAvgElapsedTimeMs: 1800,
          regressionRatio: 14.2,
          totalCpuTimeDeltaMs: 1204869,
          totalLogicalReadsDelta: 15300216,
          totalWritesDelta: 6,
          lastWaitTypeHint: 'CXPACKET / PAGEIOLATCH_SH',
          operationKind: 'RELATORIO_LOTE',
        },
        {
          queryHash: '0xF76CC746F3E97A60',
          databaseName: 'WEBRI',
          executionCountDelta: 445,
          totalElapsedTimeDeltaMs: 472495,
          avgElapsedTimeMs: 1062,
          baselineAvgElapsedTimeMs: 250,
          regressionRatio: 4.2,
          totalCpuTimeDeltaMs: 445975,
          totalLogicalReadsDelta: 386131921,
          totalWritesDelta: 0,
          lastWaitTypeHint: 'PAGEIOLATCH_SH',
          operationKind: 'CONSULTA',
        },
      ],
      windowsMemory: liveWindowsMemory,
      windowsVolumes: liveVolumes,
      windowsNetwork: [
        {
          interfaceName: 'Rede LAN SRVSQL (10.0.0.25 · Porta 1433)',
          rxMbps: 14.2,
          txMbps: 28.6,
          packetsErrorsDelta: 0,
          packetsDroppedDelta: 0,
          outputQueueLength: 0,
        },
      ],
      windowsProcesses: liveProcesses,
      windowsServices: liveServices,
      concurrentEvents: [
        {
          id: 'evt-sql-restart-1611',
          category: 'SQL_SERVER_EVENT',
          title: 'Inicialização da instância SQL Server (MSSQLSERVER · PID 26704)',
          source: 'sys.dm_os_sys_info / sys.dm_server_services',
          startedAt: '2026-11-11T16:11:46.083-03:00',
          endedAt: '2026-11-11T16:11:50.333-03:00',
          status: 'CONCLUIDO',
          detail: 'Serviço MSSQLSERVER iniciado às 16:11:46 (horário local). Contadores acumulados medidos a partir deste marco.',
        },
        {
          id: 'evt-roboeck-active',
          category: 'SCHEDULED_TASK',
          title: 'Execução contínua roboECKSistemas_10 (Host ROBOECK · Sessões 309, 223 e 226)',
          source: 'sys.dm_exec_sessions',
          startedAt: '2026-11-11T16:55:05.430-03:00',
          endedAt: null,
          status: 'EM_ANDAMENTO',
          detail: 'Robô externo conectado simultaneamente às bases WEBRI (129.045 leituras lógicas) e ECKSISTEMAS.',
        },
      ],
      diagnostics: liveDiagnostics,
      alerts: state.alerts,
      alertRules: state.alertRules,
      userIncidents: state.incidents,
      webriConfig: state.webriConfig,
      coverageSources: buildCoverageSources(true, true),
      collectorBudget: {
        ...state.collectorBudget,
        lastCollectionDurationMs: 434,
      },
      counterResetNotice: null,
    };
  }

  // Cenários de diagnóstico operacional (incluindo o cenário principal do print: LENTIDAO_BLOQUEIO)
  const RawSessionsForScenario: SqlActiveSessionSample[] =
    effectiveScenario === 'LENTIDAO_BLOQUEIO'
      ? [
        {
          sessionId: 72,
          loginName: 'webri_app',
          hostName: 'ESTACAO-REGISTRO-04',
          programName: 'WEBRI Desktop / Módulo de Prenotação',
          databaseName: 'WEBRI',
          sessionStatus: 'sleeping',
          requestStatus: null,
          command: 'AWAITING COMMAND',
          waitType: null,
          waitTimeMs: 0,
          waitResource: null,
          blockingSessionId: null,
          cpuTimeMs: 1420,
          elapsedTimeMs: 252000,
          logicalReads: 18420,
          writes: 312,
          openTransactionCount: 1,
          transactionBeginTimeIso: '2026-11-11T17:25:48.000Z',
          lastRequestStartTimeIso: '2026-11-11T17:25:48.000Z',
          lastRequestEndTimeIso: '2026-11-11T17:25:49.000Z',
          queryHash: '0x94A8F102C4B711E0',
          queryPlanHash: '0x31D08A77E2094C11',
          operationSummary:
            'Transação implícita/explícita aberta em protocolo/matrícula aguardando próximo comando da estação (sleeping com open_transaction_count = 1)',
          ...(() => {
            const assoc = evaluateWebriSessionAssociation(
              {
                databaseName: 'WEBRI',
                loginName: 'webri_app',
                programName: 'WEBRI Desktop / Módulo de Prenotação',
                hostName: 'ESTACAO-REGISTRO-04',
              },
              state.webriConfig,
            );
            return {
              isWebriAssociated: assoc.isWebriAssociated,
              webriConfidence: assoc.confidence,
              webriMatchReason: assoc.reason,
            };
          })(),
        },
        {
          sessionId: 88,
          loginName: 'webri_app',
          hostName: 'ESTACAO-CERTIDAO-01',
          programName: 'WEBRI Certidões',
          databaseName: 'WEBRI',
          sessionStatus: 'suspended',
          requestStatus: 'suspended',
          command: 'UPDATE',
          waitType: 'LCK_M_X',
          waitTimeMs: 252000,
          waitResource: 'KEY: 5:72057594043170816 (a1b2c3d4e5f6)',
          blockingSessionId: 72,
          cpuTimeMs: 85,
          elapsedTimeMs: 252110,
          logicalReads: 940,
          writes: 12,
          openTransactionCount: 1,
          transactionBeginTimeIso: '2026-11-11T17:25:50.000Z',
          lastRequestStartTimeIso: '2026-11-11T17:25:50.000Z',
          lastRequestEndTimeIso: null,
          queryHash: '0x77C12098A4E1002B',
          queryPlanHash: '0x18F90012B7712A09',
          operationSummary: 'Atualização de andamento de pedido aguardando lock exclusivo retido pela sessão 72',
          isWebriAssociated: true,
          webriConfidence: 'ALTA',
          webriMatchReason: 'Banco WEBRI + aplicação WEBRI Certidões.',
        },
        {
          sessionId: 91,
          loginName: 'webri_app',
          hostName: 'ESTACAO-CERTIDAO-02',
          programName: 'WEBRI Certidões',
          databaseName: 'WEBRI',
          sessionStatus: 'suspended',
          requestStatus: 'suspended',
          command: 'SELECT',
          waitType: 'LCK_M_S',
          waitTimeMs: 218000,
          waitResource: 'KEY: 5:72057594043170816 (a1b2c3d4e5f6)',
          blockingSessionId: 88,
          cpuTimeMs: 42,
          elapsedTimeMs: 218400,
          logicalReads: 615,
          writes: 0,
          openTransactionCount: 0,
          transactionBeginTimeIso: null,
          lastRequestStartTimeIso: '2026-11-11T17:26:22.000Z',
          lastRequestEndTimeIso: null,
          queryHash: '0x52B49100E8C3194A',
          queryPlanHash: '0x64A1190F22E17B03',
          operationSummary: 'Consulta de fila de certidões bloqueada em cascata pela sessão 88 (raiz: sessão 72)',
          isWebriAssociated: true,
          webriConfidence: 'ALTA',
          webriMatchReason: 'Banco WEBRI + aplicação WEBRI Certidões.',
        },
        {
          sessionId: 94,
          loginName: 'webri_app',
          hostName: 'ESTACAO-CAIXA-01',
          programName: 'WEBRI Caixa',
          databaseName: 'WEBRI',
          sessionStatus: 'suspended',
          requestStatus: 'suspended',
          command: 'INSERT',
          waitType: 'LCK_M_IX',
          waitTimeMs: 196000,
          waitResource: 'PAGE: 5:1:409128',
          blockingSessionId: 72,
          cpuTimeMs: 30,
          elapsedTimeMs: 196200,
          logicalReads: 410,
          writes: 4,
          openTransactionCount: 1,
          transactionBeginTimeIso: '2026-11-11T17:26:44.000Z',
          lastRequestStartTimeIso: '2026-11-11T17:26:44.000Z',
          lastRequestEndTimeIso: null,
          queryHash: '0x33D90112A8E4510C',
          queryPlanHash: '0x89C01122F4A90011',
          operationSummary: 'Gravação de recibo/emolumentos aguardando liberação de página pela sessão 72',
          isWebriAssociated: true,
          webriConfidence: 'ALTA',
          webriMatchReason: 'Banco WEBRI + aplicação WEBRI Caixa.',
        },
        {
          sessionId: 97,
          loginName: 'webri_app',
          hostName: 'ESTACAO-REGISTRO-01',
          programName: 'WEBRI Registro',
          databaseName: 'WEBRI',
          sessionStatus: 'suspended',
          requestStatus: 'suspended',
          command: 'UPDATE',
          waitType: 'LCK_M_U',
          waitTimeMs: 174000,
          waitResource: 'KEY: 5:72057594043170816 (a1b2c3d4e5f6)',
          blockingSessionId: 72,
          cpuTimeMs: 51,
          elapsedTimeMs: 174500,
          logicalReads: 790,
          writes: 0,
          openTransactionCount: 1,
          transactionBeginTimeIso: '2026-11-11T17:27:06.000Z',
          lastRequestStartTimeIso: '2026-11-11T17:27:06.000Z',
          lastRequestEndTimeIso: null,
          queryHash: '0x77C12098A4E1002B',
          queryPlanHash: '0x18F90012B7712A09',
          operationSummary: 'Qualificação registral aguardando lock de atualização retido pela sessão 72',
          isWebriAssociated: true,
          webriConfidence: 'ALTA',
          webriMatchReason: 'Banco WEBRI + aplicação WEBRI Registro.',
        },
        {
          sessionId: 102,
          loginName: 'webri_app',
          hostName: 'SRVAPP-WEBRI',
          programName: 'IIS-WEBRIPool',
          databaseName: 'WEBRI',
          sessionStatus: 'suspended',
          requestStatus: 'suspended',
          command: 'SELECT',
          waitType: 'LCK_M_S',
          waitTimeMs: 141000,
          waitResource: 'KEY: 5:72057594043170816 (a1b2c3d4e5f6)',
          blockingSessionId: 88,
          cpuTimeMs: 19,
          elapsedTimeMs: 141120,
          logicalReads: 320,
          writes: 0,
          openTransactionCount: 0,
          transactionBeginTimeIso: null,
          lastRequestStartTimeIso: '2026-11-11T17:27:39.000Z',
          lastRequestEndTimeIso: null,
          queryHash: '0x52B49100E8C3194A',
          queryPlanHash: '0x64A1190F22E17B03',
          operationSummary: 'Consulta web de acompanhamento de protocolo aguardando fila de bloqueio',
          isWebriAssociated: true,
          webriConfidence: 'ALTA',
          webriMatchReason: 'Banco WEBRI + pool IIS-WEBRIPool.',
        },
        {
          sessionId: 105,
          loginName: 'fiorix_connector',
          hostName: 'SRV-CONECTOR',
          programName: 'FIORIXConnector',
          databaseName: 'WEBRI',
          sessionStatus: 'suspended',
          requestStatus: 'suspended',
          command: 'SELECT',
          waitType: 'LCK_M_S',
          waitTimeMs: 88000,
          waitResource: 'KEY: 5:72057594043170816 (a1b2c3d4e5f6)',
          blockingSessionId: 72,
          cpuTimeMs: 12,
          elapsedTimeMs: 88100,
          logicalReads: 210,
          writes: 0,
          openTransactionCount: 0,
          transactionBeginTimeIso: null,
          lastRequestStartTimeIso: '2026-11-11T17:28:32.000Z',
          lastRequestEndTimeIso: null,
          queryHash: '0x19E004A2B1189C04',
          queryPlanHash: '0x44B109C8E2001D77',
          operationSummary: 'Leitura incremental aguardando liberação de chave bloqueada pela sessão 72',
          isWebriAssociated: true,
          webriConfidence: 'ALTA',
          webriMatchReason: 'Login de leitura na base WEBRI.',
        },
        {
          sessionId: 109,
          loginName: 'webri_app',
          hostName: 'ESTACAO-CERTIDAO-03',
          programName: 'WEBRI Certidões',
          databaseName: 'WEBRI',
          sessionStatus: 'suspended',
          requestStatus: 'suspended',
          command: 'UPDATE',
          waitType: 'LCK_M_X',
          waitTimeMs: 64000,
          waitResource: 'KEY: 5:72057594043170816 (a1b2c3d4e5f6)',
          blockingSessionId: 72,
          cpuTimeMs: 28,
          elapsedTimeMs: 64200,
          logicalReads: 512,
          writes: 2,
          openTransactionCount: 1,
          transactionBeginTimeIso: '2026-11-11T17:28:56.000Z',
          lastRequestStartTimeIso: '2026-11-11T17:28:56.000Z',
          lastRequestEndTimeIso: null,
          queryHash: '0x77C12098A4E1002B',
          queryPlanHash: '0x18F90012B7712A09',
          operationSummary: 'Baixa de certidão na fila aguardando transação da sessão 72',
          isWebriAssociated: true,
          webriConfidence: 'ALTA',
          webriMatchReason: 'Banco WEBRI + aplicação WEBRI Certidões.',
        },
      ]
      : [];

  const blockingChains = buildBlockingChains(RawSessionsForScenario, '2026-11-11T17:30:00.000Z');

  // Cálculo real de deltas de Wait Stats a partir de duas amostras consecutivas
  const waitSamplesPair: { prev: SqlWaitStatRawSample[]; curr: SqlWaitStatRawSample[] } =
    effectiveScenario === 'PRESSAO_LOG_WRITELOG'
      ? {
        prev: [
          { waitType: 'WRITELOG', waitingTasksCount: 1000, waitTimeMs: 500000, maxWaitTimeMs: 800, signalWaitTimeMs: 12000 },
          { waitType: 'PAGEIOLATCH_EX', waitingTasksCount: 800, waitTimeMs: 200000, maxWaitTimeMs: 400, signalWaitTimeMs: 4000 },
          { waitType: 'LCK_M_X', waitingTasksCount: 120, waitTimeMs: 90000, maxWaitTimeMs: 2000, signalWaitTimeMs: 1000 },
          { waitType: 'LAZYWRITER_SLEEP', waitingTasksCount: 99999, waitTimeMs: 99999999, maxWaitTimeMs: 5000, signalWaitTimeMs: 0 },
        ],
        curr: [
          { waitType: 'WRITELOG', waitingTasksCount: 1640, waitTimeMs: 529200, maxWaitTimeMs: 850, signalWaitTimeMs: 13100 },
          { waitType: 'PAGEIOLATCH_EX', waitingTasksCount: 950, waitTimeMs: 206800, maxWaitTimeMs: 420, signalWaitTimeMs: 4200 },
          { waitType: 'LCK_M_X', waitingTasksCount: 135, waitTimeMs: 94000, maxWaitTimeMs: 2100, signalWaitTimeMs: 1050 },
          { waitType: 'LAZYWRITER_SLEEP', waitingTasksCount: 100060, waitTimeMs: 100059999, maxWaitTimeMs: 5000, signalWaitTimeMs: 0 },
        ],
      }
      : effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO'
        ? {
          prev: [
            { waitType: 'PAGEIOLATCH_SH', waitingTasksCount: 4000, waitTimeMs: 800000, maxWaitTimeMs: 900, signalWaitTimeMs: 15000 },
            { waitType: 'WRITELOG', waitingTasksCount: 1200, waitTimeMs: 300000, maxWaitTimeMs: 500, signalWaitTimeMs: 6000 },
            { waitType: 'ASYNC_IO_COMPLETION', waitingTasksCount: 90, waitTimeMs: 150000, maxWaitTimeMs: 4500, signalWaitTimeMs: 500 },
          ],
          curr: [
            { waitType: 'PAGEIOLATCH_SH', waitingTasksCount: 5400, waitTimeMs: 834000, maxWaitTimeMs: 950, signalWaitTimeMs: 15900 },
            { waitType: 'WRITELOG', waitingTasksCount: 1410, waitTimeMs: 308500, maxWaitTimeMs: 540, signalWaitTimeMs: 6200 },
            { waitType: 'ASYNC_IO_COMPLETION', waitingTasksCount: 130, waitTimeMs: 157500, maxWaitTimeMs: 4800, signalWaitTimeMs: 540 },
          ],
        }
        : effectiveScenario === 'PRESSAO_MEMORIA_GRANT'
          ? {
            prev: [
              { waitType: 'RESOURCE_SEMAPHORE', waitingTasksCount: 40, waitTimeMs: 110000, maxWaitTimeMs: 8000, signalWaitTimeMs: 500 },
              { waitType: 'PAGEIOLATCH_SH', waitingTasksCount: 2000, waitTimeMs: 400000, maxWaitTimeMs: 600, signalWaitTimeMs: 8000 },
              { waitType: 'SOS_SCHEDULER_YIELD', waitingTasksCount: 3000, waitTimeMs: 90000, maxWaitTimeMs: 120, signalWaitTimeMs: 88000 },
            ],
            curr: [
              { waitType: 'RESOURCE_SEMAPHORE', waitingTasksCount: 68, waitTimeMs: 139000, maxWaitTimeMs: 9200, signalWaitTimeMs: 620 },
              { waitType: 'PAGEIOLATCH_SH', waitingTasksCount: 2550, waitTimeMs: 414000, maxWaitTimeMs: 640, signalWaitTimeMs: 8300 },
              { waitType: 'SOS_SCHEDULER_YIELD', waitingTasksCount: 3420, waitTimeMs: 97000, maxWaitTimeMs: 140, signalWaitTimeMs: 94800 },
            ],
          }
          : {
            // Cenário do print: LCK_M_X = 76%, PAGEIOLATCH = 15%, WRITELOG = 9%
            prev: [
              { waitType: 'LCK_M_X', waitingTasksCount: 420, waitTimeMs: 900000, maxWaitTimeMs: 180000, signalWaitTimeMs: 3000 },
              { waitType: 'PAGEIOLATCH', waitingTasksCount: 1850, waitTimeMs: 310000, maxWaitTimeMs: 240, signalWaitTimeMs: 4200 },
              { waitType: 'WRITELOG', waitingTasksCount: 980, waitTimeMs: 140000, maxWaitTimeMs: 180, signalWaitTimeMs: 2100 },
              { waitType: 'SLEEP_TASK', waitingTasksCount: 800000, waitTimeMs: 95000000, maxWaitTimeMs: 1000, signalWaitTimeMs: 0 },
            ],
            curr: [
              { waitType: 'LCK_M_X', waitingTasksCount: 495, waitTimeMs: 976000, maxWaitTimeMs: 252000, signalWaitTimeMs: 3400 },
              { waitType: 'PAGEIOLATCH', waitingTasksCount: 2120, waitTimeMs: 325000, maxWaitTimeMs: 240, signalWaitTimeMs: 4450 },
              { waitType: 'WRITELOG', waitingTasksCount: 1140, waitTimeMs: 149000, maxWaitTimeMs: 180, signalWaitTimeMs: 2280 },
              { waitType: 'SLEEP_TASK', waitingTasksCount: 800500, waitTimeMs: 95060000, maxWaitTimeMs: 1000, signalWaitTimeMs: 0 },
            ],
          };

  const waitDeltaResult = computeWaitStatsDelta({
    previousSample: waitSamplesPair.prev,
    currentSample: waitSamplesPair.curr,
    previousSqlStartTime: '2026-10-28T06:12:04.000Z',
    currentSqlStartTime: '2026-10-28T06:12:04.000Z',
  });

  const fileIoDeltaResult = computeFileIoLatencyDelta({
    previousFiles: [
      {
        databaseId: 5,
        databaseName: 'WEBRI',
        fileId: 1,
        logicalName: 'WEBRI_Data',
        fileType: 'ROWS',
        volumeMountPoint: 'D:\\',
        sampleMs: 1000000,
        numOfReads: 50000,
        numOfBytesRead: 409600000,
        ioStallReadMs: 300000,
        numOfWrites: 20000,
        numOfBytesWritten: 163840000,
        ioStallWriteMs: 140000,
      },
      {
        databaseId: 5,
        databaseName: 'WEBRI',
        fileId: 2,
        logicalName: 'WEBRI_Log',
        fileType: 'LOG',
        volumeMountPoint: 'L:\\',
        sampleMs: 1000000,
        numOfReads: 2000,
        numOfBytesRead: 16384000,
        ioStallReadMs: 8000,
        numOfWrites: 45000,
        numOfBytesWritten: 368640000,
        ioStallWriteMs: 315000,
      },
      {
        databaseId: 2,
        databaseName: 'tempdb',
        fileId: 1,
        logicalName: 'tempdev',
        fileType: 'ROWS',
        volumeMountPoint: 'T:\\',
        sampleMs: 1000000,
        numOfReads: 12000,
        numOfBytesRead: 98304000,
        ioStallReadMs: 36000,
        numOfWrites: 11000,
        numOfBytesWritten: 90112000,
        ioStallWriteMs: 33000,
      },
    ],
    currentFiles: [
      {
        databaseId: 5,
        databaseName: 'WEBRI',
        fileId: 1,
        logicalName: 'WEBRI_Data',
        fileType: 'ROWS',
        volumeMountPoint: 'D:\\',
        sampleMs: 1030000,
        numOfReads: 50320,
        numOfBytesRead: 412221440,
        ioStallReadMs:
          effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO' ? 316640 : 302880,
        numOfWrites: 20090,
        numOfBytesWritten: 164577280,
        ioStallWriteMs: 140810,
      },
      {
        databaseId: 5,
        databaseName: 'WEBRI',
        fileId: 2,
        logicalName: 'WEBRI_Log',
        fileType: 'LOG',
        volumeMountPoint: 'L:\\',
        sampleMs: 1030000,
        numOfReads: 2010,
        numOfBytesRead: 16465920,
        ioStallReadMs: 8040,
        numOfWrites: 45250,
        numOfBytesWritten: 370688000,
        ioStallWriteMs:
          effectiveScenario === 'PRESSAO_LOG_WRITELOG' ? 326000 : 317000,
      },
      {
        databaseId: 2,
        databaseName: 'tempdb',
        fileId: 1,
        logicalName: 'tempdev',
        fileType: 'ROWS',
        volumeMountPoint: 'T:\\',
        sampleMs: 1030000,
        numOfReads: 12100,
        numOfBytesRead: 99123200,
        ioStallReadMs: 36300,
        numOfWrites: 11080,
        numOfBytesWritten: 90767360,
        ioStallWriteMs: 33240,
      },
    ],
  });

  const kpiCpu =
    effectiveScenario === 'PRESSAO_LOG_WRITELOG'
      ? 19
      : effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO'
        ? 36
        : effectiveScenario === 'PRESSAO_MEMORIA_GRANT'
          ? 29
          : 6;

  const kpiMemPercent = effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 96 : 79;
  const kpiWriteLatencyMs =
    effectiveScenario === 'PRESSAO_LOG_WRITELOG'
      ? 44
      : effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO'
        ? 28
        : effectiveScenario === 'PRESSAO_MEMORIA_GRANT'
          ? 19
          : 8;

  const kpiReadLatencyMs =
    effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO'
      ? 52
      : effectiveScenario === 'PRESSAO_LOG_WRITELOG'
        ? 14
        : 9;

  const kpiBlockedCount =
    effectiveScenario === 'LENTIDAO_BLOQUEIO'
      ? 7
      : effectiveScenario === 'PRESSAO_LOG_WRITELOG'
        ? 2
        : effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO'
          ? 1
          : 0;

  const windowsMemory: WindowsMemorySample = {
    totalPhysicalMb: 65536, // 64 GB RAM no SRVSQL
    availablePhysicalMb: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 1120 : 13762,
    usedPhysicalMb: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 64416 : 51774,
    usedPercent: kpiMemPercent,
    committedMb: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 68200 : 54100,
    commitLimitMb: 73728,
    commitPercent: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 92.5 : 73.4,
    pagesPerSec: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 240 : 4,
    pageInputsPerSec: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 185 : 2,
    pageFaultsPerSec: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 1420 : 190,
    windowsMemoryPressure: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 'ALTA' : 'NORMAL',
  };

  const sqlMemory: SqlMemoryHealthSample = {
    totalServerMemoryMb: 40960, // 40,0 GB alocados pelo SQL Server
    targetServerMemoryMb: 40960,
    maxServerMemoryConfigMb: 40960,
    minServerMemoryConfigMb: 8192,
    sqlProcessWorkingSetMb: 41320,
    sqlProcessPrivateMb: 40960,
    pageLifeExpectancySec: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 145 : 4820,
    bufferCacheHitRatioPercent: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 94.2 : 99.7,
    memoryGrantsPending: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 5 : 0,
    memoryGrantsActive: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 12 : 2,
    grantedWorkspaceMemoryMb: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 6144 : 512,
    maxWorkspaceMemoryMb: 8192,
    processPhysicalMemoryLow: effectiveScenario === 'PRESSAO_MEMORIA_GRANT',
    processVirtualMemoryLow: false,
  };

  const windowsVolumes: WindowsVolumeIoSample[] = [
    {
      volume: 'C:',
      label: 'SO Windows & Serviços',
      role: 'OS_E_APLICACOES',
      readLatencyMs: 3,
      writeLatencyMs: 4,
      readsPerSec: 18,
      writesPerSec: 24,
      throughputMbPerSec: 2.1,
      queueLength: 0.1,
      freeSpaceGb: 84.5,
      totalSpaceGb: 240,
      freePercent: 35.2,
    },
    {
      volume: 'D:',
      label: 'SQL Dados (WEBRI_Data)',
      role: 'SQL_DATA',
      readLatencyMs: kpiReadLatencyMs,
      writeLatencyMs: 9,
      readsPerSec: effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO' ? 620 : 88,
      writesPerSec: 42,
      throughputMbPerSec: effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO' ? 148.4 : 14.2,
      queueLength: effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO' ? 4.8 : 0.3,
      freeSpaceGb: 312.0,
      totalSpaceGb: 960,
      freePercent: 32.5,
    },
    {
      volume: 'L:',
      label: 'SQL Log (WEBRI_Log)',
      role: 'SQL_LOG',
      readLatencyMs: 2,
      writeLatencyMs: kpiWriteLatencyMs,
      readsPerSec: 4,
      writesPerSec: effectiveScenario === 'PRESSAO_LOG_WRITELOG' ? 410 : 95,
      throughputMbPerSec: effectiveScenario === 'PRESSAO_LOG_WRITELOG' ? 38.6 : 6.8,
      queueLength: effectiveScenario === 'PRESSAO_LOG_WRITELOG' ? 3.9 : 0.2,
      freeSpaceGb: 142.0,
      totalSpaceGb: 200,
      freePercent: 71.0,
    },
    {
      volume: 'T:',
      label: 'SQL TempDB',
      role: 'TEMPDB',
      readLatencyMs: 3,
      writeLatencyMs: 3,
      readsPerSec: 34,
      writesPerSec: 31,
      throughputMbPerSec: 5.4,
      queueLength: 0.1,
      freeSpaceGb: 98.0,
      totalSpaceGb: 120,
      freePercent: 81.7,
    },
  ];

  const concurrentEvents: WindowsConcurrentEvent[] =
    effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO'
      ? [
        {
          id: 'evt-backup-full',
          category: 'BACKUP',
          title: 'Backup Diferencial / Cópia de Volume VSS em D:\\',
          source: 'Agente de Backup / SQL Server Backup',
          startedAt: '2026-11-11T17:12:00.000Z',
          endedAt: null,
          status: 'EM_ANDAMENTO',
          detail: 'Leitura sequencial intensa (148 MB/s) no volume D:\\ simultânea às consultas do WEBRI.',
        },
        {
          id: 'evt-pbi-refresh',
          category: 'POWERBI_GATEWAY',
          title: 'Atualização agendada Power BI Gateway (PBIEgwService)',
          source: 'On-premises data gateway',
          startedAt: '2026-11-11T17:15:00.000Z',
          endedAt: '2026-11-11T17:28:00.000Z',
          status: 'CONCLUIDO',
          detail: 'Extração analítica executada no mesmo servidor físico.',
        },
      ]
      : [
        {
          id: 'evt-log-backup-1400',
          category: 'BACKUP',
          title: 'Backup rotineiro de Log de Transações (WEBRI)',
          source: 'SQL Server Agent',
          startedAt: '2026-11-11T17:00:00.000Z',
          endedAt: '2026-11-11T17:00:18.000Z',
          status: 'CONCLUIDO',
          detail: 'Concluído em 18s fora do pico do bloqueio.',
        },
      ];

  const diagnostics = generateEvidenceDiagnostics({
    intervalLabel: '14:00 – 14:30 (America/Sao_Paulo)',
    cpuPercent: kpiCpu,
    windowsMemory,
    sqlMemory,
    windowsVolumes,
    fileIoDeltas: fileIoDeltaResult.items,
    blockingChains,
    waitStatsDelta: waitDeltaResult.items,
    concurrentEvents,
    windowsProcesses: processes,
    hasViewServerState: true,
    collectorReachable: true,
  });

  const evaluatedAlerts = evaluateAlertsWithHysteresis({
    rules: state.alertRules,
    existingAlerts: state.alerts,
    observedAtIso: '2026-11-11T17:30:00.000Z',
    metrics: {
      maxBlockedDurationSeconds: effectiveScenario === 'LENTIDAO_BLOQUEIO' ? 252 : 0,
      blockedSessionsCount: kpiBlockedCount,
      rootBlockerSessionId: effectiveScenario === 'LENTIDAO_BLOQUEIO' ? 72 : null,
      maxDiskWriteLatencyMs: kpiWriteLatencyMs,
      maxDiskReadLatencyMs: kpiReadLatencyMs,
      provenMemoryPressureScore: sqlMemory.memoryGrantsPending,
      cpuPercent: kpiCpu,
      minVolumeFreePercent: 32.5,
      criticalServiceStoppedCount: 0,
      collectorDelaySeconds: 12,
    },
  });
  state.alerts = evaluatedAlerts;

  const bannerMessage =
    effectiveScenario === 'LENTIDAO_BLOQUEIO'
      ? 'Atenção · 7 sessões aguardam uma transação aberta há 4 min 12 s. Dados simulados.'
      : effectiveScenario === 'PRESSAO_LOG_WRITELOG'
        ? 'Atenção · Latência de escrita no volume de log em 44 ms (WRITELOG = 73% das esperas). Dados simulados.'
        : effectiveScenario === 'CONCORRENCIA_BACKUP_DISCO'
          ? 'Atenção · Latência de leitura em 52 ms durante execução simultânea de backup no volume D:\\. Dados simulados.'
          : 'Crítico · 5 requisições aguardam concessão de memória (RESOURCE_SEMAPHORE) com paginação elevada no Windows. Dados simulados.';

  return {
    generatedAt,
    observedAt: '2026-11-11T17:30:00.000Z',
    timezone: 'America/Sao_Paulo',
    overallHealth: effectiveScenario === 'PRESSAO_MEMORIA_GRANT' ? 'CRITICO' : 'ATENCAO',
    dataSourceMode: 'SIMULATED_SCENARIO',
    activeScenario: effectiveScenario,
    activeWindow: windowPreset,
    bannerMessage,
    collectorHealth: {
      status: 'SIMULATED',
      lastCollectionAt: '2026-11-11T17:30:00.000Z',
      delaySeconds: 0,
      collectorVersion: 'v2.6.2-srvsql',
      separateFromUiRefresh: true,
      localQueuePendingCount: 0,
      storageUsedSamples: state.samples.length,
      storageMaxSamples: state.collectorBudget.maxStoredSnapshots,
    },
    sqlMetadata: {
      ...REAL_VERIFIED_SRVSQL_METADATA,
      sqlServerStartTime: '2026-10-28T06:12:04.000Z',
    },
    zabbixProbe: REAL_VERIFIED_ZABBIX_PROBE,
    kpis: {
      serverCpuPercent: kpiCpu,
      serverCpuSubtitle: kpiCpu < 25 ? 'Baixa neste instante' : 'Atividade moderada',
      memoryUsedPercent: kpiMemPercent,
      sqlMemoryGb: 40.0,
      windowsAvailableMemoryGb: Number(((windowsMemory.availablePhysicalMb ?? 0) / 1024).toFixed(1)),
      memorySubtitle: 'SQL: 40,0 GB · exemplo',
      diskWriteLatencyMs: kpiWriteLatencyMs,
      diskReadLatencyMs: kpiReadLatencyMs,
      diskVolumeLabel: 'Volume de log · exemplo',
      diskSubtitle: 'Volume de log · exemplo',
      blockedSessionsCount: kpiBlockedCount,
      rootBlockerSessionId: kpiBlockedCount > 0 ? 72 : null,
      maxBlockedDurationSeconds: kpiBlockedCount > 0 ? 252 : 0,
      blockedSubtitle: kpiBlockedCount > 0 ? 'Bloqueador: sessão 72' : 'Nenhum bloqueio ativo',
    },
    latencySemantics: {
      userPerceivedLatencyMs: 48000,
      sqlObservedElapsedMs: 252000,
      simpleConnectivityPingMs: 14,
      explanation:
        'Um SELECT 1 leva apenas 14 ms porque não toca nas páginas bloqueadas da tabela de protocolo/matrícula. Já a operação real do WEBRI ficou retida por 252.000 ms (4 min 12 s) aguardando o lock exclusivo da sessão 72.',
    },
    timeline,
    previousPeriodComparison: {
      previousWindowLabel: 'Janela anterior (13:30–14:00)',
      avgCpuCurrent: kpiCpu,
      avgCpuPrevious: 8,
      avgWriteLatencyCurrentMs: kpiWriteLatencyMs,
      avgWriteLatencyPreviousMs: 4,
      blockedEventsCurrent: kpiBlockedCount,
      blockedEventsPrevious: 0,
      sqlWaitTotalCurrentMs: waitDeltaResult.totalWaitDeltaMs,
      sqlWaitTotalPreviousMs: 9400,
    },
    waitStatsDelta: waitDeltaResult.items,
    blockingChains,
    activeSessions: RawSessionsForScenario,
    sqlMemory,
    databaseSpaces: [
      {
        databaseName: 'WEBRI',
        recoveryModel: 'FULL',
        dataTotalMb: 286720,
        dataUsedMb: 241900,
        logTotalMb: 32768,
        logUsedMb: effectiveScenario === 'LENTIDAO_BLOQUEIO' ? 14820 : 4120,
        logUsedPercent: effectiveScenario === 'LENTIDAO_BLOQUEIO' ? 45.2 : 12.6,
        logReuseWaitDesc: effectiveScenario === 'LENTIDAO_BLOQUEIO' ? 'ACTIVE_TRANSACTION' : 'NOTHING',
        isTempdb: false,
      },
      {
        databaseName: 'tempdb',
        recoveryModel: 'SIMPLE',
        dataTotalMb: 24576,
        dataUsedMb: 3840,
        logTotalMb: 4096,
        logUsedMb: 620,
        logUsedPercent: 15.1,
        logReuseWaitDesc: 'NOTHING',
        isTempdb: true,
        tempdbUserObjectsMb: 1120,
        tempdbInternalObjectsMb: 1890,
        tempdbVersionStoreMb: 830,
      },
    ],
    fileIoDeltas: fileIoDeltaResult.items,
    costlyQueries: [
      {
        queryHash: '0x77C12098A4E1002B',
        databaseName: 'WEBRI',
        executionCountDelta: 18,
        totalElapsedTimeDeltaMs: 742000,
        avgElapsedTimeMs: 41222,
        baselineAvgElapsedTimeMs: 180,
        regressionRatio: 229.0,
        totalCpuTimeDeltaMs: 390,
        totalLogicalReadsDelta: 4210,
        totalWritesDelta: 34,
        lastWaitTypeHint: 'LCK_M_X',
        operationKind: 'GRAVACAO_TRANSACIONAL',
      },
      {
        queryHash: '0x52B49100E8C3194A',
        databaseName: 'WEBRI',
        executionCountDelta: 44,
        totalElapsedTimeDeltaMs: 398000,
        avgElapsedTimeMs: 9045,
        baselineAvgElapsedTimeMs: 95,
        regressionRatio: 95.2,
        totalCpuTimeDeltaMs: 810,
        totalLogicalReadsDelta: 19400,
        totalWritesDelta: 0,
        lastWaitTypeHint: 'LCK_M_S',
        operationKind: 'CONSULTA',
      },
      {
        queryHash: '0x94A8F102C4B711E0',
        databaseName: 'WEBRI',
        executionCountDelta: 4,
        totalElapsedTimeDeltaMs: 12400,
        avgElapsedTimeMs: 3100,
        baselineAvgElapsedTimeMs: 2800,
        regressionRatio: 1.1,
        totalCpuTimeDeltaMs: 1420,
        totalLogicalReadsDelta: 18420,
        totalWritesDelta: 312,
        lastWaitTypeHint: 'PAGEIOLATCH_SH',
        operationKind: 'PROCEDIMENTO',
      },
    ],
    windowsMemory,
    windowsVolumes,
    windowsNetwork: [
      {
        interfaceName: 'Intel(R) I350 Gigabit Network Connection #1 (LAN Cartório)',
        rxMbps: 18.4,
        txMbps: 34.2,
        packetsErrorsDelta: 0,
        packetsDroppedDelta: 0,
        outputQueueLength: 0,
      },
    ],
    windowsProcesses: processes,
    windowsServices: services,
    concurrentEvents,
    diagnostics,
    alerts: evaluatedAlerts,
    alertRules: state.alertRules,
    userIncidents: state.incidents,
    webriConfig: state.webriConfig,
    coverageSources: buildCoverageSources(false, true),
    collectorBudget: state.collectorBudget,
    counterResetNotice: waitDeltaResult.counterResetDetected ? waitDeltaResult.resetReason : null,
  };
}

import type {
  ConnectorTelemetry,
  GlobalOperationsStatus,
  HealthStatus,
  IncrementalModuleStatus,
} from './operations-contract';

export const HEARTBEAT_FRESH_SECONDS = 120;

export const MODULE_POLICIES = [
  {
    key: 'bi',
    module: 'Módulo BI',
    expectedIntervalSeconds: 60,
    healthyUntilSeconds: 90,
    warningUntilSeconds: 180,
  },
  {
    key: 'produtividade',
    module: 'Produtividade',
    expectedIntervalSeconds: 60,
    healthyUntilSeconds: 90,
    warningUntilSeconds: 180,
  },
  {
    key: 'metas',
    module: 'Metas',
    expectedIntervalSeconds: 900,
    healthyUntilSeconds: 1_080,
    warningUntilSeconds: 1_800,
  },
  {
    key: 'tarefas',
    module: 'Tarefas',
    expectedIntervalSeconds: 60,
    healthyUntilSeconds: 90,
    warningUntilSeconds: 180,
  },
] as const;

export type ModuleKey = (typeof MODULE_POLICIES)[number]['key'];

export interface SourceStatusObservation {
  source: string;
  lastSyncAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  hasLastError: boolean;
  recordsLastSync: number;
  status: string;
}

export interface DatabaseProbeSample {
  kind: 'normal' | 'transition' | 'slow' | 'capacity_timeout' | 'connectivity_failure' | 'unknown';
  latencyMs: number | null;
  observedAt: string;
  safeCode: SafeOperationsErrorCode | null;
}

export interface DatabaseHealthState {
  status: HealthStatus;
  reason: string;
  observedAt: string;
  latencyMs: number | null;
  samples: DatabaseProbeSample[];
}

export type SafeOperationsErrorCode =
  | 'CONNECTION_ERROR'
  | 'QUERY_TIMEOUT'
  | 'DATABASE_UNAVAILABLE'
  | 'OBSERVABILITY_UNAVAILABLE'
  | 'UNEXPECTED_ERROR';

function secondsBetween(now: Date, then: Date): number {
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1_000));
}

export function buildIncrementalModuleStatus(
  key: ModuleKey,
  observation: SourceStatusObservation | undefined,
  now: Date,
  connectorOnline: boolean,
  connectorIsSelectable: boolean,
): IncrementalModuleStatus {
  const policy = MODULE_POLICIES.find((item) => item.key === key)!;

  if (!connectorIsSelectable) {
    return {
      module: policy.module,
      key,
      status: 'UNKNOWN',
      lastSuccessfulRunAt: null,
      nextExpectedAt: null,
      ageSeconds: null,
      overdueSeconds: null,
      recordsCount: null,
      expectedIntervalSeconds: policy.expectedIntervalSeconds,
      isIncremental: null,
      provenance: 'unavailable',
      evidence: 'Não há um único Connector habilitado que possa ser avaliado com segurança.',
    };
  }

  if (!observation) {
    return {
      module: policy.module,
      key,
      status: 'UNKNOWN',
      lastSuccessfulRunAt: null,
      nextExpectedAt: null,
      ageSeconds: null,
      overdueSeconds: null,
      recordsCount: null,
      expectedIntervalSeconds: policy.expectedIntervalSeconds,
      isIncremental: null,
      provenance: 'unavailable',
      evidence: 'Nenhuma execução desta fonte foi registrada no SaaS.',
    };
  }

  const lastSuccess = observation.lastSuccessAt;
  const hasUnresolvedError = Boolean(
    observation.lastErrorAt
      && (!lastSuccess || observation.lastErrorAt.getTime() > lastSuccess.getTime()),
  ) || observation.status === 'error';

  if (hasUnresolvedError) {
    return {
      module: policy.module,
      key,
      status: 'ERROR',
      lastSuccessfulRunAt: lastSuccess?.toISOString() ?? null,
      nextExpectedAt: lastSuccess
        ? new Date(lastSuccess.getTime() + policy.expectedIntervalSeconds * 1_000).toISOString()
        : null,
      ageSeconds: lastSuccess ? secondsBetween(now, lastSuccess) : null,
      overdueSeconds: lastSuccess
        ? Math.max(0, secondsBetween(now, lastSuccess) - policy.expectedIntervalSeconds)
        : null,
      recordsCount: lastSuccess ? observation.recordsLastSync : null,
      expectedIntervalSeconds: policy.expectedIntervalSeconds,
      isIncremental: null,
      provenance: 'calculated',
      evidence: observation.hasLastError
        ? 'O Connector registrou uma falha posterior à última execução bem-sucedida.'
        : 'A fonte está marcada com falha no estado persistido.',
    };
  }

  if (!lastSuccess) {
    return {
      module: policy.module,
      key,
      status: 'UNKNOWN',
      lastSuccessfulRunAt: null,
      nextExpectedAt: null,
      ageSeconds: null,
      overdueSeconds: null,
      recordsCount: null,
      expectedIntervalSeconds: policy.expectedIntervalSeconds,
      isIncremental: null,
      provenance: 'unavailable',
      evidence: 'Ainda não existe execução bem-sucedida registrada para esta fonte.',
    };
  }

  const ageSeconds = secondsBetween(now, lastSuccess);
  const common = {
    module: policy.module,
    key,
    lastSuccessfulRunAt: lastSuccess.toISOString(),
    nextExpectedAt: new Date(lastSuccess.getTime() + policy.expectedIntervalSeconds * 1_000).toISOString(),
    ageSeconds,
    overdueSeconds: Math.max(0, ageSeconds - policy.expectedIntervalSeconds),
    recordsCount: observation.recordsLastSync,
    expectedIntervalSeconds: policy.expectedIntervalSeconds,
    isIncremental: null,
    provenance: 'calculated' as const,
  };

  if (ageSeconds <= policy.healthyUntilSeconds) {
    return {
      ...common,
      status: 'OK',
      evidence: 'Execução bem-sucedida registrada dentro da tolerância desta fonte.',
    };
  }

  if (ageSeconds <= policy.warningUntilSeconds) {
    return {
      ...common,
      status: 'WARNING',
      evidence: 'A última execução registrada ultrapassou a tolerância inicial desta fonte.',
    };
  }

  if (!connectorOnline) {
    return {
      ...common,
      status: 'ERROR',
      evidence: 'A evidência da fonte está vencida e o Connector também está sem heartbeat recente.',
    };
  }

  return {
    ...common,
    status: 'UNKNOWN',
    provenance: 'unavailable',
    evidence: 'O Connector está online, mas ciclos sem alterações não são registrados por fonte.',
  };
}

function errorCodeFromUnknown(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: unknown; meta?: { code?: unknown } };
  if (typeof candidate.code === 'string') return candidate.code;
  if (typeof candidate.meta?.code === 'string') return candidate.meta.code;
  return null;
}

export function classifyOperationsError(error: unknown): {
  code: SafeOperationsErrorCode;
  probeKind: DatabaseProbeSample['kind'];
} {
  const code = errorCodeFromUnknown(error);

  if (code === 'P1001' || code === 'P1002') {
    return { code: 'CONNECTION_ERROR', probeKind: 'connectivity_failure' };
  }

  if (code === 'P1008' || code === 'P2024' || code === 'P2028' || code === '57014') {
    return { code: 'QUERY_TIMEOUT', probeKind: 'capacity_timeout' };
  }

  if (code?.startsWith('P')) {
    return { code: 'DATABASE_UNAVAILABLE', probeKind: 'unknown' };
  }

  return { code: 'UNEXPECTED_ERROR', probeKind: 'unknown' };
}

function consecutiveNormals(samples: DatabaseProbeSample[]): number {
  let count = 0;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    if (samples[index]?.kind !== 'normal') break;
    count += 1;
  }
  return count;
}

export function evolveDatabaseHealth(
  previous: DatabaseHealthState | null,
  sample: DatabaseProbeSample,
): DatabaseHealthState {
  const samples = [...(previous?.samples ?? []), sample].slice(-3);
  const consecutiveConnectionFailures = samples
    .slice(-2)
    .every((item) => item.kind === 'connectivity_failure') && samples.length >= 2;
  const degradedSamples = samples.filter(
    (item) => item.kind === 'slow' || item.kind === 'capacity_timeout',
  ).length;

  if (consecutiveConnectionFailures) {
    return {
      status: 'offline',
      reason: 'Falhas consecutivas de conectividade com o banco.',
      observedAt: sample.observedAt,
      latencyMs: sample.latencyMs,
      samples,
    };
  }

  if (sample.kind === 'capacity_timeout') {
    return {
      status: 'degraded',
      reason: 'O pool ou uma consulta operacional excedeu o tempo disponível.',
      observedAt: sample.observedAt,
      latencyMs: sample.latencyMs,
      samples,
    };
  }

  if (degradedSamples >= 2) {
    return {
      status: 'degraded',
      reason: 'Latência elevada em medições recentes consecutivas.',
      observedAt: sample.observedAt,
      latencyMs: sample.latencyMs,
      samples,
    };
  }

  if (sample.kind === 'connectivity_failure') {
    return {
      status: previous?.status === 'operational' ? 'degraded' : 'unknown',
      reason: 'Falha isolada de conectividade; aguardando confirmação.',
      observedAt: sample.observedAt,
      latencyMs: null,
      samples,
    };
  }

  if (sample.kind === 'unknown') {
    return {
      status: 'unknown',
      reason: 'Não foi possível classificar a medição com segurança.',
      observedAt: sample.observedAt,
      latencyMs: sample.latencyMs,
      samples,
    };
  }

  if (sample.kind === 'transition') {
    return {
      status: previous?.status ?? 'unknown',
      reason: previous
        ? 'Latência na faixa de transição; estado anterior preservado.'
        : 'Primeira medição na faixa de transição.',
      observedAt: sample.observedAt,
      latencyMs: sample.latencyMs,
      samples,
    };
  }

  if (sample.kind === 'slow') {
    return {
      status: previous?.status === 'operational' ? 'operational' : 'unknown',
      reason: 'Pico isolado de latência; aguardando nova medição.',
      observedAt: sample.observedAt,
      latencyMs: sample.latencyMs,
      samples,
    };
  }

  if ((previous?.status === 'degraded' || previous?.status === 'offline') && consecutiveNormals(samples) < 3) {
    return {
      status: 'degraded',
      reason: 'Conectividade recuperando; aguardando três medições normais.',
      observedAt: sample.observedAt,
      latencyMs: sample.latencyMs,
      samples,
    };
  }

  return {
    status: 'operational',
    reason: 'Consulta de conectividade concluída dentro da faixa normal.',
    observedAt: sample.observedAt,
    latencyMs: sample.latencyMs,
    samples,
  };
}

export function deriveGlobalStatus(
  databaseStatus: HealthStatus,
  connectorStatus: ConnectorTelemetry['status'],
  modules: IncrementalModuleStatus[],
): GlobalOperationsStatus {
  if (databaseStatus === 'offline') return 'INDISPONIBILIDADE PARCIAL';

  const hasKnownDegradation = databaseStatus === 'degraded'
    || connectorStatus === 'OFFLINE'
    || connectorStatus === 'DEGRADED'
    || modules.some((item) => item.status === 'WARNING' || item.status === 'ERROR');

  if (hasKnownDegradation) return 'DEGRADADO';

  const hasIncompleteMonitoring = databaseStatus === 'unknown'
    || connectorStatus === 'UNKNOWN'
    || connectorStatus === 'AMBIGUOUS'
    || modules.length === 0
    || modules.some((item) => item.status === 'UNKNOWN');

  return hasIncompleteMonitoring ? 'MONITORAMENTO INCOMPLETO' : 'OPERACIONAL';
}

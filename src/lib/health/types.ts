export type Provenance = 'live' | 'calculated' | 'unavailable';
export type DeliveryStatus = 'fresh' | 'cached' | 'stale';

export interface ServiceHealthItem {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'offline' | 'unknown';
  latencyMs: number | null;
  lastSignalAt: string;
  version?: string | null;
  details?: string | null;
  provenance: Provenance;
  reason?: string;
  checkedAt?: string;
}

export type IncrementalModuleKey =
  | 'bi'
  | 'produtividade'
  | 'metas'
  | 'tarefas'
  | 'retornos'
  | 'impressoes'
  | 'safras';

export interface ConnectorSqliteFailureItem {
  batchId: string;
  source: string;
  moduleLabel: string;
  recordsCount: number | null;
  attempts: number;
  lastError: string;
  firstFailedAt: string;
  lastFailedAt: string;
  resolutionStatus: 'RETRYING' | 'QUARANTINED' | 'RESOLVED';
  resolvedAt: string | null;
  resolutionNote: string;
}

export interface IncrementalModuleStatus {
  module: string;
  key: IncrementalModuleKey;
  procedureSql?: string;
  syncMode?: 'incremental' | 'cursor' | 'full';
  cursorValue?: string | null;
  lastDurationMs?: number | null;
  runsTotal?: number | null;
  consecutiveFailures?: number | null;
  activeFailedBatchesCount?: number;
  resolvedFailedBatches24hCount?: number;
  lastFailedError?: string | null;
  status: 'OK' | 'WARNING' | 'ERROR' | 'UNKNOWN';
  lastSyncAt: string | null;
  nextExpectedAt: string | null;
  delaySeconds: number | null;
  recordsCount: number | null;
  isIncremental: boolean;
  expectedIntervalSeconds: number;
  provenance: Provenance;
  statusNote?: string;
}

export interface ConnectorSmbRootTelemetry {
  id: string;
  label: string;
  uncOrDrivePath: string;
  exists: boolean | null;
  accessible: boolean | null;
  latencyMs: number | null;
  indexedFilesCount: number | null;
  error: string | null;
  provenance: Provenance;
}

export interface ConnectorDocumentalFailureItem {
  id: string;
  type: string;
  typeLabel: string;
  target: string;
  error: string;
  failedAt: string;
  failedAtFormatted: string;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedAtFormatted: string | null;
  resolutionReason: string;
}

export interface ConnectorSubsystemsSnapshot {
  provenance: Provenance;
  documental: {
    workerEnabled: boolean;
    workerRunning: boolean;
    disabledReason: string | null;
    pollIntervalLabel: string;
    lastPollAt: string | null;
    lastJobAt: string | null;
    lastError: string | null;
    activeQueueCount: number;
    jobs24hTotal: number;
    jobs24hCompleted: number;
    jobs24hFailed: number;
    jobs24hFailedActive?: number;
    jobs24hFailedResolved?: number;
    recentFailures?: ConnectorDocumentalFailureItem[];
    avgJobDurationMs: number | null;
    jobsByType: {
      search: number;
      list_directory: number;
      read_document_text: number;
      read_document_chunk: number;
      extract_petition: number;
      analyze_signatures: number;
    };
    manifestacoes: {
      conferencia: number;
      finalizada: number;
      total: number;
    };
  };
  smbRoots: ConnectorSmbRootTelemetry[];
  indexCache: {
    indexedRootsCount: number;
    totalIndexedFiles: number;
    refreshingRootsCount: number;
    ttlMs: number;
    lastBuiltAt: string | null;
    provenance: Provenance;
  };
  transferAndCli: {
    fileServer: {
      active: boolean | null;
      protocol: 'HTTP' | 'HTTPS' | 'N/A';
      port: number;
      publicUrl: string | null;
      activeTicketsCount: number;
      ticketsIssuedTotal: number;
      bytesServedTotal: number;
      rangeRequestsTotal: number;
      httpsChunks24h: number;
      lastError: string | null;
    };
    rustCli: {
      available: boolean | null;
      binaryName: string;
      petitionsExtractedTotal: number;
      docxExtractedTotal: number;
      signaturesAnalyzedTotal: number;
      lastDurationMs: number | null;
      lastError: string | null;
    };
  };
  sqliteAndResilience: {
    failedActiveCount?: number;
    failedResolved24hCount?: number;
    recentFailures?: ConnectorSqliteFailureItem[];
    queue: {
      pending: number;
      sending: number;
      failed: number;
      quarantined: number;
      completed: number;
    };
    chunks: {
      activePlans: number;
      pendingChunks: number;
      confirmedChunks: number;
      failedChunks: number;
      chunkSizeLimit: number;
    };
    checkpoints: {
      persistedCount: number;
      stagedCandidates: number;
      cursorsBySource: Record<string, { cursorValue: string; updatedAt: string | null }>;
    };
    governance: {
      singleInstanceLock: boolean;
      shadowMode: boolean;
      schedulerEnabled: boolean;
      autoSyncEnabled: boolean;
      activeLocks: string[];
      morningReconnectTime: string;
      lastMorningReconnectAt: string | null;
      lastMorningReconnectOk: boolean | null;
      morningPingTime: string;
      lastMorningPingDate: string | null;
      startupCatchupCount: number;
      proxyEnabled: boolean;
      proxyFallbackCount: number;
      lastProxyFallbackAt: string | null;
      sqlConnected: boolean | null;
      sqlLatencyMs: number | null;
    };
  };
}

export interface ConnectorTelemetry {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'AMBIGUOUS' | 'UNKNOWN' | 'STANDBY';
  environment: 'Produção';
  server: string;
  windowsService: string;
  uptimeFormatted: string | null;
  heartbeatAgoSeconds: number | null;
  cpuPercent: number | null;
  ramMb: number | null;
  heapMb?: number | null;
  threads: number | null;
  handles: number | null;
  pendingQueue: number | null;
  sendingQueue?: number | null;
  failedQueue?: number | null;
  quarantinedQueue?: number | null;
  pid?: number | null;
  hostname?: string | null;
  nodeVersion?: string | null;
  capabilities?: string[];
  lastError: string | null;
  lastSyncAgoSeconds: number | null;
  activeConnectorsCount: number;
  operationalState?: 'ACTIVE' | 'STANDBY' | 'PAUSED';
  role?: 'PRIMARY' | 'SECONDARY';
  connectorName?: string;
  provenance: {
    telemetry: Provenance;
    heartbeat: Provenance;
  };
  subsystems?: ConnectorSubsystemsSnapshot;
  note?: string;
}

export interface ConnectorClusterNodeSummary {
  connectorId: string;
  name: string;
  role: 'PRIMARY' | 'SECONDARY';
  operationalState: 'ACTIVE' | 'STANDBY' | 'PAUSED';
  priority: number;
  version: string | null;
  targetVersion: string | null;
  updateStatus: string;
  updateMessage: string | null;
  lastUpdateAt: string | null;
  hostname: string | null;
  osVersion: string | null;
  lanUrl: string | null;
  installedPath: string | null;
  configVersion: number;
  remoteConfig: {
    role?: 'PRIMARY' | 'SECONDARY';
    priority?: number;
    lanUrl?: string | null;
    fileServerPort?: number;
    sqlHost?: string | null;
    sqlDatabase?: string | null;
    documentRoots?: Array<{ id: string; path: string; label?: string }>;
    notes?: string | null;
  };
  isOnline: boolean;
  heartbeatAgoSeconds: number | null;
  lastSeenAt: string | null;
  telemetry: ConnectorTelemetry;
}

export interface ConnectorClusterInfo {
  nodes: ConnectorClusterNodeSummary[];
  failoverMode: 'MANUAL' | 'AUTO';
  autoFailoverTimeoutSec: number;
  latestReleaseVersion: string | null;
  latestReleasePublishedAt: string | null;
  rollingUpdate: {
    active: boolean;
    targetVersion: string;
    phase:
    | 'UPDATING_STANDBY'
    | 'UPDATING_FORMER_ACTIVE'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'TIMED_OUT'
    | 'STAGED_AWAITING_RESTART';
    originalPrimaryId: string | null;
    startedAt: string;
    message?: string;
  } | null;
}

export interface BatchHistoryItem {
  id: string;
  batchId: string;
  source: string;
  status: string;
  recordsReceived: number;
  durationMs: number | null;
  receivedAt: string;
}

export type IntegrationStatus = 'OPERACIONAL' | 'ATENCAO' | 'INDISPONIVEL' | 'NAO_CONFIGURADA' | 'EM_SINCRONIZACAO';

export interface IntegrationSyncHistoryItem {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: 'SUCESSO' | 'PARCIAL' | 'FALHA';
  recordsReceived: number;
  recordsCreated?: number;
  recordsUpdated?: number;
  diagnosticMessage: string;
}

export interface ExternalIntegrationHealth {
  id: 'nextqs' | 'google_avaliacoes' | string;
  name: string;
  category: 'ATENDIMENTO_ESPERA' | 'REPUTACAO_GOOGLE' | 'MENSAGERIA' | 'SISTEMA_CARTORIO';
  status: IntegrationStatus;
  isConfigured: boolean;
  lastSyncAt: string | null;
  nextSyncExpectedAt: string | null;
  latencyMs: number | null;
  processedVolume: number | null;
  volumeLabel: string;
  recentFailures24h: number;
  lastErrorSanitized: string | null;
  webhookActive?: boolean;
  details: {
    authStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'REVOKED' | 'NOT_CONFIGURED';
    tokenDaysRemaining?: number | null;
    unansweredReviewsCount?: number;
    webhookUrlConfigured?: boolean;
    diagnosticSummary: string;
    history: IntegrationSyncHistoryItem[];
  };
  moduleUrl: string;
  configUrl: string;
}

export interface OperationsHealthSnapshot {
  globalStatus: 'OPERACIONAL' | 'DEGRADADO' | 'INDISPONIBILIDADE PARCIAL' | 'INDISPONÍVEL' | 'MONITORAMENTO INCOMPLETO' | 'UNKNOWN';
  environment: 'Produção — único ambiente monitorado';
  timestamp: string;
  observedAt: string;
  snapshotAt: string;
  cacheAgeMs: number;
  delivery: DeliveryStatus;
  services: ServiceHealthItem[];
  incrementalModules: IncrementalModuleStatus[];
  connector: ConnectorTelemetry;
  connectorCluster?: ConnectorClusterInfo;
  externalIntegrations: ExternalIntegrationHealth[];
  metrics: {
    availabilityPercent: number | null;
    syncOnTimePercent: number | null;
    successRatePercent: number | null;
    p95LatencyMs: number | null;
    avgBatchDurationMs?: number | null;
    /** Base real do tempo de resposta e da disponibilidade (null = ainda sem amostras) */
    measurement?: {
      windowHours: number;
      totalChecks: number;
      successfulChecks: number;
      since: string | null;
    } | null;
    /** Falhas recentes (últimas 24 h) com situação de solução */
    failures?: Array<{
      id: string;
      source: 'central' | 'heartbeat';
      checkedAt: string;
      detail: string;
      resolved: boolean;
      resolvedAt: string | null;
    }>;
    provenance: Provenance;
    note: string;
  };
  recentBatches?: Record<string, BatchHistoryItem[]>;
  incidents: Array<{
    id: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    time: string;
    service: string;
    description: string;
    duration: string;
    status: 'ACTIVE' | 'RESOLVED';
  }>;
  alerts: Array<{
    id: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    detail: string;
    timeAgo: string;
  }>;
  deploys: {
    fiorixWeb: { version: string; deployedAt: string };
    api: { version: string; deployedAt: string };
    connector: { version: string | null; status: string };
    databaseStatus: string;
    environment: 'Produção';
  };
}

export interface SmtpEmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  resendApiKey?: string;
}

export interface WhatsAppConfig {
  apikey?: string;
  instanceUrl?: string;
  token?: string;
  chatId?: string;
  phones?: Array<{ phone: string; apikey: string; label?: string }>;
}

export interface AlertChannelConfig {
  id?: string;
  tenantId: string;
  name: string;
  webhookUrl: string;
  channelType: 'discord' | 'slack' | 'generic';
  enabled: boolean;
  notifyConnectorOffline: boolean;
  notifySyncFailed: boolean;
  notifyModuleDelayed: boolean;
  notifyNextQsFailure?: boolean;
  notifyGoogleTokenExpiring?: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: string | null;
  emailEnabled?: boolean;
  emailRecipients?: string;
  emailProvider?: 'smtp' | 'resend';
  emailConfig?: SmtpEmailConfig;
  whatsappEnabled?: boolean;
  whatsappProvider?: 'callmebot' | 'evolution' | 'zapi';
  whatsappPhone?: string;
  whatsappConfig?: WhatsAppConfig;
}

export interface AlertLogItem {
  id: string;
  tenantId: string;
  eventType: string;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  channelType: string;
  statusCode?: number | null;
  success: boolean;
  errorMessage?: string | null;
  createdAt: string;
}

export interface TelemetryPoint {
  timestamp: string;
  label: string;
  bi: number;
  produtividade: number;
  metas: number;
  tarefas: number;
  retornos?: number;
  impressoes?: number;
  safras?: number;
  totalRecords: number;
  batchCount: number;
  avgDurationMs: number;
}

export interface TelemetryHistoryResponse {
  range: '24h' | '7d' | '30d';
  summary: {
    totalBatches: number;
    totalRecords: number;
    avgDurationMs: number;
    successRatePercent: number;
  };
  timeline: TelemetryPoint[];
  sourceDistribution: {
    source: string;
    records: number;
    batches: number;
  }[];
}

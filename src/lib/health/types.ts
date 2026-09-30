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

export interface IncrementalModuleStatus {
  module: string;
  key: 'bi' | 'produtividade' | 'metas' | 'tarefas' | 'retornos' | 'impressoes' | 'andamentos';
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

export interface ConnectorTelemetry {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'AMBIGUOUS' | 'UNKNOWN';
  environment: 'Produção';
  server: string;
  windowsService: string;
  uptimeFormatted: string | null;
  heartbeatAgoSeconds: number | null;
  cpuPercent: number | null;
  ramMb: number | null;
  threads: number | null;
  handles: number | null;
  pendingQueue: number | null;
  lastError: string | null;
  lastSyncAgoSeconds: number | null;
  activeConnectorsCount: number;
  provenance: {
    telemetry: Provenance;
    heartbeat: Provenance;
  };
  note?: string;
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
  externalIntegrations: ExternalIntegrationHealth[];
  metrics: {
    availabilityPercent: number | null;
    syncOnTimePercent: number | null;
    successRatePercent: number | null;
    p95LatencyMs: number | null;
    avgBatchDurationMs?: number | null;
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

export type HealthStatus = 'operational' | 'degraded' | 'offline' | 'unknown';

export type DataProvenance = 'live' | 'calculated' | 'unavailable';

export type SnapshotDelivery = 'fresh' | 'cached' | 'stale';

export type OperationsEnvironment = 'PRODUÇÃO';

export type GlobalOperationsStatus =
  | 'OPERACIONAL'
  | 'DEGRADADO'
  | 'INDISPONIBILIDADE PARCIAL'
  | 'INDISPONÍVEL'
  | 'MONITORAMENTO INCOMPLETO';

export interface SnapshotMetadata {
  delivery: SnapshotDelivery;
  snapshotAt: string;
  observedAt: string;
  cacheAgeMs: number;
  cacheTtlMs: number;
  scope: 'tenant';
}

export interface ServiceHealthItem {
  id: string;
  name: string;
  status: HealthStatus;
  latencyMs: number | null;
  observedAt: string | null;
  version: string | null;
  details: string;
  provenance: DataProvenance;
}

export type IncrementalStatus = 'OK' | 'WARNING' | 'ERROR' | 'UNKNOWN';

export interface IncrementalModuleStatus {
  module: string;
  key: 'bi' | 'produtividade' | 'metas' | 'tarefas';
  status: IncrementalStatus;
  lastSuccessfulRunAt: string | null;
  nextExpectedAt: string | null;
  ageSeconds: number | null;
  overdueSeconds: number | null;
  recordsCount: number | null;
  expectedIntervalSeconds: number;
  isIncremental: boolean | null;
  provenance: DataProvenance;
  evidence: string;
}

export interface ConnectorTelemetry {
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN' | 'AMBIGUOUS';
  environment: OperationsEnvironment;
  configuration: 'single' | 'missing' | 'ambiguous' | 'unavailable';
  serverLabel: string;
  windowsService: 'Running' | 'Stopped' | 'Unknown' | null;
  version: string | null;
  heartbeatAt: string | null;
  heartbeatAgeSeconds: number | null;
  uptimeSeconds: number | null;
  cpuPercent: number | null;
  ramMb: number | null;
  threads: number | null;
  handles: number | null;
  pendingQueue: number | null;
  lastErrorCode: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncAgeSeconds: number | null;
  provenance: DataProvenance;
  details: string;
}

export interface OperationsMetric {
  value: number | null;
  unit: '%' | 'ms';
  provenance: DataProvenance;
  window: string | null;
  sampleCount: number | null;
  details: string;
}

export interface OperationsIncident {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  observedAt: string;
  service: string;
  description: string;
  duration: string | null;
  provenance: 'live';
}

export interface OperationsAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  detail: string;
  observedAt: string;
  provenance: 'calculated';
}

export interface MonitoringCoverage {
  status: 'available' | 'unavailable';
  provenance: DataProvenance;
  message: string;
}

export interface DeploymentDatum {
  version: string | null;
  commit: string | null;
  deployedAt: string | null;
  status: string | null;
  provenance: DataProvenance;
}

export interface OperationsHealthSnapshot {
  globalStatus: GlobalOperationsStatus;
  environment: OperationsEnvironment;
  metadata: SnapshotMetadata;
  services: ServiceHealthItem[];
  incrementalModules: IncrementalModuleStatus[];
  connector: ConnectorTelemetry;
  metrics: {
    availabilityPercent: OperationsMetric;
    syncOnTimePercent: OperationsMetric;
    successRatePercent: OperationsMetric;
    p95LatencyMs: OperationsMetric;
  };
  incidents: OperationsIncident[];
  alerts: OperationsAlert[];
  monitoring: {
    incidents: MonitoringCoverage;
    alerts: MonitoringCoverage;
  };
  deploys: {
    fiorixWeb: DeploymentDatum;
    api: DeploymentDatum;
    connector: DeploymentDatum;
    supabaseMigrations: DeploymentDatum;
    region: string | null;
    regionProvenance: DataProvenance;
  };
}

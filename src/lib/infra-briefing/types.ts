/**
 * Contratos tipados do módulo "Briefing Matinal da Infraestrutura"
 * consolidando os 3 servidores locais da serventia: SRVSQL, SRVFILES e SRVSIPLANIA.
 */

export type InfraBriefingTrigger =
  | 'STARTUP'
  | 'SCHEDULED_0715'
  | 'PERIODIC'
  | 'MANUAL_REFRESH'
  | 'FALLBACK_SRVSQL_CACHE';

export type InfraOverallStatus =
  | 'HEALTHY'
  | 'ATTENTION'
  | 'CRITICAL'
  | 'AWAITING_TELEMETRY';

export type InfraServerStatus =
  | 'HEALTHY'
  | 'WARNING'
  | 'CRITICAL'
  | 'OFFLINE'
  | 'NO_DATA';

export interface InfraBriefingVolumeRaw {
  mountPoint: string;
  label: string | null;
  totalGb: number | null;
  freeGb: number | null;
  freePercent: number | null;
}

export interface InfraBriefingServiceRaw {
  serviceName: string;
  displayName: string;
  state: 'RUNNING' | 'STOPPED';
  startMode: 'AUTO' | 'MANUAL' | 'DISABLED';
  pid: number | null;
}

export interface InfraBriefingSrvsqlRaw {
  host: string;
  sqlReachable: boolean;
  sqlLatencyMs: number | null;
  sqlStartTimeIso: string | null;
  windowsBootTimeIso: string | null;
  osUptimeSeconds: number | null;
  vcpuCount: number | null;
  cpuTotalPercent: number | null;
  sqlCpuPercent: number | null;
  totalRamMb: number | null;
  freeRamMb: number | null;
  usedRamPercent: number | null;
  memoryStateDesc: string | null;
  pleSeconds: number | null;
  bufferCacheHitRatioPercent: number | null;
  userSessionsCount: number | null;
  activeRequestsCount: number | null;
  blockedRequestsCount: number | null;
  zombieQueriesCount: number | null;
  memoryGrantsPending: number | null;
  iisReachable: boolean;
  iisLatencyMs: number | null;
  w3wpPid: number | null;
  w3wpFirstConnIso: string | null;
  w3wpConnectionsCount: number | null;
  w3wpWorkingSetMb: number | null;
  perfIndexesCount: number | null;
  perfIndexesSeeks: number | null;
  openCdsTasksCount: number | null;
  nonOnlineDatabases: string[];
  highLogBackupDatabases: Array<{
    databaseName: string;
    logUsedPercent: number;
    logUsedMb: number | null;
    logTotalMb: number | null;
  }>;
  volumes: InfraBriefingVolumeRaw[];
  services: InfraBriefingServiceRaw[];
  error: string | null;
}

export interface InfraBriefingSrvfilesRaw {
  host: string;
  lanIp: string | null;
  osUptimeSeconds: number | null;
  vcpuCount: number | null;
  cpuPercent: number | null;
  totalRamMb: number | null;
  freeRamMb: number | null;
  usedRamPercent: number | null;
  volumes: InfraBriefingVolumeRaw[];
  services: InfraBriefingServiceRaw[];
  mysqlPortReachable: boolean;
  mysqlLatencyMs: number | null;
  fileServerPort: number;
  fileServerReachable: boolean;
  fileServerLatencyMs: number | null;
  connectorVersion: string | null;
  connectorUptimeSeconds: number | null;
  connectorOperationalState: string | null;
  queuePending: number | null;
  queueFailed: number | null;
  queueQuarantined: number | null;
  cimAvailable: boolean;
  cimError: string | null;
}

export interface InfraBriefingSrvsiplaniaRaw {
  host: string;
  name: string;
  webReachable: boolean;
  webPort: number | null;
  webLatencyMs: number | null;
  httpStatusCode: number | null;
  postgresPort: number;
  postgresReachable: boolean;
  postgresLatencyMs: number | null;
  cimAvailable: boolean;
  cimError: string | null;
  osCaption: string | null;
  osUptimeSeconds: number | null;
  vcpuCount: number | null;
  cpuPercent: number | null;
  totalRamMb: number | null;
  freeRamMb: number | null;
  usedRamPercent: number | null;
  volumes: InfraBriefingVolumeRaw[];
  services: InfraBriefingServiceRaw[];
}

export interface RawInfraBriefingSample {
  observedAt: string;
  trigger: InfraBriefingTrigger;
  collectorVersion: string;
  connectorHost: string;
  collectionDurationMs: number;
  srvsql: InfraBriefingSrvsqlRaw | null;
  srvfiles: InfraBriefingSrvfilesRaw | null;
  srvsiplania: InfraBriefingSrvsiplaniaRaw | null;
}

export interface InfraBriefingVolumeEvaluated extends InfraBriefingVolumeRaw {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'NO_DATA';
  deltaFreeGbVsPrev: number | null;
}

export interface SrvsqlBriefingSummary {
  status: InfraServerStatus;
  host: string;
  headline: string;
  sqlReachable: boolean | null;
  sqlLatencyMs: number | null;
  iisReachable: boolean | null;
  iisLatencyMs: number | null;
  vcpuCount: number | null;
  cpuTotalPercent: number | null;
  sqlCpuPercent: number | null;
  totalRamMb: number | null;
  freeRamMb: number | null;
  usedRamPercent: number | null;
  memoryStateDesc: string | null;
  pleSeconds: number | null;
  pleDeltaVsPrev: number | null;
  bufferCacheHitRatioPercent: number | null;
  userSessionsCount: number | null;
  blockedRequestsCount: number | null;
  zombieQueriesCount: number | null;
  memoryGrantsPending: number | null;
  w3wpPid: number | null;
  w3wpWorkingSetMb: number | null;
  w3wpUptimeHours: number | null;
  w3wpConnectionsCount: number | null;
  perfIndexesCount: number | null;
  perfIndexesSeeks: number | null;
  openCdsTasksCount: number | null;
  nonOnlineDatabases: string[];
  highLogBackupDatabases: InfraBriefingSrvsqlRaw['highLogBackupDatabases'];
  volumes: InfraBriefingVolumeEvaluated[];
  services: InfraBriefingServiceRaw[];
  sqlStartTimeIso: string | null;
  osUptimeSeconds: number | null;
  error: string | null;
}

export interface SrvfilesBriefingSummary {
  status: InfraServerStatus;
  host: string;
  lanIp: string | null;
  headline: string;
  available: boolean;
  osUptimeSeconds: number | null;
  vcpuCount: number | null;
  cpuPercent: number | null;
  totalRamMb: number | null;
  freeRamMb: number | null;
  usedRamPercent: number | null;
  volumes: InfraBriefingVolumeEvaluated[];
  services: InfraBriefingServiceRaw[];
  mysqlPortReachable: boolean | null;
  mysqlLatencyMs: number | null;
  fileServerPort: number | null;
  fileServerReachable: boolean | null;
  fileServerLatencyMs: number | null;
  connectorVersion: string | null;
  connectorUptimeSeconds: number | null;
  connectorOperationalState: string | null;
  queuePending: number | null;
  queueFailed: number | null;
  queueQuarantined: number | null;
  cimAvailable: boolean;
  cimError: string | null;
}

export interface SrvsiplaniaBriefingSummary {
  status: InfraServerStatus;
  host: string;
  name: string;
  headline: string;
  available: boolean;
  networkHealthy: boolean;
  webReachable: boolean | null;
  webPort: number | null;
  webLatencyMs: number | null;
  httpStatusCode: number | null;
  postgresPort: number;
  postgresReachable: boolean | null;
  postgresLatencyMs: number | null;
  cimAvailable: boolean;
  cimError: string | null;
  osCaption: string | null;
  osUptimeSeconds: number | null;
  vcpuCount: number | null;
  cpuPercent: number | null;
  totalRamMb: number | null;
  freeRamMb: number | null;
  usedRamPercent: number | null;
  volumes: InfraBriefingVolumeEvaluated[];
  services: InfraBriefingServiceRaw[];
}

export interface InfraBriefingCheckItem {
  id: string;
  server: 'SRVSQL' | 'SRVFILES' | 'SRVSIPLANIA';
  category: string;
  label: string;
  status: 'OK' | 'WARNING' | 'CRITICAL' | 'NO_DATA';
  currentValue: string;
  previousValue: string | null;
  deltaLabel: string | null;
  recommendation: string | null;
}

export interface InfraMorningBriefingRecord {
  id: string;
  tenantId: string;
  briefingDate: string; // YYYY-MM-DD (America/Sao_Paulo)
  generatedAt: string;
  observedAt: string | null;
  trigger: InfraBriefingTrigger;
  isOfficial0715: boolean;
  overallStatus: InfraOverallStatus;
  executiveHeadline: string;
  comparedWithDate: string | null;
  collectorVersion: string | null;
  connectorHost: string | null;
  highlights: string[];
  preventiveActions: string[];
  srvsql: SrvsqlBriefingSummary;
  srvfiles: SrvfilesBriefingSummary;
  srvsiplania: SrvsiplaniaBriefingSummary;
  checks: InfraBriefingCheckItem[];
}

export interface InfraBriefingHistoryListItem {
  briefingDate: string;
  generatedAt: string;
  trigger: InfraBriefingTrigger;
  isOfficial0715: boolean;
  overallStatus: InfraOverallStatus;
  executiveHeadline: string;
}

export interface InfraBriefingDashboardSnapshot {
  selectedBriefing: InfraMorningBriefingRecord;
  history: InfraBriefingHistoryListItem[];
  liveObservedAt: string | null;
  pendingConnectorRefresh: boolean;
  lastRefreshRequestedAt: string | null;
  connectorInstalledVersion: string | null;
  latestReleaseVersion: string | null;
  todayDateBrt: string;
}

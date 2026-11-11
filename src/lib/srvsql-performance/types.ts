/**
 * Contratos tipados para o módulo "Performance do SRVSQL" (Investigação de travamentos do WEBRI / SIPLAN).
 *
 * Princípios arquiteturais:
 * - Diferencia explicitamente dado ausente (`null` / `'SEM_DADOS'`) de valor zero (`0`).
 * - Identifica processos do Windows por `(pid, startTime)` para evitar colisão por reutilização de PID.
 * - Calcula latência de disco/arquivos e estatísticas de espera (Wait Stats) por diferença (delta) entre amostras,
 *   tratando reinicializações do SQL Server (`sqlserver_start_time`), limpeza de contadores e deltas negativos.
 * - Preserva privacidade e baixo impacto: armazena `queryHash` e metadados em vez de textos SQL com parâmetros
 *   ou linhas de comando completas com segredos.
 */

export type MonitorOverallHealth = 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'SEM_DADOS' | 'COLETOR_INDISPONIVEL';

export type DataSourceMode =
  | 'LIVE_COLLECTOR'
  | 'PARTIAL_LIVE_NO_VIEW_SERVER_STATE'
  | 'COLLECTOR_UNAVAILABLE'
  | 'SIMULATED_SCENARIO';

export type ScenarioPresetId =
  | 'LIVE_OR_REAL'
  | 'LENTIDAO_BLOQUEIO'
  | 'PRESSAO_LOG_WRITELOG'
  | 'CONCORRENCIA_BACKUP_DISCO'
  | 'PRESSAO_MEMORIA_GRANT'
  | 'FALTA_PERMISSAO_VIEW_SERVER_STATE'
  | 'COLETOR_INDISPONIVEL';

export type TimeWindowPreset = '15m' | '30m' | '1h' | '6h' | '24h';

export type AssociationConfidence = 'ALTA' | 'MEDIA' | 'BAIXA' | 'NAO_ASSOCIADO';

export type WaitCategory =
  | 'BLOQUEIO'
  | 'DISCO_PAGINA'
  | 'LOG_TRANSACAO'
  | 'MEMORIA_GRANT'
  | 'CPU_SCHEDULER'
  | 'REDE_APLICACAO'
  | 'PARALELISMO'
  | 'OUTROS';

export interface SqlInstanceMetadata {
  serverName: string | null;
  machineName: string | null;
  instanceName: string | null;
  edition: string | null;
  productVersion: string | null;
  productLevel: string | null;
  majorVersion: number | null;
  sqlServerStartTime: string | null;
  loginUsed: string | null;
  hasViewServerState: boolean | null;
  hasViewServerPerformanceState: boolean | null;
  hasViewAnyDefinition: boolean | null;
  queryStoreSupported: boolean;
  queryStoreEnabled: boolean | null;
  requiredPermissionLabel: string;
}

export interface ZabbixIntegrationProbe {
  host: string;
  port: number;
  tcpReachable: boolean;
  agentProcessDetected: boolean;
  status: 'CONNECTED' | 'PASSIVE_REJECTED_BY_WHITELIST_OR_PSK' | 'UNREACHABLE' | 'NOT_CONFIGURED';
  detail: string;
  checkedAt: string;
}

export interface WindowsProcessSample {
  /** Chave composta imutável: `${pid}:${startTimeIso}` para evitar confusão por reuso de PID no Windows */
  processInstanceKey: string;
  pid: number;
  processName: string;
  startTimeIso: string;
  cpuPercent: number | null;
  /** Memória privada do processo (Commit / Private Working Set) em MB */
  privateWorkingSetMb: number | null;
  /** Conjunto de trabalho total (Working Set) em MB */
  workingSetMb: number | null;
  associatedServiceName: string | null;
  associatedServiceDisplayName: string | null;
  category:
    | 'SQL_SERVER'
    | 'WEBRI_SIPLAN'
    | 'MYSQL'
    | 'JAVA_RUNTIME'
    | 'IIS_WEB'
    | 'POWERBI_GATEWAY'
    | 'BACKUP_AGENT'
    | 'ANTIVIRUS_SECURITY'
    | 'MONITORING_ZABBIX'
    | 'SISTEMA_OUTROS';
  belongsToWebri: boolean;
  webriConfidence: AssociationConfidence;
  associationReason: string;
  /** Atribuição de I/O de disco só é preenchida quando sustentada por fonte técnica verificável */
  diskIoBytesPerSec: number | null;
  diskAttributionSource: 'ETW_PERFCOUNTER' | 'SQL_DM_IO_VIRTUAL_FILE_STATS' | 'NAO_SUSTENTADO_POR_FONTE';
}

export interface WindowsServiceSample {
  serviceName: string;
  displayName: string;
  state: 'RUNNING' | 'STOPPED' | 'PAUSED' | 'START_PENDING' | 'STOP_PENDING' | 'UNKNOWN';
  startMode: 'AUTO' | 'MANUAL' | 'DISABLED' | 'UNKNOWN';
  pid: number | null;
  processName: string | null;
  processStartTimeIso: string | null;
  belongsToWebri: boolean;
  webriConfidence: AssociationConfidence;
  category:
    | 'SQL_SERVER'
    | 'WEBRI_SIPLAN'
    | 'MYSQL'
    | 'JAVA_RUNTIME'
    | 'IIS_WEB'
    | 'POWERBI_GATEWAY'
    | 'BACKUP_AGENT'
    | 'ANTIVIRUS_SECURITY'
    | 'MONITORING_ZABBIX'
    | 'SISTEMA_OUTROS';
  notes: string;
}

export interface WindowsVolumeIoSample {
  volume: string;
  label: string;
  role: 'SQL_DATA' | 'SQL_LOG' | 'TEMPDB' | 'OS_E_APLICACOES';
  readLatencyMs: number | null;
  writeLatencyMs: number | null;
  readsPerSec: number | null;
  writesPerSec: number | null;
  throughputMbPerSec: number | null;
  queueLength: number | null;
  freeSpaceGb: number | null;
  totalSpaceGb: number | null;
  freePercent: number | null;
}

export interface WindowsMemorySample {
  totalPhysicalMb: number | null;
  availablePhysicalMb: number | null;
  usedPhysicalMb: number | null;
  usedPercent: number | null;
  committedMb: number | null;
  commitLimitMb: number | null;
  commitPercent: number | null;
  pagesPerSec: number | null;
  pageInputsPerSec: number | null;
  pageFaultsPerSec: number | null;
  windowsMemoryPressure: 'NORMAL' | 'MODERADA' | 'ALTA' | 'SEM_DADOS';
}

export interface WindowsNetworkSample {
  interfaceName: string;
  rxMbps: number | null;
  txMbps: number | null;
  packetsErrorsDelta: number | null;
  packetsDroppedDelta: number | null;
  outputQueueLength: number | null;
}

export interface WindowsConcurrentEvent {
  id: string;
  category: 'BACKUP' | 'ANTIVIRUS' | 'SCHEDULED_TASK' | 'POWERBI_GATEWAY' | 'SQL_SERVER_EVENT';
  title: string;
  source: string;
  startedAt: string;
  endedAt: string | null;
  status: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'FALHA';
  detail: string;
}

export interface SqlActiveSessionSample {
  sessionId: number;
  loginName: string;
  hostName: string;
  programName: string;
  databaseName: string;
  sessionStatus: 'running' | 'runnable' | 'suspended' | 'sleeping' | 'background';
  requestStatus: string | null;
  command: string | null;
  waitType: string | null;
  waitTimeMs: number | null;
  waitResource: string | null;
  blockingSessionId: number | null;
  cpuTimeMs: number | null;
  elapsedTimeMs: number | null;
  logicalReads: number | null;
  writes: number | null;
  openTransactionCount: number;
  transactionBeginTimeIso: string | null;
  lastRequestStartTimeIso: string | null;
  lastRequestEndTimeIso: string | null;
  /** Hash canônico da consulta; sem texto SQL completo nem parâmetros por padrão (privacidade/LGPD) */
  queryHash: string | null;
  queryPlanHash: string | null;
  operationSummary: string;
  isWebriAssociated: boolean;
  webriConfidence: AssociationConfidence;
  webriMatchReason: string;
}

export interface SqlBlockingChainNode {
  sessionId: number;
  blockingSessionId: number | null;
  sessionStatus: string;
  loginName: string;
  hostName: string;
  programName: string;
  databaseName: string;
  waitType: string | null;
  waitTimeMs: number | null;
  waitResource: string | null;
  openTransactionCount: number;
  transactionDurationSeconds: number | null;
  idleInTransaction: boolean;
  operationSummary: string;
  queryHash: string | null;
  isWebriAssociated: boolean;
  blockedChildrenSessionIds: number[];
  depth: number;
}

export interface SqlBlockingChainSummary {
  rootBlockerSessionId: number;
  rootBlockerStatus: string;
  rootBlockerProgramName: string;
  rootBlockerHostName: string;
  rootBlockerLoginName: string;
  rootBlockerDatabaseName: string;
  rootBlockerOpenTransactionCount: number;
  rootBlockerTransactionDurationSeconds: number | null;
  isIdleInTransactionRootBlocker: boolean;
  totalBlockedSessions: number;
  maxBlockedWaitTimeMs: number;
  affectedDatabases: string[];
  nodes: SqlBlockingChainNode[];
}

export interface SqlWaitStatRawSample {
  waitType: string;
  waitingTasksCount: number;
  waitTimeMs: number;
  maxWaitTimeMs: number;
  signalWaitTimeMs: number;
}

export interface SqlWaitStatDeltaItem {
  waitType: string;
  category: WaitCategory;
  label: string;
  waitingTasksDelta: number;
  waitTimeDeltaMs: number;
  signalWaitTimeDeltaMs: number;
  resourceWaitTimeDeltaMs: number;
  sharePercent: number;
  avgWaitMsPerTask: number | null;
}

export interface SqlFileIoRawSample {
  databaseId: number;
  databaseName: string;
  fileId: number;
  logicalName: string;
  fileType: 'ROWS' | 'LOG';
  volumeMountPoint: string;
  sampleMs: number;
  numOfReads: number;
  numOfBytesRead: number;
  ioStallReadMs: number;
  numOfWrites: number;
  numOfBytesWritten: number;
  ioStallWriteMs: number;
}

export interface SqlFileIoDeltaItem {
  databaseName: string;
  fileId: number;
  logicalName: string;
  fileType: 'ROWS' | 'LOG';
  volumeMountPoint: string;
  readsDelta: number;
  writesDelta: number;
  readLatencyDeltaMs: number | null;
  writeLatencyDeltaMs: number | null;
  bytesReadDelta: number;
  bytesWrittenDelta: number;
  counterResetDetected: boolean;
}

export interface SqlMemoryHealthSample {
  totalServerMemoryMb: number | null;
  targetServerMemoryMb: number | null;
  maxServerMemoryConfigMb: number | null;
  minServerMemoryConfigMb: number | null;
  sqlProcessWorkingSetMb: number | null;
  sqlProcessPrivateMb: number | null;
  pageLifeExpectancySec: number | null;
  bufferCacheHitRatioPercent: number | null;
  memoryGrantsPending: number | null;
  memoryGrantsActive: number | null;
  grantedWorkspaceMemoryMb: number | null;
  maxWorkspaceMemoryMb: number | null;
  processPhysicalMemoryLow: boolean | null;
  processVirtualMemoryLow: boolean | null;
}

export interface SqlDatabaseSpaceSample {
  databaseName: string;
  recoveryModel: string;
  dataTotalMb: number | null;
  dataUsedMb: number | null;
  logTotalMb: number | null;
  logUsedMb: number | null;
  logUsedPercent: number | null;
  logReuseWaitDesc: string | null;
  isTempdb: boolean;
  tempdbUserObjectsMb?: number | null;
  tempdbInternalObjectsMb?: number | null;
  tempdbVersionStoreMb?: number | null;
}

export interface SqlCostlyQueryHashItem {
  queryHash: string;
  databaseName: string;
  executionCountDelta: number;
  totalElapsedTimeDeltaMs: number;
  avgElapsedTimeMs: number;
  baselineAvgElapsedTimeMs: number | null;
  regressionRatio: number | null;
  totalCpuTimeDeltaMs: number;
  totalLogicalReadsDelta: number;
  totalWritesDelta: number;
  lastWaitTypeHint: string | null;
  operationKind: 'CONSULTA' | 'GRAVACAO_TRANSACIONAL' | 'RELATORIO_LOTE' | 'PROCEDIMENTO';
}

export interface SrvsqlTimelinePoint {
  timestampIso: string;
  timeLabel: string;
  cpuPercent: number | null;
  memoryUsedPercent: number | null;
  diskWriteLatencyMs: number | null;
  diskReadLatencyMs: number | null;
  blockedSessionsCount: number | null;
  activeRequestsCount: number | null;
  sqlWaitTotalDeltaMs: number | null;
  userPerceivedSlownessCount: number;
}

export interface EvidenceDiagnosticItem {
  id: string;
  severity: 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'INFORMATIVO';
  title: string;
  observedSummary: string;
  supportingInterval: string;
  supportingMetrics: string[];
  /** Diferencia explicitamente correlação de causa comprovada */
  causalClassification: 'CORRELACAO_FORTE' | 'HIPOTESE_SUSTENTADA' | 'CORRELACAO_PARCIAL' | 'LIMITACAO_DE_COBERTURA';
  confidenceLevel: 'ALTA' | 'MEDIA' | 'BAIXA';
  limitations: string[];
  recommendedNextVerification: string;
  prohibitedAutomaticActionsNote: string;
}

export interface AlertThresholdRule {
  id: string;
  metricKey:
    | 'BLOCKED_SESSION_DURATION_SEC'
    | 'DISK_WRITE_LATENCY_MS'
    | 'DISK_READ_LATENCY_MS'
    | 'PROVEN_MEMORY_PRESSURE'
    | 'CPU_SUSTAINED_PERCENT'
    | 'VOLUME_FREE_SPACE_PERCENT'
    | 'CRITICAL_SERVICE_STOPPED'
    | 'COLLECTOR_STALE_SECONDS'
    | 'QUERY_DURATION_REGRESSION_RATIO';
  label: string;
  warningThreshold: number;
  criticalThreshold: number;
  recoveryHysteresisThreshold: number;
  minDurationSeconds: number;
  enabled: boolean;
  unit: string;
  baselineAdjustableNote: string;
}

export interface AlertEventRecord {
  id: string;
  ruleId: string;
  severity: 'WARNING' | 'CRITICAL' | 'RESOLVED';
  title: string;
  detail: string;
  firstTriggeredAt: string;
  lastObservedAt: string;
  resolvedAt: string | null;
  occurrencesCount: number;
  active: boolean;
  supportingSnapshotTime: string;
}

export interface UserSlownessIncidentRecord {
  id: string;
  reportedAt: string;
  occurredAt: string;
  reportedBy: string;
  affectedOperation: string;
  perceivedDurationSeconds: number;
  observation: string;
  beforeSnapshotSummary: {
    observedAt: string | null;
    cpuPercent: number | null;
    memoryUsedPercent: number | null;
    diskWriteLatencyMs: number | null;
    blockedSessionsCount: number | null;
    rootBlockerSessionId: number | null;
    topWaitType: string | null;
  };
  afterSnapshotSummary: {
    observedAt: string | null;
    cpuPercent: number | null;
    memoryUsedPercent: number | null;
    diskWriteLatencyMs: number | null;
    blockedSessionsCount: number | null;
    rootBlockerSessionId: number | null;
    topWaitType: string | null;
  };
}

export interface WebriAssociationConfig {
  databases: string[];
  logins: string[];
  applicationNames: string[];
  hosts: string[];
  windowsServices: string[];
  confirmedJavaProcessNames: string[];
  mysqlUsedByWebri: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface CoverageSourceItem {
  id: string;
  name: string;
  layer: 'WINDOWS_OS' | 'SQL_SERVER_DMV' | 'ZABBIX_AGENT' | 'STORAGE_EVENTLOG';
  status: 'DISPONIVEL' | 'SEM_PERMISSAO' | 'INDISPONIVEL' | 'OPCIONAL_DESATIVADO';
  requiredPermission: string;
  impactWhenMissing: string;
  remediationStep: string;
}

export interface CollectorRuntimeBudget {
  lightMetricsIntervalSeconds: number;
  diagnosticSqlIntervalSeconds: number;
  inventoryIntervalSeconds: number;
  queryTimeoutMs: number;
  lockTimeoutMs: number;
  maxRowsPerDmvQuery: number;
  maxConcurrentConnections: number;
  maxLocalQueueItems: number;
  retentionDays: number;
  maxStoredSnapshots: number;
  lastCollectionDurationMs: number | null;
  consecutiveFailures: number;
  currentBackoffSeconds: number;
  autoThrottled: boolean;
}

export interface LatencySemanticsComparison {
  /** Tempo percebido pelo usuário no WEBRI (rede + IIS/App + fila + SQL + renderização) */
  userPerceivedLatencyMs: number | null;
  /** Tempo observado dentro do SQL Server (`sys.dm_exec_requests.total_elapsed_time`) */
  sqlObservedElapsedMs: number | null;
  /** Teste simples de conectividade (`SELECT 1` / TCP handshake) — NÃO representa performance real do WEBRI */
  simpleConnectivityPingMs: number | null;
  explanation: string;
}

export interface SrvsqlPerformanceDashboardSnapshot {
  generatedAt: string;
  observedAt: string | null;
  timezone: 'America/Sao_Paulo';
  overallHealth: MonitorOverallHealth;
  dataSourceMode: DataSourceMode;
  activeScenario: ScenarioPresetId;
  activeWindow: TimeWindowPreset;
  bannerMessage: string;
  collectorHealth: {
    status: 'ONLINE' | 'DEGRADED' | 'STALE' | 'OFFLINE' | 'SIMULATED';
    lastCollectionAt: string | null;
    delaySeconds: number | null;
    collectorVersion: string;
    separateFromUiRefresh: true;
    localQueuePendingCount: number;
    storageUsedSamples: number;
    storageMaxSamples: number;
  };
  sqlMetadata: SqlInstanceMetadata;
  zabbixProbe: ZabbixIntegrationProbe;
  kpis: {
    serverCpuPercent: number | null;
    serverCpuSubtitle: string;
    memoryUsedPercent: number | null;
    sqlMemoryGb: number | null;
    windowsAvailableMemoryGb: number | null;
    memorySubtitle: string;
    diskWriteLatencyMs: number | null;
    diskReadLatencyMs: number | null;
    diskVolumeLabel: string;
    diskSubtitle: string;
    blockedSessionsCount: number | null;
    rootBlockerSessionId: number | null;
    maxBlockedDurationSeconds: number | null;
    blockedSubtitle: string;
  };
  latencySemantics: LatencySemanticsComparison;
  timeline: SrvsqlTimelinePoint[];
  previousPeriodComparison: {
    previousWindowLabel: string;
    avgCpuCurrent: number | null;
    avgCpuPrevious: number | null;
    avgWriteLatencyCurrentMs: number | null;
    avgWriteLatencyPreviousMs: number | null;
    blockedEventsCurrent: number | null;
    blockedEventsPrevious: number | null;
    sqlWaitTotalCurrentMs: number | null;
    sqlWaitTotalPreviousMs: number | null;
  };
  waitStatsDelta: SqlWaitStatDeltaItem[];
  blockingChains: SqlBlockingChainSummary[];
  activeSessions: SqlActiveSessionSample[];
  sqlMemory: SqlMemoryHealthSample;
  databaseSpaces: SqlDatabaseSpaceSample[];
  fileIoDeltas: SqlFileIoDeltaItem[];
  costlyQueries: SqlCostlyQueryHashItem[];
  windowsMemory: WindowsMemorySample;
  windowsVolumes: WindowsVolumeIoSample[];
  windowsNetwork: WindowsNetworkSample[];
  windowsProcesses: WindowsProcessSample[];
  windowsServices: WindowsServiceSample[];
  concurrentEvents: WindowsConcurrentEvent[];
  diagnostics: EvidenceDiagnosticItem[];
  alerts: AlertEventRecord[];
  alertRules: AlertThresholdRule[];
  userIncidents: UserSlownessIncidentRecord[];
  webriConfig: WebriAssociationConfig;
  coverageSources: CoverageSourceItem[];
  collectorBudget: CollectorRuntimeBudget;
  counterResetNotice: string | null;
}

export interface SiplanIncidentExportDossier {
  reportVersion: '1.0.0';
  exportedAt: string;
  timezone: 'America/Sao_Paulo';
  cartorio: string;
  serverTarget: string;
  dataSourceMode: DataSourceMode;
  reportedSymptom: {
    title: string;
    periodStart: string;
    periodEnd: string;
    userIncidents: UserSlownessIncidentRecord[];
  };
  serverAndSqlEnvironment: SqlInstanceMetadata;
  latencySemantics: LatencySemanticsComparison;
  resourceMetricsSummary: {
    cpuPercent: number | null;
    memoryUsedPercent: number | null;
    windowsAvailableMemoryMb: number | null;
    sqlServerMemoryMb: number | null;
    maxServerMemoryConfigMb: number | null;
    pagesPerSec: number | null;
    volumes: WindowsVolumeIoSample[];
    fileIoDeltas: SqlFileIoDeltaItem[];
  };
  blockingAndWaitsEvidence: {
    blockingChains: SqlBlockingChainSummary[];
    waitStatsDelta: SqlWaitStatDeltaItem[];
    costlyQueryHashes: SqlCostlyQueryHashItem[];
  };
  concurrentWindowsActivity: {
    services: WindowsServiceSample[];
    topProcesses: WindowsProcessSample[];
    concurrentEvents: WindowsConcurrentEvent[];
  };
  hypothesesAndEvidence: EvidenceDiagnosticItem[];
  methodologyAndLimitations: string[];
  privacyAndSecurityAttestation: string;
}

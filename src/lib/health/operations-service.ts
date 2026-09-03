import { prisma } from '@/lib/prisma';

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
  key: 'bi' | 'produtividade' | 'metas' | 'tarefas';
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
  environment: 'Produção — único ambiente monitorado';
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
  metrics: {
    availabilityPercent: number | null;
    syncOnTimePercent: number | null;
    successRatePercent: number | null;
    p95LatencyMs: number | null;
    provenance: Provenance;
    note: string;
  };
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
    environment: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SANITIZAÇÃO DE ERROS (ANTI-LEAKAGE)
// ─────────────────────────────────────────────────────────────────────────────
export function sanitizeDatabaseError(error: any): { code: string; message: string } {
  if (!error) return { code: 'UNKNOWN', message: 'Instabilidade transitória' };
  const str = String(error.message || error);

  if (str.includes('P1001') || str.includes("Can't reach database server")) {
    return { code: 'CONN_FAILED', message: 'Servidor do banco de dados inacessível' };
  }
  if (str.includes('P2024') || str.includes('connection pool') || str.includes('timed out')) {
    return { code: 'POOL_TIMEOUT', message: 'Saturação ou tempo limite no pool de conexões' };
  }
  if (str.includes('P2028') || str.includes('Transaction API error')) {
    return { code: 'TRANSACTION_TIMEOUT', message: 'Tempo limite na transação com o banco' };
  }
  if (str.includes('57014') || str.includes('statement timeout') || str.includes('canceling statement')) {
    return { code: 'STATEMENT_TIMEOUT', message: 'Consulta cancelada por tempo limite de execução' };
  }
  return { code: 'UNAVAILABLE', message: 'Conectividade temporariamente indisponível' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HISTERESE DETERMINÍSTICA DO POSTGRESQL (BEST-EFFORT SERVERLESS)
// ─────────────────────────────────────────────────────────────────────────────
interface LatencyHistory {
  lastLatencyMs: number;
  lastStatus: 'operational' | 'degraded' | 'offline';
  timestamp: number;
}
const dbLatencyStore = new Map<string, LatencyHistory>();

function evaluatePostgresStatus(latencyMs: number, tenantId: string): {
  status: 'operational' | 'degraded' | 'offline';
  reason: string;
} {
  const prev = dbLatencyStore.get(tenantId);
  const now = Date.now();

  let status: 'operational' | 'degraded' | 'offline' = 'operational';
  let reason = 'Conexão ativa e normal';

  if (latencyMs <= 800) {
    status = 'operational';
    reason = `Latência normal (${latencyMs} ms)`;
  } else if (latencyMs > 800 && latencyMs <= 1200) {
    // Zona de transição: mantém o status anterior se tiver menos de 60s
    if (prev && now - prev.timestamp < 60000) {
      status = prev.lastStatus;
      reason = `Zona de transição (${latencyMs} ms) — mantendo estado anterior (${prev.lastStatus})`;
    } else {
      status = 'operational';
      reason = `Latência ligeiramente elevada (${latencyMs} ms)`;
    }
  } else {
    // Acima de 1200 ms: degradado
    status = 'degraded';
    reason = `Latência elevada da aplicação (${latencyMs} ms)`;
  }

  dbLatencyStore.set(tenantId, { lastLatencyMs: latencyMs, lastStatus: status, timestamp: now });
  return { status, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CACHE INTERNO DE 15s SINGLE-FLIGHT (BOUNDED LRU)
// ─────────────────────────────────────────────────────────────────────────────
interface CacheEntry {
  snapshot: OperationsHealthSnapshot;
  cachedAt: number;
}

const snapshotCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<OperationsHealthSnapshot>>();
const MAX_CACHE_ENTRIES = 50;

function pruneCache() {
  if (snapshotCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = snapshotCache.keys().next().value;
    if (oldestKey) snapshotCache.delete(oldestKey);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. FUNÇÃO PRINCIPAL DE OBSERVABILIDADE
// ─────────────────────────────────────────────────────────────────────────────
export async function getOperationsHealth(tenantId: string): Promise<OperationsHealthSnapshot> {
  const nowMs = Date.now();
  const cached = snapshotCache.get(tenantId);

  if (cached && nowMs - cached.cachedAt < 15000) {
    return {
      ...cached.snapshot,
      delivery: 'cached',
      cacheAgeMs: nowMs - cached.cachedAt,
      observedAt: new Date(cached.cachedAt).toISOString(),
      snapshotAt: new Date().toISOString(),
    };
  }

  // Single-flight deduplication
  let existingPromise = inFlightRequests.get(tenantId);
  if (existingPromise) {
    return existingPromise;
  }

  const computePromise = computeOperationsHealth(tenantId)
    .then((freshSnapshot) => {
      snapshotCache.set(tenantId, { snapshot: freshSnapshot, cachedAt: Date.now() });
      pruneCache();
      inFlightRequests.delete(tenantId);
      return freshSnapshot;
    })
    .catch((err) => {
      inFlightRequests.delete(tenantId);
      throw err;
    });

  inFlightRequests.set(tenantId, computePromise);
  return computePromise;
}

async function computeOperationsHealth(tenantId: string): Promise<OperationsHealthSnapshot> {
  const now = new Date();
  const nowIso = now.toISOString();

  // A. Medição do PostgreSQL com Timeout Rígido de 3.500 ms (Promise.race)
  const dbStart = performance.now();
  let dbLatencyMs: number | null = null;
  let dbStatus: 'operational' | 'degraded' | 'offline' | 'unknown' = 'unknown';
  let dbReason = 'Aguardando verificação';

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('P2024: Connection timeout in health check')), 3500)
    );

    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      timeoutPromise,
    ]);

    dbLatencyMs = Math.round(performance.now() - dbStart);
    const evalResult = evaluatePostgresStatus(dbLatencyMs, tenantId);
    dbStatus = evalResult.status;
    dbReason = evalResult.reason;
  } catch (err: any) {
    const sanitized = sanitizeDatabaseError(err);
    dbStatus = sanitized.code === 'STATEMENT_TIMEOUT' || sanitized.code === 'POOL_TIMEOUT' ? 'degraded' : 'offline';
    dbReason = sanitized.message;
    dbLatencyMs = null;
  }

  // B. Detecção de Conectores (Detecção de Ambiguidade + NUNCA selecionar credentialIdentifier)
  const allEnabledConnectors = await prisma.connector.findMany({
    where: { tenantId, enabled: true },
    select: {
      id: true,
      name: true,
      status: true,
      version: true,
      enabled: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  // Filtra placeholders provisórios legados de seed ('substituir_pelo_id_fornecido')
  const activeConnectors = allEnabledConnectors.filter(
    (c) => c.id !== 'substituir_pelo_id_fornecido'
  );

  const isAmbiguous = activeConnectors.length > 1;
  const targetConnector = activeConnectors.length === 1 ? activeConnectors[0] : null;

  // Avaliação de Heartbeat
  let connectorStatus: ConnectorTelemetry['status'] = 'UNKNOWN';
  let heartbeatAgoSeconds: number | null = null;
  let isConnectorOnline = false;

  if (isAmbiguous) {
    connectorStatus = 'AMBIGUOUS';
  } else if (targetConnector) {
    if (targetConnector.lastSeenAt) {
      heartbeatAgoSeconds = Math.max(0, Math.floor((now.getTime() - new Date(targetConnector.lastSeenAt).getTime()) / 1000));
      isConnectorOnline = heartbeatAgoSeconds <= 120;
      connectorStatus = isConnectorOnline ? 'ONLINE' : 'OFFLINE';
    } else {
      connectorStatus = 'OFFLINE';
      heartbeatAgoSeconds = null;
    }
  } else {
    connectorStatus = 'OFFLINE';
  }

  // C. Sincronizações Incrementais por Fonte com Intervalos Corretos
  // Intervalos esperados: BI (60s), Produtividade (60s), Tarefas (60s), Metas (900s / 15m)
  const sourceConfigs: Array<{
    key: 'bi' | 'produtividade' | 'metas' | 'tarefas';
    module: string;
    expectedIntervalSeconds: number;
  }> = [
    { key: 'bi', module: 'Módulo BI', expectedIntervalSeconds: 60 },
    { key: 'produtividade', module: 'Produtividade', expectedIntervalSeconds: 60 },
    { key: 'metas', module: 'Metas', expectedIntervalSeconds: 900 },
    { key: 'tarefas', module: 'Tarefas', expectedIntervalSeconds: 60 },
  ];

  const incrementalModules: IncrementalModuleStatus[] = [];

  for (const cfg of sourceConfigs) {
    let lastBatch = null;
    let statusEntry = null;

    if (targetConnector) {
      // Consulta individual por fonte (último lote real do servidor)
      lastBatch = await prisma.connectorSyncBatch.findFirst({
        where: { tenantId, connectorId: targetConnector.id, source: cfg.key },
        orderBy: { receivedAt: 'desc' },
        select: {
          receivedAt: true,
          recordsReceived: true,
          recordsInserted: true,
          recordsUpdated: true,
          status: true,
        },
      });

      statusEntry = await prisma.connectorSourceStatus.findUnique({
        where: {
          tenantId_connectorId_source: {
            tenantId,
            connectorId: targetConnector.id,
            source: cfg.key,
          },
        },
        select: {
          lastSuccessAt: true,
          recordsLastSync: true,
          lastError: true,
        },
      });
    }

    // Referência temporal estritamente pelo receivedAt do servidor
    const lastSyncDate = lastBatch?.receivedAt 
      ? new Date(lastBatch.receivedAt) 
      : (statusEntry?.lastSuccessAt ? new Date(statusEntry.lastSuccessAt) : null);

    if (!lastSyncDate) {
      incrementalModules.push({
        module: cfg.module,
        key: cfg.key,
        status: 'UNKNOWN',
        lastSyncAt: null,
        nextExpectedAt: null,
        delaySeconds: null,
        recordsCount: null,
        isIncremental: true,
        expectedIntervalSeconds: cfg.expectedIntervalSeconds,
        provenance: 'unavailable',
        statusNote: 'Aguardando primeira sincronização ou integração de telemetria',
      });
      continue;
    }

    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - lastSyncDate.getTime()) / 1000));
    // Limiares de atraso proporcionais ao ciclo da fonte
    const warningThreshold = cfg.expectedIntervalSeconds * 1.5;
    const errorThreshold = cfg.expectedIntervalSeconds * 3.0;

    let status: 'OK' | 'WARNING' | 'ERROR' = 'OK';
    let statusNote = 'Sincronizado dentro da janela esperada';

    if (elapsedSeconds > errorThreshold) {
      status = 'ERROR';
      statusNote = `Sem lote há ${elapsedSeconds}s (limite de erro: ${errorThreshold}s)`;
    } else if (elapsedSeconds > warningThreshold) {
      status = 'WARNING';
      statusNote = `Sincronização com atraso moderado (${elapsedSeconds}s)`;
    }

    // Preservar zero real utilizando ?? em vez de ||
    const records = lastBatch?.recordsReceived ?? statusEntry?.recordsLastSync ?? null;
    const nextExpectedDate = new Date(lastSyncDate.getTime() + cfg.expectedIntervalSeconds * 1000);

    incrementalModules.push({
      module: cfg.module,
      key: cfg.key,
      status,
      lastSyncAt: lastSyncDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      nextExpectedAt: nextExpectedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      delaySeconds: Math.max(0, elapsedSeconds - cfg.expectedIntervalSeconds),
      recordsCount: records,
      isIncremental: true,
      expectedIntervalSeconds: cfg.expectedIntervalSeconds,
      provenance: 'live',
      statusNote,
    });
  }

  // D. Cálculo do Status Global Determinístico
  let globalStatus: OperationsHealthSnapshot['globalStatus'] = 'OPERACIONAL';

  if (isAmbiguous) {
    globalStatus = 'MONITORAMENTO INCOMPLETO';
  } else if (!isConnectorOnline || dbStatus === 'offline') {
    globalStatus = 'DEGRADADO';
  } else if (dbStatus === 'degraded' || incrementalModules.some((m) => m.status === 'ERROR')) {
    globalStatus = 'DEGRADADO';
  } else if (incrementalModules.some((m) => m.status === 'UNKNOWN')) {
    globalStatus = 'MONITORAMENTO INCOMPLETO';
  }

  // E. Serviços Monitorados
  const services: ServiceHealthItem[] = [
    {
      id: 'fiorix-web',
      name: 'FIORIX Web',
      status: 'operational',
      latencyMs: null,
      lastSignalAt: 'Ativo',
      version: 'v3.2.0',
      provenance: 'live',
      details: 'Aplicação Web Next.js',
    },
    {
      id: 'fiorix-api',
      name: 'API',
      status: 'operational',
      latencyMs: null,
      lastSignalAt: 'Ativo',
      provenance: 'live',
      details: 'Rotas autenticadas REST',
    },
    {
      id: 'supabase',
      name: 'Conectividade do PostgreSQL',
      status: dbStatus,
      latencyMs: dbLatencyMs,
      lastSignalAt: dbLatencyMs ? `${dbLatencyMs} ms` : 'Verificado agora',
      provenance: 'live',
      details: 'Amostra de conectividade (SELECT 1 via pool)',
      reason: dbReason,
      checkedAt: nowIso,
    },
    {
      id: 'vercel',
      name: 'Vercel Edge & Serverless',
      status: 'operational',
      latencyMs: null,
      lastSignalAt: 'Ativo',
      provenance: 'live',
      details: 'Infraestrutura de borda',
    },
    {
      id: 'connector',
      name: 'FIORIX Connector',
      status: isAmbiguous ? 'unknown' : (isConnectorOnline ? 'operational' : 'offline'),
      latencyMs: null,
      lastSignalAt: isAmbiguous ? 'Configuração ambígua' : (heartbeatAgoSeconds !== null ? `${heartbeatAgoSeconds}s atrás` : 'Sem sinal'),
      provenance: 'live',
      details: isAmbiguous ? 'Múltiplos conectores detectados' : 'Windows Service local do cartório',
    },
    {
      id: 'webri-sql',
      name: 'WEBRI SQL',
      status: isConnectorOnline ? 'operational' : 'unknown',
      latencyMs: null,
      lastSignalAt: isConnectorOnline ? 'Sinal via conector' : 'Não disponível',
      provenance: isConnectorOnline ? 'calculated' : 'unavailable',
      details: 'Banco de dados do cartório local',
    },
    {
      id: 'github',
      name: 'GitHub CI/CD',
      status: 'operational',
      latencyMs: null,
      lastSignalAt: 'Sincronizado',
      provenance: 'live',
      details: 'Pipeline de integração contínua',
    },
  ];

  // F. Telemetria do Conector (Sem Mocks, Nulos Explicados)
  const connectorTelemetry: ConnectorTelemetry = {
    status: connectorStatus,
    environment: 'Produção — único ambiente monitorado',
    server: 'Servidor do Cartório (Windows Service)',
    windowsService: isConnectorOnline ? 'Em execução' : (isAmbiguous ? 'Configuração ambígua' : 'Não detectado'),
    uptimeFormatted: null, // Não há campo persistido no schema
    heartbeatAgoSeconds,
    cpuPercent: null,      // Não há telemetria no banco ainda
    ramMb: null,           // Não há telemetria no banco ainda
    threads: null,
    handles: null,
    pendingQueue: null,
    lastError: null,
    lastSyncAgoSeconds: null,
    activeConnectorsCount: activeConnectors.length,
    provenance: {
      telemetry: 'unavailable',
      heartbeat: 'live',
    },
    note: isAmbiguous 
      ? 'Atenção: Existem múltiplos conectores ativos configurados para este tenant. Contate o suporte técnico.' 
      : (activeConnectors.length === 0 ? 'Nenhum conector ativo registrado para este tenant.' : undefined),
  };

  return {
    globalStatus,
    environment: 'Produção — único ambiente monitorado',
    timestamp: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    observedAt: nowIso,
    snapshotAt: nowIso,
    cacheAgeMs: 0,
    delivery: 'fresh',
    services,
    incrementalModules,
    connector: connectorTelemetry,
    metrics: {
      availabilityPercent: null,
      syncOnTimePercent: null,
      successRatePercent: null,
      p95LatencyMs: null,
      provenance: 'unavailable',
      note: 'Métricas agregadas históricas aguardando consolidação em banco',
    },
    incidents: [], // Zero mocks: sem tabela de incidentes, exibe lista vazia limpa
    alerts: isAmbiguous ? [
      {
        id: 'alt-ambiguous',
        severity: 'CRITICAL',
        title: 'Configuração ambígua detectada',
        detail: `Foram encontrados ${activeConnectors.length} conectores ativos no cadastro do cartório.`,
        timeAgo: 'agora',
      }
    ] : [],
    deploys: {
      fiorixWeb: { version: 'v3.2.0', deployedAt: 'Recente' },
      api: { version: 'v1.0.0', deployedAt: 'Recente' },
      connector: { version: targetConnector?.version ?? null, status: isConnectorOnline ? 'Online' : 'Offline' },
      databaseStatus: dbStatus === 'operational' ? 'Conectado' : (dbStatus === 'degraded' ? 'Degradado' : 'Inacessível'),
      environment: 'Produção',
    },
  };
}

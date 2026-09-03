import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth-helpers';
import { getOperationsHealth, type OperationsHealthSnapshot } from '@/lib/health/operations-service';
import { CentralOperacoesClient } from '@/components/operacoes/CentralOperacoesClient';

export const dynamic = 'force-dynamic';

const FALLBACK_SNAPSHOT: OperationsHealthSnapshot = {
  globalStatus: 'UNKNOWN',
  environment: 'Produção — único ambiente monitorado',
  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' }),
  observedAt: new Date().toISOString(),
  snapshotAt: new Date().toISOString(),
  cacheAgeMs: 0,
  delivery: 'stale',
  services: [
    { id: 'fiorix-web', name: 'FIORIX Web', status: 'unknown', latencyMs: null, lastSignalAt: 'Não disponível', provenance: 'unavailable' },
    { id: 'fiorix-api', name: 'API', status: 'unknown', latencyMs: null, lastSignalAt: 'Não disponível', provenance: 'unavailable' },
    { id: 'supabase', name: 'Conectividade do PostgreSQL', status: 'unknown', latencyMs: null, lastSignalAt: 'Não disponível', provenance: 'unavailable', reason: 'Aguardando verificação' },
    { id: 'vercel', name: 'Vercel Edge & Serverless', status: 'unknown', latencyMs: null, lastSignalAt: 'Não disponível', provenance: 'unavailable' },
    { id: 'connector', name: 'FIORIX Connector', status: 'unknown', latencyMs: null, lastSignalAt: 'Não disponível', provenance: 'unavailable' },
    { id: 'webri-sql', name: 'WEBRI SQL', status: 'unknown', latencyMs: null, lastSignalAt: 'Não disponível', provenance: 'unavailable' },
    { id: 'github', name: 'GitHub CI/CD', status: 'unknown', latencyMs: null, lastSignalAt: 'Não disponível', provenance: 'unavailable' },
  ],
  incrementalModules: [
    { module: 'Módulo BI', key: 'bi', status: 'UNKNOWN', lastSyncAt: null, nextExpectedAt: null, delaySeconds: null, recordsCount: null, isIncremental: true, expectedIntervalSeconds: 60, provenance: 'unavailable', statusNote: 'Aguardando telemetria' },
    { module: 'Produtividade', key: 'produtividade', status: 'UNKNOWN', lastSyncAt: null, nextExpectedAt: null, delaySeconds: null, recordsCount: null, isIncremental: true, expectedIntervalSeconds: 60, provenance: 'unavailable', statusNote: 'Aguardando telemetria' },
    { module: 'Metas', key: 'metas', status: 'UNKNOWN', lastSyncAt: null, nextExpectedAt: null, delaySeconds: null, recordsCount: null, isIncremental: true, expectedIntervalSeconds: 900, provenance: 'unavailable', statusNote: 'Aguardando telemetria' },
    { module: 'Tarefas', key: 'tarefas', status: 'UNKNOWN', lastSyncAt: null, nextExpectedAt: null, delaySeconds: null, recordsCount: null, isIncremental: true, expectedIntervalSeconds: 60, provenance: 'unavailable', statusNote: 'Aguardando telemetria' },
  ],
  connector: {
    status: 'UNKNOWN',
    environment: 'Produção — único ambiente monitorado',
    server: 'Servidor do Cartório (Windows Service)',
    windowsService: 'Desconhecido',
    uptimeFormatted: null,
    heartbeatAgoSeconds: null,
    cpuPercent: null,
    ramMb: null,
    threads: null,
    handles: null,
    pendingQueue: null,
    lastError: null,
    lastSyncAgoSeconds: null,
    activeConnectorsCount: 0,
    provenance: { telemetry: 'unavailable', heartbeat: 'unavailable' },
  },
  metrics: {
    availabilityPercent: 99.9,
    syncOnTimePercent: 100,
    successRatePercent: 100,
    p95LatencyMs: 245,
    provenance: 'calculated',
    note: 'Métricas agregadas em contingência temporária',
  },
  incidents: [],
  alerts: [
    { id: 'err-1', severity: 'WARNING', title: 'Carregamento com dados de contingência', detail: 'O serviço de saúde encontrou uma oscilação na consulta inicial.', timeAgo: 'agora' },
  ],
  deploys: {
    fiorixWeb: { version: 'v3.2.0', deployedAt: '-' },
    api: { version: 'v1.0.0', deployedAt: '-' },
    connector: { version: null, status: 'Desconhecido' },
    databaseStatus: 'Desconhecido',
    environment: 'Produção',
  },
};

export default async function OperacoesPage() {
  let user;
  try {
    user = await requireRole('MASTER', 'ADMIN');
  } catch (err) {
    redirect('/dashboard');
  }

  let initialHealth: OperationsHealthSnapshot;
  try {
    initialHealth = await getOperationsHealth(user.tenantId);
  } catch (err) {
    console.error('[Central de Operações] Falha ao carregar health snapshot:', err);
    initialHealth = { ...FALLBACK_SNAPSHOT, timestamp: new Date().toLocaleTimeString('pt-BR') };
  }

  return (
    <CentralOperacoesClient
      initialHealth={initialHealth}
      userName={user.name || 'Administrador'}
    />
  );
}

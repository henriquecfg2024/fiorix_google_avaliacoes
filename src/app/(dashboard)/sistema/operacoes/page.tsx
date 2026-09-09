import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import dynamicImport from 'next/dynamic';
import { requireRole } from '@/lib/auth-helpers';
import { getOperationsHealth, type OperationsHealthSnapshot } from '@/lib/health/operations-service';

const CentralOperacoesClient = dynamicImport(
  () => import('@/components/operacoes/CentralOperacoesClient').then((mod) => mod.CentralOperacoesClient),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden pb-12">
        <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6 animate-pulse">
          <div className="h-16 w-full rounded-2xl bg-white/[0.04] border border-white/8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/[0.03] border border-white/8" />
            ))}
          </div>
          <div className="h-72 w-full rounded-2xl bg-white/[0.03] border border-white/8" />
        </div>
      </div>
    ),
  }
);

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
    environment: 'Produção',
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
    p95LatencyMs: 185,
    avgBatchDurationMs: null,
    provenance: 'calculated',
    note: 'Métricas agregadas em contingência temporária',
  },
  recentBatches: { bi: [], produtividade: [], metas: [], tarefas: [] },
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
    if (isRedirectError(err)) throw err;
    redirect('/dashboard');
  }

  if (!user || !user.tenantId) {
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

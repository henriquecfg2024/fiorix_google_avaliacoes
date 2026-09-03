import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { getOperationsHealth, type OperationsHealthSnapshot } from '@/lib/health/operations-service';
import { CentralOperacoesClient } from '@/components/operacoes/CentralOperacoesClient';

export const dynamic = 'force-dynamic';

// Snapshot de fallback seguro — exibido quando o serviço de saúde não responde
const FALLBACK_SNAPSHOT: OperationsHealthSnapshot = {
  globalStatus: 'DEGRADADO',
  environment: 'PRODUÇÃO',
  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  services: [
    { id: 'fiorix-web', name: 'FIORIX Web', status: 'unknown', latencyMs: null, lastSignalAt: '-' },
    { id: 'fiorix-api', name: 'API', status: 'unknown', latencyMs: null, lastSignalAt: '-' },
    { id: 'supabase', name: 'Supabase', status: 'unknown', latencyMs: null, lastSignalAt: '-' },
    { id: 'vercel', name: 'Vercel', status: 'unknown', latencyMs: null, lastSignalAt: '-' },
    { id: 'connector', name: 'FIORIX Connector', status: 'unknown', latencyMs: null, lastSignalAt: '-' },
    { id: 'webri-sql', name: 'WEBRI SQL', status: 'unknown', latencyMs: null, lastSignalAt: '-' },
    { id: 'github', name: 'GitHub', status: 'unknown', latencyMs: null, lastSignalAt: '-' },
  ],
  incrementalModules: [
    { module: 'Módulo BI', key: 'bi', status: 'ERROR', lastSyncAt: null, nextExpectedAt: null, delaySeconds: 999, recordsCount: 0, isIncremental: true },
    { module: 'Produtividade', key: 'produtividade', status: 'ERROR', lastSyncAt: null, nextExpectedAt: null, delaySeconds: 999, recordsCount: 0, isIncremental: true },
    { module: 'Metas', key: 'metas', status: 'ERROR', lastSyncAt: null, nextExpectedAt: null, delaySeconds: 999, recordsCount: 0, isIncremental: true },
    { module: 'Tarefas', key: 'tarefas', status: 'ERROR', lastSyncAt: null, nextExpectedAt: null, delaySeconds: 999, recordsCount: 0, isIncremental: true },
  ],
  connector: {
    status: 'OFFLINE',
    environment: 'PRODUÇÃO',
    server: 'WEBRI',
    windowsService: 'Unknown',
    uptimeFormatted: '-',
    heartbeatAgoSeconds: 999,
    cpuPercent: 0,
    ramMb: 0,
    threads: 0,
    handles: 0,
    pendingQueue: 0,
    lastError: 'Dados de telemetria indisponíveis',
    lastSyncAgoSeconds: 999,
  },
  metrics: { availabilityPercent: 0, syncOnTimePercent: 0, successRatePercent: 0, p95LatencyMs: 0 },
  incidents: [],
  alerts: [
    { id: 'err-1', severity: 'CRITICAL', title: 'Serviço de observabilidade indisponível', detail: 'Não foi possível carregar os dados de saúde. Tente atualizar.', timeAgo: 'agora' },
  ],
  deploys: {
    fiorixWeb: { version: '-', commit: '-', deployedAt: '-' },
    api: { version: '-', commit: '-', deployedAt: '-' },
    connector: { version: '-', status: '-', uptime: '-' },
    supabaseMigrations: { lastMigration: '-', status: '-', appliedAt: '-' },
    region: 'sa-east-1',
  },
};

export default async function OperacoesPage() {
  // Qualquer usuário autenticado pode acessar — sem redirect silencioso por role
  const user = await requireAuth().catch(() => null);
  if (!user) {
    redirect('/login');
  }

  // Carrega dados de saúde com fallback seguro
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

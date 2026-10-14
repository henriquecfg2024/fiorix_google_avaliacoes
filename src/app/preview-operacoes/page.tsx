import React from 'react';
import { CentralOperacoesClient } from '@/components/operacoes/CentralOperacoesClient';
import type { OperationsHealthSnapshot } from '@/lib/health/types';

export const dynamic = 'force-dynamic';

const PREVIEW_SNAPSHOT: OperationsHealthSnapshot = {
  globalStatus: 'OPERACIONAL',
  environment: 'Produção — único ambiente monitorado',
  timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' }),
  observedAt: new Date().toISOString(),
  snapshotAt: new Date().toISOString(),
  cacheAgeMs: 0,
  delivery: 'fresh',
  services: [
    { id: 'fiorix-web', name: 'FIORIX Web', status: 'operational', latencyMs: 38, lastSignalAt: 'Agora', provenance: 'live', details: 'Interface web do usuário (SaaS)' },
    { id: 'fiorix-api', name: 'API', status: 'operational', latencyMs: 54, lastSignalAt: 'Agora', provenance: 'live', details: 'Rotas de backend na nuvem' },
    { id: 'supabase', name: 'PostgreSQL', status: 'operational', latencyMs: 42, lastSignalAt: 'Agora', provenance: 'live', details: 'Banco de dados principal (Supabase)' },
    { id: 'vercel', name: 'Vercel Edge', status: 'operational', latencyMs: 25, lastSignalAt: 'Agora', provenance: 'live', details: 'Hospedagem e computação em nuvem' },
    { id: 'connector', name: 'FIORIX Connector', status: 'operational', latencyMs: 65, lastSignalAt: 'há 12s', provenance: 'live', details: 'Serviço Windows no servidor do cartório' },
    { id: 'webri-sql', name: 'WEBRI SQL', status: 'operational', latencyMs: 48, lastSignalAt: 'há 1m', provenance: 'live', details: 'SQL Server corporativo do cartório' },
  ],
  incrementalModules: [
    { module: 'Módulo BI', key: 'bi', status: 'OK', lastSyncAt: '10:00:00', nextExpectedAt: '11:00:00', delaySeconds: 0, recordsCount: 1420, isIncremental: true, expectedIntervalSeconds: 3600, provenance: 'live', statusNote: 'No prazo' },
    { module: 'Produtividade', key: 'produtividade', status: 'OK', lastSyncAt: '10:30:00', nextExpectedAt: '11:30:00', delaySeconds: 0, recordsCount: 890, isIncremental: true, expectedIntervalSeconds: 3600, provenance: 'live', statusNote: 'No prazo' },
    { module: 'Metas', key: 'metas', status: 'OK', lastSyncAt: '10:15:01', nextExpectedAt: '11:15:00', delaySeconds: 0, recordsCount: 310, isIncremental: true, expectedIntervalSeconds: 3600, provenance: 'live', statusNote: 'No prazo' },
    { module: 'Tarefas', key: 'tarefas', status: 'OK', lastSyncAt: '10:45:00', nextExpectedAt: '11:45:00', delaySeconds: 0, recordsCount: 540, isIncremental: true, expectedIntervalSeconds: 3600, provenance: 'live', statusNote: 'No prazo' },
    { module: 'Retornos', key: 'retornos', status: 'OK', lastSyncAt: '10:20:00', nextExpectedAt: '11:20:00', delaySeconds: 0, recordsCount: 180, isIncremental: true, expectedIntervalSeconds: 3600, provenance: 'live', statusNote: 'No prazo' },
    { module: 'Impressões', key: 'impressoes', status: 'OK', lastSyncAt: '10:25:00', nextExpectedAt: '11:25:00', delaySeconds: 0, recordsCount: 95, isIncremental: true, expectedIntervalSeconds: 3600, provenance: 'live', statusNote: 'No prazo' },
  ],
  connector: {
    status: 'ONLINE',
    environment: 'Produção',
    server: 'Servidor do Cartório (Windows Service)',
    windowsService: 'FIORIX-Connector-v2.1',
    uptimeFormatted: '14d 6h 32m',
    heartbeatAgoSeconds: 8,
    cpuPercent: 4.2,
    ramMb: 186,
    threads: 24,
    handles: 412,
    pendingQueue: 0,
    lastError: null,
    lastSyncAgoSeconds: 45,
    activeConnectorsCount: 1,
    provenance: { telemetry: 'live', heartbeat: 'live' },
  },
  externalIntegrations: [],
  metrics: {
    availabilityPercent: 99.9,
    syncOnTimePercent: 100,
    successRatePercent: 100,
    p95LatencyMs: 280,
    avgBatchDurationMs: 1450,
    provenance: 'calculated',
    note: 'Métricas agregadas consolidadas da infraestrutura e lotes operacionais',
  },
  recentBatches: { bi: [], produtividade: [], metas: [], tarefas: [], retornos: [], impressoes: [], andamentos: [] },
  incidents: [],
  alerts: [],
  deploys: {
    fiorixWeb: { version: 'v3.2.0', deployedAt: '14/10/2026' },
    api: { version: 'v1.0.0', deployedAt: '14/10/2026' },
    connector: { version: 'v2.1.0', status: 'Online' },
    databaseStatus: 'Conectado',
    environment: 'Produção',
  },
};

export default function PreviewOperacoesPage() {
  return (
    <CentralOperacoesClient
      initialHealth={PREVIEW_SNAPSHOT}
      userName="Administrador Preview"
    />
  );
}

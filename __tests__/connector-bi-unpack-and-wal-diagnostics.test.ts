import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockExecuteRawUnsafe = vi.fn();
const mockQueryRawUnsafe = vi.fn();
const mockFiorixBiImportUpsert = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
    fiorixBiImport: {
      upsert: (...args: unknown[]) => mockFiorixBiImportUpsert(...args),
      update: vi.fn(async () => ({})),
    },
    connector: {
      findMany: vi.fn(async () => [
        {
          id: 'conn-srvfiles-1',
          name: 'SRVFILES — Principal',
          lastSeenAt: new Date(),
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]),
      findFirst: vi.fn(async () => ({ id: 'conn-srvfiles-1' })),
    },
    connectorSyncBatch: { findMany: vi.fn(), findFirst: vi.fn() },
    connectorSourceStatus: { findMany: vi.fn() },
    fiorixTenantConfig: { upsert: vi.fn() },
  },
}));

vi.mock('@/lib/bi-aggregates', () => ({
  refreshBiAggregatesForImport: vi.fn(async () => {}),
}));
vi.mock('@/lib/bi-dashboard', () => ({
  invalidateBiDashboardCache: vi.fn(),
}));
vi.mock('@/lib/bi-produtividade-cache', () => ({
  invalidateProdutividadeTenantCache: vi.fn(),
}));
vi.mock('@/lib/bi-metas-cache', () => ({
  invalidateMetasTenantCache: vi.fn(),
}));
vi.mock('@/lib/bi-impressoes-cache', () => ({
  invalidateImpressoesTenantCache: vi.fn(),
}));
vi.mock('@/lib/ferias/ferias-repository', () => ({
  upsertColaboradoresGestorBatch: vi.fn(async () => ({ inserted: 0, updated: 0 })),
}));
vi.mock('@/lib/cartorio-virtual/connector-sync', () => ({
  sincronizarPedidosOficiaisWebriBatch: vi.fn(async () => ({ inserted: 0, updated: 0 })),
}));
vi.mock('@/lib/alerts/alert-dispatcher', () => ({
  dispatchAlert: vi.fn(async () => {}),
}));
vi.mock('@/lib/alerts/alert-storage', () => ({
  getLatestConnectorTelemetry: vi.fn(async () => null),
}));

import { unpackLiveRecords } from '@/lib/connector/unpack-live';
import { compareConnectorSemver, processHeartbeatHaAndBuildDirective } from '@/lib/connector/ha-manager';
import { sanitizeSyncBatchError } from '@/lib/health/operations-service';

describe('Correção 42P10 (source=bi), reconciliação HA APPLYING e higienização SQLite WAL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFiorixBiImportUpsert.mockResolvedValue({ id: 'connector-bi-live-tenant-1' });
    mockExecuteRawUnsafe.mockResolvedValue(1);
    mockQueryRawUnsafe.mockResolvedValue([]);
  });

  it('1. unpackLiveRecords (source="bi") não usa ON CONFLICT e deduplica via CTE unique_by_andamento + NOT EXISTS', async () => {
    const result = await unpackLiveRecords({
      tenantId: 'tenant-1',
      source: 'bi',
      records: [
        { PROTOCOLO: '12345', SEQ_TITULO: 1, DATA_ENTRADA: '2026-11-13T15:00:00Z', TIPO: 'REGISTRO' },
        { PROTOCOLO: '12345', SEQ_TITULO: 1, DATA_ENTRADA: '2026-11-13T15:05:00Z', TIPO: 'REGISTRO' },
      ],
    });

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);

    const sqlCalls = mockExecuteRawUnsafe.mock.calls.map((c) => String(c[0] || ''));
    const insertSql = sqlCalls.find((sql) => sql.includes('INSERT INTO public.fiorix_bi_data'));
    expect(insertSql).toBeDefined();
    expect(insertSql).not.toMatch(/ON\s+CONFLICT/i);
    expect(insertSql).toContain('unique_by_andamento');
    expect(insertSql).toContain('NOT EXISTS');
  });

  it('2. sanitizeSyncBatchError traduz erro PostgreSQL 42P10 para diagnóstico claro em português', () => {
    const msg = sanitizeSyncBatchError(
      'ConnectorError: PostgreSQL 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification\nat unpackLive',
    );
    expect(msg).toContain('42P10');
    expect(msg).toContain('fiorix_bi_data');
    expect(msg).toContain('CTE + NOT EXISTS');
    expect(msg).not.toContain('\n');
  });

  it('3. processHeartbeatHaAndBuildDirective reconcilia update_status APPLYING preso para SUCCEEDED quando selfUpdate retorna IDLE', async () => {
    const oldUpdateAt = new Date(Date.now() - 10 * 60 * 1000);
    const nodeRow = {
      connector_id: 'conn-srvfiles-1',
      tenant_id: 'tenant-1',
      name: 'SRVFILES — Principal',
      enabled: true,
      version: 'v2.6.7',
      status: 'online',
      lastSeenAt: new Date(),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      role: 'PRIMARY',
      operational_state: 'ACTIVE',
      priority: 1,
      hostname: 'SRVFILES',
      os_version: 'Windows Server',
      lan_url: 'http://10.0.0.20:8765',
      installed_path: 'C:\\FIORIXConnector',
      remote_config: {},
      config_version: 1,
      target_version: 'v2.6.7',
      update_status: 'APPLYING',
      update_message: 'Reiniciando serviço Windows (FIORIXConnector) para ativar v2.6.7...',
      last_update_at: oldUpdateAt,
    };

    mockQueryRawUnsafe.mockImplementation(async (sql: string) => {
      const q = String(sql);
      if (q.includes('SELECT id FROM "Connector"')) {
        return [{ id: 'conn-srvfiles-1' }];
      }
      if (q.includes('SELECT connector_id') && q.includes('FROM public.fiorix_connector_ha_nodes')) {
        return [{ connector_id: 'conn-srvfiles-1', operational_state: 'ACTIVE' }];
      }
      if (q.includes('LEFT JOIN public.fiorix_connector_ha_nodes h')) {
        return [nodeRow];
      }
      if (q.includes('FROM public.fiorix_tenant_sync_checkpoints')) {
        return [];
      }
      if (q.includes('FROM public.fiorix_tenant_connector_settings')) {
        return [{ tenant_id: 'tenant-1', failover_mode: 'MANUAL', auto_failover_timeout_sec: 180, rolling_update_state: null }];
      }
      return [];
    });

    const directive = await processHeartbeatHaAndBuildDirective({
      tenantId: 'tenant-1',
      connectorId: 'conn-srvfiles-1',
      reportedVersion: 'v2.6.7',
      details: {
        runtime: {
          hostname: 'SRVFILES',
          selfUpdate: {
            status: 'IDLE',
          },
        },
      },
    });

    const haUpdateCall = mockExecuteRawUnsafe.mock.calls.find((call) =>
      String(call[0] || '').includes('UPDATE public.fiorix_connector_ha_nodes') &&
      String(call[0] || '').includes('target_version = $7'),
    );
    expect(haUpdateCall).toBeDefined();
    expect(haUpdateCall?.[7]).toBeNull(); // target_version limpo
    expect(haUpdateCall?.[8]).toBe('SUCCEEDED'); // update_status reconciliado
    expect(compareConnectorSemver('v2.6.7', 'v2.6.13')).toBeLessThan(0);
    expect(compareConnectorSemver('v2.6.13', 'v2.6.13')).toBe(0);
    expect(directive.pendingUpdate?.version).toBe('v2.6.13');
  });
});


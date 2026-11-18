import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryRawUnsafe = vi.fn();
const mockExecuteRawUnsafe = vi.fn();
const mockExecuteRaw = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { allPublicTablesExist } from '@/lib/db/ddl-guard';
import {
  getLatestConnectorTelemetry,
  recordConnectorTelemetry,
  resetTelemetryPruneStateForTests,
} from '@/lib/alerts/alert-storage';
import { recordHealthSample } from '@/lib/health/health-samples';
import {
  persistAndIngestCollectorSample,
  resetSrvsqlPerfDbPruneStateForTests,
  type RawCollectorIngestPayload,
} from '@/lib/srvsql-performance/store';

function makeMinimalSrvsqlSample(observedAt: string): RawCollectorIngestPayload {
  return {
    observedAt,
    collectionDurationMs: 35,
    simpleConnectivityPingMs: 2,
    cpuTotalPercent: 12,
    sqlCpuPercent: 4,
    cpuCount: 10,
    totalUserSessionsCount: 410,
    sqlMetadata: {
      serverName: 'SRVSQL',
      machineName: 'SRVSQL',
      instanceName: 'MSSQLSERVER',
      edition: 'Standard Edition (64-bit)',
      productVersion: '11.0.7507.2',
      productLevel: 'SP4',
      majorVersion: 11,
      sqlServerStartTime: '2026-11-11T16:11:46.083',
      loginUsed: 'fiorix_connector',
      hasViewServerState: true,
      hasViewServerPerformanceState: false,
      hasViewAnyDefinition: true,
      queryStoreSupported: false,
      queryStoreEnabled: null,
      requiredPermissionLabel: 'VIEW SERVER STATE ativo',
    },
    windowsMemory: {
      totalPhysicalMb: 73999.6,
      availablePhysicalMb: 18500,
      usedPhysicalMb: 55499.6,
      usedPercent: 75,
      committedMb: 56000,
      commitLimitMb: 85000,
      commitPercent: 65.9,
      pagesPerSec: null,
      pageInputsPerSec: null,
      pageFaultsPerSec: null,
      windowsMemoryPressure: 'NORMAL',
    },
    windowsVolumes: [],
    windowsNetwork: [],
    windowsProcesses: [],
    windowsServices: [],
    concurrentEvents: [],
    activeSessions: [],
    waitStatsRaw: [],
    fileIoRaw: [],
    sqlMemory: {
      totalServerMemoryMb: 40000,
      targetServerMemoryMb: 40000,
      maxServerMemoryConfigMb: 40000,
      minServerMemoryConfigMb: 0,
      sqlProcessWorkingSetMb: 40000,
      sqlProcessPrivateMb: 40000,
      pageLifeExpectancySec: 4200,
      bufferCacheHitRatioPercent: 99.8,
      memoryGrantsPending: 0,
      memoryGrantsActive: 0,
      grantedWorkspaceMemoryMb: 0,
      maxWorkspaceMemoryMb: null,
      processPhysicalMemoryLow: false,
      processVirtualMemoryLow: false,
    },
    databaseSpaces: [],
    costlyQueries: [],
  };
}

describe('Otimizações de Observabilidade e Performance no Supabase (fiorix-db)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRawUnsafe.mockResolvedValue([]);
    mockExecuteRawUnsafe.mockResolvedValue(0);
    mockExecuteRaw.mockResolvedValue(0);
    mockQueryRaw.mockResolvedValue([]);
    resetTelemetryPruneStateForTests();
    resetSrvsqlPerfDbPruneStateForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('1. allPublicTablesExist: preserva mocks em Vitest por padrão e consulta pg_class quando forçado', async () => {
    await expect(allPublicTablesExist([])).resolves.toBe(true);
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();

    const defaultInVitest = await allPublicTablesExist(['srvsql_perf_samples', 'srvsql_perf_config']);
    expect(defaultInVitest).toBe(false);
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();

    mockQueryRawUnsafe.mockResolvedValueOnce([{ cnt: 2 }]);
    const allPresent = await allPublicTablesExist(['srvsql_perf_samples', 'srvsql_perf_config'], {
      forceCheckInTest: true,
    });
    expect(allPresent).toBe(true);
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(String(mockQueryRawUnsafe.mock.calls[0]?.[0])).toContain('FROM pg_class c');

    mockQueryRawUnsafe.mockResolvedValueOnce([{ cnt: 1 }]);
    const missingOne = await allPublicTablesExist(['srvsql_perf_samples', 'tabela_inexistente'], {
      forceCheckInTest: true,
    });
    expect(missingOne).toBe(false);
  });

  it('2. recordConnectorTelemetry e getLatestConnectorTelemetry não disparam ALTER TABLE details e aplicam expurgo de 48h LIMIT 1000', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([
      {
        uptimeSeconds: 1200,
        ramMb: 180,
        cpuPercent: 6,
        queuePending: 0,
        queueFailed: 0,
        details: { version: 'v2.6.23' },
        createdAt: new Date('2026-11-18T18:00:00.000Z'),
      },
    ]);

    const latest = await getLatestConnectorTelemetry('tenant-1', 'conn-srvfiles');
    expect(latest?.connectorId).toBe('conn-srvfiles');

    vi.stubEnv('VITEST', '');
    vi.stubEnv('NODE_ENV', 'production');

    await recordConnectorTelemetry({
      tenantId: 'tenant-1',
      connectorId: 'conn-srvfiles',
      uptimeSeconds: 1250,
      ramMb: 182,
      cpuPercent: 5,
      queuePending: 0,
      queueFailed: 0,
      details: { stagedFiles: 0 },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const sqlStatements = mockExecuteRawUnsafe.mock.calls.map((c) => String(c[0]));
    expect(sqlStatements.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS details'))).toBe(false);
    expect(sqlStatements.some((sql) => sql.includes('INSERT INTO public.fiorix_connector_telemetry'))).toBe(true);

    const pruneSql = sqlStatements.find((sql) => sql.includes('DELETE FROM public.fiorix_connector_telemetry'));
    expect(pruneSql).toBeDefined();
    expect(pruneSql).toContain("INTERVAL '48 hours'");
    expect(pruneSql).toContain('ORDER BY created_at ASC');
    expect(pruneSql).toContain('LIMIT 1000');
  });

  it('3. persistAndIngestCollectorSample usa 2 DELETEs indexados (sem OR id IN) e respeita janela de 15 min', async () => {
    const tenantId = 'tenant-srvsql-prune-opt';
    const baseTs = Date.now();

    await persistAndIngestCollectorSample(tenantId, makeMinimalSrvsqlSample(new Date(baseTs - 20_000).toISOString()));

    const deletesFirstCall = mockExecuteRawUnsafe.mock.calls
      .map((c) => String(c[0]))
      .filter((sql) => sql.includes('DELETE FROM srvsql_perf_samples'));

    expect(deletesFirstCall).toHaveLength(2);
    expect(deletesFirstCall[0]).toContain("observed_at < NOW() - ($2::int * INTERVAL '1 day')");
    expect(deletesFirstCall[1]).toContain('observed_at < (');
    expect(deletesFirstCall.some((sql) => /\bOR\s+id\s+IN\b/i.test(sql))).toBe(false);

    mockExecuteRawUnsafe.mockClear();

    await persistAndIngestCollectorSample(tenantId, makeMinimalSrvsqlSample(new Date(baseTs - 10_000).toISOString()));

    const insertsSecondCall = mockExecuteRawUnsafe.mock.calls
      .map((c) => String(c[0]))
      .filter((sql) => sql.includes('INSERT INTO srvsql_perf_samples'));
    const deletesSecondCall = mockExecuteRawUnsafe.mock.calls
      .map((c) => String(c[0]))
      .filter((sql) => sql.includes('DELETE FROM srvsql_perf_samples'));

    expect(insertsSecondCall).toHaveLength(1);
    expect(deletesSecondCall).toHaveLength(0);

    resetSrvsqlPerfDbPruneStateForTests();
    mockExecuteRawUnsafe.mockClear();

    await persistAndIngestCollectorSample(tenantId, makeMinimalSrvsqlSample(new Date(baseTs).toISOString()));

    const deletesAfterReset = mockExecuteRawUnsafe.mock.calls
      .map((c) => String(c[0]))
      .filter((sql) => sql.includes('DELETE FROM srvsql_perf_samples'));
    expect(deletesAfterReset).toHaveLength(2);
  });

  it('4. recordHealthSample filtra tenant_id ao limpar amostras antigas para usar o índice composto', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);

    await recordHealthSample({
      tenantId: 'tenant-health-test',
      source: 'central',
      latencyMs: 14,
      success: true,
      checkedAt: new Date('2026-11-18T18:10:00.000Z'),
    });

    const deleteCall = mockExecuteRaw.mock.calls.find(
      ([strings]) =>
        Array.isArray(strings) &&
        strings.join(' ').includes('DELETE FROM public.fiorix_operations_health_samples'),
    );

    expect(deleteCall).toBeDefined();
    const [templateStrings, ...boundValues] = deleteCall as [string[], ...unknown[]];
    const joinedSql = templateStrings.join(' ? ');
    expect(joinedSql).toContain('tenant_id =');
    expect(joinedSql).toContain('checked_at <');
    expect(boundValues).toContain('tenant-health-test');
  });
});

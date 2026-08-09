import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { $executeRawUnsafe: vi.fn(), $queryRaw: vi.fn() },
}));

vi.mock('./prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('ensureSyncLogTable', () => {
  it('creates the enum, table and index once per process', async () => {
    const { ensureSyncLogTable } = await import('./sync-log-db');

    await ensureSyncLogTable();
    const statements: string[] = prismaMock.$executeRawUnsafe.mock.calls.map((call) => String(call[0]));
    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain('CREATE TYPE "SyncStatus"');
    expect(statements[1]).toContain('CREATE TABLE IF NOT EXISTS "SyncLog"');
    expect(statements[2]).toContain('idx_sync_log_tenant_created');

    await ensureSyncLogTable();
    expect(prismaMock.$executeRawUnsafe).toHaveBeenCalledTimes(3);
  });

  it('retries on the next call when the migration fails', async () => {
    prismaMock.$executeRawUnsafe.mockRejectedValueOnce(new Error('permission denied'));
    const { ensureSyncLogTable } = await import('./sync-log-db');

    await expect(ensureSyncLogTable()).rejects.toThrow('permission denied');
    await ensureSyncLogTable();
    expect(prismaMock.$executeRawUnsafe.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('refreshBiAggregatesForImport', () => {
  it('delegates to the refresh_fiorix_bi_aggregates function', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ daily_rows: BigInt(10), note_rows: BigInt(2) }]);
    const { refreshBiAggregatesForImport } = await import('./bi-aggregates');

    await expect(refreshBiAggregatesForImport('imp-1')).resolves.toEqual([
      { daily_rows: BigInt(10), note_rows: BigInt(2) },
    ]);
    const [strings, importId] = prismaMock.$queryRaw.mock.calls[0];
    expect(strings.join('')).toContain('refresh_fiorix_bi_aggregates');
    expect(importId).toBe('imp-1');
  });
});

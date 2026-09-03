import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/v1/connector/sync/route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    connector: { findUnique: vi.fn(), update: vi.fn() },
    connectorSyncBatch: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    connectorSyncStaging: { findUnique: vi.fn(), create: vi.fn() },
    connectorSourceStatus: { upsert: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

const compareSecret = vi.fn();
vi.mock('bcryptjs', () => ({
  default: { compare: (...args: unknown[]) => compareSecret(...args), genSalt: vi.fn(), hash: vi.fn() },
}));

const tenantId = 'tenant-a';
const connectorId = 'connector-a';
const request = (body: object, authorization = 'Bearer valid-secret') => new Request('http://localhost/api/v1/connector/sync', {
  method: 'POST', headers: { authorization }, body: JSON.stringify(body),
});

describe('connector sync chunking', () => {
  let batch: any;
  let chunks: Set<number>;
  let failChunkEight: boolean;

  const payload = (overrides: Record<string, unknown> = {}) => ({
    connector_id: connectorId,
    source: 'bi',
    batch_id: 'batch-1',
    generated_at: new Date().toISOString(),
    records: [{ id: 1 }],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    batch = null;
    chunks = new Set();
    failChunkEight = false;
    compareSecret.mockResolvedValue(true);
    (prisma.connector.findUnique as any).mockResolvedValue({
      id: connectorId, tenantId, enabled: true, credentialIdentifier: 'hash', tenant: { id: tenantId },
    });
    (prisma.connectorSyncBatch.findUnique as any).mockImplementation(async () => batch);
    (prisma.connectorSyncBatch.create as any).mockImplementation(async ({ data }: any) => {
      batch = { id: 'batch-row', ...data };
      return batch;
    });
    (prisma.connectorSyncBatch.update as any).mockImplementation(async ({ data }: any) => {
      if (data.chunksReceived?.increment) batch.chunksReceived += data.chunksReceived.increment;
      if (data.recordsReceived?.increment) batch.recordsReceived += data.recordsReceived.increment;
      if (data.recordsInserted?.increment) batch.recordsInserted += data.recordsInserted.increment;
      Object.assign(batch, data.status ? { status: data.status } : {}, data.processedAt !== undefined ? { processedAt: data.processedAt } : {});
      return batch;
    });
    (prisma.connectorSyncStaging.findUnique as any).mockImplementation(async ({ where }: any) =>
      chunks.has(where.tenantId_connectorId_source_batchId_chunkIndex.chunkIndex) ? { id: 'chunk' } : null,
    );
    (prisma.connectorSyncStaging.create as any).mockImplementation(async ({ data }: any) => {
      if (failChunkEight && data.chunkIndex === 7) {
        failChunkEight = false;
        throw new Error('simulated chunk 8 failure');
      }
      chunks.add(data.chunkIndex);
      return { id: `chunk-${data.chunkIndex}`, ...data };
    });
  });

  it('keeps legacy one-chunk requests compatible and completes them', async () => {
    const response = await POST(request(payload({ source: 'tarefas' })));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe('completed');
    expect(batch.chunkCount).toBe(1);
    expect(batch.chunksReceived).toBe(1);
    expect(batch.syncMode).toBe('full');
  });

  it('persists incremental sync mode on batch and staging', async () => {
    const response = await POST(request(payload({ sync_mode: 'incremental', records: [{ record_key: 'rk-1', id: 1 }] })));
    expect(response.status).toBe(200);
    expect(batch.syncMode).toBe('incremental');
    expect(prisma.connectorSyncStaging.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ syncMode: 'incremental' }),
    }));
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    const statement = (prisma.$executeRaw as any).mock.calls[0][0];
    const sqlText = Array.isArray(statement?.strings) ? statement.strings.join('?') : String(statement);
    expect(sqlText).toContain('ON CONFLICT ("tenantId", "connectorId", "source", "recordKey")');
    expect(sqlText).toContain('"updatedAt" = NOW()');
  });

  it('rejects incremental records without a deterministic record_key', async () => {
    expect((await POST(request(payload({ sync_mode: 'incremental' })))).status).toBe(400);
    expect(prisma.connectorSyncStaging.create).not.toHaveBeenCalled();
  });

  it('processes 8067 simulated records in 17 chunks and completes only on chunk 17', async () => {
    for (let index = 0; index < 16; index += 1) {
      const records = Array.from({ length: 500 }, (_, id) => ({ id }));
      const response = await POST(request(payload({ batch_id: 'batch-17', chunk_index: index, chunk_count: 17, records })));
      expect(response.status).toBe(200);
      expect(batch.chunksReceived).toBe(index + 1);
      expect(batch.status).toBe('partial');
    }
    const response = await POST(request(payload({ batch_id: 'batch-17', chunk_index: 16, chunk_count: 17, records: Array.from({ length: 67 }, (_, id) => ({ id })) })));
    expect(response.status).toBe(200);
    expect(batch.chunksReceived).toBe(17);
    expect(batch.recordsReceived).toBe(8067);
    expect(batch.status).toBe('completed');
  });

  it('does not increment a duplicated chunk', async () => {
    await POST(request(payload({ batch_id: 'retry', chunk_index: 0, chunk_count: 2 })));
    const response = await POST(request(payload({ batch_id: 'retry', chunk_index: 0, chunk_count: 2 })));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.alreadyProcessed).toBe(true);
    expect(batch.chunksReceived).toBe(1);
  });

  it('keeps a missing chunk batch partial', async () => {
    await POST(request(payload({ batch_id: 'partial', chunk_index: 0, chunk_count: 3 })));
    await POST(request(payload({ batch_id: 'partial', chunk_index: 2, chunk_count: 3 })));
    expect(batch.chunksReceived).toBe(2);
    expect(batch.status).toBe('partial');
  });

  it('preserves progress when chunk 8 fails and retries only chunk 8', async () => {
    for (let index = 0; index < 7; index += 1) {
      expect((await POST(request(payload({ batch_id: 'chunk-8', chunk_index: index, chunk_count: 17 })))).status).toBe(200);
    }
    failChunkEight = true;
    expect((await POST(request(payload({ batch_id: 'chunk-8', chunk_index: 7, chunk_count: 17 })))).status).toBe(500);
    expect(batch.chunksReceived).toBe(7);
    expect((await POST(request(payload({ batch_id: 'chunk-8', chunk_index: 7, chunk_count: 17 })))).status).toBe(200);
    expect(batch.chunksReceived).toBe(8);
    expect(batch.status).toBe('partial');
  });

  it('rejects a cross-tenant legacy assertion before persistence', async () => {
    const response = await POST(request(payload({ tenant_id: 'tenant-b' })));
    expect(response.status).toBe(403);
    expect(prisma.connectorSyncStaging.create).not.toHaveBeenCalled();
  });

  it('accepts all existing sources without chunking regressions', async () => {
    for (const source of ['tarefas', 'metas', 'bi']) {
      batch = null;
      chunks.clear();
      expect((await POST(request(payload({ source, batch_id: `legacy-${source}` })))).status).toBe(200);
    }
  });

  it('uses a short bounded transaction only for chunk bookkeeping', async () => {
    await POST(request(payload()));
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 10000, maxWait: 10000 });
  });

  it('rejects invalid chunk ranges', async () => {
    expect((await POST(request(payload({ chunk_index: 1, chunk_count: 1 })))).status).toBe(400);
  });
});

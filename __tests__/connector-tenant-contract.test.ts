import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/v1/connector/sync/route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    connector: { findUnique: vi.fn(), update: vi.fn() },
    connectorSyncBatch: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    connectorSyncStaging: { findUnique: vi.fn(), create: vi.fn() },
    connectorSourceStatus: { upsert: vi.fn() },
    $transaction: vi.fn((callback) => callback(prisma))
  }
}));

const compareSecret = vi.fn();
vi.mock('bcryptjs', () => ({
  default: { compare: (...args: unknown[]) => compareSecret(...args), genSalt: vi.fn(), hash: vi.fn() }
}));

const connectorId = 'connector-a';
const tenantA = 'tenant-a';
const payload = {
  connector_id: connectorId,
  source: 'tarefas',
  batch_id: 'batch-1',
  generated_at: new Date().toISOString(),
  records: []
};

const request = (body: object, authorization = 'Bearer valid-secret') => new Request('http://localhost/api/v1/connector/sync', {
  method: 'POST',
  headers: { authorization },
  body: JSON.stringify(body)
});

describe('connector tenant contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compareSecret.mockResolvedValue(true);
    (prisma.connector.findUnique as any).mockResolvedValue({
      id: connectorId,
      tenantId: tenantA,
      enabled: true,
      credentialIdentifier: 'hash',
      tenant: { id: tenantA }
    });
    (prisma.connectorSyncBatch.findUnique as any).mockResolvedValue(null);
    (prisma.connectorSyncBatch.create as any).mockResolvedValue({
      id: 'batch-row', chunkCount: 1, chunksReceived: 0, recordsReceived: 0, recordsInserted: 0, status: 'receiving'
    });
    (prisma.connectorSyncBatch.update as any).mockResolvedValue({
      id: 'batch-row', chunkCount: 1, chunksReceived: 1, recordsReceived: 0, recordsInserted: 0, status: 'completed'
    });
    (prisma.connectorSyncStaging.findUnique as any).mockResolvedValue(null);
  });

  it('accepts an omitted tenant_id and persists only under the authenticated tenant', async () => {
    const response = await POST(request(payload));
    expect(response.status).toBe(200);
    expect(prisma.connectorSyncStaging.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: tenantA })
    }));
  });

  it('accepts the legacy matching tenant_id', async () => {
    expect((await POST(request({ ...payload, tenant_id: tenantA }))).status).toBe(200);
  });

  it('rejects a mismatched legacy tenant_id with 403 before persistence', async () => {
    expect((await POST(request({ ...payload, tenant_id: 'tenant-b' }))).status).toBe(403);
    expect(prisma.connectorSyncStaging.create).not.toHaveBeenCalled();
  });

  it('rejects invalid Connector and invalid secret', async () => {
    (prisma.connector.findUnique as any).mockResolvedValueOnce(null);
    expect((await POST(request(payload))).status).toBe(401);
    compareSecret.mockResolvedValue(false);
    expect((await POST(request(payload))).status).toBe(401);
  });

  it('rejects a Connector that has no internal tenant', async () => {
    (prisma.connector.findUnique as any).mockResolvedValue({
      id: connectorId, tenantId: '', enabled: true, credentialIdentifier: 'hash', tenant: null
    });
    expect((await POST(request(payload))).status).toBe(401);
    expect(prisma.connectorSyncStaging.create).not.toHaveBeenCalled();
  });

  it('keeps idempotent chunks out of staging', async () => {
    (prisma.connectorSyncBatch.findUnique as any).mockResolvedValue({ id: 'existing', chunkCount: 1, chunksReceived: 1, recordsReceived: 0, status: 'completed' });
    (prisma.connectorSyncStaging.findUnique as any).mockResolvedValue({ id: 'existing-chunk' });
    const body = await (await POST(request(payload))).json();
    expect(body.alreadyProcessed).toBe(true);
    expect(prisma.connectorSyncStaging.create).not.toHaveBeenCalled();
  });
});

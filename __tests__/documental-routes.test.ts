import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  access: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), read: vi.fn(),
  auth: vi.fn(), claim: vi.fn(), finish: vi.fn(),
}));
vi.mock('@/lib/documental/access', () => ({
  requireDocumentAccess: mocks.access,
  DocumentAccessError: class extends Error { constructor(public status: number, message: string) { super(message); } },
}));
vi.mock('@/lib/prisma', () => ({ prisma: { connector: { findFirst: mocks.findFirst, findMany: mocks.findMany } } }));
vi.mock('@/lib/documental/store', () => ({ createSearch: mocks.create, readSearch: mocks.read, claimSearch: mocks.claim, finishSearch: mocks.finish }));
vi.mock('@/lib/connectorAuth', () => ({ authenticateConnector: mocks.auth }));
import { POST, GET } from '../src/app/api/gestao-documental/route';
import { POST as connectorPost } from '../src/app/api/v1/connector/documentos/route';

const browserRequest = (body: unknown, origin = 'https://fixture.example') => new Request('https://fixture.example/api/gestao-documental', {
  method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const workerRequest = (body: unknown, bearer = true) => new Request('https://fixture.example/api/v1/connector/documentos', {
  method: 'POST', headers: bearer ? { authorization: 'Bearer fixture-secret' } : {}, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('DOCUMENTAL_ENABLED', 'true');
  mocks.access.mockResolvedValue({ id: 'user-a', tenantId: 'tenant-a', role: 'ADMIN' });
  mocks.findFirst.mockResolvedValue({ id: 'connector-a', lastSeenAt: new Date() });
  mocks.create.mockResolvedValue('00000000-0000-4000-8000-000000000001');
  mocks.auth.mockResolvedValue({ success: true, connector: { id: 'connector-a' }, tenant: { id: 'tenant-a' } });
});
describe('browser authorization boundaries', () => {
  it('derives tenant/user exclusively from session and filters connector by tenant', async () => {
    expect((await POST(browserRequest({ connectorId: 'connector-a', query: 'ficticio' }))).status).toBe(202);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'connector-a', tenantId: 'tenant-a', enabled: true } }));
    expect(mocks.create).toHaveBeenCalledWith('tenant-a', 'user-a', 'connector-a', 'ficticio');
  });
  it('does not queue a connector belonging to another tenant', async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await POST(browserRequest({ connectorId: 'connector-b', query: 'ficticio' }))).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rejects cross-origin browser submissions', async () => {
    expect((await POST(browserRequest({ connectorId: 'connector-a', query: 'ficticio' }, 'https://other.example'))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('limits result reads to the requesting user and tenant', async () => {
    mocks.read.mockResolvedValue(null);
    const id = '00000000-0000-4000-8000-000000000001';
    expect((await GET(new Request('https://fixture.example/api/gestao-documental?id=' + id))).status).toBe(404);
    expect(mocks.read).toHaveBeenCalledWith(id, 'tenant-a', 'user-a');
  });
  it('rejects another request while an outstanding search exists', async () => {
    mocks.create.mockResolvedValue(null);
    expect((await POST(browserRequest({ connectorId: 'connector-a', query: 'ficticio' }))).status).toBe(429);
  });
});
describe('connector authorization boundaries', () => {
  it('requires credentials before polling', async () => {
    expect((await connectorPost(workerRequest({ action: 'claim', connectorId: 'connector-a' }, false))).status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('never polls after failed connector authentication', async () => {
    mocks.auth.mockResolvedValue({ success: false });
    expect((await connectorPost(workerRequest({ action: 'claim', connectorId: 'connector-a' }))).status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('derives tenant and connector from verified authority', async () => {
    mocks.claim.mockResolvedValue(null);
    expect((await connectorPost(workerRequest({ action: 'claim', connectorId: 'connector-a' }))).status).toBe(200);
    expect(mocks.claim).toHaveBeenCalledWith('tenant-a', 'connector-a');
  });
  it('rejects results for expired or unowned jobs', async () => {
    mocks.finish.mockResolvedValue(0);
    const id = '00000000-0000-4000-8000-000000000001';
    expect((await connectorPost(workerRequest({ action: 'complete', connectorId: 'connector-a', id, result: { files: [], partial: false, unavailableRoots: [] } }))).status).toBe(409);
    expect(mocks.finish).toHaveBeenCalledWith(id, 'tenant-a', 'connector-a', expect.any(Object), false);
  });
  it('does not poll when disabled', async () => {
    vi.stubEnv('DOCUMENTAL_ENABLED', 'false');
    expect((await connectorPost(workerRequest({ action: 'claim', connectorId: 'connector-a' }))).status).toBe(503);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});


import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, GET } from '@/app/api/v1/connector/status/route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    connector: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

const compareSecret = vi.fn();
vi.mock('bcryptjs', () => ({
  default: { compare: (...args: unknown[]) => compareSecret(...args), genSalt: vi.fn(), hash: vi.fn() },
}));

const tenantId = 'tenant-prod';
const connectorId = 'connector-prod';

const request = (body: object, authorization = 'Bearer valid-secret') => new Request('http://localhost/api/v1/connector/status', {
  method: 'POST',
  headers: { authorization },
  body: JSON.stringify(body),
});

describe('POST /api/v1/connector/status (Heartbeat & Liveness)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.connector.findUnique as any).mockResolvedValue({
      id: connectorId,
      credentialIdentifier: '$2a$10$hashed',
      enabled: true,
      tenantId,
      tenant: { id: tenantId, name: 'Prod Tenant' },
    });
    compareSecret.mockResolvedValue(true);
  });


  it('1. Accepts valid heartbeat and returns HTTP 200 with tenant and connector derived from auth', async () => {
    const res = await POST(request({
      connectorId,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      status: 'online',
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.connectorId).toBe(connectorId);
    expect(body.tenantId).toBe(tenantId);
    expect(body.receivedAt).toBeDefined();
  });

  it('2. Rejects request without Authorization header with HTTP 401', async () => {
    const req = new Request('http://localhost/api/v1/connector/status', {
      method: 'POST',
      body: JSON.stringify({ connectorId }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('3. Rejects invalid secret with HTTP 401', async () => {
    compareSecret.mockResolvedValue(false);
    const res = await POST(request({ connectorId }, 'Bearer wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('4. Rejects unknown connector with HTTP 401', async () => {
    (prisma.connector.findUnique as any).mockResolvedValue(null);
    const res = await POST(request({ connectorId: 'unknown-conn' }));
    expect(res.status).toBe(401);
  });

  it('5. Rejects GET requests with HTTP 405 Method Not Allowed', async () => {
    const res = await GET();
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error).toBe('Method Not Allowed');
  });
});

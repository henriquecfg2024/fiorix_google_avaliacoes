import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, GET } from '@/app/api/v1/connector/status/route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    connector: { findUnique: vi.fn(), updateMany: vi.fn() },
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
    (prisma.connector.updateMany as any).mockResolvedValue({ count: 1 });
    compareSecret.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });


  it('1. Accepts valid heartbeat and returns HTTP 200 with tenant and connector derived from auth', async () => {
    const receivedAt = new Date('2026-09-03T18:30:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(receivedAt);

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
    expect(body.receivedAt).toBe(receivedAt.toISOString());
    expect(body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(prisma.connector.updateMany).toHaveBeenCalledWith({
      where: {
        id: connectorId,
        tenantId,
        enabled: true,
      },
      data: {
        lastSeenAt: receivedAt,
        status: 'online',
        version: '0.1.0',
      },
    });
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

  it('6. Uses the server clock instead of the timestamp supplied by the Connector', async () => {
    const serverTime = new Date('2026-09-03T18:45:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(serverTime);

    await POST(request({
      connectorId,
      timestamp: '2020-01-01T00:00:00.000Z',
      status: 'degraded',
      sources: { bi: { lastSuccessAt: '2020-01-01T00:00:00.000Z' } },
    }));

    expect(prisma.connector.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: connectorId, tenantId, enabled: true },
      data: expect.objectContaining({
        lastSeenAt: serverTime,
        status: 'degraded',
      }),
    }));
  });

  it('7. Sanitizes persistence failures without returning or logging the raw error', async () => {
    const sensitiveError = new Error(
      'P1001 postgresql://service_role:secret@192.168.0.10:5432/db SELECT * FROM Connector',
    );
    (prisma.connector.updateMany as any).mockRejectedValue(sensitiveError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await POST(request({ connectorId, status: 'online' }));
    const body = await res.json();
    const serializedBody = JSON.stringify(body);
    const serializedLog = JSON.stringify(consoleError.mock.calls);

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(body.message).toBeUndefined();
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(serializedBody).not.toContain('service_role');
    expect(serializedBody).not.toContain('192.168.0.10');
    expect(serializedBody).not.toContain('SELECT');
    expect(serializedLog).not.toContain('service_role');
    expect(serializedLog).not.toContain('192.168.0.10');
    expect(serializedLog).not.toContain('SELECT');
    expect(consoleError).toHaveBeenCalledWith('CONNECTOR_STATUS_ERROR', {
      requestId: body.requestId,
    });
  });

  it('8. Does not acknowledge a heartbeat that could not be persisted', async () => {
    (prisma.connector.updateMany as any).mockResolvedValue({ count: 0 });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const res = await POST(request({ connectorId }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBeUndefined();
    expect(body.error).toBe('Heartbeat not persisted');
  });
});

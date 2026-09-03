import { NextResponse } from 'next/server';
import { authenticateConnector } from '@/lib/connectorAuth';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const statusPayloadSchema = z.object({
  connectorId: z.string().trim().min(1).max(128),
  version: z.string().trim().min(1).max(64).optional(),
  timestamp: z.string().datetime().optional(),
  status: z.enum(['online', 'degraded', 'offline']).optional(),
  uptimeSeconds: z.number().int().nonnegative().optional(),
  shadowMode: z.boolean().optional(),
  queuePending: z.number().int().nonnegative().optional(),
  queueFailed: z.number().int().nonnegative().optional(),
  schedulerEnabled: z.boolean().optional(),
  sources: z.record(z.string(), z.unknown()).optional(),
});

function jsonResponse(
  requestId: string,
  payload: Record<string, unknown>,
  status: number,
) {
  return NextResponse.json(
    { ...payload, requestId },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Request-Id': requestId,
      },
    },
  );
}

export async function POST(req: Request) {
  const requestId = randomUUID();

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse(requestId, { error: 'Unauthorized' }, 401);
    }

    const secret = authHeader.replace('Bearer ', '').trim();

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(requestId, { error: 'Invalid JSON payload' }, 400);
    }

    const parsed = statusPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(requestId, { error: 'Invalid payload schema' }, 400);
    }

    const { connectorId, status = 'online', version } = parsed.data;

    // Authenticate connector and derive tenant from database authority
    const authResult = await authenticateConnector(connectorId, secret);
    if (!authResult.success || !authResult.connector || !authResult.tenant) {
      return jsonResponse(requestId, { error: 'Unauthorized' }, 401);
    }

    // The payload timestamp is not authoritative. The server clock records
    // the heartbeat and prevents Connector clock skew.
    const receivedAt = new Date();
    const updateResult = await prisma.connector.updateMany({
      where: {
        id: authResult.connector.id,
        tenantId: authResult.tenant.id,
        enabled: true,
      },
      data: {
        lastSeenAt: receivedAt,
        status,
        version,
      },
    });

    if (updateResult.count !== 1) {
      console.warn('CONNECTOR_STATUS_NOT_PERSISTED', { requestId });
      return jsonResponse(requestId, { error: 'Heartbeat not persisted' }, 409);
    }

    return jsonResponse(requestId, {
      ok: true,
      receivedAt: receivedAt.toISOString(),
      connectorId: authResult.connector.id,
      tenantId: authResult.tenant.id,
    }, 200);
  } catch {
    // Do not log the error object: Prisma/PostgreSQL messages may contain SQL,
    // endpoints, or internal infrastructure details.
    console.error('CONNECTOR_STATUS_ERROR', { requestId });
    return jsonResponse(requestId, { error: 'Internal server error' }, 500);
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

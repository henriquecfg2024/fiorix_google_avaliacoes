import { NextResponse } from 'next/server';
import { authenticateConnector } from '@/lib/connectorAuth';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { recordConnectorTelemetry } from '@/lib/alerts/alert-storage';
import { dispatchAlert } from '@/lib/alerts/alert-dispatcher';

const sourceStateSchema = z.object({
  lastRunAt: z.string().nullable().optional(),
  lastSuccessAt: z.string().nullable().optional(),
  lastSqlRecords: z.number().int().nonnegative().optional(),
  lastRecordsSent: z.number().int().nonnegative().optional(),
  lastDurationMs: z.number().int().nonnegative().optional(),
  isRunning: z.boolean().optional(),
  lastError: z.string().nullable().optional(),
});

const statusPayloadSchema = z.object({
  connectorId: z.string().trim().min(1).max(128),
  version: z.string().trim().min(1).max(64).optional(),
  timestamp: z.string().datetime().optional(),
  status: z.enum(['online', 'degraded', 'offline']).optional(),
  uptimeSeconds: z.number().int().nonnegative().optional(),
  ramMb: z.number().int().nonnegative().optional(),
  shadowMode: z.boolean().optional(),
  queuePending: z.number().int().nonnegative().optional(),
  queueFailed: z.number().int().nonnegative().optional(),
  schedulerEnabled: z.boolean().optional(),
  sources: z.record(z.string(), sourceStateSchema).optional(),
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

    const {
      connectorId,
      status = 'online',
      version,
      sources,
      uptimeSeconds,
      ramMb,
      queuePending,
      queueFailed,
    } = parsed.data;

    // Authenticate connector and derive tenant from database authority
    const authResult = await authenticateConnector(connectorId, secret);
    if (!authResult.success || !authResult.connector || !authResult.tenant) {
      return jsonResponse(requestId, { error: 'Unauthorized' }, 401);
    }

    const tenantId = authResult.tenant.id;
    const resolvedConnectorId = authResult.connector.id;

    // Gravar snapshot de telemetria rica (RAM, Uptime, Filas SQLite)
    recordConnectorTelemetry({
      tenantId,
      connectorId: resolvedConnectorId,
      uptimeSeconds,
      ramMb,
      queuePending,
      queueFailed,
    }).catch((telemetryErr) => {
      console.warn('TELEMETRY_RECORD_WARN:', telemetryErr?.message);
    });

    // Se houver falhas acumuladas na fila local, notificar webhook se configurado
    if (queueFailed && queueFailed > 10) {
      dispatchAlert({
        tenantId,
        eventType: 'sync_failed',
        title: 'Fila local de sincronizações com falha',
        message: `O conector local no cartório possui ${queueFailed} pacotes com erro acumulados na fila local.`,
        severity: 'WARNING',
        metadata: {
          'Fila com Erros': queueFailed,
          'Fila Pendente': queuePending ?? 0,
          'Uptime': uptimeSeconds ? `${Math.round(uptimeSeconds / 60)} min` : 'Desconhecido',
        },
      }).catch(() => {});
    }

    // The payload timestamp is not authoritative. The server clock records
    // the heartbeat and prevents Connector clock skew.
    const receivedAt = new Date();
    const updateResult = await prisma.connector.updateMany({
      where: {
        id: resolvedConnectorId,
        tenantId,
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

    // Persistir estado das fontes (inclusive execuções vazias com 0 registros)
    if (sources && typeof sources === 'object') {
      const allowedSources = ['bi', 'produtividade', 'metas', 'tarefas'];
      for (const [sourceKey, sourceData] of Object.entries(sources)) {
        if (!allowedSources.includes(sourceKey)) continue;

        const lastSuccessDate = sourceData.lastSuccessAt ? new Date(sourceData.lastSuccessAt) : null;
        const lastRunDate = sourceData.lastRunAt ? new Date(sourceData.lastRunAt) : null;

        await prisma.connectorSourceStatus.upsert({
          where: {
            tenantId_connectorId_source: {
              tenantId,
              connectorId: resolvedConnectorId,
              source: sourceKey,
            },
          },
          update: {
            lastSyncAt: lastRunDate || receivedAt,
            lastSuccessAt: lastSuccessDate || undefined,
            recordsLastSync: sourceData.lastSqlRecords ?? 0,
            status: sourceData.lastError ? 'error' : 'healthy',
            lastError: sourceData.lastError ? sourceData.lastError.substring(0, 255) : null,
          },
          create: {
            tenantId,
            connectorId: resolvedConnectorId,
            source: sourceKey,
            lastSyncAt: lastRunDate || receivedAt,
            lastSuccessAt: lastSuccessDate,
            recordsLastSync: sourceData.lastSqlRecords ?? 0,
            status: sourceData.lastError ? 'error' : 'healthy',
            lastError: sourceData.lastError ? sourceData.lastError.substring(0, 255) : null,
          },
        }).catch((upsertErr) => {
          console.warn(`[Connector Status] Falha no upsert da fonte ${sourceKey}:`, upsertErr?.message);
        });
      }
    }

    return jsonResponse(requestId, {
      ok: true,
      receivedAt: receivedAt.toISOString(),
      connectorId: resolvedConnectorId,
      tenantId,
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

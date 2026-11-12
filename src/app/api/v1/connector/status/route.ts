import { NextResponse } from 'next/server';
import { authenticateConnector } from '@/lib/connectorAuth';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { recordConnectorTelemetry } from '@/lib/alerts/alert-storage';
import { dispatchAlert } from '@/lib/alerts/alert-dispatcher';
import { recordHealthSample } from '@/lib/health/health-samples';
import {
  processHeartbeatHaAndBuildDirective,
  type ConnectorDirectivePayload,
} from '@/lib/connector/ha-manager';

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
  heapMb: z.number().int().nonnegative().optional(),
  cpuPercent: z.number().nonnegative().max(100).nullable().optional(),
  shadowMode: z.boolean().optional(),
  queuePending: z.number().int().nonnegative().optional(),
  queueSending: z.number().int().nonnegative().optional(),
  queueFailed: z.number().int().nonnegative().optional(),
  queueQuarantined: z.number().int().nonnegative().optional(),
  schedulerEnabled: z.boolean().optional(),
  sources: z.record(z.string(), sourceStateSchema).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
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
  let tenantIdParaAmostra: string | null = null;

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
      heapMb,
      cpuPercent,
      shadowMode,
      schedulerEnabled,
      queuePending,
      queueSending,
      queueFailed,
      queueQuarantined,
      details,
    } = parsed.data;

    // Authenticate connector and derive tenant from database authority
    const authResult = await authenticateConnector(connectorId, secret);
    if (!authResult.success || !authResult.connector || !authResult.tenant) {
      return jsonResponse(requestId, { error: 'Unauthorized' }, 401);
    }

    const tenantId = authResult.tenant.id;
    tenantIdParaAmostra = tenantId;
    const resolvedConnectorId = authResult.connector.id;

    const mergedDetails: Record<string, unknown> | null =
      details ||
      heapMb !== undefined ||
      shadowMode !== undefined ||
      schedulerEnabled !== undefined ||
      queueSending !== undefined ||
      queueQuarantined !== undefined
        ? {
            ...(details ?? {}),
            ...(heapMb !== undefined ? { heapMb } : {}),
            ...(shadowMode !== undefined ? { shadowMode } : {}),
            ...(schedulerEnabled !== undefined ? { schedulerEnabled } : {}),
            ...(queueSending !== undefined ? { queueSending } : {}),
            ...(queueQuarantined !== undefined ? { queueQuarantined } : {}),
          }
        : null;

    // Gravar snapshot de telemetria rica (CPU, RAM, Uptime, Filas SQLite e Subsistemas)
    recordConnectorTelemetry({
      tenantId,
      connectorId: resolvedConnectorId,
      uptimeSeconds,
      ramMb,
      cpuPercent: cpuPercent ?? null,
      queuePending,
      queueFailed,
      details: mergedDetails,
    }).catch((telemetryErr) => {
      console.warn('TELEMETRY_RECORD_WARN:', telemetryErr?.message);
    });

    // Se houver falhas acumuladas ou itens em quarentena na fila local, notificar webhook se configurado
    if ((queueFailed && queueFailed > 10) || (queueQuarantined && queueQuarantined > 0)) {
      dispatchAlert({
        tenantId,
        eventType: 'sync_failed',
        title:
          queueQuarantined && queueQuarantined > 0
            ? 'Lotes em quarentena na fila local do Connector'
            : 'Fila local de sincronizações com falha',
        message:
          queueQuarantined && queueQuarantined > 0
            ? `O conector local possui ${queueQuarantined} lote(s) em quarentena e ${queueFailed ?? 0} pacote(s) com erro na fila SQLite.`
            : `O conector local no cartório possui ${queueFailed} pacotes com erro acumulados na fila local.`,
        severity: queueQuarantined && queueQuarantined > 0 ? 'CRITICAL' : 'WARNING',
        metadata: {
          'Fila em Quarentena': queueQuarantined ?? 0,
          'Fila com Erros': queueFailed ?? 0,
          'Fila Pendente': queuePending ?? 0,
          Uptime: uptimeSeconds ? `${Math.round(uptimeSeconds / 60)} min` : 'Desconhecido',
        },
      }).catch(() => {});
    }

    // The payload timestamp is not authoritative. The server clock records
    // the heartbeat and prevents Connector clock skew.
    const receivedAt = new Date();
    const inicioGravacao = performance.now();
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

    // Amostra real de tempo de resposta/disponibilidade do banco (aguardada: no serverless,
    // tarefas soltas após a resposta podem ser interrompidas; a função nunca lança erro)
    await recordHealthSample({
      tenantId,
      source: 'heartbeat',
      latencyMs: performance.now() - inicioGravacao,
      success: true,
      checkedAt: receivedAt,
    });

    if (updateResult.count !== 1) {
      console.warn('CONNECTOR_STATUS_NOT_PERSISTED', { requestId });
      return jsonResponse(requestId, { error: 'Heartbeat not persisted' }, 409);
    }

    // Persistir estado das fontes em lote único (evita até 7 roundtrips sequenciais por heartbeat)
    if (sources && typeof sources === 'object' && prisma.connectorSourceStatus?.upsert) {
      const allowedSources = ['bi', 'produtividade', 'metas', 'tarefas', 'retornos', 'impressoes', 'safras'];
      const upsertOperations = Object.entries(sources)
        .filter(([sourceKey]) => allowedSources.includes(sourceKey))
        .map(([sourceKey, sourceData]) => {
          const lastSuccessDate = sourceData.lastSuccessAt ? new Date(sourceData.lastSuccessAt) : null;
          const lastRunDate = sourceData.lastRunAt ? new Date(sourceData.lastRunAt) : null;
          const statusVal = sourceData.lastError ? 'error' : 'healthy';
          const lastErrorVal = sourceData.lastError ? sourceData.lastError.substring(0, 255) : null;

          return prisma.connectorSourceStatus.upsert({
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
              status: statusVal,
              lastError: lastErrorVal,
            },
            create: {
              tenantId,
              connectorId: resolvedConnectorId,
              source: sourceKey,
              lastSyncAt: lastRunDate || receivedAt,
              lastSuccessAt: lastSuccessDate,
              recordsLastSync: sourceData.lastSqlRecords ?? 0,
              status: statusVal,
              lastError: lastErrorVal,
            },
          });
        });

      if (upsertOperations.length > 0) {
        try {
          if (typeof (prisma as any).$transaction === 'function') {
            await prisma.$transaction(upsertOperations);
          } else {
            await Promise.all(upsertOperations);
          }
        } catch (upsertErr: any) {
          console.warn('[Connector Status] Falha no upsert em lote das fontes:', upsertErr?.message);
        }
      }
    }

    // Processa Alta Disponibilidade (ACTIVE/STANDBY/PAUSED), cursores em nuvem e Auto-Updater
    let directive: ConnectorDirectivePayload | undefined;
    try {
      directive = await processHeartbeatHaAndBuildDirective({
        tenantId,
        connectorId: resolvedConnectorId,
        reportedVersion: version ?? authResult.connector.version ?? null,
        details: mergedDetails,
      });
    } catch (haErr: any) {
      console.warn('[Connector Status] Falha transitória ao calcular diretiva HA:', haErr?.message);
    }

    return jsonResponse(
      requestId,
      {
        ok: true,
        receivedAt: receivedAt.toISOString(),
        connectorId: resolvedConnectorId,
        tenantId,
        ...(directive ? { directive } : {}),
      },
      200,
    );
  } catch {
    // Do not log the error object: Prisma/PostgreSQL messages may contain SQL,
    // endpoints, or internal infrastructure details.
    console.error('CONNECTOR_STATUS_ERROR', { requestId });
    if (tenantIdParaAmostra) {
      await recordHealthSample({
        tenantId: tenantIdParaAmostra,
        source: 'heartbeat',
        latencyMs: null,
        success: false,
        detail: 'Erro interno ao processar o sinal do conector (HTTP 500)',
      });
    }
    return jsonResponse(requestId, { error: 'Internal server error' }, 500);
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

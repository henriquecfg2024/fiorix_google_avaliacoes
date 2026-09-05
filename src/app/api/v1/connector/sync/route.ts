import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateConnector } from '@/lib/connectorAuth';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { unpackLiveRecords } from '@/lib/connector/unpack-live';

const syncPayloadSchema = z.object({
  // Legacy clients may send this field, but it never selects the tenant.
  tenant_id: z.string().optional(),
  connector_id: z.string(),
  source: z.enum(['bi', 'produtividade', 'metas', 'tarefas']),
  batch_id: z.string(),
  generated_at: z.string().datetime(),
  records: z.array(z.any()), // Pode ser detalhado futuramente
  chunk_index: z.number().int().nonnegative().optional().default(0),
  chunk_count: z.number().int().positive().optional().default(1),
  sync_mode: z.enum(['full', 'incremental', 'reconciliation']).optional().default('full'),
}).superRefine(({ chunk_index, chunk_count }, ctx) => {
  if (chunk_index >= chunk_count) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid chunk range', path: ['chunk_index'] });
  }
}).superRefine(({ sync_mode, records }, ctx) => {
  if (sync_mode !== 'full' && records.some((record) => typeof record !== 'object' || record === null || typeof record.record_key !== 'string' || record.record_key.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Incremental records require record_key', path: ['records'] });
  }
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('CONNECTOR_AUTH_FAILURE: Missing or invalid Authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secret = authHeader.replace('Bearer ', '').trim();

    // Parse the body
    let body;
    try {
      body = await req.json();
    } catch (err) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Validate schema
    const parsed = syncPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload schema', details: parsed.error.issues }, { status: 400 });
    }

    const { tenant_id, connector_id, source, batch_id, generated_at, records, chunk_index, chunk_count, sync_mode } = parsed.data;

    // Authenticate connector
    const authResult = await authenticateConnector(connector_id, secret);
    if (!authResult.success || !authResult.connector || !authResult.tenant) {
      console.warn(`CONNECTOR_AUTH_FAILURE: ${authResult.error} for connector ${connector_id}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authenticatedTenantId = authResult.connector.tenantId;
    if (!authenticatedTenantId) {
      console.warn(`CONNECTOR_AUTH_FAILURE: Connector ${connector_id} has no tenant`);
      return NextResponse.json({ error: 'Connector tenant is not configured' }, { status: 401 });
    }

    // A legacy tenant_id is only an assertion: the authenticated Connector
    // always determines the effective tenant.
    if (tenant_id !== undefined && tenant_id !== authenticatedTenantId) {
      console.warn(`CONNECTOR_AUTH_FAILURE: Tenant mismatch for connector ${connector_id}. Expected ${authResult.connector.tenantId}, got ${tenant_id}`);
      return NextResponse.json({ error: 'Tenant mismatch' }, { status: 403 });
    }

    const tenantId = authenticatedTenantId;

    console.info(`SYNC_RECEIVED: Tenant ${tenantId}, Connector ${connector_id}, Source ${source}, Batch ${batch_id}`);

    // Resolve batch metadata before opening a transaction. In Neon transaction
    // pooling, keeping JSON persistence and authentication inside an interactive
    // transaction can monopolize the available database connections.
    const startTime = Date.now();
    let batch = await prisma.connectorSyncBatch.findUnique({
      where: {
        tenantId_connectorId_source_batchId: {
          tenantId,
          connectorId: connector_id,
          source,
          batchId: batch_id,
        }
      }
    });

    if (!batch) {
      try {
        batch = await prisma.connectorSyncBatch.create({
          data: {
            tenantId,
            connectorId: connector_id,
            source,
            batchId: batch_id,
            generatedAt: new Date(generated_at),
            status: 'receiving',
            recordsReceived: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            chunkCount: chunk_count,
            chunksReceived: 0,
            syncMode: sync_mode,
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        batch = await prisma.connectorSyncBatch.findUnique({
          where: {
            tenantId_connectorId_source_batchId: {
              tenantId,
              connectorId: connector_id,
              source,
              batchId: batch_id,
            }
          }
        });
      }
    }

    if (!batch) throw new Error('BATCH_NOT_AVAILABLE');
    if (batch.chunkCount !== chunk_count) throw new Error('CHUNK_COUNT_MISMATCH');
    if (batch.syncMode !== sync_mode) throw new Error('SYNC_MODE_MISMATCH');

    // This upsert is idempotent and intentionally runs outside the interactive
    // transaction. A retry can safely execute it again without holding a pool
    // connection while the remaining bookkeeping is performed.
    if (sync_mode !== 'full' && records.length > 0) {
      const recordsJson = JSON.stringify(records);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "ConnectorSyncRecord" (
          "tenantId", "connectorId", "source", "recordKey", "record", "syncMode", "createdAt", "updatedAt"
        )
        SELECT
          ${tenantId}, ${connector_id}, ${source}, item->>'record_key', item, ${sync_mode}, NOW(), NOW()
        FROM jsonb_array_elements(${recordsJson}::jsonb) AS item
        ON CONFLICT ("tenantId", "connectorId", "source", "recordKey")
        DO UPDATE SET
          "record" = EXCLUDED."record",
          "syncMode" = EXCLUDED."syncMode",
          "updatedAt" = NOW()
      `);
    }

    // Only the idempotency marker and counters need atomicity. Keeping this
    // transaction small prevents one import from blocking every other request.
    const result = await prisma.$transaction(async (tx) => {
      const existingChunk = await tx.connectorSyncStaging.findUnique({
        where: {
          tenantId_connectorId_source_batchId_chunkIndex: {
            tenantId,
            connectorId: connector_id,
            source,
            batchId: batch_id,
            chunkIndex: chunk_index,
          }
        }
      });

      if (existingChunk) {
        return { alreadyProcessed: true, batch };
      }

      await tx.connectorSyncStaging.create({
        data: {
          tenantId,
          connectorId: connector_id,
          source,
          batchId: batch_id,
          records,
          chunkIndex: chunk_index,
          chunkCount: chunk_count,
          syncMode: sync_mode,
        }
      });

      const incrementedBatch = await tx.connectorSyncBatch.update({
        where: { id: batch.id },
        data: {
          chunksReceived: { increment: 1 },
          recordsReceived: { increment: records.length },
          recordsInserted: { increment: records.length },
        }
      });

      const completed = incrementedBatch.chunksReceived === chunk_count;
      const status = completed ? 'completed' : 'partial';
      const finalizedBatch = await tx.connectorSyncBatch.update({
        where: { id: batch.id },
        data: {
          status,
          processedAt: completed ? new Date() : null,
          durationMs: completed ? Date.now() - startTime : null,
        }
      });

      return { alreadyProcessed: false, batch: finalizedBatch };
    }, { timeout: 10000, maxWait: 10000 });

    if (result.alreadyProcessed) {
      console.info(`SYNC_DUPLICATE: Chunk ${chunk_index} of batch ${batch_id} already processed`);
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        batch_id,
        chunk_index,
        chunk_count,
        recordsReceived: result.batch.recordsReceived,
        status: result.batch.status,
      });
    }

    // Descarrega registros em tempo real diretamente para as tabelas de dashboard
    unpackLiveRecords({ tenantId, source, records }).catch((err) => {
      console.error('LIVE_UNPACK_ERROR:', err);
    });

    const now = new Date();
    const completed = result.batch.status === 'completed';
    try {
      await prisma.connector.update({
        where: { id: connector_id },
        data: { lastSeenAt: now }
      });
    } catch (error) {
      console.warn('SYNC_METADATA_WARNING: lastSeenAt update failed', error);
    }
    try {
      await prisma.connectorSourceStatus.upsert({
        where: {
          tenantId_connectorId_source: {
            tenantId,
            connectorId: connector_id,
            source,
          }
        },
        update: {
          lastSyncAt: now,
          lastSuccessAt: completed ? now : undefined,
          recordsLastSync: result.batch.recordsReceived,
          status: completed ? 'healthy' : 'partial',
          lastError: null,
        },
        create: {
          tenantId,
          connectorId: connector_id,
          source,
          lastSyncAt: now,
          lastSuccessAt: completed ? now : null,
          recordsLastSync: result.batch.recordsReceived,
          status: completed ? 'healthy' : 'partial',
        }
      });
    } catch (error) {
      console.warn('SYNC_METADATA_WARNING: source status update failed', error);
    }

    console.info(`SYNC_SUCCESS: Batch ${batch_id} processed successfully`);

    return NextResponse.json({
      success: true,
      alreadyProcessed: false,
      batch_id,
      chunk_index,
      chunk_count,
      recordsReceived: result.batch.recordsReceived,
      status: result.batch.status,
    });

  } catch (error) {
    console.error('SYNC_ERROR: Unexpected error processing sync', error);
    // Don't leak stack traces
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

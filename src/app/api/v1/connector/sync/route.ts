import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateConnector } from '@/lib/connectorAuth';
import { z } from 'zod';

const syncPayloadSchema = z.object({
  // Legacy clients may send this field, but it never selects the tenant.
  tenant_id: z.string().optional(),
  connector_id: z.string(),
  source: z.enum(['bi', 'produtividade', 'metas', 'tarefas']),
  batch_id: z.string(),
  generated_at: z.string().datetime(),
  records: z.array(z.any()), // Pode ser detalhado futuramente
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
      return NextResponse.json({ error: 'Invalid payload schema', details: parsed.error.errors }, { status: 400 });
    }

    const { tenant_id, connector_id, source, batch_id, generated_at, records } = parsed.data;

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

    // Update connector lastSeenAt
    await prisma.connector.update({
      where: { id: connector_id },
      data: { lastSeenAt: new Date() }
    });

    // Check Idempotency
    const existingBatch = await prisma.connectorSyncBatch.findUnique({
      where: {
        tenantId_connectorId_source_batchId: {
          tenantId,
          connectorId: connector_id,
          source: source,
          batchId: batch_id
        }
      }
    });

    if (existingBatch) {
      console.info(`SYNC_DUPLICATE: Batch ${batch_id} already processed`);
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        batch_id
      });
    }

    // Process new batch in a transaction
    const startTime = Date.now();

    await prisma.$transaction(async (tx) => {
      // 1. Insert into Staging
      await tx.connectorSyncStaging.create({
        data: {
          tenantId,
          connectorId: connector_id,
          source: source,
          batchId: batch_id,
          records: records,
        }
      });

      // 2. Insert Batch Log
      await tx.connectorSyncBatch.create({
        data: {
          tenantId,
          connectorId: connector_id,
          source: source,
          batchId: batch_id,
          generatedAt: new Date(generated_at),
          receivedAt: new Date(),
          processedAt: new Date(),
          status: 'processed',
          recordsReceived: records.length,
          recordsInserted: records.length, // For now, we just insert all to staging
          recordsUpdated: 0,
          durationMs: Date.now() - startTime,
        }
      });

      // 3. Upsert Source Status
      const now = new Date();
      await tx.connectorSourceStatus.upsert({
        where: {
          tenantId_connectorId_source: {
            tenantId,
            connectorId: connector_id,
            source: source
          }
        },
        update: {
          lastSyncAt: now,
          lastSuccessAt: now,
          recordsLastSync: records.length,
          status: 'healthy',
          lastError: null
        },
        create: {
          tenantId,
          connectorId: connector_id,
          source: source,
          lastSyncAt: now,
          lastSuccessAt: now,
          recordsLastSync: records.length,
          status: 'healthy'
        }
      });
    });

    console.info(`SYNC_SUCCESS: Batch ${batch_id} processed successfully`);

    return NextResponse.json({
      success: true,
      alreadyProcessed: false,
      batch_id,
      recordsReceived: records.length
    });

  } catch (error) {
    console.error('SYNC_ERROR: Unexpected error processing sync', error);
    // Don't leak stack traces
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

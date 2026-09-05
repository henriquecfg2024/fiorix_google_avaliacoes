import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { sanitizeDatabaseError } from '@/lib/health/operations-service';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const tenantId = user.tenantId;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get('pageSize') || '20', 10)));
    const source = searchParams.get('source') || undefined;
    const status = searchParams.get('status') || undefined;
    const syncMode = searchParams.get('syncMode') || undefined;
    const search = searchParams.get('search')?.trim() || undefined;

    const where: Prisma.ConnectorSyncBatchWhereInput = {
      tenantId,
      ...(source && source !== 'all' ? { source } : {}),
      ...(status && status !== 'all' ? { status } : {}),
      ...(syncMode && syncMode !== 'all' ? { syncMode } : {}),
      ...(search
        ? {
            batchId: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [total, batches] = await Promise.all([
      prisma.connectorSyncBatch.count({ where }),
      prisma.connectorSyncBatch.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          batchId: true,
          source: true,
          status: true,
          syncMode: true,
          recordsReceived: true,
          recordsInserted: true,
          recordsUpdated: true,
          durationMs: true,
          chunkCount: true,
          chunksReceived: true,
          generatedAt: true,
          receivedAt: true,
          processedAt: true,
          errorMessage: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        batches: batches.map((b) => ({
          ...b,
          generatedAt: b.generatedAt.toISOString(),
          receivedAt: b.receivedAt.toISOString(),
          processedAt: b.processedAt ? b.processedAt.toISOString() : null,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    if (error.message?.includes('Acesso negado') || error.message?.includes('Não autorizado') || error.message?.includes('Sessão')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const sanitized = sanitizeDatabaseError(error);
    return NextResponse.json({ error: sanitized.message, code: sanitized.code }, { status: 500 });
  }
}

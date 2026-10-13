import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { sanitizeDatabaseError } from '@/lib/health/operations-service';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

function getDateBounds(period?: string, startDate?: string, endDate?: string): { gte?: Date; lte?: Date } | null {
  const now = new Date();
  if (startDate || endDate) {
    return {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
  }
  if (!period || period === 'all') return null;

  if (period === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { gte: today };
  }
  if (period === 'yesterday') {
    const startYesterday = new Date();
    startYesterday.setDate(startYesterday.getDate() - 1);
    startYesterday.setHours(0, 0, 0, 0);
    const endYesterday = new Date();
    endYesterday.setDate(endYesterday.getDate() - 1);
    endYesterday.setHours(23, 59, 59, 999);
    return { gte: startYesterday, lte: endYesterday };
  }
  if (period === '7d') {
    const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { gte: d };
  }
  if (period === '30d') {
    const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { gte: d };
  }
  return null;
}

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
    const period = searchParams.get('period') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const isExport = searchParams.get('export') === 'csv';

    const where: Prisma.ConnectorSyncBatchWhereInput = {
      tenantId,
      ...(source && source !== 'all' ? { source: { equals: source, mode: 'insensitive' } } : {}),
      ...(status && status !== 'all' ? { status: { equals: status, mode: 'insensitive' } } : {}),
      ...(syncMode && syncMode !== 'all' ? { syncMode: { equals: syncMode, mode: 'insensitive' } } : {}),
    };

    const dateBounds = getDateBounds(period, startDate, endDate);
    if (dateBounds) {
      where.receivedAt = dateBounds;
    }

    if (search) {
      where.OR = [
        { batchId: { contains: search, mode: 'insensitive' } },
        { id: { equals: search } },
        { errorMessage: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Exportação em formato CSV
    if (isExport) {
      const exportBatches = await prisma.connectorSyncBatch.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: 2000,
        select: {
          batchId: true,
          source: true,
          syncMode: true,
          status: true,
          recordsReceived: true,
          recordsInserted: true,
          recordsUpdated: true,
          durationMs: true,
          chunkCount: true,
          generatedAt: true,
          receivedAt: true,
          processedAt: true,
          errorMessage: true,
        },
      });

      const header = 'Batch ID,Modulo,Modo,Status,Registros Recebidos,Novos Inseridos,Atualizados,Chunks,Duracao (ms),Gerado no Cartorio,Recebido no SaaS,Processado em,Mensagem de Erro\r\n';
      const rows = exportBatches
        .map((b) =>
          [
            `"${b.batchId}"`,
            `"${b.source.toUpperCase()}"`,
            `"${b.syncMode.toUpperCase()}"`,
            `"${b.status.toUpperCase()}"`,
            b.recordsReceived,
            b.recordsInserted,
            b.recordsUpdated,
            b.chunkCount,
            b.durationMs ?? '',
            `"${b.generatedAt.toISOString()}"`,
            `"${b.receivedAt.toISOString()}"`,
            b.processedAt ? `"${b.processedAt.toISOString()}"` : '""',
            `"${(b.errorMessage || '').replace(/"/g, '""')}"`,
          ].join(';')
        )
        .join('\r\n');

      return new Response('\uFEFF' + header + rows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="auditoria_lotes_fiorix_${new Date().toISOString().split('T')[0]}.csv"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    const [total, aggregates, errorCount, batches] = await Promise.all([
      prisma.connectorSyncBatch.count({ where }),
      prisma.connectorSyncBatch.aggregate({
        where,
        _sum: {
          recordsReceived: true,
          recordsInserted: true,
          recordsUpdated: true,
        },
        _avg: {
          durationMs: true,
        },
      }),
      prisma.connectorSyncBatch.count({
        where: { ...where, status: 'error' },
      }),
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

    const totalRecords = aggregates._sum.recordsReceived || 0;
    const avgDurationMs = aggregates._avg.durationMs ? Math.round(aggregates._avg.durationMs) : null;
    const successRate = total > 0 ? Math.round(((total - errorCount) / total) * 1000) / 10 : 100;

    return NextResponse.json(
      {
        batches: batches.map((b) => ({
          ...b,
          generatedAt: b.generatedAt.toISOString(),
          receivedAt: b.receivedAt.toISOString(),
          processedAt: b.processedAt ? b.processedAt.toISOString() : null,
        })),
        summary: {
          totalBatches: total,
          totalRecords,
          recordsInserted: aggregates._sum.recordsInserted || 0,
          recordsUpdated: aggregates._sum.recordsUpdated || 0,
          errorBatches: errorCount,
          avgDurationMs,
          successRate,
        },
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

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { sanitizeDatabaseError } from '@/lib/health/operations-service';

export const dynamic = 'force-dynamic';

export interface TelemetryPoint {
  timestamp: string;
  label: string;
  bi: number;
  produtividade: number;
  metas: number;
  tarefas: number;
  totalRecords: number;
  batchCount: number;
  avgDurationMs: number;
}

export interface TelemetryHistoryResponse {
  range: '24h' | '7d' | '30d';
  summary: {
    totalBatches: number;
    totalRecords: number;
    avgDurationMs: number;
    successRatePercent: number;
  };
  timeline: TelemetryPoint[];
  sourceDistribution: {
    source: string;
    records: number;
    batches: number;
  }[];
}

export async function GET(req: Request) {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const tenantId = user.tenantId;

    const { searchParams } = new URL(req.url);
    const rangeParam = searchParams.get('range') || '24h';
    const range = (['24h', '7d', '30d'].includes(rangeParam) ? rangeParam : '24h') as '24h' | '7d' | '30d';

    const now = new Date();
    let startDate: Date;
    let truncLevel: 'hour' | 'day';

    if (range === '24h') {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      truncLevel = 'hour';
    } else if (range === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      truncLevel = 'day';
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      truncLevel = 'day';
    }

    // Consulta agregada de lotes agrupados por período e fonte
    const rawAggregates = await prisma.$queryRawUnsafe<
      Array<{
        bucket: Date;
        source: string;
        batch_count: number | bigint;
        total_records: number | bigint;
        avg_duration_ms: number | bigint | null;
      }>
    >(
      `
      SELECT
        date_trunc($1, "receivedAt") as bucket,
        "source",
        COUNT(*)::int as batch_count,
        COALESCE(SUM("recordsReceived"), 0)::int as total_records,
        ROUND(AVG(COALESCE("durationMs", 0)))::int as avg_duration_ms
      FROM "ConnectorSyncBatch"
      WHERE "tenantId" = $2
        AND "receivedAt" >= $3
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `,
      truncLevel,
      tenantId,
      startDate
    );

    // Consulta de estatísticas gerais do período
    const rawSummary = await prisma.$queryRawUnsafe<
      Array<{
        total_batches: number | bigint;
        total_records: number | bigint;
        avg_duration_ms: number | bigint | null;
        successful_batches: number | bigint;
      }>
    >(
      `
      SELECT
        COUNT(*)::int as total_batches,
        COALESCE(SUM("recordsReceived"), 0)::int as total_records,
        ROUND(AVG(COALESCE("durationMs", 0)))::int as avg_duration_ms,
        COUNT(CASE WHEN "status" = 'completed' THEN 1 END)::int as successful_batches
      FROM "ConnectorSyncBatch"
      WHERE "tenantId" = $1
        AND "receivedAt" >= $2
    `,
      tenantId,
      startDate
    );

    const summaryRow = rawSummary[0] || {
      total_batches: 0,
      total_records: 0,
      avg_duration_ms: 0,
      successful_batches: 0,
    };

    const totalBatches = Number(summaryRow.total_batches || 0);
    const totalRecords = Number(summaryRow.total_records || 0);
    const avgDurationMs = Number(summaryRow.avg_duration_ms || 0);
    const successfulBatches = Number(summaryRow.successful_batches || 0);
    const successRatePercent = totalBatches > 0 ? Math.round((successfulBatches / totalBatches) * 1000) / 10 : 100;

    // Agrupar os buckets temporais para o gráfico Recharts
    const bucketMap = new Map<string, TelemetryPoint>();

    // Inicializar pontos do período para garantir gráfico contínuo
    if (range === '24h') {
      for (let i = 24; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        d.setMinutes(0, 0, 0);
        const iso = d.toISOString();
        const label = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        bucketMap.set(iso, {
          timestamp: iso,
          label,
          bi: 0,
          produtividade: 0,
          metas: 0,
          tarefas: 0,
          totalRecords: 0,
          batchCount: 0,
          avgDurationMs: 0,
        });
      }
    } else {
      const daysCount = range === '7d' ? 7 : 30;
      for (let i = daysCount; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        d.setHours(0, 0, 0, 0);
        const iso = d.toISOString();
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
        bucketMap.set(iso, {
          timestamp: iso,
          label,
          bi: 0,
          produtividade: 0,
          metas: 0,
          tarefas: 0,
          totalRecords: 0,
          batchCount: 0,
          avgDurationMs: 0,
        });
      }
    }

    // Preencher com os dados reais agrupados
    const sourceTotals: Record<string, { records: number; batches: number }> = {
      bi: { records: 0, batches: 0 },
      produtividade: { records: 0, batches: 0 },
      metas: { records: 0, batches: 0 },
      tarefas: { records: 0, batches: 0 },
    };

    for (const row of rawAggregates) {
      const bDate = new Date(row.bucket);
      if (truncLevel === 'hour') {
        bDate.setMinutes(0, 0, 0);
      } else {
        bDate.setHours(0, 0, 0, 0);
      }
      const isoKey = bDate.toISOString();
      const records = Number(row.total_records || 0);
      const batches = Number(row.batch_count || 0);
      const duration = Number(row.avg_duration_ms || 0);
      const src = (row.source || '').toLowerCase();

      if (!bucketMap.has(isoKey)) {
        const label =
          truncLevel === 'hour'
            ? bDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
            : bDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
        bucketMap.set(isoKey, {
          timestamp: isoKey,
          label,
          bi: 0,
          produtividade: 0,
          metas: 0,
          tarefas: 0,
          totalRecords: 0,
          batchCount: 0,
          avgDurationMs: 0,
        });
      }

      const point = bucketMap.get(isoKey)!;
      if (src === 'bi') point.bi += records;
      else if (src === 'produtividade') point.produtividade += records;
      else if (src === 'metas') point.metas += records;
      else if (src === 'tarefas') point.tarefas += records;

      point.totalRecords += records;
      point.batchCount += batches;
      if (point.avgDurationMs === 0) {
        point.avgDurationMs = duration;
      } else {
        point.avgDurationMs = Math.round((point.avgDurationMs + duration) / 2);
      }

      if (sourceTotals[src]) {
        sourceTotals[src].records += records;
        sourceTotals[src].batches += batches;
      }
    }

    const timeline = Array.from(bucketMap.values());

    const sourceDistribution = Object.entries(sourceTotals).map(([source, data]) => ({
      source,
      records: data.records,
      batches: data.batches,
    }));

    const responseData: TelemetryHistoryResponse = {
      range,
      summary: {
        totalBatches,
        totalRecords,
        avgDurationMs,
        successRatePercent,
      },
      timeline,
      sourceDistribution,
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    if (error.message?.includes('Acesso negado') || error.message?.includes('Não autorizado') || error.message?.includes('Sessão')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const sanitized = sanitizeDatabaseError(error);
    return NextResponse.json({ error: sanitized.message, code: sanitized.code }, { status: 500 });
  }
}

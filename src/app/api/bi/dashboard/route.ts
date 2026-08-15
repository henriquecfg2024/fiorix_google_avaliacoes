import { NextResponse } from 'next/server';

import { requireTenant } from '@/lib/auth-helpers';
import { queryBiDashboardData, queryBiImportsList } from '@/lib/bi-dashboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const user = await requireTenant();

    const { searchParams } = new URL(request.url);
    const requestedImportId = searchParams.get('importId') || undefined;
    const includeSummary = searchParams.get('includeSummary') !== '0';
    const imports = (includeSummary || requestedImportId === 'LATEST')
      ? await queryBiImportsList(user.tenantId)
      : [];
    const filters = {
      importId: requestedImportId === 'LATEST' ? imports[0]?.id : requestedImportId,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      tipoPrenotacao: searchParams.get('tipoPrenotacao') || undefined,
      enabledCharts: searchParams.get('charts')?.split(',').filter(Boolean),
      includeSummary,
    };

    const dashboard = await queryBiDashboardData(user.tenantId, filters);

    return NextResponse.json(
      {
        success: true,
        dashboard,
        imports: imports.map((row: any) => ({
          ...row,
          importedAt: row.importedAt ? new Date(row.importedAt).toISOString() : null,
        })),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in BI dashboard API route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao carregar dashboard BI' },
      { status: 500 }
    );
  }
}


import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { queryBiDashboardData, queryBiImportsList } from '@/lib/bi-dashboard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      importId: searchParams.get('importId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      tipoPrenotacao: searchParams.get('tipoPrenotacao') || undefined,
    };

    const [dashboard, imports] = await Promise.all([
      queryBiDashboardData(filters),
      queryBiImportsList(),
    ]);

    return NextResponse.json(
      {
        success: true,
        dashboard,
        imports: imports.map((row) => ({
          ...row,
          importedAt: row.importedAt.toISOString(),
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

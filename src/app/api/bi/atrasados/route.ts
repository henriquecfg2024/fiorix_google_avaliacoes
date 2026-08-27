import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-helpers';
import { queryBiAtrasadosList } from '@/lib/bi-dashboard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const user = await requireTenant();
    const { searchParams } = new URL(request.url);
    const filters = {
      importId: searchParams.get('importId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      tipoPrenotacao: searchParams.get('tipoPrenotacao') || undefined,
      page: Number(searchParams.get('page')) || 1,
      pageSize: Number(searchParams.get('pageSize')) || 20,
      search: searchParams.get('search') || '',
      rangeIndex: Number(searchParams.get('rangeIndex')) || 0,
      queryMode: (searchParams.get('queryMode') as 'atrasado' | 'full') || 'atrasado',
      statusFilter: searchParams.get('statusFilter') || undefined,
      servicoFilter: searchParams.get('servicoFilter') || undefined,
    };

    const data = await queryBiAtrasadosList(user.tenantId, filters);

    return NextResponse.json(
      {
        success: true,
        ...data,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in BI atrasados API route:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao carregar lista de títulos atrasados' },
      { status: 500 }
    );
  }
}


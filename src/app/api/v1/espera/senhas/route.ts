import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { getEsperaData } from '@/lib/espera/espera-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole('MASTER', 'ADMIN', 'SUBSTITUTO');
    const tenantId = user.tenantId;

    const periodo = req.nextUrl.searchParams.get('periodo') || 'hoje';
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === 'true';

    const data = await getEsperaData(tenantId, periodo, forceRefresh);
    return NextResponse.json(data);
  } catch (err: any) {
    if (err.message?.includes('Acesso negado') || err.message?.includes('Não autorizado')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[Espera API] Erro interno:', err.message);
    return NextResponse.json({
      configured: false,
      records: [],
      slaMinutes: 15,
      lastSyncAt: null,
      error: 'Erro interno ao carregar dados de espera.',
    }, { status: 500 });
  }
}

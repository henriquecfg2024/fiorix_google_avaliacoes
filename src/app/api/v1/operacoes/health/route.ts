import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { getOperationsHealth } from '@/lib/health/operations-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const health = await getOperationsHealth(user.tenantId);
    return NextResponse.json(health);
  } catch (error: any) {
    if (error.message?.includes('Acesso negado') || error.message?.includes('Não autorizado')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('OPERATIONS_HEALTH_ERROR:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

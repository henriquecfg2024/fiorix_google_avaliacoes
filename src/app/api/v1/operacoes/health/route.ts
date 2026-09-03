import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { getOperationsHealth, sanitizeDatabaseError } from '@/lib/health/operations-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const health = await getOperationsHealth(user.tenantId);

    return NextResponse.json(health, {
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

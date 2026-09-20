import { NextResponse } from 'next/server';
import { getVapidPublicKey } from '@/lib/webpush';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth();
    const publicKey = getVapidPublicKey();
    return NextResponse.json({ publicKey });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Não autorizado' },
      { status: 401 }
    );
  }
}

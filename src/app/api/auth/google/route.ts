import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getGoogleAuthUrl } from '@/lib/google';

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.tenantId || !session?.user?.role || session.user.role !== 'MASTER') {
    return NextResponse.json({ error: 'Apenas o usuário MASTER pode conectar ou reconectar a conta do Google.' }, { status: 403 });
  }

  const tenantId = session.user.tenantId as string;
  const url = getGoogleAuthUrl(tenantId);
  
  return NextResponse.redirect(url);
}

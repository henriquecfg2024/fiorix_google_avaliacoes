import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    await requireRole('MASTER');
    // Redireciona para a rota oficial autenticada com state assinado via HMAC-SHA256
    return NextResponse.redirect(new URL('/api/auth/google', request.url));
  } catch {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
  }
}

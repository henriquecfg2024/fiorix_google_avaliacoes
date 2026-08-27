import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { getGoogleAuthUrl } from '@/lib/google';

export async function GET() {
  const user = await requireRole('MASTER');

  const { url, nonce } = getGoogleAuthUrl(user.tenantId);

  const response = NextResponse.redirect(url);

  // Cookie HttpOnly com nonce para validação CSRF no callback
  response.cookies.set('google_oauth_state', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutos
    path: '/api/auth/callback/google',
  });

  return response;
}

import { NextResponse } from 'next/server';

/**
 * Rota legada desativada por segurança (CRIT-05).
 * O fluxo oficial OAuth utiliza exclusivamente /api/auth/google e /api/auth/callback/google
 * com validação estrita de sessão MASTER e state assinado criptograficamente (HMAC-SHA256).
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Fluxo legado de callback OAuth desativado. Utilize /api/auth/google.',
    },
    { status: 410 }
  );
}

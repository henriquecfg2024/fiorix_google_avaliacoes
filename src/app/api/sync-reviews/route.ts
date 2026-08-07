import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { syncReviews } from '@/lib/google';

export const maxDuration = 60; // Increase timeout on Vercel Pro


async function handleSync(request: Request) {
  const session = await auth();
  
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const tenantId = session.user.tenantId as string;
  const acceptHeader = request.headers.get('accept') || '';
  const isJson = acceptHeader.includes('application/json');

  try {
    const result = await syncReviews(tenantId, session.user.email || session.user.name || undefined);

    if (isJson) {
      return NextResponse.json({ success: true, count: result.count });
    }

    return NextResponse.redirect(new URL(`/configuracoes?synced=${result.count}`, request.url));
  } catch (error: any) {
    console.error('Sync Error:', error);

    const errorMessage = error?.message || 'Erro desconhecido ao tentar sincronizar as avaliações.';

    if (isJson) {
      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }

    return NextResponse.redirect(new URL(`/configuracoes?syncError=${encodeURIComponent(errorMessage)}`, request.url));
  }
}

export async function POST(request: Request) {
  return handleSync(request);
}

export async function GET(request: Request) {
  return handleSync(request);
}

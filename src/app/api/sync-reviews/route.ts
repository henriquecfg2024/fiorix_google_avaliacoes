import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { syncReviews } from '@/lib/google';

export const maxDuration = 60; // Increase timeout on Vercel Pro

export async function POST(request: Request) {
  try {
    const user = await requireRole('ADMIN', 'MASTER');

    const tenantId = user.tenantId;
    const acceptHeader = request.headers.get('accept') || '';
    const isJson = acceptHeader.includes('application/json');

    const result = await syncReviews(tenantId, user.email || user.name || undefined);

    if (isJson) {
      return NextResponse.json({ success: true, count: result.count });
    }

    return NextResponse.redirect(new URL(`/configuracoes?synced=${result.count}`, request.url));
  } catch (error: any) {
    console.error('Sync Error:', error);

    const acceptHeader = request.headers.get('accept') || '';
    const isJson = acceptHeader.includes('application/json');

    if (isJson) {
      return NextResponse.json({ success: false, error: 'Erro ao sincronizar avaliações.' }, { status: 500 });
    }

    return NextResponse.redirect(new URL('/configuracoes?syncError=Erro+ao+sincronizar', request.url));
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { syncReviews } from '@/lib/google';

async function handleSync(request: Request) {
  const session = await auth();
  
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const tenantId = session.user.tenantId as string;
  const acceptHeader = request.headers.get('accept') || '';
  const isJson = acceptHeader.includes('application/json');

  try {
    const result = await syncReviews(tenantId);

    if (isJson) {
      return NextResponse.json({ success: true, count: result.count });
    }

    return NextResponse.redirect(new URL(`/configuracoes?synced=${result.count}`, request.url));
  } catch (error: any) {
    console.error('Sync Error:', error);

    if (isJson) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.redirect(new URL(`/configuracoes?syncError=${encodeURIComponent(error.message)}`, request.url));
  }
}

export async function POST(request: Request) {
  return handleSync(request);
}

export async function GET(request: Request) {
  return handleSync(request);
}

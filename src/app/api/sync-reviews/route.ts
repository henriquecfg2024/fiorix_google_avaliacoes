import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { syncReviews } from '@/lib/google';

export async function POST(request: Request) {
  const session = await auth();
  
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const tenantId = session.user.tenantId as string;

  try {
    const result = await syncReviews(tenantId);
    return NextResponse.redirect(new URL(`/dashboard?synced=${result.count}`, request.url));
  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.redirect(new URL(`/dashboard?syncError=${encodeURIComponent(error.message)}`, request.url));
  }
}

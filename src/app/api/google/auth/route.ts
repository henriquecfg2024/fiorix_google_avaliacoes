import { NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/google';
import { auth } from '@/auth';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = getGoogleAuthUrl(session.user.tenantId);
  return NextResponse.redirect(url);
}

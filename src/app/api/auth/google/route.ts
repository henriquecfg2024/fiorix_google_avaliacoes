import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getGoogleAuthUrl } from '@/lib/google';

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.user.tenantId as string;
  const url = getGoogleAuthUrl(tenantId);
  
  return NextResponse.redirect(url);
}

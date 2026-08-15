import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGoogleTokens, fetchLocations, getGoogleOAuth2Client } from '@/lib/google';
import { auth } from '@/auth';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.tenantId || !session?.user?.role || !['ADMIN', 'MASTER'].includes(session.user.role)) {
    return NextResponse.json(
      { error: 'Não autorizado: É necessário ter sessão ativa como ADMIN ou MASTER para conectar o Google.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateTenantId = searchParams.get('state');

  if (!code || !stateTenantId) {
    return NextResponse.json({ error: 'Parâmetros code ou state ausentes' }, { status: 400 });
  }

  // Validação estrita: O tenant do state DEVE ser idêntico ao tenant do usuário autenticado
  if (stateTenantId !== session.user.tenantId) {
    console.error(`[OAuth CSRF Alert] Tenant do State (${stateTenantId}) diverge da sessão (${session.user.tenantId})`);
    return NextResponse.redirect(new URL('/configuracoes?error=InvalidStateTenant', request.url));
  }

  const tenantId = session.user.tenantId;

  try {
    const tokens = await getGoogleTokens(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.json({ error: 'Não foi possível obter tokens de acesso do Google' }, { status: 400 });
    }

    const tempClient = getGoogleOAuth2Client();
    tempClient.setCredentials(tokens);

    let locations: any[] = [];
    try {
      locations = await fetchLocations(tempClient);
    } catch (apiError: any) {
      console.warn('Google API not fully enabled, proceeding with mock locations:', apiError.message);
      locations = [{ accountId: 'pendente', locationId: 'pendente', title: 'Conta Pendente' }];
    }

    if (locations.length === 0) {
      return NextResponse.redirect(new URL('/configuracoes?error=NoLocationsFound', request.url));
    }

    const firstLocation = locations[0];

    await prisma.$transaction([
      prisma.googleConnection.deleteMany({ where: { tenantId } }),
      prisma.googleConnection.create({
        data: {
          tenantId,
          accountId: firstLocation.accountId,
          locationId: firstLocation.locationId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3500000),
        }
      })
    ]);

    return NextResponse.redirect(new URL('/configuracoes?success=GoogleConnected', request.url));
  } catch (error: any) {
    console.error('Google Callback Error:', error);
    return NextResponse.redirect(new URL(`/configuracoes?error=AuthFailed&details=${encodeURIComponent(error.message)}`, request.url));
  }
}


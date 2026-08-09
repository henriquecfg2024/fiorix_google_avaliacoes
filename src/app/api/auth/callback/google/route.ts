import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGoogleTokens, fetchLocations, getGoogleOAuth2Client } from '@/lib/google';
import { getErrorMessage, logError } from '@/lib/errors';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const tenantId = searchParams.get('state');

  if (!code || !tenantId) {
    return NextResponse.json({ error: 'Missing code or state (tenantId)' }, { status: 400 });
  }

  try {
    const tokens = await getGoogleTokens(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.json({ error: 'Did not receive access or refresh token' }, { status: 400 });
    }

    // Set credentials temporarily to fetch the locations
    const tempClient = getGoogleOAuth2Client();
    tempClient.setCredentials(tokens);

    // Fetch the accounts/locations to bind to this tenant
    let locations: any[] = [];
    let locationsWarning: string | null = null;
    try {
      locations = await fetchLocations(tempClient);
    } catch (apiError) {
      logError('api:googleCallback:fetchLocations', apiError);
      // Fallback so the user doesn't get blocked: the location is resolved again
      // on the next sync. The warning keeps the failure visible.
      locations = [{ accountId: 'pendente', locationId: 'pendente', title: 'Conta Pendente' }];
      locationsWarning = `A conta foi conectada, mas o local do Google Meu Negócio não pôde ser lido agora: ${getErrorMessage(apiError)}`;
    }

    if (locations.length === 0) {
      return NextResponse.redirect(new URL('/configuracoes?error=NoLocationsFound', request.url));
    }

    // For the MVP, we just pick the first location
    const firstLocation = locations[0];

    // Actually, prisma transaction is safer
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

    const successUrl = new URL('/configuracoes?success=GoogleConnected', request.url);
    if (locationsWarning) {
      successUrl.searchParams.set('warning', locationsWarning);
    }
    return NextResponse.redirect(successUrl);
  } catch (error) {
    logError('api:googleCallback', error);
    return NextResponse.redirect(
      new URL(`/configuracoes?error=AuthFailed&details=${encodeURIComponent(getErrorMessage(error))}`, request.url)
    );
  }
}

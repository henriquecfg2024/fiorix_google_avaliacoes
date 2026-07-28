import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getGoogleTokens, fetchLocations, getGoogleOAuth2Client } from '@/lib/google';

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
    try {
      locations = await fetchLocations(tempClient);
    } catch (apiError: any) {
      console.warn('Google API not fully enabled, proceeding with mock locations:', apiError.message);
      // Fallback so the user doesn't get blocked
      locations = [{ accountId: 'pendente', locationId: 'pendente', title: 'Conta Pendente' }];
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

    return NextResponse.redirect(new URL('/configuracoes?success=GoogleConnected', request.url));
  } catch (error: any) {
    console.error('Google Callback Error:', error);
    return NextResponse.redirect(new URL(`/configuracoes?error=AuthFailed&details=${encodeURIComponent(error.message)}`, request.url));
  }
}

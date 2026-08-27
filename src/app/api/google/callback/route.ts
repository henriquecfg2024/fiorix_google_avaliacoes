import { NextResponse } from 'next/server';
import { getGoogleTokens } from '@/lib/google';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const tenantId = searchParams.get('state'); // State contains the tenantId
  const error = searchParams.get('error');

  if (error) {
    console.error('Google OAuth Error:', error);
    return NextResponse.redirect(new URL('/configuracoes?error=oauth_rejected', request.url));
  }

  if (!code || !tenantId) {
    return new NextResponse('Missing code or state', { status: 400 });
  }

  try {
    const tokens = await getGoogleTokens(code);
    
    // Check if a connection already exists for this tenant
    const existingConnection = await prisma.googleConnection.findFirst({
      where: { tenantId }
    });

    // In a real app, you would also call Google APIs here to get the actual
    // accountId and locationId before saving. For scaffolding, we leave them blank
    // or as placeholders until we implement the Account Selection UI.
    const accountId = 'placeholder_account_id';
    const locationId = 'placeholder_location_id';
    const expiresAt = tokens.expiry_date 
      ? new Date(tokens.expiry_date) 
      : new Date(Date.now() + 3600 * 1000);

    if (existingConnection) {
      await prisma.googleConnection.update({
        where: { id: existingConnection.id },
        data: {
          accessToken: tokens.access_token || existingConnection.accessToken,
          refreshToken: tokens.refresh_token || existingConnection.refreshToken,
          expiresAt,
        }
      });
    } else {
      if (!tokens.access_token || !tokens.refresh_token) {
         throw new Error("Missing access or refresh token on first connect");
      }
      await prisma.googleConnection.create({
        data: {
          tenantId,
          accountId,
          locationId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
        }
      });
    }

    return NextResponse.redirect(new URL('/configuracoes?success=google_connected', request.url));
  } catch (error) {
    console.error('Error exchanging tokens:', error);
    return NextResponse.redirect(new URL('/configuracoes?error=token_exchange_failed', request.url));
  }
}

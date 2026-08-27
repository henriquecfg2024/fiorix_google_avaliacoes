import { google } from 'googleapis';
import { prisma } from './prisma';

function getRedirectUri() {
  if (process.env.NEXTAUTH_URL) {
    return `${process.env.NEXTAUTH_URL}/api/auth/callback/google`;
  }
  return 'http://localhost:3000/api/auth/callback/google';
}

export function getGoogleOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

const SCOPES = [
  'https://www.googleapis.com/auth/business.manage', // Required to manage Google Business Profile
];

export function getGoogleAuthUrl(tenantId: string) {
  const oauth2Client = getGoogleOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get a refresh token
    scope: SCOPES,
    prompt: 'consent',
    state: tenantId, // Pass the tenant ID in the state parameter
  });
}

export async function getGoogleTokens(code: string) {
  const oauth2Client = getGoogleOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getAuthenticatedGoogleClient(tenantId: string) {
  const connection = await prisma.googleConnection.findFirst({
    where: { tenantId }
  });

  if (!connection) {
    throw new Error('Tenant not connected to Google');
  }

  const oauth2Client = getGoogleOAuth2Client();
  oauth2Client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.expiresAt.getTime(),
  });

  // Automatically handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      await prisma.googleConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3500000),
        }
      });
    } else if (tokens.access_token) {
      await prisma.googleConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: tokens.access_token,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3500000),
        }
      });
    }
  });

  return oauth2Client;
}

export async function fetchLocations(oauth2Client: any) {
  // Using google.mybusinessaccountmanagement to find accounts
  const accountsAPI = google.mybusinessaccountmanagement({ version: 'v1', auth: oauth2Client });
  // Using google.mybusinessbusinessinformation to find locations
  const mybusiness = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2Client });

  try {
    // 1. Get Accounts
    const accountsRes = await accountsAPI.accounts.list();
    const accounts = accountsRes.data.accounts || [];

    if (accounts.length === 0) {
      return [];
    }

    // 2. Get Locations for the first account
    const accountName = accounts[0].name!; // 'accounts/123456789'
    const locationsRes = await mybusiness.accounts.locations.list({
      parent: accountName,
      readMask: 'name,title,storeCode'
    });

    return locationsRes.data.locations?.map(loc => ({
      accountId: accountName,
      locationId: loc.name,
      title: loc.title
    })) || [];
  } catch (error) {
    console.error('Error fetching locations:', error);
    throw error;
  }
}

export async function syncReviews(tenantId: string) {
  const connection = await prisma.googleConnection.findFirst({
    where: { tenantId }
  });

  if (!connection) {
    throw new Error('Tenant não conectado ao Google');
  }

  const oauth2Client = await getAuthenticatedGoogleClient(tenantId);

  // If connection was saved with pending locations, try resolving them now
  if (connection.accountId === 'pendente' || connection.locationId === 'pendente') {
    try {
      const locations = await fetchLocations(oauth2Client);
      if (locations && locations.length > 0) {
        const realAccount = locations[0].accountId;
        const realLocation = locations[0].locationId;

        await prisma.googleConnection.update({
          where: { id: connection.id },
          data: {
            accountId: realAccount,
            locationId: realLocation,
          }
        });

        connection.accountId = realAccount;
        connection.locationId = realLocation;
      } else {
        throw new Error('Nenhum local do Google Meu Negócio foi encontrado vinculado a esta conta do Google.');
      }
    } catch (err: any) {
      if (err.message?.includes('deleted_client') || err.message?.includes('invalid_grant')) {
        await prisma.googleConnection.deleteMany({ where: { tenantId } });
        throw new Error('Sua credencial do Google expirou ou foi alterada. Por favor, clique em "Conectar Conta Google" em Configurações para reconectar.');
      }
      throw new Error(`Não foi possível obter o local do Google: ${err.message}`);
    }
  }

  let pageToken: string | undefined = undefined;
  let newReviewsCount = 0;

  try {
    do {
      let pageUrl = `https://mybusiness.googleapis.com/v4/${connection.accountId}/${connection.locationId}/reviews?pageSize=50`;
      if (pageToken) {
        pageUrl += `&pageToken=${pageToken}`;
      }

      const response = await oauth2Client.request({ url: pageUrl });
      const data = response.data as any;
      const reviews = data.reviews || [];
      pageToken = data.nextPageToken;

      for (const item of reviews) {
        const googleId = item.reviewId;
        
        const existing = await prisma.review.findUnique({
          where: { googleId }
        });

        if (!existing) {
          const ratingMap: Record<string, number> = {
            'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5
          };
          
          await prisma.review.create({
            data: {
              googleId,
              tenantId,
              reviewerName: item.reviewer?.displayName || 'Anônimo',
              rating: ratingMap[item.starRating] || 5,
              comment: item.comment || '',
              publishedAt: new Date(item.createTime),
              status: item.reviewReply ? 'RESPONDED' : 'PENDING'
            }
          });
          newReviewsCount++;
        }
      }
    } while (pageToken);

    return { success: true, count: newReviewsCount };
  } catch (error: any) {
    console.error('Error syncing reviews:', error);
    if (error.message?.includes('deleted_client') || error.message?.includes('invalid_grant')) {
      await prisma.googleConnection.deleteMany({ where: { tenantId } });
      throw new Error('Sua credencial do Google expirou ou foi alterada. Por favor, clique em "Conectar Conta Google" em Configurações para reconectar.');
    }
    throw new Error(error.message || 'Falha ao buscar avaliações do Google');
  }
}

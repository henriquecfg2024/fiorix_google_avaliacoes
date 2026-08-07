import { google } from 'googleapis';
import { prisma } from './prisma';
import { ensureSyncLogTable } from './sync-log-db';

function getRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
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

// Vercel Hobby can terminate a function around 10s. Return a controlled error
// before that happens instead of allowing the browser to receive a 504 HTML page.
const GOOGLE_REQUEST_TIMEOUT_MS = 15_000;

async function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = GOOGLE_REQUEST_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

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
    const accountsRes = await withTimeout(
      accountsAPI.accounts.list(),
      'O Google demorou para responder ao buscar as contas. Tente novamente.'
    );
    const accounts = accountsRes.data.accounts || [];

    if (accounts.length === 0) {
      return [];
    }

    // 2. Get Locations for the first account
    const accountName = accounts[0].name!; // 'accounts/123456789'
    const locationsRes = await withTimeout(
      mybusiness.accounts.locations.list({
        parent: accountName,
        readMask: 'name,title,storeCode'
      }),
      'O Google demorou para responder ao buscar os locais. Tente novamente.'
    );

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

function cleanReviewComment(comment: string | null | undefined): string {
  if (!comment) return '';
  return comment
    .replace(/\s*\((?:Translated by Google|Traduzido pelo Google|Translated by tripadvisor|Traduzido pelo Tripadvisor)[\s\S]*/i, '')
    .trim();
}

export async function syncReviews(tenantId: string, triggeredBy?: string) {
  await ensureSyncLogTable();
  const startedAt = Date.now();
  const syncLog = await prisma.syncLog.create({
    data: { tenantId, triggeredBy, status: 'RUNNING' }
  });

  const finishLog = async (data: {
    status: 'COMPLETED' | 'FAILED' | 'TIMEOUT';
    reviewsFetched?: number;
    reviewsImported?: number;
    errorMessage?: string;
  }) => {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        ...data,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
      }
    });
  };

  const connection = await prisma.googleConnection.findFirst({
    where: { tenantId }
  });

  if (!connection) {
    throw new Error('Nenhuma conta do Google vinculada a este cartório.');
  }

  const oauth2Client = await getAuthenticatedGoogleClient(tenantId);

  // If connection was saved with pending locations, try resolving them now
  if (connection.accountId === 'pendente' || connection.locationId === 'pendente') {
    try {
      const locations = await fetchLocations(oauth2Client);
      if (locations && locations.length > 0) {
        const realAccount = locations[0].accountId ?? '';
        const realLocation = locations[0].locationId ?? '';

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

  try {
    // The Google API paginates results. Fetch several pages, but stop before
    // the serverless function limit so partial progress can still be saved.
    const reviews: any[] = [];
    let pageToken: string | undefined;
    const syncDeadline = Date.now() + 45_000;
    for (let page = 0; page < 10; page++) {
      const remainingMs = Math.min(GOOGLE_REQUEST_TIMEOUT_MS, syncDeadline - Date.now());
      if (remainingMs < 500) break;
      const pageUrl = `https://mybusiness.googleapis.com/v4/${connection.accountId}/${connection.locationId}/reviews?pageSize=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const response = await withTimeout(
        oauth2Client.request({ url: pageUrl }),
        'O Google demorou para responder. Verifique a conexão e tente novamente.',
        remainingMs
      );
      const data = response.data as any;
      reviews.push(...(data.reviews || []).filter((item: any) => item.reviewId));
      pageToken = data.nextPageToken || undefined;
      if (!pageToken) break;
    }
    const ratingMap: Record<string, number> = {
      'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5
    };
    const googleIds = reviews.map((item: any) => item.reviewId);
    const existingReviews = googleIds.length > 0
      ? await prisma.review.findMany({ where: { googleId: { in: googleIds } }, select: { googleId: true } })
      : [];
    const existingIds = new Set(existingReviews.map((review) => review.googleId));
    const newReviews = reviews.filter((item: any) => !existingIds.has(item.reviewId));

    if (newReviews.length > 0) {
      await prisma.review.createMany({
        skipDuplicates: true,
        data: newReviews.map((item: any) => ({
          googleId: item.reviewId,
          tenantId,
          reviewerName: item.reviewer?.displayName || 'Anônimo',
          rating: ratingMap[item.starRating] || 5,
          comment: cleanReviewComment(item.comment),
          publishedAt: new Date(item.createTime),
          status: item.reviewReply ? 'RESPONDED' as const : 'PENDING' as const
        }))
      });
    }

    const respondedIds = reviews.filter((item: any) => item.reviewReply).map((item: any) => item.reviewId);
    if (respondedIds.length > 0) {
      await prisma.review.updateMany({
        where: { googleId: { in: respondedIds }, tenantId },
        data: { status: 'RESPONDED' }
      });
    }
    const newReviewsCount = newReviews.length;

    await finishLog({
      status: 'COMPLETED',
      reviewsFetched: reviews.length,
      reviewsImported: newReviewsCount,
    });

    return { success: true, count: newReviewsCount };
  } catch (error: any) {
    console.error('Error syncing reviews:', error);
    const errorMessage = error.message || 'Falha ao buscar avaliações do Google';
    await finishLog({
      status: /demorou|timeout/i.test(errorMessage) ? 'TIMEOUT' : 'FAILED',
      errorMessage: errorMessage.slice(0, 1000),
    }).catch((logError) => console.error('Error saving sync log:', logError));
    if (error.message?.includes('deleted_client') || error.message?.includes('invalid_grant')) {
      await prisma.googleConnection.deleteMany({ where: { tenantId } });
      throw new Error('Sua credencial do Google expirou ou foi alterada. Por favor, clique em "Conectar Conta Google" em Configurações para reconectar.');
    }
    throw new Error(errorMessage);
  }
}

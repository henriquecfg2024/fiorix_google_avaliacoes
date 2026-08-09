import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  FakeOAuth2,
  oauthInstances,
  oauthConstructorArgs,
  requestMock,
  accountsList,
  locationsList,
  prismaMock,
} = vi.hoisted(() => {
  const instances: any[] = [];
  const constructorArgs: any[][] = [];
  const request = vi.fn(async (..._args: any[]): Promise<any> => ({ data: {} }));

  class OAuth2 {
    credentials: any = null;
    listeners: Record<string, (payload: any) => unknown> = {};
    generateAuthUrl = vi.fn((options: any) => `https://accounts.google.com/o/oauth2/auth?state=${options.state}`);
    getToken = vi.fn(async (code: string) => ({ tokens: { access_token: `token-for-${code}` } }));
    request = request;

    constructor(...args: any[]) {
      constructorArgs.push(args);
      instances.push(this);
    }

    setCredentials(credentials: any) {
      this.credentials = credentials;
    }

    on(event: string, listener: (payload: any) => unknown) {
      this.listeners[event] = listener;
    }

    emit(event: string, payload: any) {
      return this.listeners[event]?.(payload);
    }
  }

  return {
    FakeOAuth2: OAuth2,
    oauthInstances: instances,
    oauthConstructorArgs: constructorArgs,
    requestMock: request,
    accountsList: vi.fn(),
    locationsList: vi.fn(),
    prismaMock: {
      googleConnection: { findFirst: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
      syncLog: { create: vi.fn(), update: vi.fn() },
      review: { findMany: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
      response: { findMany: vi.fn() },
    },
  };
});

vi.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: FakeOAuth2 },
    mybusinessaccountmanagement: () => ({ accounts: { list: accountsList } }),
    mybusinessbusinessinformation: () => ({ accounts: { locations: { list: locationsList } } }),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/sync-log-db', () => ({ ensureSyncLogTable: vi.fn() }));

import {
  fetchLocations,
  getAuthenticatedGoogleClient,
  getGoogleAuthUrl,
  getGoogleOAuth2Client,
  getGoogleTokens,
  replyToGoogleReview,
  syncReviews,
} from './google';

function connection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    tenantId: 't1',
    accountId: 'accounts/1',
    locationId: 'locations/1',
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  oauthInstances.length = 0;
  oauthConstructorArgs.length = 0;
  prismaMock.syncLog.create.mockResolvedValue({ id: 'log-1' });
  prismaMock.review.findMany.mockResolvedValue([]);
  prismaMock.response.findMany.mockResolvedValue([]);
  requestMock.mockReset();
  requestMock.mockResolvedValue({ data: {} });
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('OAuth client configuration', () => {
  it('prefers GOOGLE_REDIRECT_URI, then NEXTAUTH_URL, then localhost', () => {
    process.env.GOOGLE_REDIRECT_URI = 'https://explicit.test/callback';
    process.env.NEXTAUTH_URL = 'https://app.test';
    getGoogleOAuth2Client();

    delete process.env.GOOGLE_REDIRECT_URI;
    getGoogleOAuth2Client();

    delete process.env.NEXTAUTH_URL;
    getGoogleOAuth2Client();

    expect(oauthConstructorArgs.map((args) => args[2])).toEqual([
      'https://explicit.test/callback',
      'https://app.test/api/auth/callback/google',
      'http://localhost:3000/api/auth/callback/google',
    ]);
  });

  it('requests offline access and carries the tenant in the state', () => {
    const url = getGoogleAuthUrl('tenant-42');

    expect(url).toContain('tenant-42');
    expect(oauthInstances[0].generateAuthUrl).toHaveBeenCalledWith({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/business.manage'],
      prompt: 'consent',
      state: 'tenant-42',
    });
  });

  it('exchanges an authorization code for tokens', async () => {
    await expect(getGoogleTokens('code-1')).resolves.toEqual({ access_token: 'token-for-code-1' });
  });
});

describe('getAuthenticatedGoogleClient', () => {
  it('fails when the tenant has no Google connection', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(null);
    await expect(getAuthenticatedGoogleClient('t1')).rejects.toThrow('Tenant not connected to Google');
  });

  it('loads the stored credentials into the client', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(connection());
    const client: any = await getAuthenticatedGoogleClient('t1');

    expect(client.credentials).toEqual({
      access_token: 'access',
      refresh_token: 'refresh',
      expiry_date: new Date('2026-01-01T00:00:00.000Z').getTime(),
    });
  });

  it('persists refreshed tokens, including a rotated refresh token', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(connection());
    const client: any = await getAuthenticatedGoogleClient('t1');

    await client.emit('tokens', { access_token: 'a2', refresh_token: 'r2', expiry_date: 111 });
    expect(prismaMock.googleConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { accessToken: 'a2', refreshToken: 'r2', expiresAt: new Date(111) },
    });

    await client.emit('tokens', { access_token: 'a3' });
    expect(prismaMock.googleConnection.update).toHaveBeenLastCalledWith({
      where: { id: 'conn-1' },
      data: { accessToken: 'a3', expiresAt: expect.any(Date) },
    });
  });

  it('ignores token events without any new token', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(connection());
    const client: any = await getAuthenticatedGoogleClient('t1');

    await client.emit('tokens', {});
    expect(prismaMock.googleConnection.update).not.toHaveBeenCalled();
  });
});

describe('fetchLocations', () => {
  it('returns an empty list when the Google account has no business accounts', async () => {
    accountsList.mockResolvedValue({ data: { accounts: [] } });
    await expect(fetchLocations({})).resolves.toEqual([]);
    expect(locationsList).not.toHaveBeenCalled();
  });

  it('maps the locations of the first account', async () => {
    accountsList.mockResolvedValue({ data: { accounts: [{ name: 'accounts/9' }] } });
    locationsList.mockResolvedValue({
      data: { locations: [{ name: 'locations/5', title: 'Cartório' }] },
    });

    await expect(fetchLocations({})).resolves.toEqual([
      { accountId: 'accounts/9', locationId: 'locations/5', title: 'Cartório' },
    ]);
    expect(locationsList).toHaveBeenCalledWith({ parent: 'accounts/9', readMask: 'name,title,storeCode' });
  });

  it('propagates Google API failures', async () => {
    accountsList.mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(fetchLocations({})).rejects.toThrow('boom');
  });
});

describe('syncReviews', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('rejects tenants without a linked Google account', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(null);
    await expect(syncReviews('t1')).rejects.toThrow('Nenhuma conta do Google vinculada a este cartório.');
  });

  it('paginates, imports only unseen reviews and cleans the translation footer', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(connection());
    prismaMock.review.findMany.mockResolvedValue([{ googleId: 'r1' }]);
    requestMock
      .mockResolvedValueOnce({
        data: {
          nextPageToken: 'page 2',
          reviews: [
            { reviewId: 'r1', starRating: 'FIVE', createTime: '2026-01-01', reviewReply: { comment: 'ok' } },
            { starRating: 'ONE', createTime: '2026-01-03' },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          reviews: [
            {
              reviewId: 'r2',
              starRating: 'TWO',
              createTime: '2026-01-02T00:00:00.000Z',
              reviewer: { displayName: 'Ana' },
              comment: 'Ótimo atendimento (Translated by Google) Great service',
            },
          ],
        },
      });

    await expect(syncReviews('t1', 'admin@test')).resolves.toEqual({ success: true, count: 1 });

    expect(requestMock.mock.calls[1][0].url).toContain('pageToken=page%202');
    expect(prismaMock.review.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        {
          googleId: 'r2',
          tenantId: 't1',
          reviewerName: 'Ana',
          rating: 2,
          comment: 'Ótimo atendimento',
          publishedAt: new Date('2026-01-02T00:00:00.000Z'),
          status: 'PENDING',
        },
      ],
    });
    expect(prismaMock.review.updateMany).toHaveBeenCalledWith({
      where: { googleId: { in: ['r1'] }, tenantId: 't1' },
      data: { status: 'RESPONDED' },
    });
    expect(prismaMock.syncLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({ status: 'COMPLETED', reviewsFetched: 2, reviewsImported: 1 }),
    });
  });

  it('resolves pending account/location ids before fetching', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(
      connection({ accountId: 'pendente', locationId: 'pendente' }),
    );
    accountsList.mockResolvedValue({ data: { accounts: [{ name: 'accounts/7' }] } });
    locationsList.mockResolvedValue({ data: { locations: [{ name: 'locations/8', title: 'Sede' }] } });
    requestMock.mockResolvedValue({ data: { reviews: [] } });

    await syncReviews('t1');

    expect(prismaMock.googleConnection.update).toHaveBeenCalledWith({
      where: { id: 'conn-1' },
      data: { accountId: 'accounts/7', locationId: 'locations/8' },
    });
    expect(requestMock.mock.calls[0][0].url).toContain('accounts/7/locations/8/reviews');
  });

  it('reports when no Google Business location is linked', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(connection({ accountId: 'pendente' }));
    accountsList.mockResolvedValue({ data: { accounts: [] } });

    await expect(syncReviews('t1')).rejects.toThrow(/Nenhum local do Google Meu Negócio/);
  });

  it('drops the connection when the Google credential is no longer valid', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(connection());
    requestMock.mockRejectedValue(new Error('invalid_grant'));

    await expect(syncReviews('t1')).rejects.toThrow(/expirou ou foi alterada/);
    expect(prismaMock.googleConnection.deleteMany).toHaveBeenCalledWith({ where: { tenantId: 't1' } });
    expect(prismaMock.syncLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({ status: 'FAILED', errorMessage: 'invalid_grant' }),
    });
  });

  it('retries temporary Google failures before giving up', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(connection());
    requestMock
      .mockRejectedValueOnce(Object.assign(new Error('temporarily unavailable'), { status: 503 }))
      .mockResolvedValueOnce({ data: { reviews: [] } });

    await expect(syncReviews('t1')).resolves.toEqual({ success: true, count: 0 });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });

  it('logs a TIMEOUT when Google stops responding', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(connection());
    requestMock.mockRejectedValue(new Error('O Google demorou para responder.'));

    await expect(syncReviews('t1')).rejects.toThrow('O Google demorou para responder.');
    expect(prismaMock.syncLog.update).toHaveBeenCalledWith({
      where: { id: 'log-1' },
      data: expect.objectContaining({ status: 'TIMEOUT' }),
    });
  });

  it('republishes replies that were only stored locally', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(connection());
    requestMock.mockResolvedValue({
      data: { reviews: [{ reviewId: 'r9', starRating: 'FOUR', createTime: '2026-02-01' }] },
    });
    prismaMock.review.findMany.mockResolvedValue([{ googleId: 'r9' }]);
    prismaMock.response.findMany.mockResolvedValue([{ content: 'Obrigado!', review: { googleId: 'r9' } }]);

    await syncReviews('t1');

    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT', data: { comment: 'Obrigado!' } }));
    expect(prismaMock.review.updateMany).toHaveBeenCalledWith({
      where: { googleId: { in: ['r9'] }, tenantId: 't1' },
      data: { status: 'RESPONDED' },
    });
  });
});

describe('replyToGoogleReview', () => {
  it('fails without a Google connection', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(null);
    await expect(replyToGoogleReview('t1', 'r1', 'hi')).rejects.toThrow(
      'Nenhuma conta do Google vinculada a este cartório.',
    );
  });

  it('PUTs the reply to the review reply endpoint', async () => {
    prismaMock.googleConnection.findFirst.mockResolvedValue(connection());
    await replyToGoogleReview('t1', 'reviews/a b', 'Obrigado!');

    const client: any = oauthInstances[0];
    expect(client.request).toHaveBeenCalledWith({
      url: 'https://mybusiness.googleapis.com/v4/accounts/1/locations/1/reviews/reviews%2Fa%20b/reply',
      method: 'PUT',
      data: { comment: 'Obrigado!' },
    });
  });
});

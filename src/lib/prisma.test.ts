import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { clientOptions, PrismaClientMock } = vi.hoisted(() => {
  const options: any[] = [];
  return {
    clientOptions: options,
    PrismaClientMock: vi.fn(function (this: any, config: any) {
      options.push(config);
    }),
  };
});

vi.mock('@prisma/client', () => ({ PrismaClient: PrismaClientMock }));

const originalEnv = { ...process.env };
const globalForPrisma = global as unknown as { prisma?: unknown };

async function loadPrisma() {
  vi.resetModules();
  return import('./prisma');
}

beforeEach(() => {
  vi.clearAllMocks();
  clientOptions.length = 0;
  delete globalForPrisma.prisma;
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
  delete globalForPrisma.prisma;
});

describe('prisma client configuration', () => {
  it('caps the pool at one connection per serverless instance', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db?sslmode=require';
    await loadPrisma();

    const url = new URL(clientOptions[0].datasources.db.url);
    expect(url.searchParams.get('connection_limit')).toBe('1');
    expect(url.searchParams.get('pool_timeout')).toBe('10');
    expect(url.searchParams.get('sslmode')).toBe('require');
  });

  it('keeps a non URL connection string untouched', async () => {
    process.env.DATABASE_URL = 'not-a-url';
    await loadPrisma();
    expect(clientOptions[0].datasources.db.url).toBe('not-a-url');
  });

  it('leaves the url undefined when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;
    await loadPrisma();
    expect(clientOptions[0].datasources.db.url).toBeUndefined();
  });

  it('only logs queries in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    await loadPrisma();
    expect(clientOptions[0].log).toEqual(['query']);

    vi.stubEnv('NODE_ENV', 'production');
    delete globalForPrisma.prisma;
    await loadPrisma();
    expect(clientOptions[1].log).toEqual(['error']);
  });

  it('reuses the client stored on globalThis instead of opening a new pool', async () => {
    const { prisma } = await loadPrisma();
    expect(globalForPrisma.prisma).toBe(prisma);

    const { prisma: reloaded } = await loadPrisma();
    expect(reloaded).toBe(prisma);
    expect(PrismaClientMock).toHaveBeenCalledTimes(1);
  });
});

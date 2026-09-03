import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) return undefined;

  try {
    const url = new URL(value);
    // Duas conexões permitem que heartbeat/navegação não fiquem presos atrás
    // de um lote. O limite segue pequeno para não pressionar o pool serverless.
    url.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT || '2');
    url.searchParams.set('pool_timeout', process.env.PRISMA_POOL_TIMEOUT || '20');
    return url.toString();
  } catch {
    return value;
  }
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
  });

// Reutiliza o mesmo cliente também em produção para impedir que cada
// carregamento do dashboard abra um novo pool de conexões.
globalForPrisma.prisma = prisma;

/**
 * @deprecated Prefira usar `requireAuth()` de `@/lib/auth-helpers` em vez desta função.
 * Mantida apenas para compatibilidade durante a migração das páginas.
 */
export async function getTenantId(sessionTenantId?: string): Promise<string> {
  if (sessionTenantId) return sessionTenantId;
  throw new Error('Tenant não identificado. Sessão inválida ou ausente.');
}



import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) return undefined;

  try {
    const url = new URL(value);
    // Em ambiente serverless (Vercel), cada invocação é um processo isolado.
    // Limitar para 3 conexões impede saturação do pooler (PgBouncer/Supavisor) do Supabase.
    const defaultLimit = process.env.VERCEL ? '3' : '10';
    url.searchParams.set('connection_limit', process.env.PRISMA_CONNECTION_LIMIT || defaultLimit);
    url.searchParams.set('pool_timeout', process.env.PRISMA_POOL_TIMEOUT || '10');
    url.searchParams.set('connect_timeout', process.env.PRISMA_CONNECT_TIMEOUT || '10');
    return url.toString();
  } catch {
    return value;
  }
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    ...(getDatabaseUrl() ? { datasources: { db: { url: getDatabaseUrl() } } } : {}),
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



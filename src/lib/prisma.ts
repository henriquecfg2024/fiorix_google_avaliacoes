import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) return undefined;

  try {
    const url = new URL(value);
    // Vercel pode iniciar várias funções ao mesmo tempo. Uma conexão por
    // instância evita esgotar o pool do Supabase durante o carregamento do BI.
    url.searchParams.set('connection_limit', '1');
    // Falhar rapidamente permite que a tela mostre uma mensagem acionavel
    // quando o Supabase estiver sem conexoes, em vez de deixar o spinner preso.
    url.searchParams.set('pool_timeout', '10');
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

export async function getTenantId(sessionTenantId?: string): Promise<string> {
  if (sessionTenantId) return sessionTenantId;
  throw new Error('Não autorizado: Identificador de cartório (tenantId) ausente na sessão.');
}


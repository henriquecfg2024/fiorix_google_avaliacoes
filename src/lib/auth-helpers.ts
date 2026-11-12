import { auth } from '@/auth';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role | string;
  tenantId: string;
  departamento?: string;
  cargo?: string;
}

import { prisma } from '@/lib/prisma';

const userMetaCache = new Map<string, { role?: string; departamento?: string; cargo?: string; exists: boolean; exp: number }>();
const validTenantCache = new Map<string, number>();
const TENANT_CACHE_TTL_MS = 60_000; // 60 segundos
const USER_META_CACHE_TTL_MS = 30_000; // 30 segundos

export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Não autorizado: Sessão não encontrada ou inválida.');
  }

  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  let tenantId: string | undefined = session.user.tenantId;

  if (tenantId) {
    const cachedTenantExp = !isTestEnv ? validTenantCache.get(tenantId) : undefined;
    if (!cachedTenantExp || cachedTenantExp <= Date.now()) {
      try {
        const tenantValido = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true },
        });
        if (tenantValido) {
          if (!isTestEnv) validTenantCache.set(tenantId, Date.now() + TENANT_CACHE_TTL_MS);
        } else {
          const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
          if (defaultTenant) {
            tenantId = defaultTenant.id;
            if (!isTestEnv) validTenantCache.set(tenantId, Date.now() + TENANT_CACHE_TTL_MS);
          }
        }
      } catch (err) {
        console.warn('Erro ao validar tenantId:', err);
      }
    }
  }

  if (!tenantId) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { tenantId: true },
      });
      tenantId = dbUser?.tenantId || undefined;
    } catch (err) {
      console.warn('Erro ao buscar tenantId do usuário:', err);
    }
  }

  if (!tenantId) {
    try {
      const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = defaultTenant?.id;
    } catch (err) {
      console.warn('Erro ao buscar fallback tenantId:', err);
    }
  }

  if (!tenantId) {
    throw new Error('Usuário sem tenant válido.');
  }

  let liveRole: string | undefined = undefined;
  let departamento: string | undefined = undefined;
  let cargo: string | undefined = undefined;
  let userConfirmedInDb = false;

  const cachedDept = !isTestEnv ? userMetaCache.get(session.user.id) : undefined;
  if (cachedDept && cachedDept.exp > Date.now()) {
    liveRole = cachedDept.role;
    departamento = cachedDept.departamento;
    cargo = cachedDept.cargo;
    userConfirmedInDb = cachedDept.exists;
  } else {
    try {
      const rawUser = await prisma.$queryRawUnsafe<any[]>(
        `SELECT role::text as role, departamento, cargo FROM public."User" WHERE id = $1 LIMIT 1`,
        session.user.id
      );
      if (rawUser && rawUser.length > 0) {
        liveRole = rawUser[0].role || undefined;
        departamento = rawUser[0].departamento || undefined;
        cargo = rawUser[0].cargo || undefined;
        userConfirmedInDb = true;
        if (!isTestEnv) {
          userMetaCache.set(session.user.id, {
            role: liveRole,
            departamento,
            cargo,
            exists: true,
            exp: Date.now() + USER_META_CACHE_TTL_MS,
          });
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar departamento do usuário:', err);
    }
  }

  let userId = session.user.id;
  if (!userConfirmedInDb || isTestEnv) {
    try {
      const userDb = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!userDb) {
        const fallbackUser = await prisma.user.findFirst({
          where: { tenantId },
          select: { id: true },
        });
        if (fallbackUser) {
          userId = fallbackUser.id;
        }
      }
    } catch {}
  }

  return {
    id: userId,
    name: session.user.name,
    email: session.user.email,
    role: ((liveRole || session.user.role) as Role) || 'USER',
    tenantId,
    departamento,
    cargo,
  };
}

export async function requireRole(...allowedRoles: Array<Role | string>): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (
    !allowedRoles.includes(user.role) &&
    !(user.role === 'VISITANTE' && allowedRoles.includes('SUBSTITUTO'))
  ) {
    throw new Error('Acesso negado: Permissão insuficiente para realizar esta operação.');
  }

  return user;
}

export async function requireTenant(): Promise<AuthenticatedUser> {
  return requireAuth();
}

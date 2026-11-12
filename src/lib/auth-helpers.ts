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

interface CachedUserMeta {
  role?: string;
  status?: string;
  tenantId?: string;
  departamento?: string;
  cargo?: string;
  exists: boolean;
  exp: number;
}

const userMetaCache = new Map<string, CachedUserMeta>();
const validTenantCache = new Map<string, number>();
const TENANT_CACHE_TTL_MS = 60_000; // 60 segundos
const USER_META_CACHE_TTL_MS = 30_000; // 30 segundos
const USER_META_CACHE_MAX_SIZE = 500;

export function invalidateUserMetaCache(userId?: string): void {
  if (userId) {
    userMetaCache.delete(userId);
  } else {
    userMetaCache.clear();
  }
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Não autorizado: Sessão não encontrada ou inválida.');
  }

  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  const userId = session.user.id;
  let sessionTenantId: string | undefined = session.user.tenantId;

  let liveRole: string | undefined = undefined;
  let liveStatus: string | undefined = undefined;
  let dbTenantId: string | undefined = undefined;
  let departamento: string | undefined = undefined;
  let cargo: string | undefined = undefined;
  let userConfirmedInDb = false;

  const cachedMeta = !isTestEnv ? userMetaCache.get(userId) : undefined;
  if (cachedMeta && cachedMeta.exp > Date.now()) {
    if (!cachedMeta.exists) {
      throw new Error('Não autorizado: Usuário não encontrado ou removido.');
    }
    if (cachedMeta.status === 'inativo') {
      throw new Error('Conta desativada: Acesso bloqueado pela administração.');
    }
    liveRole = cachedMeta.role;
    liveStatus = cachedMeta.status;
    dbTenantId = cachedMeta.tenantId;
    departamento = cachedMeta.departamento;
    cargo = cachedMeta.cargo;
    userConfirmedInDb = true;
  } else if (!isTestEnv) {
    let rawUser: any[] | null = null;
    try {
      rawUser = await prisma.$queryRawUnsafe<any[]>(
        `SELECT role::text as role, COALESCE(status, 'ativo') as status, "tenantId", departamento, cargo FROM public."User" WHERE id = $1 LIMIT 1`,
        userId
      );
    } catch {
      try {
        rawUser = await prisma.$queryRawUnsafe<any[]>(
          `SELECT role::text as role, "tenantId", departamento, cargo FROM public."User" WHERE id = $1 LIMIT 1`,
          userId
        );
      } catch (err) {
        console.warn('Erro ao validar metadados do usuário:', err);
      }
    }

    if (rawUser !== null) {
      if (userMetaCache.size >= USER_META_CACHE_MAX_SIZE) {
        const now = Date.now();
        for (const [k, v] of userMetaCache) {
          if (v.exp <= now) userMetaCache.delete(k);
        }
        if (userMetaCache.size >= USER_META_CACHE_MAX_SIZE) {
          const oldestKey = userMetaCache.keys().next().value;
          if (oldestKey) userMetaCache.delete(oldestKey);
        }
      }

      if (rawUser.length === 0) {
        userMetaCache.set(userId, { exists: false, exp: Date.now() + 5_000 });
        throw new Error('Não autorizado: Usuário não encontrado ou removido.');
      }

      liveRole = rawUser[0].role || undefined;
      liveStatus = String(rawUser[0].status || 'ativo').trim().toLowerCase();
      dbTenantId = rawUser[0].tenantId || undefined;
      departamento = rawUser[0].departamento || undefined;
      cargo = rawUser[0].cargo || undefined;
      userConfirmedInDb = true;

      userMetaCache.set(userId, {
        role: liveRole,
        status: liveStatus,
        tenantId: dbTenantId,
        departamento,
        cargo,
        exists: true,
        exp: Date.now() + USER_META_CACHE_TTL_MS,
      });

      if (liveStatus === 'inativo') {
        throw new Error('Conta desativada: Acesso bloqueado pela administração.');
      }
    }
  } else {
    // Em ambiente de teste unitário: verifica findUnique apenas se disponível, sem fallback findFirst
    try {
      const userDb = await prisma.user?.findUnique?.({
        where: { id: userId },
        select: { id: true, role: true, tenantId: true, departamento: true, cargo: true },
      });
      if (userDb) {
        liveRole = userDb.role || undefined;
        dbTenantId = userDb.tenantId || undefined;
        departamento = userDb.departamento || undefined;
        cargo = userDb.cargo || undefined;
        userConfirmedInDb = true;
      }
    } catch {
      // Ignora em mocks parciais de testes unitários
    }
  }

  const effectiveRole = ((liveRole || session.user.role) as Role) || 'USER';

  // Para perfis não-MASTER, o tenantId efetivo vem obrigatoriamente do cadastro no banco quando confirmado;
  // Para MASTER, permite alternância explícita de tenant na sessão (switchTenantAction) desde que o tenant exista.
  let tenantId =
    effectiveRole === 'MASTER'
      ? sessionTenantId || dbTenantId
      : dbTenantId || sessionTenantId;

  if (!tenantId) {
    throw new Error('Não autorizado: Usuário sem organização (tenant) vinculada.');
  }

  if (!isTestEnv) {
    const cachedTenantExp = validTenantCache.get(tenantId);
    if (!cachedTenantExp || cachedTenantExp <= Date.now()) {
      const tenantValido = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });
      if (!tenantValido) {
        validTenantCache.delete(tenantId);
        throw new Error('Não autorizado: Organização (tenant) inválida ou removida.');
      }
      validTenantCache.set(tenantId, Date.now() + TENANT_CACHE_TTL_MS);
    }
  }

  if (!isTestEnv && !userConfirmedInDb) {
    const userDb = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userDb) {
      throw new Error('Não autorizado: Usuário não encontrado ou removido.');
    }
  }

  return {
    id: userId,
    name: session.user.name,
    email: session.user.email,
    role: effectiveRole,
    tenantId,
    departamento,
    cargo,
  };
}

export async function requireRole(...allowedRoles: Array<Role | string>): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    throw new Error('Acesso negado: Permissão insuficiente para realizar esta operação.');
  }

  return user;
}

export async function requireTenant(): Promise<AuthenticatedUser> {
  return requireAuth();
}

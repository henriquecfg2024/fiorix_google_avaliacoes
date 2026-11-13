import { auth } from '@/auth';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface AuthenticatedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role | string;
  tenantId: string;
  departamento?: string;
  cargo?: string;
}

interface CachedUserMeta {
  role?: string;
  status?: string;
  tenantId?: string;
  departamento?: string;
  cargo?: string;
  revokedBeforeMs?: number;
  exists: boolean;
  exp: number;
}

const userMetaCache = new Map<string, CachedUserMeta>();
const localSessionRevocations = new Map<string, number>();
const validTenantCache = new Map<string, number>();
const TENANT_CACHE_TTL_MS = 60_000; // 60 segundos
const USER_META_CACHE_TTL_MS = 30_000; // 30 segundos
const USER_META_CACHE_MAX_SIZE = 500;
let revocationTableEnsured = false;

export function invalidateUserMetaCache(userId?: string): void {
  if (userId) {
    userMetaCache.delete(userId);
  } else {
    userMetaCache.clear();
  }
}

async function ensureSessionRevocationTable(): Promise<boolean> {
  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  if (isTestEnv) return false;
  if (revocationTableEnsured) return true;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_session_revocations (
        user_id TEXT PRIMARY KEY,
        revoked_before TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reason TEXT NULL
      )
    `);
    revocationTableEnsured = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Revoga imediatamente todos os JWTs do usuário emitidos antes de `revokedBefore` (padrão: agora).
 * Persiste no PostgreSQL para propagação entre instâncias Vercel em <= 30s (e 0s na instância atual).
 */
export async function revokeAllUserSessions(
  userId: string,
  options?: { revokedBefore?: Date; reason?: string }
): Promise<void> {
  if (!userId) return;
  const effectiveDate = options?.revokedBefore ?? new Date();
  localSessionRevocations.set(userId, effectiveDate.getTime());
  invalidateUserMetaCache(userId);

  if (await ensureSessionRevocationTable()) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.fiorix_session_revocations (user_id, revoked_before, reason)
         VALUES ($1, $2::timestamptz, $3)
         ON CONFLICT (user_id) DO UPDATE SET
           revoked_before = GREATEST(public.fiorix_session_revocations.revoked_before, EXCLUDED.revoked_before),
           reason = COALESCE(EXCLUDED.reason, public.fiorix_session_revocations.reason)`,
        userId,
        effectiveDate.toISOString(),
        options?.reason || 'security_revocation'
      );
    } catch {
      // Fallback em memória local mantido
    }
  }
}

function assertSessionNotRevoked(sessionAuthAt: number | undefined, revokedBeforeMs: number | undefined): void {
  if (!revokedBeforeMs) return;
  // Se houve revogação explícita para este usuário, JWTs sem authAt ou emitidos antes de revokedBefore são rejeitados
  if (typeof sessionAuthAt !== 'number' || sessionAuthAt < revokedBeforeMs) {
    throw new Error('Não autorizado: Sessão encerrada ou credenciais atualizadas. Faça login novamente.');
  }
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Não autorizado: Sessão não encontrada ou inválida.');
  }

  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  const userId = session.user.id;
  const sessionTenantId: string | undefined = session.user.tenantId;
  const sessionAuthAt: number | undefined = (session.user as any).authAt;

  // Checagem instantânea (0ms) de revogação registrada localmente
  const localRevokedMs = localSessionRevocations.get(userId);
  if (localRevokedMs) {
    assertSessionNotRevoked(sessionAuthAt, localRevokedMs);
  }

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
    assertSessionNotRevoked(sessionAuthAt, cachedMeta.revokedBeforeMs);
    liveRole = cachedMeta.role;
    liveStatus = cachedMeta.status;
    dbTenantId = cachedMeta.tenantId;
    departamento = cachedMeta.departamento;
    cargo = cachedMeta.cargo;
    userConfirmedInDb = true;
  } else if (!isTestEnv) {
    await ensureSessionRevocationTable();
    let rawUser: any[] | null = null;
    try {
      rawUser = await prisma.$queryRawUnsafe<any[]>(
        `SELECT u.role::text as role,
                COALESCE(u.status, 'ativo') as status,
                u."tenantId",
                u.departamento,
                u.cargo,
                sr.revoked_before
         FROM public."User" u
         LEFT JOIN public.fiorix_session_revocations sr ON sr.user_id = u.id
         WHERE u.id = $1
         LIMIT 1`,
        userId
      );
    } catch {
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
      const dbRevokedMs = rawUser[0].revoked_before
        ? new Date(rawUser[0].revoked_before).getTime()
        : undefined;
      const effectiveRevokedMs =
        localRevokedMs && dbRevokedMs
          ? Math.max(localRevokedMs, dbRevokedMs)
          : localRevokedMs || dbRevokedMs;
      userConfirmedInDb = true;

      userMetaCache.set(userId, {
        role: liveRole,
        status: liveStatus,
        tenantId: dbTenantId,
        departamento,
        cargo,
        revokedBeforeMs: effectiveRevokedMs,
        exists: true,
        exp: Date.now() + USER_META_CACHE_TTL_MS,
      });

      if (liveStatus === 'inativo') {
        throw new Error('Conta desativada: Acesso bloqueado pela administração.');
      }

      assertSessionNotRevoked(sessionAuthAt, effectiveRevokedMs);
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
  const tenantId =
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

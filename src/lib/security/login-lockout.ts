// ─── FIORIX Security: Proteção contra Força Bruta & Lockout Distribuído (PostgreSQL + Memória) ───

import { prisma } from '@/lib/prisma';

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

export interface LoginAttemptRecord {
  attempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

const loginAttemptsMap = new Map<string, LoginAttemptRecord>();
let lockoutTableEnsured = false;

// Precomputed dummy bcrypt hash (cost 10) para mitigar timing attack / enumeração de contas
export const DUMMY_BCRYPT_HASH = '$2a$10$wE9zZ6k3g7IeQ9kK3w1fce.dCcvzTfxu3p6oBq2o4dO6xZ6q6v6q6';

function isUnitTestMode(): boolean {
  return Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
}

async function ensureLockoutTable(): Promise<boolean> {
  if (isUnitTestMode()) return false;
  if (lockoutTableEnsured) return true;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_login_lockouts (
        identifier TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ NULL,
        last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE public.fiorix_login_lockouts ENABLE ROW LEVEL SECURITY`
    );
    lockoutTableEnsured = true;
    return true;
  } catch {
    return false;
  }
}

function pruneLocalLockoutMap(now: number): void {
  if (loginAttemptsMap.size <= 250) return;
  for (const [key, record] of loginAttemptsMap.entries()) {
    if (
      now - record.lastAttemptAt > LOCKOUT_WINDOW_MS &&
      (!record.lockedUntil || now > record.lockedUntil)
    ) {
      loginAttemptsMap.delete(key);
    }
  }
}

export async function checkLoginLockout(
  identifier: string
): Promise<{ isLocked: boolean; remainingMinutes?: number }> {
  const normalized = (identifier || '').trim().toLowerCase();
  if (!normalized) return { isLocked: false };

  const now = Date.now();
  pruneLocalLockoutMap(now);

  // 1. Verifica persistência compartilhada no PostgreSQL (cobre múltiplas instâncias serverless)
  if (await ensureLockoutTable()) {
    try {
      const rows = await prisma.$queryRawUnsafe<
        Array<{ attempts: number; locked_until: Date | string | null; last_attempt_at: Date | string }>
      >(
        `SELECT attempts, locked_until, last_attempt_at
         FROM public.fiorix_login_lockouts
         WHERE identifier = $1
         LIMIT 1`,
        normalized
      );
      if (rows.length > 0) {
        const lockedUntilMs = rows[0].locked_until ? new Date(rows[0].locked_until).getTime() : null;
        if (lockedUntilMs && now < lockedUntilMs) {
          const remainingMinutes = Math.max(1, Math.ceil((lockedUntilMs - now) / (60 * 1000)));
          loginAttemptsMap.set(normalized, {
            attempts: Number(rows[0].attempts || MAX_LOGIN_ATTEMPTS),
            lockedUntil: lockedUntilMs,
            lastAttemptAt: now,
          });
          return { isLocked: true, remainingMinutes };
        }
        if (lockedUntilMs && now >= lockedUntilMs) {
          await prisma.$executeRawUnsafe(
            `DELETE FROM public.fiorix_login_lockouts WHERE identifier = $1`,
            normalized
          );
          loginAttemptsMap.delete(normalized);
          return { isLocked: false };
        }
      }
    } catch {
      // Fallback transparente para memória local
    }
  }

  // 2. Fallback em memória local
  const record = loginAttemptsMap.get(normalized);
  if (!record) return { isLocked: false };

  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingMinutes = Math.max(1, Math.ceil((record.lockedUntil - now) / (60 * 1000)));
    return { isLocked: true, remainingMinutes };
  }

  if (record.lockedUntil && now >= record.lockedUntil) {
    loginAttemptsMap.delete(normalized);
    return { isLocked: false };
  }

  return { isLocked: false };
}

export async function recordFailedLogin(identifier: string): Promise<void> {
  const normalized = (identifier || '').trim().toLowerCase();
  if (!normalized) return;

  const now = Date.now();
  const existing = loginAttemptsMap.get(normalized);
  const resetExpired =
    existing &&
    now - existing.lastAttemptAt > LOCKOUT_WINDOW_MS &&
    (!existing.lockedUntil || now >= existing.lockedUntil);

  const record: LoginAttemptRecord =
    !existing || resetExpired
      ? { attempts: 1, lockedUntil: null, lastAttemptAt: now }
      : {
          attempts: existing.attempts + 1,
          lockedUntil: existing.lockedUntil,
          lastAttemptAt: now,
        };

  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_WINDOW_MS;
  }
  loginAttemptsMap.set(normalized, record);

  if (await ensureLockoutTable()) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.fiorix_login_lockouts (identifier, attempts, locked_until, last_attempt_at)
         VALUES (
           $1,
           1,
           CASE WHEN 1 >= $2 THEN NOW() + ($3 || ' milliseconds')::interval ELSE NULL END,
           NOW()
         )
         ON CONFLICT (identifier) DO UPDATE SET
           attempts = CASE
             WHEN public.fiorix_login_lockouts.last_attempt_at < NOW() - ($3 || ' milliseconds')::interval
                  AND (public.fiorix_login_lockouts.locked_until IS NULL OR public.fiorix_login_lockouts.locked_until <= NOW())
             THEN 1
             ELSE public.fiorix_login_lockouts.attempts + 1
           END,
           locked_until = CASE
             WHEN (
               CASE
                 WHEN public.fiorix_login_lockouts.last_attempt_at < NOW() - ($3 || ' milliseconds')::interval
                      AND (public.fiorix_login_lockouts.locked_until IS NULL OR public.fiorix_login_lockouts.locked_until <= NOW())
                 THEN 1
                 ELSE public.fiorix_login_lockouts.attempts + 1
               END
             ) >= $2
             THEN NOW() + ($3 || ' milliseconds')::interval
             ELSE public.fiorix_login_lockouts.locked_until
           END,
           last_attempt_at = NOW()`,
        normalized,
        MAX_LOGIN_ATTEMPTS,
        String(LOCKOUT_WINDOW_MS)
      );
    } catch {
      // Mantém bloqueio em memória local se banco indisponível
    }
  }
}

export async function clearLoginAttempts(identifier: string): Promise<void> {
  const normalized = (identifier || '').trim().toLowerCase();
  if (!normalized) return;

  loginAttemptsMap.delete(normalized);

  if (await ensureLockoutTable()) {
    try {
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.fiorix_login_lockouts WHERE identifier = $1`,
        normalized
      );
    } catch {
      // Ignora em fallback local
    }
  }
}

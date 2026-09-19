// ─── FIORIX Security: Proteção contra Força Bruta & Lockout de Login ─────────

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

export interface LoginAttemptRecord {
  attempts: number;
  lockedUntil: number | null;
  lastAttemptAt: number;
}

const loginAttemptsMap = new Map<string, LoginAttemptRecord>();

// Precomputed dummy bcrypt hash (cost 10) para mitigar timing attack / enumeração de contas
export const DUMMY_BCRYPT_HASH = '$2a$10$wE9zZ6k3g7IeQ9kK3w1fce.dCcvzTfxu3p6oBq2o4dO6xZ6q6v6q6';

export function checkLoginLockout(identifier: string): { isLocked: boolean; remainingMinutes?: number } {
  const normalized = (identifier || '').trim().toLowerCase();
  const now = Date.now();

  // Limpeza preventiva periódica
  if (loginAttemptsMap.size > 200) {
    for (const [key, record] of loginAttemptsMap.entries()) {
      if (now - record.lastAttemptAt > LOCKOUT_WINDOW_MS && (!record.lockedUntil || now > record.lockedUntil)) {
        loginAttemptsMap.delete(key);
      }
    }
  }

  const record = loginAttemptsMap.get(normalized);
  if (!record) return { isLocked: false };

  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingMinutes = Math.ceil((record.lockedUntil - now) / (60 * 1000));
    return { isLocked: true, remainingMinutes };
  }

  // Se o lockout expirou, reseta o registro
  if (record.lockedUntil && now >= record.lockedUntil) {
    loginAttemptsMap.delete(normalized);
    return { isLocked: false };
  }

  return { isLocked: false };
}

export function recordFailedLogin(identifier: string): void {
  const normalized = (identifier || '').trim().toLowerCase();
  const now = Date.now();
  const record = loginAttemptsMap.get(normalized) || { attempts: 0, lockedUntil: null, lastAttemptAt: now };
  record.attempts += 1;
  record.lastAttemptAt = now;

  if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_WINDOW_MS;
  }
  loginAttemptsMap.set(normalized, record);
}

export function clearLoginAttempts(identifier: string): void {
  const normalized = (identifier || '').trim().toLowerCase();
  loginAttemptsMap.delete(normalized);
}

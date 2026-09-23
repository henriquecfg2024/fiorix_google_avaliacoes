// ─── FIORIX Security: Rate Limiter por Usuário (in-memory) ────────────────────
// Protege endpoints sensíveis contra abuso, scraping e enumeração em massa.
// Em produção com múltiplas instâncias, substituir pelo Redis ou Upstash.

export interface RateLimitConfig {
  /** Janela de tempo em milissegundos */
  windowMs: number;
  /** Número máximo de requisições permitidas na janela */
  max: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Limpeza periódica automática para evitar memory leak
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

function cleanupExpiredEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > windowMs) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Verifica se o identificador (userId, IP, etc.) excedeu o limite de requisições.
 * Retorna `{ ok: true }` se permitido, `{ ok: false, retryAfterMs }` se bloqueado.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { ok: boolean; retryAfterMs?: number; remaining: number } {
  const now = Date.now();
  cleanupExpiredEntries(config.windowMs);

  const key = identifier.toLowerCase().trim();
  const entry = rateLimitStore.get(key);

  // Sem registro prévio — primeira requisição na janela
  if (!entry || now - entry.windowStart > config.windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { ok: true, remaining: config.max - 1 };
  }

  // Ainda dentro da janela
  entry.count += 1;

  if (entry.count > config.max) {
    const retryAfterMs = config.windowMs - (now - entry.windowStart);
    return { ok: false, retryAfterMs, remaining: 0 };
  }

  return { ok: true, remaining: config.max - entry.count };
}

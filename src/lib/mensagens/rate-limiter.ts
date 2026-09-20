/**
 * Rate Limiter compartilhado com backend PostgreSQL (fiorix_rate_limits).
 *
 * Funciona corretamente entre múltiplas instâncias Vercel Serverless.
 * Usa operação atômica UPSERT com janela temporal fixa.
 *
 * Abstração permite substituição futura por Redis/Upstash sem alterar chamadores.
 */

import { prisma } from '@/lib/prisma';

/**
 * Configuração de limites por operação.
 * Limites diferentes conforme o risco da operação.
 */
export const RATE_LIMITS = {
  // Mensagens — limite alto (uso frequente)
  sendMessage:     { maxRequests: 20, windowMs: 10_000 },
  forwardMessage:  { maxRequests: 10, windowMs: 10_000 },
  sendFiorixCard:  { maxRequests: 10, windowMs: 10_000 },

  // Upload — restritivo (custo de storage)
  upload:          { maxRequests: 5,  windowMs: 30_000 },

  // Edição — moderado
  editMessage:     { maxRequests: 10, windowMs: 10_000 },

  // Reações — moderado
  toggleReaction:  { maxRequests: 30, windowMs: 10_000 },

  // Busca — moderado (custo de query)
  searchMessages:  { maxRequests: 10, windowMs: 10_000 },

  // Criação de grupo — baixo (operação pesada)
  createGroup:     { maxRequests: 3,  windowMs: 60_000 },

  // Convites — baixo
  generateInvite:  { maxRequests: 5,  windowMs: 60_000 },

  // Push subscribe — baixo (já tem quota de 10 dispositivos)
  pushSubscribe:   { maxRequests: 5,  windowMs: 60_000 },
} as const;

export type RateLimitOperation = keyof typeof RATE_LIMITS;

/**
 * Verifica rate limit usando PostgreSQL atômico.
 *
 * Estratégia: UPSERT com janela fixa.
 * - Se o registro não existe ou expirou → cria/reseta com points=1
 * - Se existe e não expirou → incrementa points
 * - Se points >= maxRequests → bloqueia
 *
 * Usa raw SQL para operação atômica (evita race conditions com SELECT+UPDATE separados).
 *
 * @param userId - ID do usuário
 * @param operation - Nome da operação (chave de RATE_LIMITS)
 * @returns true se permitido, false se bloqueado
 */
export async function checkRateLimit(
  userId: string,
  operation: RateLimitOperation
): Promise<boolean> {
  const config = RATE_LIMITS[operation];
  const key = `${operation}:${userId}`;
  const windowEnd = new Date(Date.now() + config.windowMs);

  try {
    // Operação atômica: INSERT ON CONFLICT UPDATE
    // Se a janela expirou, reseta para 1. Se não, incrementa.
    const result: { points: number }[] = await prisma.$queryRawUnsafe(`
      INSERT INTO fiorix_rate_limits (key, points, "expireAt", "updatedAt")
      VALUES ($1, 1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET
        points = CASE
          WHEN fiorix_rate_limits."expireAt" < NOW()
            THEN 1
            ELSE fiorix_rate_limits.points + 1
        END,
        "expireAt" = CASE
          WHEN fiorix_rate_limits."expireAt" < NOW()
            THEN $2
            ELSE fiorix_rate_limits."expireAt"
        END,
        "updatedAt" = NOW()
      RETURNING points
    `, key, windowEnd);

    const points = result[0]?.points ?? 0;
    return points <= config.maxRequests;
  } catch (error) {
    // Em caso de falha do DB, permite a operação (fail open para rate limit)
    // mas loga o erro. Prefere-se disponibilidade a segurança para rate limit.
    console.error('[RateLimit] Falha na verificação:', error);
    return true;
  }
}

/**
 * Limpa registros expirados. Pode ser chamado periodicamente.
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  try {
    const result = await prisma.$executeRawUnsafe(`
      DELETE FROM fiorix_rate_limits WHERE "expireAt" < NOW()
    `);
    return result;
  } catch {
    return 0;
  }
}

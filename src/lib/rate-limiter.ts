import { prisma } from './prisma';

/**
 * Verifica se um IP/Usuário atingiu o limite de requisições.
 * @param key Chave de rate limit (ex: "ip:endpoint")
 * @param maxPoints Limite máximo de requisições na janela
 * @param windowSeconds Janela temporal em segundos
 * @returns Um objeto indicando o sucesso, limite, restantes e tempo de reset
 */
export async function checkRateLimit(
  key: string,
  maxPoints: number,
  windowSeconds: number
): Promise<{ success: boolean; limit: number; remaining: number; reset: Date }> {
  const now = new Date();
  const expireAt = new Date(now.getTime() + windowSeconds * 1000);

  return await prisma.$transaction(async (tx) => {
    const record = await tx.rateLimit.findUnique({
      where: { key },
    });

    if (!record || record.expireAt <= now) {
      await tx.rateLimit.upsert({
        where: { key },
        create: {
          key,
          points: 1,
          expireAt,
        },
        update: {
          points: 1,
          expireAt,
        },
      });

      return {
        success: true,
        limit: maxPoints,
        remaining: maxPoints - 1,
        reset: expireAt,
      };
    }

    if (record.points >= maxPoints) {
      return {
        success: false,
        limit: maxPoints,
        remaining: 0,
        reset: record.expireAt,
      };
    }

    const updated = await tx.rateLimit.update({
      where: { key },
      data: {
        points: { increment: 1 },
      },
    });

    return {
      success: true,
      limit: maxPoints,
      remaining: maxPoints - updated.points,
      reset: record.expireAt,
    };
  });
}

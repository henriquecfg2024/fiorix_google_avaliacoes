import { buildColaboradorRanking } from '@/lib/colaboradores-metrics';
import { prisma } from '@/lib/prisma';

/** Active colaboradores with their mentions, plus every review of the tenant. */
export async function loadColaboradoresComReviews(tenantId: string) {
  const [colaboradores, reviews] = await Promise.all([
    prisma.colaborador.findMany({
      where: { tenantId, active: true },
      include: { mentions: { include: { review: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.review.findMany({ where: { tenantId } }),
  ]);

  return { colaboradores, reviews };
}

export async function loadColaboradorRanking(tenantId: string) {
  const { colaboradores, reviews } = await loadColaboradoresComReviews(tenantId);
  return buildColaboradorRanking(colaboradores, reviews);
}

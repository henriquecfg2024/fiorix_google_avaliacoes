import { prisma } from '@/lib/prisma';

export interface RatingDistribution {
  total: number;
  responded: number;
  pending: number;
  byRating: Record<1 | 2 | 3 | 4 | 5, number>;
}

const EMPTY_DISTRIBUTION: RatingDistribution = {
  total: 0,
  responded: 0,
  pending: 0,
  byRating: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

/** Review counts per star rating plus response status totals for a tenant. */
export async function getRatingDistribution(
  tenantId: string,
  logLabel = 'Error loading review distribution:'
): Promise<RatingDistribution> {
  try {
    const [total, responded, pending, five, four, three, two, one] = await Promise.all([
      prisma.review.count({ where: { tenantId } }),
      prisma.review.count({ where: { tenantId, status: 'RESPONDED' } }),
      prisma.review.count({ where: { tenantId, status: 'PENDING' } }),
      ...[5, 4, 3, 2, 1].map((rating) => prisma.review.count({ where: { tenantId, rating } })),
    ]);

    return {
      total,
      responded,
      pending,
      byRating: { 5: five, 4: four, 3: three, 2: two, 1: one },
    };
  } catch (err) {
    console.error(logLabel, err);
    return EMPTY_DISTRIBUTION;
  }
}

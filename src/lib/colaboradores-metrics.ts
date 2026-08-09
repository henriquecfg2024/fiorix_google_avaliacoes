export interface ColaboradorMetric {
  elogios: number;
  mencoes: number;
  notaMedia: string;
}

const DEMO_METRICS: Record<string, ColaboradorMetric> = {
  lucas: { elogios: 142, mencoes: 156, notaMedia: '4.9' },
  ana: { elogios: 98, mencoes: 104, notaMedia: '4.8' },
  anne: { elogios: 88, mencoes: 92, notaMedia: '4.9' },
  ricardo: { elogios: 76, mencoes: 82, notaMedia: '4.7' },
  marçal: { elogios: 76, mencoes: 82, notaMedia: '4.7' },
  'ricardo marçal': { elogios: 76, mencoes: 82, notaMedia: '4.7' },
  jozi: { elogios: 45, mencoes: 49, notaMedia: '4.9' },
  jozilene: { elogios: 45, mencoes: 49, notaMedia: '4.9' },
  bruno: { elogios: 32, mencoes: 35, notaMedia: '4.8' },
  'david bruno': { elogios: 32, mencoes: 35, notaMedia: '4.8' },
  juliana: { elogios: 28, mencoes: 30, notaMedia: '4.9' },
  sarah: { elogios: 22, mencoes: 24, notaMedia: '4.8' },
  theodoro: { elogios: 19, mencoes: 21, notaMedia: '4.7' },
  guilherme: { elogios: 15, mencoes: 17, notaMedia: '4.9' },
  vanderlei: { elogios: 12, mencoes: 14, notaMedia: '4.8' },
  jonatan: { elogios: 10, mencoes: 11, notaMedia: '4.7' },
};

const DEMO_FALLBACK: ColaboradorMetric = { elogios: 15, mencoes: 18, notaMedia: '4.8' };

export function getDemoMetric(name: string, aliases: string[] = []): ColaboradorMetric {
  const allNames = [name, ...aliases].map((n) => n.trim().toLowerCase());
  for (const n of allNames) {
    if (DEMO_METRICS[n]) return DEMO_METRICS[n];
    for (const key of Object.keys(DEMO_METRICS)) {
      if (n.includes(key) || key.includes(n)) {
        return DEMO_METRICS[key];
      }
    }
  }
  return DEMO_FALLBACK;
}

interface ReviewLike {
  id: string;
  comment?: string | null;
  rating: number;
  publishedAt: Date | string;
  aiSentiment?: string | null;
}

interface ColaboradorLike {
  id: string;
  name: string;
  aliases?: string[] | null;
  mentions?: { review?: ReviewLike | null }[] | null;
}

/**
 * Reviews attributed to a colaborador: relational mentions plus reviews whose
 * comment cites the colaborador name or one of its aliases.
 */
export function getColaboradorReviews(
  colaborador: ColaboradorLike,
  allReviews: ReviewLike[],
  fromDate?: Date
): ReviewLike[] {
  const namesToSearch = [colaborador.name, ...(colaborador.aliases || [])]
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);

  const isInPeriod = (review: ReviewLike) =>
    !fromDate || new Date(review.publishedAt) >= fromDate;

  const matchedReviews = allReviews.filter((review) => {
    if (!review.comment || !isInPeriod(review)) return false;
    const commentLower = review.comment.toLowerCase();
    return namesToSearch.some((term) => commentLower.includes(term));
  });

  const relationalReviews = (colaborador.mentions || [])
    .map((mention) => mention.review)
    .filter((review): review is ReviewLike => Boolean(review) && isInPeriod(review!));

  const uniqueReviews = new Map<string, ReviewLike>();
  [...relationalReviews, ...matchedReviews].forEach((review) => {
    if (review?.id) uniqueReviews.set(review.id, review);
  });

  return Array.from(uniqueReviews.values());
}

export function countElogios(reviews: ReviewLike[]) {
  return reviews.filter((review) => review.rating >= 4 || review.aiSentiment === 'POSITIVE').length;
}

export interface ColaboradorRanking extends ColaboradorMetric {
  id: string;
  nome: string;
}

/**
 * Ranking rows for the relatórios pages. Colaboradores without attributed
 * reviews fall back to demo metrics while the tenant has no reviews at all.
 */
export function buildColaboradorRanking(
  colaboradores: ColaboradorLike[],
  allReviews: ReviewLike[]
): ColaboradorRanking[] {
  return colaboradores
    .map((colab) => {
      const reviews = getColaboradorReviews(colab, allReviews);

      if (reviews.length > 0) {
        const ratings = reviews.map((review) => review.rating);
        return {
          id: colab.id,
          nome: colab.name,
          elogios: countElogios(reviews),
          mencoes: reviews.length,
          notaMedia: (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
        };
      }

      if (allReviews.length === 0) {
        return { id: colab.id, nome: colab.name, ...getDemoMetric(colab.name, colab.aliases || []) };
      }

      return { id: colab.id, nome: colab.name, elogios: 0, mencoes: 0, notaMedia: '5.0' };
    })
    .sort((a, b) => b.mencoes - a.mencoes);
}

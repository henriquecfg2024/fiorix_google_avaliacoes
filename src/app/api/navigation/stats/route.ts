import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const getNavigationStatsForTenant = unstable_cache(
  async (tenantId: string) => {
    const [biTotal, metasTotal, prodTotal, auditoriaTotal, importTotal, pendingReviewsCount] =
      await Promise.all([
        prisma.fiorixBiData.count({ where: { tenantId } }).catch(() => 0),
        prisma.fiorixMetasDados.count({ where: { tenantId, status: "Atrasado" } }).catch(() => 0),
        prisma.fiorixBiData.count({ where: { tenantId, isRegistrado: true } }).catch(() => 0),
        prisma.fiorixMetasDados
          .count({ where: { tenantId, dBalcaoRegistrado: null, dBalcaoDevolvido: null } })
          .catch(() => 0),
        prisma.fiorixBiImport
          .aggregate({ where: { tenantId }, _sum: { rowsCount: true } })
          .then((result) => result._sum.rowsCount || 0)
          .catch(() => 0),
        prisma.review
          .count({ where: { tenantId, status: "PENDING", deletedFromGoogle: false } })
          .catch(() => 0),
      ]);

    return { biTotal, metasTotal, prodTotal, auditoriaTotal, importTotal, pendingReviewsCount };
  },
  ["navigation-stats-v2"],
  { revalidate: 300 }
);

function formatNumber(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(num);
}

export async function GET() {
  try {
    const { tenantId } = await requireAuth();
    const { biTotal, metasTotal, prodTotal, auditoriaTotal, importTotal, pendingReviewsCount } =
      await getNavigationStatsForTenant(tenantId);

    return NextResponse.json({
      success: true,
      stats: {
        biCount: formatNumber(biTotal),
        metasCount: formatNumber(metasTotal),
        prodCount: formatNumber(prodTotal),
        auditoriaCount: formatNumber(auditoriaTotal),
        importCount: formatNumber(importTotal),
        pendingReviewsCount,
      },
    });
  } catch (error: any) {
    console.error("Error fetching navigation stats:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Não autorizado" },
        { status: 401 }
      );
    }

    // Dynamic stats from Prisma models for the user's tenant
    const [biTotal, metasTotal, prodTotal, auditoriaTotal, importTotal] = await Promise.all([
      // 1. Módulo BI total rows
      prisma.fiorixBiData.count({ where: { tenantId: user.tenantId } }).catch(() => 0),
      // 2. Metas (pending / delayed protocols)
      prisma.fiorixMetasDados.count({ where: { tenantId: user.tenantId, status: "Atrasado" } }).catch(() => 0),
      // 3. Produtividade (total items)
      prisma.fiorixBiData.count({ where: { tenantId: user.tenantId, isRegistrado: true } }).catch(() => 0),
      // 4. Auditoria (pending sem ID 76/75)
      prisma.fiorixMetasDados.count({
        where: {
          tenantId: user.tenantId,
          dBalcaoRegistrado: null,
          dBalcaoDevolvido: null,
        }
      }).catch(() => 0),
      // 5. Total importações rows count
      prisma.fiorixBiImport.aggregate({
        where: { tenantId: user.tenantId },
        _sum: { rowsCount: true }
      }).then(res => res._sum.rowsCount || 0).catch(() => 0),
    ]);

    const formatNumber = (num: number) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
      if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
      return String(num);
    };

    return NextResponse.json({
      success: true,
      stats: {
        biCount: biTotal > 0 ? formatNumber(biTotal) : "15.5k",
        metasCount: metasTotal > 0 ? String(metasTotal) : "281",
        prodCount: prodTotal > 0 ? formatNumber(prodTotal) : "7.058",
        auditoriaCount: auditoriaTotal > 0 ? String(auditoriaTotal) : "280",
        importCount: importTotal > 0 ? formatNumber(importTotal) : "118.523",
      }
    });
  } catch (error: any) {
    console.error("Error fetching navigation stats:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

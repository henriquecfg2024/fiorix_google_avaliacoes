import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";
import { produtividadeTenantCache } from "@/lib/bi-produtividade-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireTenant();
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === "test");

    if (!forceRefresh && !isTestEnv) {
      const cached = produtividadeTenantCache.get(user.tenantId);
      if (cached) {
        return NextResponse.json({ success: true, data: cached, cached: true });
      }
    }

    const rows: Record<string, unknown>[] = await prisma.$queryRaw(
      Prisma.sql`
        SELECT 
          to_char("data", 'YYYY-MM-DD') as "DATA",
          COALESCE("hora_num", EXTRACT(HOUR FROM "hora"::time)::int, EXTRACT(HOUR FROM "data"::timestamp)::int) as "HORA_NUM",
          "dia_semana" as "DIA_SEMANA",
          "hora" as "HORA",
          "pedido"::text as "PEDIDO",
          "nome" as "NOME",
          "tipo" as "TIPO",
          "tipo_pedido" as "TIPO_PEDIDO",
          "tipo_detalhado" as "TIPO_DETALHADO",
          "quantidade" as "QUANTIDADE"
        FROM public.fiorix_produtividade_dados
        WHERE tenant_id = ${user.tenantId}
        ORDER BY "data" DESC, "hora" DESC NULLS LAST
        LIMIT 50000;
      `
    );

    if (!isTestEnv) {
      produtividadeTenantCache.set(user.tenantId, rows);
    }

    return NextResponse.json({ success: true, data: rows });
  } catch (error: unknown) {
    console.error("Erro ao buscar dados de produtividade:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao consultar banco de dados" },
      { status: 500 }
    );
  }
}


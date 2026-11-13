import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";
import {
  buildProdutividadeCacheKey,
  produtividadeTenantCache,
} from "@/lib/bi-produtividade-cache";

export const dynamic = "force-dynamic";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const produtividadeInFlight = new Map<string, Promise<Record<string, unknown>[]>>();

export async function GET(request: Request) {
  try {
    const user = await requireTenant();
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const dataInicioParam = searchParams.get("dataInicio")?.trim() || null;
    const dataFimParam = searchParams.get("dataFim")?.trim() || null;
    const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === "test");

    if (
      (dataInicioParam && !ISO_DATE_RE.test(dataInicioParam)) ||
      (dataFimParam && !ISO_DATE_RE.test(dataFimParam))
    ) {
      return NextResponse.json(
        { success: false, error: "Parâmetro de data inválido. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const cacheKey = buildProdutividadeCacheKey(user.tenantId, dataInicioParam, dataFimParam);

    if (!forceRefresh && !isTestEnv) {
      const cached = produtividadeTenantCache.get(cacheKey);
      if (cached) {
        return NextResponse.json(
          { success: true, data: cached, cached: true },
          { headers: { "Cache-Control": "private, no-store" } }
        );
      }
    }

    const runQuery = async (): Promise<Record<string, unknown>[]> => {
      const startFilter = dataInicioParam
        ? Prisma.sql`AND "data" >= ${dataInicioParam}::date`
        : Prisma.sql``;
      const endFilter = dataFimParam
        ? Prisma.sql`AND "data" < (${dataFimParam}::date + INTERVAL '1 day')`
        : Prisma.sql``;

      return prisma.$queryRaw(
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
            ${startFilter}
            ${endFilter}
          ORDER BY "data" DESC, "hora" DESC NULLS LAST
          LIMIT 50000;
        `
      );
    };

    let rows: Record<string, unknown>[];
    if (!forceRefresh && !isTestEnv) {
      let running = produtividadeInFlight.get(cacheKey);
      if (!running) {
        running = runQuery().finally(() => {
          produtividadeInFlight.delete(cacheKey);
        });
        produtividadeInFlight.set(cacheKey, running);
      }
      rows = await running;
      produtividadeTenantCache.set(cacheKey, rows);
    } else {
      rows = await runQuery();
    }

    return NextResponse.json(
      { success: true, data: rows },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: unknown) {
    console.error("Erro ao buscar dados de produtividade:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao consultar banco de dados" },
      { status: 500 }
    );
  }
}

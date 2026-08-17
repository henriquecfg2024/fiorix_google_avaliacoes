import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireTenant();

    const rows: any[] = await prisma.$queryRaw(
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
        ORDER BY "data" DESC
        LIMIT 200000;
      `
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("Erro ao buscar dados de produtividade:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao consultar banco de dados" },
      { status: 500 }
    );
  }
}


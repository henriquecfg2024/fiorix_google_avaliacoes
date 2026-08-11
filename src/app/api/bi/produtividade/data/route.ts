import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Ensure table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_produtividade_dados (
        "DATA" DATE NOT NULL,
        "HORA_NUM" INTEGER NOT NULL,
        "DIA_SEMANA" VARCHAR(20) NOT NULL,
        "HORA" VARCHAR(10) NOT NULL,
        "PEDIDO" BIGINT NOT NULL,
        "NOME" VARCHAR(255) NOT NULL,
        "TIPO" VARCHAR(50) NOT NULL,
        "TIPO_PEDIDO" VARCHAR(100) NOT NULL,
        "TIPO_DETALHADO" TEXT,
        "QUANTIDADE" INTEGER NOT NULL DEFAULT 1,
        CONSTRAINT pk_fiorix_produtividade PRIMARY KEY ("PEDIDO", "DATA")
      );
    `);

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        to_char("DATA", 'YYYY-MM-DD') as "DATA",
        "HORA_NUM",
        "DIA_SEMANA",
        "HORA",
        "PEDIDO"::text as "PEDIDO",
        "NOME",
        "TIPO",
        "TIPO_PEDIDO",
        "TIPO_DETALHADO",
        "QUANTIDADE"
      FROM public.fiorix_produtividade_dados
      ORDER BY "DATA" DESC
      LIMIT 200000;
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("Erro ao buscar dados de produtividade:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao consultar banco de dados" },
      { status: 500 }
    );
  }
}

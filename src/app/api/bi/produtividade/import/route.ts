import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { rows } = await request.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum dado válido para importação." },
        { status: 400 }
      );
    }

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

    const chunkSize = 500;
    let insertedTotal = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      const valueStrings = chunk
        .map((r: any) => {
          const dataStr = r.DATA ? `'${r.DATA.replace(/'/g, "''")}'::date` : "CURRENT_DATE";
          const horaNum = parseInt(r.HORA_NUM || 0, 10);
          const diaSemana = (r.DIA_SEMANA || "Monday").replace(/'/g, "''");
          const hora = (r.HORA || "00:00").replace(/'/g, "''");
          const pedido = parseInt(r.PEDIDO || 0, 10);
          const nome = (r.NOME || "Outro").replace(/'/g, "''");
          const tipo = (r.TIPO || "TÍTULO").replace(/'/g, "''");
          const tipoPedido = (r.TIPO_PEDIDO || "PRENOTADO").replace(/'/g, "''");
          const tipoDetalhado = (r.TIPO_DETALHADO || "").replace(/'/g, "''");
          const quantidade = parseInt(r.QUANTIDADE || 1, 10);

          return `(${dataStr}, ${horaNum}, '${diaSemana}', '${hora}', ${pedido}, '${nome}', '${tipo}', '${tipoPedido}', '${tipoDetalhado}', ${quantidade})`;
        })
        .join(",\n");

      const query = `
        INSERT INTO public.fiorix_produtividade_dados ("DATA", "HORA_NUM", "DIA_SEMANA", "HORA", "PEDIDO", "NOME", "TIPO", "TIPO_PEDIDO", "TIPO_DETALHADO", "QUANTIDADE")
        VALUES ${valueStrings}
        ON CONFLICT ("PEDIDO", "DATA") DO UPDATE SET
          "HORA_NUM" = EXCLUDED."HORA_NUM",
          "DIA_SEMANA" = EXCLUDED."DIA_SEMANA",
          "HORA" = EXCLUDED."HORA",
          "NOME" = EXCLUDED."NOME",
          "TIPO" = EXCLUDED."TIPO",
          "TIPO_PEDIDO" = EXCLUDED."TIPO_PEDIDO",
          "TIPO_DETALHADO" = EXCLUDED."TIPO_DETALHADO",
          "QUANTIDADE" = EXCLUDED."QUANTIDADE";
      `;

      await prisma.$executeRawUnsafe(query);
      insertedTotal += chunk.length;
    }

    return NextResponse.json({ success: true, count: insertedTotal });
  } catch (error: any) {
    console.error("Erro na API de importação:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro no banco de dados durante a importação" },
      { status: 500 }
    );
  }
}

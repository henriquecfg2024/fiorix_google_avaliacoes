import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

import { upsertProdutividadeImportRecord } from "@/lib/import-history";

const prisma = new PrismaClient();

interface ImportMetaPayload {
  importKey: string;
  fileName: string;
  totalRows: number;
  importedBy?: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  batchNumber?: number;
  totalBatches?: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action;

    if (action === "mark_failed") {
      const meta = body?.importMeta as ImportMetaPayload | undefined;
      if (meta?.importKey && meta?.fileName) {
        await upsertProdutividadeImportRecord({
          importKey: meta.importKey,
          fileName: meta.fileName,
          rowsCount: Number(meta.totalRows || 0),
          insertedCount: 0,
          importedBy: meta.importedBy || "Manual CSV",
          status: "FAILED",
          errorMessage: body?.errorMessage || "Falha durante a importação",
          periodStart: meta.periodStart || null,
          periodEnd: meta.periodEnd || null,
        });
      }

      return NextResponse.json({ success: true });
    }

    const rows = body?.rows;
    const importMeta = body?.importMeta as ImportMetaPayload | undefined;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum dado válido para importação." },
        { status: 400 }
      );
    }

    if (importMeta?.importKey && importMeta?.fileName) {
      await upsertProdutividadeImportRecord({
        importKey: importMeta.importKey,
        fileName: importMeta.fileName,
        rowsCount: Number(importMeta.totalRows || rows.length),
        insertedCount: 0,
        importedBy: importMeta.importedBy || "Manual CSV",
        status: "PROCESSING",
        periodStart: importMeta.periodStart || null,
        periodEnd: importMeta.periodEnd || null,
      });
    }

    const normalizedRows = rows.map((row: any) => {
      const obj: any = {};
      Object.entries(row).forEach(([key, value]) => {
        const cleanKey = key.toLowerCase().trim().replace(/"/g, "").replace(/\uFEFF/g, "");
        obj[cleanKey] = value;
      });
      return obj;
    });

    const dedupMap = new Map();
    for (const row of normalizedRows) {
      const key = `${row.pedido}_${row.data}`;
      if (!dedupMap.has(key)) {
        dedupMap.set(key, row);
      }
    }
    const rowsToInsert = Array.from(dedupMap.values());

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_produtividade_dados (
        data DATE NOT NULL,
        hora_num INTEGER NOT NULL,
        dia_semana VARCHAR(20) NOT NULL,
        hora VARCHAR(10) NOT NULL,
        pedido BIGINT NOT NULL,
        nome VARCHAR(255) NOT NULL,
        tipo VARCHAR(50) NOT NULL,
        tipo_pedido VARCHAR(100) NOT NULL,
        tipo_detalhado TEXT,
        quantidade INTEGER NOT NULL DEFAULT 1,
        CONSTRAINT pk_fiorix_produtividade PRIMARY KEY (pedido, data)
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS fiorix_produtividade_dados_pedido_data_idx
      ON public.fiorix_produtividade_dados (pedido, data);
    `);

    const chunkSize = 500;
    let insertedTotal = 0;

    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);

      const valueStrings = chunk
        .map((row: any) => {
          let parsedDate = row.data || "";
          if (parsedDate.includes("/")) {
            const parts = parsedDate.split("/");
            if (parts.length === 3) {
              parsedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            }
          }

          const dataStr = parsedDate ? `'${parsedDate.replace(/'/g, "''")}'::date` : "CURRENT_DATE";
          const horaNum = parseInt(row.hora_num || 0, 10);
          const diaSemana = (row.dia_semana || "Monday").replace(/'/g, "''");
          const hora = (row.hora || "00:00").replace(/'/g, "''");
          const pedido = parseInt(row.pedido || 0, 10);
          const nome = (row.nome || "Outro").replace(/'/g, "''");
          const tipo = (row.tipo || "TÍTULO").replace(/'/g, "''");
          const tipoPedido = (row.tipo_pedido || "PRENOTADO").replace(/'/g, "''");
          const tipoDetalhado = (row.tipo_detalhado || "").replace(/'/g, "''");
          const quantidade = parseInt(
            row.quantidade !== undefined && row.quantidade !== "" ? row.quantidade : 1,
            10
          );

          return `(${dataStr}, ${horaNum}, '${diaSemana}', '${hora}', ${pedido}, '${nome}', '${tipo}', '${tipoPedido}', '${tipoDetalhado}', ${quantidade})`;
        })
        .join(",\n");

      const query = `
        INSERT INTO public.fiorix_produtividade_dados (
          data, hora_num, dia_semana, hora, pedido, nome, tipo, tipo_pedido, tipo_detalhado, quantidade
        )
        VALUES ${valueStrings}
        ON CONFLICT (pedido, data) DO NOTHING;
      `;

      await prisma.$executeRawUnsafe(query);
      insertedTotal += chunk.length;
    }

    if (
      importMeta?.importKey &&
      importMeta?.fileName &&
      importMeta.batchNumber === importMeta.totalBatches
    ) {
      await upsertProdutividadeImportRecord({
        importKey: importMeta.importKey,
        fileName: importMeta.fileName,
        rowsCount: Number(importMeta.totalRows || rowsToInsert.length),
        insertedCount: Number(importMeta.totalRows || rowsToInsert.length),
        importedBy: importMeta.importedBy || "Manual CSV",
        status: "SUCCESS",
        periodStart: importMeta.periodStart || null,
        periodEnd: importMeta.periodEnd || null,
      });
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

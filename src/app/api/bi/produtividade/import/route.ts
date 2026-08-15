import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { upsertProdutividadeImportRecord } from "@/lib/import-history";
import { Prisma } from "@prisma/client";

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

const MAX_BATCH_SIZE = 5000;

export async function POST(request: Request) {
  try {
    const user = await requireRole("ADMIN", "MASTER");
    const body = await request.json();
    const action = body?.action;

    if (action === "mark_failed") {
      const meta = body?.importMeta as ImportMetaPayload | undefined;
      if (meta?.importKey && meta?.fileName) {
        await upsertProdutividadeImportRecord({
          importKey: meta.importKey,
          tenantId: user.tenantId,
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

    if (rows.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { success: false, error: `Lote excede o limite máximo permitido de ${MAX_BATCH_SIZE} linhas.` },
        { status: 400 }
      );
    }

    if (importMeta?.importKey && importMeta?.fileName) {
      await upsertProdutividadeImportRecord({
        importKey: importMeta.importKey,
        tenantId: user.tenantId,
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

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS public.fiorix_produtividade_dados (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(100) NOT NULL DEFAULT '',
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
        CONSTRAINT pk_fiorix_produtividade UNIQUE (tenant_id, pedido, data)
      );
    `;

    let insertedTotal = 0;

    for (const row of rowsToInsert) {
      let parsedDate = row.data || "";
      if (parsedDate.includes("/")) {
        const parts = parsedDate.split("/");
        if (parts.length === 3) {
          parsedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }

      const dtVal = parsedDate ? new Date(parsedDate) : new Date();
      const horaNum = parseInt(row.hora_num || 0, 10);
      const diaSemana = row.dia_semana || "Monday";
      const hora = row.hora || "00:00";
      const pedido = BigInt(row.pedido || 0);
      const nome = row.nome || "Outro";
      const tipo = row.tipo || "TÍTULO";
      const tipoPedido = row.tipo_pedido || "PRENOTADO";
      const tipoDetalhado = row.tipo_detalhado || "";
      const quantidade = parseInt(
        row.quantidade !== undefined && row.quantidade !== "" ? row.quantidade : 1,
        10
      );

      await prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO public.fiorix_produtividade_dados (
            tenant_id, data, hora_num, dia_semana, hora, pedido, nome, tipo, tipo_pedido, tipo_detalhado, quantidade
          )
          VALUES (
            ${user.tenantId}, ${dtVal}, ${horaNum}, ${diaSemana}, ${hora}, ${pedido}, ${nome}, ${tipo}, ${tipoPedido}, ${tipoDetalhado}, ${quantidade}
          )
          ON CONFLICT (tenant_id, pedido, data) DO NOTHING;
        `
      );
      insertedTotal++;
    }

    if (
      importMeta?.importKey &&
      importMeta?.fileName &&
      importMeta.batchNumber === importMeta.totalBatches
    ) {
      await upsertProdutividadeImportRecord({
        importKey: importMeta.importKey,
        tenantId: user.tenantId,
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


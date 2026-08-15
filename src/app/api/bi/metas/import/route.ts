import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { ensureMetasImportsTable } from "@/lib/import-history";
import { Prisma } from "@prisma/client";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN", "MASTER");
    const body = await req.json();
    const { rows, importMeta, action } = body;

    await ensureMetasImportsTable();

    if (action === "mark_failed") {
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE public.fiorix_metas_imports
          SET status = 'FAILED'
          WHERE import_key = ${importMeta.importKey} AND tenant_id = ${user.tenantId}
        `
      );
      return NextResponse.json({ success: true });
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Nenhum dado informado" }, { status: 400 });
    }

    const { importKey, fileName, totalRows, importedBy, periodStart, periodEnd, batchNumber, totalBatches } = importMeta;

    const periodStr = periodStart && periodEnd ? `${periodStart}|${periodEnd}` : '';
    const status = batchNumber === totalBatches ? 'Concluído' : 'Processando';

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO public.fiorix_metas_imports (
          tenant_id, import_key, arquivo, periodo, linhas, inseridas, importado_por, status
        ) VALUES (
          ${user.tenantId}, ${importKey}, ${fileName}, ${periodStr}, ${totalRows}, 0, ${importedBy}, ${status}
        )
        ON CONFLICT (import_key) DO UPDATE SET
          linhas = EXCLUDED.linhas,
          status = EXCLUDED.status;
      `
    );

    const importRecords: any[] = await prisma.$queryRaw(
      Prisma.sql`
        SELECT id FROM public.fiorix_metas_imports WHERE import_key = ${importKey} AND tenant_id = ${user.tenantId}
      `
    );
    
    if (!importRecords || importRecords.length === 0) {
      return NextResponse.json({ error: "Falha ao criar/localizar registro de importação" }, { status: 500 });
    }

    const importId = importRecords[0].id;
    let insertedCount = 0;

    if (rows.length > 0) {
      const parseDate = (val: any) => {
        if (!val) return null;
        const str = String(val).trim();
        if (!str || str.toUpperCase() === 'NULL' || str === 'undefined') return null;

        if (str.includes('/')) {
           const parts = str.split(' ');
           const dateParts = parts[0].split('/');
           const timePart = parts[1] || '00:00:00';
           if (dateParts.length === 3) {
             const dt = new Date(`${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}T${timePart}`);
             return Number.isNaN(dt.getTime()) ? null : dt;
           }
        }
        const dt = new Date(str);
        return Number.isNaN(dt.getTime()) ? null : dt;
      };

      const parseIntSafe = (val: any) => {
        if (!val) return null;
        const str = String(val).trim();
        if (!str || str.toUpperCase() === 'NULL' || str === 'undefined') return null;
        const parsed = parseInt(str, 10);
        return isNaN(parsed) ? null : parsed;
      };

      for (const row of rows) {
        const p = parseIntSafe(row.PROTOCOLO);
        if (p === null) continue;

        const statusClean = (row.STATUS || '').trim();
        const naturezaClean = (row.NATUREZA || row.natureza || row.TIPO_DETALHADO || row.tipo_detalhado || '').trim();

        await prisma.$executeRaw(
          Prisma.sql`
            INSERT INTO public.fiorix_metas_dados (
              tenant_id, PROTOCOLO, DATA_APRESENTADO, DT_PREVISAO, DT_ENTREGA_REAL, STATUS, NATUREZA, ATRASO_DIAS,
              D1_PROTOCOLO, D1_ESCANEAMENTO, D2_CONTRADITORIO, D3_EXTRATO, D4_QUALIFICACAO, D5_CALCULO,
              D8_IMPRESSAO, D9_PREPARACAO, D9_CONFERENCIA, D10_ENTREGA, QTD_RETRABALHO, 
              DIAS_D1_D2, DIAS_D2_D3, DIAS_D3_D4, DIAS_D4_D5, DIAS_D5_D8, DIAS_D8_D9, import_id
            ) VALUES (
              ${user.tenantId}, ${p}, ${parseDate(row.DATA_APRESENTADO)}, ${parseDate(row.DT_PREVISAO)}, ${parseDate(row.DT_ENTREGA_REAL)},
              ${statusClean}, ${naturezaClean}, ${parseIntSafe(row.ATRASO_DIAS)}, ${parseDate(row.D1_PROTOCOLO)}, ${parseDate(row.D1_ESCANEAMENTO)},
              ${parseDate(row.D2_CONTRADITORIO)}, ${parseDate(row.D3_EXTRATO)}, ${parseDate(row.D4_QUALIFICACAO)}, ${parseDate(row.D5_CALCULO)},
              ${parseDate(row.D8_IMPRESSAO)}, ${parseDate(row.D9_PREPARACAO)}, ${parseDate(row.D9_CONFERENCIA)}, ${parseDate(row.D10_ENTREGA)},
              ${parseIntSafe(row.QTD_RETRABALHO)}, ${parseIntSafe(row.DIAS_D1_D2)}, ${parseIntSafe(row.DIAS_D2_D3)}, ${parseIntSafe(row.DIAS_D3_D4)},
              ${parseIntSafe(row.DIAS_D4_D5)}, ${parseIntSafe(row.DIAS_D5_D8)}, ${parseIntSafe(row.DIAS_D8_D9)}, ${importId}
            )
            ON CONFLICT (tenant_id, PROTOCOLO) DO UPDATE SET
              DATA_APRESENTADO = EXCLUDED.DATA_APRESENTADO,
              DT_PREVISAO = EXCLUDED.DT_PREVISAO,
              DT_ENTREGA_REAL = EXCLUDED.DT_ENTREGA_REAL,
              STATUS = EXCLUDED.STATUS,
              NATUREZA = EXCLUDED.NATUREZA,
              ATRASO_DIAS = EXCLUDED.ATRASO_DIAS,
              D1_PROTOCOLO = EXCLUDED.D1_PROTOCOLO,
              D1_ESCANEAMENTO = EXCLUDED.D1_ESCANEAMENTO,
              D2_CONTRADITORIO = EXCLUDED.D2_CONTRADITORIO,
              D3_EXTRATO = EXCLUDED.D3_EXTRATO,
              D4_QUALIFICACAO = EXCLUDED.D4_QUALIFICACAO,
              D5_CALCULO = EXCLUDED.D5_CALCULO,
              D8_IMPRESSAO = EXCLUDED.D8_IMPRESSAO,
              D9_PREPARACAO = EXCLUDED.D9_PREPARACAO,
              D9_CONFERENCIA = EXCLUDED.D9_CONFERENCIA,
              D10_ENTREGA = EXCLUDED.D10_ENTREGA,
              QTD_RETRABALHO = EXCLUDED.QTD_RETRABALHO,
              DIAS_D1_D2 = EXCLUDED.DIAS_D1_D2,
              DIAS_D2_D3 = EXCLUDED.DIAS_D2_D3,
              DIAS_D3_D4 = EXCLUDED.DIAS_D3_D4,
              DIAS_D4_D5 = EXCLUDED.DIAS_D4_D5,
              DIAS_D5_D8 = EXCLUDED.DIAS_D5_D8,
              DIAS_D8_D9 = EXCLUDED.DIAS_D8_D9,
              import_id = EXCLUDED.import_id;
          `
        );
        insertedCount++;
      }
      
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE public.fiorix_metas_imports
          SET inseridas = inseridas + ${insertedCount}
          WHERE id = ${importId} AND tenant_id = ${user.tenantId}
        `
      );
    }

    return NextResponse.json({ success: true, count: insertedCount });
  } catch (error: any) {
    console.error("Metas import error:", error);
    return NextResponse.json({ error: error.message || "Erro durante importação de metas" }, { status: 500 });
  }
}


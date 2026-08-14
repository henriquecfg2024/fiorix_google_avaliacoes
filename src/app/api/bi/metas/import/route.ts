import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureMetasImportsTable } from "@/lib/import-history";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rows, importMeta, action } = body;

    await ensureMetasImportsTable();

    if (action === "mark_failed") {
      await prisma.$executeRawUnsafe(`
        UPDATE public.fiorix_metas_imports
        SET status = 'FAILED'
        WHERE import_key = '${importMeta.importKey}'
      `);
      return NextResponse.json({ success: true });
    }

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const { importKey, fileName, totalRows, importedBy, periodStart, periodEnd, batchNumber, totalBatches } = importMeta;

    const periodStr = periodStart && periodEnd ? `${periodStart}|${periodEnd}` : '';
    const status = batchNumber === totalBatches ? 'Concluído' : 'Processando';

    await prisma.$executeRawUnsafe(`
      INSERT INTO public.fiorix_metas_imports (
        import_key, arquivo, periodo, linhas, inseridas, importado_por, status
      ) VALUES (
        '${importKey}', '${fileName}', '${periodStr}', ${totalRows}, 0, '${importedBy}', '${status}'
      )
      ON CONFLICT (import_key) DO UPDATE SET
        linhas = EXCLUDED.linhas,
        status = EXCLUDED.status;
    `);

    const importRecords: any[] = await prisma.$queryRawUnsafe(`
      SELECT id FROM public.fiorix_metas_imports WHERE import_key = '${importKey}'
    `);
    
    if (!importRecords || importRecords.length === 0) {
      return NextResponse.json({ error: "Failed to create/find import record" }, { status: 500 });
    }

    const importId = importRecords[0].id;
    let insertedCount = 0;

    if (rows.length > 0) {
      const values: string[] = [];
      
      const parseDate = (val: string) => {
        if (!val) return 'NULL';
        if (val.includes('/')) {
           const parts = val.split(' ');
           const dateParts = parts[0].split('/');
           const timePart = parts[1] || '00:00:00';
           if (dateParts.length === 3) {
             return `'${dateParts[2]}-${dateParts[1]}-${dateParts[0]} ${timePart}'::timestamp`;
           }
        }
        return `'${val}'::timestamp`;
      };

      const parseIntSafe = (val: string) => {
        if (!val || val.trim() === '') return 'NULL';
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? 'NULL' : parsed;
      };

      for (const row of rows) {
        const p = parseIntSafe(row.PROTOCOLO);
        if (p === 'NULL') continue;

        values.push(`(
          ${p},
          ${parseDate(row.DATA_APRESENTADO)},
          ${parseDate(row.DT_PREVISAO)},
          ${parseDate(row.DT_ENTREGA_REAL)},
          '${(row.STATUS || '').replace(/'/g, "''")}',
          ${parseIntSafe(row.ATRASO_DIAS)},
          ${parseDate(row.D1_PROTOCOLO)},
          ${parseDate(row.D1_ESCANEAMENTO)},
          ${parseDate(row.D2_CONTRADITORIO)},
          ${parseDate(row.D3_EXTRATO)},
          ${parseDate(row.D4_QUALIFICACAO)},
          ${parseDate(row.D5_CALCULO)},
          ${parseDate(row.D8_IMPRESSAO)},
          ${parseDate(row.D9_PREPARACAO)},
          ${parseDate(row.D9_CONFERENCIA)},
          ${parseDate(row.D10_ENTREGA)},
          ${parseIntSafe(row.QTD_RETRABALHO)},
          ${parseIntSafe(row.DIAS_D1_D2)},
          ${parseIntSafe(row.DIAS_D2_D3)},
          ${parseIntSafe(row.DIAS_D3_D4)},
          ${parseIntSafe(row.DIAS_D4_D5)},
          ${parseIntSafe(row.DIAS_D5_D8)},
          ${parseIntSafe(row.DIAS_D8_D9)},
          ${importId}
        )`);
        insertedCount++;
      }

      if (values.length > 0) {
        const query = `
          INSERT INTO public.fiorix_metas_dados (
            PROTOCOLO, DATA_APRESENTADO, DT_PREVISAO, DT_ENTREGA_REAL, STATUS, ATRASO_DIAS,
            D1_PROTOCOLO, D1_ESCANEAMENTO, D2_CONTRADITORIO, D3_EXTRATO, D4_QUALIFICACAO, D5_CALCULO,
            D8_IMPRESSAO, D9_PREPARACAO, D9_CONFERENCIA, D10_ENTREGA, QTD_RETRABALHO, 
            DIAS_D1_D2, DIAS_D2_D3, DIAS_D3_D4, DIAS_D4_D5, DIAS_D5_D8, DIAS_D8_D9, import_id
          ) VALUES ${values.join(',')}
          ON CONFLICT (PROTOCOLO) DO UPDATE SET
            DATA_APRESENTADO = EXCLUDED.DATA_APRESENTADO,
            DT_PREVISAO = EXCLUDED.DT_PREVISAO,
            DT_ENTREGA_REAL = EXCLUDED.DT_ENTREGA_REAL,
            STATUS = EXCLUDED.STATUS,
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
        `;
        
        await prisma.$executeRawUnsafe(query);
      }
      
      await prisma.$executeRawUnsafe(`
        UPDATE public.fiorix_metas_imports
        SET inseridas = inseridas + ${insertedCount}
        WHERE id = ${importId}
      `);
    }

    return NextResponse.json({ success: true, count: insertedCount });
  } catch (error: any) {
    console.error("Metas import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

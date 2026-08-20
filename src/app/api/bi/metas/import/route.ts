import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { ensureMetasImportsTable } from "@/lib/import-history";
import { Prisma } from "@prisma/client";

import { metasImportSchema } from "@/lib/zod-schemas";
import { checkRateLimit } from "@/lib/rate-limiter";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireRole("ADMIN", "MASTER");

    // Limite de taxa (Rate Limit): Máximo 10 requisições por minuto por IP/Tenant
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rateLimitKey = `rate_limit:metas_import:${user.tenantId}:${ip}`;
    const limitResult = await checkRateLimit(rateLimitKey, 10, 60);
    if (!limitResult.success) {
      const retryAfter = Math.ceil((limitResult.reset.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Limite de requisições excedido. Tente novamente em alguns segundos." },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfter.toString(),
          },
        }
      );
    }

    const body = await req.json();
    
    const validation = metasImportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Dados de importação inválidos", details: validation.error.format() }, { status: 400 });
    }

    const { rows, importMeta, action } = validation.data;

    await ensureMetasImportsTable();

    if (action === "mark_failed") {
      if (!importMeta?.importKey) {
        return NextResponse.json({ error: "Chave de importação ausente para falha" }, { status: 400 });
      }
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE public.fiorix_metas_imports
          SET status = 'FAILED'
          WHERE import_key = ${importMeta.importKey} AND tenant_id = ${user.tenantId}
        `
      );
      return NextResponse.json({ success: true });
    }

    const MAX_BATCH_SIZE = 5000;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Nenhum dado informado" }, { status: 400 });
    }

    if (rows.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Lote excede o limite máximo permitido de ${MAX_BATCH_SIZE} linhas.` },
        { status: 400 }
      );
    }

    if (!importMeta) {
      return NextResponse.json({ error: "Metadados de importação ausentes" }, { status: 400 });
    }

    const { importKey, fileName, totalRows, importedBy, periodStart, periodEnd, batchNumber, totalBatches } = importMeta;

    const periodStr = periodStart && periodEnd ? `${periodStart}|${periodEnd}` : '';

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO public.fiorix_metas_imports (
          tenant_id, import_key, arquivo, periodo, linhas, inseridas, importado_por, status
        ) VALUES (
          ${user.tenantId}, ${importKey}, ${fileName}, ${periodStr}, ${totalRows}, 0, ${importedBy}, 'Processando'
        )
        ON CONFLICT (tenant_id, import_key) DO UPDATE SET
          linhas = EXCLUDED.linhas,
          status = 'Processando';
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

      const rowsByProtocol = new Map<number, Prisma.Sql>();

      for (const row of rows) {
        const rowData = row as Record<string, unknown>;
        const p = parseIntSafe(row.PROTOCOLO);
        if (p === null || p <= 0) continue;

        const statusClean = String(row.STATUS || rowData.status || '').trim().slice(0, 100);
        const statusMetaClean = String(
          row.STATUS_META || rowData.status_meta || rowData.STATUS_META || ''
        ).trim().slice(0, 100);
        const naturezaClean = String(
          row.NATUREZA ||
          rowData.natureza ||
          ''
        ).trim().slice(0, 255);
        const tipoClean = String(
          row.TIPO ||
          rowData.tipo ||
          ''
        ).trim().slice(0, 100);
        const idNaturezaVal = parseIntSafe(row.ID_NATUREZA ?? rowData.id_natureza);
        const magneticoClean = String(
          row.MAGNETICO ||
          rowData.magnetico ||
          ''
        ).trim().slice(0, 50);

        const dataApresDate = parseDate(row.DATA_APRESENTADO || rowData.DataDoTituloApresentado || rowData.data_apresentado);
        const dtPrevDate = parseDate(row.DT_PREVISAO || rowData.DtPrevisaoEntrega || rowData.DATA_PREVISTAFINAL || rowData.dt_previsao);
        const d10EntregaDate = parseDate(row.D10_ENTREGA || row.DT_ENTREGA_REAL || rowData.d10_entrega);
        const diasAtrasoVal = parseIntSafe(row.DIAS_ATRASO ?? row.ATRASO_DIAS ?? rowData.dias_atraso);
        const diasCorridosVal = parseIntSafe(row.DIAS_CORRIDOS ?? rowData.dias_corridos);

        rowsByProtocol.set(
          p,
          Prisma.sql`(
            ${user.tenantId}, ${p}, ${dataApresDate}, ${dtPrevDate}, ${d10EntregaDate},
            ${statusClean}, ${statusMetaClean}, ${naturezaClean}, ${tipoClean}, ${idNaturezaVal}, ${magneticoClean},
            ${diasAtrasoVal}, ${diasAtrasoVal}, ${diasCorridosVal}, ${parseDate(row.D1_PROTOCOLO)}, ${parseDate(row.D1_ESCANEAMENTO)},
            ${parseDate(row.D2_CONTRADITORIO)}, ${parseDate(row.D3_EXTRATO)}, ${parseDate(row.D4_QUALIFICACAO)}, ${parseDate(row.D5_CALCULO)},
            ${parseDate(row.D8_IMPRESSAO)}, ${parseDate(row.D9_PREPARACAO)}, ${parseDate(row.D9_CONFERENCIA)}, ${d10EntregaDate},
            ${parseDate(row.D_BALCAO_REGISTRADO)}, ${parseDate(row.D_BALCAO_DEVOLVIDO)},
            ${parseIntSafe(row.QTD_RETRABALHO)}, ${parseIntSafe(row.DIAS_D1_D2)}, ${parseIntSafe(row.DIAS_D2_D3)}, ${parseIntSafe(row.DIAS_D3_D4)},
            ${parseIntSafe(row.DIAS_D4_D5)}, ${parseIntSafe(row.DIAS_D5_D8)}, ${parseIntSafe(row.DIAS_D8_D9)}, ${importId}
          )`
        );
      }

      const values = Array.from(rowsByProtocol.values());
      if (values.length > 0) {
        insertedCount = await prisma.$executeRaw(
          Prisma.sql`
            INSERT INTO public.fiorix_metas_dados (
              tenant_id, PROTOCOLO, DATA_APRESENTADO, DT_PREVISAO, DT_ENTREGA_REAL, STATUS, STATUS_META, NATUREZA, TIPO, ID_NATUREZA, MAGNETICO, ATRASO_DIAS, DIAS_ATRASO, DIAS_CORRIDOS,
              D1_PROTOCOLO, D1_ESCANEAMENTO, D2_CONTRADITORIO, D3_EXTRATO, D4_QUALIFICACAO, D5_CALCULO,
              D8_IMPRESSAO, D9_PREPARACAO, D9_CONFERENCIA, D10_ENTREGA,
              D_BALCAO_REGISTRADO, D_BALCAO_DEVOLVIDO, QTD_RETRABALHO,
              DIAS_D1_D2, DIAS_D2_D3, DIAS_D3_D4, DIAS_D4_D5, DIAS_D5_D8, DIAS_D8_D9, import_id
            ) VALUES ${Prisma.join(values)}
            ON CONFLICT (tenant_id, PROTOCOLO) DO UPDATE SET
              DATA_APRESENTADO = EXCLUDED.DATA_APRESENTADO,
              DT_PREVISAO = EXCLUDED.DT_PREVISAO,
              DT_ENTREGA_REAL = EXCLUDED.DT_ENTREGA_REAL,
              STATUS = EXCLUDED.STATUS,
              STATUS_META = EXCLUDED.STATUS_META,
              NATUREZA = EXCLUDED.NATUREZA,
              TIPO = EXCLUDED.TIPO,
              ID_NATUREZA = EXCLUDED.ID_NATUREZA,
              MAGNETICO = EXCLUDED.MAGNETICO,
              ATRASO_DIAS = EXCLUDED.ATRASO_DIAS,
              DIAS_ATRASO = EXCLUDED.DIAS_ATRASO,
              DIAS_CORRIDOS = EXCLUDED.DIAS_CORRIDOS,
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
              D_BALCAO_REGISTRADO = COALESCE(EXCLUDED.D_BALCAO_REGISTRADO, public.fiorix_metas_dados.D_BALCAO_REGISTRADO),
              D_BALCAO_DEVOLVIDO = COALESCE(EXCLUDED.D_BALCAO_DEVOLVIDO, public.fiorix_metas_dados.D_BALCAO_DEVOLVIDO),
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
      }

      const importedRows: Array<{ count: bigint }> = await prisma.$queryRaw(
        Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM public.fiorix_metas_dados
          WHERE tenant_id = ${user.tenantId} AND import_id = ${importId}
        `
      );
      const importedCount = Number(importedRows[0]?.count || 0);
      const finalStatus = batchNumber === totalBatches ? 'Concluído' : 'Processando';

      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE public.fiorix_metas_imports
          SET inseridas = ${importedCount}, status = ${finalStatus}
          WHERE id = ${importId} AND tenant_id = ${user.tenantId}
        `
      );
    }

    return NextResponse.json({ success: true, count: insertedCount });
  } catch (error: any) {
    console.error("Metas import error:", error);
    return NextResponse.json(
      { error: `Erro durante importação de metas: ${error?.message || String(error)}` },
      { status: 500 }
    );
  }
}

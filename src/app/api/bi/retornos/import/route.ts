import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { ensureRetornosImportsTable } from "@/lib/import-history";
import { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/lib/audit";
import { unpackLiveRecords } from "@/lib/connector/unpack-live";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireTenant();
    const body = await request.json();

    if (body.action === "mark_failed") {
      const { importMeta, errorMessage } = body;
      if (importMeta?.importKey) {
        await prisma.$executeRaw(
          Prisma.sql`
            UPDATE public.fiorix_retornos_imports
            SET status = 'FAILED'
            WHERE tenant_id = ${user.tenantId} AND import_key = ${importMeta.importKey}
          `
        );
      }
      return NextResponse.json({ success: true });
    }

    const { rows, importMeta } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Nenhum registro para importar" }, { status: 400 });
    }

    if (!importMeta?.batchNumber || importMeta.batchNumber === 1) {
      await ensureRetornosImportsTable();
    }

    const periodStr = `${importMeta?.periodStart || ""}|${importMeta?.periodEnd || ""}`;

    if (importMeta?.importKey) {
      await prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO public.fiorix_retornos_imports (
            tenant_id, import_key, arquivo, periodo, linhas, inseridas, importado_por, status
          ) VALUES (
            ${user.tenantId}, ${importMeta.importKey}, ${importMeta.fileName || "retornos.csv"},
            ${periodStr}, ${importMeta.totalRows || rows.length}, 0,
            ${importMeta.importedBy || "Manual CSV"}, 'PROCESSING'
          )
          ON CONFLICT (tenant_id, import_key) DO UPDATE SET
            linhas = EXCLUDED.linhas,
            status = 'PROCESSING';
        `
      );
    }

    // Grava dados usando o handler unificado
    await unpackLiveRecords({
      tenantId: user.tenantId,
      source: "retornos",
      records: rows,
    });

    if (importMeta?.importKey) {
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE public.fiorix_retornos_imports
          SET inseridas = COALESCE(inseridas, 0) + ${rows.length}
          WHERE tenant_id = ${user.tenantId} AND import_key = ${importMeta.importKey}
        `
      );

      if (importMeta.batchNumber >= importMeta.totalBatches) {
        await prisma.$executeRaw(
          Prisma.sql`
            UPDATE public.fiorix_retornos_imports
            SET status = 'Concluído'
            WHERE tenant_id = ${user.tenantId} AND import_key = ${importMeta.importKey}
          `
        );

        await recordAuditLog({
          modulo: "BI_IMPORTACOES",
          acao: "IMPORTACAO",
          registroDescricao: `Importação de Retornos via CSV concluída: ${importMeta.fileName} (${importMeta.totalRows} linhas)`,
          userOverride: user,
        });
      }
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch (err: any) {
    console.error("IMPORT_RETORNOS_ROUTE_ERROR:", err);
    return NextResponse.json({ error: err.message || "Erro interno ao importar retornos" }, { status: 500 });
  }
}

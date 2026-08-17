import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface ProdutividadeImportLogInput {
  importKey: string;
  tenantId: string;
  fileName: string;
  rowsCount: number;
  insertedCount?: number;
  importedBy?: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED";
  errorMessage?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

export interface UnifiedImportRecord {
  id: string;
  source: "BI" | "PRODUTIVIDADE" | "METAS";
  origin: "logged" | "inferred";
  fileName: string;
  importedAt: string | null;
  rowsCount: number;
  insertedCount: number | null;
  importedBy: string | null;
  status: string;
  errorMessage: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export async function ensureProdutividadeImportsTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS public.fiorix_produtividade_imports (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT '',
      import_key TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      rows_count INTEGER NOT NULL DEFAULT 0,
      inserted_count INTEGER NOT NULL DEFAULT 0,
      imported_by TEXT DEFAULT 'Manual CSV',
      status TEXT NOT NULL DEFAULT 'PROCESSING',
      error_message TEXT,
      source TEXT NOT NULL DEFAULT 'PRODUTIVIDADE',
      period_start DATE,
      period_end DATE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}

export async function upsertProdutividadeImportRecord(input: ProdutividadeImportLogInput) {
  await ensureProdutividadeImportsTable();

  const rowsCount = Math.max(0, Number(input.rowsCount || 0));
  const insertedCount = Math.max(0, Number(input.insertedCount || 0));
  const importedBy = input.importedBy || "Manual CSV";
  const pStart = input.periodStart ? new Date(input.periodStart) : null;
  const pEnd = input.periodEnd ? new Date(input.periodEnd) : null;

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.fiorix_produtividade_imports (
        id, tenant_id, import_key, file_name, rows_count, inserted_count,
        imported_by, status, error_message, period_start, period_end
      )
      VALUES (
        ${input.importKey}, ${input.tenantId}, ${input.importKey}, ${input.fileName},
        ${rowsCount}, ${insertedCount}, ${importedBy}, ${input.status},
        ${input.errorMessage || null}, ${pStart}, ${pEnd}
      )
      ON CONFLICT (import_key) DO UPDATE
      SET
        file_name = EXCLUDED.file_name,
        rows_count = EXCLUDED.rows_count,
        inserted_count = EXCLUDED.inserted_count,
        imported_by = EXCLUDED.imported_by,
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message,
        period_start = COALESCE(EXCLUDED.period_start, public.fiorix_produtividade_imports.period_start),
        period_end = COALESCE(EXCLUDED.period_end, public.fiorix_produtividade_imports.period_end),
        updated_at = NOW();
    `
  );
}

export async function listProdutividadeImportLogs(tenantId: string): Promise<UnifiedImportRecord[]> {
  await ensureProdutividadeImportsTable();

  const rows: any[] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        id::text as id,
        source,
        'logged' as origin,
        file_name as "fileName",
        to_char(imported_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "importedAt",
        rows_count as "rowsCount",
        inserted_count as "insertedCount",
        imported_by as "importedBy",
        status,
        error_message as "errorMessage",
        to_char(period_start, 'YYYY-MM-DD') as "periodStart",
        to_char(period_end, 'YYYY-MM-DD') as "periodEnd"
      FROM public.fiorix_produtividade_imports
      WHERE tenant_id = ${tenantId}
      ORDER BY imported_at DESC;
    `
  );

  return rows.map((row) => ({
    ...row,
    source: "PRODUTIVIDADE",
    origin: "logged",
    rowsCount: Number(row.rowsCount || 0),
    insertedCount: row.insertedCount !== null ? Number(row.insertedCount || 0) : null,
  }));
}

export async function listProdutividadeInferredPeriods(tenantId: string): Promise<UnifiedImportRecord[]> {
  const rows: any[] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        CONCAT('inferred-', to_char(date_trunc('month', data), 'YYYY-MM')) as id,
        'PRODUTIVIDADE' as source,
        'inferred' as origin,
        CONCAT(
          'produtividade_',
          to_char(MIN(data), 'YYYY-MM-DD'),
          '_a_',
          to_char(MAX(data), 'YYYY-MM-DD'),
          '.csv'
        ) as "fileName",
        to_char(MAX(data)::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "importedAt",
        COUNT(*)::int as "rowsCount",
        SUM(COALESCE(quantidade, 0))::int as "insertedCount",
        'Histórico inferido' as "importedBy",
        'INFERRED' as status,
        NULL::text as "errorMessage",
        to_char(MIN(data), 'YYYY-MM-DD') as "periodStart",
        to_char(MAX(data), 'YYYY-MM-DD') as "periodEnd"
      FROM public.fiorix_produtividade_dados
      WHERE tenant_id = ${tenantId}
      GROUP BY date_trunc('month', data)
      ORDER BY date_trunc('month', data) DESC;
    `
  );

  return rows.map((row) => ({
    ...row,
    source: "PRODUTIVIDADE",
    origin: "inferred",
    rowsCount: Number(row.rowsCount || 0),
    insertedCount: row.insertedCount !== null ? Number(row.insertedCount || 0) : null,
  }));
}

export async function listBiImports(tenantId: string): Promise<UnifiedImportRecord[]> {
  const rows = await prisma.fiorixBiImport.findMany({
    where: { tenantId },
    orderBy: { importedAt: "desc" },
    take: 200,
  });

  return rows.map((row) => ({
    id: row.id,
    source: "BI",
    origin: "logged",
    fileName: row.fileName,
    importedAt: row.importedAt ? row.importedAt.toISOString() : null,
    rowsCount: Number(row.rowsCount || 0),
    insertedCount: Number(row.rowsCount || 0),
    importedBy: row.importedBy || null,
    status: row.status,
    errorMessage: row.errorMessage || null,
    periodStart: null,
    periodEnd: null,
  }));
}

export async function ensureMetasImportsTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS public.fiorix_metas_imports (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL DEFAULT '',
      import_key VARCHAR(100),
      arquivo VARCHAR(255), 
      periodo VARCHAR(100), 
      data_hora TIMESTAMP DEFAULT NOW(), 
      linhas INT, 
      inseridas INT, 
      importado_por VARCHAR(100), 
      status VARCHAR(20)
    );
  `;
  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS fiorix_metas_imports_tenant_import_key
    ON public.fiorix_metas_imports (tenant_id, import_key);
  `;
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS public.fiorix_metas_dados (
      id SERIAL PRIMARY KEY,
      tenant_id VARCHAR(100) NOT NULL DEFAULT '',
      PROTOCOLO INT, 
      DATA_APRESENTADO TIMESTAMP, 
      DT_PREVISAO TIMESTAMP, 
      DT_ENTREGA_REAL TIMESTAMP, 
      STATUS VARCHAR(50), 
      NATUREZA VARCHAR(255),
      ATRASO_DIAS INT, 
      D1_PROTOCOLO TIMESTAMP, 
      D1_ESCANEAMENTO TIMESTAMP, 
      D2_CONTRADITORIO TIMESTAMP, 
      D3_EXTRATO TIMESTAMP, 
      D4_QUALIFICACAO TIMESTAMP, 
      D5_CALCULO TIMESTAMP, 
      D8_IMPRESSAO TIMESTAMP, 
      D9_PREPARACAO TIMESTAMP, 
      D9_CONFERENCIA TIMESTAMP, 
      D10_ENTREGA TIMESTAMP, 
      QTD_RETRABALHO INT, 
      DIAS_D1_D2 INT, 
      DIAS_D2_D3 INT, 
      DIAS_D3_D4 INT, 
      DIAS_D4_D5 INT, 
      DIAS_D5_D8 INT, 
      DIAS_D8_D9 INT, 
      import_id INT REFERENCES fiorix_metas_imports(id) ON DELETE CASCADE
    );
  `;
}

export async function listMetasImportLogs(tenantId: string): Promise<UnifiedImportRecord[]> {
  await ensureMetasImportsTable();

  const rows: any[] = await prisma.$queryRaw(
    Prisma.sql`
      SELECT
        id::text as id,
        'METAS' as source,
        'logged' as origin,
        arquivo as "fileName",
        to_char(data_hora, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "importedAt",
        linhas as "rowsCount",
        inseridas as "insertedCount",
        importado_por as "importedBy",
        status,
        NULL as "errorMessage",
        SPLIT_PART(periodo, '|', 1) as "periodStart",
        SPLIT_PART(periodo, '|', 2) as "periodEnd"
      FROM public.fiorix_metas_imports
      WHERE tenant_id = ${tenantId}
      ORDER BY data_hora DESC;
    `
  );

  return rows.map((row) => ({
    ...row,
    source: "METAS",
    origin: "logged",
    rowsCount: Number(row.rowsCount || 0),
    insertedCount: row.insertedCount !== null ? Number(row.insertedCount || 0) : null,
  }));
}


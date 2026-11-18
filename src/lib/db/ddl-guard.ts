import { prisma } from '@/lib/prisma';

export interface DdlGuardOptions {
  /** Força a consulta ao catálogo mesmo em ambiente Vitest (usado em testes específicos da guarda). */
  forceCheckInTest?: boolean;
}

/**
 * Consulta somente leitura em `pg_class` para verificar se todas as tabelas
 * esperadas já existem no schema `public`.
 *
 * Evita disparar comandos `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
 * em cold starts serverless, pois qualquer DDL aciona o event trigger `pgrst_ddl_watch`
 * no Supabase e força recargas caras de schema no PostgREST.
 */
export async function allPublicTablesExist(
  tableNames: readonly string[],
  options?: DdlGuardOptions,
): Promise<boolean> {
  const uniqueNames = Array.from(
    new Set(tableNames.map((name) => name.trim()).filter(Boolean)),
  );
  if (uniqueNames.length === 0) return true;

  const client = prisma as unknown as {
    $queryRawUnsafe?: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  };
  if (typeof client?.$queryRawUnsafe !== 'function') {
    return false;
  }

  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  const isMockQuery = Boolean((client.$queryRawUnsafe as { mock?: unknown })?.mock);
  if ((isTestEnv || isMockQuery) && !options?.forceCheckInTest) {
    return false;
  }

  try {
    const rows = await client.$queryRawUnsafe<Array<{ cnt: number | string | bigint }>>(
      `
      SELECT COUNT(*)::int AS cnt
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND c.relname = ANY($1::text[])
      `,
      uniqueNames,
    );
    return Number(rows?.[0]?.cnt ?? 0) === uniqueNames.length;
  } catch {
    return false;
  }
}

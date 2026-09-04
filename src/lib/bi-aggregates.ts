import { prisma } from '@/lib/prisma';

export async function refreshBiAggregatesForImport(importId: string, tenantId: string) {
  if (!tenantId) {
    throw new Error('tenantId é obrigatório para refreshBiAggregatesForImport');
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10000ms'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30000ms'");
    return tx.$queryRaw<Array<{ daily_rows: bigint; note_rows: bigint }>>`
      SELECT daily_rows, note_rows
      FROM refresh_fiorix_bi_aggregates(${importId})
    `;
  }, { maxWait: 10_000, timeout: 40_000 });
}

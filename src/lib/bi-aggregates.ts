import { prisma } from '@/lib/prisma';

export async function refreshBiAggregatesForImport(importId: string, tenantId: string = '') {
  return prisma.$queryRaw<Array<{ daily_rows: bigint; note_rows: bigint }>>`
    SELECT daily_rows, note_rows
    FROM refresh_fiorix_bi_aggregates(${importId}, ${tenantId})
  `;
}


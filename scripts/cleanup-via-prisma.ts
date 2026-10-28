/**
 * FIORIX — Limpeza de lotes antigos no Supabase
 * Executa via Prisma ($queryRawUnsafe) usando a DATABASE_URL do .env.local
 * 
 * Uso: cd fiorix && npx tsx ../fiorix-connector/scripts/cleanup-via-prisma.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RETENTION_DAYS = 7;

async function main() {
  console.log('='.repeat(60));
  console.log('FIORIX — Limpeza de Lotes Antigos');
  console.log(`Mantendo últimos ${RETENTION_DAYS} dias`);
  console.log('='.repeat(60));

  // 1. Contagem prévia
  console.log('\n📊 ANTES DA LIMPEZA:');

  const counts = await prisma.$queryRawUnsafe(`
    SELECT 'ConnectorSyncStaging (total)' AS item, COUNT(*)::int AS qtd
    FROM "ConnectorSyncStaging"
    UNION ALL
    SELECT 'ConnectorSyncBatch (total)', COUNT(*)::int
    FROM "ConnectorSyncBatch"
    UNION ALL
    SELECT 'Staging > 7 dias (a deletar)', COUNT(*)::int
    FROM "ConnectorSyncStaging"
    WHERE "createdAt" < NOW() - INTERVAL '${RETENTION_DAYS} days'
    UNION ALL
    SELECT 'Batches > 7 dias (a deletar)', COUNT(*)::int
    FROM "ConnectorSyncBatch"
    WHERE "receivedAt" < NOW() - INTERVAL '${RETENTION_DAYS} days'
  `);
  
  for (const row of counts) {
    console.log(`   ${row.item}: ${row.qtd}`);
  }

  // 2. Deletar staging antigo
  console.log('\n🗑️  Deletando ConnectorSyncStaging antigos...');
  const delStaging = await prisma.$executeRawUnsafe(`
    DELETE FROM "ConnectorSyncStaging"
    WHERE "createdAt" < NOW() - INTERVAL '${RETENTION_DAYS} days'
  `);
  console.log(`   ✅ ${delStaging} registros de staging removidos.`);

  // 3. Deletar batches antigos
  console.log('\n🗑️  Deletando ConnectorSyncBatch antigos...');
  const delBatch = await prisma.$executeRawUnsafe(`
    DELETE FROM "ConnectorSyncBatch"
    WHERE "receivedAt" < NOW() - INTERVAL '${RETENTION_DAYS} days'
  `);
  console.log(`   ✅ ${delBatch} registros de batch removidos.`);

  // 4. Contagem pós
  const after = await prisma.$queryRawUnsafe(`
    SELECT 'ConnectorSyncStaging' AS tabela, COUNT(*)::int AS restantes
    FROM "ConnectorSyncStaging"
    UNION ALL
    SELECT 'ConnectorSyncBatch', COUNT(*)::int
    FROM "ConnectorSyncBatch"
  `);

  console.log('\n📊 APÓS A LIMPEZA:');
  for (const row of after) {
    console.log(`   ${row.tabela}: ${row.restantes} registros`);
  }

  console.log('\n✅ Limpeza concluída com sucesso!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

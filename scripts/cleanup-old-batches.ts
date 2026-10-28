/**
 * FIORIX — Limpeza de lotes antigos no Supabase
 * 
 * Remove staging e batches com mais de 7 dias.
 * NÃO afeta ConnectorSyncRecord, dados vivos, ou qualquer outra tabela.
 * 
 * Uso: npx tsx scripts/cleanup-old-batches.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uvieekfizuzujpwfbjww.supabase.co';
// Precisamos da service_role key para bypass RLS
// Pegar do painel Supabase > Settings > API > service_role (secret)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Defina SUPABASE_SERVICE_ROLE_KEY como variável de ambiente.');
  console.error('   Exemplo: $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."; npx tsx scripts/cleanup-old-batches.ts');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const RETENTION_DAYS = 7;

async function main() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
  const cutoff = cutoffDate.toISOString();

  console.log('='.repeat(60));
  console.log('FIORIX — Limpeza de Lotes Antigos');
  console.log(`Data de corte: ${cutoff} (mantendo últimos ${RETENTION_DAYS} dias)`);
  console.log('='.repeat(60));

  // --- Contagem prévia ---
  const { count: stagingTotal } = await supabase
    .from('ConnectorSyncStaging')
    .select('*', { count: 'exact', head: true });

  const { count: batchTotal } = await supabase
    .from('ConnectorSyncBatch')
    .select('*', { count: 'exact', head: true });

  const { count: stagingToDelete } = await supabase
    .from('ConnectorSyncStaging')
    .select('*', { count: 'exact', head: true })
    .lt('createdAt', cutoff);

  const { count: batchToDelete } = await supabase
    .from('ConnectorSyncBatch')
    .select('*', { count: 'exact', head: true })
    .lt('receivedAt', cutoff);

  console.log('\n📊 ANTES DA LIMPEZA:');
  console.log(`   ConnectorSyncStaging: ${stagingTotal} total | ${stagingToDelete} a deletar`);
  console.log(`   ConnectorSyncBatch:   ${batchTotal} total | ${batchToDelete} a deletar`);

  if ((stagingToDelete ?? 0) === 0 && (batchToDelete ?? 0) === 0) {
    console.log('\n✅ Nada a limpar — todos os registros estão dentro da janela de retenção.');
    return;
  }

  // --- Deletar staging antigo (tabela mais pesada) ---
  console.log('\n🗑️  Deletando ConnectorSyncStaging antigos...');
  const { error: stagingError } = await supabase
    .from('ConnectorSyncStaging')
    .delete()
    .lt('createdAt', cutoff);

  if (stagingError) {
    console.error('❌ Erro ao deletar staging:', stagingError.message);
  } else {
    console.log(`   ✅ ${stagingToDelete} registros de staging removidos.`);
  }

  // --- Deletar batches antigos ---
  console.log('\n🗑️  Deletando ConnectorSyncBatch antigos...');
  const { error: batchError } = await supabase
    .from('ConnectorSyncBatch')
    .delete()
    .lt('receivedAt', cutoff);

  if (batchError) {
    console.error('❌ Erro ao deletar batches:', batchError.message);
  } else {
    console.log(`   ✅ ${batchToDelete} registros de batch removidos.`);
  }

  // --- Contagem pós ---
  const { count: stagingAfter } = await supabase
    .from('ConnectorSyncStaging')
    .select('*', { count: 'exact', head: true });

  const { count: batchAfter } = await supabase
    .from('ConnectorSyncBatch')
    .select('*', { count: 'exact', head: true });

  console.log('\n📊 APÓS A LIMPEZA:');
  console.log(`   ConnectorSyncStaging: ${stagingAfter} registros restantes`);
  console.log(`   ConnectorSyncBatch:   ${batchAfter} registros restantes`);
  console.log('\n✅ Limpeza concluída com sucesso!');
}

main().catch(console.error);

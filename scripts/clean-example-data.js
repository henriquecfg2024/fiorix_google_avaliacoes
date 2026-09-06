const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  console.log('🔍 Verificando dados de exemplo...\n');

  // Tables to clean (in order to respect FK constraints)
  const tables = [
    // Comunicados (child tables first)
    'fiorix_comunicados_ciencia',
    'fiorix_comunicados_anexos',
    'fiorix_comunicados',
    // Holerites
    'fiorix_holerites',
    // Férias (child tables first)
    'fiorix_ferias_previstas_historico',
    'fiorix_ferias_avisos',
    'fiorix_ferias_previstas',
    // Audit log for comunicados/holerites
    'fiorix_audit_log',
  ];

  for (const table of tables) {
    try {
      const count = await p.$queryRawUnsafe(`SELECT count(*)::int as c FROM public."${table}"`);
      console.log(`  ${table}: ${count[0].c} registros`);
    } catch (e) {
      console.log(`  ${table}: tabela não existe (ok)`);
    }
  }

  console.log('\n🧹 Limpando TODOS os dados de exemplo...\n');

  for (const table of tables) {
    try {
      const result = await p.$queryRawUnsafe(`DELETE FROM public."${table}"`);
      const countAfter = await p.$queryRawUnsafe(`SELECT count(*)::int as c FROM public."${table}"`);
      console.log(`  ✅ ${table}: limpa (${countAfter[0].c} registros restantes)`);
    } catch (e) {
      console.log(`  ⏭️  ${table}: ${e.message?.substring(0, 80) || 'não encontrada'}`);
    }
  }

  console.log('\n🎉 Limpeza concluída! Sistema pronto para uso oficial.\n');
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Erro:', e);
  await p.$disconnect();
  process.exit(1);
});

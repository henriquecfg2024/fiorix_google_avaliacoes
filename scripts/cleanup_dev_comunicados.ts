import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const EXPECTED_TENANT_ID = 'cms3xd0wm00002pw9j2k0ahan';

const TARGET_TITLES = [
  'Alteração de Horário - Plantão de Fim de Ano',
  'Diretriz Operacional Interna - Balcão e Qualificação 2026',
  'Campanha Setembro Amarelo - Saúde Mental',
  'TESTE',
  'Aviso de Feriado',
];

async function main() {
  const isExecute = process.argv.includes('--execute');
  console.log(`\n======================================================`);
  console.log(`FIORIX - Limpeza Segura de Comunicados de Teste/Demo`);
  console.log(`Modo: ${isExecute ? '⚡ EXECUÇÃO REAL' : '🔍 SIMULAÇÃO (DRY-RUN)'}`);
  console.log(`Tenant Alvo: ${EXPECTED_TENANT_ID}`);
  console.log(`======================================================\n`);

  // 1. Validar Tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: EXPECTED_TENANT_ID },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    throw new Error(`Tenant '${EXPECTED_TENANT_ID}' não encontrado no banco de dados.`);
  }
  console.log(`Organização identificada: ${tenant.name} (${tenant.slug || tenant.id})\n`);

  // 2. Localizar Comunicados Alvo
  const items = await prisma.fiorixComunicado.findMany({
    where: {
      tenantId: EXPECTED_TENANT_ID,
      OR: [
        { titulo: { in: TARGET_TITLES } },
        { id: { in: ['com-1', 'com-2', 'com-3'] } },
      ],
    },
    include: {
      anexos: true,
      ciencias: true,
    },
  });

  console.log(`Total de comunicados identificados para limpeza: ${items.length}`);

  if (items.length === 0) {
    console.log('Nenhum comunicado de demonstração ou teste encontrado. Nada a fazer.');
    return;
  }

  items.forEach((item, idx) => {
    console.log(`  [${idx + 1}] ID: ${item.id}`);
    console.log(`      Título: "${item.titulo}"`);
    console.log(`      Status: ${item.status} | Prioridade: ${item.prioridade}`);
    console.log(`      Ciências vinculadas: ${item.ciencias.length}`);
    console.log(`      Anexos vinculados: ${item.anexos.length}`);
  });

  // 3. Gerar Backup Pré-Exclusão
  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupsDir, `backup_comunicados_pre_cleanup_${timestamp}.json`);

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      tenantId: tenant.id,
      tenantName: tenant.name,
      targetTitles: TARGET_TITLES,
      totalComunicados: items.length,
    },
    comunicados: items,
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`\n💾 Snapshot de backup gerado com sucesso em:`);
  console.log(`   ${backupFilePath}\n`);

  if (!isExecute) {
    console.log('------------------------------------------------------');
    console.log('ℹ️  MODO DRY-RUN FINALIZADO COM SUCESSO.');
    console.log('Nenhum registro foi alterado ou excluído do banco.');
    console.log('Para efetivar a exclusão em transação, execute com a flag:');
    console.log('   npx tsx scripts/cleanup_dev_comunicados.ts --execute');
    console.log('------------------------------------------------------\n');
    return;
  }

  // 4. Execução em Transação Segura
  const idsToDelete = items.map((i) => i.id);
  console.log(`Iniciando exclusão em transação isolada de ${idsToDelete.length} comunicados...`);

  await prisma.$transaction(async (tx) => {
    // Exclui os comunicados (anexos e ciências possuem ON DELETE CASCADE no schema)
    const result = await tx.fiorixComunicado.deleteMany({
      where: {
        id: { in: idsToDelete },
        tenantId: EXPECTED_TENANT_ID,
      },
    });

    console.log(`✅ Transação concluída: ${result.count} comunicados excluídos.`);
  });

  console.log(`\n🎉 Limpeza no banco concluída com integridade e segurança!\n`);
}

main()
  .catch((err) => {
    console.error('❌ Erro na operação de limpeza:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

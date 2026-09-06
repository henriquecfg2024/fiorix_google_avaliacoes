const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando migração: fiorix_its_column_config...\n');

  // Criar tabela de configuração de colunas
  await prisma.$queryRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_its_column_config (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      coluna_key TEXT NOT NULL,
      coluna_label TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, coluna_key)
    )
  `);
  console.log('✅ Tabela fiorix_its_column_config criada.');

  // Criar índice
  await prisma.$queryRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_its_column_config_tenant 
    ON public.fiorix_its_column_config(tenant_id)
  `);
  console.log('✅ Índice idx_its_column_config_tenant criado.');

  // Inserir defaults para todos os tenants que já possuem ITs
  const tenants = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT tenant_id FROM public.fiorix_its
  `);

  const defaultColumns = [
    { key: 'codigo', label: 'Código / IT' },
    { key: 'setor', label: 'Setor' },
    { key: 'versao', label: 'Versão' },
    { key: 'guardiao', label: 'Guardião Responsável' },
    { key: 'revisao', label: 'Última Revisão' },
    { key: 'ciencia', label: 'Ciência da Equipe' },
    { key: 'acoes', label: 'Ações' },
  ];

  for (const tenant of tenants) {
    for (const col of defaultColumns) {
      await prisma.$queryRawUnsafe(`
        INSERT INTO public.fiorix_its_column_config (tenant_id, coluna_key, coluna_label)
        VALUES ($1, $2, $3)
        ON CONFLICT (tenant_id, coluna_key) DO NOTHING
      `, tenant.tenant_id, col.key, col.label);
    }
    console.log(`  ✅ Defaults inseridos para tenant: ${tenant.tenant_id}`);
  }

  console.log('\n🎉 Migração concluída com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Erro na migração:', e);
  await prisma.$disconnect();
  process.exit(1);
});

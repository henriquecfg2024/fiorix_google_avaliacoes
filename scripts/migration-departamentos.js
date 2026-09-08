const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Criando tabela fiorix_departamentos...\n');

  await prisma.$queryRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_departamentos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      sigla TEXT,
      cor TEXT DEFAULT '#6366f1',
      ativo BOOLEAN DEFAULT TRUE,
      ordem INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, nome)
    )
  `);
  console.log('✅ Tabela fiorix_departamentos criada.');

  await prisma.$queryRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_departamentos_tenant 
    ON public.fiorix_departamentos(tenant_id)
  `);
  console.log('✅ Índice idx_departamentos_tenant criado.');

  // Inserir departamentos padrão baseados nos que já existem no sistema
  const tenants = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT tenant_id FROM public.fiorix_its
  `);

  const defaultDeptos = [
    { nome: 'Atendimento', sigla: 'ATD', cor: '#3b82f6', ordem: 1 },
    { nome: 'Registro', sigla: 'REG', cor: '#10b981', ordem: 2 },
    { nome: 'Financeiro', sigla: 'FIN', cor: '#f59e0b', ordem: 3 },
    { nome: 'RH', sigla: 'RH', cor: '#8b5cf6', ordem: 4 },
    { nome: 'Administração', sigla: 'ADM', cor: '#ef4444', ordem: 5 },
    { nome: 'TI', sigla: 'TI', cor: '#06b6d4', ordem: 6 },
    { nome: 'Indisponibilidade', sigla: 'IND', cor: '#f97316', ordem: 7 },
    { nome: 'Intimação', sigla: 'INT', cor: '#ec4899', ordem: 8 },
    { nome: 'Ofício', sigla: 'OFC', cor: '#14b8a6', ordem: 9 },
    { nome: 'Impressão/Arquivo', sigla: 'IMP', cor: '#64748b', ordem: 10 },
    { nome: 'Retificação', sigla: 'RET', cor: '#a855f7', ordem: 11 },
  ];

  for (const tenant of tenants) {
    for (const depto of defaultDeptos) {
      await prisma.$queryRawUnsafe(`
        INSERT INTO public.fiorix_departamentos (tenant_id, nome, sigla, cor, ordem)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tenant_id, nome) DO NOTHING
      `, tenant.tenant_id, depto.nome, depto.sigla, depto.cor, depto.ordem);
    }
    console.log(`  ✅ Departamentos inseridos para tenant: ${tenant.tenant_id}`);
  }

  // Verificar departamentos que existem nos Users mas não na tabela
  const existingDeptos = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT departamento 
    FROM public."User" 
    WHERE departamento IS NOT NULL AND departamento != ''
  `);

  for (const tenant of tenants) {
    for (const row of existingDeptos) {
      if (row.departamento && !defaultDeptos.find(d => d.nome === row.departamento)) {
        await prisma.$queryRawUnsafe(`
          INSERT INTO public.fiorix_departamentos (tenant_id, nome, sigla, cor, ordem)
          VALUES ($1, $2, $3, '#6366f1', 99)
          ON CONFLICT (tenant_id, nome) DO NOTHING
        `, tenant.tenant_id, row.departamento, row.departamento.substring(0, 3).toUpperCase());
        console.log(`  ✅ Departamento extra adicionado: ${row.departamento}`);
      }
    }
  }

  console.log('\n🎉 Migração de departamentos concluída com sucesso!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Erro na migração:', e);
  await prisma.$disconnect();
  process.exit(1);
});

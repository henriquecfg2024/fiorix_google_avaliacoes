const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando migração SaaS V4 Multi-Tenant...');

  // 1. Expandir public."Tenant"
  console.log('1. Expandindo colunas da tabela public."Tenant"...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public."Tenant"
      ADD COLUMN IF NOT EXISTS slug TEXT,
      ADD COLUMN IF NOT EXISTS cnpj TEXT,
      ADD COLUMN IF NOT EXISTS dominio TEXT,
      ADD COLUMN IF NOT EXISTS cidade TEXT,
      ADD COLUMN IF NOT EXISTS estado TEXT,
      ADD COLUMN IF NOT EXISTS plano TEXT DEFAULT 'PRO',
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo',
      ADD COLUMN IF NOT EXISTS "maxUsuarios" INT DEFAULT 100,
      ADD COLUMN IF NOT EXISTS "dpoEmail" TEXT,
      ADD COLUMN IF NOT EXISTS "responsavelNome" TEXT,
      ADD COLUMN IF NOT EXISTS "responsavelEmail" TEXT;
  `);

  // Índices únicos condicionais se ainda não existirem
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Tenant_slug_key') THEN
        CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" (slug) WHERE slug IS NOT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Tenant_cnpj_key') THEN
        CREATE UNIQUE INDEX "Tenant_cnpj_key" ON public."Tenant" (cnpj) WHERE cnpj IS NOT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Tenant_dominio_key') THEN
        CREATE UNIQUE INDEX "Tenant_dominio_key" ON public."Tenant" (dominio) WHERE dominio IS NOT NULL;
      END IF;
    END $$;
  `);

  // 2. Atualizar dados do 7º RI de São Paulo
  console.log('2. Atualizando dados do 7º RI de São Paulo...');
  const existingTenants = await prisma.$queryRawUnsafe(`SELECT id, name FROM public."Tenant" LIMIT 5`);
  console.log('Tenants existentes:', existingTenants);

  let defaultTenantId = existingTenants[0]?.id;

  if (defaultTenantId) {
    await prisma.$executeRawUnsafe(`
      UPDATE public."Tenant"
      SET 
        slug = COALESCE(slug, '7ri-sp'),
        cnpj = COALESCE(cnpj, '11.111.111/0001-07'),
        dominio = COALESCE(dominio, '7risp.com.br'),
        cidade = COALESCE(cidade, 'São Paulo'),
        estado = COALESCE(estado, 'SP'),
        plano = COALESCE(plano, 'OMEGA'),
        status = COALESCE(status, 'ativo'),
        "maxUsuarios" = COALESCE("maxUsuarios", 250),
        "dpoEmail" = COALESCE("dpoEmail", 'dpo@7risp.com.br'),
        "responsavelNome" = COALESCE("responsavelNome", 'Henrique Cesar Ferreira Gama'),
        "responsavelEmail" = COALESCE("responsavelEmail", 'henrique.gama@7risp.com.br')
      WHERE id = $1
    `, defaultTenantId);
    console.log(`Tenant ${defaultTenantId} atualizado com slug '7ri-sp'.`);
  }

  // 3. Inserir cartórios de teste/demonstração
  console.log('3. Criando cartórios adicionais para o SaaS...');
  await prisma.$executeRawUnsafe(`
    INSERT INTO public."Tenant" (
      id, name, slug, cnpj, dominio, cidade, estado, plano, status, "maxUsuarios", "updatedAt"
    ) VALUES 
    (
      'tenant_1ri_campinas_demo',
      '1º Cartório de Registro de Imóveis de Campinas',
      '1ri-campinas',
      '22.222.222/0001-22',
      '1ricampinas.com.br',
      'Campinas',
      'SP',
      'PRO',
      'ativo',
      100,
      NOW()
    ),
    (
      'tenant_2ri_santos_demo',
      '2º Cartório de Registro de Imóveis de Santos',
      '2ri-santos',
      '33.333.333/0001-33',
      '2risantos.com.br',
      'Santos',
      'SP',
      'BASIC',
      'trial',
      50,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      cnpj = EXCLUDED.cnpj,
      dominio = EXCLUDED.dominio,
      cidade = EXCLUDED.cidade,
      estado = EXCLUDED.estado,
      plano = EXCLUDED.plano,
      status = EXCLUDED.status;
  `);

  // 4. Adicionar tenant_id às 28 tabelas fiorix_* e associar ao 7º RI
  console.log('4. Verificando e adicionando tenant_id nas tabelas fiorix_*...');
  const tabelas = [
    'fiorix_its',
    'fiorix_its_versoes',
    'fiorix_its_aceites',
    'fiorix_its_audit_log',
    'fiorix_its_ciencias',
    'fiorix_its_solicitacoes',
    'fiorix_its_column_config',
    'fiorix_departamentos',
    'fiorix_matriz_polivalencia',
    'fiorix_trilhas_estudo',
    'fiorix_audit_logs',
    'fiorix_bi_imports',
    'fiorix_bi_data',
    'fiorix_bi_daily_agg',
    'fiorix_bi_return_note_agg',
    'fiorix_metas_imports',
    'fiorix_metas_dados',
    'fiorix_produtividade_imports',
    'fiorix_produtividade_dados',
    'fiorix_tarefas_imports',
    'fiorix_tarefas_dados',
    'fiorix_rate_limits',
    'fiorix_connector_telemetry',
    'fiorix_operations_alert_channels',
    'fiorix_operations_alert_logs'
  ];

  for (const tabela of tabelas) {
    try {
      // Verifica se tabela existe
      const [tableExists] = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        ) as exists
      `, tabela);

      if (tableExists?.exists) {
        // Adiciona coluna tenant_id se não existir
        await prisma.$executeRawUnsafe(`
          ALTER TABLE public.${tabela}
          ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public."Tenant"(id) ON DELETE CASCADE;
        `);

        // Backfill de registros existentes para o tenant default
        if (defaultTenantId) {
          const res = await prisma.$executeRawUnsafe(`
            UPDATE public.${tabela}
            SET tenant_id = $1
            WHERE tenant_id IS NULL;
          `, defaultTenantId);
          console.log(`  ✓ ${tabela}: tenant_id configurado (atualizados: ${res})`);
        }
      } else {
        console.log(`  - ${tabela}: tabela não existe no banco, ignorando.`);
      }
    } catch (err) {
      console.warn(`  ⚠️ Aviso ao processar ${tabela}:`, err.message);
    }
  }

  // 5. Garantir que todos os usuários tenham tenant_id (exceto MASTER admin@fiorix.com.br)
  if (defaultTenantId) {
    const updatedUsers = await prisma.$executeRawUnsafe(`
      UPDATE public."User"
      SET "tenantId" = $1
      WHERE "tenantId" IS NULL AND email != 'admin@fiorix.com.br';
    `, defaultTenantId);
    console.log(`5. Usuários sem tenant vinculados ao 7º RI: ${updatedUsers}`);
  }

  console.log('\n✅ Migração SaaS V4 concluída com sucesso!');
}

main()
  .catch(err => {
    console.error('❌ Erro na migração:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

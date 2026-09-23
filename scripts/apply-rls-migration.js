const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TABLES = [
  'fiorix_acesso_log',
  'fiorix_audit_logs',
  'fiorix_comunicados',
  'fiorix_comunicados_anexos',
  'fiorix_comunicados_ciencia',
  'fiorix_connector_telemetry',
  'fiorix_departamentos',
  'fiorix_ferias_avisos',
  'fiorix_ferias_escala',
  'fiorix_ferias_previstas',
  'fiorix_ferias_previstas_historico',
  'fiorix_ferias_publicacao',
  'fiorix_holerites',
  'fiorix_its',
  'fiorix_its_aceites',
  'fiorix_its_audit_log',
  'fiorix_its_ciencias',
  'fiorix_its_column_config',
  'fiorix_its_participants',
  'fiorix_its_propostas',
  'fiorix_its_solicitacoes',
  'fiorix_its_versoes',
  'fiorix_matriz_polivalencia',
  'fiorix_notificacoes',
  'fiorix_operations_alert_channels',
  'fiorix_operations_alert_logs',
  'fiorix_trilhas_estudo'
];

async function main() {
  console.log('=== FIORIX: APLICAÇÃO DE MIGRAÇÃO DE SEGURANÇA ESTRUTURAL (RLS & STORAGE) ===\n');

  try {
    // 1. Inventário antes da migração
    const beforeInventory = await prisma.$queryRawUnsafe(`
      SELECT c.relname as table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relrowsecurity = false;
    `);

    console.log(`[STATUS ANTES] Tabelas com RLS desabilitado: ${beforeInventory.length}`);
    beforeInventory.forEach((r, idx) => console.log(`  ${idx + 1}. public.${r.table_name}`));

    // 2. Habilita RLS em cada tabela individualmente
    console.log('\n[MIGRAÇÃO] 1. Habilitando RLS nas 27 tabelas públicas...');
    for (const t of TABLES) {
      await prisma.$executeRawUnsafe(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
      console.log(`  ✓ RLS habilitado: public.${t}`);
    }

    // 3. Aplica políticas de acesso para service_role
    console.log('\n[MIGRAÇÃO] 2. Criando políticas administrativas para service_role...');
    for (const t of TABLES) {
      const polName = `service_role_all_${t}`;
      await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "${polName}" ON public.${t};`);
      await prisma.$executeRawUnsafe(`CREATE POLICY "${polName}" ON public.${t} FOR ALL TO service_role USING (true) WITH CHECK (true);`);
    }
    console.log('  ✓ Políticas service_role aplicadas nas 27 tabelas.');

    // 4. Revogação de privilégios de anon nas tabelas sensíveis
    console.log('\n[MIGRAÇÃO] 3. Revogando privilégios relacionais do papel anon...');
    const sensitiveTables = [
      'fiorix_audit_logs',
      'fiorix_acesso_log',
      'fiorix_connector_telemetry',
      'fiorix_operations_alert_logs',
      'fiorix_operations_alert_channels',
      'fiorix_its_audit_log',
      'fiorix_ferias_escala',
      'fiorix_holerites'
    ];
    for (const t of sensitiveTables) {
      await prisma.$executeRawUnsafe(`REVOKE ALL ON public.${t} FROM anon;`);
      console.log(`  ✓ REVOKE ALL ON public.${t} FROM anon;`);
    }

    // 5. Hardening de Storage: revogar políticas perigosas
    console.log('\n[MIGRAÇÃO] 4. Endurecendo políticas de storage.objects...');
    const dropStoragePolicies = [
      'allow-all-delete-it-documentos',
      'allow-all-update-it-documentos',
      'allow-all-fiorix-its-update',
      'allow-all-fiorix-its-insert',
      'allow-all l1s17l_1'
    ];
    for (const pol of dropStoragePolicies) {
      try {
        await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "${pol}" ON storage.objects;`);
        console.log(`  ✓ DROP POLICY: "${pol}"`);
      } catch (err) {
        console.warn(`  ⚠️ Aviso ao remover policy ${pol}:`, err.message);
      }
    }

    // Garante política de service_role no storage
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'service_role_all_storage'
        ) THEN
          CREATE POLICY "service_role_all_storage" ON storage.objects FOR ALL TO service_role USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);
    console.log('  ✓ Política service_role_all_storage garantida.');

    // 6. Inventário após a migração
    const afterInventory = await prisma.$queryRawUnsafe(`
      SELECT c.relname as table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relrowsecurity = false;
    `);

    console.log(`\n==============================================================================`);
    console.log(`[STATUS FINAL] Tabelas com RLS desabilitado no schema public: ${afterInventory.length}`);
    if (afterInventory.length === 0) {
      console.log('🎉 SUCESSO: 100% das 27 tabelas públicas agora estão com RLS HABILITADO!');
    } else {
      console.warn('⚠️ Tabelas ainda pendentes:', afterInventory);
    }
    console.log(`==============================================================================\n`);

    // 7. Lista final de políticas do storage
    const storagePolicies = await prisma.$queryRawUnsafe(`
      SELECT policyname, roles, cmd
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
      ORDER BY policyname;
    `);

    console.log('[STORAGE POLICIES] Políticas remanescentes em storage.objects:');
    storagePolicies.forEach((p) => {
      console.log(`  - ${p.policyname} (${p.cmd}) para [${p.roles.join(', ')}]`);
    });

  } catch (err) {
    console.error('❌ ERRO DURANTE APLICAÇÃO DA MIGRAÇÃO:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

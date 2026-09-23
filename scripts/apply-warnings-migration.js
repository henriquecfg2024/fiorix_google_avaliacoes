const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== FIORIX: APLICAÇÃO DA CORREÇÃO DOS 3 WARNINGS DO SUPABASE ===\n');

  try {
    // 1. Corrige search_path na função trg_fiorix_prevent_audit_tampering
    console.log('[1/2] Corrigindo Function Search Path Mutable em public.trg_fiorix_prevent_audit_tampering...');
    await prisma.$executeRawUnsafe(`ALTER FUNCTION public.trg_fiorix_prevent_audit_tampering() SET search_path = '';`);
    console.log('  ✓ Função configurada com search_path = \'\'');

    // Validação da função
    const funcConfig = await prisma.$queryRawUnsafe(`
      SELECT proname, proconfig
      FROM pg_proc
      WHERE proname = 'trg_fiorix_prevent_audit_tampering';
    `);
    console.log('  ✓ Configuração confirmada:', funcConfig[0]?.proconfig);

    // 2. Corrige Public Bucket Allows Listing removendo policies de SELECT públicas
    console.log('\n[2/2] Corrigindo Public Bucket Allows Listing em storage.it-documentos e storage.fiorix-its...');
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "allow-all l1s17l_0" ON storage.objects;`);
    console.log('  ✓ Removida política allow-all l1s17l_0');
    await prisma.$executeRawUnsafe(`DROP POLICY IF EXISTS "allow-all-fiorix-its-select" ON storage.objects;`);
    console.log('  ✓ Removida política allow-all-fiorix-its-select');

    // 3. Status final das políticas de storage
    const policies = await prisma.$queryRawUnsafe(`
      SELECT policyname, roles, cmd
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
      ORDER BY policyname;
    `);

    console.log('\n[STATUS FINAL] Políticas ativas em storage.objects:');
    policies.forEach((p) => {
      console.log(`  - ${p.policyname} (${p.cmd}) para [${p.roles.join(', ')}]`);
    });

    console.log('\n🎉 SUCESSO: Todas as 3 correções foram aplicadas no banco de produção!');
  } catch (err) {
    console.error('❌ Erro ao aplicar migração:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const tables = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    console.log('Total tables in public schema:', tables.length);

    const views = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Total views in public schema:', views.length);

    const grants = await prisma.$queryRawUnsafe(`
      SELECT grantee, table_name, privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_schema = 'public' 
        AND grantee IN ('anon', 'authenticated', 'service_role')
      ORDER BY table_name, grantee;
    `);
    console.log('Total grants found for anon/auth/service_role:', grants.length);

    const tableNames = tables.map(t => t.table_name);
    const tablesByGrantee = {};
    for (const g of grants) {
      if (!tablesByGrantee[g.table_name]) tablesByGrantee[g.table_name] = new Set();
      tablesByGrantee[g.table_name].add(g.grantee);
    }

    const missingAny = [];
    for (const t of tableNames) {
      const s = tablesByGrantee[t] || new Set();
      const missingRoles = [];
      if (!s.has('anon')) missingRoles.push('anon');
      if (!s.has('authenticated')) missingRoles.push('authenticated');
      if (!s.has('service_role')) missingRoles.push('service_role');
      if (missingRoles.length > 0) {
        missingAny.push({ table: t, missing: missingRoles });
      }
    }

    console.log('\n--- DIAGNÓSTICO DE TABELAS ---');
    console.log('Tabelas com grants ausentes para anon, authenticated ou service_role:', missingAny.length);
    if (missingAny.length > 0) {
      console.log(JSON.stringify(missingAny, null, 2));
    } else {
      console.log('TODAS as tabelas do schema public possuem grants para anon, authenticated e service_role!');
    }

    const rls = await prisma.$queryRawUnsafe(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
      WHERE nspname = 'public' AND relkind = 'r'
      ORDER BY relname;
    `);
    const rlsDisabled = rls.filter(r => !r.relrowsecurity).map(r => r.relname);
    console.log('\nTabelas com RLS desativado:', rlsDisabled.length);
    if (rlsDisabled.length > 0) {
      console.log(rlsDisabled);
    }

    const policies = await prisma.$queryRawUnsafe(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    console.log('\nTotal de políticas RLS em public:', policies.length);
    console.log('Exemplos de políticas:');
    policies.slice(0, 5).forEach(p => console.log(`  [${p.tablename}] ${p.policyname} (cmd: ${p.cmd}, roles: ${p.roles})`));


  } catch (err) {
    console.error('Erro ao verificar banco:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();

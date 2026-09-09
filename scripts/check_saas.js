const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const tables = await p.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'fiorix%' ORDER BY tablename"
  );
  console.log('=== Tabelas fiorix_* no banco ===');
  tables.forEach(t => console.log(' ', t.tablename));

  const tenants = await p.$queryRawUnsafe("SELECT id, name FROM public.\"Tenant\"");
  console.log('\n=== Tenants existentes ===');
  tenants.forEach(t => console.log(` ${t.id} → ${t.name}`));

  const cols = await p.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name='Tenant' AND table_schema='public' ORDER BY ordinal_position"
  );
  console.log('\n=== Colunas do Tenant ===');
  cols.forEach(c => console.log(' ', c.column_name));

  await p.$disconnect();
}
main();

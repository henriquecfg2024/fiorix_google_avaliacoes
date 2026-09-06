const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const cols = await p.$queryRawUnsafe(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fiorix_its' ORDER BY ordinal_position"
  );
  console.log('=== fiorix_its columns ===');
  console.log(JSON.stringify(cols, null, 2));

  const colsCiencia = await p.$queryRawUnsafe(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fiorix_its_ciencias' ORDER BY ordinal_position"
  );
  console.log('\n=== fiorix_its_ciencias columns ===');
  console.log(JSON.stringify(colsCiencia, null, 2));

  const configTables = await p.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'fiorix_its%' ORDER BY table_name"
  );
  console.log('\n=== All fiorix_its tables ===');
  console.log(JSON.stringify(configTables, null, 2));

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });

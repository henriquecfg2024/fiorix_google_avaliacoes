const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Read and execute bi-performance.sql to recreate the function
  const sqlPath = path.join(__dirname, 'prisma', 'bi-performance.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Applying bi-performance.sql...');
  
  // Split the file at the function definition
  const funcStart = sql.indexOf('CREATE OR REPLACE FUNCTION');
  const beforeFunc = sql.substring(0, funcStart);
  const funcBody = sql.substring(funcStart);

  // Drop old versions of the function to avoid duplicate/overloaded signatures
  console.log('Dropping old function signatures...');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS refresh_fiorix_bi_aggregates(text);');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS refresh_fiorix_bi_aggregates(text, text);');

  // Execute the function creation only
  if (funcBody.trim().length > 0) {
    await prisma.$executeRawUnsafe(funcBody);
  }
  console.log('SQL function recreated successfully.');

  // Find all imports
  const imports = await prisma.fiorixBiImport.findMany({ select: { id: true, fileName: true } });
  console.log(`Found ${imports.length} imports. Re-aggregating...`);

  for (const imp of imports) {
    console.log(`Re-aggregating ${imp.fileName} (${imp.id})...`);
    const res = await prisma.$queryRawUnsafe(`SELECT * FROM refresh_fiorix_bi_aggregates($1)`, imp.id);
    console.log(`Result:`, res);
  }

  console.log('Re-aggregation complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

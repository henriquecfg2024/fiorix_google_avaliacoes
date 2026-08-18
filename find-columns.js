const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fiorix_metas_dados';
  `);
  console.log('Colunas de fiorix_metas_dados:', result);
}

main().catch(console.error).finally(() => prisma.$disconnect());

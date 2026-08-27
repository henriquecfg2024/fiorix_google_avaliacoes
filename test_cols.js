const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const result = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'fiorix_bi_data';
  `;
  console.log(result);
  await prisma.$disconnect();
}

run();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const count = await prisma.fiorixBiData.count();
    console.log('Total rows in fiorix_bi_data:', count);

    const firstRows = await prisma.fiorixBiData.findMany({ take: 3 });
    console.log('First 3 rows:', firstRows);
  } catch (error) {
    console.error('Error counting rows:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();

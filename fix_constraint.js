const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Fixing constraints...');
  try {
    // Drop the unique index if it exists
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "fiorix_bi_data_id_andamento_unique" CASCADE;`);
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "fiorix_bi_data_IdAndamento_key" CASCADE;`);
    
    // Add unique constraint
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "fiorix_bi_data" 
      ADD CONSTRAINT "fiorix_bi_data_IdAndamento_key" UNIQUE ("IdAndamento");
    `);
    console.log('Constraint created!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();

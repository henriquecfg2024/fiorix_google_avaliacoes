const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$executeRawUnsafe(`
      ALTER TABLE public."User" 
        ADD COLUMN IF NOT EXISTS "totpSecret" TEXT,
        ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS "totpVerifiedAt" TIMESTAMP(3)
    `);
    console.log('Migration OK - TOTP columns added:', result);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

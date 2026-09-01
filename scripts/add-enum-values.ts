import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database...');
  try {
    // Add enum values if they don't exist
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RH' AND enumtypid = '"Role"'::regtype) THEN
          ALTER TYPE "Role" ADD VALUE 'RH';
        END IF;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('Added RH to Role enum');

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COLABORADOR' AND enumtypid = '"Role"'::regtype) THEN
          ALTER TYPE "Role" ADD VALUE 'COLABORADOR';
        END IF;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    console.log('Added COLABORADOR to Role enum');

    const roles = await prisma.$queryRawUnsafe(`
      SELECT enumlabel FROM pg_enum WHERE enumtypid = '"Role"'::regtype;
    `);
    console.log('Current Role enum values in DB:', roles);
  } catch (error) {
    console.error('Error updating enum:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

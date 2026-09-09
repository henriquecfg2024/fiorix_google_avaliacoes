const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const buckets = await prisma.$queryRawUnsafe(`
      SELECT id, name, public, file_size_limit, allowed_mime_types 
      FROM storage.buckets
    `);
    console.log('Buckets:', JSON.stringify(buckets, null, 2));

    const policies = await prisma.$queryRawUnsafe(`
      SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'storage'
    `);
    console.log('Storage Policies:', JSON.stringify(policies, null, 2));
  } catch (err) {
    console.error('Erro:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();

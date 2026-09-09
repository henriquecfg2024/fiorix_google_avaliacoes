const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addPolicies() {
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'allow-all-update-it-documentos'
        ) THEN
          CREATE POLICY "allow-all-update-it-documentos" ON storage.objects
          FOR UPDATE TO public
          USING (bucket_id = 'it-documentos')
          WITH CHECK (bucket_id = 'it-documentos');
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'allow-all-delete-it-documentos'
        ) THEN
          CREATE POLICY "allow-all-delete-it-documentos" ON storage.objects
          FOR DELETE TO public
          USING (bucket_id = 'it-documentos');
        END IF;
      END $$;
    `);
    console.log('Políticas de UPDATE e DELETE criadas com sucesso no storage.objects!');
  } catch (err) {
    console.error('Erro ao criar políticas:', err);
  } finally {
    await prisma.$disconnect();
  }
}
addPolicies();

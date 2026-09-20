const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Verificando constraints em fiorix_conversas e fiorix_conversa_membros ---');
  const constraints = await prisma.$queryRawUnsafe(`
    SELECT conname, relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname IN ('fiorix_conversas', 'fiorix_conversa_membros')
      AND con.contype = 'c';
  `);
  console.log('Check constraints encontradas:', constraints);

  for (const c of constraints) {
    console.log(`Removendo constraint ${c.conname} de ${c.relname}...`);
    await prisma.$executeRawUnsafe(`ALTER TABLE public."${c.relname}" DROP CONSTRAINT IF EXISTS "${c.conname}";`);
  }

  console.log('--- Atualizando colunas para usar os tipos ENUM ---');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.fiorix_conversas
      ALTER COLUMN tipo DROP DEFAULT,
      ALTER COLUMN tipo TYPE public."ConversaTipo" USING tipo::public."ConversaTipo",
      ALTER COLUMN tipo SET DEFAULT 'DIRECT'::public."ConversaTipo";
  `);
  console.log('fiorix_conversas.tipo atualizada.');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.fiorix_conversa_membros
      ALTER COLUMN papel DROP DEFAULT,
      ALTER COLUMN papel TYPE public."MembroPapel" USING papel::public."MembroPapel",
      ALTER COLUMN papel SET DEFAULT 'MEMBER'::public."MembroPapel";
  `);
  console.log('fiorix_conversa_membros.papel atualizada.');

  // Validação final
  const updatedCols = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name IN ('fiorix_conversas', 'fiorix_conversa_membros')
      AND column_name IN ('tipo', 'papel')
  `);
  console.log('Colunas pós-migração:', updatedCols);

  // Teste de consulta Prisma findFirst
  console.log('--- Testando query Prisma conversaMembro.findFirst ---');
  const testRes = await prisma.conversaMembro.findFirst({
    include: {
      conversa: true,
    },
  });
  console.log('Resultado do teste Prisma:', testRes ? 'Encontrado' : 'Tabela vazia (sem erro)');
}

main()
  .catch((err) => {
    console.error('Erro:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

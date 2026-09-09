const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Verificando cartórios no banco...');
  const before = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, status: true },
  });
  console.log('Cartórios antes:', before);

  const deleted = await prisma.tenant.deleteMany({
    where: {
      slug: {
        in: ['1ri-campinas', '2ri-santos'],
      },
    },
  });
  console.log('Cartórios demo deletados:', deleted);

  const after = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, status: true },
  });
  console.log('Cartórios restantes no banco:', after);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

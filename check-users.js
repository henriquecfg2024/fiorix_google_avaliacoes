const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      role: true,
      tenantId: true,
      tenant: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  console.log('Usuários cadastrados:', JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

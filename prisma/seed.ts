import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create a Master Tenant (Cartório)
  const tenant = await prisma.tenant.create({
    data: {
      name: '7º Cartório de Registro de Imóveis de São Paulo',
    },
  });

  console.log(`Created Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Create the Master User
  const passwordHash = await bcrypt.hash('Fiorix2026!', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'admin@fiorix.com.br' },
    update: {},
    create: {
      email: 'admin@fiorix.com.br',
      name: 'Henrique Master',
      passwordHash,
      role: 'MASTER',
      tenantId: tenant.id,
    },
  });

  console.log(`Created Master User: ${user.email}`);

  // 3. Create some dummy Colaboradores
  const colabs = ['Lucas', 'Ana', 'Pedro', 'Maria', 'João'];
  for (const name of colabs) {
    await prisma.colaborador.create({
      data: {
        name,
        tenantId: tenant.id,
      }
    });
  }
  
  console.log('Created Colaboradores mock data.');
  console.log('Seed finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

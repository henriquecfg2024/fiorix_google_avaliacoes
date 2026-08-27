const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const data = await prisma.fiorixMetasDados.findUnique({
    where: {
      protocolo: 640972
    }
  });
  console.log('Registro do protocolo 640972:', JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

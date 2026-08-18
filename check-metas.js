const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const total = await prisma.fiorixMetasDados.count();
  console.log('Total de registros em fiorix_metas_dados:', total);

  if (total > 0) {
    const sample = await prisma.fiorixMetasDados.findMany({
      take: 5
    });
    console.log('Amostra de registros:', JSON.stringify(sample, null, 2));

    const missingBoth = await prisma.fiorixMetasDados.count({
      where: {
        dBalcaoRegistrado: null,
        dBalcaoDevolvido: null
      }
    });
    console.log('Registros com ambos nulos (missingBoth):', missingBoth);

    const missingOne = await prisma.fiorixMetasDados.count({
      where: {
        OR: [
          { dBalcaoRegistrado: null },
          { dBalcaoDevolvido: null }
        ]
      }
    });
    console.log('Registros com pelo menos um nulo (missingOne):', missingOne);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

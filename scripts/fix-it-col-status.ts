import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Verificar situação final de todas as ITs ativas
  const ativas = await prisma.$queryRawUnsafe<any[]>(
    `SELECT codigo, titulo, status, deleted_at
     FROM public.fiorix_its
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 20`
  );
  console.log('ITs sem deleted_at (ativas/pendentes):', JSON.stringify(ativas, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

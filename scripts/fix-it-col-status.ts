import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const antes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text, codigo, titulo, status FROM public.fiorix_its WHERE codigo LIKE 'COL-%' AND deleted_at IS NULL`
  );
  console.log('Antes:', JSON.stringify(antes, null, 2));

  const updated = await prisma.$executeRawUnsafe(
    `UPDATE public.fiorix_its
     SET status = 'enviada_para_analise', updated_at = NOW()
     WHERE codigo LIKE 'COL-%'
       AND deleted_at IS NULL
       AND status NOT IN ('rejeitada','arquivada','excluida_permanentemente')`
  );
  console.log('Linhas atualizadas:', updated);

  const depois = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text, codigo, titulo, status FROM public.fiorix_its WHERE codigo LIKE 'COL-%' AND deleted_at IS NULL`
  );
  console.log('Depois:', JSON.stringify(depois, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const r = await p.$queryRawUnsafe(
    "SELECT id, codigo, versao, pdf_original_url FROM public.fiorix_its WHERE codigo = 'IT-TI-001' LIMIT 1"
  );
  console.log(JSON.stringify(r, null, 2));
  await p.$disconnect();
}

main();

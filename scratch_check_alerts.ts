import { prisma } from '@/lib/prisma';

async function main() {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT whatsapp_phone, whatsapp_config, email_recipients FROM public.fiorix_operations_alert_channels LIMIT 1`
  );
  console.log(JSON.stringify(rows, null, 2));
  await prisma.$disconnect();
}

main();

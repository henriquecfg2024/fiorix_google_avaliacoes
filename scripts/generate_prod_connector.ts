import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('❌ Nenhum tenant encontrado no banco.');
    process.exit(1);
  }

  // Verifica se já existe um connector de produção para este tenant
  let connector = await prisma.connector.findFirst({
    where: { tenantId: tenant.id, name: 'Connector 7º RI SP - Produção' }
  });

  const secretPlain = `fiorix_conn_${crypto.randomBytes(32).toString('hex')}`;
  const hash = await bcrypt.hash(secretPlain, 10);

  if (!connector) {
    connector = await prisma.connector.create({
      data: {
        name: 'Connector 7º RI SP - Produção',
        enabled: true,
        tenantId: tenant.id,
        credentialIdentifier: hash,
        syncIntervalSec: 60,
      }
    });
  } else {
    connector = await prisma.connector.update({
      where: { id: connector.id },
      data: {
        credentialIdentifier: hash,
        enabled: true,
      }
    });
  }

  console.log('\n=======================================================');
  console.log('✅ CREDENCIAIS DE PRODUÇÃO GERADAS COM SUCESSO:');
  console.log(`CONNECTOR_ID="${connector.id}"`);
  console.log(`CONNECTOR_SECRET="${secretPlain}"`);
  console.log('=======================================================\n');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

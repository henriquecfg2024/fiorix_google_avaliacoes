const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

// 6543 pooler com timeout ajustado
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Conectando ao banco Supabase de Produção...');
  
  // Usando raw query rápida para evitar timeout
  const tenants = await prisma.$queryRawUnsafe('SELECT id, name FROM "Tenant" LIMIT 1;');
  if (!tenants || tenants.length === 0) {
    console.error('❌ Nenhum tenant encontrado.');
    return;
  }

  const tenant = tenants[0];
  console.log(`🏢 Cartório: ${tenant.name} (Tenant ID: ${tenant.id})`);

  const secretPlain = `fiorix_conn_${crypto.randomBytes(32).toString('hex')}`;
  const hash = await bcrypt.hash(secretPlain, 10);
  const connectorId = `conn_${crypto.randomBytes(12).toString('hex')}`;

  // Upsert direto via SQL para execução instantânea
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Connector" (id, name, enabled, "tenantId", "credentialIdentifier", "updatedAt")
    VALUES ($1, $2, true, $3, $4, NOW())
    ON CONFLICT (id) DO UPDATE SET "credentialIdentifier" = $4, "updatedAt" = NOW();
  `, connectorId, 'Connector 7º RI SP - Produção', tenant.id, hash);

  console.log('\n=======================================================');
  console.log('✅ CREDENCIAIS DE PRODUÇÃO GERADAS COM SUCESSO:');
  console.log(`CONNECTOR_ID="${connectorId}"`);
  console.log(`CONNECTOR_SECRET="${secretPlain}"`);
  console.log('=======================================================\n');
}

main()
  .catch((e) => console.error('Erro:', e))
  .finally(() => prisma.$disconnect());

import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Criando tabela DocumentSearchRequest no banco Supabase...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DocumentSearchRequest" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "connectorId" TEXT NOT NULL REFERENCES "Connector"("id") ON DELETE CASCADE,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'search',
      "query" TEXT,
      "rootId" TEXT,
      "relativePath" TEXT,
      "pageStart" INTEGER,
      "pageEnd" INTEGER,
      "status" TEXT NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued', 'running', 'complete', 'failed')),
      "result" JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMPTZ NOT NULL
    )
  `);
  console.log('Tabela criada!');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "document_requests_claim" ON "DocumentSearchRequest" ("tenantId", "connectorId", "status", "createdAt")
  `);
  console.log('Index claim criado!');
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "document_requests_expiry" ON "DocumentSearchRequest" ("expiresAt")
  `);
  console.log('Index expiry criado!');
  console.log('Tabela DocumentSearchRequest criada/verificada com sucesso!');
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { prisma } from './prisma';

let initialized = false;

export async function ensureSyncLogTable() {
  if (initialized) return;

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SyncLog" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
      "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
      "triggeredBy" TEXT,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finishedAt" TIMESTAMP(3),
      "durationMs" INTEGER,
      "reviewsFetched" INTEGER NOT NULL DEFAULT 0,
      "reviewsImported" INTEGER NOT NULL DEFAULT 0,
      "errorMessage" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "SyncLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_sync_log_tenant_created" ON "SyncLog"("tenantId", "createdAt" DESC);`);
  initialized = true;
}

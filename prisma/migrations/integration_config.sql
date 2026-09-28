-- Create IntegrationStatus enum
DO $$ BEGIN
  CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'ATTENTION', 'DISCONNECTED', 'UNCONFIGURED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create IntegrationConfig table
CREATE TABLE IF NOT EXISTS "fiorix_integration_configs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "integration_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'UNCONFIGURED',
  "encrypted_config" TEXT,
  "config_iv" TEXT,
  "config_mask" TEXT,
  "last_test_at" TIMESTAMP(3),
  "last_test_ok" BOOLEAN,
  "last_test_latency_ms" INTEGER,
  "last_sync_at" TIMESTAMP(3),
  "configured_at" TIMESTAMP(3),
  "configured_by" TEXT,
  "sla_minutes" INTEGER NOT NULL DEFAULT 15,
  "sync_interval_min" INTEGER NOT NULL DEFAULT 30,
  "max_failures" INTEGER NOT NULL DEFAULT 3,
  "max_gap_minutes" INTEGER NOT NULL DEFAULT 120,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiorix_integration_configs_pkey" PRIMARY KEY ("id")
);

-- Create IntegrationAuditLog table
CREATE TABLE IF NOT EXISTS "fiorix_integration_audit_logs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "integration_id" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "actor_user_name" TEXT NOT NULL,
  "result" TEXT NOT NULL DEFAULT 'success',
  "detail" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiorix_integration_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Unique constraint
ALTER TABLE "fiorix_integration_configs" DROP CONSTRAINT IF EXISTS "fiorix_integration_configs_tenant_id_integration_id_key";
ALTER TABLE "fiorix_integration_configs" ADD CONSTRAINT "fiorix_integration_configs_tenant_id_integration_id_key" UNIQUE ("tenant_id", "integration_id");

-- Indexes
CREATE INDEX IF NOT EXISTS "fiorix_integration_configs_tenant_id_idx" ON "fiorix_integration_configs"("tenant_id");
CREATE INDEX IF NOT EXISTS "fiorix_integration_configs_integration_id_idx" ON "fiorix_integration_configs"("integration_id");
CREATE INDEX IF NOT EXISTS "fiorix_integration_audit_logs_tenant_id_idx" ON "fiorix_integration_audit_logs"("tenant_id");
CREATE INDEX IF NOT EXISTS "fiorix_integration_audit_logs_integration_id_idx" ON "fiorix_integration_audit_logs"("integration_id");
CREATE INDEX IF NOT EXISTS "fiorix_integration_audit_logs_created_at_idx" ON "fiorix_integration_audit_logs"("created_at");

-- Foreign keys
ALTER TABLE "fiorix_integration_configs" DROP CONSTRAINT IF EXISTS "fiorix_integration_configs_tenant_id_fkey";
ALTER TABLE "fiorix_integration_configs" ADD CONSTRAINT "fiorix_integration_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiorix_integration_audit_logs" DROP CONSTRAINT IF EXISTS "fiorix_integration_audit_logs_tenant_id_fkey";
ALTER TABLE "fiorix_integration_audit_logs" ADD CONSTRAINT "fiorix_integration_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fiorix_integration_audit_logs" DROP CONSTRAINT IF EXISTS "fiorix_integration_audit_logs_integration_id_fkey";
ALTER TABLE "fiorix_integration_audit_logs" ADD CONSTRAINT "fiorix_integration_audit_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "fiorix_integration_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

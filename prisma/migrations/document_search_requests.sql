-- Apply explicitly in homologation first. No document bytes are stored here.
CREATE TABLE IF NOT EXISTS "DocumentSearchRequest" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "connectorId" TEXT NOT NULL REFERENCES "Connector"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "query" TEXT NOT NULL CHECK (length("query") BETWEEN 2 AND 120),
  "status" TEXT NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued', 'running', 'complete', 'failed')),
  "result" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS "document_requests_claim" ON "DocumentSearchRequest" ("tenantId", "connectorId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "document_requests_expiry" ON "DocumentSearchRequest" ("expiresAt");
-- No direct access via Supabase client roles. Access is through authenticated server routes.
ALTER TABLE "DocumentSearchRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "DocumentSearchRequest" FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "DocumentSearchRequest" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "DocumentSearchRequest" FROM authenticated;
  END IF;
END $$;

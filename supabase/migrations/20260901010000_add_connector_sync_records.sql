BEGIN;

CREATE TABLE "ConnectorSyncRecord" (
  "tenantId" TEXT NOT NULL,
  "connectorId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "recordKey" TEXT NOT NULL,
  "record" JSONB NOT NULL,
  "syncMode" TEXT NOT NULL DEFAULT 'incremental',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectorSyncRecord_pkey" PRIMARY KEY ("tenantId", "connectorId", "source", "recordKey"),
  CONSTRAINT "ConnectorSyncRecord_syncMode_check" CHECK ("syncMode" IN ('incremental', 'reconciliation'))
);

CREATE INDEX "ConnectorSyncRecord_tenantId_source_idx"
  ON "ConnectorSyncRecord" ("tenantId", "source");

ALTER TABLE "ConnectorSyncRecord"
  ADD CONSTRAINT "ConnectorSyncRecord_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConnectorSyncRecord"
  ADD CONSTRAINT "ConnectorSyncRecord_connectorId_fkey"
  FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

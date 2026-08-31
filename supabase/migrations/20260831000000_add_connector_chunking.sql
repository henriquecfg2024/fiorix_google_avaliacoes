BEGIN;

ALTER TABLE "ConnectorSyncBatch"
  ADD COLUMN "chunkCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "chunksReceived" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ConnectorSyncStaging"
  ADD COLUMN "chunkIndex" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "chunkCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "ConnectorSyncBatch"
  ADD CONSTRAINT "ConnectorSyncBatch_chunkCount_check"
    CHECK ("chunkCount" > 0),
  ADD CONSTRAINT "ConnectorSyncBatch_chunksReceived_check"
    CHECK ("chunksReceived" >= 0 AND "chunksReceived" <= "chunkCount");

ALTER TABLE "ConnectorSyncStaging"
  ADD CONSTRAINT "ConnectorSyncStaging_chunkRange_check"
    CHECK ("chunkCount" > 0 AND "chunkIndex" >= 0 AND "chunkIndex" < "chunkCount");

CREATE UNIQUE INDEX "ConnectorSyncStaging_tenantId_connectorId_source_batchId_chunkIndex_key"
  ON "ConnectorSyncStaging" ("tenantId", "connectorId", "source", "batchId", "chunkIndex");

COMMIT;

BEGIN;

ALTER TABLE "ConnectorSyncBatch"
  ADD COLUMN "syncMode" TEXT NOT NULL DEFAULT 'full';

ALTER TABLE "ConnectorSyncStaging"
  ADD COLUMN "syncMode" TEXT NOT NULL DEFAULT 'full';

ALTER TABLE "ConnectorSyncBatch"
  ADD CONSTRAINT "ConnectorSyncBatch_syncMode_check"
  CHECK ("syncMode" IN ('full', 'incremental', 'reconciliation'));

ALTER TABLE "ConnectorSyncStaging"
  ADD CONSTRAINT "ConnectorSyncStaging_syncMode_check"
  CHECK ("syncMode" IN ('full', 'incremental', 'reconciliation'));

COMMIT;

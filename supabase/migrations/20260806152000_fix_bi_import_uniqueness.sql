-- IdAndamento identifies a row inside an imported snapshot, not globally.
-- Keeping it globally unique makes a new import collide with an older snapshot
-- and can leave the import header saved with zero data rows.
ALTER TABLE fiorix_bi_data
  DROP CONSTRAINT IF EXISTS "fiorix_bi_data_IdAndamento_key";
DROP INDEX IF EXISTS "fiorix_bi_data_IdAndamento_key";

CREATE UNIQUE INDEX IF NOT EXISTS "fiorix_bi_data_import_id_andamento_key"
  ON fiorix_bi_data (import_id, "IdAndamento");

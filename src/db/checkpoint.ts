import { DatabaseSync } from 'node:sqlite';
import { addSecondsToSqlDateTime2Local } from '../utils/sqlDateTime.js';

export type SyncCheckpoint = {
  source: string;
  cursor_value: string;
  secondary_cursor: string | null;
  last_success_at: string | null;
  last_batch_id: string | null;
  last_reconciliation_at: string | null;
  updated_at: string;
};

export function initializeCheckpointSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_checkpoints (
      source TEXT PRIMARY KEY,
      cursor_value TEXT,
      secondary_cursor TEXT,
      last_success_at TEXT,
      last_batch_id TEXT,
      last_reconciliation_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sync_checkpoint_candidates (
      batch_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      cursor_value TEXT NOT NULL,
      tie_breaker TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const columns = db.prepare(`PRAGMA table_info(sync_checkpoints)`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'last_batch_id')) {
    db.exec(`ALTER TABLE sync_checkpoints ADD COLUMN last_batch_id TEXT`);
  }
  const legacyExists = db.prepare(`SELECT 1 AS found FROM sqlite_master WHERE type='table' AND name='sync_checkpoint'`).get();
  if (legacyExists) {
    db.exec(`
      INSERT OR IGNORE INTO sync_checkpoints (source, cursor_value, secondary_cursor, last_success_at, updated_at)
      SELECT source, cursor_value, tie_breaker, updated_at, updated_at FROM sync_checkpoint;
    `);
  }
}

export function stageCheckpointCandidate(
  db: DatabaseSync,
  candidate: { batchId: string; source: string; cursorValue: string; tieBreaker?: string | null },
) {
  initializeCheckpointSchema(db);
  db.prepare(`
    INSERT INTO sync_checkpoint_candidates (batch_id, source, cursor_value, tie_breaker)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(batch_id) DO UPDATE SET
      source=excluded.source,
      cursor_value=excluded.cursor_value,
      tie_breaker=excluded.tie_breaker
  `).run(candidate.batchId, candidate.source, candidate.cursorValue, candidate.tieBreaker ?? null);
}

export function commitCheckpointForBatch(db: DatabaseSync, batchId: string): boolean {
  initializeCheckpointSchema(db);
  const candidate = db.prepare(`
    SELECT source, cursor_value, tie_breaker FROM sync_checkpoint_candidates WHERE batch_id=?
  `).get(batchId) as { source: string; cursor_value: string; tie_breaker: string | null } | undefined;
  if (!candidate) return false;
  const current = getCheckpoint(db, candidate.source);
  let isNewer = false;
  if (!current?.cursor_value) {
    isNewer = true;
  } else if ((candidate.source === 'bi' || candidate.source === 'retornos' || candidate.source === 'impressoes') && !isNaN(Number(candidate.cursor_value)) && !isNaN(Number(current.cursor_value))) {
    const candP = Number(candidate.cursor_value);
    const currP = Number(current.cursor_value);
    const candS = Number(candidate.tie_breaker ?? 0);
    const currS = Number(current.secondary_cursor ?? 0);
    isNewer = candP > currP || (candP === currP && candS > currS);
  } else {
    isNewer = candidate.cursor_value > current.cursor_value
      || (candidate.cursor_value === current.cursor_value
        && (candidate.tie_breaker ?? '') > (current.secondary_cursor ?? ''));
  }

  if (!isNewer) {
    db.prepare(`DELETE FROM sync_checkpoint_candidates WHERE batch_id=?`).run(batchId);
    return false;
  }
  db.prepare(`
    INSERT INTO sync_checkpoints (source, cursor_value, secondary_cursor, last_success_at, last_batch_id, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source) DO UPDATE SET
      cursor_value=excluded.cursor_value,
      secondary_cursor=excluded.secondary_cursor,
      last_success_at=CURRENT_TIMESTAMP,
      last_batch_id=excluded.last_batch_id,
      updated_at=CURRENT_TIMESTAMP
  `).run(candidate.source, candidate.cursor_value, candidate.tie_breaker, batchId);
  db.prepare(`DELETE FROM sync_checkpoint_candidates WHERE batch_id=?`).run(batchId);
  return true;
}

export function getCheckpoint(db: DatabaseSync, source: string): SyncCheckpoint | null {
  initializeCheckpointSchema(db);
  return (db.prepare(`SELECT * FROM sync_checkpoints WHERE source=?`).get(source) as SyncCheckpoint | undefined) ?? null;
}

export function markReconciliationSuccess(db: DatabaseSync, source: string, completedAt = new Date().toISOString()) {
  initializeCheckpointSchema(db);
  db.prepare(`
    INSERT INTO sync_checkpoints (source, last_reconciliation_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source) DO UPDATE SET
      last_reconciliation_at=excluded.last_reconciliation_at,
      updated_at=CURRENT_TIMESTAMP
  `).run(source, completedAt);
}

export function markCheckpointCheckSuccess(
  db: DatabaseSync,
  source: string,
  timestamp = new Date().toISOString()
) {
  initializeCheckpointSchema(db);
  db.prepare(`
    INSERT INTO sync_checkpoints (source, last_success_at, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source) DO UPDATE SET
      last_success_at=excluded.last_success_at,
      updated_at=CURRENT_TIMESTAMP
  `).run(source, timestamp);
}

export function overlapStart(cursorValue: string, overlapSeconds: number): string {
  return addSecondsToSqlDateTime2Local(cursorValue, -overlapSeconds);
}


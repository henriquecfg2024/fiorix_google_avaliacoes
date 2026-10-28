import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { commitCheckpointForBatch, getCheckpoint, initializeCheckpointSchema, overlapStart, stageCheckpointCandidate } from '../src/db/checkpoint.js';

describe('incremental checkpoints', () => {
  it('bootstraps without a checkpoint and advances only after confirmed batch success', () => {
    const db = new DatabaseSync(':memory:');
    initializeCheckpointSchema(db);
    expect(getCheckpoint(db, 'produtividade')).toBeNull();
    stageCheckpointCandidate(db, { batchId: 'batch-1', source: 'produtividade', cursorValue: '2026-09-01T12:00:00.000Z', tieBreaker: '10' });
    expect(getCheckpoint(db, 'produtividade')).toBeNull();
    expect(commitCheckpointForBatch(db, 'unknown')).toBe(false);
    expect(getCheckpoint(db, 'produtividade')).toBeNull();
    expect(commitCheckpointForBatch(db, 'batch-1')).toBe(true);
    expect(getCheckpoint(db, 'produtividade')).toMatchObject({
      cursor_value: '2026-09-01T12:00:00.000Z', secondary_cursor: '10', last_batch_id: 'batch-1',
    });
  });

  it('applies a configurable five-minute overlap without changing the stored checkpoint', () => {
    expect(overlapStart('2026-09-01T12:00:00.000', 300)).toBe('2026-09-01 11:55:00.000');
  });

  it('keeps checkpoints isolated by source', () => {
    const db = new DatabaseSync(':memory:');
    stageCheckpointCandidate(db, { batchId: 'bi-1', source: 'bi', cursorValue: '2026-09-01T10:00:00.000Z' });
    stageCheckpointCandidate(db, { batchId: 'metas-1', source: 'metas', cursorValue: '2026-09-01T11:00:00.000Z' });
    commitCheckpointForBatch(db, 'bi-1');
    expect(getCheckpoint(db, 'bi')).not.toBeNull();
    expect(getCheckpoint(db, 'metas')).toBeNull();
  });

  it('never rewinds a checkpoint when an older retry completes later', () => {
    const db = new DatabaseSync(':memory:');
    stageCheckpointCandidate(db, { batchId: 'newer', source: 'bi', cursorValue: '2026-09-01T12:00:00.000Z', tieBreaker: '20' });
    stageCheckpointCandidate(db, { batchId: 'older', source: 'bi', cursorValue: '2026-09-01T11:00:00.000Z', tieBreaker: '10' });
    expect(commitCheckpointForBatch(db, 'newer')).toBe(true);
    expect(commitCheckpointForBatch(db, 'older')).toBe(false);
    expect(getCheckpoint(db, 'bi')).toMatchObject({ cursor_value: '2026-09-01T12:00:00.000Z', last_batch_id: 'newer' });
  });

  it('migrates existing SQLite checkpoints without recreating the table', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE sync_checkpoints (source TEXT PRIMARY KEY, cursor_value TEXT, secondary_cursor TEXT, last_success_at TEXT, last_reconciliation_at TEXT, updated_at TEXT NOT NULL)`);
    db.exec(`INSERT INTO sync_checkpoints VALUES ('bi', '2026-09-01T10:00:00.000Z', '1', NULL, NULL, CURRENT_TIMESTAMP)`);
    initializeCheckpointSchema(db);
    expect(getCheckpoint(db, 'bi')).toMatchObject({ source: 'bi', last_batch_id: null });
  });

  it('does not replace last_batch_id for an equal or failed candidate', () => {
    const db = new DatabaseSync(':memory:');
    stageCheckpointCandidate(db, { batchId: 'confirmed', source: 'bi', cursorValue: '2026-09-01T12:00:00.000Z', tieBreaker: '20' });
    expect(commitCheckpointForBatch(db, 'confirmed')).toBe(true);
    stageCheckpointCandidate(db, { batchId: 'same-position', source: 'bi', cursorValue: '2026-09-01T12:00:00.000Z', tieBreaker: '20' });
    expect(commitCheckpointForBatch(db, 'same-position')).toBe(false);
    stageCheckpointCandidate(db, { batchId: 'failed', source: 'bi', cursorValue: '2026-09-01T13:00:00.000Z', tieBreaker: '30' });
    expect(getCheckpoint(db, 'bi')?.last_batch_id).toBe('confirmed');
  });
});

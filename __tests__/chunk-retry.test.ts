import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureChunkPlan, initializeChunkSchema, retryChunkedBatch, type StoredPayload } from '../src/services/chunkRetry.js';
import { getCheckpoint, stageCheckpointCandidate } from '../src/db/checkpoint.js';

const batchId = 'batch-original';
const payload: StoredPayload = {
  source: 'produtividade',
  batch_id: batchId,
  generated_at: new Date().toISOString(),
  records: Array.from({ length: 8067 }, (_, id) => ({ id })),
};

describe('immutable local chunk plan', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE sync_queue (id INTEGER PRIMARY KEY,source TEXT,batch_id TEXT UNIQUE,generated_at TEXT,payload TEXT,status TEXT DEFAULT 'pending',attempts INTEGER DEFAULT 0,last_error TEXT)`);
    db.prepare(`INSERT INTO sync_queue (id,source,batch_id,generated_at,payload) VALUES (1,?,?,?,?)`).run(payload.source, batchId, payload.generated_at, JSON.stringify(payload));
    initializeChunkSchema(db);
  });

  it('creates 8067 records as 17 immutable chunks of 500 and keeps the last 67', () => {
    const first = ensureChunkPlan(db, payload, 500);
    const second = ensureChunkPlan(db, payload, 1000);
    const chunks = db.prepare(`SELECT chunk_index,records_count FROM sync_queue_chunks WHERE batch_id=? ORDER BY chunk_index`).all(batchId) as Array<{ chunk_index: number; records_count: number }>;
    expect(first).toMatchObject({ chunk_count: 17, chunk_size: 500, total_records: 8067 });
    expect(second).toEqual(first);
    expect(chunks).toHaveLength(17);
    expect(chunks.slice(0, 16).every((chunk, index) => chunk.chunk_index === index && chunk.records_count === 500)).toBe(true);
    expect(chunks[16]).toEqual({ chunk_index: 16, records_count: 67 });
    expect(chunks.reduce((sum, chunk) => sum + chunk.records_count, 0)).toBe(8067);
  });

  it('preserves progress on chunk 8 failure and retries from the same chunk', async () => {
    const firstSent: number[] = [];
    const firstRun = await retryChunkedBatch(db, batchId, 500, vi.fn(async (chunk) => {
      const index = chunk.chunk_index!;
      firstSent.push(index);
      if (index === 7) throw new Error('chunk 8 failure');
      return { status: 200, alreadyProcessed: false, recordsReceived: null, batchStatus: 'partial' };
    }));
    expect(firstRun).toMatchObject({ completed: false, failedChunk: 7, chunksConfirmed: 7, batchId });
    expect(firstSent).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    const retrySent: number[] = [];
    const retry = await retryChunkedBatch(db, batchId, 1000, vi.fn(async (chunk) => {
      retrySent.push(chunk.chunk_index!);
      return { status: 200, alreadyProcessed: chunk.chunk_index === 7, recordsReceived: null, batchStatus: chunk.chunk_index === 16 ? 'completed' : 'partial' };
    }));
    expect(retrySent[0]).toBe(7);
    expect(retrySent).not.toContain(0);
    expect(retry).toMatchObject({ completed: true, chunkCount: 17, chunksConfirmed: 17, totalRecordsConfirmed: 8067, batchId });
    expect((db.prepare(`SELECT status FROM sync_queue WHERE batch_id=?`).get(batchId) as { status: string }).status).toBe('completed');
  });

  it('keeps legacy non-chunked batches compatible', () => {
    const small = { ...payload, batch_id: 'small', records: [{ id: 1 }] };
    expect(ensureChunkPlan(db, small, 500)).toMatchObject({ chunk_count: 1, chunk_size: 500, total_records: 1 });
  });

  it('preserves the reconciliation mode in every chunk', async () => {
    const reconciliation = { ...payload, sync_mode: 'reconciliation' as const };
    db.prepare(`UPDATE sync_queue SET payload=? WHERE batch_id=?`).run(JSON.stringify(reconciliation), batchId);
    const sentModes: Array<string | undefined> = [];
    await retryChunkedBatch(db, batchId, 500, vi.fn(async (chunk) => {
      sentModes.push(chunk.sync_mode);
      return { status: 200, alreadyProcessed: false, recordsReceived: null, batchStatus: 'partial' };
    }));
    expect(sentModes).toHaveLength(17);
    expect(sentModes.every((mode) => mode === 'reconciliation')).toBe(true);
  });

  it('does not import or call MSSQL during retry', async () => {
    const send = vi.fn(async () => ({ status: 200, alreadyProcessed: false, recordsReceived: 8067, batchStatus: 'completed' }));
    await retryChunkedBatch(db, batchId, 500, send);
    expect(send).toHaveBeenCalledTimes(17);
  });

  it('advances a staged checkpoint only after every chunk is confirmed', async () => {
    stageCheckpointCandidate(db, { batchId, source: 'produtividade', cursorValue: '2026-09-01T12:00:00.000Z' });
    let calls = 0;
    await retryChunkedBatch(db, batchId, 500, vi.fn(async (chunk) => {
      calls += 1;
      if (chunk.chunk_index === 8) throw new Error('partial');
      return { status: 200, alreadyProcessed: false, recordsReceived: null, batchStatus: 'partial' };
    }));
    expect(getCheckpoint(db, 'produtividade')).toBeNull();
    expect(calls).toBe(9);
    await retryChunkedBatch(db, batchId, 1000, vi.fn(async () => ({ status: 200, alreadyProcessed: false, recordsReceived: null, batchStatus: 'completed' })));
    expect(getCheckpoint(db, 'produtividade')?.cursor_value).toBe('2026-09-01T12:00:00.000Z');
  });
});

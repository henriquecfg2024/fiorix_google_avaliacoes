import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { SyncChunkPayload, SyncChunkResponse } from './api.js';
import { commitCheckpointForBatch } from '../db/checkpoint.js';

export type StoredPayload = {
  source: string;
  batch_id: string;
  generated_at: string;
  records: unknown[];
  sync_mode?: 'full' | 'incremental' | 'reconciliation';
};
export type ChunkPlan = { batch_id: string; chunk_count: number; chunk_size: number; total_records: number };
type ChunkRow = { chunk_index: number; chunk_count: number; records_count: number; record_start: number; record_end: number; records_hash: string; status: 'pending' | 'success' | 'error'; attempts: number };
export type RetryResult = { completed: boolean; batchId: string; chunkCount: number; chunksConfirmed: number; totalRecordsConfirmed: number; failedChunk: number | null; error: string | null };
type SendChunk = (payload: SyncChunkPayload) => Promise<SyncChunkResponse>;

const hashRecords = (records: unknown[]) => createHash('sha256').update(JSON.stringify(records)).digest('hex');

export function initializeChunkSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue_chunk_plans (
      batch_id TEXT PRIMARY KEY,
      chunk_count INTEGER NOT NULL,
      chunk_size INTEGER NOT NULL,
      total_records INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sync_queue_chunks (
      batch_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL,
      records_count INTEGER NOT NULL,
      record_start INTEGER,
      record_end INTEGER,
      records_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (batch_id, chunk_index)
    );
  `);
  const columns = new Set((db.prepare(`PRAGMA table_info(sync_queue_chunks)`).all() as Array<{ name: string }>).map((column) => column.name));
  if (!columns.has('record_start')) db.exec(`ALTER TABLE sync_queue_chunks ADD COLUMN record_start INTEGER`);
  if (!columns.has('record_end')) db.exec(`ALTER TABLE sync_queue_chunks ADD COLUMN record_end INTEGER`);
  if (!columns.has('records_hash')) db.exec(`ALTER TABLE sync_queue_chunks ADD COLUMN records_hash TEXT`);
}

function validatePlan(db: DatabaseSync, payload: StoredPayload, plan: ChunkPlan): ChunkPlan {
  const chunks = db.prepare(`SELECT chunk_index,chunk_count,records_count,record_start,record_end,records_hash,status,attempts FROM sync_queue_chunks WHERE batch_id=? ORDER BY chunk_index`).all(payload.batch_id) as ChunkRow[];
  if (plan.total_records !== payload.records.length || chunks.length !== plan.chunk_count) throw new Error('IMMUTABLE_CHUNK_PLAN_MISMATCH');
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const records = payload.records.slice(chunk.record_start, chunk.record_end);
    if (chunk.chunk_index !== index || chunk.chunk_count !== plan.chunk_count || chunk.records_count !== records.length || chunk.records_hash !== hashRecords(records)) throw new Error('IMMUTABLE_CHUNK_BOUNDARY_MISMATCH');
  }
  return plan;
}

export function ensureChunkPlan(db: DatabaseSync, payload: StoredPayload, requestedChunkSize: number): ChunkPlan {
  initializeChunkSchema(db);
  const existingPlan = db.prepare(`SELECT batch_id,chunk_count,chunk_size,total_records FROM sync_queue_chunk_plans WHERE batch_id=?`).get(payload.batch_id) as ChunkPlan | undefined;
  if (existingPlan) return validatePlan(db, payload, existingPlan);

  const existingChunks = db.prepare(`SELECT chunk_index,chunk_count,records_count,status,attempts FROM sync_queue_chunks WHERE batch_id=? ORDER BY chunk_index`).all(payload.batch_id) as Array<Pick<ChunkRow, 'chunk_index' | 'chunk_count' | 'records_count' | 'status' | 'attempts'>>;
  const chunkCount = existingChunks.length ? existingChunks[0].chunk_count : Math.ceil(payload.records.length / requestedChunkSize);
  const chunkSize = existingChunks.length ? Math.max(...existingChunks.map((chunk) => chunk.records_count)) : requestedChunkSize;

  db.exec('BEGIN TRANSACTION');
  try {
    if (!existingChunks.length) {
      const insert = db.prepare(`INSERT INTO sync_queue_chunks (batch_id,chunk_index,chunk_count,records_count,record_start,record_end,records_hash) VALUES (?,?,?,?,?,?,?)`);
      for (let index = 0; index < chunkCount; index += 1) {
        const start = index * requestedChunkSize;
        const end = Math.min(start + requestedChunkSize, payload.records.length);
        const records = payload.records.slice(start, end);
        insert.run(payload.batch_id, index, chunkCount, records.length, start, end, hashRecords(records));
      }
    } else {
      if (existingChunks.some((chunk, index) => chunk.chunk_index !== index || chunk.chunk_count !== chunkCount) || existingChunks.reduce((sum, chunk) => sum + chunk.records_count, 0) !== payload.records.length) throw new Error('LEGACY_CHUNK_PLAN_INVALID');
      const update = db.prepare(`UPDATE sync_queue_chunks SET record_start=?,record_end=?,records_hash=? WHERE batch_id=? AND chunk_index=?`);
      let start = 0;
      for (const chunk of existingChunks) {
        const end = start + chunk.records_count;
        update.run(start, end, hashRecords(payload.records.slice(start, end)), payload.batch_id, chunk.chunk_index);
        start = end;
      }
    }
    db.prepare(`INSERT INTO sync_queue_chunk_plans (batch_id,chunk_count,chunk_size,total_records) VALUES (?,?,?,?)`).run(payload.batch_id, chunkCount, chunkSize, payload.records.length);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return validatePlan(db, payload, { batch_id: payload.batch_id, chunk_count: chunkCount, chunk_size: chunkSize, total_records: payload.records.length });
}

export async function retryChunkedBatch(db: DatabaseSync, batchId: string, requestedChunkSize: number, sendChunk: SendChunk): Promise<RetryResult> {
  const row = db.prepare(`SELECT id,source,batch_id,payload FROM sync_queue WHERE batch_id=?`).get(batchId) as { id: number; source: string; batch_id: string; payload: string } | undefined;
  if (!row) throw new Error('QUEUE_BATCH_NOT_FOUND');
  const payload = JSON.parse(row.payload) as StoredPayload;
  if (row.source !== payload.source || payload.batch_id !== batchId || !Array.isArray(payload.records)) throw new Error('QUEUE_BATCH_IDENTITY_MISMATCH');
  const plan = ensureChunkPlan(db, payload, requestedChunkSize);
  const chunks = db.prepare(`SELECT chunk_index,chunk_count,records_count,record_start,record_end,records_hash,status,attempts FROM sync_queue_chunks WHERE batch_id=? ORDER BY chunk_index`).all(batchId) as ChunkRow[];

  for (const chunk of chunks) {
    if (chunk.status === 'success') continue;
    const records = payload.records.slice(chunk.record_start, chunk.record_end);
    if (hashRecords(records) !== chunk.records_hash) throw new Error('CHUNK_CONTENT_MISMATCH');
    try {
      await sendChunk({
        source: payload.source,
        batch_id: batchId,
        generated_at: payload.generated_at,
        records,
        chunk_index: chunk.chunk_index,
        chunk_count: plan.chunk_count,
        sync_mode: payload.sync_mode,
      });
      db.prepare(`UPDATE sync_queue_chunks SET status='success',attempts=attempts+1,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE batch_id=? AND chunk_index=?`).run(batchId, chunk.chunk_index);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CHUNK_SEND_FAILED';
      db.prepare(`UPDATE sync_queue_chunks SET status='error',attempts=attempts+1,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE batch_id=? AND chunk_index=?`).run(message.slice(0, 500), batchId, chunk.chunk_index);
      db.prepare(`UPDATE sync_queue SET status='error',attempts=attempts+1,last_error=? WHERE id=?`).run(message.slice(0, 500), row.id);
      const confirmed = db.prepare(`SELECT COUNT(*) AS count,COALESCE(SUM(records_count),0) AS records FROM sync_queue_chunks WHERE batch_id=? AND status='success'`).get(batchId) as { count: number; records: number };
      return { completed: false, batchId, chunkCount: plan.chunk_count, chunksConfirmed: confirmed.count, totalRecordsConfirmed: confirmed.records, failedChunk: chunk.chunk_index, error: message };
    }
  }
  const confirmed = db.prepare(`SELECT COUNT(*) AS count,COALESCE(SUM(records_count),0) AS records FROM sync_queue_chunks WHERE batch_id=? AND status='success'`).get(batchId) as { count: number; records: number };
  const completed = confirmed.count === plan.chunk_count && confirmed.records === plan.total_records;
  if (completed) {
    db.exec('BEGIN TRANSACTION');
    try {
      db.prepare(`UPDATE sync_queue SET status='completed',last_error=NULL WHERE id=?`).run(row.id);
      commitCheckpointForBatch(db, batchId);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return { completed, batchId, chunkCount: plan.chunk_count, chunksConfirmed: confirmed.count, totalRecordsConfirmed: confirmed.records, failedChunk: null, error: null };
}

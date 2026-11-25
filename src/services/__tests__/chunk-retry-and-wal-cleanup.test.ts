import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_MAX_CHUNK_BYTES,
  ensureChunkPlan,
  initializeChunkSchema,
  isPayloadTooLargeError,
  retryChunkedBatch,
  splitRemainingOversizedBatch,
  type StoredPayload,
} from '../chunkRetry.js';
import {
  getRecentQueueFailuresFromDb,
  initializeQueueFailureHistorySchema,
  markQueueFailureResolvedInDb,
  pruneSupersededFailedBatches,
  recordQueueFailureHistory,
} from '../../db/queue.js';
import { initializeCheckpointSchema, markReconciliationSuccess } from '../../db/checkpoint.js';

function createFullQueueDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      batch_id TEXT UNIQUE NOT NULL,
      generated_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sync_health (
      source TEXT PRIMARY KEY,
      last_success_at TEXT
    );
  `);
  initializeChunkSchema(db);
  initializeCheckpointSchema(db);
  initializeQueueFailureHistorySchema(db);
  return db;
}

describe('Chunk byte budgeting, 413 re-splitting, and superseded WAL cleanup', () => {
  it('1. ensureChunkPlan divide lote por orçamento de bytes mesmo com poucos registros', () => {
    const db = createFullQueueDb();
    const bigText = 'X'.repeat(450_000);
    const payload: StoredPayload = {
      source: 'reurb_regularizacoes',
      batch_id: 'batch-bytes-001',
      generated_at: '2026-11-25T15:00:00.000Z',
      records: Array.from({ length: 6 }, (_, i) => ({
        prenotacao: 1000 + i,
        matricula: 2000 + i,
        trecho: bigText,
      })),
    };

    db.prepare(
      `INSERT INTO sync_queue (source, batch_id, generated_at, payload, next_retry_at) VALUES (?, ?, ?, ?, ?)`
    ).run(payload.source, payload.batch_id, payload.generated_at, JSON.stringify(payload), payload.generated_at);

    // 6 registros * ~450 KB = ~2.7 MB > 1 MB budget -> deve gerar múltiplos chunks com <= 2 registros cada
    const plan = ensureChunkPlan(db, payload, 10, 1_000_000);
    const chunks = db
      .prepare(`SELECT chunk_index, records_count FROM sync_queue_chunks WHERE batch_id = ? ORDER BY chunk_index`)
      .all(payload.batch_id) as Array<{ chunk_index: number; records_count: number }>;

    expect(plan.total_records).toBe(6);
    expect(plan.chunk_count).toBeGreaterThan(1);
    expect(chunks.reduce((sum, c) => sum + c.records_count, 0)).toBe(6);
    expect(chunks.every((c) => c.records_count <= 2)).toBe(true);
    expect(DEFAULT_MAX_CHUNK_BYTES).toBe(2_500_000);

    db.close();
  });

  it('2. pruneSupersededFailedBatches remove lote REURB 413 superado por reconciliação ou snapshot posterior sem afetar lote recente', () => {
    const db = createFullQueueDb();
    const oldBatchId = 'b6ab35e4-378d-46a4-b918-c7b4b461bc26';
    const recentBatchId = 'recent-bi-error-999';

    // Lote legado REURB preso em HTTP 413 gerado em 23/11
    const oldPayload: StoredPayload = {
      source: 'reurb_regularizacoes',
      batch_id: oldBatchId,
      generated_at: '2026-11-23T13:06:46.506Z',
      records: [{ id: 1 }, { id: 2 }],
    };
    db.prepare(`
      INSERT INTO sync_queue (source, batch_id, generated_at, payload, status, attempts, next_retry_at, last_error)
      VALUES ('reurb_regularizacoes', ?, ?, ?, 'error', 642, ?, 'Request failed with status code 413')
    `).run(oldBatchId, oldPayload.generated_at, JSON.stringify(oldPayload), '2026-11-25T17:00:00.000Z');
    ensureChunkPlan(db, oldPayload, 1);
    recordQueueFailureHistory(db, {
      batchId: oldBatchId,
      source: 'reurb_regularizacoes',
      status: 'RETRYING',
      attempts: 642,
      errorMessage: 'Request failed with status code 413',
      failedAtIso: new Date().toISOString(),
    });

    // Lote BI mais novo que a última reconciliação (não deve ser removido)
    db.prepare(`
      INSERT INTO sync_queue (source, batch_id, generated_at, payload, status, attempts, next_retry_at, last_error)
      VALUES ('bi', ?, '2026-11-25T18:00:00.000Z', '{}', 'error', 2, '2026-11-25T18:05:00.000Z', 'HTTP 503')
    `).run(recentBatchId);

    // Registra reconciliação posterior da fonte REURB em 25/11
    markReconciliationSuccess(db, 'reurb_regularizacoes', '2026-11-25T17:07:20.734Z');

    const cleaned = pruneSupersededFailedBatches(db);
    expect(cleaned).toBe(1);

    const remainingQueue = db
      .prepare(`SELECT batch_id FROM sync_queue ORDER BY id`)
      .all() as Array<{ batch_id: string }>;
    expect(remainingQueue).toEqual([{ batch_id: recentBatchId }]);

    const remainingChunks = db
      .prepare(`SELECT COUNT(*) AS cnt FROM sync_queue_chunks WHERE batch_id = ?`)
      .get(oldBatchId) as { cnt: number };
    expect(remainingChunks.cnt).toBe(0);

    const history = getRecentQueueFailuresFromDb(db, 10);
    const oldHistory = history.find((h) => h.batchId === oldBatchId);
    expect(oldHistory?.status).toBe('RESOLVED');
    expect(oldHistory?.resolvedAt).not.toBeNull();

    // Também testa fallback via sync_health.last_success_at para fonte snapshot com HTTP 413
    const snapBatchId = 'snap-413-002';
    db.prepare(`
      INSERT INTO sync_queue (source, batch_id, generated_at, payload, status, attempts, next_retry_at, last_error)
      VALUES ('cartorio_virtual_certidoes', ?, '2026-11-24T10:00:00.000Z', '{}', 'error', 5, '2026-11-24T11:00:00.000Z', 'Request failed with status code 413')
    `).run(snapBatchId);
    db.prepare(`
      INSERT INTO sync_health (source, last_success_at) VALUES ('cartorio_virtual_certidoes', '2026-11-25T10:00:00.000Z')
    `).run();

    const cleanedSnapshot = pruneSupersededFailedBatches(db);
    expect(cleanedSnapshot).toBe(1);

    db.close();
  });

  it('3. retryChunkedBatch sinaliza 413 e splitRemainingOversizedBatch re-fatia registros não confirmados pela metade', async () => {
    const db = createFullQueueDb();
    const batchId = 'batch-413-split-001';
    const payload: StoredPayload = {
      source: 'reurb_regularizacoes',
      batch_id: batchId,
      generated_at: '2026-11-25T12:00:00.000Z',
      records: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, label: `R-${i + 1}` })),
      sync_mode: 'incremental',
    };
    db.prepare(`
      INSERT INTO sync_queue (source, batch_id, generated_at, payload, status, attempts, next_retry_at)
      VALUES (?, ?, ?, ?, 'pending', 0, ?)
    `).run(payload.source, batchId, payload.generated_at, JSON.stringify(payload), payload.generated_at);

    expect(isPayloadTooLargeError('Request failed with status code 413')).toBe(true);

    // Chunk 0 (2 regs) passa; Chunk 1 (2 regs) sofre HTTP 413
    const firstResult = await retryChunkedBatch(
      db,
      batchId,
      2,
      vi.fn(async (chunk) => {
        if (chunk.chunk_index === 1) {
          throw new Error('Request failed with status code 413');
        }
        return { status: 200, alreadyProcessed: false, recordsReceived: chunk.records.length, batchStatus: 'partial' };
      }),
    );

    expect(firstResult.completed).toBe(false);
    expect(firstResult.failedChunk).toBe(1);
    expect(firstResult.chunksConfirmed).toBe(1);
    expect(firstResult.error).toContain('CHUNK_PAYLOAD_TOO_LARGE');

    // Re-fatiar apenas os 4 registros restantes (chunk size cai de 2 para 1)
    const splitRes = splitRemainingOversizedBatch(db, batchId);
    markQueueFailureResolvedInDb(db, batchId);

    expect(splitRes.split).toBe(true);
    expect(splitRes.newBatchId).toBeTruthy();
    expect(splitRes.remainingRecords).toBe(4);
    expect(splitRes.newChunkSize).toBe(1);

    const oldRow = db.prepare(`SELECT id FROM sync_queue WHERE batch_id = ?`).get(batchId);
    expect(oldRow).toBeUndefined();

    // Novo lote deve ter 4 chunks de 1 registro e completar sem erros
    const sentRecords: number[] = [];
    const replayResult = await retryChunkedBatch(
      db,
      splitRes.newBatchId!,
      splitRes.newChunkSize,
      vi.fn(async (chunk) => {
        for (const r of chunk.records as Array<{ id: number }>) {
          sentRecords.push(r.id);
        }
        return { status: 200, alreadyProcessed: false, recordsReceived: chunk.records.length, batchStatus: 'completed' };
      }),
    );
    expect(replayResult.completed).toBe(true);
    expect(replayResult.chunkCount).toBe(4);
    expect(sentRecords).toEqual([3, 4, 5, 6]);

    // Caso chunk de 1 único registro estoure 413, retorna erro NON_RETRYABLE para quarentena
    const singleBatchId = 'batch-single-413';
    const singlePayload: StoredPayload = {
      source: 'reurb_regularizacoes',
      batch_id: singleBatchId,
      generated_at: '2026-11-25T13:00:00.000Z',
      records: [{ id: 99 }],
    };
    db.prepare(`
      INSERT INTO sync_queue (source, batch_id, generated_at, payload, status, attempts, next_retry_at)
      VALUES (?, ?, ?, ?, 'pending', 0, ?)
    `).run(singlePayload.source, singleBatchId, singlePayload.generated_at, JSON.stringify(singlePayload), singlePayload.generated_at);

    const singleRes = await retryChunkedBatch(
      db,
      singleBatchId,
      1,
      vi.fn(async () => {
        throw new Error('Request failed with status code 413');
      }),
    );
    expect(singleRes.completed).toBe(false);
    expect(singleRes.error).toContain('NON_RETRYABLE_PAYLOAD_TOO_LARGE');

    db.close();
  });
});

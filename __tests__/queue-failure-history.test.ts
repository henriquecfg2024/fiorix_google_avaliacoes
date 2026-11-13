import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  getRecentQueueFailuresFromDb,
  initializeQueueFailureHistorySchema,
  markQueueFailureResolvedInDb,
  pruneOrphanedQueueArtifacts,
  recordQueueFailureHistory,
} from '../src/db/queue.js';
import { initializeCheckpointSchema, stageCheckpointCandidate } from '../src/db/checkpoint.js';
import { initializeChunkSchema } from '../src/services/chunkRetry.js';

function createTestQueueDb(): DatabaseSync {
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

describe('SQLite WAL failure history & orphan cleanup', () => {
  it('1. Registra falhas em history, faz backfill de itens error pré-existentes e marca RESOLVED ao concluir', () => {
    const db = createTestQueueDb();

    // Simula lote falho pré-v2.6.12 ainda presente em sync_queue (status = error) sem entrada prévia no histórico
    db.prepare(`
      INSERT INTO sync_queue (source, batch_id, generated_at, payload, status, attempts, next_retry_at, last_error)
      VALUES (?, ?, ?, ?, 'error', 4, ?, ?)
    `).run(
      'bi',
      '711fa3f6-1111-4000-8000-000000000001',
      new Date().toISOString(),
      '{}',
      new Date().toISOString(),
      'PostgreSQL 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification',
    );

    // Registra diretamente outra falha via helper
    recordQueueFailureHistory(db, {
      batchId: 'c7dce446-2222-4000-8000-000000000002',
      source: 'bi',
      status: 'RETRYING',
      attempts: 2,
      errorMessage: 'HTTP 500 during unpack_live',
    });

    const beforeResolve = getRecentQueueFailuresFromDb(db, 10);
    expect(beforeResolve).toHaveLength(2);
    expect(beforeResolve.every((item) => item.status === 'RETRYING')).toBe(true);
    expect(beforeResolve.find((i) => i.batchId.startsWith('711fa3f6'))?.attempts).toBe(4);

    // Simula conclusão bem-sucedida após correção
    db.prepare(`UPDATE sync_queue SET status = 'completed' WHERE batch_id = ?`).run(
      '711fa3f6-1111-4000-8000-000000000001',
    );
    markQueueFailureResolvedInDb(db, '711fa3f6-1111-4000-8000-000000000001');

    const afterResolve = getRecentQueueFailuresFromDb(db, 10);
    const resolvedItem = afterResolve.find((i) => i.batchId.startsWith('711fa3f6'));
    const activeItem = afterResolve.find((i) => i.batchId.startsWith('c7dce446'));
    expect(resolvedItem?.status).toBe('RESOLVED');
    expect(resolvedItem?.resolvedAt).not.toBeNull();
    expect(activeItem?.status).toBe('RETRYING');
    // Ativos aparecem antes dos resolvidos
    expect(afterResolve[0]?.status).toBe('RETRYING');

    db.close();
  });

  it('2. Limpa staged checkpoints órfãos (>1h) preservando lotes ainda ativos na sync_queue', () => {
    const db = createTestQueueDb();

    // Lote ativo permanece na sync_queue
    db.prepare(`
      INSERT INTO sync_queue (source, batch_id, generated_at, payload, status, attempts, next_retry_at)
      VALUES ('bi', 'active-batch-001', ?, '{}', 'error', 3, ?)
    `).run(new Date().toISOString(), new Date().toISOString());

    stageCheckpointCandidate(db, {
      batchId: 'active-batch-001',
      source: 'bi',
      cursorValue: '650276',
    });
    stageCheckpointCandidate(db, {
      batchId: 'orphan-batch-999',
      source: 'bi',
      cursorValue: '650200',
    });

    // Envelhece ambos staged candidates para > 2 horas
    db.exec(`
      UPDATE sync_checkpoint_candidates
      SET created_at = datetime('now', '-2 hours');
    `);

    pruneOrphanedQueueArtifacts(db);

    const remaining = db
      .prepare(`SELECT batch_id FROM sync_checkpoint_candidates ORDER BY batch_id`)
      .all() as Array<{ batch_id: string }>;

    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.batch_id).toBe('active-batch-001');

    db.close();
  });
});


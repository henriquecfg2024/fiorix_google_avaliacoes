import { DatabaseSync } from 'node:sqlite';
import { logger } from '../utils/logger.js';
import { initializeChunkSchema } from '../services/chunkRetry.js';
import { commitCheckpointForBatch, initializeCheckpointSchema, stageCheckpointCandidate } from './checkpoint.js';

import { connectorEnv } from '../config/env.js';

export interface SyncBatch {
  id?: number;
  source: string;
  batch_id: string;
  generated_at: string;
  payload: string;
  status: 'pending' | 'sending' | 'error' | 'completed';
  attempts: number;
  next_retry_at: string;
  last_error?: string | null;
  created_at?: string;
}

export interface QueueFailureHistoryItem {
  batchId: string;
  source: string;
  status: 'RETRYING' | 'DEAD_LETTER' | 'RESOLVED';
  attempts: number;
  errorMessage: string;
  firstFailedAt: string;
  lastFailedAt: string;
  resolvedAt: string | null;
}

export function initializeQueueFailureHistorySchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue_failure_history (
      batch_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 1,
      error_message TEXT NOT NULL,
      first_failed_at TEXT NOT NULL,
      last_failed_at TEXT NOT NULL,
      resolved_at TEXT
    );
  `);
}

export function recordQueueFailureHistory(
  db: DatabaseSync,
  params: {
    batchId: string;
    source: string;
    status: 'RETRYING' | 'DEAD_LETTER';
    attempts: number;
    errorMessage: string;
    failedAtIso?: string;
  }
) {
  initializeQueueFailureHistorySchema(db);
  const nowIso = params.failedAtIso || new Date().toISOString();
  const safeMsg = String(params.errorMessage || 'Erro desconhecido').slice(0, 500);
  db.prepare(`
    INSERT INTO sync_queue_failure_history (
      batch_id, source, status, attempts, error_message, first_failed_at, last_failed_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(batch_id) DO UPDATE SET
      source = excluded.source,
      status = excluded.status,
      attempts = MAX(sync_queue_failure_history.attempts, excluded.attempts),
      error_message = excluded.error_message,
      last_failed_at = excluded.last_failed_at,
      resolved_at = NULL
  `).run(params.batchId, params.source, params.status, params.attempts, safeMsg, nowIso, nowIso);
}

export function markQueueFailureResolvedInDb(
  db: DatabaseSync,
  batchId: string,
  resolvedAtIso = new Date().toISOString()
) {
  initializeQueueFailureHistorySchema(db);
  db.prepare(`
    UPDATE sync_queue_failure_history
    SET status = 'RESOLVED', resolved_at = ?
    WHERE batch_id = ? AND status <> 'RESOLVED'
  `).run(resolvedAtIso, batchId);
}

export function pruneOrphanedQueueArtifacts(db: DatabaseSync) {
  initializeQueueFailureHistorySchema(db);
  initializeCheckpointSchema(db);
  const cutoff7dIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  db.exec(`
    DELETE FROM sync_queue WHERE status = 'completed';
    DELETE FROM sync_queue_chunks WHERE batch_id NOT IN (SELECT batch_id FROM sync_queue);
    DELETE FROM sync_queue_chunk_plans WHERE batch_id NOT IN (SELECT batch_id FROM sync_queue);
    DELETE FROM sync_checkpoint_candidates
    WHERE batch_id NOT IN (SELECT batch_id FROM sync_queue)
      AND created_at <= datetime('now', '-1 hour');
    DELETE FROM sync_record_hash_candidates
    WHERE batch_id NOT IN (SELECT batch_id FROM sync_queue)
      AND created_at <= datetime('now', '-1 hour');
  `);
  db.prepare(`
    DELETE FROM sync_queue_failure_history
    WHERE COALESCE(resolved_at, last_failed_at) < ?
  `).run(cutoff7dIso);
}

export function getRecentQueueFailuresFromDb(db: DatabaseSync, limit = 15): QueueFailureHistoryItem[] {
  try {
    initializeQueueFailureHistorySchema(db);
    // Backfill active failed/quarantined rows staged before v2.6.12 upgrade
    const activeRows = db.prepare(`
      SELECT batch_id, source, status, attempts, last_error, created_at
      FROM sync_queue
      WHERE status IN ('error', 'quarantined')
    `).all() as Array<{
      batch_id: string;
      source: string;
      status: string;
      attempts: number;
      last_error: string | null;
      created_at: string | null;
    }>;

    for (const row of activeRows) {
      recordQueueFailureHistory(db, {
        batchId: row.batch_id,
        source: row.source,
        status: row.status === 'quarantined' ? 'DEAD_LETTER' : 'RETRYING',
        attempts: Number(row.attempts || 1),
        errorMessage: row.last_error || 'Falha transitória aguardando retry WAL',
        failedAtIso: row.created_at && !Number.isNaN(Date.parse(row.created_at))
          ? new Date(row.created_at).toISOString()
          : new Date().toISOString(),
      });
    }

    const cutoff24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const rows = db.prepare(`
      SELECT batch_id, source, status, attempts, error_message, first_failed_at, last_failed_at, resolved_at
      FROM sync_queue_failure_history
      WHERE last_failed_at >= ? OR status IN ('RETRYING', 'DEAD_LETTER')
      ORDER BY
        CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END ASC,
        last_failed_at DESC
      LIMIT ?
    `).all(cutoff24hIso, limit) as Array<{
      batch_id: string;
      source: string;
      status: 'RETRYING' | 'DEAD_LETTER' | 'RESOLVED';
      attempts: number;
      error_message: string;
      first_failed_at: string;
      last_failed_at: string;
      resolved_at: string | null;
    }>;

    return rows.map((r) => ({
      batchId: r.batch_id,
      source: r.source,
      status: r.status,
      attempts: Number(r.attempts || 1),
      errorMessage: r.error_message,
      firstFailedAt: r.first_failed_at,
      lastFailedAt: r.last_failed_at,
      resolvedAt: r.resolved_at ?? null,
    }));
  } catch {
    return [];
  }
}

class QueueManager {
  private db: DatabaseSync;
  private lastPruneAtMs = 0;

  constructor() {
    const dbName = process.env.NODE_ENV === 'test' 
      ? ':memory:' 
      : (connectorEnv === 'production' ? 'queue_production.db' : 'queue.db');
    this.db = new DatabaseSync(dbName);
    this.init();
  }

  private init() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;

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
    initializeChunkSchema(this.db);
    initializeCheckpointSchema(this.db);
    initializeQueueFailureHistorySchema(this.db);

    // Prune legacy completed rows, orphaned chunk/checkpoint candidates, and expired failure logs.
    pruneOrphanedQueueArtifacts(this.db);
    this.lastPruneAtMs = Date.now();

    // If Windows terminates/restarts the service while a request is in flight,
    // that row remains as "sending" and would otherwise never be retried.
    const recovered = this.db.prepare(`
      UPDATE sync_queue
      SET status = 'pending', next_retry_at = ?
      WHERE status = 'sending'
    `).run(new Date().toISOString());
    if (Number(recovered.changes) > 0) {
      logger.warn(`QUEUE_RECOVERY: ${recovered.changes} batch(es) interrompidos retornaram para a fila.`);
    }

    logger.info('QueueManager: node:sqlite configurado e pronto.');
  }

  public getDb(): DatabaseSync {
    return this.db;
  }

  public enqueue(batch: Omit<SyncBatch, 'id' | 'status' | 'attempts' | 'next_retry_at'>) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_queue (source, batch_id, generated_at, payload, next_retry_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(batch_id) DO NOTHING
    `);
    
    const nextRetryAt = new Date().toISOString();
    
    stmt.run(
      batch.source,
      batch.batch_id,
      batch.generated_at,
      batch.payload,
      nextRetryAt
    );
    
    // We can't easily get changes from node:sqlite run() in early versions without .changes, but we log anyway.
    logger.info(`SYNC_QUEUED: Batch ${batch.batch_id} para a fonte ${batch.source}`);
  }

  public getPendingBatches(limit: number = 10): SyncBatch[] {
    if (Date.now() - this.lastPruneAtMs > 60 * 60 * 1000) {
      try {
        pruneOrphanedQueueArtifacts(this.db);
        this.lastPruneAtMs = Date.now();
      } catch {
        // Non-fatal periodic cleanup
      }
    }

    const now = new Date().toISOString();
    // Recover only batches whose in-flight lease (set by markSending) has expired.
    this.db.prepare(`
      UPDATE sync_queue
      SET status = 'pending', next_retry_at = ?
      WHERE status = 'sending' AND next_retry_at <= ?
    `).run(now, now);

    const stmt = this.db.prepare(`
      SELECT * FROM sync_queue 
      WHERE status IN ('pending', 'error') AND next_retry_at <= ?
      ORDER BY next_retry_at ASC
      LIMIT ?
    `);
    return stmt.all(now, limit) as SyncBatch[];
  }

  public getRecentFailures(limit = 15): QueueFailureHistoryItem[] {
    return getRecentQueueFailuresFromDb(this.db, limit);
  }

  public markSending(id: number) {
    const leaseExpiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    this.db.prepare(`UPDATE sync_queue SET status = 'sending', next_retry_at = ? WHERE id = ?`).run(leaseExpiresAt, id);
  }

  public markSuccess(id: number, source: string) {
    const batch = this.db.prepare(`SELECT batch_id FROM sync_queue WHERE id = ?`).get(id) as { batch_id: string } | undefined;
    const deleteStmt = this.db.prepare(`DELETE FROM sync_queue WHERE id = ?`);
    const deleteChunksStmt = this.db.prepare(`DELETE FROM sync_queue_chunks WHERE batch_id = ?`);
    const deleteChunkPlanStmt = this.db.prepare(`DELETE FROM sync_queue_chunk_plans WHERE batch_id = ?`);
    const updateHealth = this.db.prepare(`
      INSERT INTO sync_health (source, last_success_at) 
      VALUES (?, ?) 
      ON CONFLICT(source) DO UPDATE SET last_success_at = excluded.last_success_at
    `);
    
    // node:sqlite doesn't have a high-level transaction wrapper yet, we do it manually
    this.db.exec('BEGIN TRANSACTION;');
    try {
      if (batch) {
        commitCheckpointForBatch(this.db, batch.batch_id);
        deleteChunksStmt.run(batch.batch_id);
        deleteChunkPlanStmt.run(batch.batch_id);
        markQueueFailureResolvedInDb(this.db, batch.batch_id);
      }
      deleteStmt.run(id);
      updateHealth.run(source, new Date().toISOString());
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public stageCheckpoint(batchId: string, source: string, cursorValue: string, tieBreaker?: string | null) {
    stageCheckpointCandidate(this.db, { batchId, source, cursorValue, tieBreaker });
  }

  public markCompleted(id: number) {
    const batch = this.db.prepare(`SELECT batch_id FROM sync_queue WHERE id = ?`).get(id) as { batch_id: string } | undefined;
    this.db.prepare(`
      UPDATE sync_queue
      SET status = 'completed', last_error = NULL
      WHERE id = ?
    `).run(id);
    if (batch) {
      markQueueFailureResolvedInDb(this.db, batch.batch_id);
    }
  }

  public markError(id: number, attempts: number, errorMessage: string) {
    const row = this.db.prepare(`SELECT batch_id, source FROM sync_queue WHERE id = ?`).get(id) as
      | { batch_id: string; source: string }
      | undefined;
    const newAttempts = attempts + 1;
    let delayMs = 0;
    if (newAttempts === 1) delayMs = 10000;
    else if (newAttempts === 2) delayMs = 30000;
    else if (newAttempts === 3) delayMs = 60000;
    else delayMs = 300000;

    const nextRetry = new Date(Date.now() + delayMs).toISOString();

    const stmt = this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'error', 
          attempts = ?, 
          next_retry_at = ?, 
          last_error = ? 
      WHERE id = ?
    `);
    
    stmt.run(newAttempts, nextRetry, errorMessage, id);
    if (row) {
      recordQueueFailureHistory(this.db, {
        batchId: row.batch_id,
        source: row.source,
        status: 'RETRYING',
        attempts: newAttempts,
        errorMessage,
      });
    }
    logger.warn(`SYNC_RETRY: Batch (ID Interno ${id}) agendado para nova tentativa em ${nextRetry}. Erro: ${errorMessage}`);
  }

  public markQuarantined(id: number, errorMessage: string) {
    const row = this.db.prepare(`SELECT batch_id, source, attempts FROM sync_queue WHERE id = ?`).get(id) as
      | { batch_id: string; source: string; attempts: number }
      | undefined;
    const stmt = this.db.prepare(`
      UPDATE sync_queue 
      SET status = 'quarantined', 
          last_error = ?, 
          next_retry_at = '9999-12-31T23:59:59.999Z' 
      WHERE id = ?
    `);
    stmt.run(errorMessage, id);
    if (row) {
      recordQueueFailureHistory(this.db, {
        batchId: row.batch_id,
        source: row.source,
        status: 'DEAD_LETTER',
        attempts: Math.max(1, Number(row.attempts || 1)),
        errorMessage,
      });
    }
    logger.error(`SYNC_QUARANTINED: Batch (ID Interno ${id}) colocado em quarentena definitiva: ${errorMessage}`);
  }


  public recordCheckSuccess(source: string, timestamp = new Date().toISOString()) {
    this.db.prepare(`
      INSERT INTO sync_health (source, last_success_at) 
      VALUES (?, ?) 
      ON CONFLICT(source) DO UPDATE SET last_success_at = excluded.last_success_at
    `).run(source, timestamp);
  }

  public close() {
    this.db.close();
    logger.info('QueueManager: Conexão SQLite fechada.');
  }
}

export const queueManager = new QueueManager();

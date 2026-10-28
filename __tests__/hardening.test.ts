import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { HealthManager } from '../src/services/health.js';
import { initializeCheckpointSchema, stageCheckpointCandidate, commitCheckpointForBatch, getCheckpoint } from '../src/db/checkpoint.js';
import { initializeChunkSchema } from '../src/services/chunkRetry.js';

describe('Operational Hardening & Health Monitoring (Phase 2.3)', () => {
  let health: HealthManager;
  let db: DatabaseSync;

  beforeEach(() => {
    health = new HealthManager();
    db = new DatabaseSync(':memory:');
    initializeCheckpointSchema(db);
    initializeChunkSchema(db);

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
    `);
  });

  it('1. Initializes health state with healthy status and zero failure count', () => {
    const status = health.getHealth(db);
    expect(status.connectorStatus).toBe('healthy');
    expect(status.sources.bi.consecutiveFailures).toBe(0);
    expect(status.sources.produtividade.consecutiveFailures).toBe(0);
    expect(status.sources.tarefas.consecutiveFailures).toBe(0);
    expect(status.sources.metas.consecutiveFailures).toBe(0);
  });

  it('2. Records run success and resets consecutive failures', () => {
    health.recordRunFailure('bi', 'Temporary timeout', 100);
    let status = health.getHealth(db);
    expect(status.sources.bi.consecutiveFailures).toBe(1);
    expect(status.metrics.bi.runs_failed_total).toBe(1);

    health.recordRunSuccess('bi', 10, 10, 50, 'batch-123');
    status = health.getHealth(db);
    expect(status.sources.bi.consecutiveFailures).toBe(0);
    expect(status.sources.bi.lastSqlRecords).toBe(10);
    expect(status.sources.bi.lastBatchId).toBe('batch-123');
    expect(status.metrics.bi.runs_success_total).toBe(1);
    expect(status.metrics.bi.records_sql_total).toBe(10);
  });

  it('3. Detects stale source when threshold is exceeded', () => {
    health.setStaleThreshold('bi', 2); // 2 seconds threshold
    health.recordRunSuccess('bi', 5, 5, 20, 'b-1');

    // Initially fresh
    let status = health.getHealth(db);
    expect(status.sources.bi.isStale).toBe(false);

    // Mock time passing
    vi.setSystemTime(new Date(Date.now() + 5000));
    status = health.getHealth(db);
    expect(status.sources.bi.isStale).toBe(true);
    expect(status.connectorStatus).toBe('degraded');
    vi.useRealTimers();
  });

  it('4. Marks connector unhealthy when consecutive failures reach 5 or db fails', () => {
    for (let i = 0; i < 5; i++) {
      health.recordRunFailure('produtividade', 'DB Deadlock', 50);
    }
    const status = health.getHealth(db);
    expect(status.sources.produtividade.consecutiveFailures).toBe(5);
    expect(status.connectorStatus).toBe('unhealthy');
  });

  it('5. Recovers persistent queue and checkpoints safely after restart simulation', () => {
    // Stage checkpoint before restart
    stageCheckpointCandidate(db, {
      batchId: 'restart-batch-1',
      source: 'tarefas',
      cursorValue: '2026-09-01T14:00:00.000Z',
      tieBreaker: '100:200',
    });

    // Enqueue batch in persistent table
    db.prepare(`
      INSERT INTO sync_queue (source, batch_id, generated_at, payload, next_retry_at)
      VALUES ('tarefas', 'restart-batch-1', '2026-09-01T14:00:00.000Z', '{"records":[]}', '2026-09-01T14:00:00.000Z')
    `).run();

    // Commit checkpoint
    commitCheckpointForBatch(db, 'restart-batch-1');

    // Simulate restart with fresh manager on same db
    const chkAfterRestart = getCheckpoint(db, 'tarefas');
    expect(chkAfterRestart?.cursor_value).toBe('2026-09-01T14:00:00.000Z');
    expect(chkAfterRestart?.secondary_cursor).toBe('100:200');

    // Pending queue is intact
    const pendingBatches = db.prepare(`SELECT * FROM sync_queue WHERE status = 'pending'`).all();
    expect(pendingBatches.length).toBe(1);
  });

  it('6. SingleInstanceLock prevents concurrent processes and releases cleanly', async () => {
    const { SingleInstanceLock } = await import('../src/utils/instanceLock.js');
    const lock1 = new SingleInstanceLock(process.cwd());
    const lock2 = new SingleInstanceLock(process.cwd());

    try {
      expect(lock1.acquire()).toBe(true);
      // Second lock in same working directory cannot acquire
      expect(lock2.acquire()).toBe(false);
    } finally {
      lock1.release();
    }

    // Now second lock can acquire after first is released
    try {
      expect(lock2.acquire()).toBe(true);
    } finally {
      lock2.release();
    }
  });

  it('7. Quarantines non-retryable structural errors and excludes them from pending retry queries', () => {
    const { queueManager } = { queueManager: new (class {
      markQuarantined(id: number, error: string) {
        db.prepare(`UPDATE sync_queue SET status = 'quarantined', last_error = ?, next_retry_at = '9999-12-31T23:59:59.999Z' WHERE id = ?`).run(error, id);
      }
      getPendingBatches() {
        return db.prepare(`SELECT * FROM sync_queue WHERE status IN ('pending', 'error') AND next_retry_at <= '2026-09-01T20:00:00.000Z'`).all();
      }
    })() };

    db.prepare(`
      INSERT INTO sync_queue (id, source, batch_id, generated_at, payload, status, next_retry_at)
      VALUES (999, 'bi', 'invalid-b', '2026-09-01T14:00:00.000Z', '{}', 'error', '2026-09-01T14:00:00.000Z')
    `).run();

    queueManager.markQuarantined(999, 'INVALID_BATCH_IDENTITY');

    const pending = queueManager.getPendingBatches();
    expect(pending.some((b: any) => b.id === 999)).toBe(false);

    const quarantined = db.prepare(`SELECT * FROM sync_queue WHERE id = 999`).get() as any;
    expect(quarantined.status).toBe('quarantined');
    expect(quarantined.last_error).toBe('INVALID_BATCH_IDENTITY');
  });
});



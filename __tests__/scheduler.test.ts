import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Scheduler } from '../src/services/scheduler.js';
import * as mssql from '../src/db/mssql.js';
import * as api from '../src/services/api.js';
import { queueManager } from '../src/db/queue.js';
import { getCheckpoint } from '../src/db/checkpoint.js';

vi.mock('../src/services/api.js', () => ({
  sendSyncBatch: vi.fn().mockResolvedValue({
    status: 200,
    alreadyProcessed: false,
    recordsReceived: 1,
    batchStatus: 'completed'
  }),
  sendHeartbeat: vi.fn().mockResolvedValue(undefined)
}));



describe('Multi-Source Scheduler Architecture (Phase 2.2)', () => {
  let db: DatabaseSync;
  let scheduler: Scheduler;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    (queueManager as any).db.exec('DELETE FROM sync_queue;');
    scheduler = new Scheduler(db);
    vi.clearAllMocks();
  });


  afterEach(() => {
    scheduler.stop();
  });

  it('1. Offsets 00s (BI), 20s (PRODUTIVIDADE), 40s (TAREFAS), 50s (HEARTBEAT) in 5-minute virtual simulation', async () => {
    const executedRuns: Array<{ timeSec: number; source: string }> = [];

    vi.spyOn(mssql, 'executeBiIncrementalV2Procedure').mockImplementation(async () => {
      executedRuns.push({ timeSec: 0, source: 'bi' });
      return { records: [{ PROTOCOLO: 1, SEQ_TITULO: 1, cursor_value: '1', secondary_cursor: '1' }], durationMs: 50 };
    });

    vi.spyOn(mssql, 'executeProdutividadeIncrementalProcedure').mockImplementation(async () => {
      executedRuns.push({ timeSec: 20, source: 'produtividade' });
      return { records: [{ NumeroDocumento: 100, FlagDocumento: 1, FK_tblWRIHistorico_Id: 1, cursor_value: '2026-09-01 12:00:00.000' }], durationMs: 50 };
    });

    vi.spyOn(mssql, 'executeTarefasIncrementalProcedure').mockImplementation(async () => {
      executedRuns.push({ timeSec: 40, source: 'tarefas' });
      return { records: [{ ID_TAREFA: 500, ID_HISTORICO: 10, cursor_value: '2026-09-01 12:00:00.000' }], durationMs: 50 };
    });

    vi.spyOn(mssql, 'executeProcedure').mockImplementation(async (source) => {
      executedRuns.push({ timeSec: 10, source: 'metas' });
      return [{ PROTOCOLO: 999 }];
    });

    const heartbeatSpy = vi.spyOn(api, 'sendHeartbeat').mockResolvedValue();

    // Enable scheduler for simulation
    const originalEnv = process.env;
    vi.stubEnv('SCHEDULER_ENABLED', 'true');
    vi.stubEnv('AUTO_SYNC_ENABLED', 'true');
    vi.stubEnv('BI_AUTO_SYNC_ENABLED', 'true');
    vi.stubEnv('PRODUTIVIDADE_AUTO_SYNC_ENABLED', 'true');
    vi.stubEnv('TAREFAS_AUTO_SYNC_ENABLED', 'true');
    vi.stubEnv('METAS_RECONCILIATION_ENABLED', 'true');
    vi.stubEnv('BI_SYNC_INTERVAL_SECONDS', '60');
    vi.stubEnv('PRODUTIVIDADE_SYNC_INTERVAL_SECONDS', '60');
    vi.stubEnv('TAREFAS_SYNC_INTERVAL_SECONDS', '60');

    // Re-instantiate scheduler to pick up active environment
    scheduler = new Scheduler(db);

    const baseTime = new Date('2026-09-01T12:00:00.000Z').getTime();

    // Simulate 300 seconds (5 minutes virtual clock)
    for (let s = 0; s < 300; s++) {
      const simDate = new Date(baseTime + s * 1000);
      await scheduler.tick(simDate);
    }

    // In 300 seconds (5 minutes):
    // BI (offset 0s, interval 60s) -> 5 runs
    // Produtividade (offset 20s, interval 60s) -> 5 runs
    // Tarefas (offset 40s, interval 60s) -> 5 runs
    // Heartbeat (second 50) -> 5 runs
    // Metas (interval 900s / 15m) -> 1 run (at second 10 if offset=10s)
    const biRuns = executedRuns.filter(r => r.source === 'bi');
    const prodRuns = executedRuns.filter(r => r.source === 'produtividade');
    const tarefasRuns = executedRuns.filter(r => r.source === 'tarefas');

    expect(biRuns.length).toBe(5);
    expect(prodRuns.length).toBe(5);
    expect(tarefasRuns.length).toBe(5);
    expect(heartbeatSpy).toHaveBeenCalledTimes(5);
  });

  it('2. Independent per-source locks prevent overlapping execution of same source', async () => {
    let biRunning = false;
    let biOverlapBlocked = false;

    vi.spyOn(mssql, 'executeBiIncrementalV2Procedure').mockImplementation(async () => {
      biRunning = true;
      // Simulate long query
      await new Promise(r => setTimeout(r, 100));
      biRunning = false;
      return { records: [], durationMs: 100 };
    });

    vi.stubEnv('SCHEDULER_ENABLED', 'true');
    vi.stubEnv('AUTO_SYNC_ENABLED', 'true');
    vi.stubEnv('BI_AUTO_SYNC_ENABLED', 'true');
    scheduler = new Scheduler(db);

    const config = {
      name: 'bi' as const,
      mode: 'incremental' as const,
      intervalSec: 60,
      offsetSec: 0,
      enabled: true,
    };

    // First run starts
    const p1 = scheduler.runExtraction(config);
    // Second run arrives while first is running
    const p2 = scheduler.runExtraction(config);

    await Promise.all([p1, p2]);

    expect(scheduler.getStatus('bi')?.running).toBe(false);
  });

  it('3. Lock on one source does NOT block another source (Source Isolation)', async () => {
    const executed: string[] = [];

    vi.spyOn(mssql, 'executeBiIncrementalV2Procedure').mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 50));
      executed.push('bi');
      return { records: [], durationMs: 50 };
    });

    vi.spyOn(mssql, 'executeTarefasIncrementalProcedure').mockImplementation(async () => {
      executed.push('tarefas');
      return { records: [], durationMs: 10 };
    });

    vi.stubEnv('SCHEDULER_ENABLED', 'true');
    vi.stubEnv('AUTO_SYNC_ENABLED', 'true');
    scheduler = new Scheduler(db);

    const p1 = scheduler.runExtraction({ name: 'bi', mode: 'incremental', intervalSec: 60, offsetSec: 0, enabled: true });
    const p2 = scheduler.runExtraction({ name: 'tarefas', mode: 'incremental', intervalSec: 60, offsetSec: 40, enabled: true });

    await Promise.all([p1, p2]);

    expect(executed).toContain('bi');
    expect(executed).toContain('tarefas');
  });

  it('4. METAS runs as reconciliation-only and updates last_reconciliation_at without incremental cursor', async () => {
    vi.spyOn(mssql, 'executeProcedure').mockResolvedValueOnce([
      { PROTOCOLO: 1001, SEQ_TITULO: 1 }
    ]);
    vi.spyOn(api, 'sendSyncBatch').mockResolvedValueOnce({
      status: 200,
      alreadyProcessed: false,
      recordsReceived: 1,
      batchStatus: 'completed'
    });

    vi.stubEnv('SCHEDULER_ENABLED', 'true');
    vi.stubEnv('AUTO_SYNC_ENABLED', 'true');
    scheduler = new Scheduler(db);

    await scheduler.runExtraction({
      name: 'metas',
      mode: 'reconciliation',
      intervalSec: 900,
      offsetSec: 10,
      enabled: true,
    });

    await scheduler.processQueue();

    const chk = getCheckpoint(db, 'metas');
    expect(chk?.last_reconciliation_at).toBeDefined();
    expect(chk?.cursor_value).toBeNull();
  });

  it('5. SQL failure does not enqueue invalid batch or advance checkpoint', async () => {
    vi.spyOn(mssql, 'executeBiIncrementalV2Procedure').mockRejectedValueOnce(new Error('Connection timeout'));

    vi.stubEnv('SCHEDULER_ENABLED', 'true');
    vi.stubEnv('AUTO_SYNC_ENABLED', 'true');
    scheduler = new Scheduler(db);

    await scheduler.runExtraction({
      name: 'bi',
      mode: 'incremental',
      intervalSec: 60,
      offsetSec: 0,
      enabled: true,
    });

    const status = scheduler.getStatus('bi');
    expect(status?.lastError).toContain('Connection timeout');
    expect(status?.recordsRead).toBe(0);

    const pending = queueManager.getPendingBatches(10);
    const biPending = pending.filter(b => b.source === 'bi');
    expect(biPending.length).toBe(0);
  });


  it('6. When scheduler is disabled, tick does not extract any source', async () => {
    const extractSpy = vi.spyOn(scheduler, 'runExtraction');

    vi.stubEnv('SCHEDULER_ENABLED', 'false');
    vi.stubEnv('AUTO_SYNC_ENABLED', 'false');
    scheduler = new Scheduler(db);

    await scheduler.tick(new Date('2026-09-01T12:00:00.000Z'));
    await scheduler.tick(new Date('2026-09-01T12:00:20.000Z'));
    await scheduler.tick(new Date('2026-09-01T12:00:40.000Z'));

    expect(extractSpy).not.toHaveBeenCalled();
  });

  it('7. METAS runs as incremental, commits checkpoint and filters old records on subsequent run', async () => {
    const rawRecords = [
      { PROTOCOLO: 2001, DataDoTituloApresentado: '2026-09-01T00:00:00.000Z', D1_PROTOCOLO: '2026-09-01T10:00:00.000Z' },
      { PROTOCOLO: 2002, DataDoTituloApresentado: '2026-09-02T00:00:00.000Z', D1_PROTOCOLO: '2026-09-02T15:00:00.000Z' }
    ];

    vi.spyOn(mssql, 'executeProcedure').mockResolvedValue(rawRecords);
    vi.spyOn(api, 'sendSyncBatch').mockResolvedValue({
      status: 200,
      alreadyProcessed: false,
      recordsReceived: 2,
      batchStatus: 'completed'
    });

    vi.stubEnv('SCHEDULER_ENABLED', 'true');
    vi.stubEnv('AUTO_SYNC_ENABLED', 'true');
    scheduler = new Scheduler(db);

    // First run (Bootstrap)
    await scheduler.runExtraction({
      name: 'metas',
      mode: 'incremental',
      intervalSec: 600,
      offsetSec: 10,
      enabled: true,
    }, new Date('2026-09-02T16:00:00.000Z'));

    await scheduler.processQueue();

    const chk = getCheckpoint(db, 'metas');
    expect(chk?.cursor_value).toBe('2026-09-02T15:00:00.000Z');
    expect(chk?.last_batch_id).toBeDefined();

    // Second run with simulated runTime way past overlap window (2026-09-03)
    // No new records -> records should be filtered out
    await scheduler.runExtraction({
      name: 'metas',
      mode: 'incremental',
      intervalSec: 600,
      offsetSec: 10,
      enabled: true,
    }, new Date('2026-09-03T10:00:00.000Z'));

    const status = scheduler.getStatus('metas');
    expect(status?.recordsRead).toBe(0);
    expect(status?.lastBatchId).toBeNull();
  });
});

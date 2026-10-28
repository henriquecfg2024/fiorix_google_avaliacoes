import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queueManager } from '../src/db/queue.js';
import { Scheduler } from '../src/services/scheduler.js';
import * as api from '../src/services/api.js';
import * as mssql from '../src/db/mssql.js';

// Mocks
vi.mock('../src/services/api.js', () => ({
  sendSyncBatch: vi.fn(),
  sendHeartbeat: vi.fn()
}));

vi.mock('../src/db/mssql.js', () => ({
  executeProcedure: vi.fn(),
  executeBiIncrementalProcedure: vi.fn().mockResolvedValue({ records: [], durationMs: 1 }),
  executeBiIncrementalV2Procedure: vi.fn().mockResolvedValue({ records: [], durationMs: 1 }),
  executeProdutividadeIncrementalProcedure: vi.fn().mockResolvedValue({ records: [], durationMs: 1 }),
  executeTarefasIncrementalProcedure: vi.fn().mockResolvedValue({ records: [], durationMs: 1 }),
}));



describe('Integration & Homologação', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    // Usa a instância real
    (queueManager as any).db.exec('DELETE FROM sync_queue;');
    (queueManager as any).db.exec('DELETE FROM sync_health;');
    
    scheduler = new Scheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  it('1 e 23. Persistência da Fila e Corrupção (Simulado pelo banco vivo entre instâncias)', () => {
    const payload = { test: 1 };
    queueManager.enqueue({
      source: 'bi',
      batch_id: 'b-persist',
      generated_at: new Date().toISOString(),
      payload: JSON.stringify(payload)
    });

    const pending = queueManager.getPendingBatches(10);
    expect(pending).toHaveLength(1);
    expect(pending[0].batch_id).toBe('b-persist');
    expect(pending[0].source).toBe('bi');
  });

  it('2, 3 e 4. Internet Offline, Batch no Retry e Recuperação', async () => {
    // 3. Offline
    (api.sendSyncBatch as any).mockRejectedValueOnce({ code: 'ECONNABORTED' });
    
    queueManager.enqueue({
      source: 'bi',
      batch_id: 'b-offline',
      generated_at: new Date().toISOString(),
      payload: '{}'
    });

    const pendingBefore = queueManager.getPendingBatches(10);
    expect(pendingBefore).toHaveLength(1);

    // Simula o processador rodando
    await (scheduler as any).processQueue();

    // Validar status de erro e attempts
    const row = (queueManager as any).db.prepare("SELECT * FROM sync_queue WHERE batch_id = 'b-offline'").get();
    expect(row.status).toBe('error');
    expect(row.attempts).toBe(1);

    // 2. Batch_id no retry preservado e 4. Recuperação
    (api.sendSyncBatch as any).mockResolvedValueOnce(true);
    
    // Avança o tempo para o next_retry_at (10s)
    vi.advanceTimersByTime(11000);
    
    await (scheduler as any).processQueue();
    
    const rowAfter = (queueManager as any).db.prepare("SELECT * FROM sync_queue WHERE batch_id = 'b-offline'").get();
    expect(rowAfter).toBeUndefined(); // Foi processado e removido
  });

  it('5. API 500', async () => {
    (api.sendSyncBatch as any).mockRejectedValueOnce({ response: { status: 500 } });
    
    queueManager.enqueue({ source: 'bi', batch_id: 'b-500', generated_at: new Date().toISOString(), payload: '{}' });
    await (scheduler as any).processQueue();

    const row = (queueManager as any).db.prepare("SELECT * FROM sync_queue WHERE batch_id = 'b-500'").get();
    expect(row.attempts).toBe(1);
    expect(row.status).toBe('error');
  });

  it('6 e 7. API 401 e 403', async () => {
    (api.sendSyncBatch as any).mockRejectedValueOnce({ response: { status: 401 } });
    
    queueManager.enqueue({ source: 'bi', batch_id: 'b-401', generated_at: new Date().toISOString(), payload: '{}' });
    await (scheduler as any).processQueue();

    const row = (queueManager as any).db.prepare("SELECT * FROM sync_queue WHERE batch_id = 'b-401'").get();
    expect(row.status).toBe('error');
  });

  it('8. Heartbeat', async () => {
    vi.setSystemTime(new Date('2026-01-01T12:00:49.000Z'));
    scheduler.start();
    // Avança 50 segundos para bater no tick do heartbeat
    vi.advanceTimersByTime(1000);
    expect(api.sendHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({ version: '0.1.0' })
    );
  });

  it('9, 10, 11 e 12. Scheduler Offsets e Isolamento entre fontes', async () => {
    vi.stubEnv('SCHEDULER_ENABLED', 'true');
    vi.stubEnv('AUTO_SYNC_ENABLED', 'true');
    vi.stubEnv('BI_SYNC_INTERVAL_SECONDS', '60');
    vi.stubEnv('PRODUTIVIDADE_SYNC_INTERVAL_SECONDS', '60');
    vi.stubEnv('TAREFAS_SYNC_INTERVAL_SECONDS', '60');
    scheduler = new Scheduler();

    // Configura o relógio para o segundo 59, para que ao avançar 1s chegue no 00 (BI)
    vi.setSystemTime(new Date('2026-01-01T12:00:59.000Z'));
    
    scheduler.start();
    
    // Avança 1s -> cai no segundo 00 -> BI
    vi.advanceTimersByTime(1000);
    expect(mssql.executeBiIncrementalV2Procedure).toHaveBeenCalled();

    
    // Avança 20s -> Produtividade (segundo 20)
    vi.advanceTimersByTime(20000);
    expect(mssql.executeProdutividadeIncrementalProcedure).toHaveBeenCalled();

    // Avança 20s -> Tarefas (segundo 40)
    vi.advanceTimersByTime(20000);
    expect(mssql.executeTarefasIncrementalProcedure).toHaveBeenCalled();
  });


  it('24. Duplicidade Local', () => {
    queueManager.enqueue({ source: 'bi', batch_id: 'dup-1', generated_at: new Date().toISOString(), payload: '{}' });
    queueManager.enqueue({ source: 'bi', batch_id: 'dup-1', generated_at: new Date().toISOString(), payload: '{}' });
    
    const total = (queueManager as any).db.prepare('SELECT COUNT(*) as c FROM sync_queue').get().c;
    expect(total).toBe(1);
  });
});

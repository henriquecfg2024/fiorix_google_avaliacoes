import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  countStoredRecordHashes,
  filterChangedRecordsByHash,
  stageRecordHashCandidates,
  commitCheckpointForBatch,
} from '../src/db/checkpoint.js';
import { Scheduler } from '../src/services/scheduler.js';
import * as certidoesReadonly from '../src/db/certidoes-readonly.js';
import * as api from '../src/services/api.js';
import { queueManager } from '../src/db/queue.js';

vi.mock('../src/services/api.js', () => ({
  sendSyncBatch: vi.fn().mockResolvedValue({
    status: 200,
    alreadyProcessed: false,
    recordsReceived: 2,
    batchStatus: 'completed',
  }),
  sendHeartbeat: vi.fn().mockResolvedValue(undefined),
  sendSrvsqlPerformanceSample: vi.fn().mockResolvedValue({ ok: true }),
  resetApiClient: vi.fn(),
}));

describe('Fase 0 — Delta Hash Filtering (cartorio_virtual_certidoes) & Queue Lease', () => {
  let db: DatabaseSync;
  let scheduler: Scheduler;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    queueManager.getDb().exec(`
      DELETE FROM sync_queue;
      DELETE FROM sync_queue_chunks;
      DELETE FROM sync_queue_chunk_plans;
      DELETE FROM sync_record_hashes;
      DELETE FROM sync_record_hash_candidates;
    `);
    scheduler = new Scheduler(db);
    vi.clearAllMocks();
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('computes deterministic SHA-256 delta hashes and commits only after batch confirmation', () => {
    const records = [
      { record_key: 'rk-1', numeroPedido: '1001', saldo: 0, itens: [{ seq: 1, mat: 123 }] },
      { record_key: 'rk-2', numeroPedido: '1002', saldo: 50, itens: [{ seq: 1, mat: 456 }] },
    ];

    const firstPass = filterChangedRecordsByHash(db, 'cartorio_virtual_certidoes', records);
    expect(firstPass.changedRecords).toHaveLength(2);
    expect(countStoredRecordHashes(db, 'cartorio_virtual_certidoes')).toBe(0);

    stageRecordHashCandidates(db, 'batch-cv-1', 'cartorio_virtual_certidoes', firstPass.candidateHashes);
    expect(countStoredRecordHashes(db, 'cartorio_virtual_certidoes')).toBe(0);

    commitCheckpointForBatch(db, 'batch-cv-1');
    expect(countStoredRecordHashes(db, 'cartorio_virtual_certidoes')).toBe(2);

    // Identical records (even with reordered keys) produce 0 delta rows
    const reordered = [
      { itens: [{ mat: 123, seq: 1 }], saldo: 0, numeroPedido: '1001', record_key: 'rk-1' },
      { itens: [{ mat: 456, seq: 1 }], saldo: 50, numeroPedido: '1002', record_key: 'rk-2' },
    ];
    const secondPass = filterChangedRecordsByHash(db, 'cartorio_virtual_certidoes', reordered);
    expect(secondPass.changedRecords).toHaveLength(0);

    // Modifying 1 record returns only that 1 changed record
    const modified = [
      reordered[0],
      { ...reordered[1], saldo: 0 },
    ];
    const thirdPass = filterChangedRecordsByHash(db, 'cartorio_virtual_certidoes', modified);
    expect(thirdPass.changedRecords).toHaveLength(1);
    expect(thirdPass.changedRecords[0].numeroPedido).toBe('1002');
  });

  it('skips re-sending 1,500 unchanged cartorio_virtual_certidoes rows on subsequent 5-minute runs', async () => {
    const sampleRows = [
      { numeroPedido: '1332611', protocoloExterno: null, totalCota: 76.54, itens: [], prenotacoesContraditorio: [] },
      { numeroPedido: '1332898', protocoloExterno: 'ONR-1', totalCota: 76.54, itens: [], prenotacoesContraditorio: [] },
    ];

    vi.spyOn(certidoesReadonly, 'extrairLoteCompletoCartorioVirtualReadOnly').mockResolvedValue({
      habilitado: true,
      sucesso: true,
      erroPermissaoSelect229: false,
      mensagemDiagnostico: 'OK',
      registros: sampleRows as any,
      duracaoMs: 40,
    });

    const config = {
      name: 'cartorio_virtual_certidoes' as const,
      mode: 'full' as const,
      intervalSec: 300,
      offsetSec: 25,
      enabled: true,
    };

    const t0 = new Date('2026-11-12T14:00:25.000Z');
    await scheduler.runExtraction(config, t0);
    await scheduler.processQueue();

    expect(api.sendSyncBatch).toHaveBeenCalledTimes(1);
    expect(countStoredRecordHashes(db, 'cartorio_virtual_certidoes')).toBe(2);

    // 5 minutes later with zero changes -> 0 batches sent!
    vi.clearAllMocks();
    const t5m = new Date('2026-11-12T14:05:25.000Z');
    await scheduler.runExtraction(config, t5m);
    await scheduler.processQueue();

    expect(api.sendSyncBatch).not.toHaveBeenCalled();
    expect(scheduler.getStatus('cartorio_virtual_certidoes')?.recordsRead).toBe(2);
    expect(scheduler.getStatus('cartorio_virtual_certidoes')?.lastBatchId).toBeNull();
  });
});


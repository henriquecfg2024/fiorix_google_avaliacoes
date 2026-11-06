import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Scheduler } from '../src/services/scheduler.js';
import * as mssql from '../src/db/mssql.js';
import { queueManager } from '../src/db/queue.js';
import { attachRecordKey } from '../src/services/recordKey.js';
import { healthManager } from '../src/services/health.js';

vi.mock('../src/services/api.js', () => ({
  sendSyncBatch: vi.fn().mockResolvedValue({
    status: 200,
    alreadyProcessed: false,
    recordsReceived: 1,
    batchStatus: 'completed',
  }),
  sendHeartbeat: vi.fn().mockResolvedValue(undefined),
  resetApiClient: vi.fn(),
}));

describe('Sincronização Colaboradores RH (GESTOR -> FIORIX)', () => {
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

  it('gera record_key determinístico a partir do Registro do GESTOR', () => {
    const rec = attachRecordKey('colaboradores_rh', {
      Registro: 127,
      Nome: 'Alisson Azevedo de Lima',
      DataNascimento: '2000-12-26',
    });
    expect(rec.record_key).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ignora ciclo sem degradar saúde do conector quando GESTOR ainda aguarda GRANT SELECT', async () => {
    vi.spyOn(mssql, 'executeColaboradoresRhQuery').mockResolvedValueOnce({
      records: [],
      durationMs: 12,
      skippedNoPermission: true,
    });

    await scheduler.runExtraction({
      name: 'colaboradores_rh',
      mode: 'full',
      intervalSec: 3600,
      offsetSec: 330,
      enabled: true,
    });

    const st = scheduler.getStatus('colaboradores_rh');
    expect(st?.lastError).toBeNull();
    expect(st?.recordsRead).toBe(0);
    expect(healthManager.getHealth(db, true).connectorStatus).toBe('healthy');
  });

  it('enfileira lote full de colaboradores_rh quando procedure retorna dados do GESTOR', async () => {
    vi.spyOn(mssql, 'executeColaboradoresRhQuery').mockResolvedValueOnce({
      records: [
        {
          Registro: 127,
          Nome: 'Alisson Azevedo de Lima',
          CPF: '503.588.298-52',
          DataNascimento: '2000-12-26',
          DataAdmissao: '2025-09-09',
          Sexo: 'Masculino',
          EstadoCivil: 'Solteiro',
          Naturalidade: 'São Paulo',
          UF: 'SP',
          Nacionalidade: 'Brasileiro',
          Ativo: true,
        },
      ],
      durationMs: 25,
    });

    await scheduler.runExtraction({
      name: 'colaboradores_rh',
      mode: 'full',
      intervalSec: 3600,
      offsetSec: 330,
      enabled: true,
    });

    const st = scheduler.getStatus('colaboradores_rh');
    expect(st?.recordsRead).toBe(1);
    expect(st?.lastError).toBeNull();
  });
});

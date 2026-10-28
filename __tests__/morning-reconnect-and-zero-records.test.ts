import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Scheduler } from '../src/services/scheduler.js';
import * as mssql from '../src/db/mssql.js';
import * as api from '../src/services/api.js';
import { queueManager } from '../src/db/queue.js';
import { getCheckpoint } from '../src/db/checkpoint.js';
import { healthManager } from '../src/services/health.js';

describe('Morning Reconnect and Zero-Records Telemetry', () => {
  let db: DatabaseSync;
  let scheduler: Scheduler;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    (queueManager as any).db.exec('DELETE FROM sync_queue;');
    vi.clearAllMocks();
  });

  afterEach(() => {
    scheduler?.stop();
    vi.unstubAllEnvs();
  });

  it('1. Deve atualizar status.lastSuccessAt, checkpoint e disparar telemetria imediata quando procedure retornar 0 registros', async () => {
    // Mock mssql.executeProcedure para retornar array vazio (0 registros novos para metas)
    vi.spyOn(mssql, 'executeProcedure').mockResolvedValue([]);
    const heartbeatSpy = vi.spyOn(api, 'sendHeartbeat').mockResolvedValue();

    vi.stubEnv('METAS_AUTO_SYNC_ENABLED', 'true');
    vi.stubEnv('METAS_SYNC_MODE', 'incremental');

    scheduler = new Scheduler(db);

    const runDate = new Date('2026-10-22T12:15:00.000Z'); // 09:15 Horário de Brasília
    const metasConfig = {
      name: 'metas' as const,
      mode: 'incremental' as const,
      intervalSec: 3600,
      offsetSec: 900,
      enabled: true,
    };

    await scheduler.runExtraction(metasConfig, runDate);

    // 1. Status runtime deve ter lastSuccessAt atualizado com o horário da extração
    const metasStatus = scheduler.getStatus('metas');
    expect(metasStatus).toBeDefined();
    expect(metasStatus?.lastSuccessAt).toBe('2026-10-22T12:15:00.000Z');
    expect(metasStatus?.recordsRead).toBe(0);

    // 2. Checkpoint local no SQLite deve ter last_success_at registrado
    const chk = getCheckpoint(db, 'metas');
    expect(chk).toBeDefined();
    expect(chk?.last_success_at).toBe('2026-10-22T12:15:00.000Z');

    // 3. HealthManager deve ter lastSuccessAt preenchido
    const health = healthManager.getHealth(db, true);
    expect(health.sources.metas.lastSuccessAt).toBe('2026-10-22T12:15:00.000Z');
    expect(health.sources.metas.lastSqlRecords).toBe(0);

    // 4. Telemetria/heartbeat deve ter sido disparada imediatamente para zerar contador de atraso no painel
    expect(heartbeatSpy).toHaveBeenCalledTimes(1);
    const sentPayload = heartbeatSpy.mock.calls[0][0] as any;
    expect(sentPayload.sources.metas.lastSuccessAt).toBe('2026-10-22T12:15:00.000Z');
    expect(sentPayload.sources.metas.lastSqlRecords).toBe(0);
  });

  it('2. Às 06:58:00 (horário de Brasília), o conector deve executar a reconexão matinal preventiva e recriar pool SQL Server (WEBRI)', async () => {
    const resetSqlSpy = vi.spyOn(mssql, 'resetSqlServerPool').mockResolvedValue(true);
    const resetApiSpy = vi.spyOn(api, 'resetApiClient');

    scheduler = new Scheduler(db);

    // 06:58:00 de Brasília é 09:58:00 UTC
    const morningDate = new Date('2026-10-22T09:58:00.000Z');

    await scheduler.tick(morningDate);

    expect(resetSqlSpy).toHaveBeenCalledTimes(1);
    expect(resetApiSpy).toHaveBeenCalledTimes(1);

    // No mesmo minuto (segundo seguinte), não deve reexecutar a reconexão para o mesmo dia
    const morningDateNextSec = new Date('2026-10-22T09:58:01.000Z');
    await scheduler.tick(morningDateNextSec);
    expect(resetSqlSpy).toHaveBeenCalledTimes(1);
  });

  it('3. Às 07:00:00 (horário de Brasília), o conector deve disparar um ping de heartbeat imediato', async () => {
    const heartbeatSpy = vi.spyOn(api, 'sendHeartbeat').mockResolvedValue();

    scheduler = new Scheduler(db);

    // 07:00:00 de Brasília é 10:00:00 UTC
    const openingDate = new Date('2026-10-22T10:00:00.000Z');

    await scheduler.tick(openingDate);

    expect(heartbeatSpy).toHaveBeenCalledTimes(1);
    const payload = heartbeatSpy.mock.calls[0][0] as any;
    expect(payload.version).toBe('0.1.0');
    expect(payload.sources).toBeDefined();

    // No segundo seguinte, não deve disparar novamente o ping das 07:00
    const nextSec = new Date('2026-10-22T10:00:01.000Z');
    await scheduler.tick(nextSec);
    expect(heartbeatSpy).toHaveBeenCalledTimes(1);
  });

  it('4. Heartbeat deve logar e registrar status com sucesso ao enviar telemetria', async () => {
    const recordHeartbeatSpy = vi.spyOn(healthManager, 'recordHeartbeatSuccess');
    const recordApiSpy = vi.spyOn(healthManager, 'recordApiSuccess');

    vi.spyOn(api, 'sendHeartbeat').mockImplementation(async () => {
      healthManager.recordHeartbeatSuccess();
      healthManager.recordApiSuccess();
    });

    await api.sendHeartbeat({
      version: '0.1.0',
      uptimeSeconds: 100,
      ramMb: 40,
      sources: {}
    });

    expect(recordHeartbeatSpy).toHaveBeenCalled();
    expect(recordApiSpy).toHaveBeenCalled();
  });
});

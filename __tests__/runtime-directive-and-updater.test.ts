import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  runtimeDirective,
  sanitizeRemoteConfig,
  advanceCheckpointsFromCloud,
  isCloudCursorNewer,
} from '../src/services/runtime-directive.js';
import {
  computeBufferSha256,
  verifyBundleChecksum,
  buildWindowsUpdatePowerShellScript,
  selfUpdater,
} from '../src/services/self-updater.js';
import { getCheckpoint, initializeCheckpointSchema } from '../src/db/checkpoint.js';
import { Scheduler } from '../src/services/scheduler.js';
import * as mssql from '../src/db/mssql.js';
import * as api from '../src/services/api.js';

describe('SaaS Runtime Directive, Hot-Standby & Self-Updater (v2.6.0)', () => {
  beforeEach(() => {
    runtimeDirective.resetForTests();
    vi.restoreAllMocks();
  });

  it('1. sanitizeRemoteConfig bloqueia qualquer chave de senha/segredo e preserva caminhos operacionais', () => {
    const cleaned = sanitizeRemoteConfig({
      role: 'PRIMARY',
      priority: 1,
      lanUrl: 'http://srvfiles:8765/',
      fileServerPort: 8765,
      sqlHost: 'SRVSQL',
      sqlDatabase: 'WEBRI',
      sqlPassword: 'NUNCA_SALVAR_SENHA',
      connectorSecret: 'SEGREDO_PROIBIDO',
      apiToken: 'TOKEN_PROIBIDO',
      documentRoots: [
        { id: 'minutas', path: '\\\\SRVFILES\\USUCAPIAO', label: 'Minutas' },
        { id: 'imagens', path: 'D:\\IMAGENS', label: 'Imagens' },
      ],
      syncIntervals: { bi: 60, metas: 900 },
    });

    expect((cleaned as any).sqlPassword).toBeUndefined();
    expect((cleaned as any).connectorSecret).toBeUndefined();
    expect((cleaned as any).apiToken).toBeUndefined();
    expect(cleaned.lanUrl).toBe('http://srvfiles:8765');
    expect(cleaned.sqlHost).toBe('SRVSQL');
    expect(cleaned.documentRoots).toHaveLength(2);
    expect(cleaned.syncIntervals?.bi).toBe(60);
  });

  it('2. Transição ACTIVE -> STANDBY -> PAUSED bloqueia extrações SQL mantendo heartbeats ativos', async () => {
    const db = new DatabaseSync(':memory:');
    vi.stubEnv('SCHEDULER_ENABLED', 'true');
    vi.stubEnv('AUTO_SYNC_ENABLED', 'true');
    vi.stubEnv('BI_AUTO_SYNC_ENABLED', 'true');
    vi.stubEnv('BI_SYNC_INTERVAL_SECONDS', '60');

    const biSpy = vi.spyOn(mssql, 'executeBiIncrementalV2Procedure').mockResolvedValue({
      records: [],
      durationMs: 12,
    });
    const hbSpy = vi.spyOn(api, 'sendHeartbeat').mockResolvedValue({ ok: true });

    const scheduler = new Scheduler(db);

    // Coloca o agente em STANDBY
    runtimeDirective.applyDirective(
      {
        operationalState: 'STANDBY',
        shouldRunSqlSync: false,
        shouldRunDocumentWorker: false,
        configVersion: 2,
      },
      db,
    );

    expect(runtimeDirective.getOperationalState()).toBe('STANDBY');
    expect(runtimeDirective.shouldRunSqlSync()).toBe(false);
    expect(runtimeDirective.shouldRunDocumentWorker()).toBe(false);

    // Simula segundo 00 (momento da extração de BI) e segundo 50 (heartbeat) dentro do expediente (12:00 UTC = 09:00 BRT)
    await scheduler.tick(new Date('2026-09-01T12:00:00.000Z'));
    await scheduler.tick(new Date('2026-09-01T12:00:50.000Z'));

    expect(biSpy).not.toHaveBeenCalled();
    expect(hbSpy).toHaveBeenCalledTimes(1);

    // Promove para ACTIVE e valida retomada imediata da extração SQL
    runtimeDirective.applyDirective(
      {
        operationalState: 'ACTIVE',
        shouldRunSqlSync: true,
        shouldRunDocumentWorker: true,
        configVersion: 3,
      },
      db,
    );

    await scheduler.tick(new Date('2026-09-01T12:01:00.000Z'));
    expect(biSpy).toHaveBeenCalledTimes(1);

    scheduler.stop();
  });

  it('3. advanceCheckpointsFromCloud avança cursores numéricos e datetime sem retroceder cursores locais mais novos', () => {
    const db = new DatabaseSync(':memory:');
    initializeCheckpointSchema(db);

    const advanced1 = advanceCheckpointsFromCloud(db, {
      bi: { cursorValue: '650100', secondaryCursor: '2', lastSuccessAt: '2026-11-04T12:00:00.000Z' },
      produtividade: { cursorValue: '2026-11-04 10:15:00.000', secondaryCursor: null },
    });
    expect(advanced1).toBe(2);
    expect(getCheckpoint(db, 'bi')?.cursor_value).toBe('650100');
    expect(getCheckpoint(db, 'produtividade')?.cursor_value).toBe('2026-11-04 10:15:00.000');

    // Cursor antigo vindo da nuvem NÃO deve sobrescrever cursor local mais recente
    const advanced2 = advanceCheckpointsFromCloud(db, {
      bi: { cursorValue: '649999', secondaryCursor: '9' },
      produtividade: { cursorValue: '2026-11-04 09:00:00.000' },
    });
    expect(advanced2).toBe(0);
    expect(getCheckpoint(db, 'bi')?.cursor_value).toBe('650100');
    expect(isCloudCursorNewer('bi', '650101', '1', '650100', '9')).toBe(true);
  });

  it('4. verifyBundleChecksum valida SHA-256 exato e rejeita pacote adulterado ou truncado', async () => {
    const validBundle = Buffer.alloc(4096, 'console.log("FIORIX Connector v2.7.0");\n');
    const validSha = computeBufferSha256(validBundle);

    expect(verifyBundleChecksum(validBundle, validSha)).toBe(true);
    expect(verifyBundleChecksum(validBundle, '0'.repeat(64))).toBe(false);
    expect(verifyBundleChecksum(Buffer.from('curto'), validSha)).toBe(false);

    // Simula tentativa de atualização com checksum inválido
    vi.spyOn(api, 'downloadReleaseBundle').mockResolvedValueOnce(validBundle);
    const appliedBad = await selfUpdater.handlePendingUpdate({
      version: 'v9.9.9-tampered',
      sha256: 'a'.repeat(64),
    });
    expect(appliedBad).toBe(false);
    expect(selfUpdater.getStatusSnapshot().status).toBe('FAILED');
  });

  it('5. buildWindowsUpdatePowerShellScript inclui backup para dist.rollback e restauração automática em falha', () => {
    const script = buildWindowsUpdatePowerShellScript({
      serviceName: 'FIORIXConnector',
      rootDir: 'C:\\Program Files\\FIORIX Connector',
      stagedBundlePath: 'C:\\Program Files\\FIORIX Connector\\dist\\index.js.new',
      activeBundlePath: 'C:\\Program Files\\FIORIX Connector\\dist\\index.js',
      rollbackBundlePath: 'C:\\Program Files\\FIORIX Connector\\dist.rollback\\index.js',
      statusFilePath: 'C:\\Program Files\\FIORIX Connector\\update-status.json',
      targetVersion: 'v2.7.0',
      previousVersion: 'v2.6.0',
    });

    expect(script).toContain('Stop-Service -Name $ServiceName');
    expect(script).toContain('Copy-Item -Path $ActiveFile -Destination $RollbackFile -Force');
    expect(script).toContain("Write-UpdateState 'ROLLED_BACK'");
    expect(script).toContain("Write-UpdateState 'SUCCEEDED'");
  });
});


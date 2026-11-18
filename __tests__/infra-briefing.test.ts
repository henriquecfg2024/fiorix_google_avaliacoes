import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runtimeDirective } from '../src/services/runtime-directive.js';
import { Scheduler } from '../src/services/scheduler.js';
import * as infraBriefing from '../src/services/infra-briefing-telemetry.js';
import * as api from '../src/services/api.js';

describe('Infra Briefing Telemetry Collector (v2.6.16)', () => {
  beforeEach(() => {
    runtimeDirective.resetForTests();
    vi.restoreAllMocks();
  });

  it('1. sanitizeBriefingErrorText mascara credenciais e limpa EncodedCommand PowerShell', () => {
    const cleaned = infraBriefing.sanitizeBriefingErrorText(
      new Error('Falha ao autenticar password=SuperSecret123; pwd=OutraSenha em 10.0.0.6'),
    );
    expect(cleaned).not.toContain('SuperSecret123');
    expect(cleaned).not.toContain('OutraSenha');
    expect(cleaned).toContain('password=[redacted]');
    expect(cleaned).toContain('pwd=[redacted]');

    const psErr = infraBriefing.sanitizeBriefingErrorText(
      new Error('Command failed: powershell.exe -NoProfile -NonInteractive -EncodedCommand JABfAGIA\nAccess denied'),
    );
    expect(psErr).not.toContain('JABfAGIA');
    expect(psErr).toContain('Access denied');
  });

  it('2. parseCandidatePorts normaliza lista de portas HTTP válidas com fallback seguro', () => {
    expect(infraBriefing.parseCandidatePorts('80, 443, 8080, 80, invalid, 70000')).toEqual([80, 443, 8080]);
    expect(infraBriefing.parseCandidatePorts('')).toEqual([80, 443, 8080, 3000, 5000, 8000]);
  });

  it('3. runtimeDirective.onForceInfraBriefing dispara apenas uma vez por requestedAt único', () => {
    const calls: string[] = [];
    const unsubscribe = runtimeDirective.onForceInfraBriefing((ts) => {
      calls.push(ts);
    });

    runtimeDirective.applyDirective({
      operationalState: 'ACTIVE',
      shouldRunSqlSync: true,
      shouldRunDocumentWorker: true,
      configVersion: 1,
      forceInfraBriefingAt: '2026-11-17T10:20:00.000Z',
    });
    runtimeDirective.applyDirective({
      operationalState: 'ACTIVE',
      shouldRunSqlSync: true,
      shouldRunDocumentWorker: true,
      configVersion: 1,
      forceInfraBriefingAt: '2026-11-17T10:20:00.000Z',
    });
    runtimeDirective.applyDirective({
      operationalState: 'ACTIVE',
      shouldRunSqlSync: true,
      shouldRunDocumentWorker: true,
      configVersion: 1,
      forceInfraBriefingAt: '2026-11-17T10:25:00.000Z',
    });

    unsubscribe();
    expect(calls).toEqual(['2026-11-17T10:20:00.000Z', '2026-11-17T10:25:00.000Z']);
  });

  it('4. collectAndSendInfraBriefing consolida os 3 servidores e respeita trigger MANUAL_REFRESH em STANDBY', async () => {
    const sentPayloads: any[] = [];
    const mockArgs = {
      sendSample: async (payload: Record<string, unknown>) => {
        sentPayloads.push(payload);
        return true;
      },
      collectSrvsql: async () => ({
        host: '10.0.0.25',
        sqlReachable: true,
        sqlLatencyMs: 8,
        sqlStartTimeIso: '2026-11-16T18:20:15',
        windowsBootTimeIso: '2026-11-13T18:19:51',
        osUptimeSeconds: 306000,
        vcpuCount: 10,
        cpuTotalPercent: 18,
        sqlCpuPercent: 12,
        totalRamMb: 73999,
        freeRamMb: 18000,
        usedRamPercent: 75.7,
        memoryStateDesc: 'Available physical memory is high',
        pleSeconds: 1462,
        bufferCacheHitRatioPercent: 99.98,
        userSessionsCount: 268,
        activeRequestsCount: 1,
        blockedRequestsCount: 0,
        zombieQueriesCount: 0,
        memoryGrantsPending: 0,
        iisReachable: true,
        iisLatencyMs: 4,
        w3wpPid: 13424,
        w3wpFirstConnIso: '2026-11-16T18:48:49',
        w3wpConnectionsCount: 12,
        w3wpWorkingSetMb: 320,
        perfIndexesCount: 6,
        perfIndexesSeeks: 303,
        openCdsTasksCount: 2424,
        nonOnlineDatabases: [],
        highLogBackupDatabases: [],
        volumes: [{ mountPoint: 'D:\\', label: 'Dados', totalGb: 500, freeGb: 210, freePercent: 42 }],
        services: [],
        error: null,
      }),
      collectSrvfiles: async () => ({
        host: 'SRVFILES',
        lanIp: '10.0.0.40',
        osUptimeSeconds: 604800,
        vcpuCount: 8,
        cpuPercent: 9,
        totalRamMb: 32768,
        freeRamMb: 21900,
        usedRamPercent: 33.2,
        volumes: [{ mountPoint: 'C:', label: 'SO', totalGb: 400, freeGb: 185, freePercent: 46.3 }],
        services: [],
        mysqlPortReachable: true,
        mysqlLatencyMs: 1,
        fileServerPort: 8765,
        fileServerReachable: true,
        fileServerLatencyMs: 2,
        connectorVersion: 'v2.6.16',
        connectorUptimeSeconds: 1200,
        connectorOperationalState: 'ACTIVE',
        queuePending: 0,
        queueFailed: 0,
        queueQuarantined: 0,
        cimAvailable: true,
        cimError: null,
      }),
      collectSrvsiplania: async () => ({
        host: '10.0.0.6',
        name: 'SRVSIPLANIA',
        webReachable: true,
        webPort: 80,
        webLatencyMs: 14,
        httpStatusCode: 200,
        postgresPort: 5432,
        postgresReachable: true,
        postgresLatencyMs: 3,
        cimAvailable: false,
        cimError: 'Firewall bloqueando WinRM/CIM em 10.0.0.6',
        osCaption: null,
        osUptimeSeconds: null,
        vcpuCount: null,
        cpuPercent: null,
        totalRamMb: null,
        freeRamMb: null,
        usedRamPercent: null,
        volumes: [],
        services: [],
      }),
    };

    // Em STANDBY, coleta periódica deve ser ignorada
    runtimeDirective.applyDirective({
      operationalState: 'STANDBY',
      shouldRunSqlSync: false,
      shouldRunDocumentWorker: false,
      configVersion: 2,
    });
    const skipped = await infraBriefing.collectAndSendInfraBriefing('PERIODIC', undefined, mockArgs);
    expect(skipped).toBe(false);
    expect(sentPayloads).toHaveLength(0);

    // MANUAL_REFRESH deve executar mesmo em STANDBY
    const forced = await infraBriefing.collectAndSendInfraBriefing('MANUAL_REFRESH', undefined, mockArgs);
    expect(forced).toBe(true);
    expect(sentPayloads).toHaveLength(1);
    expect(sentPayloads[0].trigger).toBe('MANUAL_REFRESH');
    expect(sentPayloads[0].srvsql.pleSeconds).toBe(1462);
    expect(sentPayloads[0].srvfiles.host).toBe('SRVFILES');
    expect(sentPayloads[0].srvsiplania.postgresReachable).toBe(true);
  });

  it('5. Scheduler.tick dispara Briefing Matinal oficial às 07:15:05 BRT apenas uma vez por dia útil', async () => {
    const db = new DatabaseSync(':memory:');
    const spy = vi.spyOn(infraBriefing, 'collectAndSendInfraBriefing').mockResolvedValue(true);
    vi.spyOn(api, 'sendHeartbeat').mockResolvedValue({ ok: true });

    const scheduler = new Scheduler(db);

    // 2026-11-17 07:15:05 BRT = 2026-11-17T10:15:05.000Z (terça-feira)
    await scheduler.tick(new Date('2026-11-17T10:15:05.000Z'));
    // Segundo disparo no mesmo minuto/dia deve ser deduplicado
    await scheduler.tick(new Date('2026-11-17T10:15:05.000Z'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('SCHEDULED_0715', db);

    scheduler.stop();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  evaluateInfraMorningBriefing,
  formatBriefingPlainTextSummary,
} from '@/lib/infra-briefing/engine';
import {
  consumePendingInfraBriefingDirective,
  ingestInfraBriefingSample,
  loadInfraBriefingDashboard,
  resetInfraBriefingMemoryForTests,
} from '@/lib/infra-briefing/store';
import type { RawInfraBriefingSample } from '@/lib/infra-briefing/types';

const mockRequireRole = vi.fn();
const mockAuthenticateConnector = vi.fn();

vi.mock('@/lib/auth-helpers', () => ({
  requireRole: (...roles: string[]) => mockRequireRole(...roles),
}));

vi.mock('@/lib/connectorAuth', () => ({
  authenticateConnector: (connectorId: string, secret: string) =>
    mockAuthenticateConnector(connectorId, secret),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  },
}));

function buildHealthySample(overrides?: Partial<RawInfraBriefingSample>): RawInfraBriefingSample {
  return {
    observedAt: '2026-11-17T10:15:05.000Z',
    trigger: 'SCHEDULED_0715',
    collectorVersion: 'v2.6.14',
    connectorHost: 'SRVFILES',
    collectionDurationMs: 420,
    srvsql: {
      host: '10.0.0.25',
      sqlReachable: true,
      sqlLatencyMs: 9,
      sqlStartTimeIso: '2026-11-16T18:20:15.000Z',
      windowsBootTimeIso: '2026-11-13T18:19:51.000Z',
      osUptimeSeconds: 309000,
      vcpuCount: 10,
      cpuTotalPercent: 18,
      sqlCpuPercent: 11,
      totalRamMb: 73999,
      freeRamMb: 18432,
      usedRamPercent: 75.1,
      memoryStateDesc: 'Available physical memory is high',
      pleSeconds: 1850,
      bufferCacheHitRatioPercent: 99.98,
      userSessionsCount: 280,
      activeRequestsCount: 1,
      blockedRequestsCount: 0,
      zombieQueriesCount: 0,
      memoryGrantsPending: 0,
      iisReachable: true,
      iisLatencyMs: 3,
      w3wpPid: 13424,
      w3wpFirstConnIso: '2026-11-17T07:00:00.000Z',
      w3wpConnectionsCount: 12,
      w3wpWorkingSetMb: 310,
      perfIndexesCount: 6,
      perfIndexesSeeks: 412,
      openCdsTasksCount: 2420,
      nonOnlineDatabases: [],
      highLogBackupDatabases: [],
      volumes: [
        { mountPoint: 'C:\\', label: 'SO', totalGb: 200, freeGb: 95, freePercent: 47.5 },
        { mountPoint: 'D:\\', label: 'SQL', totalGb: 1599.9, freeGb: 960.5, freePercent: 60 },
      ],
      services: [
        { serviceName: 'MSSQLSERVER', displayName: 'SQL Server', state: 'RUNNING', startMode: 'AUTO', pid: 4100 },
        { serviceName: 'W3SVC', displayName: 'IIS Web', state: 'RUNNING', startMode: 'AUTO', pid: 13424 },
      ],
      error: null,
    },
    srvfiles: {
      host: 'SRVFILES',
      lanIp: '10.0.0.40',
      osUptimeSeconds: 604800,
      vcpuCount: 8,
      cpuPercent: 11,
      totalRamMb: 32768,
      freeRamMb: 21504,
      usedRamPercent: 34.4,
      volumes: [
        { mountPoint: 'C:', label: 'Sistema', totalGb: 300, freeGb: 160, freePercent: 53.3 },
        { mountPoint: 'E:', label: 'Acervo', totalGb: 2000, freeGb: 850, freePercent: 42.5 },
      ],
      services: [
        { serviceName: 'MySQL80', displayName: 'MySQL', state: 'RUNNING', startMode: 'AUTO', pid: 2210 },
        { serviceName: 'FiorixConnector', displayName: 'FIORIX Connector', state: 'RUNNING', startMode: 'AUTO', pid: 5112 },
      ],
      mysqlPortReachable: true,
      mysqlLatencyMs: 1,
      fileServerPort: 8765,
      fileServerReachable: true,
      fileServerLatencyMs: 2,
      connectorVersion: 'v2.6.14',
      connectorUptimeSeconds: 1800,
      connectorOperationalState: 'ACTIVE',
      queuePending: 0,
      queueFailed: 0,
      queueQuarantined: 0,
      cimAvailable: true,
      cimError: null,
    },
    srvsiplania: {
      host: '10.0.0.6',
      name: 'SRVSIPLANIA',
      webReachable: true,
      webPort: 80,
      webLatencyMs: 12,
      httpStatusCode: 200,
      postgresPort: 5432,
      postgresReachable: true,
      postgresLatencyMs: 3,
      cimAvailable: true,
      cimError: null,
      osCaption: 'Microsoft Windows Server 2016 Standard',
      osUptimeSeconds: 432000,
      vcpuCount: 4,
      cpuPercent: 16,
      totalRamMb: 22528,
      freeRamMb: 12288,
      usedRamPercent: 45.5,
      volumes: [{ mountPoint: 'C:', label: 'SSD SiplanIA', totalGb: 300, freeGb: 175, freePercent: 58.3 }],
      services: [
        { serviceName: 'postgresql-x64-15', displayName: 'PostgreSQL', state: 'RUNNING', startMode: 'AUTO', pid: 3320 },
      ],
    },
    ...overrides,
  };
}

describe('Módulo Briefing Matinal da Infraestrutura (SRVSQL · SRVFILES · SRVSIPLANIA)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInfraBriefingMemoryForTests();
  });

  it('1. Sem amostras (sample === null): retorna AWAITING_TELEMETRY e NO_DATA sem simular verde nem zeros', () => {
    const briefing = evaluateInfraMorningBriefing({
      tenantId: 't-7ri',
      briefingDate: '2026-11-17',
      generatedAt: '2026-11-17T10:00:00.000Z',
      trigger: 'PERIODIC',
      sample: null,
    });

    expect(briefing.overallStatus).toBe('AWAITING_TELEMETRY');
    expect(briefing.srvsql.status).toBe('NO_DATA');
    expect(briefing.srvfiles.status).toBe('NO_DATA');
    expect(briefing.srvsiplania.status).toBe('NO_DATA');
    expect(briefing.srvsql.pleSeconds).toBeNull();
    expect(briefing.srvfiles.freeRamMb).toBeNull();
    expect(briefing.srvsiplania.webReachable).toBeNull();
    expect(briefing.highlights).toHaveLength(0);
  });

  it('2. Cenário HEALTHY completo: calcula deltas vs. dia anterior e gera resumo em texto limpo', () => {
    const yesterdaySample = buildHealthySample({
      observedAt: '2026-11-16T10:15:05.000Z',
    });
    yesterdaySample.srvsql!.pleSeconds = 1100;
    yesterdaySample.srvfiles!.volumes[1].freeGb = 855;

    const prevBriefing = evaluateInfraMorningBriefing({
      tenantId: 't-7ri',
      briefingDate: '2026-11-16',
      generatedAt: '2026-11-16T10:15:06.000Z',
      trigger: 'SCHEDULED_0715',
      sample: yesterdaySample,
    });

    const todayBriefing = evaluateInfraMorningBriefing({
      tenantId: 't-7ri',
      briefingDate: '2026-11-17',
      generatedAt: '2026-11-17T10:15:06.000Z',
      trigger: 'SCHEDULED_0715',
      sample: buildHealthySample(),
      previousBriefing: prevBriefing,
    });

    expect(todayBriefing.overallStatus).toBe('HEALTHY');
    expect(todayBriefing.isOfficial0715).toBe(true);
    expect(todayBriefing.comparedWithDate).toBe('2026-11-16');
    expect(todayBriefing.srvsql.pleDeltaVsPrev).toBe(750);
    expect(todayBriefing.srvfiles.volumes[1].deltaFreeGbVsPrev).toBe(-5);

    const txt = formatBriefingPlainTextSummary(todayBriefing);
    expect(txt).toContain('VERDE (Pronto para o Expediente)');
    expect(txt).toContain('SRVSQL (10.0.0.25)');
    expect(txt).toContain('SRVFILES (10.0.0.40)');
    expect(txt).toContain('SRVSIPLANIA (10.0.0.6)');
  });

  it('3. Detecta ATTENTION para w3wp.exe inchado / disco baixo e CRITICAL para bloqueio SQL ou queda no SRVSIPLANIA', () => {
    // Caso A: ATTENTION por w3wp.exe >= 750 MB e disco do SRVFILES em alerta (< 18%)
    const attentionSample = buildHealthySample();
    attentionSample.srvsql!.w3wpWorkingSetMb = 910;
    attentionSample.srvfiles!.volumes = [
      { mountPoint: 'E:', label: 'Acervo', totalGb: 1000, freeGb: 140, freePercent: 14 },
    ];

    const attBriefing = evaluateInfraMorningBriefing({
      tenantId: 't-7ri',
      briefingDate: '2026-11-17',
      generatedAt: '2026-11-17T10:15:06.000Z',
      trigger: 'SCHEDULED_0715',
      sample: attentionSample,
    });

    expect(attBriefing.overallStatus).toBe('ATTENTION');
    expect(attBriefing.srvsql.status).toBe('WARNING');
    expect(attBriefing.srvfiles.status).toBe('WARNING');
    expect(attBriefing.preventiveActions.some((a) => a.includes('iisreset'))).toBe(true);
    expect(attBriefing.preventiveActions.some((a) => a.includes('SRVFILES (E:)'))).toBe(true);

    // Caso B: CRITICAL por bloqueio SQL + quarentena no Connector + Portal/PostgreSQL offline
    const critSample = buildHealthySample();
    critSample.srvsql!.blockedRequestsCount = 3;
    critSample.srvfiles!.queueQuarantined = 2;
    critSample.srvsiplania!.webReachable = false;
    critSample.srvsiplania!.postgresReachable = false;

    const critBriefing = evaluateInfraMorningBriefing({
      tenantId: 't-7ri',
      briefingDate: '2026-11-17',
      generatedAt: '2026-11-17T10:15:06.000Z',
      trigger: 'MANUAL_REFRESH',
      sample: critSample,
    });

    expect(critBriefing.overallStatus).toBe('CRITICAL');
    expect(critBriefing.srvsql.status).toBe('CRITICAL');
    expect(critBriefing.srvfiles.status).toBe('CRITICAL');
    expect(critBriefing.srvsiplania.status).toBe('OFFLINE');
  });

  it('4. SRVSIPLANIA com cimAvailable: false e rede ativa permanece HEALTHY sem inventar CPU/RAM', () => {
    const sample = buildHealthySample();
    sample.srvsiplania = {
      host: '10.0.0.6',
      name: 'SRVSIPLANIA',
      webReachable: true,
      webPort: 80,
      webLatencyMs: 18,
      httpStatusCode: 200,
      postgresPort: 5432,
      postgresReachable: true,
      postgresLatencyMs: 4,
      cimAvailable: false,
      cimError: 'WinRM bloqueado pelo firewall em 10.0.0.6',
      osCaption: null,
      osUptimeSeconds: null,
      vcpuCount: null,
      cpuPercent: null,
      totalRamMb: null,
      freeRamMb: null,
      usedRamPercent: null,
      volumes: [],
      services: [],
    };

    const briefing = evaluateInfraMorningBriefing({
      tenantId: 't-7ri',
      briefingDate: '2026-11-17',
      generatedAt: '2026-11-17T10:15:06.000Z',
      trigger: 'SCHEDULED_0715',
      sample,
    });

    expect(briefing.srvsiplania.status).toBe('HEALTHY');
    expect(briefing.overallStatus).toBe('HEALTHY');
    expect(briefing.srvsiplania.cpuPercent).toBeNull();
    expect(briefing.srvsiplania.totalRamMb).toBeNull();
    expect(briefing.srvsiplania.headline).toContain('WMI/CIM Pendente');
    const cimCheck = briefing.checks.find((c) => c.id === 'srvsiplania-cim');
    expect(cimCheck?.status).toBe('NO_DATA');
  });

  it('5. Rotas API GET e POST validam M2M 401/200, RBAC 403/200, refresh_now e diretiva do Connector', async () => {
    const route = await import('@/app/api/v1/operacoes/briefing-matinal/route');

    // 5.1 Conector inválido -> 401
    mockAuthenticateConnector.mockResolvedValueOnce({ success: false });
    const badM2mReq = new NextRequest('https://fiorix.app/api/v1/operacoes/briefing-matinal', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        connectorId: 'conn-1',
        action: 'ingest_infra_briefing',
        sample: buildHealthySample(),
      }),
    });
    const badM2mRes = await route.POST(badM2mReq);
    expect(badM2mRes.status).toBe(401);

    // 5.2 Conector válido -> 200 e ingere amostra
    mockAuthenticateConnector.mockResolvedValueOnce({
      success: true,
      tenant: { id: 'tenant-7ri' },
      connector: { id: 'conn-1' },
    });
    const okM2mReq = new NextRequest('https://fiorix.app/api/v1/operacoes/briefing-matinal', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        connectorId: 'conn-1',
        action: 'ingest_infra_briefing',
        sample: buildHealthySample(),
      }),
    });
    const okM2mRes = await route.POST(okM2mReq);
    expect(okM2mRes.status).toBe(200);
    const okM2mJson = await okM2mRes.json();
    expect(okM2mJson.ok).toBe(true);

    // 5.3 Usuário sem papel -> 403 em GET
    mockRequireRole.mockRejectedValueOnce(new Error('Acesso negado: perfil insuficiente'));
    const denyGetReq = new NextRequest('https://fiorix.app/api/v1/operacoes/briefing-matinal');
    const denyGetRes = await route.GET(denyGetReq);
    expect(denyGetRes.status).toBe(403);

    // 5.4 Usuário ADMIN -> 200 no POST refresh_now ativa pendingConnectorRefresh e diretiva
    mockRequireRole.mockResolvedValueOnce({
      id: 'u-1',
      name: 'Henrique',
      role: 'ADMIN',
      tenantId: 'tenant-7ri',
    });
    const refreshReq = new NextRequest('https://fiorix.app/api/v1/operacoes/briefing-matinal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'refresh_now' }),
    });
    const refreshRes = await route.POST(refreshReq);
    expect(refreshRes.status).toBe(200);
    const refreshJson = await refreshRes.json();
    expect(refreshJson.pendingConnectorRefresh).toBe(true);
    expect(refreshJson.selectedBriefing.srvsql.pleSeconds).toBe(1850);

    const directiveIso = await consumePendingInfraBriefingDirective('tenant-7ri');
    expect(directiveIso).toBeTruthy();

    // 5.5 GET autenticado retorna snapshot com dados ingeridos
    mockRequireRole.mockResolvedValueOnce({
      id: 'u-1',
      name: 'Henrique',
      role: 'ADMIN',
      tenantId: 'tenant-7ri',
    });
    const getReq = new NextRequest('https://fiorix.app/api/v1/operacoes/briefing-matinal');
    const getRes = await route.GET(getReq);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.selectedBriefing.srvfiles.host).toBe('SRVFILES');
    expect(getJson.selectedBriefing.srvsiplania.postgresReachable).toBe(true);
  });

  it('6. Calibração: bancos auxiliares pequenos em LOG_BACKUP, SRVSIPLANIA sem HTTP na LAN e STARTUP do SRVFILES não geram falso Crítico nem congelam briefing', async () => {
    const calibratedSample = buildHealthySample({ trigger: 'STARTUP' });
    calibratedSample.srvsql!.highLogBackupDatabases = [
      { databaseName: 'SPCM_EPP', logUsedPercent: 75.3, logUsedMb: 54.2, logTotalMb: 72 },
      { databaseName: 'MR', logUsedPercent: 99, logUsedMb: 8.1, logTotalMb: 8.2 },
    ];
    calibratedSample.srvfiles!.cpuPercent = 70;
    calibratedSample.srvfiles!.connectorUptimeSeconds = 20;
    calibratedSample.srvsiplania!.webReachable = false;
    calibratedSample.srvsiplania!.webPort = null;
    calibratedSample.srvsiplania!.webLatencyMs = null;
    calibratedSample.srvsiplania!.httpStatusCode = null;
    calibratedSample.srvsiplania!.postgresReachable = true;
    calibratedSample.srvsiplania!.postgresLatencyMs = 92;

    const evaluated = evaluateInfraMorningBriefing({
      tenantId: 'tenant-calib',
      briefingDate: '2026-11-17',
      generatedAt: '2026-11-17T11:46:54.000Z',
      trigger: 'STARTUP',
      sample: calibratedSample,
    });

    expect(evaluated.overallStatus).toBe('HEALTHY');
    expect(evaluated.srvsql.status).toBe('HEALTHY');
    expect(evaluated.srvfiles.status).toBe('HEALTHY');
    expect(evaluated.srvsiplania.status).toBe('HEALTHY');
    expect(evaluated.checks.find((c) => c.id === 'srvsql-log-backup')?.status).toBe('OK');
    expect(evaluated.checks.find((c) => c.id === 'srvsiplania-web')?.status).toBe('NO_DATA');
    expect(evaluated.preventiveActions).toHaveLength(0);

    // STARTUP não congela o briefing consolidado do dia, e loadInfraBriefingDashboard expõe liveBriefing
    const ingestStartup = await ingestInfraBriefingSample('tenant-calib', calibratedSample);
    expect(ingestStartup.savedDailyBriefing).toBe(false);

    const dash = await loadInfraBriefingDashboard('tenant-calib');
    expect(dash.liveBriefing).toBeTruthy();
    expect(dash.liveBriefing?.overallStatus).toBe('HEALTHY');
    expect(dash.selectedBriefing.overallStatus).toBe('HEALTHY');

    // Banco WEBRI ou grande (>= 1 GB) em LOG_BACKUP continua gerando alerta real
    const webriLogSample = buildHealthySample();
    webriLogSample.srvsql!.highLogBackupDatabases = [
      { databaseName: 'WEBRI', logUsedPercent: 92, logUsedMb: 920, logTotalMb: 1000 },
    ];
    const webriEval = evaluateInfraMorningBriefing({
      tenantId: 'tenant-calib',
      briefingDate: '2026-11-17',
      generatedAt: '2026-11-17T12:00:00.000Z',
      trigger: 'PERIODIC',
      sample: webriLogSample,
    });
    expect(webriEval.srvsql.status).toBe('CRITICAL');
    expect(webriEval.overallStatus).toBe('CRITICAL');

    // Telemetria PostgreSQL 18 autenticada do SRVSIPLANIA (fiorix_reader) enriquece o check e acervo OCR
    const pgAuthedSample = buildHealthySample();
    pgAuthedSample.srvsiplania = {
      ...pgAuthedSample.srvsiplania!,
      postgresSqlAuthenticated: true,
      postgresSqlLatencyMs: 9,
      postgresVersion: 'PostgreSQL 18.7',
      postgresUptimeSeconds: 180000,
      postgresDbSizeMb: 18432,
      postgresCacheHitPercent: 96.5,
      postgresTotalConnections: 18,
      postgresActiveQueries: 1,
      postgresIdleInTxCount: 0,
      postgresWaitingLocks: 0,
      postgresLongQueries: 0,
      postgresDeadlocks: 0,
      postgresSharedBuffersMb: 128,
      postgresMatriculasCount: 268949,
      postgresPaginasOcrCount: 867185,
      postgresDistinctClients: 4,
      postgresSqlError: null,
    };
    const pgEval = evaluateInfraMorningBriefing({
      tenantId: 'tenant-pg-ia',
      briefingDate: '2026-11-18',
      generatedAt: '2026-11-18T11:30:00.000Z',
      trigger: 'PERIODIC',
      sample: pgAuthedSample,
    });
    expect(pgEval.srvsiplania.status).toBe('HEALTHY');
    expect(pgEval.srvsiplania.postgresSqlAuthenticated).toBe(true);
    expect(pgEval.srvsiplania.postgresMatriculasCount).toBe(268949);
    const pgCheck = pgEval.checks.find((c) => c.id === 'srvsiplania-postgres');
    const acervoCheck = pgEval.checks.find((c) => c.id === 'srvsiplania-acervo-ia');
    expect(pgCheck?.status).toBe('OK');
    expect(pgCheck?.currentValue).toContain('Cache 96.5%');
    expect(acervoCheck?.status).toBe('OK');
    expect(acervoCheck?.currentValue).toContain('268.949 matrículas');
    expect(acervoCheck?.recommendation).toContain('shared_buffers');

    // Contenção crítica (locks em espera) no PostgreSQL eleva severidade
    const pgLockSample = buildHealthySample();
    pgLockSample.srvsiplania = {
      ...pgAuthedSample.srvsiplania!,
      postgresWaitingLocks: 4,
    };
    const pgLockEval = evaluateInfraMorningBriefing({
      tenantId: 'tenant-pg-lock',
      briefingDate: '2026-11-18',
      generatedAt: '2026-11-18T11:35:00.000Z',
      trigger: 'PERIODIC',
      sample: pgLockSample,
    });
    expect(pgLockEval.srvsiplania.status).toBe('CRITICAL');
  });
});

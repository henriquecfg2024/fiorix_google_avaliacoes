import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  buildBlockingChains,
  buildProcessInstanceKey,
  buildSiplanIncidentReport,
  computeCollectorBackoffSeconds,
  computeFileIoLatencyDelta,
  computeWaitStatsDelta,
  DEFAULT_ALERT_RULES,
  evaluateAlertsWithHysteresis,
  evaluateMemoryPressureEvidence,
  evaluateWebriSessionAssociation,
  formatMetricOrMissing,
} from '@/lib/srvsql-performance/engine';
import {
  buildSrvsqlPerformanceSnapshot,
  ingestCollectorSample,
  pruneSamplesByRetention,
  recordCollectorFailure,
} from '@/lib/srvsql-performance/store';

const mockRequireRole = vi.fn();

vi.mock('@/lib/auth-helpers', () => ({
  requireRole: (...roles: string[]) => mockRequireRole(...roles),
}));

describe('Módulo Performance do SRVSQL — Validação Técnica (Seção 11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Falta de permissão VIEW SERVER STATE: explicita a limitação sem inventar dados ou zeros', () => {
    const snap = buildSrvsqlPerformanceSnapshot(
      'tenant-test-perms',
      'FALTA_PERMISSAO_VIEW_SERVER_STATE',
      '30m',
    );

    expect(snap.overallHealth).toBe('SEM_DADOS');
    expect(snap.dataSourceMode).toBe('PARTIAL_LIVE_NO_VIEW_SERVER_STATE');
    expect(snap.sqlMetadata.hasViewServerState).toBe(false);
    expect(snap.sqlMetadata.productVersion).toBe('11.0.7507.2');
    expect(snap.kpis.blockedSessionsCount).toBeNull();
    expect(snap.kpis.serverCpuPercent).toBeNull();
    expect(snap.coverageSources.find((c) => c.id === 'cov-sql-dmvs')?.status).toBe('SEM_PERMISSAO');
    expect(snap.diagnostics.some((d) => d.id === 'diag-missing-view-server-state')).toBe(true);
  });

  it('2. SQL e coletor indisponíveis: retorna COLETOR_INDISPONIVEL com métricas nulas (nunca zero nem verde)', () => {
    const snap = buildSrvsqlPerformanceSnapshot(
      'tenant-test-offline',
      'COLETOR_INDISPONIVEL',
      '30m',
    );

    expect(snap.overallHealth).toBe('COLETOR_INDISPONIVEL');
    expect(snap.collectorHealth.status).toBe('OFFLINE');
    expect(snap.kpis.serverCpuPercent).toBeNull();
    expect(snap.kpis.memoryUsedPercent).toBeNull();
    expect(snap.kpis.diskWriteLatencyMs).toBeNull();
    expect(snap.kpis.blockedSessionsCount).toBeNull();
    expect(snap.timeline.every((pt) => pt.cpuPercent === null)).toBe(true);
  });

  it('3. Reinicialização do SQL Server e reset de contadores: descarta deltas negativos e acumulados desde o boot', () => {
    // 3a. Mudança de sqlserver_start_time (reinicialização do serviço)
    const restartDelta = computeWaitStatsDelta({
      previousSample: [
        { waitType: 'LCK_M_X', waitingTasksCount: 500, waitTimeMs: 900000, maxWaitTimeMs: 50000, signalWaitTimeMs: 2000 },
      ],
      currentSample: [
        { waitType: 'LCK_M_X', waitingTasksCount: 10, waitTimeMs: 4000, maxWaitTimeMs: 1000, signalWaitTimeMs: 50 },
      ],
      previousSqlStartTime: '2026-10-28T06:12:04.000Z',
      currentSqlStartTime: '2026-11-11T14:10:00.000Z',
    });

    expect(restartDelta.counterResetDetected).toBe(true);
    expect(restartDelta.items).toHaveLength(0);
    expect(restartDelta.totalWaitDeltaMs).toBe(0);

    // 3b. Reset manual de contadores (delta negativo sem mudança de start_time)
    const negativeDelta = computeWaitStatsDelta({
      previousSample: [
        { waitType: 'WRITELOG', waitingTasksCount: 1000, waitTimeMs: 250000, maxWaitTimeMs: 500, signalWaitTimeMs: 3000 },
      ],
      currentSample: [
        { waitType: 'WRITELOG', waitingTasksCount: 12, waitTimeMs: 300, maxWaitTimeMs: 40, signalWaitTimeMs: 10 },
      ],
    });
    expect(negativeDelta.counterResetDetected).toBe(true);
    expect(negativeDelta.items).toHaveLength(0);

    // 3c. Reset em sys.dm_io_virtual_file_stats
    const fileReset = computeFileIoLatencyDelta({
      previousFiles: [
        {
          databaseId: 5,
          databaseName: 'WEBRI',
          fileId: 2,
          logicalName: 'WEBRI_Log',
          fileType: 'LOG',
          volumeMountPoint: 'L:\\',
          sampleMs: 500000,
          numOfReads: 100,
          numOfBytesRead: 819200,
          ioStallReadMs: 400,
          numOfWrites: 5000,
          numOfBytesWritten: 40960000,
          ioStallWriteMs: 25000,
        },
      ],
      currentFiles: [
        {
          databaseId: 5,
          databaseName: 'WEBRI',
          fileId: 2,
          logicalName: 'WEBRI_Log',
          fileType: 'LOG',
          volumeMountPoint: 'L:\\',
          sampleMs: 10000,
          numOfReads: 5,
          numOfBytesRead: 40960,
          ioStallReadMs: 10,
          numOfWrites: 20,
          numOfBytesWritten: 163840,
          ioStallWriteMs: 80,
        },
      ],
    });
    expect(fileReset.counterResetDetected).toBe(true);
    expect(fileReset.items[0]?.writeLatencyDeltaMs).toBeNull();
  });

  it('4. Cadeia de bloqueio: identifica bloqueador raiz ocioso (sleeping com open_transaction_count > 0) e bloqueios em cascata', () => {
    const snap = buildSrvsqlPerformanceSnapshot('tenant-test-block', 'LENTIDAO_BLOQUEIO', '30m');
    expect(snap.blockingChains).toHaveLength(1);

    const chain = snap.blockingChains[0]!;
    expect(chain.rootBlockerSessionId).toBe(72);
    expect(chain.isIdleInTransactionRootBlocker).toBe(true);
    expect(chain.totalBlockedSessions).toBe(7);
    expect(chain.maxBlockedWaitTimeMs).toBe(252000);

    // Verifica bloqueio indireto em cascata (sessão 91 bloqueada pela 88, que está bloqueada pela 72)
    const node91 = chain.nodes.find((n) => n.sessionId === 91);
    expect(node91?.blockingSessionId).toBe(88);
    expect(node91?.depth).toBe(2);
  });

  it('5. Timeout de coleta, backoff exponencial e auto-throttling quando orçamento é excedido', () => {
    expect(computeCollectorBackoffSeconds(0, 30)).toBe(30);
    expect(computeCollectorBackoffSeconds(1, 30)).toBe(30);
    expect(computeCollectorBackoffSeconds(2, 30)).toBe(60);
    expect(computeCollectorBackoffSeconds(3, 30)).toBe(120);
    expect(computeCollectorBackoffSeconds(10, 30)).toBe(600);

    const budgetAfterTimeout = recordCollectorFailure(
      'tenant-timeout-test',
      'RequestError: Timeout: Request failed to complete in 5000ms',
      true,
    );
    expect(budgetAfterTimeout.consecutiveFailures).toBe(1);
    expect(budgetAfterTimeout.autoThrottled).toBe(true);
  });

  it('6. Dados atrasados e histerese de alertas: dispara alerta de atraso, agrupa repetições e só resolve após histerese', () => {
    const firstPass = evaluateAlertsWithHysteresis({
      rules: DEFAULT_ALERT_RULES,
      existingAlerts: [],
      observedAtIso: '2026-11-11T17:30:00.000Z',
      metrics: {
        maxBlockedDurationSeconds: 60,
        blockedSessionsCount: 4,
        rootBlockerSessionId: 72,
        maxDiskWriteLatencyMs: 8,
        maxDiskReadLatencyMs: 6,
        provenMemoryPressureScore: 0,
        cpuPercent: 12,
        minVolumeFreePercent: 40,
        criticalServiceStoppedCount: 0,
        collectorDelaySeconds: 180,
      },
    });

    const activeBlockingAlert = firstPass.find((a) => a.ruleId === 'rule-blocking-duration' && a.active);
    const activeStaleAlert = firstPass.find((a) => a.ruleId === 'rule-collector-stale' && a.active);
    expect(activeBlockingAlert?.severity).toBe('CRITICAL');
    expect(activeBlockingAlert?.occurrencesCount).toBe(1);
    expect(activeStaleAlert?.severity).toBe('WARNING');

    // Repetição agrupa no mesmo alerta (occurrencesCount = 2) sem duplicar linhas
    const secondPass = evaluateAlertsWithHysteresis({
      rules: DEFAULT_ALERT_RULES,
      existingAlerts: firstPass,
      observedAtIso: '2026-11-11T17:30:30.000Z',
      metrics: {
        maxBlockedDurationSeconds: 75,
        blockedSessionsCount: 5,
        rootBlockerSessionId: 72,
        maxDiskWriteLatencyMs: 8,
        maxDiskReadLatencyMs: 6,
        provenMemoryPressureScore: 0,
        cpuPercent: 12,
        minVolumeFreePercent: 40,
        criticalServiceStoppedCount: 0,
        collectorDelaySeconds: 90, // abaixo de 120s mas ainda acima da histerese de recuperação (60s): permanece ativo!
      },
    });

    expect(secondPass.filter((a) => a.ruleId === 'rule-blocking-duration')).toHaveLength(1);
    expect(secondPass.find((a) => a.ruleId === 'rule-blocking-duration')?.occurrencesCount).toBe(2);
    expect(secondPass.find((a) => a.ruleId === 'rule-collector-stale')?.active).toBe(true);

    // Quando cai abaixo do limite de histerese (<= 5s para bloqueio e <= 60s para coletor), resolve
    const resolvedPass = evaluateAlertsWithHysteresis({
      rules: DEFAULT_ALERT_RULES,
      existingAlerts: secondPass,
      observedAtIso: '2026-11-11T17:31:00.000Z',
      metrics: {
        maxBlockedDurationSeconds: 0,
        blockedSessionsCount: 0,
        rootBlockerSessionId: null,
        maxDiskWriteLatencyMs: 5,
        maxDiskReadLatencyMs: 4,
        provenMemoryPressureScore: 0,
        cpuPercent: 8,
        minVolumeFreePercent: 40,
        criticalServiceStoppedCount: 0,
        collectorDelaySeconds: 15,
      },
    });

    expect(resolvedPass.find((a) => a.ruleId === 'rule-blocking-duration')?.active).toBe(false);
    expect(resolvedPass.find((a) => a.ruleId === 'rule-collector-stale')?.active).toBe(false);
  });

  it('7. Retenção e limite de armazenamento: remove amostras expiradas e limita quantidade máxima', () => {
    const baseSamples = Array.from({ length: 10 }, (_, idx) => ({
      observedAt: new Date(Date.parse('2026-11-11T17:00:00.000Z') + idx * 60000).toISOString(),
    })) as any[];

    const pruned = pruneSamplesByRetention(baseSamples, {
      retentionDays: 14,
      maxStoredSnapshots: 4,
      nowIso: '2026-11-11T17:15:00.000Z',
    });

    expect(pruned.kept).toHaveLength(4);
    expect(pruned.prunedCount).toBe(6);
    expect(pruned.kept[0].observedAt).toBe('2026-11-11T17:06:00.000Z');
  });

  it('8. Controle de acesso na rota /api/v1/operacoes/srvsql-performance: bloqueia usuários sem permissão com 403', async () => {
    mockRequireRole.mockRejectedValueOnce(new Error('Acesso negado: perfil insuficiente'));
    const { GET } = await import('@/app/api/v1/operacoes/srvsql-performance/route');

    const req = new NextRequest('http://localhost:3000/api/v1/operacoes/srvsql-performance');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('9. Diferença entre dado ausente (null -> "Sem dados") e valor zero (0 -> "0") + avaliação de memória e dossiê SIPLAN', () => {
    expect(formatMetricOrMissing(null, '%')).toBe('Sem dados');
    expect(formatMetricOrMissing(undefined, ' ms')).toBe('Sem dados');
    expect(formatMetricOrMissing(Number.NaN, '%')).toBe('Sem dados');
    expect(formatMetricOrMissing(0, '%')).toBe('0%');
    expect(formatMetricOrMissing(0, '')).toBe('0');

    // Não conclui falta de memória apenas porque o SQL Server usa 40 GB (79% da RAM)
    const normalBufferPool = evaluateMemoryPressureEvidence({
      windowsMemory: {
        totalPhysicalMb: 65536,
        availablePhysicalMb: 13762,
        usedPhysicalMb: 51774,
        usedPercent: 79,
        committedMb: 54100,
        commitLimitMb: 73728,
        commitPercent: 73.4,
        pagesPerSec: 4,
        pageInputsPerSec: 2,
        pageFaultsPerSec: 190,
        windowsMemoryPressure: 'NORMAL',
      },
      sqlMemory: {
        totalServerMemoryMb: 40960,
        targetServerMemoryMb: 40960,
        maxServerMemoryConfigMb: 40960,
        minServerMemoryConfigMb: 8192,
        sqlProcessWorkingSetMb: 41320,
        sqlProcessPrivateMb: 40960,
        pageLifeExpectancySec: 4820,
        bufferCacheHitRatioPercent: 99.7,
        memoryGrantsPending: 0,
        memoryGrantsActive: 2,
        grantedWorkspaceMemoryMb: 512,
        maxWorkspaceMemoryMb: 8192,
        processPhysicalMemoryLow: false,
        processVirtualMemoryLow: false,
      },
      waitStatsDelta: [],
    });
    expect(normalBufferPool.isMemoryPressureProven).toBe(false);
    expect(normalBufferPool.severity).toBe('NORMAL');

    // Chave de processo combina PID + horário de início
    expect(buildProcessInstanceKey(6120, '2026-11-04T08:02:19.000Z')).toBe(
      '6120:2026-11-04T08:02:19.000Z',
    );

    // Dossiê SIPLAN não vaza senhas nem connection strings
    const snap = buildSrvsqlPerformanceSnapshot('tenant-dossier', 'LENTIDAO_BLOQUEIO', '30m');
    const dossier = buildSiplanIncidentReport(snap);
    const serialized = JSON.stringify(dossier);
    expect(serialized).not.toContain('SQL_SERVER_PASSWORD');
    expect(serialized).not.toContain('CONNECTOR_SECRET');
    expect(dossier.blockingAndWaitsEvidence.blockingChains[0]?.rootBlockerSessionId).toBe(72);
  });

  it('10. Telemetria oficial do SRVSQL (LIVE_OR_REAL): reflete métricas reais coletadas no 10.0.0.25 com VIEW SERVER STATE ativo', () => {
    const liveSnap = buildSrvsqlPerformanceSnapshot('tenant-live-srvsql', 'LIVE_OR_REAL', '30m');

    expect(liveSnap.dataSourceMode).toBe('LIVE_COLLECTOR');
    expect(liveSnap.overallHealth).toBe('ATENCAO');
    expect(liveSnap.sqlMetadata.hasViewServerState).toBe(true);
    expect(liveSnap.sqlMetadata.serverName).toBe('SRVSQL');
    expect(liveSnap.sqlMetadata.productVersion).toBe('11.0.7507.2');
    expect(liveSnap.sqlMetadata.majorVersion).toBe(11);
    expect(liveSnap.windowsMemory.totalPhysicalMb).toBe(73999.6);
    expect(liveSnap.sqlMemory.maxServerMemoryConfigMb).toBe(40000);
    expect(liveSnap.sqlMemory.pageLifeExpectancySec).toBe(7789);
    expect(liveSnap.kpis.diskWriteLatencyMs).toBe(54);
    expect(liveSnap.kpis.blockedSessionsCount).toBe(0);
    expect(liveSnap.costlyQueries.length).toBeGreaterThanOrEqual(5);
  });
});

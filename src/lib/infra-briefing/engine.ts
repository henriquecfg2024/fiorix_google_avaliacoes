import type {
  InfraBriefingCheckItem,
  InfraBriefingTrigger,
  InfraBriefingVolumeEvaluated,
  InfraBriefingVolumeRaw,
  InfraMorningBriefingRecord,
  InfraOverallStatus,
  InfraServerStatus,
  RawInfraBriefingSample,
  SrvfilesBriefingSummary,
  SrvsiplaniaBriefingSummary,
  SrvsqlBriefingSummary,
} from './types';

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

export function getBrtDateString(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function getBrtClock(date: Date = new Date()): {
  dateStr: string;
  hour: number;
  minute: number;
  dayOfWeek: number;
} {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    const year = Number(get('year'));
    const month = Number(get('month'));
    const day = Number(get('day'));
    let hour = Number(get('hour'));
    if (hour === 24) hour = 0;
    const minute = Number(get('minute'));
    const d = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      dateStr: `${year}-${pad(month)}-${pad(day)}`,
      hour,
      minute,
      dayOfWeek: d.getUTCDay(),
    };
  } catch {
    return {
      dateStr: date.toISOString().slice(0, 10),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      dayOfWeek: date.getUTCDay(),
    };
  }
}

export function formatRamGb(mb: number | null): string {
  if (mb === null || !Number.isFinite(mb)) return 'Sem dados';
  return `${(mb / 1024).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
}

export function formatDurationCompact(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return 'Sem dados';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function elevateServerStatus(
  current: InfraServerStatus,
  next: InfraServerStatus,
): InfraServerStatus {
  const rank: Record<InfraServerStatus, number> = {
    NO_DATA: 0,
    HEALTHY: 1,
    WARNING: 2,
    CRITICAL: 3,
    OFFLINE: 4,
  };
  return rank[next] > rank[current] ? next : current;
}

function evaluateVolumesList(
  volumes: InfraBriefingVolumeRaw[],
  previousVolumes: InfraBriefingVolumeEvaluated[] | undefined,
  thresholds: { warnFreePct: number; critFreePct: number; critFreeGb: number },
): InfraBriefingVolumeEvaluated[] {
  const prevMap = new Map<string, InfraBriefingVolumeEvaluated>();
  for (const pv of previousVolumes || []) {
    prevMap.set(pv.mountPoint.toUpperCase(), pv);
  }

  return volumes.map((v) => {
    const prev = prevMap.get(v.mountPoint.toUpperCase());
    const deltaFreeGbVsPrev =
      v.freeGb !== null && prev && prev.freeGb !== null ? round2(v.freeGb - prev.freeGb) : null;

    let status: InfraBriefingVolumeEvaluated['status'] = 'NO_DATA';
    if (v.freeGb !== null && v.freePercent !== null) {
      if (v.freePercent < thresholds.critFreePct || v.freeGb < thresholds.critFreeGb) {
        status = 'CRITICAL';
      } else if (v.freePercent < thresholds.warnFreePct) {
        status = 'WARNING';
      } else {
        status = 'HEALTHY';
      }
    }

    return {
      ...v,
      status,
      deltaFreeGbVsPrev,
    };
  });
}

function createEmptySrvsql(host = '10.0.0.25'): SrvsqlBriefingSummary {
  return {
    status: 'NO_DATA',
    host,
    headline: 'Aguardando primeira coleta do SRVSQL',
    sqlReachable: null,
    sqlLatencyMs: null,
    iisReachable: null,
    iisLatencyMs: null,
    vcpuCount: null,
    cpuTotalPercent: null,
    sqlCpuPercent: null,
    totalRamMb: null,
    freeRamMb: null,
    usedRamPercent: null,
    memoryStateDesc: null,
    pleSeconds: null,
    pleDeltaVsPrev: null,
    bufferCacheHitRatioPercent: null,
    userSessionsCount: null,
    blockedRequestsCount: null,
    zombieQueriesCount: null,
    memoryGrantsPending: null,
    w3wpPid: null,
    w3wpWorkingSetMb: null,
    w3wpUptimeHours: null,
    w3wpConnectionsCount: null,
    perfIndexesCount: null,
    perfIndexesSeeks: null,
    openCdsTasksCount: null,
    nonOnlineDatabases: [],
    highLogBackupDatabases: [],
    volumes: [],
    services: [],
    sqlStartTimeIso: null,
    osUptimeSeconds: null,
    error: null,
  };
}

function createEmptySrvfiles(host = 'SRVFILES'): SrvfilesBriefingSummary {
  return {
    status: 'NO_DATA',
    host,
    lanIp: '10.0.0.40',
    headline: 'Aguardando telemetria local do SRVFILES (Connector v2.6.14+)',
    available: false,
    osUptimeSeconds: null,
    vcpuCount: null,
    cpuPercent: null,
    totalRamMb: null,
    freeRamMb: null,
    usedRamPercent: null,
    volumes: [],
    services: [],
    mysqlPortReachable: null,
    mysqlLatencyMs: null,
    fileServerPort: 8765,
    fileServerReachable: null,
    fileServerLatencyMs: null,
    connectorVersion: null,
    connectorUptimeSeconds: null,
    connectorOperationalState: null,
    queuePending: null,
    queueFailed: null,
    queueQuarantined: null,
    cimAvailable: false,
    cimError: null,
  };
}

function createEmptySrvsiplania(host = '10.0.0.6', name = 'SRVSIPLANIA'): SrvsiplaniaBriefingSummary {
  return {
    status: 'NO_DATA',
    host,
    name,
    headline: 'Aguardando sondagem de rede/SO do SRVSIPLANIA (Connector v2.6.14+)',
    available: false,
    networkHealthy: false,
    webReachable: null,
    webPort: null,
    webLatencyMs: null,
    httpStatusCode: null,
    postgresPort: 5432,
    postgresReachable: null,
    postgresLatencyMs: null,
    postgresSqlAuthenticated: null,
    postgresSqlLatencyMs: null,
    postgresVersion: null,
    postgresUptimeSeconds: null,
    postgresDbSizeMb: null,
    postgresCacheHitPercent: null,
    postgresTotalConnections: null,
    postgresActiveQueries: null,
    postgresIdleInTxCount: null,
    postgresWaitingLocks: null,
    postgresLongQueries: null,
    postgresDeadlocks: null,
    postgresSharedBuffersMb: null,
    postgresMatriculasCount: null,
    postgresPaginasOcrCount: null,
    postgresDistinctClients: null,
    postgresSqlError: null,
    cimAvailable: false,
    cimError: null,
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
}

function addDiskChecks(
  server: 'SRVSQL' | 'SRVFILES' | 'SRVSIPLANIA',
  volumes: InfraBriefingVolumeEvaluated[],
  prevVolumes: InfraBriefingVolumeEvaluated[] | undefined,
  checks: InfraBriefingCheckItem[],
  preventiveActions: string[],
): InfraServerStatus {
  let worst: InfraServerStatus = volumes.length > 0 ? 'HEALTHY' : 'NO_DATA';
  const prevMap = new Map((prevVolumes || []).map((pv) => [pv.mountPoint.toUpperCase(), pv]));

  for (const vol of volumes) {
    const prev = prevMap.get(vol.mountPoint.toUpperCase());
    const freeStr = vol.freeGb !== null ? `${vol.freeGb.toLocaleString('pt-BR')} GB livres (${vol.freePercent ?? '--'}%)` : 'Sem dados';
    const prevStr = prev && prev.freeGb !== null ? `${prev.freeGb.toLocaleString('pt-BR')} GB (${prev.freePercent ?? '--'}%)` : null;
    const deltaStr =
      vol.deltaFreeGbVsPrev !== null
        ? `${vol.deltaFreeGbVsPrev >= 0 ? '+' : ''}${vol.deltaFreeGbVsPrev.toLocaleString('pt-BR')} GB vs. ontem`
        : null;

    if (vol.status === 'CRITICAL') {
      worst = elevateServerStatus(worst, 'CRITICAL');
      const rec = `Espaço crítico em ${server} (${vol.mountPoint}): restam apenas ${freeStr}. Liberar espaço/arquivos antigos imediatamente.`;
      preventiveActions.push(rec);
      checks.push({
        id: `${server.toLowerCase()}-disk-${vol.mountPoint}`,
        server,
        category: 'Armazenamento',
        label: `Disco ${vol.mountPoint}${vol.label ? ` (${vol.label})` : ''}`,
        status: 'CRITICAL',
        currentValue: freeStr,
        previousValue: prevStr,
        deltaLabel: deltaStr,
        recommendation: rec,
      });
    } else if (vol.status === 'WARNING') {
      worst = elevateServerStatus(worst, 'WARNING');
      const rec = `Atenção preventiva em ${server} (${vol.mountPoint}): ${freeStr}. Planejar limpeza ou expansão.`;
      preventiveActions.push(rec);
      checks.push({
        id: `${server.toLowerCase()}-disk-${vol.mountPoint}`,
        server,
        category: 'Armazenamento',
        label: `Disco ${vol.mountPoint}${vol.label ? ` (${vol.label})` : ''}`,
        status: 'WARNING',
        currentValue: freeStr,
        previousValue: prevStr,
        deltaLabel: deltaStr,
        recommendation: rec,
      });
    } else if (vol.status === 'HEALTHY') {
      checks.push({
        id: `${server.toLowerCase()}-disk-${vol.mountPoint}`,
        server,
        category: 'Armazenamento',
        label: `Disco ${vol.mountPoint}${vol.label ? ` (${vol.label})` : ''}`,
        status: 'OK',
        currentValue: freeStr,
        previousValue: prevStr,
        deltaLabel: deltaStr,
        recommendation: null,
      });
    }
  }
  return worst;
}

export function evaluateInfraMorningBriefing(params: {
  id?: string;
  tenantId: string;
  briefingDate: string;
  generatedAt: string;
  trigger: InfraBriefingTrigger;
  sample: RawInfraBriefingSample | null;
  previousBriefing?: InfraMorningBriefingRecord | null;
}): InfraMorningBriefingRecord {
  const {
    id = `briefing-${params.tenantId}-${params.briefingDate}`,
    tenantId,
    briefingDate,
    generatedAt,
    trigger,
    sample,
    previousBriefing = null,
  } = params;

  const isOfficial0715 = trigger === 'SCHEDULED_0715';
  const comparedWithDate = previousBriefing ? previousBriefing.briefingDate : null;

  if (!sample) {
    return {
      id,
      tenantId,
      briefingDate,
      generatedAt,
      observedAt: null,
      trigger,
      isOfficial0715,
      overallStatus: 'AWAITING_TELEMETRY',
      executiveHeadline: 'Aguardando a primeira coleta automática do FIORIX Connector para os 3 servidores.',
      comparedWithDate,
      collectorVersion: null,
      connectorHost: null,
      highlights: [],
      preventiveActions: [
        'Aguardar o ciclo inicial do FIORIX Connector v2.6.14+ no SrvFiles ou clicar em "Atualizar Briefing Agora".',
      ],
      srvsql: createEmptySrvsql(),
      srvfiles: createEmptySrvfiles(),
      srvsiplania: createEmptySrvsiplania(),
      checks: [],
    };
  }

  const checks: InfraBriefingCheckItem[] = [];
  const highlights: string[] = [];
  const preventiveActions: string[] = [];

  // 1. AVALIAÇÃO SRVSQL
  const rawSql = sample.srvsql;
  const srvsql = createEmptySrvsql(rawSql?.host || '10.0.0.25');
  if (rawSql) {
    srvsql.status = 'HEALTHY';
    srvsql.sqlReachable = rawSql.sqlReachable;
    srvsql.sqlLatencyMs = rawSql.sqlLatencyMs;
    srvsql.iisReachable = rawSql.iisReachable;
    srvsql.iisLatencyMs = rawSql.iisLatencyMs;
    srvsql.vcpuCount = rawSql.vcpuCount;
    srvsql.cpuTotalPercent = rawSql.cpuTotalPercent;
    srvsql.sqlCpuPercent = rawSql.sqlCpuPercent;
    srvsql.totalRamMb = rawSql.totalRamMb;
    srvsql.freeRamMb = rawSql.freeRamMb;
    srvsql.usedRamPercent = rawSql.usedRamPercent;
    srvsql.memoryStateDesc = rawSql.memoryStateDesc;
    srvsql.pleSeconds = rawSql.pleSeconds;
    srvsql.pleDeltaVsPrev =
      rawSql.pleSeconds !== null && previousBriefing?.srvsql.pleSeconds != null
        ? rawSql.pleSeconds - previousBriefing.srvsql.pleSeconds
        : null;
    srvsql.bufferCacheHitRatioPercent = rawSql.bufferCacheHitRatioPercent;
    srvsql.userSessionsCount = rawSql.userSessionsCount;
    srvsql.blockedRequestsCount = rawSql.blockedRequestsCount;
    srvsql.zombieQueriesCount = rawSql.zombieQueriesCount;
    srvsql.memoryGrantsPending = rawSql.memoryGrantsPending;
    srvsql.w3wpPid = rawSql.w3wpPid;
    srvsql.w3wpConnectionsCount = rawSql.w3wpConnectionsCount;
    srvsql.w3wpWorkingSetMb = rawSql.w3wpWorkingSetMb;
    srvsql.perfIndexesCount = rawSql.perfIndexesCount;
    srvsql.perfIndexesSeeks = rawSql.perfIndexesSeeks;
    srvsql.openCdsTasksCount = rawSql.openCdsTasksCount;
    srvsql.nonOnlineDatabases = rawSql.nonOnlineDatabases || [];
    srvsql.highLogBackupDatabases = rawSql.highLogBackupDatabases || [];
    srvsql.sqlStartTimeIso = rawSql.sqlStartTimeIso;
    srvsql.osUptimeSeconds = rawSql.osUptimeSeconds;
    srvsql.services = rawSql.services || [];
    srvsql.error = rawSql.error;

    if (rawSql.w3wpFirstConnIso) {
      const refMs = Date.parse(sample.observedAt || generatedAt);
      const startMs = Date.parse(rawSql.w3wpFirstConnIso);
      if (Number.isFinite(refMs) && Number.isFinite(startMs) && refMs >= startMs) {
        srvsql.w3wpUptimeHours = round1((refMs - startMs) / 3_600_000);
      }
    }

    if (!rawSql.sqlReachable) {
      srvsql.status = 'OFFLINE';
      const rec = `SQL Server (WEBRI) inacessível em ${srvsql.host}${rawSql.error ? `: ${rawSql.error}` : '.'}`;
      preventiveActions.push(rec);
      checks.push({
        id: 'srvsql-connectivity',
        server: 'SRVSQL',
        category: 'Banco SQL',
        label: 'Conectividade SQL Server (WEBRI)',
        status: 'CRITICAL',
        currentValue: 'Indisponível',
        previousValue: previousBriefing?.srvsql.sqlReachable ? 'Online' : null,
        deltaLabel: null,
        recommendation: rec,
      });
    } else {
      checks.push({
        id: 'srvsql-connectivity',
        server: 'SRVSQL',
        category: 'Banco SQL',
        label: 'Conectividade SQL Server (WEBRI)',
        status: 'OK',
        currentValue: `Online (${rawSql.sqlLatencyMs ?? 0} ms)`,
        previousValue:
          previousBriefing?.srvsql.sqlLatencyMs != null ? `${previousBriefing.srvsql.sqlLatencyMs} ms` : null,
        deltaLabel: null,
        recommendation: null,
      });

      if (rawSql.cpuTotalPercent !== null) {
        const cpuStatus =
          rawSql.cpuTotalPercent >= 85 ? 'CRITICAL' : rawSql.cpuTotalPercent >= 65 ? 'WARNING' : 'OK';
        if (cpuStatus !== 'OK') {
          srvsql.status = elevateServerStatus(srvsql.status, cpuStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
          preventiveActions.push(
            `CPU elevada no SRVSQL (${rawSql.cpuTotalPercent}%): verificar queries pesadas ou rotinas concorrentes em Performance do SRVSQL.`,
          );
        }
        checks.push({
          id: 'srvsql-cpu',
          server: 'SRVSQL',
          category: 'Processamento',
          label: 'CPU Total / SQL Server',
          status: cpuStatus,
          currentValue: `${rawSql.cpuTotalPercent}% (SQL: ${rawSql.sqlCpuPercent ?? '--'}%)`,
          previousValue:
            previousBriefing?.srvsql.cpuTotalPercent != null ? `${previousBriefing.srvsql.cpuTotalPercent}%` : null,
          deltaLabel:
            previousBriefing?.srvsql.cpuTotalPercent != null
              ? `${round1(rawSql.cpuTotalPercent - previousBriefing.srvsql.cpuTotalPercent) >= 0 ? '+' : ''}${round1(rawSql.cpuTotalPercent - previousBriefing.srvsql.cpuTotalPercent)} p.p.`
              : null,
          recommendation: cpuStatus === 'OK' ? null : 'Inspecionar consultas ativas no painel Performance do SRVSQL.',
        });
      }

      if (rawSql.freeRamMb !== null) {
        const osMemLow = typeof rawSql.memoryStateDesc === 'string' && /low/i.test(rawSql.memoryStateDesc);
        const ramStatus = osMemLow
          ? rawSql.freeRamMb < 4096
            ? 'CRITICAL'
            : rawSql.freeRamMb < 6144
            ? 'WARNING'
            : 'OK'
          : rawSql.freeRamMb < 2560
          ? 'CRITICAL'
          : rawSql.freeRamMb < 4608
          ? 'WARNING'
          : 'OK';
        if (ramStatus !== 'OK') {
          srvsql.status = elevateServerStatus(srvsql.status, ramStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
          preventiveActions.push(
            `Memória livre baixa no Windows do SRVSQL (${formatRamGb(rawSql.freeRamMb)}): checar processos concorrentes ao SQL Server.`,
          );
        }
        checks.push({
          id: 'srvsql-ram',
          server: 'SRVSQL',
          category: 'Memória Windows',
          label: 'RAM Livre / Total',
          status: ramStatus,
          currentValue: `${formatRamGb(rawSql.freeRamMb)} livres de ${formatRamGb(rawSql.totalRamMb)}`,
          previousValue:
            previousBriefing?.srvsql.freeRamMb != null ? `${formatRamGb(previousBriefing.srvsql.freeRamMb)} livres` : null,
          deltaLabel: rawSql.memoryStateDesc ? rawSql.memoryStateDesc : null,
          recommendation: ramStatus === 'OK' ? null : 'Avaliar processos Java/IIS ou limite Max Server Memory no SRVSQL.',
        });
      }

      if (rawSql.pleSeconds !== null) {
        const pleStatus = rawSql.pleSeconds < 300 ? 'CRITICAL' : rawSql.pleSeconds < 600 ? 'WARNING' : 'OK';
        if (pleStatus !== 'OK') {
          srvsql.status = elevateServerStatus(srvsql.status, pleStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
          preventiveActions.push(
            `PLE (Page Life Expectancy) em ${rawSql.pleSeconds}s no SRVSQL: indica pressão ou varredura pesada recente no Buffer Pool.`,
          );
        } else if (rawSql.pleSeconds >= 900) {
          highlights.push(`SRVSQL com PLE saudável em ${rawSql.pleSeconds.toLocaleString('pt-BR')}s e zero pressão de memória.`);
        }
        const deltaPle = srvsql.pleDeltaVsPrev;
        checks.push({
          id: 'srvsql-ple',
          server: 'SRVSQL',
          category: 'Cache SQL',
          label: 'Page Life Expectancy (PLE)',
          status: pleStatus,
          currentValue: `${rawSql.pleSeconds.toLocaleString('pt-BR')} s`,
          previousValue:
            previousBriefing?.srvsql.pleSeconds != null
              ? `${previousBriefing.srvsql.pleSeconds.toLocaleString('pt-BR')} s`
              : null,
          deltaLabel:
            deltaPle !== null
              ? `${deltaPle >= 0 ? '+' : ''}${deltaPle.toLocaleString('pt-BR')} s vs. ontem`
              : null,
          recommendation:
            pleStatus === 'OK' ? null : 'Verificar consultas com Table/Clustered Scan em Performance do SRVSQL.',
        });
      }

      if (rawSql.blockedRequestsCount !== null) {
        const blockStatus =
          rawSql.blockedRequestsCount >= 3 ? 'CRITICAL' : rawSql.blockedRequestsCount >= 1 ? 'WARNING' : 'OK';
        if (blockStatus !== 'OK') {
          srvsql.status = elevateServerStatus(srvsql.status, blockStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
          preventiveActions.push(
            `Há ${rawSql.blockedRequestsCount} sessão(ões) bloqueada(s) (>= 5s) no SRVSQL (verificar Bloqueador Principal).`,
          );
        }
        checks.push({
          id: 'srvsql-blocks',
          server: 'SRVSQL',
          category: 'Concorrência',
          label: 'Cadeias de Bloqueio Ativas (>= 5s)',
          status: blockStatus,
          currentValue:
            rawSql.blockedRequestsCount === 0
              ? '0 bloqueios'
              : `${rawSql.blockedRequestsCount} sessão(ões) bloqueada(s) (>= 5s)`,
          previousValue:
            previousBriefing?.srvsql.blockedRequestsCount != null
              ? `${previousBriefing.srvsql.blockedRequestsCount} bloqueios`
              : null,
          deltaLabel: null,
          recommendation:
            blockStatus === 'OK' ? null : 'Abrir aba SQL e Bloqueios no painel Performance do SRVSQL.',
        });
      }

      if (rawSql.zombieQueriesCount !== null && rawSql.zombieQueriesCount > 0) {
        const zStatus = rawSql.zombieQueriesCount >= 3 ? 'CRITICAL' : 'WARNING';
        srvsql.status = elevateServerStatus(srvsql.status, zStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
        const rec = `${rawSql.zombieQueriesCount} query(s) rodando há mais de 2 minutos no SRVSQL (risco de sessão presa/zumbi).`;
        preventiveActions.push(rec);
        checks.push({
          id: 'srvsql-zombies',
          server: 'SRVSQL',
          category: 'Concorrência',
          label: 'Consultas Longas (> 2 min)',
          status: zStatus,
          currentValue: `${rawSql.zombieQueriesCount} em execução`,
          previousValue:
            previousBriefing?.srvsql.zombieQueriesCount != null
              ? `${previousBriefing.srvsql.zombieQueriesCount}`
              : null,
          deltaLabel: null,
          recommendation: rec,
        });
      }

      // Saúde preventiva do IIS (w3wp.exe WebRI)
      if (!rawSql.iisReachable) {
        srvsql.status = elevateServerStatus(srvsql.status, 'CRITICAL');
        const rec = 'Porta HTTP (:80) do WebRI no SRVSQL não respondeu ao teste TCP.';
        preventiveActions.push(rec);
        checks.push({
          id: 'srvsql-iis',
          server: 'SRVSQL',
          category: 'Aplicação WebRI (IIS)',
          label: 'Portal WebRI / Worker w3wp.exe',
          status: 'CRITICAL',
          currentValue: 'Porta 80 inacessível',
          previousValue: null,
          deltaLabel: null,
          recommendation: rec,
        });
      } else {
        const highRamW3wp = srvsql.w3wpWorkingSetMb !== null && srvsql.w3wpWorkingSetMb >= 750;
        const oldW3wp = srvsql.w3wpUptimeHours !== null && srvsql.w3wpUptimeHours >= 18;
        const iisStatus = highRamW3wp || oldW3wp ? 'WARNING' : 'OK';
        if (iisStatus === 'WARNING') {
          srvsql.status = elevateServerStatus(srvsql.status, 'WARNING');
          preventiveActions.push(
            `Worker IIS (w3wp.exe${srvsql.w3wpPid ? ` PID ${srvsql.w3wpPid}` : ''}) está com ${srvsql.w3wpWorkingSetMb ? `${srvsql.w3wpWorkingSetMb} MB` : 'uso prolongado'} (${srvsql.w3wpUptimeHours ?? '--'}h). Recomenda-se reciclar o Application Pool ou executar "iisreset" antes do pico.`,
          );
        }
        checks.push({
          id: 'srvsql-iis',
          server: 'SRVSQL',
          category: 'Aplicação WebRI (IIS)',
          label: 'Portal WebRI / Worker w3wp.exe',
          status: iisStatus,
          currentValue: `Online (${rawSql.iisLatencyMs ?? 0} ms)${srvsql.w3wpPid ? ` · PID ${srvsql.w3wpPid}` : ''}${srvsql.w3wpWorkingSetMb ? ` · ${srvsql.w3wpWorkingSetMb} MB` : ''}`,
          previousValue: null,
          deltaLabel: srvsql.w3wpUptimeHours !== null ? `${srvsql.w3wpUptimeHours}h ativo` : null,
          recommendation:
            iisStatus === 'WARNING'
              ? 'Executar reciclagem do Application Pool do WebRI no IIS (sem reiniciar o SQL Server).'
              : null,
        });
      }

      if (rawSql.nonOnlineDatabases.length > 0) {
        srvsql.status = elevateServerStatus(srvsql.status, 'CRITICAL');
        const rec = `Banco(s) fora do estado ONLINE no SRVSQL: ${rawSql.nonOnlineDatabases.join(', ')}.`;
        preventiveActions.push(rec);
        checks.push({
          id: 'srvsql-db-state',
          server: 'SRVSQL',
          category: 'Bancos SQL',
          label: 'Disponibilidade dos Bancos',
          status: 'CRITICAL',
          currentValue: rawSql.nonOnlineDatabases.join(', '),
          previousValue: null,
          deltaLabel: null,
          recommendation: rec,
        });
      }

      if (rawSql.highLogBackupDatabases.length > 0) {
        const actionableLogs = rawSql.highLogBackupDatabases.filter((d) => {
          const isWebri = d.databaseName.trim().toUpperCase() === 'WEBRI';
          const totalMb = d.logTotalMb ?? d.logUsedMb ?? 0;
          return isWebri ? d.logUsedPercent >= 75 : totalMb >= 1024 && d.logUsedPercent >= 80;
        });

        if (actionableLogs.length > 0) {
          const hasCritical = actionableLogs.some((d) => {
            const isWebri = d.databaseName.trim().toUpperCase() === 'WEBRI';
            const totalMb = d.logTotalMb ?? d.logUsedMb ?? 0;
            return isWebri
              ? d.logUsedPercent >= 90 && (d.logTotalMb ?? 512) >= 256
              : totalMb >= 2048 && d.logUsedPercent >= 92;
          });
          const logStatus = hasCritical ? 'CRITICAL' : 'WARNING';
          srvsql.status = elevateServerStatus(srvsql.status, logStatus);
          const names = actionableLogs.map((d) => `${d.databaseName} (${d.logUsedPercent}%)`).join(', ');
          const rec = `Log travado em LOG_BACKUP no SRVSQL: ${names}. Verificar BACKUP LOG ou modelo SIMPLE caso aplicável.`;
          preventiveActions.push(rec);
          checks.push({
            id: 'srvsql-log-backup',
            server: 'SRVSQL',
            category: 'Transaction Log',
            label: 'Bancos com Log retido em LOG_BACKUP',
            status: logStatus,
            currentValue: names,
            previousValue: null,
            deltaLabel: null,
            recommendation: rec,
          });
        } else {
          checks.push({
            id: 'srvsql-log-backup',
            server: 'SRVSQL',
            category: 'Transaction Log',
            label: 'Transaction Log dos Bancos',
            status: 'OK',
            currentValue: 'WEBRI normal (auxiliares < 1 GB com autogrowth ativo)',
            previousValue: null,
            deltaLabel: null,
            recommendation: null,
          });
        }
      }

      if (rawSql.perfIndexesCount !== null) {
        checks.push({
          id: 'srvsql-perf-indexes',
          server: 'SRVSQL',
          category: 'Tuning Aplicado',
          label: 'Índices IX_Perf_* Ativos',
          status: 'OK',
          currentValue: `${rawSql.perfIndexesCount} ativos (${(rawSql.perfIndexesSeeks ?? 0).toLocaleString('pt-BR')} seeks)`,
          previousValue:
            previousBriefing?.srvsql.perfIndexesSeeks != null
              ? `${previousBriefing.srvsql.perfIndexesSeeks.toLocaleString('pt-BR')} seeks`
              : null,
          deltaLabel: null,
          recommendation: null,
        });
        if (rawSql.perfIndexesCount >= 5) {
          highlights.push(
            `Pacote de ${rawSql.perfIndexesCount} índices IX_Perf_* ativo no WEBRI (${(rawSql.perfIndexesSeeks ?? 0).toLocaleString('pt-BR')} seeks acumulados).`,
          );
        }
      }

      srvsql.volumes = evaluateVolumesList(rawSql.volumes || [], previousBriefing?.srvsql.volumes, {
        warnFreePct: 20,
        critFreePct: 10,
        critFreeGb: 15,
      });
      const sqlDiskStatus = addDiskChecks(
        'SRVSQL',
        srvsql.volumes,
        previousBriefing?.srvsql.volumes,
        checks,
        preventiveActions,
      );
      srvsql.status = elevateServerStatus(srvsql.status, sqlDiskStatus);
    }

    srvsql.headline =
      srvsql.status === 'OFFLINE'
        ? 'SQL Server indisponível ou inacessível na rede'
        : srvsql.status === 'CRITICAL'
        ? 'Atenção crítica no SRVSQL (bloqueio, memória ou disco)'
        : srvsql.status === 'WARNING'
        ? 'Operacional com pontos preventivos (IIS/CPU/PLE ou Log)'
        : `SQL & WebRI saudáveis · PLE ${srvsql.pleSeconds ?? '--'}s · ${srvsql.blockedRequestsCount ?? 0} bloqueios`;
  }

  // 2. AVALIAÇÃO SRVFILES
  const rawFiles = sample.srvfiles;
  const srvfiles = createEmptySrvfiles(rawFiles?.host || 'SRVFILES');
  if (rawFiles) {
    srvfiles.available = true;
    srvfiles.status = 'HEALTHY';
    srvfiles.lanIp = rawFiles.lanIp;
    srvfiles.osUptimeSeconds = rawFiles.osUptimeSeconds;
    srvfiles.vcpuCount = rawFiles.vcpuCount;
    srvfiles.cpuPercent = rawFiles.cpuPercent;
    srvfiles.totalRamMb = rawFiles.totalRamMb;
    srvfiles.freeRamMb = rawFiles.freeRamMb;
    srvfiles.usedRamPercent = rawFiles.usedRamPercent;
    srvfiles.services = rawFiles.services || [];
    srvfiles.mysqlPortReachable = rawFiles.mysqlPortReachable;
    srvfiles.mysqlLatencyMs = rawFiles.mysqlLatencyMs;
    srvfiles.fileServerPort = rawFiles.fileServerPort;
    srvfiles.fileServerReachable = rawFiles.fileServerReachable;
    srvfiles.fileServerLatencyMs = rawFiles.fileServerLatencyMs;
    srvfiles.connectorVersion = rawFiles.connectorVersion;
    srvfiles.connectorUptimeSeconds = rawFiles.connectorUptimeSeconds;
    srvfiles.connectorOperationalState = rawFiles.connectorOperationalState;
    srvfiles.queuePending = rawFiles.queuePending;
    srvfiles.queueFailed = rawFiles.queueFailed;
    srvfiles.queueQuarantined = rawFiles.queueQuarantined;
    srvfiles.cimAvailable = rawFiles.cimAvailable;
    srvfiles.cimError = rawFiles.cimError;

    let filesCpuStatus: 'OK' | 'WARNING' | 'CRITICAL' = 'OK';
    if (rawFiles.cpuPercent !== null) {
      const isConnectorWarmup =
        sample.trigger === 'STARTUP' ||
        (rawFiles.connectorUptimeSeconds !== null && rawFiles.connectorUptimeSeconds < 180);
      const cpuStatus = isConnectorWarmup
        ? rawFiles.cpuPercent >= 96
          ? 'WARNING'
          : 'OK'
        : rawFiles.cpuPercent >= 96
        ? 'CRITICAL'
        : rawFiles.cpuPercent >= 82
        ? 'WARNING'
        : 'OK';
      filesCpuStatus = cpuStatus;
      if (cpuStatus !== 'OK') {
        srvfiles.status = elevateServerStatus(srvfiles.status, cpuStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
        preventiveActions.push(
          `CPU alta no SRVFILES (${rawFiles.cpuPercent}%): verificar rsync/DeltaCopy, Veeam/Acronis ou OCR.`,
        );
      }
      checks.push({
        id: 'srvfiles-cpu',
        server: 'SRVFILES',
        category: 'Processamento',
        label: 'CPU do Servidor',
        status: cpuStatus,
        currentValue: `${rawFiles.cpuPercent}% (${rawFiles.vcpuCount ?? '--'} vCPUs)${isConnectorWarmup ? ' · startup' : ''}`,
        previousValue:
          previousBriefing?.srvfiles.cpuPercent != null ? `${previousBriefing.srvfiles.cpuPercent}%` : null,
        deltaLabel: null,
        recommendation: cpuStatus === 'OK' ? null : 'Verificar rsync/DeltaCopy, backup ou OCR em execução no SrvFiles.',
      });
    }

    if (rawFiles.freeRamMb !== null) {
      const ramStatus = rawFiles.freeRamMb < 3072 ? 'CRITICAL' : rawFiles.freeRamMb < 6144 ? 'WARNING' : 'OK';
      if (ramStatus !== 'OK') {
        srvfiles.status = elevateServerStatus(srvfiles.status, ramStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
        preventiveActions.push(`Memória livre baixa no SRVFILES (${formatRamGb(rawFiles.freeRamMb)} livres).`);
      }
      checks.push({
        id: 'srvfiles-ram',
        server: 'SRVFILES',
        category: 'Memória Windows',
        label: 'RAM Livre / Total',
        status: ramStatus,
        currentValue: `${formatRamGb(rawFiles.freeRamMb)} livres de ${formatRamGb(rawFiles.totalRamMb)}`,
        previousValue:
          previousBriefing?.srvfiles.freeRamMb != null
            ? `${formatRamGb(previousBriefing.srvfiles.freeRamMb)} livres`
            : null,
        deltaLabel: null,
        recommendation: ramStatus === 'OK' ? null : 'Avaliar consumo do MySQL ou índice documental em RAM.',
      });
    }

    srvfiles.volumes = evaluateVolumesList(rawFiles.volumes || [], previousBriefing?.srvfiles.volumes, {
      warnFreePct: 18,
      critFreePct: 10,
      critFreeGb: 20,
    });
    const filesDiskStatus = addDiskChecks(
      'SRVFILES',
      srvfiles.volumes,
      previousBriefing?.srvfiles.volumes,
      checks,
      preventiveActions,
    );
    srvfiles.status = elevateServerStatus(srvfiles.status, filesDiskStatus);

    const qQuarantined = rawFiles.queueQuarantined ?? 0;
    const qFailed = rawFiles.queueFailed ?? 0;
    const queueStatus = qQuarantined > 0 ? 'CRITICAL' : qFailed > 5 ? 'WARNING' : 'OK';
    if (queueStatus !== 'OK') {
      srvfiles.status = elevateServerStatus(srvfiles.status, queueStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
      preventiveActions.push(
        `Fila SQLite do FIORIX Connector no SRVFILES com ${qQuarantined} em quarentena e ${qFailed} falha(s).`,
      );
    }
    checks.push({
      id: 'srvfiles-connector-queue',
      server: 'SRVFILES',
      category: 'FIORIX Connector',
      label: 'Fila SQLite & Estado HA',
      status: queueStatus,
      currentValue: `${rawFiles.connectorVersion ?? '--'} (${rawFiles.connectorOperationalState ?? 'ACTIVE'}) · Pendente ${rawFiles.queuePending ?? 0} · Falha ${qFailed}`,
      previousValue: null,
      deltaLabel: null,
      recommendation:
        queueStatus === 'OK' ? null : 'Inspecionar lotes em quarentena/falha na Central de Operações.',
    });

    const fileSrvStatus = rawFiles.fileServerReachable ? 'OK' : 'WARNING';
    if (fileSrvStatus === 'WARNING') {
      srvfiles.status = elevateServerStatus(srvfiles.status, 'WARNING');
      preventiveActions.push(
        `File Server documental LAN (:${rawFiles.fileServerPort}) não respondeu em 127.0.0.1 no SRVFILES.`,
      );
    }
    checks.push({
      id: 'srvfiles-fileserver',
      server: 'SRVFILES',
      category: 'Serviços Locais',
      label: `File Server LAN (:${rawFiles.fileServerPort}) & MySQL (:3306)`,
      status: fileSrvStatus,
      currentValue: `FileServer: ${rawFiles.fileServerReachable ? `OK (${rawFiles.fileServerLatencyMs ?? 0}ms)` : 'OFF'} · MySQL: ${rawFiles.mysqlPortReachable ? `OK (${rawFiles.mysqlLatencyMs ?? 0}ms)` : 'OFF'}`,
      previousValue: null,
      deltaLabel: null,
      recommendation:
        fileSrvStatus === 'OK' ? null : 'Verificar se o módulo HTTP File Server do Connector está ativo.',
    });

    if (srvfiles.status === 'HEALTHY') {
      highlights.push(
        `SRVFILES (${srvfiles.lanIp ?? '10.0.0.40'}) com Connector ${srvfiles.connectorVersion ?? ''} estável e discos com folga.`,
      );
    }

    srvfiles.headline =
      srvfiles.status === 'CRITICAL'
        ? qQuarantined > 0
          ? 'Alerta crítico: lotes em quarentena na fila do Connector'
          : filesDiskStatus === 'CRITICAL'
          ? 'Alerta crítico de espaço em disco no SRVFILES'
          : 'Sobrecarga crítica de CPU no SRVFILES (verificar rsync/backup)'
        : srvfiles.status === 'WARNING'
        ? filesCpuStatus === 'WARNING'
          ? 'SRVFILES com atenção preventiva (CPU/rsync, espaço ou serviços)'
          : 'SRVFILES com atenção preventiva (espaço/RAM/serviços)'
        : `Connector ${srvfiles.connectorVersion ?? ''} · ${formatRamGb(srvfiles.freeRamMb)} livres · Filas zeradas`;
  }

  // 3. AVALIAÇÃO SRVSIPLANIA
  const rawIa = sample.srvsiplania;
  const srvsiplania = createEmptySrvsiplania(rawIa?.host || '10.0.0.6', rawIa?.name || 'SRVSIPLANIA');
  if (rawIa) {
    srvsiplania.available = true;
    srvsiplania.webReachable = rawIa.webReachable;
    srvsiplania.webPort = rawIa.webPort;
    srvsiplania.webLatencyMs = rawIa.webLatencyMs;
    srvsiplania.httpStatusCode = rawIa.httpStatusCode;
    srvsiplania.postgresPort = rawIa.postgresPort;
    srvsiplania.postgresReachable = rawIa.postgresReachable;
    srvsiplania.postgresLatencyMs = rawIa.postgresLatencyMs;
    srvsiplania.postgresSqlAuthenticated = rawIa.postgresSqlAuthenticated ?? null;
    srvsiplania.postgresSqlLatencyMs = rawIa.postgresSqlLatencyMs ?? null;
    srvsiplania.postgresVersion = rawIa.postgresVersion ?? null;
    srvsiplania.postgresUptimeSeconds = rawIa.postgresUptimeSeconds ?? null;
    srvsiplania.postgresDbSizeMb = rawIa.postgresDbSizeMb ?? null;
    srvsiplania.postgresCacheHitPercent = rawIa.postgresCacheHitPercent ?? null;
    srvsiplania.postgresTotalConnections = rawIa.postgresTotalConnections ?? null;
    srvsiplania.postgresActiveQueries = rawIa.postgresActiveQueries ?? null;
    srvsiplania.postgresIdleInTxCount = rawIa.postgresIdleInTxCount ?? null;
    srvsiplania.postgresWaitingLocks = rawIa.postgresWaitingLocks ?? null;
    srvsiplania.postgresLongQueries = rawIa.postgresLongQueries ?? null;
    srvsiplania.postgresDeadlocks = rawIa.postgresDeadlocks ?? null;
    srvsiplania.postgresSharedBuffersMb = rawIa.postgresSharedBuffersMb ?? null;
    srvsiplania.postgresMatriculasCount = rawIa.postgresMatriculasCount ?? null;
    srvsiplania.postgresPaginasOcrCount = rawIa.postgresPaginasOcrCount ?? null;
    srvsiplania.postgresDistinctClients = rawIa.postgresDistinctClients ?? null;
    srvsiplania.postgresSqlError = rawIa.postgresSqlError ?? null;
    srvsiplania.cimAvailable = rawIa.cimAvailable;
    srvsiplania.cimError = rawIa.cimError;
    srvsiplania.osCaption = rawIa.osCaption;
    srvsiplania.osUptimeSeconds = rawIa.osUptimeSeconds;
    srvsiplania.vcpuCount = rawIa.vcpuCount;
    srvsiplania.cpuPercent = rawIa.cpuPercent;
    srvsiplania.totalRamMb = rawIa.totalRamMb;
    srvsiplania.freeRamMb = rawIa.freeRamMb;
    srvsiplania.usedRamPercent = rawIa.usedRamPercent;
    srvsiplania.services = rawIa.services || [];

    const bothDown = !rawIa.webReachable && !rawIa.postgresReachable;
    const bothUp = rawIa.webReachable && rawIa.postgresReachable;
    srvsiplania.networkHealthy = Boolean(rawIa.postgresReachable);

    if (bothDown) {
      srvsiplania.status = 'OFFLINE';
      const rec = `SRVSIPLANIA (${rawIa.host}) sem resposta no Portal Web e no PostgreSQL (:${rawIa.postgresPort}). Verificar VM imediatamente.`;
      preventiveActions.push(rec);
    } else if (!rawIa.postgresReachable && rawIa.webReachable) {
      srvsiplania.status = 'CRITICAL';
      preventiveActions.push(`PostgreSQL (:${rawIa.postgresPort}) não respondeu no SRVSIPLANIA (${rawIa.host}).`);
    } else if (
      (rawIa.webReachable && rawIa.webLatencyMs !== null && rawIa.webLatencyMs > 1500) ||
      (rawIa.postgresLatencyMs !== null && rawIa.postgresLatencyMs > 1500)
    ) {
      srvsiplania.status = 'WARNING';
      preventiveActions.push(
        `Latência alta no SRVSIPLANIA (Web ${rawIa.webLatencyMs ?? '--'}ms / PostgreSQL ${rawIa.postgresLatencyMs ?? '--'}ms).`,
      );
    } else {
      srvsiplania.status = 'HEALTHY';
      highlights.push(
        bothUp
          ? `SRVSIPLANIA (${rawIa.host}) acessível: Portal HTTP (:${rawIa.webPort ?? '--'} em ${rawIa.webLatencyMs ?? 0}ms) e PostgreSQL (:${rawIa.postgresPort} em ${rawIa.postgresLatencyMs ?? 0}ms).`
          : `SRVSIPLANIA (${rawIa.host}) online com PostgreSQL (:${rawIa.postgresPort}) respondendo em ${rawIa.postgresLatencyMs ?? 0}ms.`,
      );
    }

    checks.push({
      id: 'srvsiplania-web',
      server: 'SRVSIPLANIA',
      category: 'Aplicação Web',
      label: !rawIa.webReachable && rawIa.postgresReachable ? 'Portal HTTP na LAN' : 'Portal SiplanIA (HTTP)',
      status: rawIa.webReachable
        ? (rawIa.webLatencyMs ?? 0) > 1500
          ? 'WARNING'
          : 'OK'
        : rawIa.postgresReachable
        ? 'NO_DATA'
        : 'CRITICAL',
      currentValue: rawIa.webReachable
        ? `Online :${rawIa.webPort} (${rawIa.webLatencyMs ?? 0} ms${rawIa.httpStatusCode ? ` · HTTP ${rawIa.httpStatusCode}` : ''})`
        : rawIa.postgresReachable
        ? 'Sem porta HTTP exposta na LAN (PostgreSQL ativo)'
        : 'Inacessível',
      previousValue:
        previousBriefing?.srvsiplania.webLatencyMs != null
          ? `${previousBriefing.srvsiplania.webLatencyMs} ms`
          : null,
      deltaLabel: null,
      recommendation:
        rawIa.webReachable || rawIa.postgresReachable
          ? null
          : 'Verificar serviço web/IIS do SiplanIA na VM 10.0.0.6.',
    });

    const pgSqlAuthed = rawIa.postgresSqlAuthenticated === true;
    const pgWaitLocks = rawIa.postgresWaitingLocks ?? 0;
    const pgIdleTx = rawIa.postgresIdleInTxCount ?? 0;
    const pgLongQ = rawIa.postgresLongQueries ?? 0;
    const pgConns = rawIa.postgresTotalConnections ?? 0;
    const pgAnomaliaCrit = pgSqlAuthed && (pgWaitLocks >= 3 || pgConns >= 95);
    const pgAnomaliaWarn =
      pgSqlAuthed && (pgWaitLocks > 0 || pgIdleTx >= 5 || pgLongQ >= 3 || pgConns >= 85);

    if (pgAnomaliaCrit) {
      srvsiplania.status = elevateServerStatus(srvsiplania.status, 'CRITICAL');
      preventiveActions.push(
        `Contenção crítica no PostgreSQL SiplanIA (${pgWaitLocks} lock(s) em espera, ${pgConns} conexões).`,
      );
    } else if (pgAnomaliaWarn) {
      srvsiplania.status = elevateServerStatus(srvsiplania.status, 'WARNING');
      preventiveActions.push(
        `Atenção preventiva no PostgreSQL SiplanIA (${pgWaitLocks} lock(s), ${pgIdleTx} idle-in-tx, ${pgLongQ} query longa, ${pgConns} conexões).`,
      );
    }

    const pgDbGbLabel =
      rawIa.postgresDbSizeMb != null ? `${(rawIa.postgresDbSizeMb / 1024).toFixed(1)} GB` : null;
    const pgCheckStatus: 'OK' | 'WARNING' | 'CRITICAL' = !rawIa.postgresReachable
      ? 'CRITICAL'
      : pgAnomaliaCrit
      ? 'CRITICAL'
      : pgAnomaliaWarn || (rawIa.postgresLatencyMs ?? 0) > 1500
      ? 'WARNING'
      : 'OK';

    checks.push({
      id: 'srvsiplania-postgres',
      server: 'SRVSIPLANIA',
      category: 'Banco PostgreSQL',
      label: rawIa.postgresVersion ? `${rawIa.postgresVersion} (:${rawIa.postgresPort})` : `PostgreSQL (:${rawIa.postgresPort})`,
      status: pgCheckStatus,
      currentValue: !rawIa.postgresReachable
        ? `Porta ${rawIa.postgresPort} fechada`
        : pgSqlAuthed
        ? `${pgDbGbLabel ?? '--'} · Cache ${rawIa.postgresCacheHitPercent ?? '--'}% · ${pgConns} conns · ${rawIa.postgresSqlLatencyMs ?? rawIa.postgresLatencyMs ?? 0} ms`
        : `Online (${rawIa.postgresLatencyMs ?? 0} ms)`,
      previousValue:
        previousBriefing?.srvsiplania.postgresLatencyMs != null
          ? `${previousBriefing.srvsiplania.postgresLatencyMs} ms`
          : null,
      deltaLabel:
        pgSqlAuthed && rawIa.postgresDistinctClients != null
          ? `${rawIa.postgresDistinctClients} estação(ões)`
          : null,
      recommendation: !rawIa.postgresReachable
        ? 'Verificar serviço postgresql e pg_hba/firewall em 10.0.0.6.'
        : pgAnomaliaCrit || pgAnomaliaWarn
        ? 'Inspecionar pg_stat_activity no SiplanIA (10.0.0.6) para sessões travadas ou excesso de conexões.'
        : null,
    });

    if (pgSqlAuthed && rawIa.postgresMatriculasCount != null) {
      const matsLabel = rawIa.postgresMatriculasCount.toLocaleString('pt-BR');
      const pagsLabel =
        rawIa.postgresPaginasOcrCount != null
          ? rawIa.postgresPaginasOcrCount.toLocaleString('pt-BR')
          : '--';
      const sbLow = rawIa.postgresSharedBuffersMb !== null && rawIa.postgresSharedBuffersMb !== undefined && rawIa.postgresSharedBuffersMb <= 256;
      checks.push({
        id: 'srvsiplania-acervo-ia',
        server: 'SRVSIPLANIA',
        category: 'Acervo OCR SiplanIA',
        label: 'Matrículas LV2 & Páginas Indexadas',
        status: 'OK',
        currentValue: `${matsLabel} matrículas · ${pagsLabel} páginas OCR`,
        previousValue: null,
        deltaLabel:
          rawIa.postgresSharedBuffersMb != null
            ? `shared_buffers ${rawIa.postgresSharedBuffersMb} MB`
            : null,
        recommendation: sbLow
          ? `Informativo: shared_buffers atual em ${rawIa.postgresSharedBuffersMb} MB para ${pgDbGbLabel ?? '18 GB'} de base (ajustável futuramente com Siplan para 4 GB).`
          : null,
      });
    }

    if (rawIa.cimAvailable) {
      if (rawIa.cpuPercent !== null) {
        const cpuStatus = rawIa.cpuPercent >= 85 ? 'CRITICAL' : rawIa.cpuPercent >= 70 ? 'WARNING' : 'OK';
        if (cpuStatus !== 'OK') {
          srvsiplania.status = elevateServerStatus(
            srvsiplania.status,
            cpuStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          );
          preventiveActions.push(
            `CPU do SRVSIPLANIA em ${rawIa.cpuPercent}% (${rawIa.vcpuCount ?? 4} vCPUs): monitorar concorrência de OCR/exame IA.`,
          );
        }
        checks.push({
          id: 'srvsiplania-cpu',
          server: 'SRVSIPLANIA',
          category: 'Processamento',
          label: 'CPU (4 vCPUs)',
          status: cpuStatus,
          currentValue: `${rawIa.cpuPercent}% (${rawIa.vcpuCount ?? '--'} vCPUs)`,
          previousValue:
            previousBriefing?.srvsiplania.cpuPercent != null ? `${previousBriefing.srvsiplania.cpuPercent}%` : null,
          deltaLabel: null,
          recommendation: cpuStatus === 'OK' ? null : 'Avaliar exames simultâneos no SiplanIA.',
        });
      }

      if (rawIa.freeRamMb !== null) {
        const ramStatus = rawIa.freeRamMb < 2048 ? 'CRITICAL' : rawIa.freeRamMb < 4096 ? 'WARNING' : 'OK';
        if (ramStatus !== 'OK') {
          srvsiplania.status = elevateServerStatus(
            srvsiplania.status,
            ramStatus === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
          );
          preventiveActions.push(`Memória livre baixa no SRVSIPLANIA (${formatRamGb(rawIa.freeRamMb)}).`);
        }
        checks.push({
          id: 'srvsiplania-ram',
          server: 'SRVSIPLANIA',
          category: 'Memória Windows',
          label: 'RAM Livre / Total',
          status: ramStatus,
          currentValue: `${formatRamGb(rawIa.freeRamMb)} livres de ${formatRamGb(rawIa.totalRamMb)}`,
          previousValue:
            previousBriefing?.srvsiplania.freeRamMb != null
              ? `${formatRamGb(previousBriefing.srvsiplania.freeRamMb)} livres`
              : null,
          deltaLabel: null,
          recommendation: ramStatus === 'OK' ? null : 'Inspecionar processos de IA/PostgreSQL na VM 10.0.0.6.',
        });
      }

      srvsiplania.volumes = evaluateVolumesList(rawIa.volumes || [], previousBriefing?.srvsiplania.volumes, {
        warnFreePct: 20,
        critFreePct: 10,
        critFreeGb: 15,
      });
      const iaDiskStatus = addDiskChecks(
        'SRVSIPLANIA',
        srvsiplania.volumes,
        previousBriefing?.srvsiplania.volumes,
        checks,
        preventiveActions,
      );
      srvsiplania.status = elevateServerStatus(srvsiplania.status, iaDiskStatus);
    } else {
      checks.push({
        id: 'srvsiplania-cim',
        server: 'SRVSIPLANIA',
        category: 'Telemetria SO (WMI/CIM)',
        label: 'CPU, RAM (22 GB) e SSD (300 GB) via WMI/CIM',
        status: 'NO_DATA',
        currentValue: 'WMI/CIM pendente no firewall de 10.0.0.6',
        previousValue: null,
        deltaLabel: null,
        recommendation:
          'Opcional: executar "Enable-PSRemoting -Force" como Admin em SRVSIPLANIA (10.0.0.6) para habilitar coleta de CPU/RAM/SSD.',
      });
    }

    const pgResumido =
      rawIa.postgresSqlAuthenticated && rawIa.postgresDbSizeMb != null
        ? `${rawIa.postgresVersion || 'PostgreSQL 18'} OK (${(rawIa.postgresDbSizeMb / 1024).toFixed(1)} GB · ${rawIa.postgresCacheHitPercent ?? '--'}% hit · ${rawIa.postgresTotalConnections ?? 0} conns)`
        : `PostgreSQL :${rawIa.postgresPort} OK (${rawIa.postgresLatencyMs ?? 0}ms)`;

    srvsiplania.headline =
      srvsiplania.status === 'OFFLINE'
        ? 'Portal SiplanIA e PostgreSQL inacessíveis em 10.0.0.6'
        : srvsiplania.status === 'CRITICAL'
        ? `PostgreSQL (:${rawIa.postgresPort}) com falha ou contenção crítica em 10.0.0.6`
        : !rawIa.cimAvailable
        ? rawIa.webReachable
          ? `Rede OK (Portal :${rawIa.webPort ?? '--'} + ${pgResumido}) · WMI/CIM Pendente`
          : `${pgResumido} · WMI/CIM Pendente`
        : srvsiplania.status === 'WARNING'
        ? 'SRVSIPLANIA com atenção preventiva (latência, CPU, PostgreSQL ou disco)'
        : rawIa.webReachable
        ? `Portal :${rawIa.webPort ?? '--'} & ${pgResumido} · ${formatRamGb(rawIa.freeRamMb)} RAM livres`
        : `${pgResumido} · ${formatRamGb(rawIa.freeRamMb)} RAM livres`;
  }

  // 4. STATUS GLOBAL CONSOLIDADO
  const statuses: InfraServerStatus[] = [srvsql.status, srvfiles.status, srvsiplania.status];
  let overallStatus: InfraOverallStatus = 'HEALTHY';
  if (statuses.every((s) => s === 'NO_DATA')) {
    overallStatus = 'AWAITING_TELEMETRY';
  } else if (statuses.some((s) => s === 'CRITICAL' || s === 'OFFLINE')) {
    overallStatus = 'CRITICAL';
  } else if (statuses.some((s) => s === 'WARNING')) {
    overallStatus = 'ATTENTION';
  }

  const executiveHeadline =
    overallStatus === 'CRITICAL'
      ? `Ação Imediata: ${preventiveActions[0] || 'anomalia crítica detectada na infraestrutura.'}`
      : overallStatus === 'ATTENTION'
      ? `Expediente liberado com ${preventiveActions.length} ponto(s) preventivo(s) de atenção.`
      : 'Todos os sistemas prontos para o expediente — SRVSQL, SRVFILES e SRVSIPLANIA estáveis.';

  return {
    id,
    tenantId,
    briefingDate,
    generatedAt,
    observedAt: sample.observedAt,
    trigger,
    isOfficial0715,
    overallStatus,
    executiveHeadline,
    comparedWithDate,
    collectorVersion: sample.collectorVersion || null,
    connectorHost: sample.connectorHost || null,
    highlights,
    preventiveActions,
    srvsql,
    srvfiles,
    srvsiplania,
    checks,
  };
}

export function formatBriefingPlainTextSummary(b: InfraMorningBriefingRecord): string {
  const statusLabel =
    b.overallStatus === 'HEALTHY'
      ? 'VERDE (Pronto para o Expediente)'
      : b.overallStatus === 'ATTENTION'
      ? 'ATENCAO PREVENTIVA'
      : b.overallStatus === 'CRITICAL'
      ? 'CRITICO (Acao Imediata)'
      : 'AGUARDANDO TELEMETRIA';

  const hora = b.observedAt
    ? new Date(b.observedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : 'Sem dados';

  const sqlDisks =
    b.srvsql.volumes.length > 0
      ? b.srvsql.volumes.map((v) => `${v.mountPoint} ${v.freeGb ?? '--'}GB (${v.freePercent ?? '--'}%)`).join(' | ')
      : 'Sem dados';
  const filesDisks =
    b.srvfiles.volumes.length > 0
      ? b.srvfiles.volumes.map((v) => `${v.mountPoint} ${v.freeGb ?? '--'}GB (${v.freePercent ?? '--'}%)`).join(' | ')
      : 'Sem dados';
  const iaDisks =
    b.srvsiplania.volumes.length > 0
      ? b.srvsiplania.volumes.map((v) => `${v.mountPoint} ${v.freeGb ?? '--'}GB (${v.freePercent ?? '--'}%)`).join(' | ')
      : b.srvsiplania.cimAvailable
      ? 'Sem volumes'
      : 'WMI/CIM pendente no firewall';

  const lines = [
    `*BRIEFING MATINAL INFRA — 7º RI DE SÃO PAULO*`,
    `Data: ${b.briefingDate} · Coleta: ${hora} BRT`,
    `Status Geral: *${statusLabel}*`,
    b.executiveHeadline,
    '',
    `1) *SRVSQL (${b.srvsql.host})* — ${b.srvsql.status}`,
    `- SQL Server: ${b.srvsql.sqlReachable ? `Online (${b.srvsql.sqlLatencyMs ?? 0}ms)` : 'Offline/Sem dados'} · Sessões: ${b.srvsql.userSessionsCount ?? '--'} · Bloqueios: ${b.srvsql.blockedRequestsCount ?? '--'}`,
    `- CPU: ${b.srvsql.cpuTotalPercent ?? '--'}% · PLE: ${b.srvsql.pleSeconds ?? '--'}s · RAM livre: ${formatRamGb(b.srvsql.freeRamMb)}`,
    `- WebRI IIS (:80): ${b.srvsql.iisReachable ? 'Online' : 'Offline/Sem dados'}${b.srvsql.w3wpWorkingSetMb ? ` · w3wp ${b.srvsql.w3wpWorkingSetMb} MB` : ''}`,
    `- Discos: ${sqlDisks}`,
    '',
    `2) *SRVFILES (${b.srvfiles.lanIp ?? b.srvfiles.host})* — ${b.srvfiles.status}`,
    `- Connector: ${b.srvfiles.connectorVersion ?? '--'} · Filas Pendente/Falha/Quar.: ${b.srvfiles.queuePending ?? '--'}/${b.srvfiles.queueFailed ?? '--'}/${b.srvfiles.queueQuarantined ?? '--'}`,
    `- CPU: ${b.srvfiles.cpuPercent ?? '--'}% · RAM livre: ${formatRamGb(b.srvfiles.freeRamMb)} · FileServer:${b.srvfiles.fileServerReachable ? 'OK' : '--'}`,
    `- Discos: ${filesDisks}`,
    '',
    `3) *SRVSIPLANIA (${b.srvsiplania.host})* — ${b.srvsiplania.status}`,
    `- Portal HTTP (${b.srvsiplania.webReachable ? `:${b.srvsiplania.webPort ?? '--'}` : 'LAN'}): ${b.srvsiplania.webReachable ? `Online (${b.srvsiplania.webLatencyMs ?? 0}ms)` : b.srvsiplania.postgresReachable ? 'Sem porta HTTP exposta na LAN' : 'Offline/Sem dados'} · PostgreSQL (:${b.srvsiplania.postgresPort}): ${b.srvsiplania.postgresReachable ? (b.srvsiplania.postgresSqlAuthenticated && b.srvsiplania.postgresDbSizeMb != null ? `${(b.srvsiplania.postgresDbSizeMb / 1024).toFixed(1)} GB · ${b.srvsiplania.postgresCacheHitPercent ?? '--'}% hit · ${b.srvsiplania.postgresTotalConnections ?? 0} conns (${b.srvsiplania.postgresSqlLatencyMs ?? b.srvsiplania.postgresLatencyMs ?? 0}ms)` : `Online (${b.srvsiplania.postgresLatencyMs ?? 0}ms)`) : 'Offline/Sem dados'}`,
    `- SO/Discos: ${b.srvsiplania.cimAvailable ? `CPU ${b.srvsiplania.cpuPercent ?? '--'}% · RAM livre ${formatRamGb(b.srvsiplania.freeRamMb)} · ${iaDisks}` : iaDisks}`,
  ];

  if (b.preventiveActions.length > 0) {
    lines.push('', '*Ações Preventivas Recomendadas:*');
    b.preventiveActions.forEach((act, idx) => lines.push(`${idx + 1}. ${act}`));
  }

  return lines.join('\n');
}

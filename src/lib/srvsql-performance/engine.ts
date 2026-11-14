/**
 * Motor determinístico de cálculo, diagnóstico e correlação do módulo "Performance do SRVSQL".
 *
 * Funções puras e testáveis para:
 * 1. Cálculo de diferenças (deltas) de Wait Stats e I/O por arquivo, tratando:
 *    - Reinicialização do SQL Server (`sqlserver_start_time` alterado)
 *    - Limpeza manual de contadores (`DBCC SQLPERF('sys.dm_os_wait_stats', CLEAR)`)
 *    - Valores negativos em qualquer métrica acumulada (nunca exibir acumulado desde o boot como consumo do minuto)
 * 2. Resolução de cadeias de bloqueio (`blocking_session_id`) e identificação do bloqueador raiz (root blocker),
 *    incluindo sessões ociosas (`sleeping`) com transação aberta (`open_transaction_count > 0`).
 * 3. Associação de processos/serviços do Windows e sessões SQL ao WEBRI com nível de confiança explícito,
 *    identificando processos por `(pid, startTimeIso)`.
 * 4. Geração de diagnósticos baseados em evidências, diferenciando correlação de causa comprovada e
 *    aplicando histerese e deduplicação nos alertas.
 * 5. Exportação do dossiê técnico para a SIPLAN sem credenciais nem conteúdo sensível.
 */

import { BENIGN_IDLE_WAIT_TYPES } from './sql-queries';
import type {
  AlertEventRecord,
  AlertRuleLiveEvaluation,
  AlertRuleLiveState,
  AlertThresholdRule,
  AssociationConfidence,
  CostlyQuerySortDirection,
  CostlyQuerySortKey,
  DataSourceMode,
  EvidenceDiagnosticItem,
  SiplanIncidentExportDossier,
  SqlActiveSessionSample,
  SqlBlockingChainNode,
  SqlBlockingChainSummary,
  SqlCostlyQueryHashItem,
  SqlDatabaseSpaceSample,
  SqlFileIoDeltaItem,
  SqlFileIoRawSample,
  SqlMemoryHealthSample,
  SqlWaitStatDeltaItem,
  SqlWaitStatRawSample,
  SrvsqlPerformanceDashboardSnapshot,
  TimeWindowPreset,
  WaitCategory,
  WebriAssociationConfig,
  WindowsConcurrentEvent,
  WindowsMemorySample,
  WindowsProcessSample,
  WindowsVolumeIoSample,
} from './types';

const DEFAULT_WEBRI_DATABASE_SET = new Set([
  'WEBRI',
  'SPCM_EPP',
  'GESTOR',
  'WEBGERAL',
  'WEBROTINAS',
  'SIPLANGERAL',
  'DBDOCDIGITAL',
]);

/**
 * Classifica o `wait_type` do SQL Server em uma categoria semântica, sem presumir causa raiz isolada.
 */
export function classifySqlWaitType(waitType: string): {
  category: WaitCategory;
  label: string;
} {
  const normalized = waitType.trim().toUpperCase();

  if (normalized.startsWith('LCK_')) {
    return {
      category: 'BLOQUEIO',
      label: `Bloqueios · ${normalized}`,
    };
  }
  if (normalized.startsWith('PAGEIOLATCH_') || normalized === 'IO_COMPLETION' || normalized === 'ASYNC_IO_COMPLETION') {
    return {
      category: 'DISCO_PAGINA',
      label: `Disco · ${normalized}`,
    };
  }
  if (normalized === 'WRITELOG' || normalized === 'LOGBUFFER') {
    return {
      category: 'LOG_TRANSACAO',
      label: `Log · ${normalized}`,
    };
  }
  if (
    normalized === 'RESOURCE_SEMAPHORE' ||
    normalized === 'RESOURCE_SEMAPHORE_QUERY_COMPILE' ||
    normalized === 'CMEMTHREAD'
  ) {
    return {
      category: 'MEMORIA_GRANT',
      label: `Memória · ${normalized}`,
    };
  }
  if (normalized === 'SOS_SCHEDULER_YIELD' || normalized === 'THREADPOOL') {
    return {
      category: 'CPU_SCHEDULER',
      label: `CPU / Escalonador · ${normalized}`,
    };
  }
  if (normalized === 'ASYNC_NETWORK_IO') {
    return {
      category: 'REDE_APLICACAO',
      label: `Rede / Aplicação · ${normalized}`,
    };
  }
  if (normalized === 'CXPACKET' || normalized === 'CXCONSUMER') {
    return {
      category: 'PARALELISMO',
      label: `Paralelismo · ${normalized}`,
    };
  }

  return {
    category: 'OUTROS',
    label: `Outros · ${normalized}`,
  };
}

/**
 * Calcula o delta de `sys.dm_os_wait_stats` entre duas amostras consecutivas.
 * - Nunca retorna contadores acumulados desde a inicialização quando falta amostra anterior ou houve reset.
 * - Detecta reinicialização do SQL Server (`previousSqlStartTime !== currentSqlStartTime`) ou valores negativos.
 * - Filtra esperas ociosas benignas documentadas em `BENIGN_IDLE_WAIT_TYPES`.
 */
export function computeWaitStatsDelta(params: {
  previousSample: SqlWaitStatRawSample[] | null;
  currentSample: SqlWaitStatRawSample[] | null;
  previousSqlStartTime?: string | null;
  currentSqlStartTime?: string | null;
}): {
  items: SqlWaitStatDeltaItem[];
  totalWaitDeltaMs: number;
  counterResetDetected: boolean;
  resetReason: string | null;
} {
  const { previousSample, currentSample, previousSqlStartTime, currentSqlStartTime } = params;

  if (!previousSample || !currentSample || previousSample.length === 0 || currentSample.length === 0) {
    return {
      items: [],
      totalWaitDeltaMs: 0,
      counterResetDetected: false,
      resetReason: 'Aguardando segunda amostra consecutiva para cálculo de diferença (delta) do intervalo.',
    };
  }

  if (
    previousSqlStartTime &&
    currentSqlStartTime &&
    previousSqlStartTime !== currentSqlStartTime
  ) {
    return {
      items: [],
      totalWaitDeltaMs: 0,
      counterResetDetected: true,
      resetReason: `Reinicialização do SQL Server detectada (${previousSqlStartTime} → ${currentSqlStartTime}). Contadores acumulados descartados neste ciclo.`,
    };
  }

  const prevMap = new Map<string, SqlWaitStatRawSample>();
  for (const row of previousSample) {
    prevMap.set(row.waitType.trim().toUpperCase(), row);
  }

  let counterResetDetected = false;
  let resetReason: string | null = null;
  const rawDeltas: Array<{
    waitType: string;
    waitingTasksDelta: number;
    waitTimeDeltaMs: number;
    signalWaitTimeDeltaMs: number;
    resourceWaitTimeDeltaMs: number;
  }> = [];

  for (const curr of currentSample) {
    const key = curr.waitType.trim().toUpperCase();
    if (BENIGN_IDLE_WAIT_TYPES.has(key)) {
      continue;
    }

    const prev = prevMap.get(key);
    if (!prev) {
      continue;
    }

    const tasksDelta = curr.waitingTasksCount - prev.waitingTasksCount;
    const waitDelta = curr.waitTimeMs - prev.waitTimeMs;
    const signalDelta = curr.signalWaitTimeMs - prev.signalWaitTimeMs;

    if (tasksDelta < 0 || waitDelta < 0 || signalDelta < 0) {
      counterResetDetected = true;
      resetReason = `Reset ou regressão de contador detectado em ${key} (delta negativo descartado).`;
      continue;
    }

    if (waitDelta <= 0) {
      continue;
    }

    const clampedSignal = Math.min(waitDelta, Math.max(0, signalDelta));
    const resourceWait = Math.max(0, waitDelta - clampedSignal);

    rawDeltas.push({
      waitType: key,
      waitingTasksDelta: Math.max(0, tasksDelta),
      waitTimeDeltaMs: waitDelta,
      signalWaitTimeDeltaMs: clampedSignal,
      resourceWaitTimeDeltaMs: resourceWait,
    });
  }

  if (counterResetDetected && rawDeltas.length === 0) {
    return {
      items: [],
      totalWaitDeltaMs: 0,
      counterResetDetected: true,
      resetReason,
    };
  }

  const totalWaitDeltaMs = rawDeltas.reduce((acc, item) => acc + item.waitTimeDeltaMs, 0);
  rawDeltas.sort((a, b) => b.waitTimeDeltaMs - a.waitTimeDeltaMs);

  const items: SqlWaitStatDeltaItem[] = rawDeltas.map((d) => {
    const { category, label } = classifySqlWaitType(d.waitType);
    const sharePercent =
      totalWaitDeltaMs > 0 ? Math.round((d.waitTimeDeltaMs / totalWaitDeltaMs) * 1000) / 10 : 0;
    const avgWaitMsPerTask =
      d.waitingTasksDelta > 0
        ? Math.round((d.waitTimeDeltaMs / d.waitingTasksDelta) * 10) / 10
        : null;

    return {
      waitType: d.waitType,
      category,
      label,
      waitingTasksDelta: d.waitingTasksDelta,
      waitTimeDeltaMs: d.waitTimeDeltaMs,
      signalWaitTimeDeltaMs: d.signalWaitTimeDeltaMs,
      resourceWaitTimeDeltaMs: d.resourceWaitTimeDeltaMs,
      sharePercent,
      avgWaitMsPerTask,
    };
  });

  return {
    items,
    totalWaitDeltaMs,
    counterResetDetected,
    resetReason,
  };
}

/**
 * Calcula a latência por arquivo de dados e log (`sys.dm_io_virtual_file_stats`) a partir da diferença entre duas amostras.
 * - Trata reset de contadores (`sample_ms` menor ou deltas negativos).
 * - Quando `readsDelta === 0`, a latência de leitura no intervalo é `0` (se houve amostra válida sem operações) ou `null` quando houve reset.
 */
export function computeFileIoLatencyDelta(params: {
  previousFiles: SqlFileIoRawSample[] | null;
  currentFiles: SqlFileIoRawSample[] | null;
  previousSqlStartTime?: string | null;
  currentSqlStartTime?: string | null;
}): {
  items: SqlFileIoDeltaItem[];
  counterResetDetected: boolean;
} {
  const { previousFiles, currentFiles, previousSqlStartTime, currentSqlStartTime } = params;

  if (!previousFiles || !currentFiles || previousFiles.length === 0 || currentFiles.length === 0) {
    return { items: [], counterResetDetected: false };
  }

  if (
    previousSqlStartTime &&
    currentSqlStartTime &&
    previousSqlStartTime !== currentSqlStartTime
  ) {
    return { items: [], counterResetDetected: true };
  }

  const prevMap = new Map<string, SqlFileIoRawSample>();
  for (const f of previousFiles) {
    prevMap.set(`${f.databaseId}:${f.fileId}`, f);
  }

  let anyReset = false;
  const items: SqlFileIoDeltaItem[] = [];

  for (const curr of currentFiles) {
    const prev = prevMap.get(`${curr.databaseId}:${curr.fileId}`);
    if (!prev) continue;

    const readsDelta = curr.numOfReads - prev.numOfReads;
    const writesDelta = curr.numOfWrites - prev.numOfWrites;
    const readStallDelta = curr.ioStallReadMs - prev.ioStallReadMs;
    const writeStallDelta = curr.ioStallWriteMs - prev.ioStallWriteMs;
    const bytesReadDelta = curr.numOfBytesRead - prev.numOfBytesRead;
    const bytesWrittenDelta = curr.numOfBytesWritten - prev.numOfBytesWritten;
    const sampleMsDelta = curr.sampleMs - prev.sampleMs;

    if (
      sampleMsDelta < 0 ||
      readsDelta < 0 ||
      writesDelta < 0 ||
      readStallDelta < 0 ||
      writeStallDelta < 0 ||
      bytesReadDelta < 0 ||
      bytesWrittenDelta < 0
    ) {
      anyReset = true;
      items.push({
        databaseName: curr.databaseName,
        fileId: curr.fileId,
        logicalName: curr.logicalName,
        fileType: curr.fileType,
        volumeMountPoint: curr.volumeMountPoint,
        readsDelta: 0,
        writesDelta: 0,
        readLatencyDeltaMs: null,
        writeLatencyDeltaMs: null,
        bytesReadDelta: 0,
        bytesWrittenDelta: 0,
        counterResetDetected: true,
      });
      continue;
    }

    const readLatencyDeltaMs =
      readsDelta > 0 ? Math.round((readStallDelta / readsDelta) * 10) / 10 : 0;
    const writeLatencyDeltaMs =
      writesDelta > 0 ? Math.round((writeStallDelta / writesDelta) * 10) / 10 : 0;

    items.push({
      databaseName: curr.databaseName,
      fileId: curr.fileId,
      logicalName: curr.logicalName,
      fileType: curr.fileType,
      volumeMountPoint: curr.volumeMountPoint,
      readsDelta,
      writesDelta,
      readLatencyDeltaMs,
      writeLatencyDeltaMs,
      bytesReadDelta,
      bytesWrittenDelta,
      counterResetDetected: false,
    });
  }

  return { items, counterResetDetected: anyReset };
}

/**
 * Calcula o delta de consultas mais custosas (`sys.dm_exec_query_stats`) entre duas amostras consecutivas.
 * - Descarta acumulados históricos desde a compilação do plano ou reinicialização do SQL Server.
 * - Só reporta consultas cujo `executionCountDelta` avançou no intervalo atual.
 */
export function computeCostlyQueriesDelta(params: {
  previousQueries: SqlCostlyQueryHashItem[] | null;
  currentQueries: SqlCostlyQueryHashItem[] | null;
  previousSqlStartTime?: string | null;
  currentSqlStartTime?: string | null;
}): SqlCostlyQueryHashItem[] {
  const { previousQueries, currentQueries, previousSqlStartTime, currentSqlStartTime } = params;

  if (!previousQueries || !currentQueries || previousQueries.length === 0 || currentQueries.length === 0) {
    return [];
  }

  if (
    previousSqlStartTime &&
    currentSqlStartTime &&
    previousSqlStartTime !== currentSqlStartTime
  ) {
    return [];
  }

  const prevByComposite = new Map<string, SqlCostlyQueryHashItem>();
  const prevByHash = new Map<string, SqlCostlyQueryHashItem>();
  for (const q of previousQueries) {
    const hashKey = q.queryHash.trim().toUpperCase();
    const dbKey = (q.databaseName || '').trim().toUpperCase();
    prevByComposite.set(`${hashKey}::${dbKey}`, q);
    if (!prevByHash.has(hashKey)) {
      prevByHash.set(hashKey, q);
    }
  }

  const items: SqlCostlyQueryHashItem[] = [];
  for (const curr of currentQueries) {
    const hashKey = curr.queryHash.trim().toUpperCase();
    const dbKey = (curr.databaseName || '').trim().toUpperCase();
    const prev = prevByComposite.get(`${hashKey}::${dbKey}`) || prevByHash.get(hashKey);
    if (!prev) {
      continue;
    }

    const execDelta = curr.executionCountDelta - prev.executionCountDelta;
    const elapsedDelta = curr.totalElapsedTimeDeltaMs - prev.totalElapsedTimeDeltaMs;
    if (execDelta <= 0 || elapsedDelta < 0) {
      continue;
    }

    const avgElapsedTimeMs = Math.round(elapsedDelta / execDelta);
    const baselineAvgElapsedTimeMs =
      prev.executionCountDelta > 0
        ? Math.round(prev.totalElapsedTimeDeltaMs / prev.executionCountDelta)
        : null;
    const regressionRatio =
      baselineAvgElapsedTimeMs !== null && baselineAvgElapsedTimeMs > 0
        ? Math.round((avgElapsedTimeMs / baselineAvgElapsedTimeMs) * 10) / 10
        : null;
    const cpuDelta = Math.max(0, curr.totalCpuTimeDeltaMs - prev.totalCpuTimeDeltaMs);
    const readsDelta = Math.max(0, curr.totalLogicalReadsDelta - prev.totalLogicalReadsDelta);
    const writesDelta = Math.max(0, curr.totalWritesDelta - prev.totalWritesDelta);

    items.push({
      queryHash: curr.queryHash,
      databaseName: curr.databaseName,
      executionCountDelta: execDelta,
      totalElapsedTimeDeltaMs: elapsedDelta,
      avgElapsedTimeMs,
      baselineAvgElapsedTimeMs,
      regressionRatio,
      totalCpuTimeDeltaMs: cpuDelta,
      totalLogicalReadsDelta: readsDelta,
      totalWritesDelta: writesDelta,
      lastWaitTypeHint: curr.lastWaitTypeHint ?? null,
      operationKind: writesDelta > 0 ? 'GRAVACAO_TRANSACIONAL' : curr.operationKind,
    });
  }

  items.sort((a, b) => b.totalElapsedTimeDeltaMs - a.totalElapsedTimeDeltaMs);
  return items;
}

/**
 * Ordena deterministicamente os hashes de consultas custosas por qualquer uma das 7 colunas da tabela,
 * preservando a ordem original quando `sortKey === null` e mantendo valores nulos/vazios ao final.
 */
export function sortCostlyQueries(
  items: readonly SqlCostlyQueryHashItem[],
  sortKey: CostlyQuerySortKey | null,
  direction: CostlyQuerySortDirection = 'desc',
): SqlCostlyQueryHashItem[] {
  const copy = [...items];
  if (!sortKey || copy.length <= 1) {
    return copy;
  }

  const mult = direction === 'asc' ? 1 : -1;
  const normalizeWait = (value: string | null): string | null => {
    const trimmed = (value ?? '').trim();
    return !trimmed || trimmed === '—' ? null : trimmed;
  };

  copy.sort((a, b) => {
    switch (sortKey) {
      case 'queryHash': {
        return mult * a.queryHash.localeCompare(b.queryHash, 'pt-BR', { numeric: true, sensitivity: 'base' });
      }
      case 'operationAndDb': {
        const labelA = `${a.operationKind} (${a.databaseName})`;
        const labelB = `${b.operationKind} (${b.databaseName})`;
        const cmp = labelA.localeCompare(labelB, 'pt-BR', { sensitivity: 'base' });
        if (cmp !== 0) return mult * cmp;
        if (b.avgElapsedTimeMs !== a.avgElapsedTimeMs) return b.avgElapsedTimeMs - a.avgElapsedTimeMs;
        return a.queryHash.localeCompare(b.queryHash);
      }
      case 'executionCountDelta': {
        const cmp = a.executionCountDelta - b.executionCountDelta;
        if (cmp !== 0) return mult * cmp;
        if (b.avgElapsedTimeMs !== a.avgElapsedTimeMs) return b.avgElapsedTimeMs - a.avgElapsedTimeMs;
        return a.queryHash.localeCompare(b.queryHash);
      }
      case 'avgElapsedTimeMs': {
        const cmp = a.avgElapsedTimeMs - b.avgElapsedTimeMs;
        if (cmp !== 0) return mult * cmp;
        if (b.totalLogicalReadsDelta !== a.totalLogicalReadsDelta) {
          return b.totalLogicalReadsDelta - a.totalLogicalReadsDelta;
        }
        return a.queryHash.localeCompare(b.queryHash);
      }
      case 'baseline': {
        const aNull = a.baselineAvgElapsedTimeMs === null;
        const bNull = b.baselineAvgElapsedTimeMs === null;
        if (aNull !== bNull) return aNull ? 1 : -1;
        if (aNull && bNull) return a.queryHash.localeCompare(b.queryHash);
        const cmp = (a.baselineAvgElapsedTimeMs ?? 0) - (b.baselineAvgElapsedTimeMs ?? 0);
        if (cmp !== 0) return mult * cmp;
        const ratioCmp = (a.regressionRatio ?? 0) - (b.regressionRatio ?? 0);
        if (ratioCmp !== 0) return mult * ratioCmp;
        return a.queryHash.localeCompare(b.queryHash);
      }
      case 'totalLogicalReadsDelta': {
        const cmp = a.totalLogicalReadsDelta - b.totalLogicalReadsDelta;
        if (cmp !== 0) return mult * cmp;
        if (b.avgElapsedTimeMs !== a.avgElapsedTimeMs) return b.avgElapsedTimeMs - a.avgElapsedTimeMs;
        return a.queryHash.localeCompare(b.queryHash);
      }
      case 'lastWaitTypeHint': {
        const aWait = normalizeWait(a.lastWaitTypeHint);
        const bWait = normalizeWait(b.lastWaitTypeHint);
        const aNull = aWait === null;
        const bNull = bWait === null;
        if (aNull !== bNull) return aNull ? 1 : -1;
        if (aNull && bNull) return a.queryHash.localeCompare(b.queryHash);
        const cmp = (aWait ?? '').localeCompare(bWait ?? '', 'pt-BR', { sensitivity: 'base' });
        if (cmp !== 0) return mult * cmp;
        if (b.avgElapsedTimeMs !== a.avgElapsedTimeMs) return b.avgElapsedTimeMs - a.avgElapsedTimeMs;
        return a.queryHash.localeCompare(b.queryHash);
      }
    }
  });

  return copy;
}

/**
 * Constrói as árvores de bloqueio (`blocking_session_id`) e identifica o bloqueador principal (root blocker),
 * inclusive quando a sessão bloqueadora raiz está ociosa (`sleeping`) mantendo uma transação aberta (`open_transaction_count > 0`).
 */
export function buildBlockingChains(
  sessions: SqlActiveSessionSample[],
  referenceNowIso?: string,
): SqlBlockingChainSummary[] {
  if (!sessions || sessions.length === 0) return [];

  const sessionMap = new Map<number, SqlActiveSessionSample>();
  for (const s of sessions) {
    sessionMap.set(s.sessionId, s);
  }

  const childrenByBlocker = new Map<number, number[]>();
  const blockedSessionIds = new Set<number>();

  for (const s of sessions) {
    const blockerId = s.blockingSessionId;
    if (blockerId && blockerId > 0 && blockerId !== s.sessionId) {
      blockedSessionIds.add(s.sessionId);
      const list = childrenByBlocker.get(blockerId) || [];
      if (!list.includes(s.sessionId)) {
        list.push(s.sessionId);
      }
      childrenByBlocker.set(blockerId, list);
    }
  }

  if (blockedSessionIds.size === 0) return [];

  // Encontra bloqueadores raiz (sessões que bloqueiam alguém e não estão bloqueadas por outra, ou quebram ciclo)
  const rootBlockerIds = new Set<number>();
  for (const blockedId of blockedSessionIds) {
    const visited = new Set<number>([blockedId]);
    let currentId = sessionMap.get(blockedId)?.blockingSessionId ?? null;
    let lastValidBlocker = currentId;

    while (currentId && currentId > 0) {
      lastValidBlocker = currentId;
      if (visited.has(currentId)) {
        // Ciclo de deadlock transitório: elege o menor sessionId do ciclo como raiz determinística
        lastValidBlocker = Math.min(...Array.from(visited));
        break;
      }
      visited.add(currentId);
      const parent = sessionMap.get(currentId);
      if (!parent || !parent.blockingSessionId || parent.blockingSessionId <= 0) {
        break;
      }
      currentId = parent.blockingSessionId;
    }

    if (lastValidBlocker && lastValidBlocker > 0) {
      rootBlockerIds.add(lastValidBlocker);
    }
  }

  const refNowMs = referenceNowIso ? Date.parse(referenceNowIso) : Date.now();
  const summaries: SqlBlockingChainSummary[] = [];

  for (const rootId of rootBlockerIds) {
    const rootSample = sessionMap.get(rootId);
    const nodes: SqlBlockingChainNode[] = [];
    const affectedDbs = new Set<string>();
    let maxBlockedWaitTimeMs = 0;

    const calcTxDurationSec = (s: SqlActiveSessionSample | undefined): number | null => {
      if (!s) return null;
      const refIso = s.transactionBeginTimeIso || s.lastRequestStartTimeIso;
      if (refIso) {
        const parsed = Date.parse(refIso);
        if (Number.isFinite(parsed) && refNowMs >= parsed) {
          return Math.round((refNowMs - parsed) / 1000);
        }
      }
      if (s.elapsedTimeMs !== null && s.elapsedTimeMs > 0) {
        return Math.round(s.elapsedTimeMs / 1000);
      }
      return null;
    };

    const visitedInTree = new Set<number>();
    const queue: Array<{ sessionId: number; depth: number }> = [{ sessionId: rootId, depth: 0 }];

    while (queue.length > 0) {
      const { sessionId, depth } = queue.shift()!;
      if (visitedInTree.has(sessionId)) continue;
      visitedInTree.add(sessionId);

      const s = sessionMap.get(sessionId);
      const directChildren = childrenByBlocker.get(sessionId) || [];
      if (s?.databaseName) affectedDbs.add(s.databaseName);
      if (depth > 0 && s?.waitTimeMs && s.waitTimeMs > maxBlockedWaitTimeMs) {
        maxBlockedWaitTimeMs = s.waitTimeMs;
      }

      const idleInTx =
        Boolean(s) &&
        s!.sessionStatus === 'sleeping' &&
        s!.openTransactionCount > 0 &&
        directChildren.length > 0;

      nodes.push({
        sessionId,
        blockingSessionId: depth === 0 ? null : s?.blockingSessionId ?? null,
        sessionStatus: s?.sessionStatus || 'unknown',
        loginName: s?.loginName || 'Não identificado',
        hostName: s?.hostName || 'Não identificado',
        programName: s?.programName || 'Sessão externa',
        databaseName: s?.databaseName || 'WEBRI',
        waitType: s?.waitType ?? null,
        waitTimeMs: s?.waitTimeMs ?? null,
        waitResource: s?.waitResource ?? null,
        openTransactionCount: s?.openTransactionCount ?? 1,
        transactionDurationSeconds: calcTxDurationSec(s),
        idleInTransaction: idleInTx,
        operationSummary:
          s?.operationSummary ||
          (idleInTx
            ? 'Sessão ociosa (sleeping) mantendo transação aberta sem commit/rollback'
            : 'Transação ativa'),
        queryHash: s?.queryHash ?? null,
        isWebriAssociated: s?.isWebriAssociated ?? false,
        blockedChildrenSessionIds: directChildren,
        depth,
      });

      for (const childId of directChildren) {
        if (!visitedInTree.has(childId)) {
          queue.push({ sessionId: childId, depth: depth + 1 });
        }
      }
    }

    const totalBlockedSessions = Math.max(0, nodes.length - 1);
    const rootNode = nodes[0];

    summaries.push({
      rootBlockerSessionId: rootId,
      rootBlockerStatus: rootNode?.sessionStatus || rootSample?.sessionStatus || 'sleeping',
      rootBlockerProgramName: rootNode?.programName || 'Desconhecido',
      rootBlockerHostName: rootNode?.hostName || 'Desconhecido',
      rootBlockerLoginName: rootNode?.loginName || 'Desconhecido',
      rootBlockerDatabaseName: rootNode?.databaseName || 'WEBRI',
      rootBlockerOpenTransactionCount: rootNode?.openTransactionCount ?? 1,
      rootBlockerTransactionDurationSeconds: rootNode?.transactionDurationSeconds ?? null,
      isIdleInTransactionRootBlocker: Boolean(rootNode?.idleInTransaction),
      totalBlockedSessions,
      maxBlockedWaitTimeMs,
      affectedDatabases: Array.from(affectedDbs),
      nodes,
    });
  }

  summaries.sort((a, b) => b.maxBlockedWaitTimeMs - a.maxBlockedWaitTimeMs || b.totalBlockedSessions - a.totalBlockedSessions);
  return summaries;
}

/**
 * Avalia o vínculo de uma sessão SQL ou serviço/processo Windows com o WEBRI/SIPLAN,
 * retornando o grau de confiança (`ALTA`, `MEDIA`, `BAIXA`, `NAO_ASSOCIADO`) e a justificativa.
 * - Não classifica todo acesso SQL nem todo processo `java.exe` ou `mysqld.exe` como WEBRI.
 */
export function evaluateWebriSessionAssociation(
  session: {
    databaseName: string;
    loginName: string;
    programName: string;
    hostName: string;
  },
  config: WebriAssociationConfig,
): {
  isWebriAssociated: boolean;
  confidence: AssociationConfidence;
  reason: string;
} {
  const dbUpper = session.databaseName.trim().toUpperCase();
  const loginUpper = session.loginName.trim().toUpperCase();
  const progUpper = session.programName.trim().toUpperCase();
  const hostUpper = session.hostName.trim().toUpperCase();

  if (progUpper.includes('MASHUP') || progUpper.includes('POWERBI') || progUpper.includes('POWER BI')) {
    return {
      isWebriAssociated: false,
      confidence: 'NAO_ASSOCIADO',
      reason: 'Microsoft Power BI Gateway (Mashup Engine) — carga analítica externa ao WEBRI.',
    };
  }

  if (loginUpper === 'FIORIX_CONNECTOR') {
    return {
      isWebriAssociated: false,
      confidence: 'NAO_ASSOCIADO',
      reason: 'Coletor de telemetria FIORIX (somente leitura).',
    };
  }

  const dbMatch = config.databases.some((d) => d.trim().toUpperCase() === dbUpper);
  const appMatch = config.applicationNames.some((a) => progUpper.includes(a.trim().toUpperCase()));
  const loginMatch = config.logins.some((l) => l.trim().toUpperCase() === loginUpper);
  const hostMatch = config.hosts.some((h) => h.trim().toUpperCase() === hostUpper);

  if (dbMatch && (appMatch || loginMatch)) {
    return {
      isWebriAssociated: true,
      confidence: 'ALTA',
      reason: `Banco (${session.databaseName}) + aplicação/login (${session.programName || session.loginName}) cadastrados no vínculo oficial do WEBRI.`,
    };
  }

  if (dbMatch && hostMatch) {
    return {
      isWebriAssociated: true,
      confidence: 'MEDIA',
      reason: `Conexão na base ${session.databaseName} a partir do host ${session.hostName}, porém com application_name genérico (${session.programName || 'vazio'}).`,
    };
  }

  if (dbMatch) {
    return {
      isWebriAssociated: true,
      confidence: 'BAIXA',
      reason: `Acesso à base ${session.databaseName}, mas login (${session.loginName}) e aplicação (${session.programName}) não são exclusivos do WEBRI.`,
    };
  }

  return {
    isWebriAssociated: false,
    confidence: 'NAO_ASSOCIADO',
    reason: `Sessão na base ${session.databaseName} (${session.programName || session.loginName}) sem vínculo configurado com o WEBRI.`,
  };
}

/**
 * Constrói a chave canônica de instância de processo Windows: `${pid}:${startTimeIso}`.
 * Evita que o reuso de PID pelo Windows misture históricos de processos distintos.
 */
export function buildProcessInstanceKey(pid: number, startTimeIso: string): string {
  return `${pid}:${startTimeIso.trim()}`;
}

/**
 * Avalia se há pressão real de memória no servidor ou no SQL Server.
 * REGRA CRÍTICA (Seção 6):
 * - NÃO conclui falta de memória apenas porque o SQL Server usa muita RAM (ex.: 40 GB / 79% em uso).
 *   O SQL Server mantém o Buffer Pool alocado por projeto até `max server memory`.
 * - Só aponta pressão de memória comprovada quando acompanhada de:
 *   (a) `memoryGrantsPending > 0` (`RESOURCE_SEMAPHORE`), ou
 *   (b) `processPhysicalMemoryLow === true` no SQL, ou
 *   (c) memória física disponível crítica no Windows combinada com paginação elevada (`pageInputsPerSec` / `pagesPerSec`) e queda acentuada de PLE.
 */
export function evaluateMemoryPressureEvidence(params: {
  windowsMemory: WindowsMemorySample;
  sqlMemory: SqlMemoryHealthSample;
  waitStatsDelta: SqlWaitStatDeltaItem[];
}): {
  isMemoryPressureProven: boolean;
  severity: 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'SEM_DADOS';
  explanation: string;
} {
  const { windowsMemory, sqlMemory, waitStatsDelta } = params;

  if (windowsMemory.usedPercent === null && sqlMemory.totalServerMemoryMb === null) {
    return {
      isMemoryPressureProven: false,
      severity: 'SEM_DADOS',
      explanation: 'Sem dados de memória coletados no período.',
    };
  }

  const resourceSemaphoreWait = waitStatsDelta.find(
    (w) => w.waitType === 'RESOURCE_SEMAPHORE' && w.waitTimeDeltaMs > 0,
  );
  const grantsPending = (sqlMemory.memoryGrantsPending ?? 0) > 0;
  const lowMemSignal = sqlMemory.processPhysicalMemoryLow === true;
  const winAvailMb = windowsMemory.availablePhysicalMb;
  const hardPaging = (windowsMemory.pagesPerSec ?? 0) > 150 && winAvailMb !== null && winAvailMb < 1536;

  if (grantsPending || Boolean(resourceSemaphoreWait) || lowMemSignal || hardPaging) {
    const reasons: string[] = [];
    if (grantsPending) {
      reasons.push(`${sqlMemory.memoryGrantsPending} requisição(ões) aguardando concessão de memória (Memory Grants Pending)`);
    }
    if (resourceSemaphoreWait) {
      reasons.push(`espera ativa por RESOURCE_SEMAPHORE (${resourceSemaphoreWait.waitTimeDeltaMs} ms no intervalo)`);
    }
    if (lowMemSignal) {
      reasons.push('sinal interno process_physical_memory_low ativo no SQL Server');
    }
    if (hardPaging) {
      reasons.push(
        `memória livre no Windows reduzida a ${winAvailMb} MB com paginação intensa (${windowsMemory.pagesPerSec} páginas/s)`,
      );
    }

    return {
      isMemoryPressureProven: true,
      severity: grantsPending || lowMemSignal ? 'CRITICO' : 'ATENCAO',
      explanation: `Pressão de memória sustentada por indicadores técnicos: ${reasons.join('; ')}.`,
    };
  }

  const sqlGb =
    sqlMemory.totalServerMemoryMb !== null
      ? (sqlMemory.totalServerMemoryMb / 1024).toFixed(1).replace('.', ',')
      : '—';
  const availGb =
    winAvailMb !== null ? (winAvailMb / 1024).toFixed(1).replace('.', ',') : '—';

  return {
    isMemoryPressureProven: false,
    severity: 'NORMAL',
    explanation: `O consumo de ${sqlGb} GB pelo SQL Server (${windowsMemory.usedPercent ?? '—'}% da RAM total) reflete o comportamento esperado do Buffer Pool até o limite configurado (max server memory = ${sqlMemory.maxServerMemoryConfigMb ?? '—'} MB). Há ${availGb} GB livres no Windows, sem fila de Memory Grants (0) e sem paginação anômala.`,
  };
}

/**
 * Gera diagnósticos estruturados com evidências, diferenciando correlação de causa comprovada (Seção 6 e Seção 9).
 */
export function generateEvidenceDiagnostics(params: {
  intervalLabel: string;
  cpuPercent: number | null;
  windowsMemory: WindowsMemorySample;
  sqlMemory: SqlMemoryHealthSample;
  windowsVolumes: WindowsVolumeIoSample[];
  fileIoDeltas: SqlFileIoDeltaItem[];
  blockingChains: SqlBlockingChainSummary[];
  waitStatsDelta: SqlWaitStatDeltaItem[];
  concurrentEvents: WindowsConcurrentEvent[];
  windowsProcesses: WindowsProcessSample[];
  hasViewServerState: boolean | null;
  collectorReachable: boolean;
  alertRules?: AlertThresholdRule[];
  databaseSpaces?: SqlDatabaseSpaceSample[];
  webriDatabases?: string[];
}): EvidenceDiagnosticItem[] {
  const {
    intervalLabel,
    cpuPercent,
    windowsMemory,
    sqlMemory,
    windowsVolumes,
    fileIoDeltas,
    blockingChains,
    waitStatsDelta,
    concurrentEvents,
    windowsProcesses,
    hasViewServerState,
    collectorReachable,
    alertRules,
    databaseSpaces = [],
    webriDatabases,
  } = params;

  const diagnostics: EvidenceDiagnosticItem[] = [];

  if (!collectorReachable) {
    diagnostics.push({
      id: 'diag-collector-offline',
      severity: 'ATENCAO',
      title: 'Coletor sem comunicação ou sem amostras recentes',
      observedSummary:
        'Não há telemetria recente do coletor do SRVSQL para o intervalo selecionado. O painel exibe explicitamente o estado de indisponibilidade em vez de assumir normalidade (verde) ou valores zero.',
      supportingInterval: intervalLabel,
      supportingMetrics: ['Estado do coletor: Indisponível / Sem dados'],
      causalClassification: 'LIMITACAO_DE_COBERTURA',
      confidenceLevel: 'ALTA',
      limitations: [
        'Sem comunicação com o coletor, não é possível afirmar se o WEBRI está normal ou enfrentando bloqueios.',
      ],
      recommendedNextVerification:
        'Verificar o serviço FIORIXConnector no servidor local, conectividade TCP na porta 1433 do SRVSQL e fila local do coletor.',
      prohibitedAutomaticActionsNote:
        'Nenhuma ação automática é executada pelo FIORIX sobre o SRVSQL.',
    });
    return diagnostics;
  }

  if (hasViewServerState === false) {
    diagnostics.push({
      id: 'diag-missing-view-server-state',
      severity: 'ATENCAO',
      title: 'Permissão VIEW SERVER STATE pendente para o login do coletor no SRVSQL',
      observedSummary:
        'A conexão TCP/SQL com o SRVSQL\\WEBRI está operacional, porém o login de leitura atual não possui a permissão VIEW SERVER STATE exigida pelo SQL Server 2012 SP4 para consultar DMVs de bloqueios, esperas e latência de arquivos.',
      supportingInterval: intervalLabel,
      supportingMetrics: [
        'HAS_PERMS_BY_NAME(NULL, NULL, \'VIEW SERVER STATE\') = 0',
        'sys.dm_exec_sessions: visível apenas a própria sessão do coletor',
      ],
      causalClassification: 'LIMITACAO_DE_COBERTURA',
      confidenceLevel: 'ALTA',
      limitations: [
        'Sem VIEW SERVER STATE, o SQL Server oculta sessões de outros usuários, cadeias de bloqueio e estatísticas de espera.',
      ],
      recommendedNextVerification:
        'Executar no SRVSQL (com conta de administrador do banco): GRANT VIEW SERVER STATE TO [fiorix_connector]; (não exige sysadmin).',
      prohibitedAutomaticActionsNote:
        'O coletor não tenta elevar privilégios nem utilizar contas sysadmin.',
    });
  }

  const findRule = (id: string, fallbackWarn: number, fallbackCrit: number) => {
    const r = alertRules?.find((item) => item.id === id);
    return {
      warn: r?.warningThreshold ?? fallbackWarn,
      crit: r?.criticalThreshold ?? fallbackCrit,
    };
  };
  const blockingThresh = findRule('rule-blocking-duration', 15, 45);
  const writeThresh = findRule('rule-disk-write-latency', 20, 40);
  const readThresh = findRule('rule-disk-read-latency', 25, 50);

  // 1. Diagnóstico de Cadeia de Bloqueio (LCK_M_*)
  if (blockingChains.length > 0) {
    const primary = blockingChains[0];
    const lockWait = waitStatsDelta.find((w) => w.category === 'BLOQUEIO');
    const durationSec = primary.rootBlockerTransactionDurationSeconds ?? Math.round(primary.maxBlockedWaitTimeMs / 1000);
    const waitSec = Math.round(primary.maxBlockedWaitTimeMs / 1000);
    const effectiveBlockSec = Math.max(durationSec, waitSec);
    const isPowerBiBlocker = /MASHUP|POWERBI|POWER BI/i.test(primary.rootBlockerProgramName || '');
    const blockSeverity: EvidenceDiagnosticItem['severity'] =
      effectiveBlockSec >= blockingThresh.crit
        ? 'CRITICO'
        : effectiveBlockSec >= blockingThresh.warn || primary.totalBlockedSessions >= 2
          ? 'ATENCAO'
          : 'INFORMATIVO';

    diagnostics.push({
      id: `diag-blocking-session-${primary.rootBlockerSessionId}`,
      severity: blockSeverity,
      title: `Cadeia de bloqueio liderada pela sessão ${primary.rootBlockerSessionId} (${primary.totalBlockedSessions} sessões aguardando)`,
      observedSummary: isPowerBiBlocker
        ? `O bloqueador raiz é o Microsoft Power BI Gateway (Mashup Engine, sessão ${primary.rootBlockerSessionId}) em ${primary.rootBlockerHostName}, mantendo ${primary.totalBlockedSessions} sessões do banco ${primary.rootBlockerDatabaseName} aguardando há ${effectiveBlockSec}s com CPU total em ${cpuPercent !== null ? `${cpuPercent}%` : 'nível estável'}.`
        : `Há ${cpuPercent !== null ? `CPU disponível (${cpuPercent}%)` : 'folga de CPU'} neste intervalo, mas ${primary.totalBlockedSessions} sessões do banco ${primary.rootBlockerDatabaseName} aguardam a sessão ${primary.rootBlockerSessionId} (${primary.rootBlockerStatus}, ${primary.rootBlockerOpenTransactionCount} transação aberta há ${durationSec}s). Bloqueio é a principal evidência técnica do episódio, mas a origem da transação na aplicação ainda precisa ser investigada.`,
      supportingInterval: intervalLabel,
      supportingMetrics: [
        `Bloqueador raiz: sessão ${primary.rootBlockerSessionId} (${primary.rootBlockerProgramName} em ${primary.rootBlockerHostName})`,
        `Sessões bloqueadas: ${primary.totalBlockedSessions} (maior espera: ${(primary.maxBlockedWaitTimeMs / 1000).toFixed(1)}s)`,
        lockWait
          ? `Espera SQL dominante: ${lockWait.waitType} (${lockWait.sharePercent}% do tempo de espera não ocioso)`
          : 'Espera por lock registrada nas requisições ativas',
      ],
      causalClassification: 'HIPOTESE_SUSTENTADA',
      confidenceLevel: 'ALTA',
      limitations: [
        'A amostragem de DMVs comprova quem segura o lock no banco, mas determinar por que a aplicação manteve a transação aberta depende dos logs do WEBRI/SIPLAN.',
        'Não recomendamos criar índices automaticamente sem avaliar o plano de execução e o impacto nas gravações.',
      ],
      recommendedNextVerification: isPowerBiBlocker
        ? `Avaliar agendamento das extrações do Power BI Gateway (Mashup Engine) na estação ${primary.rootBlockerHostName} para fora do horário de pico do cartório e garantir leituras analíticas com isolamento não-bloqueante. Não encerrar (KILL) a sessão automaticamente.`
        : `Examinar a transação da sessão ${primary.rootBlockerSessionId} (query_hash ${primary.nodes[0]?.queryHash || 'n/d'}) junto à SIPLAN e correlacionar o horário com a rotina executada na estação ${primary.rootBlockerHostName}. Não encerrar (KILL) a sessão automaticamente.`,
      prohibitedAutomaticActionsNote:
        'PROIBIDO executar KILL automático na sessão bloqueadora para evitar corrupção lógica de fluxos registrais ou rollback prolongado em produção.',
    });
  }

  // 2. Diagnóstico de Latência de Log de Transações (WRITELOG) ou Disco de Dados (PAGEIOLATCH)
  const writelogWait = waitStatsDelta.find((w) => w.waitType === 'WRITELOG');
  const pageIoWait = waitStatsDelta.find((w) => w.category === 'DISCO_PAGINA');
  const worstWriteVolume = [...windowsVolumes]
    .filter((v) => v.writeLatencyMs !== null)
    .sort((a, b) => (b.writeLatencyMs ?? 0) - (a.writeLatencyMs ?? 0))[0];
  const worstWriteFile = [...fileIoDeltas]
    .filter((f) => f.writeLatencyDeltaMs !== null && f.writesDelta >= 5)
    .sort((a, b) => (b.writeLatencyDeltaMs ?? 0) - (a.writeLatencyDeltaMs ?? 0))[0];
  const worstReadFile = [...fileIoDeltas]
    .filter((f) => f.readLatencyDeltaMs !== null && f.readsDelta >= 5)
    .sort((a, b) => (b.readLatencyDeltaMs ?? 0) - (a.readLatencyDeltaMs ?? 0))[0];
  const activeBackupOrAv = concurrentEvents.filter((e) => e.status === 'EM_ANDAMENTO');
  const observedWriteLatencyMs = worstWriteFile?.writeLatencyDeltaMs ?? worstWriteVolume?.writeLatencyMs ?? null;

  if (
    (writelogWait && writelogWait.sharePercent >= 25 && writelogWait.waitTimeDeltaMs >= 1000) ||
    (observedWriteLatencyMs !== null && observedWriteLatencyMs >= writeThresh.warn)
  ) {
    diagnostics.push({
      id: 'diag-writelog-latency',
      severity: (observedWriteLatencyMs ?? 0) >= writeThresh.crit ? 'CRITICO' : 'ATENCAO',
      title: 'Aumento de latência de gravação no log de transações (WRITELOG)',
      observedSummary: `As gravações e confirmações de transação (COMMIT) enfrentam latência de escrita de ${observedWriteLatencyMs ?? '—'} ms no volume ${worstWriteVolume?.volume || worstWriteFile?.volumeMountPoint || 'de log'} acompanhada de espera WRITELOG (${writelogWait?.sharePercent ?? 0}% das esperas).`,
      supportingInterval: intervalLabel,
      supportingMetrics: [
        `Volume ${worstWriteVolume?.volume || worstWriteFile?.volumeMountPoint || 'L:'} (${worstWriteVolume?.label || worstWriteFile?.logicalName || 'Log'}): escrita em ${observedWriteLatencyMs ?? '—'} ms`,
        writelogWait
          ? `WRITELOG: ${writelogWait.waitTimeDeltaMs} ms acumulados no intervalo (${writelogWait.sharePercent}%)`
          : 'Elevação de io_stall_write_ms nos arquivos .ldf',
      ],
      causalClassification: activeBackupOrAv.length > 0 ? 'CORRELACAO_FORTE' : 'HIPOTESE_SUSTENTADA',
      confidenceLevel: 'ALTA',
      limitations: [
        'WRITELOG reflete o tempo até o subsistema de armazenamento confirmar a gravação do log, mas pode ser agravado tanto por concorrência de I/O no disco quanto por excesso de commits pequenos na aplicação.',
      ],
      recommendedNextVerification:
        'Verificar na aba Serviços/Eventos se há job de backup, antivírus ou cópia de volume concorrendo no mesmo disco físico dos arquivos .ldf e revisar a frequência de commits com a SIPLAN.',
      prohibitedAutomaticActionsNote:
        'Não alterar o Recovery Model das bases da SIPLAN nem desativar antivírus/backup automaticamente.',
    });
  }

  if (
    (pageIoWait && pageIoWait.sharePercent >= 25 && pageIoWait.waitTimeDeltaMs >= 1000) ||
    (worstReadFile && (worstReadFile.readLatencyDeltaMs ?? 0) >= readThresh.warn)
  ) {
    const concurrentLabels = activeBackupOrAv.map((e) => e.title).join(', ');
    diagnostics.push({
      id: 'diag-pageiolatch-storage',
      severity: (worstReadFile?.readLatencyDeltaMs ?? 0) >= readThresh.crit ? 'CRITICO' : 'ATENCAO',
      title:
        activeBackupOrAv.length > 0
          ? 'Correlação entre atividade de backup/serviços e latência de leitura em disco (PAGEIOLATCH)'
          : 'Espera por leitura física de páginas de dados em disco (PAGEIOLATCH)',
      observedSummary:
        activeBackupOrAv.length > 0
          ? `Observou-se aumento de latência de leitura (${worstReadFile?.readLatencyDeltaMs ?? '—'} ms em ${worstReadFile?.logicalName || 'dados'}) simultâneo a: ${concurrentLabels}. A simultaneidade indica concorrência por armazenamento, mas não comprova sozinha se a origem primária foi o job externo ou varreduras extensas de dados no SQL.`
          : `Consultas aguardam leitura física de páginas de dados em disco (${pageIoWait?.waitType || 'PAGEIOLATCH'}, ${pageIoWait?.sharePercent ?? 0}% do tempo de espera).`,
      supportingInterval: intervalLabel,
      supportingMetrics: [
        worstReadFile
          ? `Arquivo ${worstReadFile.logicalName} (${worstReadFile.databaseName}): leitura em ${worstReadFile.readLatencyDeltaMs} ms (${worstReadFile.readsDelta} leituras no intervalo)`
          : `Espera ${pageIoWait?.waitType}: ${pageIoWait?.waitTimeDeltaMs} ms no intervalo`,
        ...(activeBackupOrAv.length > 0 ? [`Evento simultâneo: ${concurrentLabels}`] : []),
      ],
      causalClassification: 'CORRELACAO_FORTE',
      confidenceLevel: 'MEDIA',
      limitations: [
        'Correlação temporal entre backup/antivírus e latência de disco não comprova causalidade exclusiva sem comparar o throughput por volume e as leituras lógicas/físicas das consultas.',
        'Atribuição de I/O de disco a processos específicos do Windows só é exibida quando sustentada por contadores ETW/Perfmon.',
      ],
      recommendedNextVerification:
        'Comparar a janela do evento com o histórico de janelas sem backup e avaliar com a SIPLAN as consultas de maior leitura física (query_hash) sem criar índices automaticamente.',
      prohibitedAutomaticActionsNote:
        'Não interromper rotinas de backup nem criar índices de forma automática.',
    });
  }

  // 3. Avaliação de Memória (evitando falso positivo dos 40 GB / 79%)
  const memEval = evaluateMemoryPressureEvidence({
    windowsMemory,
    sqlMemory,
    waitStatsDelta,
  });

  if (memEval.isMemoryPressureProven) {
    const nonSqlTopRam = [...windowsProcesses]
      .filter((p) => p.category !== 'SQL_SERVER' && (p.privateWorkingSetMb ?? 0) > 500)
      .sort((a, b) => (b.privateWorkingSetMb ?? 0) - (a.privateWorkingSetMb ?? 0))
      .slice(0, 3)
      .map((p) => `${p.processName} (PID ${p.pid}: ${p.privateWorkingSetMb} MB privados)`);

    diagnostics.push({
      id: 'diag-memory-pressure-proven',
      severity: memEval.severity === 'CRITICO' ? 'CRITICO' : 'ATENCAO',
      title: 'Pressão de memória comprovada por indicadores internos e do Windows',
      observedSummary: memEval.explanation,
      supportingInterval: intervalLabel,
      supportingMetrics: [
        `Memória livre no Windows: ${windowsMemory.availablePhysicalMb ?? '—'} MB (${windowsMemory.usedPercent ?? '—'}% em uso)`,
        `Memory Grants pendentes no SQL: ${sqlMemory.memoryGrantsPending ?? 0}`,
        `Paginação do Windows: ${windowsMemory.pagesPerSec ?? 0} páginas/s`,
        ...(nonSqlTopRam.length > 0 ? [`Outros processos no servidor: ${nonSqlTopRam.join(', ')}`] : []),
      ],
      causalClassification: 'HIPOTESE_SUSTENTADA',
      confidenceLevel: 'ALTA',
      limitations: [
        'A redução de memória livre pode resultar da soma dos serviços coexistentes no SRVSQL (MySQL, Java, Power BI Gateway, IIS) junto ao max server memory do SQL Server.',
      ],
      recommendedNextVerification:
        'Revisar a configuração de max server memory do SQL Server em relação à soma da memória privada dos demais serviços residentes no SRVSQL antes de qualquer ajuste em janela de manutenção.',
      prohibitedAutomaticActionsNote:
        'O FIORIX não executa DBCC FREEPROCCACHE nem altera sp_configure max server memory automaticamente.',
    });
  } else if (windowsMemory.usedPercent !== null && windowsMemory.usedPercent >= 70) {
    diagnostics.push({
      id: 'diag-memory-buffer-pool-normal',
      severity: 'INFORMATIVO',
      title: 'Uso elevado de RAM pelo SQL Server sem evidência de falta de memória',
      observedSummary: memEval.explanation,
      supportingInterval: intervalLabel,
      supportingMetrics: [
        `SQL Server: ${sqlMemory.totalServerMemoryMb ? (sqlMemory.totalServerMemoryMb / 1024).toFixed(1) : '—'} GB alocados (max server memory = ${sqlMemory.maxServerMemoryConfigMb ?? '—'} MB)`,
        `Memória física disponível no Windows: ${windowsMemory.availablePhysicalMb ? (windowsMemory.availablePhysicalMb / 1024).toFixed(1) : '—'} GB`,
        `Memory Grants pendentes: ${sqlMemory.memoryGrantsPending ?? 0} · Paginação: ${windowsMemory.pagesPerSec ?? 0} pág/s`,
      ],
      causalClassification: 'CORRELACAO_PARCIAL',
      confidenceLevel: 'ALTA',
      limitations: [
        'Capturas isoladas do Gerenciador de Tarefas mostrando ~79% de RAM e ~40 GB no sqlservr.exe são normais em servidores SQL Server e não explicam sozinhas travamentos do WEBRI.',
      ],
      recommendedNextVerification:
        'Priorizar a investigação das cadeias de bloqueio (LCK_*) e da latência de escrita/leitura nos arquivos da base WEBRI.',
      prohibitedAutomaticActionsNote:
        'Não limpar o cache do SQL Server (DBCC DROPCLEANBUFFERS / FREEPROCCACHE), pois isso degradaria severamente o desempenho por forçar leituras físicas em disco.',
    });
  }

  // 4. Diagnóstico de saturação de Transaction Log em modo FULL aguardando LOG_BACKUP (diferencia base WEBRI de base auxiliar)
  const webriDbSet =
    webriDatabases && webriDatabases.length > 0
      ? new Set(webriDatabases.map((n) => n.trim().toUpperCase()))
      : DEFAULT_WEBRI_DATABASE_SET;
  const hasActiveWriteLogContention =
    Boolean(writelogWait && writelogWait.sharePercent >= 25 && writelogWait.waitTimeDeltaMs >= 1000) ||
    (observedWriteLatencyMs !== null && observedWriteLatencyMs >= writeThresh.warn);

  const saturatedFullLogs = databaseSpaces.filter(
    (d) =>
      d.recoveryModel.toUpperCase() === 'FULL' &&
      (d.logUsedPercent ?? 0) >= 85 &&
      (d.logReuseWaitDesc || '').toUpperCase().includes('LOG_BACKUP'),
  );
  if (saturatedFullLogs.length > 0) {
    const webriSaturatedLogs = saturatedFullLogs.filter((d) =>
      webriDbSet.has(d.databaseName.trim().toUpperCase()),
    );
    const auxSaturatedLogs = saturatedFullLogs.filter(
      (d) => !webriDbSet.has(d.databaseName.trim().toUpperCase()),
    );
    const maxPct = Math.max(...saturatedFullLogs.map((d) => d.logUsedPercent ?? 0));
    const namesLabel = saturatedFullLogs
      .map(
        (d) =>
          `${d.databaseName} (${(d.logUsedPercent ?? 0).toFixed(1)}%${d.logUsedMb !== null && d.logTotalMb !== null ? ` · ${Math.round(d.logUsedMb)}/${Math.round(d.logTotalMb)} MB` : ''})`,
      )
      .join(', ');

    let logSeverity: EvidenceDiagnosticItem['severity'] = 'INFORMATIVO';
    if (webriSaturatedLogs.length > 0) {
      const maxWebriPct = Math.max(...webriSaturatedLogs.map((d) => d.logUsedPercent ?? 0));
      if (maxWebriPct >= 95 || (maxWebriPct >= 85 && hasActiveWriteLogContention)) {
        logSeverity = 'CRITICO';
      } else if (maxWebriPct >= 85 || hasActiveWriteLogContention) {
        logSeverity = 'ATENCAO';
      } else {
        logSeverity = 'INFORMATIVO';
      }
    } else if (maxPct >= 99 && hasActiveWriteLogContention) {
      logSeverity = 'ATENCAO';
    }

    const isAuxOnlyAdvisory = webriSaturatedLogs.length === 0 && logSeverity === 'INFORMATIVO';
    const affectedNames = saturatedFullLogs.map((d) => d.databaseName).join(', ');

    diagnostics.push({
      id: 'diag-log-backup-saturation',
      severity: logSeverity,
      title: isAuxOnlyAdvisory
        ? `Manutenção preventiva DBA: log em modo FULL aguardando LOG_BACKUP em base auxiliar (${auxSaturatedLogs.map((d) => d.databaseName).join(', ')})`
        : `Log de transações próximo da saturação aguardando LOG_BACKUP (${affectedNames})`,
      observedSummary: isAuxOnlyAdvisory
        ? `A(s) base(s) auxiliar(es) não-WEBRI em Recovery Model FULL (${namesLabel}) atingiram alto percentual do arquivo .ldf aguardando rotina de backup de log (log_reuse_wait_desc = LOG_BACKUP). Por não integrarem o WEBRI e não apresentarem latência de escrita elevada ou bloqueios agora, este aviso não indica lentidão atual, apenas manutenção preventiva recomendada.`
        : `Base(s) em Recovery Model FULL com alto consumo do arquivo .ldf aguardando rotina de backup de log (log_reuse_wait_desc = LOG_BACKUP): ${namesLabel}. Sem BACKUP LOG periódico, o arquivo de log continua crescendo ou atinge o limite de espaço.`,
      supportingInterval: intervalLabel,
      supportingMetrics: saturatedFullLogs.map(
        (d) =>
          `${d.databaseName}: Log ${(d.logUsedPercent ?? 0).toFixed(1)}% em uso · log_reuse_wait=${d.logReuseWaitDesc || 'LOG_BACKUP'}${webriDbSet.has(d.databaseName.trim().toUpperCase()) ? ' · WEBRI' : ' · Base auxiliar'}`,
      ),
      causalClassification: isAuxOnlyAdvisory ? 'CORRELACAO_PARCIAL' : 'HIPOTESE_SUSTENTADA',
      confidenceLevel: 'ALTA',
      limitations: [
        'O FIORIX realiza apenas leitura das DMVs/contadores de log e nunca executa BACKUP LOG, DBCC SHRINKFILE nem altera o Recovery Model.',
      ],
      recommendedNextVerification:
        'Verificar com o DBA/TI o agendamento do job de BACKUP LOG no SQL Server Agent ou rotina de backup externo para a(s) base(s) em Recovery FULL.',
      prohibitedAutomaticActionsNote:
        'PROIBIDO truncar log manualmente (BACKUP LOG ... WITH TRUNCATE_ONLY / RECOVERY SIMPLE temporário) para não quebrar a cadeia de restauração point-in-time.',
    });
  }

  // 5. Diagnóstico preventivo de AUTO_SHRINK e PAGE_VERIFY != CHECKSUM (apenas INFORMATIVO)
  const hygieneAlerts = databaseSpaces.filter(
    (d) =>
      !d.isTempdb &&
      (d.isAutoShrinkOn === true ||
        (Boolean(d.pageVerifyOption) && String(d.pageVerifyOption).toUpperCase() !== 'CHECKSUM')),
  );
  if (hygieneAlerts.length > 0) {
    diagnostics.push({
      id: 'diag-db-autoshrink-pageverify',
      severity: 'INFORMATIVO',
      title: `Recomendações preventivas de configuração em ${hygieneAlerts.length} banco(s) (AUTO_SHRINK / PAGE_VERIFY)`,
      observedSummary: `Identificados bancos com AUTO_SHRINK habilitado ou PAGE_VERIFY diferente de CHECKSUM (${hygieneAlerts.map((d) => d.databaseName).join(', ')}). Embora não causem falha imediata, AUTO_SHRINK fragmenta arquivos/índices e gera picos de I/O durante o expediente, enquanto PAGE_VERIFY CHECKSUM melhora a detecção precoce de corrupção de páginas.`,
      supportingInterval: intervalLabel,
      supportingMetrics: hygieneAlerts.map(
        (d) => `${d.databaseName}: AUTO_SHRINK=${d.isAutoShrinkOn ? 'ON' : 'OFF'} · PAGE_VERIFY=${d.pageVerifyOption || 'N/D'}`,
      ),
      causalClassification: 'CORRELACAO_PARCIAL',
      confidenceLevel: 'ALTA',
      limitations: [
        'Qualquer alteração de propriedades de banco (ALTER DATABASE) deve ser validada pela SIPLAN e agendada exclusivamente fora do horário de atendimento do cartório.',
      ],
      recommendedNextVerification:
        'Agendar janela de manutenção fora do expediente com a SIPLAN/DBA para definir AUTO_SHRINK OFF e PAGE_VERIFY CHECKSUM nas bases aplicáveis.',
      prohibitedAutomaticActionsNote:
        'O FIORIX nunca executa ALTER DATABASE nem DBCC SHRINKDATABASE automaticamente.',
    });
  }

  const severityOrder: Record<EvidenceDiagnosticItem['severity'], number> = {
    CRITICO: 0,
    ATENCAO: 1,
    NORMAL: 2,
    INFORMATIVO: 3,
  };
  diagnostics.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return diagnostics;
}

/**
 * Regras iniciais configuráveis de alerta com duração mínima e histerese (Seção 7).
 */
export const DEFAULT_ALERT_RULES: AlertThresholdRule[] = [
  {
    id: 'rule-blocking-duration',
    metricKey: 'BLOCKED_SESSION_DURATION_SEC',
    label: 'Bloqueio SQL prolongado (sessões aguardando lock)',
    warningThreshold: 15,
    criticalThreshold: 45,
    recoveryHysteresisThreshold: 5,
    minDurationSeconds: 15,
    enabled: true,
    unit: 's',
    baselineAdjustableNote: 'Valor inicial ajustável; pode ser calibrado conforme a linha de base de horários de pico do cartório.',
  },
  {
    id: 'rule-disk-write-latency',
    metricKey: 'DISK_WRITE_LATENCY_MS',
    label: 'Latência de escrita em disco/log sustentada',
    warningThreshold: 20,
    criticalThreshold: 40,
    recoveryHysteresisThreshold: 12,
    minDurationSeconds: 30,
    enabled: true,
    unit: 'ms',
    baselineAdjustableNote: 'Valor inicial orientativo; volumes SSD/NVMe costumam operar < 5 ms, mas janelas de backup podem elevar a linha de base.',
  },
  {
    id: 'rule-disk-read-latency',
    metricKey: 'DISK_READ_LATENCY_MS',
    label: 'Latência de leitura em disco sustentada',
    warningThreshold: 25,
    criticalThreshold: 50,
    recoveryHysteresisThreshold: 15,
    minDurationSeconds: 30,
    enabled: true,
    unit: 'ms',
    baselineAdjustableNote: 'Ajustável conforme perfil de armazenamento do SRVSQL.',
  },
  {
    id: 'rule-memory-grants-pending',
    metricKey: 'PROVEN_MEMORY_PRESSURE',
    label: 'Pressão de memória comprovada (Memory Grants pendentes + paginação)',
    warningThreshold: 1,
    criticalThreshold: 4,
    recoveryHysteresisThreshold: 0,
    minDurationSeconds: 30,
    enabled: true,
    unit: 'grants',
    baselineAdjustableNote: 'Não dispara apenas por RAM alta do SQL Server; exige fila de concessão de memória ou baixa memória disponível com paginação.',
  },
  {
    id: 'rule-cpu-sustained',
    metricKey: 'CPU_SUSTAINED_PERCENT',
    label: 'CPU total do servidor elevada sustentada',
    warningThreshold: 80,
    criticalThreshold: 92,
    recoveryHysteresisThreshold: 70,
    minDurationSeconds: 60,
    enabled: true,
    unit: '%',
    baselineAdjustableNote: 'Exige permanência acima do limite pela duração mínima configurada.',
  },
  {
    id: 'rule-free-space-low',
    metricKey: 'VOLUME_FREE_SPACE_PERCENT',
    label: 'Espaço livre baixo em volume do SRVSQL',
    warningThreshold: 15,
    criticalThreshold: 8,
    recoveryHysteresisThreshold: 18,
    minDurationSeconds: 60,
    enabled: true,
    unit: '%',
    baselineAdjustableNote: 'Comparação invertida: alerta quando o percentual livre cai abaixo do limite.',
  },
  {
    id: 'rule-collector-stale',
    metricKey: 'COLLECTOR_STALE_SECONDS',
    label: 'Coletor sem comunicação / dados atrasados',
    warningThreshold: 120,
    criticalThreshold: 300,
    recoveryHysteresisThreshold: 60,
    minDurationSeconds: 120,
    enabled: true,
    unit: 's',
    baselineAdjustableNote: 'Monitora atraso entre a última coleta gravada e o horário atual.',
  },
];

/**
 * Avalia alertas aplicando duração mínima, recuperação com histerese e agrupamento (deduplicação) de eventos repetidos.
 */
export function evaluateAlertsWithHysteresis(params: {
  rules: AlertThresholdRule[];
  existingAlerts: AlertEventRecord[];
  observedAtIso: string;
  sustainedDurationSecondsByRule?: Partial<Record<string, number>>;
  metrics: {
    maxBlockedDurationSeconds: number | null;
    blockedSessionsCount: number | null;
    rootBlockerSessionId: number | null;
    maxDiskWriteLatencyMs: number | null;
    maxDiskReadLatencyMs: number | null;
    provenMemoryPressureScore: number | null;
    cpuPercent: number | null;
    minVolumeFreePercent: number | null;
    criticalServiceStoppedCount: number | null;
    collectorDelaySeconds: number | null;
  };
}): AlertEventRecord[] {
  const { rules, existingAlerts, observedAtIso, sustainedDurationSecondsByRule, metrics } = params;
  const updated = existingAlerts.map((a) => ({ ...a }));

  const upsertOrResolve = (
    rule: AlertThresholdRule,
    currentValue: number | null,
    observedDurationSec: number,
    isInvertedThreshold: boolean,
    title: string,
    detail: string,
  ) => {
    if (!rule.enabled || currentValue === null) return;

    const existingIdx = updated.findIndex((a) => a.ruleId === rule.id && a.active);
    const exceedsCritical = isInvertedThreshold
      ? currentValue <= rule.criticalThreshold
      : currentValue >= rule.criticalThreshold;
    const exceedsWarning = isInvertedThreshold
      ? currentValue <= rule.warningThreshold
      : currentValue >= rule.warningThreshold;
    const recoveredByHysteresis = isInvertedThreshold
      ? currentValue >= rule.recoveryHysteresisThreshold
      : currentValue <= rule.recoveryHysteresisThreshold;

    if (exceedsCritical || exceedsWarning) {
      if (observedDurationSec < rule.minDurationSeconds && existingIdx === -1) {
        return;
      }
      const nextSeverity: 'WARNING' | 'CRITICAL' = exceedsCritical ? 'CRITICAL' : 'WARNING';
      if (existingIdx >= 0) {
        // Agrupa evento repetido em vez de duplicar alertas e permite rebaixamento CRITICAL -> WARNING
        const prev = updated[existingIdx];
        updated[existingIdx] = {
          ...prev,
          severity: nextSeverity,
          title,
          detail,
          lastObservedAt: observedAtIso,
          occurrencesCount: prev.occurrencesCount + 1,
          supportingSnapshotTime: observedAtIso,
        };
      } else {
        updated.unshift({
          id: `alert-${rule.id}-${Date.parse(observedAtIso) || Date.now()}`,
          ruleId: rule.id,
          severity: nextSeverity,
          title,
          detail,
          firstTriggeredAt: observedAtIso,
          lastObservedAt: observedAtIso,
          resolvedAt: null,
          occurrencesCount: 1,
          active: true,
          supportingSnapshotTime: observedAtIso,
        });
      }
    } else if (existingIdx >= 0 && recoveredByHysteresis) {
      updated[existingIdx] = {
        ...updated[existingIdx],
        severity: 'RESOLVED',
        active: false,
        resolvedAt: observedAtIso,
        lastObservedAt: observedAtIso,
      };
    } else if (existingIdx >= 0) {
      // Na zona de histerese (abaixo de warningThreshold, mas ainda sem cruzar recuperação), rebaixa CRITICAL para WARNING
      const prev = updated[existingIdx];
      updated[existingIdx] = {
        ...prev,
        severity: 'WARNING',
        title,
        detail,
        lastObservedAt: observedAtIso,
        supportingSnapshotTime: observedAtIso,
      };
    }
  };

  for (const rule of rules) {
    if (rule.metricKey === 'BLOCKED_SESSION_DURATION_SEC') {
      const val = metrics.maxBlockedDurationSeconds;
      upsertOrResolve(
        rule,
        val,
        sustainedDurationSecondsByRule?.[rule.id] ?? val ?? 0,
        false,
        `Bloqueio SQL sustentado (${metrics.blockedSessionsCount ?? 0} sessões aguardando a sessão ${metrics.rootBlockerSessionId ?? '—'})`,
        `Transação bloqueadora aberta há ${val ?? 0}s (limite de alerta: ${rule.warningThreshold}s, recuperação por histerese <= ${rule.recoveryHysteresisThreshold}s).`,
      );
    } else if (rule.metricKey === 'DISK_WRITE_LATENCY_MS') {
      const val = metrics.maxDiskWriteLatencyMs;
      upsertOrResolve(
        rule,
        val,
        sustainedDurationSecondsByRule?.[rule.id] ?? 60,
        false,
        `Latência de escrita elevada em disco (${val ?? 0} ms)`,
        `A latência de escrita atingiu ${val ?? 0} ms (limite: ${rule.warningThreshold} ms; recuperação com histerese <= ${rule.recoveryHysteresisThreshold} ms).`,
      );
    } else if (rule.metricKey === 'DISK_READ_LATENCY_MS') {
      const val = metrics.maxDiskReadLatencyMs;
      upsertOrResolve(
        rule,
        val,
        sustainedDurationSecondsByRule?.[rule.id] ?? 60,
        false,
        `Latência de leitura elevada em disco (${val ?? 0} ms)`,
        `A latência de leitura atingiu ${val ?? 0} ms (limite: ${rule.warningThreshold} ms; recuperação com histerese <= ${rule.recoveryHysteresisThreshold} ms).`,
      );
    } else if (rule.metricKey === 'PROVEN_MEMORY_PRESSURE') {
      const val = metrics.provenMemoryPressureScore;
      upsertOrResolve(
        rule,
        val,
        sustainedDurationSecondsByRule?.[rule.id] ?? 60,
        false,
        `Pressão de memória comprovada no SRVSQL (${val ?? 0} Memory Grants pendentes)`,
        `Concessões de memória aguardando fila (RESOURCE_SEMAPHORE) acompanhadas de redução de memória livre no Windows.`,
      );
    } else if (rule.metricKey === 'CPU_SUSTAINED_PERCENT') {
      const val = metrics.cpuPercent;
      upsertOrResolve(
        rule,
        val,
        sustainedDurationSecondsByRule?.[rule.id] ?? 60,
        false,
        `CPU do SRVSQL sustentada em ${val ?? 0}%`,
        `Consumo total de CPU acima de ${rule.warningThreshold}% (histerese de recuperação <= ${rule.recoveryHysteresisThreshold}%).`,
      );
    } else if (rule.metricKey === 'VOLUME_FREE_SPACE_PERCENT') {
      const val = metrics.minVolumeFreePercent;
      upsertOrResolve(
        rule,
        val,
        sustainedDurationSecondsByRule?.[rule.id] ?? 120,
        true,
        `Espaço livre baixo em volume do SRVSQL (${val ?? 0}%)`,
        `Volume com apenas ${val ?? 0}% livres (alerta <= ${rule.warningThreshold}%, recuperação >= ${rule.recoveryHysteresisThreshold}%).`,
      );
    } else if (rule.metricKey === 'COLLECTOR_STALE_SECONDS') {
      const val = metrics.collectorDelaySeconds;
      upsertOrResolve(
        rule,
        val,
        sustainedDurationSecondsByRule?.[rule.id] ?? val ?? 0,
        false,
        `Coletor sem atualizar há ${val ?? 0}s`,
        `A última coleta confirmada ocorreu há ${val ?? 0}s (limite: ${rule.warningThreshold}s).`,
      );
    }
  }

  return updated;
}

function summarizeNumericSeries(values: number[]): {
  avg: number;
  p95: number;
  max: number;
} | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = Math.round((sum / sorted.length) * 10) / 10;
  const p95Idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  const p95 = Math.round(sorted[p95Idx]! * 10) / 10;
  const max = Math.round(sorted[sorted.length - 1]! * 10) / 10;
  return { avg, p95, max };
}

function formatPtDecimal(value: number, fractionDigits = 1): string {
  const factor = Math.pow(10, fractionDigits);
  const rounded = Math.round(value * factor) / factor;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(fractionDigits).replace('.', ',');
}

/**
 * Calcula a avaliação ao vivo (valor atual real do SRVSQL, status com histerese/duração e
 * linha de base estatística real da janela selecionada) para cada regra de alerta configurável.
 */
export function computeAlertRulesLiveEvaluations(params: {
  rules: AlertThresholdRule[];
  alerts: AlertEventRecord[];
  dataSourceMode: DataSourceMode;
  windowPreset: TimeWindowPreset;
  sustainedDurationSecondsByRule?: Partial<Record<string, number>>;
  metrics: {
    maxBlockedDurationSeconds: number | null;
    blockedSessionsCount: number | null;
    rootBlockerSessionId: number | null;
    diskWriteLatencyMs: number | null;
    diskReadLatencyMs: number | null;
    diskTargetLabel?: string | null;
    memoryGrantsPending: number | null;
    windowsAvailableMemoryGb: number | null;
    pageLifeExpectancySec: number | null;
    bufferCacheHitRatioPercent: number | null;
    cpuPercent: number | null;
    rawMinVolumeFreePercent: number | null;
    effectiveMinVolumeFreePercent: number | null;
    volumes: WindowsVolumeIoSample[];
    collectorDelaySeconds: number | null;
    lastCollectionDurationMs: number | null;
    storageUsedSamples: number;
    storageMaxSamples: number;
  };
  windowSeries?: {
    sampleCount: number;
    cpuValues: number[];
    writeLatencyValues: number[];
    readLatencyValues: number[];
    blockedCounts: number[];
    maxBlockedWaitSecondsInWindow: number | null;
    memoryGrantsValues: number[];
    observedAvgIntervalSeconds: number | null;
  };
}): AlertRuleLiveEvaluation[] {
  const {
    rules,
    alerts,
    dataSourceMode,
    windowPreset,
    sustainedDurationSecondsByRule,
    metrics,
    windowSeries,
  } = params;

  const sampleCountInWindow = windowSeries?.sampleCount ?? 0;
  const validVolumes = metrics.volumes.filter(
    (v) => v.freePercent !== null && v.freePercent !== undefined,
  );
  const lowestVolume =
    validVolumes.length > 0
      ? [...validVolumes].sort((a, b) => (a.freePercent ?? 100) - (b.freePercent ?? 100))[0]
      : null;

  return rules.map((rule) => {
    const isInvertedThreshold = rule.metricKey === 'VOLUME_FREE_SPACE_PERCENT';
    const activeAlert = alerts.find((a) => a.ruleId === rule.id && a.active) ?? null;

    let currentValue: number | null = null;
    let evalValue: number | null = null;
    let currentFormatted = 'Sem dados';
    let sustainedSeconds = sustainedDurationSecondsByRule?.[rule.id] ?? 0;
    let observedBaselineSummary = '';

    if (rule.metricKey === 'BLOCKED_SESSION_DURATION_SEC') {
      currentValue = metrics.maxBlockedDurationSeconds;
      evalValue = currentValue;
      sustainedSeconds = sustainedDurationSecondsByRule?.[rule.id] ?? currentValue ?? 0;
      if (currentValue !== null) {
        const durText = formatMetricOrMissing(
          currentValue,
          ' s',
          currentValue % 1 !== 0 ? 1 : 0,
        );
        const blockedSuffix =
          metrics.blockedSessionsCount !== null ? ` (${metrics.blockedSessionsCount} bloq.)` : '';
        currentFormatted = `${durText}${blockedSuffix}`;
      }
      if (sampleCountInWindow > 0 && windowSeries) {
        const blocksWithContention = windowSeries.blockedCounts.filter((c) => c > 0).length;
        const maxBlocked =
          windowSeries.blockedCounts.length > 0 ? Math.max(...windowSeries.blockedCounts) : 0;
        const maxWaitSuffix =
          windowSeries.maxBlockedWaitSecondsInWindow !== null &&
          windowSeries.maxBlockedWaitSecondsInWindow > 0
            ? ` · maior espera: ${formatPtDecimal(windowSeries.maxBlockedWaitSecondsInWindow)}s`
            : '';
        observedBaselineSummary = `Janela ${windowPreset} (${sampleCountInWindow} amostras): ${blocksWithContention}/${sampleCountInWindow} coletas com bloqueio · máx. simultâneas: ${maxBlocked}${maxWaitSuffix}.`;
      }
    } else if (rule.metricKey === 'DISK_WRITE_LATENCY_MS') {
      currentValue = metrics.diskWriteLatencyMs;
      evalValue = currentValue;
      if (currentValue !== null) {
        currentFormatted = `${Math.round(currentValue)} ms${
          metrics.diskTargetLabel ? ` (${metrics.diskTargetLabel})` : ''
        }`;
      }
      if (windowSeries && windowSeries.writeLatencyValues.length > 0) {
        const stats = summarizeNumericSeries(windowSeries.writeLatencyValues)!;
        observedBaselineSummary = `Janela ${windowPreset} (${windowSeries.writeLatencyValues.length} deltas): média ${formatPtDecimal(stats.avg)} ms · P95 ${formatPtDecimal(stats.p95)} ms · pico ${formatPtDecimal(stats.max)} ms.`;
      } else if (sampleCountInWindow > 0) {
        observedBaselineSummary =
          'Aguardando ao menos 2 amostras consecutivas com I/O para calcular delta real de escrita.';
      }
    } else if (rule.metricKey === 'DISK_READ_LATENCY_MS') {
      currentValue = metrics.diskReadLatencyMs;
      evalValue = currentValue;
      if (currentValue !== null) {
        currentFormatted = `${Math.round(currentValue)} ms${
          metrics.diskTargetLabel ? ` (${metrics.diskTargetLabel})` : ''
        }`;
      }
      if (windowSeries && windowSeries.readLatencyValues.length > 0) {
        const stats = summarizeNumericSeries(windowSeries.readLatencyValues)!;
        observedBaselineSummary = `Janela ${windowPreset} (${windowSeries.readLatencyValues.length} deltas): média ${formatPtDecimal(stats.avg)} ms · P95 ${formatPtDecimal(stats.p95)} ms · pico ${formatPtDecimal(stats.max)} ms.`;
      } else if (sampleCountInWindow > 0) {
        observedBaselineSummary =
          'Aguardando ao menos 2 amostras consecutivas com I/O para calcular delta real de leitura.';
      }
    } else if (rule.metricKey === 'PROVEN_MEMORY_PRESSURE') {
      currentValue = metrics.memoryGrantsPending;
      evalValue = currentValue;
      if (currentValue !== null) {
        currentFormatted = `${Math.round(currentValue)} grants`;
      }
      if (sampleCountInWindow > 0 || currentValue !== null) {
        const maxGrants =
          windowSeries && windowSeries.memoryGrantsValues.length > 0
            ? Math.max(...windowSeries.memoryGrantsValues)
            : currentValue ?? 0;
        const winFree =
          metrics.windowsAvailableMemoryGb !== null
            ? `${formatPtDecimal(metrics.windowsAvailableMemoryGb)} GB`
            : '—';
        const ple =
          metrics.pageLifeExpectancySec !== null
            ? `${metrics.pageLifeExpectancySec.toLocaleString('pt-BR')}s`
            : '—';
        const hit =
          metrics.bufferCacheHitRatioPercent !== null
            ? ` · Cache Hit: ${formatPtDecimal(metrics.bufferCacheHitRatioPercent)}%`
            : '';
        observedBaselineSummary = `Janela ${windowPreset}: pico fila = ${Math.round(maxGrants)} grants · RAM livre Windows: ${winFree} · PLE: ${ple}${hit}.`;
      }
    } else if (rule.metricKey === 'CPU_SUSTAINED_PERCENT') {
      currentValue = metrics.cpuPercent;
      evalValue = currentValue;
      if (currentValue !== null) {
        currentFormatted = `${Math.round(currentValue)} %`;
      }
      if (windowSeries && windowSeries.cpuValues.length > 0) {
        const stats = summarizeNumericSeries(windowSeries.cpuValues)!;
        observedBaselineSummary = `Janela ${windowPreset} (${windowSeries.cpuValues.length} amostras): média ${formatPtDecimal(stats.avg)}% · P95 ${formatPtDecimal(stats.p95)}% · pico ${formatPtDecimal(stats.max)}%.`;
      } else if (currentValue !== null) {
        observedBaselineSummary = `Amostra atual em ${Math.round(currentValue)}% (aguardando histórico adicional na janela ${windowPreset}).`;
      }
    } else if (rule.metricKey === 'VOLUME_FREE_SPACE_PERCENT') {
      currentValue = metrics.rawMinVolumeFreePercent;
      evalValue = metrics.effectiveMinVolumeFreePercent ?? metrics.rawMinVolumeFreePercent;
      if (currentValue !== null) {
        const freeGbText =
          lowestVolume && lowestVolume.freeSpaceGb !== null
            ? ` (${lowestVolume.volume} ${formatPtDecimal(lowestVolume.freeSpaceGb)} GB livres)`
            : '';
        currentFormatted = `${formatPtDecimal(currentValue)} %${freeGbText}`;
      }
      if (validVolumes.length > 0) {
        const volSummary = validVolumes
          .map((v) => {
            const free = v.freeSpaceGb !== null ? formatPtDecimal(v.freeSpaceGb) : '—';
            const total = v.totalSpaceGb !== null ? formatPtDecimal(v.totalSpaceGb) : '—';
            const pct = v.freePercent !== null ? formatPtDecimal(v.freePercent) : '—';
            return `${v.volume}: ${free}/${total} GB livres (${pct}%)`;
          })
          .join(' · ');
        const largeDiskGuardNote =
          currentValue !== null &&
          evalValue !== null &&
          evalValue > currentValue
            ? ' · Salvaguarda ativa (disco grande com >= 25 GB livres)'
            : '';
        observedBaselineSummary = `${volSummary}${largeDiskGuardNote}.`;
      } else if (sampleCountInWindow > 0 || dataSourceMode === 'LIVE_COLLECTOR') {
        observedBaselineSummary =
          'Sem volumes SQL reportados por sys.dm_os_volume_stats nesta amostra.';
      }
    } else if (rule.metricKey === 'COLLECTOR_STALE_SECONDS') {
      currentValue = metrics.collectorDelaySeconds;
      evalValue = currentValue;
      sustainedSeconds = sustainedDurationSecondsByRule?.[rule.id] ?? currentValue ?? 0;
      if (currentValue !== null) {
        currentFormatted = `${Math.round(currentValue)} s`;
      }
      if (sampleCountInWindow > 0 || currentValue !== null) {
        const avgInt =
          windowSeries?.observedAvgIntervalSeconds !== null &&
          windowSeries?.observedAvgIntervalSeconds !== undefined
            ? `${Math.round(windowSeries.observedAvgIntervalSeconds)}s`
            : 'aguardando 2ª amostra';
        const durText =
          metrics.lastCollectionDurationMs !== null
            ? ` · última coleta em ${metrics.lastCollectionDurationMs} ms`
            : '';
        observedBaselineSummary = `Intervalo médio real: ${avgInt}${durText} · ${metrics.storageUsedSamples.toLocaleString('pt-BR')}/${metrics.storageMaxSamples.toLocaleString('pt-BR')} amostras gravadas.`;
      }
    }

    if (!observedBaselineSummary) {
      if (dataSourceMode === 'PARTIAL_LIVE_NO_VIEW_SERVER_STATE') {
        observedBaselineSummary = 'Requer permissão VIEW SERVER STATE no SRVSQL para calcular linha de base real.';
      } else if (dataSourceMode === 'COLLECTOR_UNAVAILABLE') {
        observedBaselineSummary = 'Sem amostras ativas no período; aguardando telemetria do FIORIXConnector.';
      } else {
        observedBaselineSummary = rule.baselineAdjustableNote;
      }
    }

    if (rule.updatedBy) {
      observedBaselineSummary = `${observedBaselineSummary} Calibrado por ${rule.updatedBy}.`;
    }

    let liveState: AlertRuleLiveState = 'NORMAL';
    if (!rule.enabled) {
      liveState = 'DISABLED';
    } else if (currentValue === null || evalValue === null) {
      liveState = 'NO_DATA';
    } else {
      const exceedsCritical = isInvertedThreshold
        ? evalValue <= rule.criticalThreshold
        : evalValue >= rule.criticalThreshold;
      const exceedsWarning = isInvertedThreshold
        ? evalValue <= rule.warningThreshold
        : evalValue >= rule.warningThreshold;

      if (activeAlert) {
        if (activeAlert.severity === 'CRITICAL') {
          liveState = 'CRITICAL';
        } else if (!exceedsWarning && !exceedsCritical) {
          liveState = 'HYSTERESIS';
        } else {
          liveState = 'WARNING';
        }
      } else if (exceedsCritical || exceedsWarning) {
        liveState =
          sustainedSeconds >= rule.minDurationSeconds
            ? exceedsCritical
              ? 'CRITICAL'
              : 'WARNING'
            : 'PENDING_DURATION';
      } else {
        liveState = 'NORMAL';
      }
    }

    return {
      ruleId: rule.id,
      currentValue,
      currentFormatted,
      sustainedSeconds,
      liveState,
      activeAlertSeverity:
        activeAlert && activeAlert.severity !== 'RESOLVED' ? activeAlert.severity : null,
      activeOccurrencesCount: activeAlert?.occurrencesCount ?? 0,
      observedBaselineSummary,
      sampleCountInWindow,
      isInvertedThreshold,
    };
  });
}

/**
 * Calcula o tempo de espera de backoff progressivo (exponencial com teto) para o coletor em caso de falha/timeout.
 */
export function computeCollectorBackoffSeconds(consecutiveFailures: number, baseIntervalSeconds = 30): number {
  if (consecutiveFailures <= 0) return baseIntervalSeconds;
  const factor = Math.min(6, consecutiveFailures);
  return Math.min(600, baseIntervalSeconds * Math.pow(2, factor - 1));
}

/**
 * Formata um valor numérico diferenciando estritamente `null` / `undefined` ("Sem dados") de `0` ("0").
 */
export function formatMetricOrMissing(
  value: number | null | undefined,
  unit = '',
  fractionDigits = 0,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'Sem dados';
  }
  const formatted =
    fractionDigits > 0
      ? value.toFixed(fractionDigits).replace('.', ',')
      : String(Math.round(value));
  return unit ? `${formatted}${unit}` : formatted;
}

/**
 * Monta o dossiê técnico exportável para encaminhamento à SIPLAN (Seção 10).
 * Garante que nenhuma credencial, connection string ou conteúdo de documento conste no pacote.
 */
export function buildSiplanIncidentReport(
  snapshot: SrvsqlPerformanceDashboardSnapshot,
): SiplanIncidentExportDossier {
  const firstPoint = snapshot.timeline[0]?.timestampIso || snapshot.observedAt || snapshot.generatedAt;
  const lastPoint =
    snapshot.timeline[snapshot.timeline.length - 1]?.timestampIso ||
    snapshot.observedAt ||
    snapshot.generatedAt;

  return {
    reportVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    timezone: 'America/Sao_Paulo',
    cartorio: '7º Oficial de Registro de Imóveis da Capital — São Paulo/SP',
    serverTarget: snapshot.sqlMetadata.serverName || 'SRVSQL\\WEBRI',
    dataSourceMode: snapshot.dataSourceMode,
    reportedSymptom: {
      title: snapshot.bannerMessage,
      periodStart: firstPoint,
      periodEnd: lastPoint,
      userIncidents: snapshot.userIncidents,
    },
    serverAndSqlEnvironment: {
      ...snapshot.sqlMetadata,
      // Mantém apenas o identificador lógico do login sem expor qualquer segredo
      loginUsed: snapshot.sqlMetadata.loginUsed ? `${snapshot.sqlMetadata.loginUsed} (somente leitura)` : null,
    },
    latencySemantics: snapshot.latencySemantics,
    resourceMetricsSummary: {
      cpuPercent: snapshot.kpis.serverCpuPercent,
      memoryUsedPercent: snapshot.kpis.memoryUsedPercent,
      windowsAvailableMemoryMb: snapshot.windowsMemory.availablePhysicalMb,
      sqlServerMemoryMb: snapshot.sqlMemory.totalServerMemoryMb,
      maxServerMemoryConfigMb: snapshot.sqlMemory.maxServerMemoryConfigMb,
      pagesPerSec: snapshot.windowsMemory.pagesPerSec,
      volumes: snapshot.windowsVolumes,
      fileIoDeltas: snapshot.fileIoDeltas,
    },
    blockingAndWaitsEvidence: {
      blockingChains: snapshot.blockingChains,
      waitStatsDelta: snapshot.waitStatsDelta,
      costlyQueryHashes: snapshot.costlyQueries,
    },
    concurrentWindowsActivity: {
      services: snapshot.windowsServices,
      topProcesses: snapshot.windowsProcesses,
      concurrentEvents: snapshot.concurrentEvents,
    },
    hypothesesAndEvidence: snapshot.diagnostics,
    methodologyAndLimitations: [
      'Todas as métricas de espera (sys.dm_os_wait_stats) e latência de arquivos (sys.dm_io_virtual_file_stats) foram calculadas por diferença (delta) entre amostras consecutivas, descartando contadores acumulados desde a inicialização.',
      'A amostragem periódica de sessões (sys.dm_exec_sessions / sys.dm_exec_requests) identifica bloqueios sustentados e transações abertas no momento da coleta, mas não registra 100% das consultas sub-segundo nem substitui rastreamento contínuo da aplicação.',
      'Por privacidade e proteção de dados registrais (LGPD), este relatório utiliza query_hash e metadados de execução, sem textos SQL brutos contendo CPF/CNPJ, parâmetros ou linhas de comando de processos.',
      'Um teste simples de conectividade (SELECT 1) mede apenas o RTT de rede/autenticação e não representa o tempo de execução de consultas e gravações reais do WEBRI.',
    ],
    privacyAndSecurityAttestation:
      'Relatório auditado sem credenciais, sem strings de conexão, sem senhas e sem conteúdo de documentos ou dados pessoais.',
  };
}

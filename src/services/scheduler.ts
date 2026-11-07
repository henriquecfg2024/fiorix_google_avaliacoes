import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env.js';
import { queueManager } from '../db/queue.js';
import { 
  executeBiIncrementalProcedure, 
  executeBiIncrementalV2Procedure,
  executeProdutividadeIncrementalProcedure, 
  executeTarefasIncrementalProcedure, 
  executeRetornosProcedure,
  executeImpressoesProcedure,
  executeColaboradoresRhQuery,
  executeProcedure,
  resetSqlServerPool
} from '../db/mssql.js';

import { 
  getCheckpoint, 
  stageCheckpointCandidate, 
  commitCheckpointForBatch, 
  markReconciliationSuccess, 
  markCheckpointCheckSuccess,
  initializeCheckpointSchema 
} from '../db/checkpoint.js';
import { attachRecordKey } from './recordKey.js';
import { sendSyncBatch, sendHeartbeat, resetApiClient } from './api.js';
import { getDocumentWorkerTelemetry } from './document-worker.js';
import { retryChunkedBatch } from './chunkRetry.js';
import { logger } from '../utils/logger.js';
import { toSqlDateTime2Local } from '../utils/sqlDateTime.js';
import { healthManager } from './health.js';
import { isBusinessHours, getSaoPauloDateTime } from '../utils/businessHours.js';
import { AGENT_VERSION } from '../config/version.js';
import { runtimeDirective } from './runtime-directive.js';
import { selfUpdater } from './self-updater.js';
import { extrairLoteCompletoCartorioVirtualReadOnly } from '../db/certidoes-readonly.js';

export interface SourceScheduleConfig {
  name:
    | 'bi'
    | 'produtividade'
    | 'tarefas'
    | 'metas'
    | 'retornos'
    | 'impressoes'
    | 'safras'
    | 'colaboradores_rh'
    | 'cartorio_virtual_certidoes';
  mode: 'incremental' | 'reconciliation' | 'full';
  intervalSec: number;
  offsetSec: number;
  enabled: boolean;
}

export interface SourceRuntimeStatus {
  source: string;
  mode: 'incremental' | 'reconciliation' | 'full';
  intervalSec: number;
  offsetSec: number;
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastDurationMs: number | null;
  recordsRead: number;
  recordsSent: number;
  lastBatchId: string | null;
  lastError: string | null;
}

import { connectorEnv } from '../config/env.js';

export function getMetaRecordMaxDate(record: any): string | null {
  const dateFields = [
    record.DataDoTituloApresentado,
    record.D1_PROTOCOLO,
    record.D1_ESCANEAMENTO,
    record.D2_CONTRADITORIO,
    record.D3_EXTRATO,
    record.D4_QUALIFICACAO,
    record.D5_CALCULO,
    record.D8_IMPRESSAO,
    record.D9_PREPARACAO,
    record.D9_CONFERENCIA,
    record.D10_ENTREGA,
  ];

  let maxIso: string | null = null;
  for (const d of dateFields) {
    if (!d) continue;
    let iso: string;
    if (d instanceof Date) {
      iso = d.toISOString();
    } else if (typeof d === 'string' && d.trim().length > 0) {
      const parsed = new Date(d);
      iso = !isNaN(parsed.getTime()) ? parsed.toISOString() : d.trim();
    } else {
      continue;
    }
    if (!maxIso || iso > maxIso) {
      maxIso = iso;
    }
  }
  return maxIso;
}

export class Scheduler {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private queueIntervalId?: NodeJS.Timeout;
  private directiveLoopId?: NodeJS.Timeout;
  private isProcessingQueue = false;
  private db: DatabaseSync;
  private activeLocks = new Set<string>();
  private statusMap = new Map<string, SourceRuntimeStatus>();
  private catchupTimeouts: NodeJS.Timeout[] = [];
  private lastMorningReconnectDate: string | null = null;
  private lastMorningReconnectOk: boolean | null = null;
  private lastMorningPingDate: string | null = null;
  private startupCatchupScheduledCount = 0;
  private lastCpuUsage = process.cpuUsage();
  private lastCpuSampleTimeMs = Date.now();

  constructor(db?: DatabaseSync) {
    const dbName = process.env.NODE_ENV === 'test'
      ? ':memory:'
      : (connectorEnv === 'production' ? 'queue_production.db' : 'queue.db');
    this.db = db || new DatabaseSync(dbName);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;
    `);
    initializeCheckpointSchema(this.db);
    this.initializeStatusMap();
  }

  private isGlobalActive(): boolean {
    if (process.env.SCHEDULER_ENABLED !== undefined || process.env.AUTO_SYNC_ENABLED !== undefined) {
      return process.env.SCHEDULER_ENABLED === 'true' || process.env.AUTO_SYNC_ENABLED === 'true';
    }
    return env.SCHEDULER_ENABLED || env.AUTO_SYNC_ENABLED;
  }

  private isSourceActive(sourceName: string): boolean {
    const remoteEnabled = runtimeDirective.getRemoteConfig().enabledModules?.[sourceName as SourceScheduleConfig['name']];
    if (typeof remoteEnabled === 'boolean') {
      return remoteEnabled;
    }
    const isGlobal = this.isGlobalActive();
    const envKey = `${sourceName.toUpperCase()}_AUTO_SYNC_ENABLED`;
    if (process.env[envKey] !== undefined) {
      return process.env[envKey] === 'true';
    }
    if (sourceName === 'metas') {
      if (process.env.METAS_AUTO_SYNC_ENABLED !== undefined) {
        return process.env.METAS_AUTO_SYNC_ENABLED === 'true';
      }
      if (process.env.METAS_RECONCILIATION_ENABLED !== undefined) {
        return process.env.METAS_RECONCILIATION_ENABLED === 'true';
      }
    }
    return isGlobal;
  }

  private getSourceConfigs(): SourceScheduleConfig[] {
    const isShortCycle = (sec: number) => sec <= 60;
    const remoteIntervals = runtimeDirective.getRemoteConfig().syncIntervals;

    const biInterval = remoteIntervals?.bi ?? (process.env.BI_SYNC_INTERVAL_SECONDS ? Number(process.env.BI_SYNC_INTERVAL_SECONDS) : env.BI_SYNC_INTERVAL_SECONDS);
    const prodInterval = remoteIntervals?.produtividade ?? (process.env.PRODUTIVIDADE_SYNC_INTERVAL_SECONDS ? Number(process.env.PRODUTIVIDADE_SYNC_INTERVAL_SECONDS) : env.PRODUTIVIDADE_SYNC_INTERVAL_SECONDS);
    const tarefasInterval = remoteIntervals?.tarefas ?? (process.env.TAREFAS_SYNC_INTERVAL_SECONDS ? Number(process.env.TAREFAS_SYNC_INTERVAL_SECONDS) : env.TAREFAS_SYNC_INTERVAL_SECONDS);
    const metasInterval = remoteIntervals?.metas ?? (process.env.METAS_SYNC_INTERVAL_SECONDS
      ? Number(process.env.METAS_SYNC_INTERVAL_SECONDS)
      : (env.METAS_SYNC_INTERVAL_SECONDS || (env.METAS_RECONCILIATION_INTERVAL_MINUTES * 60)));
    const retornosInterval = remoteIntervals?.retornos ?? (process.env.RETORNOS_SYNC_INTERVAL_SECONDS
      ? Number(process.env.RETORNOS_SYNC_INTERVAL_SECONDS)
      : (env.RETORNOS_SYNC_INTERVAL_SECONDS || 3600));

    return [
      {
        name: 'bi',
        mode: 'incremental',
        intervalSec: biInterval,
        offsetSec: process.env.BI_OFFSET_SECONDS !== undefined
          ? Number(process.env.BI_OFFSET_SECONDS)
          : 0,
        enabled: this.isSourceActive('bi'),
      },
      {
        name: 'produtividade',
        mode: 'incremental',
        intervalSec: prodInterval,
        offsetSec: process.env.PRODUTIVIDADE_OFFSET_SECONDS !== undefined
          ? (isShortCycle(prodInterval) && Number(process.env.PRODUTIVIDADE_OFFSET_SECONDS) >= 60 ? 20 : Number(process.env.PRODUTIVIDADE_OFFSET_SECONDS))
          : (isShortCycle(prodInterval) ? 20 : env.PRODUTIVIDADE_OFFSET_SECONDS),
        enabled: this.isSourceActive('produtividade'),
      },
      {
        name: 'tarefas',
        mode: 'incremental',
        intervalSec: tarefasInterval,
        offsetSec: process.env.TAREFAS_OFFSET_SECONDS !== undefined
          ? (isShortCycle(tarefasInterval) && Number(process.env.TAREFAS_OFFSET_SECONDS) >= 60 ? 40 : Number(process.env.TAREFAS_OFFSET_SECONDS))
          : (isShortCycle(tarefasInterval) ? 40 : env.TAREFAS_OFFSET_SECONDS),
        enabled: this.isSourceActive('tarefas'),
      },
      {
        name: 'metas',
        mode: (process.env.METAS_SYNC_MODE as any) || 'incremental',
        intervalSec: metasInterval,
        offsetSec: process.env.METAS_OFFSET_SECONDS !== undefined
          ? (isShortCycle(metasInterval) && Number(process.env.METAS_OFFSET_SECONDS) >= 60 ? 10 : Number(process.env.METAS_OFFSET_SECONDS))
          : (isShortCycle(metasInterval) ? 10 : env.METAS_OFFSET_SECONDS),
        enabled: this.isSourceActive('metas'),
      },
      {
        name: 'retornos',
        mode: 'incremental',
        intervalSec: retornosInterval,
        offsetSec: process.env.RETORNOS_OFFSET_SECONDS !== undefined
          ? (isShortCycle(retornosInterval) && Number(process.env.RETORNOS_OFFSET_SECONDS) >= 60 ? 30 : Number(process.env.RETORNOS_OFFSET_SECONDS))
          : (isShortCycle(retornosInterval) ? 30 : env.RETORNOS_OFFSET_SECONDS),
        enabled: this.isSourceActive('retornos'),
      },
      {
        name: 'impressoes',
        mode: 'incremental',
        intervalSec: process.env.IMPRESSOES_SYNC_INTERVAL_SECONDS
          ? Number(process.env.IMPRESSOES_SYNC_INTERVAL_SECONDS)
          : (env.IMPRESSOES_SYNC_INTERVAL_SECONDS || 3600),
        offsetSec: process.env.IMPRESSOES_OFFSET_SECONDS !== undefined
          ? (isShortCycle(Number(process.env.IMPRESSOES_SYNC_INTERVAL_SECONDS || 3600)) && Number(process.env.IMPRESSOES_OFFSET_SECONDS) >= 60 ? 50 : Number(process.env.IMPRESSOES_OFFSET_SECONDS))
          : (isShortCycle(env.IMPRESSOES_SYNC_INTERVAL_SECONDS || 3600) ? 50 : env.IMPRESSOES_OFFSET_SECONDS),
        enabled: this.isSourceActive('impressoes'),
      },
      {
        name: 'safras',
        mode: 'full',
        intervalSec: process.env.SAFRAS_SYNC_INTERVAL_SECONDS
          ? Number(process.env.SAFRAS_SYNC_INTERVAL_SECONDS)
          : 3600,
        offsetSec: process.env.SAFRAS_OFFSET_SECONDS !== undefined
          ? Number(process.env.SAFRAS_OFFSET_SECONDS)
          : 45,
        enabled: this.isSourceActive('safras'),
      },
      {
        name: 'colaboradores_rh',
        mode: 'full',
        intervalSec: process.env.COLABORADORES_RH_SYNC_INTERVAL_SECONDS
          ? Number(process.env.COLABORADORES_RH_SYNC_INTERVAL_SECONDS)
          : 3600,
        offsetSec: process.env.COLABORADORES_RH_OFFSET_SECONDS !== undefined
          ? Number(process.env.COLABORADORES_RH_OFFSET_SECONDS)
          : 330,
        enabled: this.isSourceActive('colaboradores_rh'),
      },
      {
        name: 'cartorio_virtual_certidoes',
        mode: 'full',
        intervalSec: process.env.CARTORIO_VIRTUAL_SYNC_INTERVAL_SECONDS
          ? Number(process.env.CARTORIO_VIRTUAL_SYNC_INTERVAL_SECONDS)
          : 300,
        offsetSec: process.env.CARTORIO_VIRTUAL_OFFSET_SECONDS !== undefined
          ? Number(process.env.CARTORIO_VIRTUAL_OFFSET_SECONDS)
          : 25,
        enabled: this.isSourceActive('cartorio_virtual_certidoes'),
      },
    ];
  }


  private initializeStatusMap() {
    for (const config of this.getSourceConfigs()) {
      const chk = getCheckpoint(this.db, config.name);
      const lastSuccess = chk?.last_success_at || chk?.last_reconciliation_at || null;
      healthManager.initSourceLastSuccess(config.name as any, lastSuccess);
      this.statusMap.set(config.name, {
        source: config.name,
        mode: config.mode,
        intervalSec: config.intervalSec,
        offsetSec: config.offsetSec,
        enabled: config.enabled,
        running: false,
        lastRunAt: null,
        lastSuccessAt: lastSuccess,
        lastDurationMs: null,
        recordsRead: 0,
        recordsSent: 0,
        lastBatchId: chk?.last_batch_id || null,
        lastError: null,
      });
    }
  }

  public getStatus(source: string): SourceRuntimeStatus | undefined {
    return this.statusMap.get(source);
  }

  public getAllStatuses(): SourceRuntimeStatus[] {
    return Array.from(this.statusMap.values());
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('CONNECTOR_START: Agendador iniciado.');

    // 1-second clock verification
    this.intervalId = setInterval(() => this.tick(), 1000);

    // Queue worker every 10 seconds
    this.queueIntervalId = setInterval(() => this.processQueue(), 10000);

    // Process queue immediately on start
    this.processQueue();

    // Rotina de recuperação de ciclo perdido pós-reinicialização
    this.checkStartupCatchUp();
  }

  public checkStartupCatchUp() {
    if (!runtimeDirective.shouldRunSqlSync()) return;
    const now = new Date();
    if (!isBusinessHours(now)) return;

    const configs = this.getSourceConfigs();
    let staggerDelayMs = 3000; // Inicia a primeira recuperação após 3 segundos do boot

    for (const config of configs) {
      if (!config.enabled) continue;
      const chk = getCheckpoint(this.db, config.name);
      if (!chk?.last_success_at) continue;

      const cleanDate = chk.last_success_at.trim();
      const lastSuccessUtc = cleanDate.endsWith('Z')
        ? new Date(cleanDate)
        : (cleanDate.includes('T') ? new Date(`${cleanDate}Z`) : new Date(`${cleanDate.replace(' ', 'T')}Z`));

      if (isNaN(lastSuccessUtc.getTime())) continue;

      const elapsedSeconds = Math.max(0, (now.getTime() - lastSuccessUtc.getTime()) / 1000);

      // Se a fonte estiver sem sincronizar por mais tempo que o intervalo dela (com margem de 60s)
      if (elapsedSeconds >= (config.intervalSec + 60)) {
        logger.info(`STARTUP_CATCHUP_SCHEDULED: Fonte ${config.name} está em atraso (${Math.round(elapsedSeconds / 60)} min sem sincronização). Execução de recuperação agendada para daqui a ${staggerDelayMs / 1000}s.`);

        const timeout = setTimeout(() => {
          if (!this.activeLocks.has(config.name) && this.isRunning && runtimeDirective.shouldRunSqlSync() && isBusinessHours(new Date())) {
            logger.info(`STARTUP_CATCHUP_RUN: Iniciando extração de recuperação para fonte ${config.name}...`);
            this.runExtraction(config, new Date()).catch((err) => {
              logger.error(`STARTUP_CATCHUP_ERROR: Erro na recuperação da fonte ${config.name}: ${err.message}`);
            });
          }
        }, staggerDelayMs);

        this.startupCatchupScheduledCount++;
        this.catchupTimeouts.push(timeout);
        staggerDelayMs += 15000; // Escalonamento de 15 segundos entre fontes para evitar concorrência no SQL Server
      }
    }
  }

  public startAlwaysOnDirectiveLoop(intervalMs = 20000) {
    if (this.directiveLoopId) return;
    this.directiveLoopId = setInterval(() => {
      const sec = new Date().getSeconds();
      // Evita disparo duplicado caso o agendador já vá enviar no segundo 50
      if (this.isRunning && sec >= 47 && sec <= 53) return;
      this.sendTelemetryPing().catch(() => {});
    }, intervalMs);
    this.directiveLoopId.unref?.();
  }

  public stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.queueIntervalId) clearInterval(this.queueIntervalId);
    if (this.directiveLoopId) clearInterval(this.directiveLoopId);
    this.directiveLoopId = undefined;
    for (const t of this.catchupTimeouts) clearTimeout(t);
    this.catchupTimeouts = [];
    this.isRunning = false;
    logger.info('CONNECTOR_STOP: Agendador parado.');
  }

  private sampleCpuPercent(): number {
    const nowMs = Date.now();
    const elapsedMs = Math.max(1, nowMs - this.lastCpuSampleTimeMs);
    const diff = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuSampleTimeMs = nowMs;
    const cpuCount = Math.max(1, os.cpus()?.length || 1);
    const totalCpuMicros = diff.user + diff.system;
    const pct = (totalCpuMicros / (elapsedMs * 1000 * cpuCount)) * 100;
    return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
  }

  public async sendTelemetryPing() {
    try {
      const globalActive = this.isGlobalActive();
      const health = healthManager.getHealth(this.db, globalActive);
      const configs = this.getSourceConfigs();
      const configMap = new Map(configs.map((c) => [c.name, c]));

      const sourcesPayload: Record<string, any> = {};
      const sourceDetails: Record<string, any> = {};

      for (const [sName, sHealth] of Object.entries(health.sources)) {
        sourcesPayload[sName] = {
          lastRunAt: sHealth.lastRunAt,
          lastSuccessAt: sHealth.lastSuccessAt,
          lastSqlRecords: sHealth.lastSqlRecords,
          lastRecordsSent: sHealth.lastRecordsSent,
          lastDurationMs: sHealth.lastDurationMs,
          isRunning: sHealth.isRunning,
          lastError: sHealth.lastError,
        };

        const cfg = configMap.get(sName as any);
        const metrics = health.metrics[sName as keyof typeof health.metrics];
        const chk = health.checkpoints.bySource[sName];
        sourceDetails[sName] = {
          enabled: cfg?.enabled ?? false,
          mode: cfg?.mode ?? 'incremental',
          intervalSec: cfg?.intervalSec ?? 3600,
          offsetSec: cfg?.offsetSec ?? 0,
          consecutiveFailures: sHealth.consecutiveFailures,
          isStale: sHealth.isStale,
          durationMsAvg: metrics?.duration_ms_avg ?? 0,
          runsTotal: metrics?.runs_total ?? 0,
          runsSuccessTotal: metrics?.runs_success_total ?? 0,
          runsFailedTotal: metrics?.runs_failed_total ?? 0,
          recordsSqlTotal: metrics?.records_sql_total ?? 0,
          recordsSentTotal: metrics?.records_sent_total ?? 0,
          cursorValue: chk?.cursorValue ?? null,
          secondaryCursor: chk?.secondaryCursor ?? null,
          lastReconciliationAt: chk?.lastReconciliationAt ?? null,
        };
      }

      const mem = process.memoryUsage();
      const cpuPercent = this.sampleCpuPercent();
      let documental = null;
      try { documental = getDocumentWorkerTelemetry(); } catch { documental = null; }
      const proxyTelemetry = healthManager.getProxyTelemetry();
      const proxyStats = {
        proxyEnabled: env.PROXY_ENABLED,
        proxyHost: env.PROXY_ENABLED && env.PROXY_HOST ? `${env.PROXY_HOST}:${env.PROXY_PORT}` : null,
        ...proxyTelemetry,
      };

      const details = {
        runtime: {
          hostname: os.hostname(),
          osVersion: `${os.type()} ${os.release()}`,
          installedPath: process.cwd(),
          pid: process.pid,
          nodeVersion: process.version,
          platform: `${process.platform}/${process.arch}`,
          environment: connectorEnv,
          shadowMode: env.SHADOW_MODE,
          singleInstanceLock: true,
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          startedAt: health.startedAt,
          ha: runtimeDirective.getTelemetrySummary(),
          selfUpdate: selfUpdater.getStatusSnapshot(),
        },
        capabilities: [
          'sql_sync_7_modules',
          'documental_worker_24x7',
          'https_chunk_transfer',
          'inline_pdf_2_4mb',
          'local_file_server_range',
          'rust_cli_ocr_signatures',
          'sqlite_wal_queue',
          'chunk_sha256_retry',
          'checkpoint_cursors',
          'morning_reconnect_0658',
          'startup_catchup',
          'proxy_direct_fallback',
          'hot_standby_ha',
          'remote_config_v1',
          'cloud_self_update_sha256',
        ],
        database: {
          connected: health.database.connected,
          lastSuccessfulQueryAt: health.database.lastSuccessfulQueryAt,
          databaseName: runtimeDirective.getRemoteConfig().sqlDatabase || env.SQL_SERVER_DATABASE,
          chunkSizeRecords: env.CHUNK_SIZE_RECORDS,
          overlapMinutes: env.INCREMENTAL_OVERLAP_MINUTES,
          reconciliationLookbackDays: env.RECONCILIATION_LOOKBACK_DAYS,
        },
        scheduler: {
          enabled: globalActive && runtimeDirective.shouldRunSqlSync(),
          configuredEnabled: globalActive,
          operationalState: runtimeDirective.getOperationalState(),
          isBusinessHours: isBusinessHours(new Date()),
          activeLocksCount: this.activeLocks.size,
          activeSources: Array.from(this.activeLocks),
          enabledSourcesCount: configs.filter((c) => c.enabled).length,
          totalSourcesCount: configs.length,
          lastMorningReconnectDate: this.lastMorningReconnectDate,
          lastMorningReconnectOk: this.lastMorningReconnectOk,
          lastMorningPingDate: this.lastMorningPingDate,
          startupCatchupScheduledCount: this.startupCatchupScheduledCount,
        },
        network: {
          apiReachable: health.api.reachable,
          lastSuccessfulRequestAt: health.api.lastSuccessfulRequestAt,
          ...proxyStats,
        },
        sqlite: {
          storageFile: connectorEnv === 'production' ? 'queue_production.db' : 'queue.db',
          journalMode: 'WAL',
          queue: health.queue,
          chunks: health.chunks,
          checkpoints: {
            persistedCount: health.checkpoints.persistedCount,
            stagedCandidates: health.checkpoints.stagedCandidates,
            bySource: health.checkpoints.bySource,
          },
        },
        sourcesExtended: sourceDetails,
        documental,
      };

      const mappedStatus: 'online' | 'degraded' =
        health.connectorStatus === 'unhealthy' ? 'degraded' : 'online';

      const prevState = runtimeDirective.getOperationalState();
      const hbResult = await sendHeartbeat({
        version: process.env.NODE_ENV === 'test' ? '0.1.0' : AGENT_VERSION,
        status: mappedStatus,
        uptimeSeconds: Math.floor(process.uptime()),
        ramMb: Math.round(mem.rss / 1024 / 1024),
        heapMb: Math.round(mem.heapUsed / 1024 / 1024),
        cpuPercent: Math.round(cpuPercent),
        shadowMode: env.SHADOW_MODE,
        schedulerEnabled: globalActive && runtimeDirective.shouldRunSqlSync(),
        queuePending: health.queue.pending,
        queueSending: health.queue.sending,
        queueFailed: health.queue.failed,
        queueQuarantined: health.queue.quarantined,
        sources: sourcesPayload,
        details,
      });

      if (hbResult?.directive) {
        runtimeDirective.applyDirective(hbResult.directive, this.db);
        if (prevState !== 'ACTIVE' && runtimeDirective.getOperationalState() === 'ACTIVE' && this.isRunning) {
          this.checkStartupCatchUp();
        }
      }
    } catch (hbErr: any) {
      logger.warn(`HEARTBEAT_WARNING: Falha ao enviar heartbeat: ${hbErr.message}`);
    }
  }

  public async tick(simulatedDate?: Date) {
    const now = simulatedDate || new Date();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();

    const sp = getSaoPauloDateTime(now);

    // 1. Reconexão e rearme matinal às 06:58:00 (antes da janela das 07h)
    // Recria pool do SQL Server (WEBRI) e reseta cliente HTTP para limpar sockets órfãos
    if (sp.hour === 6 && sp.minute === 58 && sp.second === 0 && this.lastMorningReconnectDate !== sp.dateStr) {
      this.lastMorningReconnectDate = sp.dateStr;
      logger.info(`[MORNING_RECONNECT] Executando reconexão matinal preventiva às 06:58:00 (${sp.dateStr})...`);
      try {
        resetApiClient();
        const poolOk = await resetSqlServerPool();
        this.lastMorningReconnectOk = poolOk;
        logger.info('[MORNING_RECONNECT] Reconexão matinal preventiva concluída com sucesso para a abertura das 07h.');
      } catch (recErr: any) {
        this.lastMorningReconnectOk = false;
        logger.error(`[MORNING_RECONNECT] Erro na rotina de reconexão matinal: ${recErr.message}`);
      }
    }

    // 2. Disparo imediato de heartbeat matinal às 07:00:00 em ponto (garantindo timestamp fresco no início da janela das 07h)
    if (sp.hour === 7 && sp.minute === 0 && sp.second === 0 && this.lastMorningPingDate !== sp.dateStr) {
      this.lastMorningPingDate = sp.dateStr;
      logger.info(`[MORNING_PING] Disparo imediato de heartbeat matinal às 07:00:00 (${sp.dateStr}).`);
      this.sendTelemetryPing().catch((pingErr) => {
        logger.warn(`[MORNING_PING] Falha no disparo do ping matinal: ${pingErr.message}`);
      });
    }

    // 3. Heartbeat periódico no segundo 50 de cada minuto para não colidir com extrações
    if (seconds === 50) {
      await this.sendTelemetryPing();
    }

    // Respeita estado operacional de Alta Disponibilidade (ACTIVE / STANDBY / PAUSED)
    if (!runtimeDirective.shouldRunSqlSync()) {
      return;
    }

    // Validação de horário de expediente (Segunda a Sábado, das 07h às 19h)
    if (!isBusinessHours(now)) {
      return;
    }

    const configs = this.getSourceConfigs();

    for (const config of configs) {
      if (!config.enabled) continue;

      let isMatching = false;
      if (config.intervalSec <= 60) {
        isMatching = seconds === (config.offsetSec % 60);
      } else {
        const intervalMin = Math.max(1, Math.floor(config.intervalSec / 60));
        const offsetMin = Math.floor(config.offsetSec / 60);
        const offsetSecondRemainder = config.offsetSec % 60;
        isMatching = (minutes % intervalMin === (offsetMin % intervalMin)) && (seconds === offsetSecondRemainder);
      }

      if (isMatching) {
        if (this.activeLocks.has(config.name)) {
          logger.warn(`SKIPPED_OVERLAPPING_RUN: Extração da fonte ${config.name} já está em andamento.`);
          continue;
        }

        this.runExtraction(config, now).catch((err) => {
          logger.error(`Erro crítico no wrapper da fonte ${config.name}: ${err.message}`);
        });
      }
    }
  }

  public async runExtraction(config: SourceScheduleConfig, runTime: Date = new Date()) {
    if (this.activeLocks.has(config.name)) {
      logger.warn(`SKIPPED_OVERLAPPING_RUN: Extração da fonte ${config.name} já está em andamento.`);
      return;
    }

    this.activeLocks.add(config.name);
    const status = this.statusMap.get(config.name)!;
    status.running = true;
    status.lastRunAt = runTime.toISOString();
    healthManager.recordRunStart(config.name, runTime);
    const startTime = Date.now();

    try {
      let records: any[] = [];
      let durationMs = 0;
      let maxCursorValue: string | null = null;
      let maxSecondaryCursor: string | null = null;

      const overlapMin = env.INCREMENTAL_OVERLAP_MINUTES;
      const chk = getCheckpoint(this.db, config.name);

      const isoClean = runTime.toISOString().replace('Z', '');
      const localFull = toSqlDateTime2Local(isoClean.length === 19 ? `${isoClean}.000` : isoClean);
      const todayDate = localFull.substring(0, 10);
      const [year, month, day] = todayDate.split('-');
      const todayBr = `${day}/${month}/${year}`;

      if (config.name === 'bi') {
        const lastProto = chk?.cursor_value && !isNaN(Number(chk.cursor_value)) ? Number(chk.cursor_value) : null;
        const lastSeq = chk?.secondary_cursor && !isNaN(Number(chk.secondary_cursor)) ? Number(chk.secondary_cursor) : null;
        const res = await executeBiIncrementalV2Procedure({
          dataInicial: todayBr,
          dataFinal: todayBr,
          flag: 0,
          lastProtocolo: lastProto,
          lastSeqTitulo: lastSeq,
        });
        records = res.records;
        durationMs = res.durationMs;
      } else if (config.name === 'produtividade') {
        const cursorVal = chk?.cursor_value || `${todayDate} 00:00:00.000`;
        const res = await executeProdutividadeIncrementalProcedure({
          dataInicial: todayBr,
          dataFinal: todayBr,
          idCaixa: '0',
          cursorValue: cursorVal,
          overlapMinutes: overlapMin,
        });
        records = res.records;
        durationMs = res.durationMs;
      } else if (config.name === 'tarefas') {
        const pastDate = new Date(runTime.getTime() - 30 * 86400000).toISOString().substring(0, 10);
        const futureDate = new Date(runTime.getTime() + 15 * 86400000).toISOString().substring(0, 10);
        const cursorVal = chk?.cursor_value || `${todayDate} 00:00:00.000`;
        const res = await executeTarefasIncrementalProcedure({
          dataInicial: pastDate,
          dataFinal: futureDate,
          somenteAbertas: 0,
          cursorValue: cursorVal,
          overlapMinutes: overlapMin,
        });
        records = res.records;
        durationMs = res.durationMs;
      } else if (config.name === 'metas') {
        const raw = await executeProcedure('metas', 'dbo.pr_Fiorix_BI_METAS');
        const cursorVal = chk?.cursor_value || null;

        const mapped = raw.map((r: any) => {
          const withKey = attachRecordKey('metas', r);
          const maxDate = getMetaRecordMaxDate(r);
          return {
            ...withKey,
            cursor_value: maxDate,
            secondary_cursor: String(r.PROTOCOLO ?? ''),
          };
        });

        if (config.mode === 'incremental' && cursorVal) {
          records = mapped.filter((r: any) => {
            if (!r.cursor_value) return false;
            if (r.cursor_value > cursorVal) return true;
            if (r.cursor_value === cursorVal && chk?.secondary_cursor) {
              return (r.secondary_cursor ?? '') > chk.secondary_cursor;
            }
            return false;
          });
          logger.info(`METAS_INCREMENTAL: Extraídos ${raw.length} registros. Filtrados ${records.length} novos após cursor ${cursorVal}.`);
        } else {
          records = mapped;
          if (config.mode === 'incremental') {
            logger.info(`METAS_BOOTSTRAP: Primeiro ciclo incremental. Enviando ${records.length} registros para estabelecer checkpoint inicial.`);
          }
        }
        durationMs = Date.now() - startTime;
      } else if (config.name === 'retornos') {
        const cursorVal = chk?.cursor_value && !isNaN(Number(chk.cursor_value)) ? Number(chk.cursor_value) : null;
        const res = await executeRetornosProcedure({
          cursorIdAndamento: cursorVal,
        });

        const mapped = res.records.map((r: any) => {
          const withKey = attachRecordKey('retornos', r);
          return {
            ...withKey,
            cursor_value: String(r.IdAndamento),
            secondary_cursor: String(r.NumeroPrenotacao ?? ''),
          };
        });

        if (config.mode === 'incremental' && cursorVal !== null) {
          records = mapped.filter((r: any) => Number(r.IdAndamento) > cursorVal);
          logger.info(`RETORNOS_INCREMENTAL: Extraídos ${res.records.length} registros. Filtrados ${records.length} novos após cursor ${cursorVal}.`);
        } else {
          records = mapped;
          if (config.mode === 'incremental') {
            logger.info(`RETORNOS_BOOTSTRAP: Primeiro ciclo incremental. Enviando ${records.length} registros para estabelecer checkpoint inicial.`);
          }
        }
        durationMs = res.durationMs;
      } else if (config.name === 'impressoes') {
        const cursorVal = chk?.cursor_value && !isNaN(Number(chk.cursor_value)) ? Number(chk.cursor_value) : null;
        const res = await executeImpressoesProcedure({
          cursorIdAndamento: cursorVal,
        });

        const mapped = res.records.map((r: any) => {
          const withKey = attachRecordKey('impressoes', r);
          return {
            ...withKey,
            cursor_value: String(r.IdAndamento),
            secondary_cursor: String(r.NumeroPrenotacao ?? ''),
          };
        });

        if (config.mode === 'incremental' && cursorVal !== null) {
          records = mapped.filter((r: any) => Number(r.IdAndamento) > cursorVal);
          logger.info(`IMPRESSOES_INCREMENTAL: Extraídos ${res.records.length} registros. Filtrados ${records.length} novos após cursor ${cursorVal}.`);
        } else {
          records = mapped;
          if (config.mode === 'incremental') {
            logger.info(`IMPRESSOES_BOOTSTRAP: Primeiro ciclo incremental. Enviando ${records.length} registros para estabelecer checkpoint inicial.`);
          }
        }
        durationMs = res.durationMs;
      } else if (config.name === 'safras') {
        const raw = await executeProcedure('safras', 'dbo.pr_Fiorix_BI_Safras_Prenotacoes');
        records = raw;
        durationMs = Date.now() - startTime;
      } else if (config.name === 'colaboradores_rh') {
        const res = await executeColaboradoresRhQuery();
        durationMs = res.durationMs;
        if (res.skippedNoPermission || res.records.length === 0) {
          status.recordsRead = 0;
          status.lastDurationMs = durationMs;
          status.lastError = null;
          if (!res.skippedNoPermission) {
            healthManager.recordRunSuccess('colaboradores_rh', 0, 0, durationMs, null, runTime);
          } else {
            healthManager.recordDbQuerySuccess();
          }
          return;
        }
        records = res.records.map((r: any) => attachRecordKey('colaboradores_rh', r));
      } else if (config.name === 'cartorio_virtual_certidoes') {
        const res = await extrairLoteCompletoCartorioVirtualReadOnly({ limiteTop: 300 });
        durationMs = res.duracaoMs;
        if (!res.sucesso || res.registros.length === 0) {
          status.recordsRead = 0;
          status.lastDurationMs = durationMs;
          status.lastError = res.sucesso ? null : res.mensagemDiagnostico;
          healthManager.recordDbQuerySuccess();
          return;
        }
        records = res.registros.map((r: any) => attachRecordKey('cartorio_virtual_certidoes', r));
      }

      status.recordsRead = records.length;
      status.lastDurationMs = durationMs;

      // Extract highest cursor candidate for incremental sources
      if (config.mode === 'incremental') {
        for (const r of records) {
          // cursor_value é retornado pelo driver mssql como objeto Date interpretado em UTC,
          // mas representa um datetime2 LOCAL do SQL Server (sem fuso).
          // Usar toISOString() adiciona o offset UTC (+3h em Brasília), deslocando o cursor para o futuro
          // e fazendo a procedure retornar todos os registros a cada ciclo (bug de full-sync).
          // Serializar as partes UTC diretamente como string local corrige o problema.
          const cStr = r.cursor_value instanceof Date
            ? (() => {
                const d = r.cursor_value as Date;
                const pad = (n: number, size = 2) => String(n).padStart(size, '0');
                return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
              })()
            : String(r.cursor_value ?? (r.PROTOCOLO ?? (r.IdAndamento ?? '')));
          const sStr = String(r.secondary_cursor ?? (r.SEQ_TITULO ?? (r.NumeroPrenotacao ?? '')));

          if (config.name === 'bi' || config.name === 'retornos' || config.name === 'impressoes') {
            const protoNum = Number(cStr);
            const seqNum = Number(sStr);
            const maxP: number | null = maxCursorValue ? Number(maxCursorValue) : null;
            const maxS: number | null = maxSecondaryCursor ? Number(maxSecondaryCursor) : null;
            if (maxP === null || protoNum > maxP || (protoNum === maxP && seqNum > (maxS ?? 0))) {
              maxCursorValue = String(protoNum);
              maxSecondaryCursor = String(seqNum);
            }
          } else {
            if (!maxCursorValue || cStr > maxCursorValue || (cStr === maxCursorValue && sStr > (maxSecondaryCursor ?? ''))) {
              maxCursorValue = cStr;
              maxSecondaryCursor = sStr;
            }
          }
        }
      }


      if (config.mode === 'incremental' && records.length === 0) {
        logger.info(`SYNC_SKIPPED_EMPTY: Fonte ${config.name} incremental retornou 0 registros novos. Nenhum batch enfileirado.`);
        const checkTimeIso = runTime.toISOString();
        status.lastBatchId = null;
        status.lastError = null;
        status.lastSuccessAt = checkTimeIso;
        status.recordsRead = 0;
        status.lastDurationMs = durationMs;

        // Registra no banco local que a verificação ocorreu com sucesso no horário
        markCheckpointCheckSuccess(this.db, config.name, checkTimeIso);
        queueManager.recordCheckSuccess(config.name, checkTimeIso);

        healthManager.recordRunSuccess(config.name as any, 0, 0, durationMs, null, runTime);

        // Dispara envio imediato de status/telemetria para que o painel SaaS zere o contador de atraso
        this.sendTelemetryPing().catch((tErr) => {
          logger.warn(`TELEMETRY_PING_WARN: Falha ao enviar telemetria após verificação vazia de ${config.name}: ${tErr.message}`);
        });

        return;
      }

      const batchId = uuidv4();
      const generatedAt = runTime.toISOString();

      if (config.mode === 'incremental' && maxCursorValue) {
        stageCheckpointCandidate(this.db, {
          batchId,
          source: config.name,
          cursorValue: maxCursorValue,
          tieBreaker: maxSecondaryCursor,
        });
      }

      const payloadObj = {
        source: config.name,
        batch_id: batchId,
        batchId,
        generated_at: generatedAt,
        generatedAt,
        records,
        sync_mode: config.mode,
      };

      queueManager.enqueue({
        source: config.name,
        batch_id: batchId,
        generated_at: generatedAt,
        payload: JSON.stringify(payloadObj),
      });

      status.lastBatchId = batchId;
      status.lastError = null;
      healthManager.recordRunSuccess(config.name, records.length, records.length, durationMs, batchId, runTime);

      // Dispara o esvaziamento imediato da fila sem aguardar o intervalo periódico de 10s
      this.processQueue().catch((qErr) => {
        logger.warn(`QUEUE_TRIGGER_WARN: Falha no disparo imediato da fila para o lote ${batchId}: ${qErr.message}`);
      });

    } catch (err: any) {
      status.lastError = err.message;
      healthManager.recordRunFailure(config.name, err.message, Date.now() - startTime);
      logger.error(`EXTRACTION_ERROR: Erro ao extrair fonte ${config.name}: ${err.message}`);
    } finally {
      status.running = false;
      this.activeLocks.delete(config.name);
    }
  }

  public getActiveLocksCount(): number {
    return this.activeLocks.size;
  }



  public async processQueue() {
    if (this.isProcessingQueue || runtimeDirective.isPaused()) return;
    this.isProcessingQueue = true;

    try {
      const batches = queueManager.getPendingBatches(5);

      for (const batch of batches) {
        if (!batch.id) continue;
        queueManager.markSending(batch.id);

        try {
          const payload = JSON.parse(batch.payload);
          if (Array.isArray(payload.records) && payload.records.length > env.CHUNK_SIZE_RECORDS) {
            const chunkResult = await retryChunkedBatch(
              this.db,
              payload.batch_id || payload.batchId,
              env.CHUNK_SIZE_RECORDS,
              sendSyncBatch,
            );
            if (!chunkResult.completed) {
              throw new Error(chunkResult.error || `CHUNK_${chunkResult.failedChunk}_FAILED`);
            }
          } else {
            await sendSyncBatch(payload);
          }

          // Success callback
          queueManager.markSuccess(batch.id, batch.source);

          // Commit checkpoint or mark reconciliation success
          if (payload.sync_mode === 'reconciliation') {
            markReconciliationSuccess(this.db, batch.source, new Date().toISOString());
          } else if (payload.batch_id || payload.batchId) {
            commitCheckpointForBatch(this.db, payload.batch_id || payload.batchId);
          }

          const status = this.statusMap.get(batch.source);
          if (status) {
            status.lastSuccessAt = new Date().toISOString();
            status.recordsSent += Array.isArray(payload.records) ? payload.records.length : 0;
          }
        } catch (err: any) {
          const errMsg = err.message || 'Erro desconhecido';
          const isNonRetryable = errMsg.includes('INVALID_BATCH_IDENTITY') || errMsg.includes('NON_RETRYABLE');
          if (isNonRetryable) {
            queueManager.markQuarantined(batch.id, errMsg);
          } else if (errMsg.includes('AUTH_ERROR')) {
            queueManager.markError(batch.id, batch.attempts, errMsg);
          } else {
            queueManager.markError(batch.id, batch.attempts, errMsg);
          }
        }

      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
}

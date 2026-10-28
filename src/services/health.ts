import { DatabaseSync } from 'node:sqlite';
import { logger } from '../utils/logger.js';

export type SourceName = 'bi' | 'produtividade' | 'tarefas' | 'metas' | 'retornos' | 'impressoes' | 'safras';

export interface SourceHealthState {
  source: SourceName;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastDurationMs: number;
  lastSqlRecords: number;
  lastRecordsSent: number;
  lastBatchId: string | null;
  consecutiveFailures: number;
  isRunning: boolean;
  lastError: string | null;
  isStale: boolean;
  staleThresholdSec: number;
}

export interface SourceMetrics {
  runs_total: number;
  runs_success_total: number;
  runs_failed_total: number;
  records_sql_total: number;
  records_sent_total: number;
  batches_total: number;
  batches_failed_total: number;
  duration_ms_last: number;
  duration_ms_avg: number;
}

export interface ConnectorHealth {
  connectorStatus: 'healthy' | 'degraded' | 'unhealthy';
  startedAt: string;
  uptimeSeconds: number;
  database: {
    connected: boolean;
    lastSuccessfulQueryAt: string | null;
  };
  api: {
    reachable: boolean;
    lastSuccessfulRequestAt: string | null;
  };
  queue: {
    pending: number;
    failed: number;
  };
  scheduler: {
    enabled: boolean;
    lastHeartbeatAt: string | null;
  };
  sources: Record<SourceName, SourceHealthState>;
  metrics: Record<SourceName, SourceMetrics>;
}

export class HealthManager {
  private startedAtDate: Date;
  private lastHeartbeatDate: Date | null = null;
  private lastDbQueryDate: Date | null = null;
  private lastApiRequestDate: Date | null = null;
  private dbConnected = true;
  private apiReachable = true;

  private staleThresholds: Record<SourceName, number> = {
    bi: 180, // 3 minutes
    produtividade: 180, // 3 minutes
    tarefas: 180, // 3 minutes
    metas: 1800, // 30 minutes
    retornos: 300, // 5 minutes
    impressoes: 300, // 5 minutes
    safras: 7200, // 2 hours
  };

  private sourceHealth: Record<SourceName, SourceHealthState> = {
    bi: this.createInitialSourceHealth('bi', 180),
    produtividade: this.createInitialSourceHealth('produtividade', 180),
    tarefas: this.createInitialSourceHealth('tarefas', 180),
    metas: this.createInitialSourceHealth('metas', 1800),
    retornos: this.createInitialSourceHealth('retornos', 300),
    impressoes: this.createInitialSourceHealth('impressoes', 300),
    safras: this.createInitialSourceHealth('safras', 7200),
  };

  private sourceMetrics: Record<SourceName, SourceMetrics> = {
    bi: this.createInitialMetrics(),
    produtividade: this.createInitialMetrics(),
    tarefas: this.createInitialMetrics(),
    metas: this.createInitialMetrics(),
    retornos: this.createInitialMetrics(),
    impressoes: this.createInitialMetrics(),
    safras: this.createInitialMetrics(),
  };

  private durationsHistory: Record<SourceName, number[]> = {
    bi: [],
    produtividade: [],
    tarefas: [],
    metas: [],
    retornos: [],
    impressoes: [],
    safras: [],
  };

  constructor() {
    this.startedAtDate = new Date();
  }

  public initSourceLastSuccess(source: SourceName, lastSuccessAt: string | null) {
    if (lastSuccessAt && this.sourceHealth[source]) {
      this.sourceHealth[source].lastSuccessAt = lastSuccessAt;
    }
  }

  private createInitialSourceHealth(source: SourceName, staleSec: number): SourceHealthState {
    return {
      source,
      lastRunAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastDurationMs: 0,
      lastSqlRecords: 0,
      lastRecordsSent: 0,
      lastBatchId: null,
      consecutiveFailures: 0,
      isRunning: false,
      lastError: null,
      isStale: false,
      staleThresholdSec: staleSec,
    };
  }

  private createInitialMetrics(): SourceMetrics {
    return {
      runs_total: 0,
      runs_success_total: 0,
      runs_failed_total: 0,
      records_sql_total: 0,
      records_sent_total: 0,
      batches_total: 0,
      batches_failed_total: 0,
      duration_ms_last: 0,
      duration_ms_avg: 0,
    };
  }

  public setStaleThreshold(source: SourceName, seconds: number) {
    this.staleThresholds[source] = seconds;
    this.sourceHealth[source].staleThresholdSec = seconds;
  }

  private ensureSourceInitialized(source: SourceName) {
    if (!this.sourceHealth[source]) {
      this.sourceHealth[source] = this.createInitialSourceHealth(source, 3600);
      this.sourceMetrics[source] = this.createInitialMetrics();
      this.durationsHistory[source] = [];
    }
  }

  public recordRunStart(source: SourceName, runDate?: Date) {
    this.ensureSourceInitialized(source);
    const now = runDate || new Date();
    this.sourceHealth[source].isRunning = true;
    this.sourceHealth[source].lastRunAt = now.toISOString();
    this.sourceMetrics[source].runs_total++;
  }

  public recordRunSuccess(
    source: SourceName,
    recordsRead: number,
    recordsSent: number,
    durationMs: number,
    batchId: string | null,
    runDate?: Date
  ) {
    this.ensureSourceInitialized(source);
    const now = runDate || new Date();
    const h = this.sourceHealth[source];
    h.isRunning = false;
    h.lastSuccessAt = now.toISOString();
    h.lastDurationMs = durationMs;
    h.lastSqlRecords = recordsRead;
    h.lastRecordsSent = recordsSent;
    h.lastBatchId = batchId;
    h.consecutiveFailures = 0;
    h.lastError = null;

    this.lastDbQueryDate = now;
    this.dbConnected = true;

    const m = this.sourceMetrics[source];
    m.runs_success_total++;
    m.records_sql_total += recordsRead;
    m.records_sent_total += recordsSent;
    if (batchId) m.batches_total++;
    m.duration_ms_last = durationMs;

    this.durationsHistory[source].push(durationMs);
    if (this.durationsHistory[source].length > 50) this.durationsHistory[source].shift();
    const sum = this.durationsHistory[source].reduce((a, b) => a + b, 0);
    m.duration_ms_avg = Math.round(sum / this.durationsHistory[source].length);
  }

  public recordRunFailure(source: SourceName, error: string, durationMs = 0) {
    this.ensureSourceInitialized(source);
    const now = new Date();
    const h = this.sourceHealth[source];
    h.isRunning = false;
    h.lastFailureAt = now.toISOString();
    h.lastDurationMs = durationMs;
    h.consecutiveFailures++;
    h.lastError = error;

    const m = this.sourceMetrics[source];
    m.runs_failed_total++;
    m.batches_failed_total++;
  }

  public recordHeartbeatSuccess() {
    this.lastHeartbeatDate = new Date();
    this.lastApiRequestDate = new Date();
    this.apiReachable = true;
  }

  public recordApiSuccess() {
    this.lastApiRequestDate = new Date();
    this.apiReachable = true;
  }

  public recordApiFailure() {
    this.apiReachable = false;
  }

  public recordDbQuerySuccess() {
    this.lastDbQueryDate = new Date();
    this.dbConnected = true;
  }

  public recordDbFailure() {
    this.dbConnected = false;
  }

  public getHealth(db?: DatabaseSync, schedulerEnabled = true): ConnectorHealth {
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - this.startedAtDate.getTime()) / 1000);

    let pendingQueue = 0;
    let failedQueue = 0;

    if (db) {
      try {
        const p = db.prepare(`SELECT COUNT(*) as c FROM sync_queue WHERE status IN ('pending', 'sending')`).get() as any;
        const f = db.prepare(`SELECT COUNT(*) as c FROM sync_queue WHERE status = 'error'`).get() as any;
        pendingQueue = p?.c ?? 0;
        failedQueue = f?.c ?? 0;
      } catch (err) {
        // Ignored in test mocks
      }
    }

    // Check staleness
    let anyStale = false;
    let anySevereFailure = false;

    for (const s of ['bi', 'produtividade', 'tarefas', 'metas', 'retornos', 'impressoes', 'safras'] as SourceName[]) {
      const h = this.sourceHealth[s];
      if (h.lastSuccessAt) {
        const lastSuccessMs = new Date(h.lastSuccessAt).getTime();
        const diffSec = (now - lastSuccessMs) / 1000;
        h.isStale = diffSec > h.staleThresholdSec;
      } else if (uptimeSeconds > h.staleThresholdSec) {
        h.isStale = true;
      } else {
        h.isStale = false;
      }

      if (h.isStale) anyStale = true;
      if (h.consecutiveFailures >= 5) anySevereFailure = true;
    }

    let connectorStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (!this.dbConnected || !this.apiReachable || anySevereFailure || failedQueue > 10) {
      connectorStatus = 'unhealthy';
    } else if (anyStale || pendingQueue > 20 || failedQueue > 0) {
      connectorStatus = 'degraded';
    }

    return {
      connectorStatus,
      startedAt: this.startedAtDate.toISOString(),
      uptimeSeconds,
      database: {
        connected: this.dbConnected,
        lastSuccessfulQueryAt: this.lastDbQueryDate ? this.lastDbQueryDate.toISOString() : null,
      },
      api: {
        reachable: this.apiReachable,
        lastSuccessfulRequestAt: this.lastApiRequestDate ? this.lastApiRequestDate.toISOString() : null,
      },
      queue: {
        pending: pendingQueue,
        failed: failedQueue,
      },
      scheduler: {
        enabled: schedulerEnabled,
        lastHeartbeatAt: this.lastHeartbeatDate ? this.lastHeartbeatDate.toISOString() : null,
      },
      sources: { ...this.sourceHealth },
      metrics: { ...this.sourceMetrics },
    };
  }
}

export const healthManager = new HealthManager();

import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { initializeCheckpointSchema, getCheckpoint } from '../db/checkpoint.js';
import { logger } from '../utils/logger.js';

export type OperationalState = 'ACTIVE' | 'STANDBY' | 'PAUSED';
export type ConnectorRole = 'PRIMARY' | 'SECONDARY';

export interface RemoteDocumentRoot {
  id: string;
  path: string;
  label?: string;
}

export interface ConnectorRemoteConfig {
  role?: ConnectorRole;
  priority?: number;
  lanUrl?: string | null;
  fileServerPort?: number;
  sqlHost?: string | null;
  sqlDatabase?: string | null;
  documentRoots?: RemoteDocumentRoot[];
  syncIntervals?: Partial<Record<'bi' | 'produtividade' | 'tarefas' | 'metas' | 'retornos' | 'impressoes' | 'safras', number>>;
  enabledModules?: Partial<Record<'bi' | 'produtividade' | 'tarefas' | 'metas' | 'retornos' | 'impressoes' | 'safras', boolean>>;
  notes?: string | null;
}

export interface CloudCheckpointEntry {
  cursorValue: string | null;
  secondaryCursor?: string | null;
  lastSuccessAt?: string | null;
}

export interface PendingUpdateDirective {
  version: string;
  sha256: string;
  bundleUrl?: string;
  publishedAt?: string;
}

export interface ConnectorDirective {
  operationalState: OperationalState;
  role?: ConnectorRole;
  shouldRunSqlSync: boolean;
  shouldRunDocumentWorker: boolean;
  configVersion: number;
  remoteConfig?: ConnectorRemoteConfig | null;
  latestCheckpoints?: Record<string, CloudCheckpointEntry> | null;
  pendingUpdate?: PendingUpdateDirective | null;
}

const FORBIDDEN_SECRET_KEY_PATTERN = /(password|passwd|secret|token|credential|apikey|api_key|private_key)/i;

/**
 * Remove qualquer chave sensível por defesa em profundidade: senhas nunca
 * podem trafegar ou ser persistidas via remoteConfig da nuvem.
 */
export function sanitizeRemoteConfig(raw: unknown): ConnectorRemoteConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const input = raw as Record<string, unknown>;
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (FORBIDDEN_SECRET_KEY_PATTERN.test(key)) {
      continue;
    }
    clean[key] = value;
  }

  const result: ConnectorRemoteConfig = {};
  if (clean.role === 'PRIMARY' || clean.role === 'SECONDARY') {
    result.role = clean.role;
  }
  if (typeof clean.priority === 'number' && Number.isFinite(clean.priority)) {
    result.priority = Math.max(1, Math.min(100, Math.round(clean.priority)));
  }
  if (typeof clean.lanUrl === 'string') {
    const trimmed = clean.lanUrl.trim().replace(/\/+$/, '');
    result.lanUrl = trimmed.length > 0 ? trimmed : null;
  } else if (clean.lanUrl === null) {
    result.lanUrl = null;
  }
  if (typeof clean.fileServerPort === 'number' && Number.isInteger(clean.fileServerPort) && clean.fileServerPort > 0 && clean.fileServerPort <= 65535) {
    result.fileServerPort = clean.fileServerPort;
  }
  if (typeof clean.sqlHost === 'string') {
    const trimmed = clean.sqlHost.trim();
    result.sqlHost = trimmed.length > 0 ? trimmed : null;
  }
  if (typeof clean.sqlDatabase === 'string') {
    const trimmed = clean.sqlDatabase.trim();
    result.sqlDatabase = trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(clean.documentRoots)) {
    const validRoots: RemoteDocumentRoot[] = [];
    const seen = new Set<string>();
    for (const item of clean.documentRoots) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const id = typeof r.id === 'string' ? r.id.trim().toLowerCase() : '';
      const rootPath = typeof r.path === 'string' ? r.path.trim() : '';
      if (!id || !/^[a-z0-9_-]{1,32}$/.test(id) || seen.has(id)) continue;
      if (!rootPath || rootPath.includes('\0')) continue;
      seen.add(id);
      validRoots.push({
        id,
        path: rootPath,
        ...(typeof r.label === 'string' && r.label.trim() ? { label: r.label.trim() } : {}),
      });
    }
    if (validRoots.length > 0) {
      result.documentRoots = validRoots.slice(0, 10);
    }
  }
  if (clean.syncIntervals && typeof clean.syncIntervals === 'object' && !Array.isArray(clean.syncIntervals)) {
    const intervals: Record<string, number> = {};
    for (const [k, v] of Object.entries(clean.syncIntervals as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 15 && v <= 86400) {
        intervals[k] = Math.round(v);
      }
    }
    if (Object.keys(intervals).length > 0) {
      result.syncIntervals = intervals as ConnectorRemoteConfig['syncIntervals'];
    }
  }
  if (clean.enabledModules && typeof clean.enabledModules === 'object' && !Array.isArray(clean.enabledModules)) {
    const enabled: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(clean.enabledModules as Record<string, unknown>)) {
      if (typeof v === 'boolean') {
        enabled[k] = v;
      }
    }
    if (Object.keys(enabled).length > 0) {
      result.enabledModules = enabled as ConnectorRemoteConfig['enabledModules'];
    }
  }
  if (typeof clean.notes === 'string') {
    result.notes = clean.notes.slice(0, 500);
  }

  return result;
}

export function isCloudCursorNewer(
  source: string,
  cloudCursor: string,
  cloudSecondary: string | null | undefined,
  localCursor: string | null | undefined,
  localSecondary: string | null | undefined,
): boolean {
  if (!cloudCursor || !cloudCursor.trim()) return false;
  if (!localCursor || !localCursor.trim()) return true;

  const numericSources = new Set(['bi', 'retornos', 'impressoes']);
  if (numericSources.has(source) && !Number.isNaN(Number(cloudCursor)) && !Number.isNaN(Number(localCursor))) {
    const cMain = Number(cloudCursor);
    const lMain = Number(localCursor);
    const cSec = Number(cloudSecondary ?? 0);
    const lSec = Number(localSecondary ?? 0);
    return cMain > lMain || (cMain === lMain && cSec > lSec);
  }

  if (cloudCursor > localCursor) return true;
  if (cloudCursor === localCursor && (cloudSecondary ?? '') > (localSecondary ?? '')) {
    return true;
  }
  return false;
}

export function advanceCheckpointsFromCloud(
  db: DatabaseSync,
  cloudCheckpoints: Record<string, CloudCheckpointEntry>,
): number {
  initializeCheckpointSchema(db);
  let updatedCount = 0;

  for (const [source, entry] of Object.entries(cloudCheckpoints)) {
    if (!entry || !entry.cursorValue) continue;
    const current = getCheckpoint(db, source);
    const newer = isCloudCursorNewer(
      source,
      entry.cursorValue,
      entry.secondaryCursor ?? null,
      current?.cursor_value ?? null,
      current?.secondary_cursor ?? null,
    );

    if (newer) {
      const successIso = entry.lastSuccessAt || new Date().toISOString();
      db.prepare(`
        INSERT INTO sync_checkpoints (source, cursor_value, secondary_cursor, last_success_at, last_batch_id, updated_at)
        VALUES (?, ?, ?, ?, 'cloud-ha-sync', CURRENT_TIMESTAMP)
        ON CONFLICT(source) DO UPDATE SET
          cursor_value = excluded.cursor_value,
          secondary_cursor = excluded.secondary_cursor,
          last_success_at = COALESCE(excluded.last_success_at, sync_checkpoints.last_success_at),
          updated_at = CURRENT_TIMESTAMP
      `).run(source, entry.cursorValue, entry.secondaryCursor ?? null, successIso);
      updatedCount++;
    }
  }

  return updatedCount;
}

type ConfigChangeListener = (config: ConnectorRemoteConfig, configVersion: number) => void;
type UpdateDirectiveListener = (pending: PendingUpdateDirective) => void;

class RuntimeDirectiveManager {
  private state: OperationalState;
  private role: ConnectorRole = 'PRIMARY';
  private sqlSyncAllowed: boolean;
  private docWorkerAllowed: boolean;
  private configVersion = 0;
  private remoteConfig: ConnectorRemoteConfig = {};
  private lastDirectiveAt: string | null = null;
  private configListeners = new Set<ConfigChangeListener>();
  private updateListeners = new Set<UpdateDirectiveListener>();
  private cacheFilePath: string;

  constructor() {
    this.cacheFilePath = path.join(process.cwd(), 'remote-config.cache.json');
    const initialRaw = (process.env.CONNECTOR_INITIAL_STATE || 'ACTIVE').toUpperCase().trim();
    if (initialRaw === 'STANDBY' || initialRaw === 'PAUSED') {
      this.state = initialRaw;
      this.sqlSyncAllowed = false;
      this.docWorkerAllowed = false;
    } else {
      this.state = 'ACTIVE';
      this.sqlSyncAllowed = true;
      this.docWorkerAllowed = true;
    }

    if (process.env.NODE_ENV !== 'test') {
      this.loadCachedConfig();
    }
  }

  private loadCachedConfig() {
    try {
      if (!fs.existsSync(this.cacheFilePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.configVersion === 'number') {
          this.configVersion = parsed.configVersion;
        }
        if (parsed.remoteConfig) {
          this.remoteConfig = sanitizeRemoteConfig(parsed.remoteConfig);
        }
        if (parsed.role === 'PRIMARY' || parsed.role === 'SECONDARY') {
          this.role = parsed.role;
        }
      }
    } catch {
      // Cache corrompido ou ilegível: segue com valores padrão do .env
    }
  }

  private saveCachedConfig() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const payload = {
        configVersion: this.configVersion,
        role: this.role,
        remoteConfig: this.remoteConfig,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // Falha não-fatal de escrita de cache
    }
  }

  public resetForTests() {
    this.state = 'ACTIVE';
    this.role = 'PRIMARY';
    this.sqlSyncAllowed = true;
    this.docWorkerAllowed = true;
    this.configVersion = 0;
    this.remoteConfig = {};
    this.lastDirectiveAt = null;
  }

  public onConfigChanged(listener: ConfigChangeListener): () => void {
    this.configListeners.add(listener);
    return () => this.configListeners.delete(listener);
  }

  public onUpdateDirective(listener: UpdateDirectiveListener): () => void {
    this.updateListeners.add(listener);
    return () => this.updateListeners.delete(listener);
  }

  public applyDirective(directive: ConnectorDirective | null | undefined, db?: DatabaseSync) {
    if (!directive || typeof directive !== 'object') return;

    const prevState = this.state;
    const nextState: OperationalState =
      directive.operationalState === 'STANDBY' || directive.operationalState === 'PAUSED'
        ? directive.operationalState
        : 'ACTIVE';

    this.state = nextState;
    if (directive.role === 'PRIMARY' || directive.role === 'SECONDARY') {
      this.role = directive.role;
    }
    this.sqlSyncAllowed = nextState === 'ACTIVE' && directive.shouldRunSqlSync !== false;
    this.docWorkerAllowed = nextState === 'ACTIVE' && directive.shouldRunDocumentWorker !== false;
    this.lastDirectiveAt = new Date().toISOString();

    if (prevState !== nextState) {
      logger.info(`[HA_DIRECTIVE] Estado operacional alterado pelo FIORIX SaaS: ${prevState} -> ${nextState} (SQL Sync: ${this.sqlSyncAllowed}, Worker Documental: ${this.docWorkerAllowed})`);
    }

    if (directive.latestCheckpoints && db) {
      try {
        const advanced = advanceCheckpointsFromCloud(db, directive.latestCheckpoints);
        if (advanced > 0) {
          logger.info(`[HA_CHECKPOINTS] ${advanced} cursor(es) sincronizados com a nuvem para continuidade sem lacunas.`);
        }
      } catch (chkErr: any) {
        logger.warn(`[HA_CHECKPOINTS] Aviso ao sincronizar cursores da nuvem: ${chkErr?.message || chkErr}`);
      }
    }

    if (typeof directive.configVersion === 'number' && directive.remoteConfig !== undefined) {
      const sanitized = sanitizeRemoteConfig(directive.remoteConfig);
      const changed = directive.configVersion !== this.configVersion || JSON.stringify(sanitized) !== JSON.stringify(this.remoteConfig);
      this.configVersion = directive.configVersion;
      this.remoteConfig = sanitized;
      if (changed) {
        this.saveCachedConfig();
        logger.info(`[REMOTE_CONFIG] Configuração remota aplicada (versão v${this.configVersion}).`);
        for (const listener of this.configListeners) {
          try {
            listener(this.remoteConfig, this.configVersion);
          } catch (err: any) {
            logger.warn(`[REMOTE_CONFIG] Erro em listener de configuração: ${err?.message || err}`);
          }
        }
      }
    }

    if (directive.pendingUpdate && directive.pendingUpdate.version && directive.pendingUpdate.sha256) {
      for (const listener of this.updateListeners) {
        try {
          listener(directive.pendingUpdate);
        } catch (err: any) {
          logger.warn(`[SELF_UPDATE] Erro ao acionar listener de atualização: ${err?.message || err}`);
        }
      }
    }
  }

  public getOperationalState(): OperationalState {
    return this.state;
  }

  public getRole(): ConnectorRole {
    return this.role;
  }

  public shouldRunSqlSync(): boolean {
    return this.sqlSyncAllowed;
  }

  public shouldRunDocumentWorker(): boolean {
    return this.docWorkerAllowed;
  }

  public isPaused(): boolean {
    return this.state === 'PAUSED';
  }

  public getConfigVersion(): number {
    return this.configVersion;
  }

  public getRemoteConfig(): ConnectorRemoteConfig {
    return this.remoteConfig;
  }

  public getTelemetrySummary() {
    return {
      operationalState: this.state,
      role: this.role,
      shouldRunSqlSync: this.sqlSyncAllowed,
      shouldRunDocumentWorker: this.docWorkerAllowed,
      configVersion: this.configVersion,
      lastDirectiveAt: this.lastDirectiveAt,
      lanUrl: this.remoteConfig.lanUrl ?? null,
    };
  }
}

export const runtimeDirective = new RuntimeDirectiveManager();


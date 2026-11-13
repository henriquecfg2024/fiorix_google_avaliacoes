import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { generateConnectorSecret, hashConnectorSecret } from '@/lib/connectorAuth';
import { dispatchAlert } from '@/lib/alerts/alert-dispatcher';
import type { AuthenticatedUser } from '@/lib/auth-helpers';

async function recordAuditLog(
  params: Parameters<typeof import('@/lib/audit')['recordAuditLog']>[0],
): Promise<void> {
  try {
    const mod = await import('@/lib/audit');
    await mod.recordAuditLog(params);
  } catch {
    // Em testes unitários sem contexto NextAuth, não interrompe a operação
  }
}

function hasRawSqlSupport(): boolean {
  return (
    typeof (prisma as any)?.$executeRawUnsafe === 'function' &&
    typeof (prisma as any)?.$queryRawUnsafe === 'function'
  );
}

export type OperationalState = 'ACTIVE' | 'STANDBY' | 'PAUSED';
export type ConnectorRole = 'PRIMARY' | 'SECONDARY';
export type FailoverMode = 'MANUAL' | 'AUTO';

/**
 * Compara versões SemVer de conectores (ex.: `v2.6.7` vs `v2.6.12`) numericamente.
 */
export function compareConnectorSemver(a: string, b: string): number {
  const parse = (ver: string): [number, number, number] | null => {
    const m = (ver || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)/i);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return a.localeCompare(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i]! - pb[i]!;
  }
  return 0;
}

export interface RemoteDocumentRootConfig {
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
  documentRoots?: RemoteDocumentRootConfig[];
  syncIntervals?: Partial<Record<'bi' | 'produtividade' | 'tarefas' | 'metas' | 'retornos' | 'impressoes' | 'safras', number>>;
  enabledModules?: Partial<Record<'bi' | 'produtividade' | 'tarefas' | 'metas' | 'retornos' | 'impressoes' | 'safras', boolean>>;
  notes?: string | null;
}

export interface ReleaseAssetManifest {
  version: string;
  publishedAt: string;
  bundle: {
    fileName: string;
    sha256: string;
    sizeBytes: number;
    gzipBytes: number;
  };
  nssm: {
    sha256: string;
    sizeBytes: number;
    gzipBytes: number;
  } | null;
  rustCli: {
    sha256: string;
    sizeBytes: number;
    gzipBytes: number;
  } | null;
}

export interface ConnectorHaNodeRecord {
  connectorId: string;
  tenantId: string;
  name: string;
  enabled: boolean;
  version: string | null;
  status: string;
  lastSeenAt: Date | null;
  createdAt: Date;
  role: ConnectorRole;
  operationalState: OperationalState;
  priority: number;
  hostname: string | null;
  osVersion: string | null;
  lanUrl: string | null;
  installedPath: string | null;
  remoteConfig: ConnectorRemoteConfig;
  configVersion: number;
  targetVersion: string | null;
  updateStatus: string;
  updateMessage: string | null;
  lastUpdateAt: Date | null;
}

export interface RollingUpdateState {
  active: boolean;
  targetVersion: string;
  phase:
    | 'UPDATING_STANDBY'
    | 'UPDATING_FORMER_ACTIVE'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'TIMED_OUT'
    | 'STAGED_AWAITING_RESTART';
  originalPrimaryId: string | null;
  startedAt: string;
  message?: string;
}

export interface TenantConnectorSettings {
  tenantId: string;
  failoverMode: FailoverMode;
  autoFailoverTimeoutSec: number;
  rollingUpdateState: RollingUpdateState | null;
}

export interface ConnectorDirectivePayload {
  operationalState: OperationalState;
  role: ConnectorRole;
  shouldRunSqlSync: boolean;
  shouldRunDocumentWorker: boolean;
  configVersion: number;
  remoteConfig: ConnectorRemoteConfig;
  latestCheckpoints: Record<
    string,
    { cursorValue: string | null; secondaryCursor: string | null; lastSuccessAt: string | null }
  >;
  pendingUpdate: {
    version: string;
    sha256: string;
    publishedAt: string;
  } | null;
}

const FORBIDDEN_SECRET_KEY_REGEX = /(password|passwd|secret|token|credential|apikey|api_key|private_key)/i;

export function hashEnrollmentToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

export function generateRawEnrollmentToken(): string {
  return `fx_enroll_${crypto.randomBytes(24).toString('hex')}`;
}

export function sanitizeCloudRemoteConfig(raw: unknown): ConnectorRemoteConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const src = raw as Record<string, unknown>;
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (FORBIDDEN_SECRET_KEY_REGEX.test(key)) continue;
    filtered[key] = value;
  }

  const out: ConnectorRemoteConfig = {};
  if (filtered.role === 'PRIMARY' || filtered.role === 'SECONDARY') {
    out.role = filtered.role;
  }
  if (typeof filtered.priority === 'number' && Number.isFinite(filtered.priority)) {
    out.priority = Math.max(1, Math.min(100, Math.round(filtered.priority)));
  }
  if (typeof filtered.lanUrl === 'string') {
    const cleanUrl = filtered.lanUrl.trim().replace(/\/+$/, '');
    out.lanUrl = cleanUrl.length > 0 ? cleanUrl.slice(0, 255) : null;
  } else if (filtered.lanUrl === null) {
    out.lanUrl = null;
  }
  if (
    typeof filtered.fileServerPort === 'number' &&
    Number.isInteger(filtered.fileServerPort) &&
    filtered.fileServerPort > 0 &&
    filtered.fileServerPort <= 65535
  ) {
    out.fileServerPort = filtered.fileServerPort;
  }
  if (typeof filtered.sqlHost === 'string') {
    const cleanHost = filtered.sqlHost.trim();
    out.sqlHost = cleanHost.length > 0 ? cleanHost.slice(0, 128) : null;
  } else if (filtered.sqlHost === null) {
    out.sqlHost = null;
  }
  if (typeof filtered.sqlDatabase === 'string') {
    const cleanDb = filtered.sqlDatabase.trim();
    out.sqlDatabase = cleanDb.length > 0 ? cleanDb.slice(0, 128) : null;
  } else if (filtered.sqlDatabase === null) {
    out.sqlDatabase = null;
  }
  if (Array.isArray(filtered.documentRoots)) {
    const roots: RemoteDocumentRootConfig[] = [];
    const seen = new Set<string>();
    for (const entry of filtered.documentRoots) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as Record<string, unknown>;
      const id = typeof item.id === 'string' ? item.id.trim().toLowerCase() : '';
      const rootPath = typeof item.path === 'string' ? item.path.trim() : '';
      if (!id || !/^[a-z0-9_-]{1,32}$/.test(id) || seen.has(id)) continue;
      if (!rootPath || rootPath.length > 260 || rootPath.includes('\0')) continue;
      seen.add(id);
      roots.push({
        id,
        path: rootPath,
        ...(typeof item.label === 'string' && item.label.trim() ? { label: item.label.trim().slice(0, 80) } : {}),
      });
    }
    out.documentRoots = roots.slice(0, 10);
  }
  if (filtered.syncIntervals && typeof filtered.syncIntervals === 'object' && !Array.isArray(filtered.syncIntervals)) {
    const intervals: Record<string, number> = {};
    for (const [k, v] of Object.entries(filtered.syncIntervals as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 15 && v <= 86400) {
        intervals[k] = Math.round(v);
      }
    }
    if (Object.keys(intervals).length > 0) {
      out.syncIntervals = intervals as ConnectorRemoteConfig['syncIntervals'];
    }
  }
  if (filtered.enabledModules && typeof filtered.enabledModules === 'object' && !Array.isArray(filtered.enabledModules)) {
    const mods: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(filtered.enabledModules as Record<string, unknown>)) {
      if (typeof v === 'boolean') mods[k] = v;
    }
    if (Object.keys(mods).length > 0) {
      out.enabledModules = mods as ConnectorRemoteConfig['enabledModules'];
    }
  }
  if (typeof filtered.notes === 'string') {
    out.notes = filtered.notes.trim().slice(0, 500) || null;
  } else if (filtered.notes === null) {
    out.notes = null;
  }

  return out;
}

export function isCursorStrictlyNewer(
  source: string,
  candidateCursor: string | null | undefined,
  candidateSecondary: string | null | undefined,
  currentCursor: string | null | undefined,
  currentSecondary: string | null | undefined,
): boolean {
  if (!candidateCursor || !candidateCursor.trim()) return false;
  if (!currentCursor || !currentCursor.trim()) return true;

  const numericSources = new Set(['bi', 'retornos', 'impressoes']);
  if (
    numericSources.has(source) &&
    !Number.isNaN(Number(candidateCursor)) &&
    !Number.isNaN(Number(currentCursor))
  ) {
    const cMain = Number(candidateCursor);
    const lMain = Number(currentCursor);
    const cSec = Number(candidateSecondary ?? 0);
    const lSec = Number(currentSecondary ?? 0);
    return cMain > lMain || (cMain === lMain && cSec > lSec);
  }

  if (candidateCursor > currentCursor) return true;
  if (candidateCursor === currentCursor && (candidateSecondary ?? '') > (currentSecondary ?? '')) {
    return true;
  }
  return false;
}

let cachedManifest: { loadedAt: number; data: ReleaseAssetManifest | null } | null = null;

export function getLatestReleaseManifest(): ReleaseAssetManifest | null {
  const now = Date.now();
  if (cachedManifest && now - cachedManifest.loadedAt < 30_000) {
    return cachedManifest.data;
  }

  try {
    const manifestPath = path.join(process.cwd(), 'src', 'lib', 'connector', 'release-artifact', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      cachedManifest = { loadedAt: now, data: null };
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as ReleaseAssetManifest;
    cachedManifest = { loadedAt: now, data: parsed };
    return parsed;
  } catch {
    return null;
  }
}

export function getReleaseArtifactDir(): string {
  return path.join(process.cwd(), 'src', 'lib', 'connector', 'release-artifact');
}

let schemaInitialized = false;
let schemaInitPromise: Promise<void> | null = null;

export async function ensureConnectorHaSchema(): Promise<void> {
  if (schemaInitialized) return;
  if (schemaInitPromise) return schemaInitPromise;

  schemaInitPromise = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.fiorix_connector_ha_nodes (
          connector_id TEXT PRIMARY KEY REFERENCES "Connector"("id") ON DELETE CASCADE,
          tenant_id TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'PRIMARY',
          operational_state TEXT NOT NULL DEFAULT 'STANDBY',
          priority INT NOT NULL DEFAULT 10,
          hostname TEXT,
          os_version TEXT,
          lan_url TEXT,
          installed_path TEXT,
          remote_config JSONB NOT NULL DEFAULT '{}'::jsonb,
          config_version INT NOT NULL DEFAULT 1,
          target_version TEXT,
          update_status TEXT NOT NULL DEFAULT 'IDLE',
          update_message TEXT,
          last_update_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_fiorix_ha_nodes_tenant
          ON public.fiorix_connector_ha_nodes (tenant_id, priority ASC);
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_fiorix_ha_single_active_per_tenant
          ON public.fiorix_connector_ha_nodes (tenant_id)
          WHERE operational_state = 'ACTIVE';
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.fiorix_tenant_connector_settings (
          tenant_id TEXT PRIMARY KEY,
          failover_mode TEXT NOT NULL DEFAULT 'MANUAL',
          auto_failover_timeout_sec INT NOT NULL DEFAULT 180,
          rolling_update_state JSONB,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.fiorix_connector_enrollment_tokens (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          connector_name TEXT NOT NULL,
          intended_role TEXT NOT NULL DEFAULT 'PRIMARY',
          initial_state TEXT NOT NULL DEFAULT 'STANDBY',
          initial_remote_config JSONB NOT NULL DEFAULT '{}'::jsonb,
          expires_at TIMESTAMPTZ NOT NULL,
          consumed_at TIMESTAMPTZ,
          consumed_by_connector_id TEXT,
          created_by_user_id TEXT,
          created_by_name TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_fiorix_enrollment_tokens_tenant
          ON public.fiorix_connector_enrollment_tokens (tenant_id, created_at DESC);
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.fiorix_tenant_sync_checkpoints (
          tenant_id TEXT NOT NULL,
          source TEXT NOT NULL,
          cursor_value TEXT NOT NULL,
          secondary_cursor TEXT,
          last_success_at TIMESTAMPTZ,
          updated_by_connector_id TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (tenant_id, source)
        );
      `);
      schemaInitialized = true;
    } catch (err) {
      schemaInitPromise = null;
      throw err;
    }
  })();

  return schemaInitPromise;
}

/**
 * Inicialização sem interrupção (Zero-Downtime Bootstrap):
 * Garante que conectores existentes (ex.: HCFG-001 já em produção) recebam registro HA
 * e permaneçam como ACTIVE caso nenhum outro conector ativo/pausado exista no tenant.
 */
export async function syncTenantConnectorsHaRows(tenantId: string): Promise<void> {
  await ensureConnectorHaSchema();

  const connectors = await prisma.connector.findMany({
    where: {
      tenantId,
      enabled: true,
      NOT: { id: 'substituir_pelo_id_fornecido' },
    },
    select: {
      id: true,
      name: true,
      lastSeenAt: true,
      createdAt: true,
    },
    orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'asc' }],
  });

  if (connectors.length === 0) return;

  const existingHaRows = await prisma.$queryRawUnsafe<
    Array<{ connector_id: string; operational_state: string }>
  >(
    `SELECT connector_id, operational_state
     FROM public.fiorix_connector_ha_nodes
     WHERE tenant_id = $1`,
    tenantId,
  );

  const existingIds = new Set(existingHaRows.map((r) => r.connector_id));
  const hasActiveOrPaused = existingHaRows.some(
    (r) => r.operational_state === 'ACTIVE' || r.operational_state === 'PAUSED',
  );

  let bootstrapPromoted = hasActiveOrPaused;
  let index = 0;

  for (const conn of connectors) {
    index++;
    if (existingIds.has(conn.id)) continue;

    const shouldBeActive = !bootstrapPromoted;
    const state: OperationalState = shouldBeActive ? 'ACTIVE' : 'STANDBY';
    const role: ConnectorRole = shouldBeActive ? 'PRIMARY' : 'SECONDARY';
    const priority = shouldBeActive ? 1 : index * 10;

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_connector_ha_nodes
        (connector_id, tenant_id, role, operational_state, priority, config_version, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, NOW())
       ON CONFLICT (connector_id) DO NOTHING`,
      conn.id,
      tenantId,
      role,
      state,
      priority,
    ).catch(async () => {
      // Caso corrida concorrente já tenha eleito outro ACTIVE no índice parcial único, insere como STANDBY
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.fiorix_connector_ha_nodes
          (connector_id, tenant_id, role, operational_state, priority, config_version, updated_at)
         VALUES ($1, $2, 'SECONDARY', 'STANDBY', $3, 1, NOW())
         ON CONFLICT (connector_id) DO NOTHING`,
        conn.id,
        tenantId,
        priority + 10,
      );
    });

    if (shouldBeActive) {
      bootstrapPromoted = true;
    }
  }
}

function mapRawNodeRow(row: any): ConnectorHaNodeRecord {
  const parsedRemote =
    row.remote_config && typeof row.remote_config === 'object'
      ? sanitizeCloudRemoteConfig(row.remote_config)
      : {};
  const role: ConnectorRole = row.role === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY';
  const operationalState: OperationalState =
    row.operational_state === 'ACTIVE'
      ? 'ACTIVE'
      : row.operational_state === 'PAUSED'
      ? 'PAUSED'
      : 'STANDBY';

  return {
    connectorId: String(row.connector_id),
    tenantId: String(row.tenant_id),
    name: String(row.name || row.connector_id),
    enabled: Boolean(row.enabled),
    version: row.version ? String(row.version) : null,
    status: String(row.status || 'offline'),
    lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt) : null,
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    role,
    operationalState,
    priority: Number(row.priority ?? 10),
    hostname: row.hostname ? String(row.hostname) : null,
    osVersion: row.os_version ? String(row.os_version) : null,
    lanUrl: row.lan_url ? String(row.lan_url) : (parsedRemote.lanUrl ?? null),
    installedPath: row.installed_path ? String(row.installed_path) : null,
    remoteConfig: {
      ...parsedRemote,
      role,
      priority: Number(row.priority ?? 10),
      lanUrl: row.lan_url ? String(row.lan_url) : (parsedRemote.lanUrl ?? null),
    },
    configVersion: Number(row.config_version ?? 1),
    targetVersion: row.target_version ? String(row.target_version) : null,
    updateStatus: row.update_status ? String(row.update_status) : 'IDLE',
    updateMessage: row.update_message ? String(row.update_message) : null,
    lastUpdateAt: row.last_update_at ? new Date(row.last_update_at) : null,
  };
}

export async function listTenantConnectorNodes(tenantId: string): Promise<ConnectorHaNodeRecord[]> {
  if (!hasRawSqlSupport()) {
    const basic =
      typeof prisma?.connector?.findMany === 'function'
        ? await prisma.connector.findMany({
            where: { tenantId, enabled: true },
            select: { id: true, name: true, lastSeenAt: true },
            orderBy: { name: 'asc' },
          })
        : [];
    return (basic || []).map((c: any, idx: number) => ({
      connectorId: c.id,
      tenantId,
      name: c.name || c.id,
      enabled: true,
      version: null,
      status: 'online',
      lastSeenAt: c.lastSeenAt ? new Date(c.lastSeenAt) : null,
      createdAt: new Date(),
      role: idx === 0 ? 'PRIMARY' : 'SECONDARY',
      operationalState: idx === 0 ? 'ACTIVE' : 'STANDBY',
      priority: idx === 0 ? 1 : 20,
      hostname: null,
      osVersion: null,
      lanUrl: null,
      installedPath: null,
      remoteConfig: {},
      configVersion: 1,
      targetVersion: null,
      updateStatus: 'IDLE',
      updateMessage: null,
      lastUpdateAt: null,
    }));
  }

  await syncTenantConnectorsHaRows(tenantId);

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       c."id" AS connector_id,
       c."tenantId" AS tenant_id,
       c."name",
       c."enabled",
       c."version",
       c."status",
       c."lastSeenAt",
       c."createdAt",
       COALESCE(h.role, 'PRIMARY') AS role,
       COALESCE(h.operational_state, 'STANDBY') AS operational_state,
       COALESCE(h.priority, 10) AS priority,
       h.hostname,
       h.os_version,
       h.lan_url,
       h.installed_path,
       COALESCE(h.remote_config, '{}'::jsonb) AS remote_config,
       COALESCE(h.config_version, 1) AS config_version,
       h.target_version,
       COALESCE(h.update_status, 'IDLE') AS update_status,
       h.update_message,
       h.last_update_at
     FROM "Connector" c
     LEFT JOIN public.fiorix_connector_ha_nodes h ON h.connector_id = c."id"
     WHERE c."tenantId" = $1
       AND c."enabled" = true
       AND c."id" <> 'substituir_pelo_id_fornecido'
     ORDER BY
       CASE COALESCE(h.operational_state, 'STANDBY')
         WHEN 'ACTIVE' THEN 0
         WHEN 'STANDBY' THEN 1
         ELSE 2
       END ASC,
       COALESCE(h.priority, 10) ASC,
       c."createdAt" ASC`,
    tenantId,
  );

  return rows.map(mapRawNodeRow);
}

export async function getTenantConnectorSettings(tenantId: string): Promise<TenantConnectorSettings> {
  await ensureConnectorHaSchema();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT tenant_id, failover_mode, auto_failover_timeout_sec, rolling_update_state
     FROM public.fiorix_tenant_connector_settings
     WHERE tenant_id = $1`,
    tenantId,
  );

  if (rows.length === 0) {
    return {
      tenantId,
      failoverMode: 'MANUAL',
      autoFailoverTimeoutSec: 180,
      rollingUpdateState: null,
    };
  }

  const r = rows[0];
  return {
    tenantId,
    failoverMode: r.failover_mode === 'AUTO' ? 'AUTO' : 'MANUAL',
    autoFailoverTimeoutSec: Math.max(60, Number(r.auto_failover_timeout_sec ?? 180)),
    rollingUpdateState:
      r.rolling_update_state && typeof r.rolling_update_state === 'object'
        ? (r.rolling_update_state as RollingUpdateState)
        : null,
  };
}

export async function setTenantFailoverSettings(
  tenantId: string,
  failoverMode: FailoverMode,
  autoFailoverTimeoutSec = 180,
  actor?: AuthenticatedUser | null,
): Promise<TenantConnectorSettings> {
  await ensureConnectorHaSchema();
  const safeTimeout = Math.max(60, Math.min(3600, Math.round(autoFailoverTimeoutSec)));

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fiorix_tenant_connector_settings (tenant_id, failover_mode, auto_failover_timeout_sec, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       failover_mode = EXCLUDED.failover_mode,
       auto_failover_timeout_sec = EXCLUDED.auto_failover_timeout_sec,
       updated_at = NOW()`,
    tenantId,
    failoverMode,
    safeTimeout,
  );

  await recordAuditLog({
    modulo: 'OPERACOES_CONNECTOR',
    acao: 'ALTERACAO',
    registroId: tenantId,
    registroDescricao: `Modo de Failover alterado para ${failoverMode}`,
    detalhes: { failoverMode, autoFailoverTimeoutSec: safeTimeout },
    userOverride: actor ?? null,
  });

  return getTenantConnectorSettings(tenantId);
}

/**
 * Chaveamento atômico de Connector Ativo (garante exclusividade estrita por tenant).
 */
export async function promoteConnector(
  tenantId: string,
  targetConnectorId: string,
  actor?: AuthenticatedUser | null,
  reason = 'Chaveamento manual pelo painel Central de Operações',
): Promise<ConnectorHaNodeRecord[]> {
  await syncTenantConnectorsHaRows(tenantId);

  const target = await prisma.connector.findFirst({
    where: { id: targetConnectorId, tenantId, enabled: true },
    select: { id: true, name: true },
  });
  if (!target) {
    throw new Error('Servidor Connector não encontrado para este cartório.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ha:${tenantId}`}))`;

    await tx.$executeRawUnsafe(
      `UPDATE public.fiorix_connector_ha_nodes
       SET operational_state = 'STANDBY', updated_at = NOW()
       WHERE tenant_id = $1 AND operational_state = 'ACTIVE' AND connector_id <> $2`,
      tenantId,
      targetConnectorId,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO public.fiorix_connector_ha_nodes (connector_id, tenant_id, role, operational_state, priority, updated_at)
       VALUES ($1, $2, 'PRIMARY', 'ACTIVE', 1, NOW())
       ON CONFLICT (connector_id) DO UPDATE SET
         operational_state = 'ACTIVE',
         updated_at = NOW()`,
      targetConnectorId,
      tenantId,
    );
  });

  await recordAuditLog({
    modulo: 'OPERACOES_CONNECTOR',
    acao: 'PROMOCAO_ATIVO',
    registroId: targetConnectorId,
    registroDescricao: `Connector promovido a ATIVO: ${target.name}`,
    detalhes: { connectorId: targetConnectorId, connectorName: target.name, reason },
    userOverride: actor ?? null,
  });

  return listTenantConnectorNodes(tenantId);
}

/**
 * Pausa / Modo Manutenção / Parada de Emergência de um Connector.
 * Se o nó pausado era ACTIVE e promoteStandbyIfActive=true, promove automaticamente um STANDBY online.
 */
export async function pauseConnector(
  tenantId: string,
  targetConnectorId: string,
  promoteStandbyIfActive = true,
  actor?: AuthenticatedUser | null,
): Promise<{ nodes: ConnectorHaNodeRecord[]; promotedConnectorId: string | null }> {
  await syncTenantConnectorsHaRows(tenantId);

  const nodesBefore = await listTenantConnectorNodes(tenantId);
  const target = nodesBefore.find((n) => n.connectorId === targetConnectorId);
  if (!target) {
    throw new Error('Servidor Connector não encontrado.');
  }

  let promotedConnectorId: string | null = null;
  const nowMs = Date.now();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ha:${tenantId}`}))`;

    await tx.$executeRawUnsafe(
      `UPDATE public.fiorix_connector_ha_nodes
       SET operational_state = 'PAUSED', updated_at = NOW()
       WHERE tenant_id = $1 AND connector_id = $2`,
      tenantId,
      targetConnectorId,
    );

    if (target.operationalState === 'ACTIVE' && promoteStandbyIfActive) {
      const candidate = nodesBefore.find(
        (n) =>
          n.connectorId !== targetConnectorId &&
          n.operationalState === 'STANDBY' &&
          n.lastSeenAt &&
          nowMs - n.lastSeenAt.getTime() <= 120_000,
      );
      if (candidate) {
        await tx.$executeRawUnsafe(
          `UPDATE public.fiorix_connector_ha_nodes
           SET operational_state = 'ACTIVE', updated_at = NOW()
           WHERE tenant_id = $1 AND connector_id = $2`,
          tenantId,
          candidate.connectorId,
        );
        promotedConnectorId = candidate.connectorId;
      }
    }
  });

  await recordAuditLog({
    modulo: 'OPERACOES_CONNECTOR',
    acao: 'PAUSA_MANUTENCAO',
    registroId: targetConnectorId,
    registroDescricao: `Connector colocado em PAUSA / MANUTENÇÃO: ${target.name}`,
    detalhes: {
      connectorId: targetConnectorId,
      connectorName: target.name,
      previousState: target.operationalState,
      promotedConnectorId,
    },
    userOverride: actor ?? null,
  });

  const nodes = await listTenantConnectorNodes(tenantId);
  return { nodes, promotedConnectorId };
}

export async function resumeConnector(
  tenantId: string,
  targetConnectorId: string,
  actor?: AuthenticatedUser | null,
): Promise<{ nodes: ConnectorHaNodeRecord[]; newState: OperationalState }> {
  await syncTenantConnectorsHaRows(tenantId);

  let assignedState: OperationalState = 'STANDBY';

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ha:${tenantId}`}))`;

    const activeRows = await tx.$queryRawUnsafe<Array<{ connector_id: string }>>(
      `SELECT connector_id
       FROM public.fiorix_connector_ha_nodes
       WHERE tenant_id = $1 AND operational_state = 'ACTIVE' AND connector_id <> $2`,
      tenantId,
      targetConnectorId,
    );

    assignedState = activeRows.length === 0 ? 'ACTIVE' : 'STANDBY';

    await tx.$executeRawUnsafe(
      `UPDATE public.fiorix_connector_ha_nodes
       SET operational_state = $3, updated_at = NOW()
       WHERE tenant_id = $1 AND connector_id = $2`,
      tenantId,
      targetConnectorId,
      assignedState,
    );
  });

  await recordAuditLog({
    modulo: 'OPERACOES_CONNECTOR',
    acao: 'REATIVACAO',
    registroId: targetConnectorId,
    registroDescricao: `Connector reativado para estado ${assignedState}`,
    detalhes: { connectorId: targetConnectorId, assignedState },
    userOverride: actor ?? null,
  });

  const nodes = await listTenantConnectorNodes(tenantId);
  return { nodes, newState: assignedState };
}

export async function updateConnectorNodeConfig(
  tenantId: string,
  targetConnectorId: string,
  input: {
    name?: string;
    role?: ConnectorRole;
    priority?: number;
    lanUrl?: string | null;
    remoteConfig?: Record<string, unknown>;
  },
  actor?: AuthenticatedUser | null,
): Promise<ConnectorHaNodeRecord[]> {
  await syncTenantConnectorsHaRows(tenantId);

  const nodes = await listTenantConnectorNodes(tenantId);
  const current = nodes.find((n) => n.connectorId === targetConnectorId);
  if (!current) {
    throw new Error('Servidor Connector não encontrado.');
  }

  if (typeof input.name === 'string' && input.name.trim().length >= 2) {
    await prisma.connector.updateMany({
      where: { id: targetConnectorId, tenantId },
      data: { name: input.name.trim().slice(0, 100) },
    });
  }

  const nextRole: ConnectorRole = input.role === 'SECONDARY' || input.role === 'PRIMARY' ? input.role : current.role;
  const nextPriority =
    typeof input.priority === 'number' && Number.isFinite(input.priority)
      ? Math.max(1, Math.min(100, Math.round(input.priority)))
      : current.priority;

  const mergedRemote = sanitizeCloudRemoteConfig({
    ...current.remoteConfig,
    ...(input.remoteConfig ?? {}),
    role: nextRole,
    priority: nextPriority,
    ...(input.lanUrl !== undefined ? { lanUrl: input.lanUrl } : {}),
  });

  await prisma.$executeRawUnsafe(
    `UPDATE public.fiorix_connector_ha_nodes
     SET role = $3,
         priority = $4,
         lan_url = $5,
         remote_config = $6::jsonb,
         config_version = config_version + 1,
         updated_at = NOW()
     WHERE tenant_id = $1 AND connector_id = $2`,
    tenantId,
    targetConnectorId,
    nextRole,
    nextPriority,
    mergedRemote.lanUrl ?? null,
    JSON.stringify(mergedRemote),
  );

  await recordAuditLog({
    modulo: 'OPERACOES_CONNECTOR',
    acao: 'CONFIG_REMOTA',
    registroId: targetConnectorId,
    registroDescricao: `Configuração remota atualizada para ${input.name?.trim() || current.name}`,
    detalhes: {
      connectorId: targetConnectorId,
      role: nextRole,
      priority: nextPriority,
      lanUrl: mergedRemote.lanUrl ?? null,
      rootsCount: mergedRemote.documentRoots?.length ?? 0,
    },
    userOverride: actor ?? null,
  });

  return listTenantConnectorNodes(tenantId);
}

export async function triggerConnectorUpdate(
  tenantId: string,
  targetConnectorId: string,
  safeSwitchFirst = true,
  actor?: AuthenticatedUser | null,
): Promise<{ nodes: ConnectorHaNodeRecord[]; switchedToConnectorId: string | null; targetVersion: string }> {
  await syncTenantConnectorsHaRows(tenantId);

  const manifest = getLatestReleaseManifest();
  if (!manifest) {
    throw new Error('Pacote de release do Connector não encontrado no servidor SaaS.');
  }

  const nodes = await listTenantConnectorNodes(tenantId);
  const target = nodes.find((n) => n.connectorId === targetConnectorId);
  if (!target) {
    throw new Error('Servidor Connector não encontrado.');
  }

  let switchedToConnectorId: string | null = null;
  const nowMs = Date.now();

  if (target.operationalState === 'ACTIVE' && safeSwitchFirst) {
    const healthyStandby = nodes.find(
      (n) =>
        n.connectorId !== targetConnectorId &&
        n.operationalState === 'STANDBY' &&
        n.lastSeenAt &&
        nowMs - n.lastSeenAt.getTime() <= 120_000,
    );
    if (healthyStandby) {
      await promoteConnector(
        tenantId,
        healthyStandby.connectorId,
        actor,
        `Chaveamento preventivo antes de atualizar ${target.name} para ${manifest.version}`,
      );
      switchedToConnectorId = healthyStandby.connectorId;
    }
  }

  await prisma.$executeRawUnsafe(
    `UPDATE public.fiorix_connector_ha_nodes
     SET target_version = $3,
         update_status = 'PENDING',
         update_message = $4,
         last_update_at = NOW(),
         updated_at = NOW()
     WHERE tenant_id = $1 AND connector_id = $2`,
    tenantId,
    targetConnectorId,
    manifest.version,
    `Atualização para ${manifest.version} agendada pelo painel`,
  );

  await recordAuditLog({
    modulo: 'OPERACOES_CONNECTOR',
    acao: 'ATUALIZACAO_REMOTA',
    registroId: targetConnectorId,
    registroDescricao: `Atualização remota para ${manifest.version} solicitada em ${target.name}`,
    detalhes: {
      connectorId: targetConnectorId,
      targetVersion: manifest.version,
      switchedToConnectorId,
    },
    userOverride: actor ?? null,
  });

  return {
    nodes: await listTenantConnectorNodes(tenantId),
    switchedToConnectorId,
    targetVersion: manifest.version,
  };
}

export async function startRollingUpdate(
  tenantId: string,
  actor?: AuthenticatedUser | null,
): Promise<{ nodes: ConnectorHaNodeRecord[]; rollingState: RollingUpdateState }> {
  await syncTenantConnectorsHaRows(tenantId);
  const manifest = getLatestReleaseManifest();
  if (!manifest) {
    throw new Error('Pacote de release do Connector indisponível.');
  }

  const nowMs = Date.now();
  const nodes = await listTenantConnectorNodes(tenantId);
  const onlineNodes = nodes.filter((n) => n.lastSeenAt && nowMs - n.lastSeenAt.getTime() <= 120_000);
  if (onlineNodes.length === 0) {
    throw new Error('Nenhum servidor Connector está online no momento para atualização.');
  }

  const activeNode = onlineNodes.find((n) => n.operationalState === 'ACTIVE') ?? null;
  const standbyOutdated = onlineNodes.filter(
    (n) => n.operationalState === 'STANDBY' && n.version !== manifest.version,
  );

  let rollingState: RollingUpdateState;

  if (standbyOutdated.length > 0) {
    for (const st of standbyOutdated) {
      await prisma.$executeRawUnsafe(
        `UPDATE public.fiorix_connector_ha_nodes
         SET target_version = $3,
             update_status = 'PENDING',
             update_message = $4,
             last_update_at = NOW(),
             updated_at = NOW()
         WHERE tenant_id = $1 AND connector_id = $2`,
        tenantId,
        st.connectorId,
        manifest.version,
        `Rolling Update (Etapa 1/2): atualizando servidor reserva para ${manifest.version}`,
      );
    }
    rollingState = {
      active: true,
      targetVersion: manifest.version,
      phase: 'UPDATING_STANDBY',
      originalPrimaryId: activeNode?.connectorId ?? null,
      startedAt: new Date().toISOString(),
      message: `Atualizando ${standbyOutdated.length} servidor(es) em Hot-Standby para ${manifest.version} antes de chavear o principal.`,
    };
  } else if (activeNode && activeNode.version !== manifest.version) {
    const updatedStandby = onlineNodes.find(
      (n) => n.operationalState === 'STANDBY' && n.version === manifest.version,
    );
    if (updatedStandby) {
      await promoteConnector(
        tenantId,
        updatedStandby.connectorId,
        actor,
        `Rolling Update: promovendo reserva já em ${manifest.version}`,
      );
    }
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_connector_ha_nodes
       SET target_version = $3,
           update_status = 'PENDING',
           update_message = $4,
           last_update_at = NOW(),
           updated_at = NOW()
       WHERE tenant_id = $1 AND connector_id = $2`,
      tenantId,
      activeNode.connectorId,
      manifest.version,
      `Rolling Update: atualizando ${activeNode.name} para ${manifest.version}`,
    );
    rollingState = {
      active: true,
      targetVersion: manifest.version,
      phase: 'UPDATING_FORMER_ACTIVE',
      originalPrimaryId: activeNode.role === 'PRIMARY' ? activeNode.connectorId : null,
      startedAt: new Date().toISOString(),
      message: `Atualizando ${activeNode.name} para ${manifest.version}.`,
    };
  } else {
    rollingState = {
      active: false,
      targetVersion: manifest.version,
      phase: 'COMPLETED',
      originalPrimaryId: null,
      startedAt: new Date().toISOString(),
      message: `Todos os servidores online já estão na versão ${manifest.version}.`,
    };
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fiorix_tenant_connector_settings (tenant_id, rolling_update_state, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       rolling_update_state = EXCLUDED.rolling_update_state,
       updated_at = NOW()`,
    tenantId,
    JSON.stringify(rollingState),
  );

  await recordAuditLog({
    modulo: 'OPERACOES_CONNECTOR',
    acao: 'ATUALIZACAO_REMOTA',
    registroId: tenantId,
    registroDescricao: `Rolling Update iniciado para versão ${manifest.version}`,
    detalhes: rollingState as any,
    userOverride: actor ?? null,
  });

  return {
    nodes: await listTenantConnectorNodes(tenantId),
    rollingState,
  };
}

export async function cancelRollingUpdate(
  tenantId: string,
  actor?: AuthenticatedUser | null,
): Promise<{ nodes: ConnectorHaNodeRecord[]; rollingState: RollingUpdateState }> {
  await syncTenantConnectorsHaRows(tenantId);
  const manifest = getLatestReleaseManifest();
  const targetVer = manifest?.version ?? 'v2.6.2';

  const rollingState: RollingUpdateState = {
    active: false,
    targetVersion: targetVer,
    phase: 'CANCELLED',
    originalPrimaryId: null,
    startedAt: new Date().toISOString(),
    message: 'Rolling Update encerrado manualmente pelo operador.',
  };

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fiorix_tenant_connector_settings (tenant_id, rolling_update_state, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       rolling_update_state = EXCLUDED.rolling_update_state,
       updated_at = NOW()`,
    tenantId,
    JSON.stringify(rollingState),
  );

  await prisma.$executeRawUnsafe(
    `UPDATE public.fiorix_connector_ha_nodes
     SET target_version = NULL,
         update_status = 'IDLE',
         update_message = NULL,
         updated_at = NOW()
     WHERE tenant_id = $1`,
    tenantId,
  );

  await recordAuditLog({
    modulo: 'OPERACOES_CONNECTOR',
    acao: 'ATUALIZACAO_REMOTA',
    registroId: tenantId,
    registroDescricao: 'Rolling Update cancelado/limpo manualmente pelo operador',
    detalhes: rollingState as any,
    userOverride: actor ?? null,
  });

  return {
    nodes: await listTenantConnectorNodes(tenantId),
    rollingState,
  };
}

/**
 * Gera Token de Pareamento de uso único (TTL de 15 minutos, apenas hash SHA-256 salvo no banco).
 */
export async function createEnrollmentToken(
  tenantId: string,
  input: {
    connectorName: string;
    intendedRole?: ConnectorRole;
    initialState?: 'ACTIVE' | 'STANDBY';
    remoteConfig?: Record<string, unknown>;
  },
  actor?: AuthenticatedUser | null,
): Promise<{
  tokenId: string;
  rawToken: string;
  connectorName: string;
  intendedRole: ConnectorRole;
  initialState: 'ACTIVE' | 'STANDBY';
  expiresAt: string;
}> {
  await syncTenantConnectorsHaRows(tenantId);

  const cleanName = input.connectorName.trim().slice(0, 100);
  if (cleanName.length < 2) {
    throw new Error('Informe um nome válido para o servidor (ex.: SRVFILES — Principal).');
  }

  const existingNodes = await listTenantConnectorNodes(tenantId);
  const hasActiveAlready = existingNodes.some((n) => n.operationalState === 'ACTIVE');

  const intendedRole: ConnectorRole = input.intendedRole === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY';
  // Se já existe um Connector ACTIVE em produção (ex.: HCFG-001), novos servidores entram como STANDBY por segurança até validação!
  const initialState: 'ACTIVE' | 'STANDBY' =
    input.initialState === 'ACTIVE' && !hasActiveAlready
      ? 'ACTIVE'
      : input.initialState === 'STANDBY' || hasActiveAlready
      ? 'STANDBY'
      : 'ACTIVE';

  const sanitizedRemote = sanitizeCloudRemoteConfig({
    ...(input.remoteConfig ?? {}),
    role: intendedRole,
  });

  const tokenId = crypto.randomUUID();
  const rawToken = generateRawEnrollmentToken();
  const tokenHash = hashEnrollmentToken(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fiorix_connector_enrollment_tokens
      (id, tenant_id, token_hash, connector_name, intended_role, initial_state, initial_remote_config, expires_at, created_by_user_id, created_by_name, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, NOW())`,
    tokenId,
    tenantId,
    tokenHash,
    cleanName,
    intendedRole,
    initialState,
    JSON.stringify(sanitizedRemote),
    expiresAt,
    actor?.id ?? null,
    actor?.name ?? null,
  );

  await recordAuditLog({
    modulo: 'OPERACOES_CONNECTOR',
    acao: 'TOKEN_PAREAMENTO',
    registroId: tokenId,
    registroDescricao: `Token de pareamento gerado para servidor ${cleanName}`,
    detalhes: {
      connectorName: cleanName,
      intendedRole,
      initialState,
      expiresAt: expiresAt.toISOString(),
    },
    userOverride: actor ?? null,
  });

  return {
    tokenId,
    rawToken,
    connectorName: cleanName,
    intendedRole,
    initialState,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Consome atomicamente o token de uso único e provisiona o Connector no tenant correspondente.
 */
export async function consumeEnrollmentToken(
  rawToken: string,
  machineInfo: {
    hostname?: string | null;
    osVersion?: string | null;
    installedPath?: string | null;
    lanUrl?: string | null;
    version?: string | null;
  },
): Promise<{
  connectorId: string;
  connectorSecret: string;
  tenantId: string;
  tenantName: string;
  connectorName: string;
  role: ConnectorRole;
  operationalState: OperationalState;
  configVersion: number;
  remoteConfig: ConnectorRemoteConfig;
}> {
  await ensureConnectorHaSchema();

  const trimmed = (rawToken || '').trim();
  if (!trimmed.startsWith('fx_enroll_') || trimmed.length < 30) {
    throw new Error('INVALID_OR_EXPIRED_TOKEN');
  }

  const tokenHash = hashEnrollmentToken(trimmed);
  const rawSecret = generateConnectorSecret();
  const hashedSecret = await hashConnectorSecret(rawSecret);
  const newConnectorId = `conn_${crypto.randomBytes(12).toString('hex')}`;

  return prisma.$transaction(async (tx) => {
    const claimedRows = await tx.$queryRawUnsafe<any[]>(
      `UPDATE public.fiorix_connector_enrollment_tokens
       SET consumed_at = NOW(),
           consumed_by_connector_id = $2
       WHERE token_hash = $1
         AND consumed_at IS NULL
         AND expires_at > NOW()
       RETURNING *`,
      tokenHash,
      newConnectorId,
    );

    if (claimedRows.length !== 1) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }

    const tokenRow = claimedRows[0];
    const tenantId = String(tokenRow.tenant_id);

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ha:${tenantId}`}))`;

    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) {
      throw new Error('TENANT_NOT_FOUND');
    }

    const activeExisting = await tx.$queryRawUnsafe<Array<{ connector_id: string }>>(
      `SELECT connector_id
       FROM public.fiorix_connector_ha_nodes
       WHERE tenant_id = $1 AND operational_state = 'ACTIVE'`,
      tenantId,
    );

    const role: ConnectorRole = tokenRow.intended_role === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY';
    const operationalState: OperationalState =
      activeExisting.length === 0 && tokenRow.initial_state === 'ACTIVE' ? 'ACTIVE' : 'STANDBY';
    const priority = role === 'PRIMARY' ? 1 : 20;

    const initialRemote = sanitizeCloudRemoteConfig({
      ...(tokenRow.initial_remote_config && typeof tokenRow.initial_remote_config === 'object'
        ? tokenRow.initial_remote_config
        : {}),
      role,
      priority,
      ...(machineInfo.lanUrl ? { lanUrl: machineInfo.lanUrl } : {}),
    });

    await tx.connector.create({
      data: {
        id: newConnectorId,
        tenantId,
        name: String(tokenRow.connector_name),
        status: 'online',
        version: machineInfo.version || 'v2.6.0',
        enabled: true,
        credentialIdentifier: hashedSecret,
        lastSeenAt: new Date(),
      },
    });

    await tx.$executeRawUnsafe(
      `INSERT INTO public.fiorix_connector_ha_nodes
        (connector_id, tenant_id, role, operational_state, priority, hostname, os_version, lan_url, installed_path, remote_config, config_version, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, 1, NOW())`,
      newConnectorId,
      tenantId,
      role,
      operationalState,
      priority,
      machineInfo.hostname ?? null,
      machineInfo.osVersion ?? null,
      initialRemote.lanUrl ?? null,
      machineInfo.installedPath ?? null,
      JSON.stringify(initialRemote),
    );

    return {
      connectorId: newConnectorId,
      connectorSecret: rawSecret,
      tenantId,
      tenantName: tenant.name,
      connectorName: String(tokenRow.connector_name),
      role,
      operationalState,
      configVersion: 1,
      remoteConfig: initialRemote,
    };
  });
}

/**
 * Processa o heartbeat de qualquer Connector do tenant (ACTIVE, STANDBY ou PAUSED),
 * sincroniza cursores na nuvem, avalia Auto-Failover / Rolling Update e devolve a diretiva autoritativa.
 */
export async function processHeartbeatHaAndBuildDirective(params: {
  tenantId: string;
  connectorId: string;
  reportedVersion?: string | null;
  details?: Record<string, any> | null;
}): Promise<ConnectorDirectivePayload> {
  const { tenantId, connectorId, reportedVersion, details } = params;
  if (!hasRawSqlSupport()) {
    return {
      operationalState: 'ACTIVE',
      role: 'PRIMARY',
      shouldRunSqlSync: true,
      shouldRunDocumentWorker: true,
      configVersion: 1,
      remoteConfig: {},
      latestCheckpoints: {},
      pendingUpdate: null,
    };
  }
  await syncTenantConnectorsHaRows(tenantId);

  const runtimeInfo = details?.runtime && typeof details.runtime === 'object' ? details.runtime : null;
  const selfUpdateInfo = runtimeInfo?.selfUpdate && typeof runtimeInfo.selfUpdate === 'object' ? runtimeInfo.selfUpdate : null;
  const fileServerUrl =
    typeof details?.documental?.fileServer?.publicUrl === 'string'
      ? details.documental.fileServer.publicUrl
      : null;

  const hostname = typeof runtimeInfo?.hostname === 'string' ? runtimeInfo.hostname.slice(0, 128) : null;
  const osVersion = typeof runtimeInfo?.osVersion === 'string' ? runtimeInfo.osVersion.slice(0, 128) : null;
  const installedPath = typeof runtimeInfo?.installedPath === 'string' ? runtimeInfo.installedPath.slice(0, 260) : null;

  const nodesBefore = await listTenantConnectorNodes(tenantId);
  const thisNodeBefore = nodesBefore.find((n) => n.connectorId === connectorId);

  // Atualiza metadados reportados pelo agente e reconcilia target_version concluída
  if (thisNodeBefore) {
    let nextTargetVersion = thisNodeBefore.targetVersion;
    let nextUpdateStatus = thisNodeBefore.updateStatus;
    let nextUpdateMsg = thisNodeBefore.updateMessage;

    if (selfUpdateInfo?.status && selfUpdateInfo.status !== 'IDLE') {
      const updatedMs = selfUpdateInfo.updatedAt ? Date.parse(String(selfUpdateInfo.updatedAt)) : NaN;
      const staleApplying =
        selfUpdateInfo.status === 'APPLYING' &&
        reportedVersion !== selfUpdateInfo.targetVersion &&
        Number.isFinite(updatedMs) &&
        Date.now() - updatedMs > 4 * 60 * 1000;

      if (staleApplying) {
        nextTargetVersion = null;
        nextUpdateStatus = 'IDLE';
        nextUpdateMsg = `Pacote ${selfUpdateInfo.targetVersion || 'novo'} já baixado em disco (dist\\index.js.new). Agentes legados v2.6.0 exigem 1 reinício único do serviço.`;
      } else {
        nextUpdateStatus = String(selfUpdateInfo.status);
        nextUpdateMsg = selfUpdateInfo.message ? String(selfUpdateInfo.message).slice(0, 300) : nextUpdateMsg;
      }
    } else if (
      (nextUpdateStatus === 'APPLYING' || nextUpdateStatus === 'DOWNLOADING') &&
      reportedVersion &&
      (!nextTargetVersion ||
        nextTargetVersion === reportedVersion ||
        !thisNodeBefore.lastUpdateAt ||
        Date.now() - new Date(thisNodeBefore.lastUpdateAt).getTime() > 3 * 60 * 1000)
    ) {
      // Reconcilia estados APPLYING/DOWNLOADING presos quando o serviço já reiniciou em IDLE na versão ativa
      nextTargetVersion = null;
      nextUpdateStatus = 'SUCCEEDED';
      nextUpdateMsg = `Serviço ativo e confirmado na versão ${reportedVersion}.`;
    }

    if (nextTargetVersion && reportedVersion === nextTargetVersion) {
      nextTargetVersion = null;
      nextUpdateStatus = 'SUCCEEDED';
      nextUpdateMsg = `Servidor atualizado e operacional na versão ${reportedVersion}.`;
    }

    const inferredLanUrl =
      thisNodeBefore.lanUrl ||
      (fileServerUrl && !fileServerUrl.includes('localhost') && !fileServerUrl.includes('127.0.0.1')
        ? fileServerUrl
        : null);

    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_connector_ha_nodes
       SET hostname = COALESCE($3, hostname),
           os_version = COALESCE($4, os_version),
           installed_path = COALESCE($5, installed_path),
           lan_url = COALESCE(lan_url, $6),
           target_version = $7,
           update_status = $8,
           update_message = $9,
           updated_at = NOW()
       WHERE tenant_id = $1 AND connector_id = $2`,
      tenantId,
      connectorId,
      hostname,
      osVersion,
      installedPath,
      inferredLanUrl,
      nextTargetVersion,
      nextUpdateStatus,
      nextUpdateMsg,
    );
  }

  // Persiste cursores autoritativos do tenant quando reportados pelo nó ACTIVE (ou se tabela ainda vazia)
  const sourcesExtended =
    details?.sourcesExtended && typeof details.sourcesExtended === 'object' ? details.sourcesExtended : null;
  const existingCheckpoints = await prisma.$queryRawUnsafe<
    Array<{ source: string; cursor_value: string; secondary_cursor: string | null; last_success_at: Date | null }>
  >(
    `SELECT source, cursor_value, secondary_cursor, last_success_at
     FROM public.fiorix_tenant_sync_checkpoints
     WHERE tenant_id = $1`,
    tenantId,
  );
  const chkMap = new Map(existingCheckpoints.map((c) => [c.source, c]));

  if (sourcesExtended && (thisNodeBefore?.operationalState === 'ACTIVE' || existingCheckpoints.length === 0)) {
    for (const [source, sObj] of Object.entries(sourcesExtended as Record<string, any>)) {
      const candCursor = typeof sObj?.cursorValue === 'string' ? sObj.cursorValue.trim() : '';
      if (!candCursor) continue;
      const candSec = typeof sObj?.secondaryCursor === 'string' ? sObj.secondaryCursor : null;
      const curr = chkMap.get(source);
      if (isCursorStrictlyNewer(source, candCursor, candSec, curr?.cursor_value, curr?.secondary_cursor)) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO public.fiorix_tenant_sync_checkpoints
            (tenant_id, source, cursor_value, secondary_cursor, last_success_at, updated_by_connector_id, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), $5, NOW())
           ON CONFLICT (tenant_id, source) DO UPDATE SET
             cursor_value = EXCLUDED.cursor_value,
             secondary_cursor = EXCLUDED.secondary_cursor,
             last_success_at = NOW(),
             updated_by_connector_id = EXCLUDED.updated_by_connector_id,
             updated_at = NOW()`,
          tenantId,
          source,
          candCursor,
          candSec,
          connectorId,
        );
        chkMap.set(source, {
          source,
          cursor_value: candCursor,
          secondary_cursor: candSec,
          last_success_at: new Date(),
        });
      }
    }
  }

  // Avalia Failover Automático (apenas se failoverMode === 'AUTO') e Rolling Update
  const settings = await getTenantConnectorSettings(tenantId);
  let refreshedNodes = await listTenantConnectorNodes(tenantId);
  const nowMs = Date.now();

  if (settings.failoverMode === 'AUTO') {
    const activeNode = refreshedNodes.find((n) => n.operationalState === 'ACTIVE');
    const activeOfflineTooLong =
      activeNode &&
      (!activeNode.lastSeenAt ||
        nowMs - activeNode.lastSeenAt.getTime() > settings.autoFailoverTimeoutSec * 1000);

    if (activeOfflineTooLong) {
      const healthyStandby = refreshedNodes.find(
        (n) =>
          n.connectorId !== activeNode.connectorId &&
          n.operationalState === 'STANDBY' &&
          n.lastSeenAt &&
          nowMs - n.lastSeenAt.getTime() <= 90_000,
      );

      if (healthyStandby) {
        refreshedNodes = await promoteConnector(
          tenantId,
          healthyStandby.connectorId,
          null,
          `Failover automático: ${activeNode.name} sem sinal há mais de ${settings.autoFailoverTimeoutSec}s`,
        );
        dispatchAlert({
          tenantId,
          eventType: 'connector_offline',
          title: 'Failover Automático de Connector Executado',
          message: `O servidor principal (${activeNode.name}) ficou sem sinal por mais de ${Math.round(
            settings.autoFailoverTimeoutSec / 60,
          )} min. O servidor reserva (${healthyStandby.name}) assumiu automaticamente como ATIVO.`,
          severity: 'WARNING',
          metadata: {
            'Anterior (Offline)': activeNode.name,
            'Novo Ativo': healthyStandby.name,
          },
        }).catch(() => {});
      }
    }
  }

  if (settings.rollingUpdateState?.active) {
    const ru = settings.rollingUpdateState;
    const online = refreshedNodes.filter((n) => n.lastSeenAt && nowMs - n.lastSeenAt.getTime() <= 120_000);
    const ruStartedMs = ru.startedAt ? Date.parse(ru.startedAt) : NaN;
    const ruTimedOut = Number.isFinite(ruStartedMs) && nowMs - ruStartedMs > 8 * 60 * 1000;

    if (ruTimedOut) {
      const expiredRu: RollingUpdateState = {
        active: false,
        targetVersion: ru.targetVersion,
        phase: 'TIMED_OUT',
        originalPrimaryId: null,
        startedAt: ru.startedAt,
        message: `Tempo limite de reinício automático excedido (${ru.targetVersion}). Se o servidor estiver em v2.6.0, execute o Ativador Único (.BAT) uma vez.`,
      };
      await prisma.$executeRawUnsafe(
        `UPDATE public.fiorix_tenant_connector_settings
         SET rolling_update_state = $2::jsonb, updated_at = NOW()
         WHERE tenant_id = $1`,
        tenantId,
        JSON.stringify(expiredRu),
      );
      await prisma.$executeRawUnsafe(
        `UPDATE public.fiorix_connector_ha_nodes
         SET target_version = NULL,
             update_status = 'IDLE',
             updated_at = NOW()
         WHERE tenant_id = $1 AND version <> $2`,
        tenantId,
        ru.targetVersion,
      );
      refreshedNodes = await listTenantConnectorNodes(tenantId);
    } else if (ru.phase === 'UPDATING_STANDBY') {
      const standbysPending = online.filter(
        (n) => n.operationalState === 'STANDBY' && n.version !== ru.targetVersion,
      );
      if (standbysPending.length === 0) {
        const readyStandby = online.find(
          (n) => n.operationalState === 'STANDBY' && n.version === ru.targetVersion,
        );
        const currentActive = online.find((n) => n.operationalState === 'ACTIVE');
        if (readyStandby && currentActive && currentActive.version !== ru.targetVersion) {
          await promoteConnector(
            tenantId,
            readyStandby.connectorId,
            null,
            `Rolling Update (Etapa 2/2): chaveando para ${readyStandby.name} (${ru.targetVersion})`,
          );
          await prisma.$executeRawUnsafe(
            `UPDATE public.fiorix_connector_ha_nodes
             SET target_version = $3,
                 update_status = 'PENDING',
                 update_message = $4,
                 last_update_at = NOW(),
                 updated_at = NOW()
             WHERE tenant_id = $1 AND connector_id = $2`,
            tenantId,
            currentActive.connectorId,
            ru.targetVersion,
            `Rolling Update (Etapa 2/2): atualizando ${currentActive.name} para ${ru.targetVersion}`,
          );
          const nextRu: RollingUpdateState = {
            ...ru,
            phase: 'UPDATING_FORMER_ACTIVE',
            message: `Reserva atualizado e ativo. Atualizando ${currentActive.name} para ${ru.targetVersion}...`,
          };
          await prisma.$executeRawUnsafe(
            `UPDATE public.fiorix_tenant_connector_settings
             SET rolling_update_state = $2::jsonb, updated_at = NOW()
             WHERE tenant_id = $1`,
            tenantId,
            JSON.stringify(nextRu),
          );
          refreshedNodes = await listTenantConnectorNodes(tenantId);
        }
      }
    } else if (ru.phase === 'UPDATING_FORMER_ACTIVE') {
      const allOnlineUpdated = online.every((n) => n.version === ru.targetVersion);
      if (allOnlineUpdated) {
        if (ru.originalPrimaryId) {
          const orig = online.find((n) => n.connectorId === ru.originalPrimaryId);
          if (orig && orig.operationalState === 'STANDBY' && orig.role === 'PRIMARY') {
            await promoteConnector(
              tenantId,
              orig.connectorId,
              null,
              `Rolling Update concluído: restaurando servidor principal ${orig.name} (${ru.targetVersion})`,
            );
          }
        }
        const doneRu: RollingUpdateState = {
          active: false,
          targetVersion: ru.targetVersion,
          phase: 'COMPLETED',
          originalPrimaryId: null,
          startedAt: ru.startedAt,
          message: `Rolling Update concluído com sucesso (${ru.targetVersion}) sem interrupção.`,
        };
        await prisma.$executeRawUnsafe(
          `UPDATE public.fiorix_tenant_connector_settings
           SET rolling_update_state = $2::jsonb, updated_at = NOW()
           WHERE tenant_id = $1`,
          tenantId,
          JSON.stringify(doneRu),
        );
        refreshedNodes = await listTenantConnectorNodes(tenantId);
      }
    }
  }

  const finalNode = refreshedNodes.find((n) => n.connectorId === connectorId);
  const state: OperationalState = finalNode?.operationalState ?? 'ACTIVE';
  const role: ConnectorRole = finalNode?.role ?? 'PRIMARY';

  const latestCheckpoints: ConnectorDirectivePayload['latestCheckpoints'] = {};
  for (const [src, entry] of chkMap.entries()) {
    latestCheckpoints[src] = {
      cursorValue: entry.cursor_value,
      secondaryCursor: entry.secondary_cursor,
      lastSuccessAt: entry.last_success_at ? entry.last_success_at.toISOString() : null,
    };
  }

  const manifest = getLatestReleaseManifest();
  const hasOutdatedOnlineStandby = Boolean(
    manifest &&
    refreshedNodes.some(
      (n) =>
        n.operationalState === 'STANDBY' &&
        n.lastSeenAt &&
        nowMs - n.lastSeenAt.getTime() <= 120_000 &&
        n.version &&
        compareConnectorSemver(n.version, manifest.version) < 0,
    ),
  );
  const autoUpgradeEligible = Boolean(
    manifest &&
    !settings.rollingUpdateState?.active &&
    reportedVersion &&
    reportedVersion.startsWith('v2.') &&
    compareConnectorSemver(reportedVersion, manifest.version) < 0 &&
    (state === 'STANDBY' || !hasOutdatedOnlineStandby),
  );
  const pendingUpdate =
    manifest &&
    reportedVersion !== manifest.version &&
    (finalNode?.targetVersion === manifest.version || autoUpgradeEligible)
      ? {
          version: manifest.version,
          sha256: manifest.bundle.sha256,
          publishedAt: manifest.publishedAt,
        }
      : null;

  return {
    operationalState: state,
    role,
    shouldRunSqlSync: state === 'ACTIVE',
    shouldRunDocumentWorker: state === 'ACTIVE',
    configVersion: finalNode?.configVersion ?? 1,
    remoteConfig: finalNode?.remoteConfig ?? {},
    latestCheckpoints,
    pendingUpdate,
  };
}

/**
 * Resolve o Connector efetivo para Gestão Documental:
 * Prioriza o Connector solicitado se estiver ACTIVE e online; caso contrário,
 * redireciona automaticamente para o Connector ACTIVE e online do tenant.
 */
export async function resolveEffectiveDocumentConnector(
  tenantId: string,
  requestedConnectorId?: string | null,
): Promise<{ connectorId: string; lastSeenAt: Date } | null> {
  if (!hasRawSqlSupport()) {
    if (!requestedConnectorId || typeof prisma?.connector?.findFirst !== 'function') {
      return null;
    }
    const connector = await prisma.connector.findFirst({
      where: { id: requestedConnectorId, tenantId, enabled: true },
      select: { id: true, lastSeenAt: true },
    });
    if (!connector?.lastSeenAt || Date.now() - new Date(connector.lastSeenAt).getTime() > 120_000) {
      return null;
    }
    return { connectorId: connector.id, lastSeenAt: new Date(connector.lastSeenAt) };
  }

  const nodes = await listTenantConnectorNodes(tenantId);
  const nowMs = Date.now();
  const isOnline = (n: ConnectorHaNodeRecord) =>
    Boolean(n.lastSeenAt && nowMs - n.lastSeenAt.getTime() <= 120_000);

  if (requestedConnectorId) {
    const exact = nodes.find((n) => n.connectorId === requestedConnectorId);
    if (exact && exact.operationalState === 'ACTIVE' && isOnline(exact) && exact.lastSeenAt) {
      return { connectorId: exact.connectorId, lastSeenAt: exact.lastSeenAt };
    }
  }

  const activeOnline = nodes.find((n) => n.operationalState === 'ACTIVE' && isOnline(n));
  if (activeOnline && activeOnline.lastSeenAt) {
    return { connectorId: activeOnline.connectorId, lastSeenAt: activeOnline.lastSeenAt };
  }

  return null;
}

/**
 * Portão autoritativo de ingestão SQL (/api/v1/connector/sync):
 * Bloqueia imediatamente conectores em PAUSED (parada de emergência/manutenção)
 * e conectores legados (< v2.6.0) colocados em STANDBY.
 */
export async function evaluateConnectorSyncPermission(
  tenantId: string,
  connectorId: string,
): Promise<{ allowed: boolean; operationalState: OperationalState; reason?: string }> {
  if (!hasRawSqlSupport()) {
    return { allowed: true, operationalState: 'ACTIVE' };
  }
  await ensureConnectorHaSchema();

  let rows = await prisma.$queryRawUnsafe<
    Array<{ operational_state: string; version: string | null }>
  >(
    `SELECT h.operational_state, c."version"
     FROM public.fiorix_connector_ha_nodes h
     JOIN "Connector" c ON c."id" = h.connector_id
     WHERE h.tenant_id = $1 AND h.connector_id = $2
     LIMIT 1`,
    tenantId,
    connectorId,
  );

  if (rows.length === 0) {
    await syncTenantConnectorsHaRows(tenantId);
    rows = await prisma.$queryRawUnsafe<
      Array<{ operational_state: string; version: string | null }>
    >(
      `SELECT h.operational_state, c."version"
       FROM public.fiorix_connector_ha_nodes h
       JOIN "Connector" c ON c."id" = h.connector_id
       WHERE h.tenant_id = $1 AND h.connector_id = $2
       LIMIT 1`,
      tenantId,
      connectorId,
    );
  }

  if (rows.length === 0) {
    return { allowed: true, operationalState: 'ACTIVE' };
  }

  const state: OperationalState =
    rows[0].operational_state === 'PAUSED'
      ? 'PAUSED'
      : rows[0].operational_state === 'STANDBY'
      ? 'STANDBY'
      : 'ACTIVE';

  if (state === 'PAUSED') {
    return {
      allowed: false,
      operationalState: 'PAUSED',
      reason: 'Connector pausado pelo operador na Central de Operações.',
    };
  }

  if (state === 'STANDBY') {
    const ver = (rows[0].version || '').trim();
    const isModernHaAgent = ver >= 'v2.6.0';
    if (!isModernHaAgent) {
      return {
        allowed: false,
        operationalState: 'STANDBY',
        reason: 'Connector em modo Hot-Standby.',
      };
    }
  }

  return { allowed: true, operationalState: state };
}

export async function deleteConnectorNode(
  tenantId: string,
  connectorId: string,
  actor?: AuthenticatedUser | null,
): Promise<{ deletedConnectorId: string }> {
  await ensureConnectorHaSchema();

  const existing = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; operational_state: string | null }>
  >(
    `SELECT c."id", c."name", h.operational_state
     FROM "Connector" c
     LEFT JOIN public.fiorix_connector_ha_nodes h ON h.connector_id = c."id"
     WHERE c."tenantId" = $1 AND c."id" = $2
     LIMIT 1`,
    tenantId,
    connectorId,
  );

  if (existing.length === 0) {
    throw new Error('Servidor Connector não encontrado para este cartório.');
  }

  if (existing[0].operational_state === 'ACTIVE') {
    throw new Error(
      'Não é permitido excluir o servidor Principal ATIVO. Promova outro servidor ou pause-o primeiro.',
    );
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM public.fiorix_connector_ha_nodes WHERE tenant_id = $1 AND connector_id = $2`,
    tenantId,
    connectorId,
  );

  try {
    await prisma.connector.delete({ where: { id: connectorId } });
  } catch {
    await prisma.connector.update({
      where: { id: connectorId },
      data: { enabled: false, credentialIdentifier: `revoked_${connectorId}`, status: 'offline' },
    });
  }

  await recordAuditLog({
    modulo: 'OPERACOES_CONNECTOR',
    acao: 'EXCLUSAO',
    registroId: connectorId,
    registroDescricao: `Servidor Connector removido: ${existing[0].name}`,
    detalhes: { connectorId, connectorName: existing[0].name },
    userOverride: actor ?? null,
  });

  return { deletedConnectorId: connectorId };
}

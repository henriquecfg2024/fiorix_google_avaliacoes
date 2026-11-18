import { prisma } from '@/lib/prisma';
import { allPublicTablesExist } from '@/lib/db/ddl-guard';
import { getLatestReleaseManifest } from '@/lib/connector/ha-manager';
import { loadSrvsqlPerformanceSnapshot } from '@/lib/srvsql-performance/store';
import {
  evaluateInfraMorningBriefing,
  getBrtClock,
  getBrtDateString,
} from './engine';
import type {
  InfraBriefingDashboardSnapshot,
  InfraBriefingHistoryListItem,
  InfraBriefingSrvsqlRaw,
  InfraBriefingTrigger,
  InfraMorningBriefingRecord,
  RawInfraBriefingSample,
} from './types';

interface MemoryBriefingTenantState {
  liveSample: RawInfraBriefingSample | null;
  liveUpdatedAt: string | null;
  forceRefreshRequestedAt: string | null;
  briefingsByDate: Map<string, InfraMorningBriefingRecord>;
}

const memoryStateByTenant = new Map<string, MemoryBriefingTenantState>();
let ddlInitialized = false;

export function resetInfraBriefingMemoryForTests(): void {
  memoryStateByTenant.clear();
  ddlInitialized = false;
}

function getOrCreateMemoryState(tenantId: string): MemoryBriefingTenantState {
  const key = tenantId || 'default-tenant';
  let state = memoryStateByTenant.get(key);
  if (!state) {
    state = {
      liveSample: null,
      liveUpdatedAt: null,
      forceRefreshRequestedAt: null,
      briefingsByDate: new Map<string, InfraMorningBriefingRecord>(),
    };
    memoryStateByTenant.set(key, state);
  }
  return state;
}

interface PrismaLikeRaw {
  $executeRawUnsafe?: (query: string, ...values: unknown[]) => Promise<unknown>;
  $queryRawUnsafe?: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  connector?: {
    findMany?: (args: {
      where: { tenantId: string; enabled: boolean };
      select: { version: true; lastSeenAt: true };
      orderBy: { lastSeenAt: 'desc' };
      take: number;
    }) => Promise<Array<{ version: string | null; lastSeenAt: Date | null }>>;
  };
}

function getPrismaClient(): PrismaLikeRaw {
  return prisma as unknown as PrismaLikeRaw;
}

function hasRawSqlSupport(): boolean {
  const client = getPrismaClient();
  return (
    typeof client?.$executeRawUnsafe === 'function' &&
    typeof client?.$queryRawUnsafe === 'function'
  );
}

async function ensureInfraBriefingTables(): Promise<void> {
  if (ddlInitialized || !hasRawSqlSupport()) return;
  if (await allPublicTablesExist(['infra_briefing_live_state', 'infra_morning_briefings'])) {
    ddlInitialized = true;
    return;
  }
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.infra_briefing_live_state (
        tenant_id TEXT PRIMARY KEY,
        latest_payload JSONB,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        force_refresh_requested_at TIMESTAMPTZ NULL,
        force_refresh_requested_by TEXT NULL
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.infra_morning_briefings (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        briefing_date DATE NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        observed_at TIMESTAMPTZ NULL,
        trigger_source TEXT NOT NULL,
        is_official_0715 BOOLEAN NOT NULL DEFAULT FALSE,
        overall_status TEXT NOT NULL,
        executive_headline TEXT NOT NULL,
        payload JSONB NOT NULL,
        UNIQUE (tenant_id, briefing_date)
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_infra_morning_briefings_tenant_date
        ON public.infra_morning_briefings (tenant_id, briefing_date DESC);
    `);
    // Regra estrita de RLS sem FORCE ROW LEVEL SECURITY (Prisma conecta como owner postgres)
    await prisma.$executeRawUnsafe(`
      DO $$
      DECLARE
        v_tbl TEXT;
        v_pol TEXT;
      BEGIN
        FOREACH v_tbl IN ARRAY ARRAY['infra_briefing_live_state', 'infra_morning_briefings'] LOOP
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', v_tbl);
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated;', v_tbl);
          v_pol := 'rls_' || v_tbl || '_deny_external';
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = v_tbl AND policyname = v_pol
          ) THEN
            EXECUTE format(
              'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);',
              v_pol,
              v_tbl
            );
          END IF;
        END LOOP;
      END;
      $$;
    `);
    ddlInitialized = true;
  } catch {
    // Em testes ou indisponibilidade transitória, mantém fallback em memória
  }
}

function parseJsonColumn<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as T;
  }
  return null;
}

function normalizeTrigger(raw: unknown): InfraBriefingTrigger {
  const s = String(raw || '').toUpperCase();
  if (s === 'SCHEDULED_0715' || s === 'MANUAL_REFRESH' || s === 'PERIODIC' || s === 'STARTUP') {
    return s;
  }
  if (s === 'FALLBACK_SRVSQL_CACHE') return s;
  return 'PERIODIC';
}

function normalizeRawSample(rawInput: unknown): RawInfraBriefingSample {
  const raw =
    rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)
      ? (rawInput as Record<string, unknown>)
      : {};
  const observedAt =
    typeof raw.observedAt === 'string' && !Number.isNaN(Date.parse(raw.observedAt))
      ? new Date(raw.observedAt).toISOString()
      : new Date().toISOString();

  return {
    observedAt,
    trigger: normalizeTrigger(raw.trigger),
    collectorVersion: typeof raw.collectorVersion === 'string' ? raw.collectorVersion : 'v2.6.14',
    connectorHost: typeof raw.connectorHost === 'string' ? raw.connectorHost : 'SRVFILES',
    collectionDurationMs: Number(raw.collectionDurationMs || 0),
    srvsql:
      raw.srvsql && typeof raw.srvsql === 'object' && !Array.isArray(raw.srvsql)
        ? (raw.srvsql as RawInfraBriefingSample['srvsql'])
        : null,
    srvfiles:
      raw.srvfiles && typeof raw.srvfiles === 'object' && !Array.isArray(raw.srvfiles)
        ? (raw.srvfiles as RawInfraBriefingSample['srvfiles'])
        : null,
    srvsiplania:
      raw.srvsiplania && typeof raw.srvsiplania === 'object' && !Array.isArray(raw.srvsiplania)
        ? (raw.srvsiplania as RawInfraBriefingSample['srvsiplania'])
        : null,
  };
}

async function getPreviousBriefingRecord(
  tenantId: string,
  beforeDateStr: string,
): Promise<InfraMorningBriefingRecord | null> {
  const mem = getOrCreateMemoryState(tenantId);
  if (hasRawSqlSupport()) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ payload: unknown }>>(
        `SELECT payload
         FROM public.infra_morning_briefings
         WHERE tenant_id = $1 AND briefing_date < $2::date
         ORDER BY briefing_date DESC
         LIMIT 1`,
        tenantId,
        beforeDateStr,
      );
      const parsed = rows[0] ? parseJsonColumn<InfraMorningBriefingRecord>(rows[0].payload) : null;
      if (parsed) return parsed;
    } catch {
      // Fallback em memória
    }
  }

  const dates = Array.from(mem.briefingsByDate.keys())
    .filter((d) => d < beforeDateStr)
    .sort()
    .reverse();
  return dates[0] ? mem.briefingsByDate.get(dates[0]) ?? null : null;
}

async function getSavedBriefingForDate(
  tenantId: string,
  briefingDate: string,
): Promise<InfraMorningBriefingRecord | null> {
  const mem = getOrCreateMemoryState(tenantId);
  if (hasRawSqlSupport()) {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ payload: unknown }>>(
        `SELECT payload
         FROM public.infra_morning_briefings
         WHERE tenant_id = $1 AND briefing_date = $2::date
         LIMIT 1`,
        tenantId,
        briefingDate,
      );
      const parsed = rows[0] ? parseJsonColumn<InfraMorningBriefingRecord>(rows[0].payload) : null;
      if (parsed) return parsed;
    } catch {
      // Fallback em memória
    }
  }
  return mem.briefingsByDate.get(briefingDate) ?? null;
}

async function upsertMorningBriefing(
  tenantId: string,
  briefing: InfraMorningBriefingRecord,
): Promise<void> {
  const mem = getOrCreateMemoryState(tenantId);
  mem.briefingsByDate.set(briefing.briefingDate, briefing);

  if (!hasRawSqlSupport()) return;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.infra_morning_briefings (
         id, tenant_id, briefing_date, generated_at, observed_at,
         trigger_source, is_official_0715, overall_status, executive_headline, payload
       )
       VALUES ($1, $2, $3::date, $4::timestamptz, $5::timestamptz, $6, $7, $8, $9, $10::jsonb)
       ON CONFLICT (tenant_id, briefing_date) DO UPDATE SET
         generated_at = EXCLUDED.generated_at,
         observed_at = EXCLUDED.observed_at,
         trigger_source = EXCLUDED.trigger_source,
         is_official_0715 = public.infra_morning_briefings.is_official_0715 OR EXCLUDED.is_official_0715,
         overall_status = EXCLUDED.overall_status,
         executive_headline = EXCLUDED.executive_headline,
         payload = EXCLUDED.payload`,
      briefing.id,
      tenantId,
      briefing.briefingDate,
      briefing.generatedAt,
      briefing.observedAt,
      briefing.trigger,
      briefing.isOfficial0715,
      briefing.overallStatus,
      briefing.executiveHeadline,
      JSON.stringify(briefing),
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.infra_morning_briefings
       WHERE tenant_id = $1 AND briefing_date < (CURRENT_DATE - INTERVAL '90 days')`,
      tenantId,
    );
  } catch {
    // Mantém cópia em memória
  }
}

export async function ingestInfraBriefingSample(
  tenantId: string,
  rawPayload: unknown,
): Promise<{ savedDailyBriefing: boolean; briefingDate: string }> {
  await ensureInfraBriefingTables();
  const sample = normalizeRawSample(rawPayload);
  const now = new Date();
  const clock = getBrtClock(now);
  const mem = getOrCreateMemoryState(tenantId);

  mem.liveSample = sample;
  mem.liveUpdatedAt = now.toISOString();
  mem.forceRefreshRequestedAt = null;

  if (hasRawSqlSupport()) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.infra_briefing_live_state (
           tenant_id, latest_payload, updated_at, force_refresh_requested_at, force_refresh_requested_by
         )
         VALUES ($1, $2::jsonb, NOW(), NULL, NULL)
         ON CONFLICT (tenant_id) DO UPDATE SET
           latest_payload = EXCLUDED.latest_payload,
           updated_at = NOW(),
           force_refresh_requested_at = NULL`,
        tenantId,
        JSON.stringify(sample),
      );
    } catch {
      // Fallback em memória
    }
  }

  const existingToday = await getSavedBriefingForDate(tenantId, clock.dateStr);
  const isWorkdayMorningOrLater =
    clock.dayOfWeek >= 1 &&
    clock.dayOfWeek <= 6 &&
    (clock.hour > 7 || (clock.hour === 7 && clock.minute >= 15));

  let evaluatedToday: InfraMorningBriefingRecord | null = null;
  let statusChangedToday = false;
  if (
    sample.trigger !== 'STARTUP' &&
    sample.trigger !== 'SCHEDULED_0715' &&
    sample.trigger !== 'MANUAL_REFRESH' &&
    isWorkdayMorningOrLater &&
    existingToday
  ) {
    const previous = await getPreviousBriefingRecord(tenantId, clock.dateStr);
    evaluatedToday = evaluateInfraMorningBriefing({
      tenantId,
      briefingDate: clock.dateStr,
      generatedAt: now.toISOString(),
      trigger: sample.trigger,
      sample,
      previousBriefing: previous,
    });
    statusChangedToday = existingToday.overallStatus !== evaluatedToday.overallStatus;
  }

  const shouldPersistToday =
    sample.trigger === 'SCHEDULED_0715' ||
    sample.trigger === 'MANUAL_REFRESH' ||
    statusChangedToday ||
    (sample.trigger !== 'STARTUP' &&
      isWorkdayMorningOrLater &&
      (!existingToday || !existingToday.isOfficial0715));

  if (shouldPersistToday) {
    const evaluated =
      evaluatedToday ??
      evaluateInfraMorningBriefing({
        tenantId,
        briefingDate: clock.dateStr,
        generatedAt: now.toISOString(),
        trigger: sample.trigger,
        sample,
        previousBriefing: await getPreviousBriefingRecord(tenantId, clock.dateStr),
      });
    // Preserva selo oficial se o briefing oficial das 07:15 já foi registrado hoje
    if (existingToday?.isOfficial0715 && !evaluated.isOfficial0715) {
      evaluated.isOfficial0715 = true;
    }
    await upsertMorningBriefing(tenantId, evaluated);
    return { savedDailyBriefing: true, briefingDate: clock.dateStr };
  }

  return { savedDailyBriefing: false, briefingDate: clock.dateStr };
}

async function buildFallbackSrvsqlFromPerfCache(tenantId: string): Promise<RawInfraBriefingSample | null> {
  try {
    const perf = await loadSrvsqlPerformanceSnapshot(tenantId, 'LIVE_OR_REAL', '15m');
    if (perf.dataSourceMode !== 'LIVE_COLLECTOR' || !perf.collectorHealth.lastCollectionAt) {
      return null;
    }

    const totalRamMb = perf.windowsMemory.totalPhysicalMb;
    const freeRamMb = perf.windowsMemory.availablePhysicalMb;
    const usedRamPercent = perf.windowsMemory.usedPercent;
    const cpuTotalPercent = perf.kpis.serverCpuPercent;
    const blockedCount = perf.kpis.blockedSessionsCount;
    const zombieCount = perf.activeSessions.filter(
      (s) => s.elapsedTimeMs !== null && s.elapsedTimeMs > 120_000,
    ).length;

    const srvsqlFallback: InfraBriefingSrvsqlRaw = {
      host: perf.sqlMetadata.machineName || '10.0.0.25',
      sqlReachable: Boolean(perf.sqlMetadata.hasViewServerState),
      sqlLatencyMs: perf.collectorBudget.lastCollectionDurationMs,
      sqlStartTimeIso: perf.sqlMetadata.sqlServerStartTime,
      windowsBootTimeIso: null,
      osUptimeSeconds: null,
      vcpuCount: null,
      cpuTotalPercent,
      sqlCpuPercent: null,
      totalRamMb,
      freeRamMb,
      usedRamPercent,
      memoryStateDesc: perf.windowsMemory.windowsMemoryPressure,
      pleSeconds: perf.sqlMemory.pageLifeExpectancySec,
      bufferCacheHitRatioPercent: perf.sqlMemory.bufferCacheHitRatioPercent,
      userSessionsCount: null,
      activeRequestsCount: perf.activeSessions.filter((s) => Boolean(s.requestStatus)).length,
      blockedRequestsCount: blockedCount,
      zombieQueriesCount: zombieCount,
      memoryGrantsPending: perf.sqlMemory.memoryGrantsPending,
      iisReachable: true,
      iisLatencyMs: null,
      w3wpPid: null,
      w3wpFirstConnIso: null,
      w3wpConnectionsCount: null,
      w3wpWorkingSetMb:
        perf.windowsProcesses.find((p) => p.processName.toLowerCase().includes('w3wp'))?.workingSetMb ?? null,
      perfIndexesCount: null,
      perfIndexesSeeks: null,
      openCdsTasksCount: null,
      nonOnlineDatabases: [],
      highLogBackupDatabases: perf.databaseSpaces
        .filter((d) => d.logReuseWaitDesc === 'LOG_BACKUP' && (d.logUsedPercent ?? 0) >= 70)
        .map((d) => ({
          databaseName: d.databaseName,
          logUsedPercent: d.logUsedPercent ?? 0,
          logUsedMb: d.logUsedMb,
          logTotalMb: d.logTotalMb,
        })),
      volumes: perf.windowsVolumes.map((v) => ({
        mountPoint: v.volume,
        label: v.label || null,
        totalGb: v.totalSpaceGb,
        freeGb: v.freeSpaceGb,
        freePercent: v.freePercent,
      })),
      services: [],
      error: null,
    };

    return {
      observedAt: perf.collectorHealth.lastCollectionAt,
      trigger: 'FALLBACK_SRVSQL_CACHE',
      collectorVersion: perf.collectorHealth.collectorVersion || 'v2.6.13',
      connectorHost: 'SRVFILES',
      collectionDurationMs: perf.collectorBudget.lastCollectionDurationMs ?? 0,
      srvsql: srvsqlFallback,
      srvfiles: null,
      srvsiplania: null,
    };
  } catch {
    return null;
  }
}

export async function consumePendingInfraBriefingDirective(tenantId: string): Promise<string | null> {
  const mem = getOrCreateMemoryState(tenantId);
  const cutoffMs = Date.now() - 5 * 60 * 1000;

  if (hasRawSqlSupport()) {
    try {
      await ensureInfraBriefingTables();
      const rows = await prisma.$queryRawUnsafe<Array<{ req_at: Date | string | null }>>(
        `SELECT force_refresh_requested_at AS req_at
         FROM public.infra_briefing_live_state
         WHERE tenant_id = $1
         LIMIT 1`,
        tenantId,
      );
      if (rows.length > 0) {
        const raw = rows[0]?.req_at;
        if (!raw) return null;
        const parsed = raw instanceof Date ? raw : new Date(String(raw));
        if (Number.isNaN(parsed.getTime()) || parsed.getTime() < cutoffMs) {
          return null;
        }
        return parsed.toISOString();
      }
    } catch {
      // Fallback para estado em memória
    }
  }

  if (mem.forceRefreshRequestedAt) {
    const ts = Date.parse(mem.forceRefreshRequestedAt);
    if (Number.isFinite(ts) && ts >= cutoffMs) {
      return mem.forceRefreshRequestedAt;
    }
  }
  return null;
}

async function resolveConnectorVersionSummary(tenantId: string): Promise<{
  installedVersion: string | null;
  latestReleaseVersion: string | null;
}> {
  const manifest = getLatestReleaseManifest();
  const latestReleaseVersion = manifest?.version ?? null;
  let installedVersion: string | null = null;

  try {
    const client = getPrismaClient();
    if (hasRawSqlSupport()) {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ version: string | null }>>(
          `SELECT c."version"
           FROM "Connector" c
           LEFT JOIN public.fiorix_connector_ha_nodes h
             ON h.connector_id = c."id"
            AND h.tenant_id = c."tenantId"
           WHERE c."tenantId" = $1
             AND c."enabled" = true
             AND c."id" <> 'substituir_pelo_id_fornecido'
           ORDER BY
             CASE WHEN h.operational_state = 'ACTIVE' THEN 0 ELSE 1 END,
             c."lastSeenAt" DESC NULLS LAST
           LIMIT 1`,
          tenantId,
        );
        if (rows[0]?.version) {
          installedVersion = rows[0].version;
        }
      } catch {
        // Fallback para findMany caso tabela HA ou SQL bruto indisponível
      }
    }

    if (!installedVersion && typeof client?.connector?.findMany === 'function') {
      const nodes = await client.connector.findMany({
        where: { tenantId, enabled: true },
        select: { version: true, lastSeenAt: true },
        orderBy: { lastSeenAt: 'desc' },
        take: 1,
      });
      installedVersion = nodes[0]?.version ?? null;
    }
  } catch {
    // Ignora falha em ambiente de teste
  }

  return { installedVersion, latestReleaseVersion };
}

export async function loadInfraBriefingDashboard(
  tenantId: string,
  requestedDate?: string | null,
): Promise<InfraBriefingDashboardSnapshot> {
  await ensureInfraBriefingTables();
  const todayDateBrt = getBrtDateString(new Date());
  const targetDate =
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate.trim())
      ? requestedDate.trim()
      : todayDateBrt;

  const mem = getOrCreateMemoryState(tenantId);
  let liveSample = mem.liveSample;
  let forceReqIso: string | null = mem.forceRefreshRequestedAt;

  if (hasRawSqlSupport()) {
    try {
      const liveRows = await prisma.$queryRawUnsafe<
        Array<{ latest_payload: unknown; force_refresh_requested_at: Date | string | null }>
      >(
        `SELECT latest_payload, force_refresh_requested_at
         FROM public.infra_briefing_live_state
         WHERE tenant_id = $1
         LIMIT 1`,
        tenantId,
      );
      if (liveRows[0]) {
        const parsed = parseJsonColumn<RawInfraBriefingSample>(liveRows[0].latest_payload);
        if (parsed) liveSample = normalizeRawSample(parsed);
        const fAt = liveRows[0].force_refresh_requested_at;
        forceReqIso = fAt ? (fAt instanceof Date ? fAt.toISOString() : new Date(String(fAt)).toISOString()) : null;
      }
    } catch {
      // Fallback em memória
    }
  }

  let history: InfraBriefingHistoryListItem[] = [];
  if (hasRawSqlSupport()) {
    try {
      const histRows = await prisma.$queryRawUnsafe<
        Array<{
          briefing_date: Date | string;
          generated_at: Date | string;
          trigger_source: string;
          is_official_0715: boolean;
          overall_status: string;
          executive_headline: string;
        }>
      >(
        `SELECT
           to_char(briefing_date, 'YYYY-MM-DD') AS briefing_date,
           generated_at,
           trigger_source,
           is_official_0715,
           overall_status,
           executive_headline
         FROM public.infra_morning_briefings
         WHERE tenant_id = $1
         ORDER BY briefing_date DESC
         LIMIT 30`,
        tenantId,
      );
      history = histRows.map((r) => ({
        briefingDate: String(r.briefing_date).slice(0, 10),
        generatedAt: r.generated_at instanceof Date ? r.generated_at.toISOString() : String(r.generated_at),
        trigger: normalizeTrigger(r.trigger_source),
        isOfficial0715: Boolean(r.is_official_0715),
        overallStatus: (r.overall_status as InfraMorningBriefingRecord['overallStatus']) || 'AWAITING_TELEMETRY',
        executiveHeadline: String(r.executive_headline || ''),
      }));
    } catch {
      // Fallback em memória
    }
  }

  if (history.length === 0 && mem.briefingsByDate.size > 0) {
    history = Array.from(mem.briefingsByDate.values())
      .sort((a, b) => b.briefingDate.localeCompare(a.briefingDate))
      .slice(0, 30)
      .map((b) => ({
        briefingDate: b.briefingDate,
        generatedAt: b.generatedAt,
        trigger: b.trigger,
        isOfficial0715: b.isOfficial0715,
        overallStatus: b.overallStatus,
        executiveHeadline: b.executiveHeadline,
      }));
  }

  const effectiveLiveSample = liveSample ?? (await buildFallbackSrvsqlFromPerfCache(tenantId));
  const todayPrevious = await getPreviousBriefingRecord(tenantId, todayDateBrt);
  const liveBriefing = effectiveLiveSample
    ? evaluateInfraMorningBriefing({
        tenantId,
        briefingDate: todayDateBrt,
        generatedAt: new Date().toISOString(),
        trigger: effectiveLiveSample.trigger || 'PERIODIC',
        sample: effectiveLiveSample,
        previousBriefing: todayPrevious,
      })
    : null;

  const savedSelected = await getSavedBriefingForDate(tenantId, targetDate);
  let selectedBriefing: InfraMorningBriefingRecord;

  const liveObsMs = effectiveLiveSample?.observedAt ? Date.parse(effectiveLiveSample.observedAt) : Number.NaN;
  const savedObsMs = savedSelected?.observedAt ? Date.parse(savedSelected.observedAt) : Number.NaN;
  const liveIsNewerThanSaved =
    Boolean(effectiveLiveSample) &&
    Number.isFinite(liveObsMs) &&
    (!Number.isFinite(savedObsMs) || liveObsMs > savedObsMs);

  if (
    targetDate === todayDateBrt &&
    savedSelected &&
    liveBriefing &&
    liveIsNewerThanSaved &&
    savedSelected.overallStatus !== liveBriefing.overallStatus
  ) {
    selectedBriefing = {
      ...liveBriefing,
      isOfficial0715: savedSelected.isOfficial0715 || liveBriefing.isOfficial0715,
    };
  } else if (savedSelected && (savedSelected.isOfficial0715 || targetDate !== todayDateBrt || !liveBriefing)) {
    selectedBriefing = savedSelected;
  } else if (targetDate === todayDateBrt) {
    if (liveBriefing) {
      selectedBriefing = liveBriefing;
      if (
        savedSelected &&
        !savedSelected.isOfficial0715 &&
        savedSelected.overallStatus !== liveBriefing.overallStatus
      ) {
        await upsertMorningBriefing(tenantId, liveBriefing);
        history = history.map((item) =>
          item.briefingDate === todayDateBrt
            ? {
                ...item,
                generatedAt: liveBriefing.generatedAt,
                trigger: liveBriefing.trigger,
                overallStatus: liveBriefing.overallStatus,
                executiveHeadline: liveBriefing.executiveHeadline,
              }
            : item,
        );
      }
    } else {
      selectedBriefing = evaluateInfraMorningBriefing({
        tenantId,
        briefingDate: todayDateBrt,
        generatedAt: new Date().toISOString(),
        trigger: 'PERIODIC',
        sample: null,
        previousBriefing: todayPrevious,
      });
    }
  } else {
    selectedBriefing = evaluateInfraMorningBriefing({
      tenantId,
      briefingDate: targetDate,
      generatedAt: new Date().toISOString(),
      trigger: 'PERIODIC',
      sample: null,
      previousBriefing: null,
    });
    selectedBriefing.executiveHeadline = `Nenhum briefing matinal foi registrado em ${targetDate}.`;
  }

  const pendingConnectorRefresh = Boolean(
    forceReqIso &&
      Number.isFinite(Date.parse(forceReqIso)) &&
      Date.now() - Date.parse(forceReqIso) < 5 * 60 * 1000,
  );

  const { installedVersion, latestReleaseVersion } = await resolveConnectorVersionSummary(tenantId);

  return {
    selectedBriefing,
    liveBriefing,
    history,
    liveObservedAt: liveSample?.observedAt ?? selectedBriefing.observedAt,
    pendingConnectorRefresh,
    lastRefreshRequestedAt: pendingConnectorRefresh ? forceReqIso : null,
    connectorInstalledVersion: installedVersion,
    latestReleaseVersion,
    todayDateBrt,
  };
}

export async function requestImmediateInfraBriefingRefresh(
  tenantId: string,
  triggeredBy: string,
): Promise<InfraBriefingDashboardSnapshot> {
  await ensureInfraBriefingTables();
  const now = new Date();
  const nowIso = now.toISOString();
  const todayDateBrt = getBrtDateString(now);
  const mem = getOrCreateMemoryState(tenantId);

  mem.forceRefreshRequestedAt = nowIso;

  let liveSample = mem.liveSample;
  if (hasRawSqlSupport()) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.infra_briefing_live_state (
           tenant_id, updated_at, force_refresh_requested_at, force_refresh_requested_by
         )
         VALUES ($1, NOW(), $2::timestamptz, $3)
         ON CONFLICT (tenant_id) DO UPDATE SET
           force_refresh_requested_at = EXCLUDED.force_refresh_requested_at,
           force_refresh_requested_by = EXCLUDED.force_refresh_requested_by`,
        tenantId,
        nowIso,
        triggeredBy.slice(0, 120),
      );
      const rows = await prisma.$queryRawUnsafe<Array<{ latest_payload: unknown }>>(
        `SELECT latest_payload FROM public.infra_briefing_live_state WHERE tenant_id = $1 LIMIT 1`,
        tenantId,
      );
      const parsed = rows[0] ? parseJsonColumn<RawInfraBriefingSample>(rows[0].latest_payload) : null;
      if (parsed) liveSample = normalizeRawSample(parsed);
    } catch {
      // Fallback em memória
    }
  }

  const effectiveSample = liveSample ?? (await buildFallbackSrvsqlFromPerfCache(tenantId));
  if (effectiveSample) {
    const existingToday = await getSavedBriefingForDate(tenantId, todayDateBrt);
    const previous = await getPreviousBriefingRecord(tenantId, todayDateBrt);
    const evaluated = evaluateInfraMorningBriefing({
      tenantId,
      briefingDate: todayDateBrt,
      generatedAt: nowIso,
      trigger: 'MANUAL_REFRESH',
      sample: effectiveSample,
      previousBriefing: previous,
    });
    if (existingToday?.isOfficial0715) {
      evaluated.isOfficial0715 = true;
    }
    await upsertMorningBriefing(tenantId, evaluated);
  }

  return loadInfraBriefingDashboard(tenantId, todayDateBrt);
}

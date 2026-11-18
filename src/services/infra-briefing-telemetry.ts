import sql from 'mssql';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env.js';
import { AGENT_VERSION } from '../config/version.js';
import { logger } from '../utils/logger.js';
import { healthManager } from './health.js';
import { runtimeDirective } from './runtime-directive.js';
import { sendInfraBriefingSample } from './api.js';
import {
  coletarTelemetriaPostgresSiplanIaReadOnly,
  type SiplanIaPostgresTelemetry,
} from '../db/siplania-readonly.js';

const execFileAsync = promisify(execFile);

export type InfraBriefingTrigger =
  | 'STARTUP'
  | 'SCHEDULED_0715'
  | 'PERIODIC'
  | 'MANUAL_REFRESH';

export interface InfraBriefingVolumeRaw {
  mountPoint: string;
  label: string | null;
  totalGb: number | null;
  freeGb: number | null;
  freePercent: number | null;
}

export interface InfraBriefingServiceRaw {
  serviceName: string;
  displayName: string;
  state: 'RUNNING' | 'STOPPED';
  startMode: 'AUTO' | 'MANUAL' | 'DISABLED';
  pid: number | null;
}

export interface InfraBriefingSrvsqlRaw {
  host: string;
  sqlReachable: boolean;
  sqlLatencyMs: number | null;
  sqlStartTimeIso: string | null;
  windowsBootTimeIso: string | null;
  osUptimeSeconds: number | null;
  vcpuCount: number | null;
  cpuTotalPercent: number | null;
  sqlCpuPercent: number | null;
  totalRamMb: number | null;
  freeRamMb: number | null;
  usedRamPercent: number | null;
  memoryStateDesc: string | null;
  pleSeconds: number | null;
  bufferCacheHitRatioPercent: number | null;
  userSessionsCount: number | null;
  activeRequestsCount: number | null;
  blockedRequestsCount: number | null;
  zombieQueriesCount: number | null;
  memoryGrantsPending: number | null;
  iisReachable: boolean;
  iisLatencyMs: number | null;
  w3wpPid: number | null;
  w3wpFirstConnIso: string | null;
  w3wpConnectionsCount: number | null;
  w3wpWorkingSetMb: number | null;
  perfIndexesCount: number | null;
  perfIndexesSeeks: number | null;
  openCdsTasksCount: number | null;
  nonOnlineDatabases: string[];
  highLogBackupDatabases: Array<{
    databaseName: string;
    logUsedPercent: number;
    logUsedMb: number | null;
    logTotalMb: number | null;
  }>;
  volumes: InfraBriefingVolumeRaw[];
  services: InfraBriefingServiceRaw[];
  error: string | null;
}

export interface InfraBriefingSrvfilesRaw {
  host: string;
  lanIp: string | null;
  osUptimeSeconds: number;
  vcpuCount: number;
  cpuPercent: number | null;
  totalRamMb: number;
  freeRamMb: number;
  usedRamPercent: number;
  volumes: InfraBriefingVolumeRaw[];
  services: InfraBriefingServiceRaw[];
  mysqlPortReachable: boolean;
  mysqlLatencyMs: number | null;
  fileServerPort: number;
  fileServerReachable: boolean;
  fileServerLatencyMs: number | null;
  connectorVersion: string;
  connectorUptimeSeconds: number;
  connectorOperationalState: string;
  queuePending: number | null;
  queueFailed: number | null;
  queueQuarantined: number | null;
  cimAvailable: boolean;
  cimError: string | null;
}

export interface InfraBriefingSrvsiplaniaRaw {
  host: string;
  name: string;
  webReachable: boolean;
  webPort: number | null;
  webLatencyMs: number | null;
  httpStatusCode: number | null;
  postgresPort: number;
  postgresReachable: boolean;
  postgresLatencyMs: number | null;
  postgresSqlAuthenticated?: boolean;
  postgresSqlLatencyMs?: number | null;
  postgresVersion?: string | null;
  postgresUptimeSeconds?: number | null;
  postgresDbSizeMb?: number | null;
  postgresCacheHitPercent?: number | null;
  postgresTotalConnections?: number | null;
  postgresActiveQueries?: number | null;
  postgresIdleInTxCount?: number | null;
  postgresWaitingLocks?: number | null;
  postgresLongQueries?: number | null;
  postgresDeadlocks?: number | null;
  postgresSharedBuffersMb?: number | null;
  postgresMatriculasCount?: number | null;
  postgresPaginasOcrCount?: number | null;
  postgresDistinctClients?: number | null;
  postgresSqlError?: string | null;
  cimAvailable: boolean;
  cimError: string | null;
  osCaption: string | null;
  osUptimeSeconds: number | null;
  vcpuCount: number | null;
  cpuPercent: number | null;
  totalRamMb: number | null;
  freeRamMb: number | null;
  usedRamPercent: number | null;
  volumes: InfraBriefingVolumeRaw[];
  services: InfraBriefingServiceRaw[];
}

export interface RawInfraBriefingSample {
  observedAt: string;
  trigger: InfraBriefingTrigger;
  collectorVersion: string;
  connectorHost: string;
  collectionDurationMs: number;
  srvsql: InfraBriefingSrvsqlRaw;
  srvfiles: InfraBriefingSrvfilesRaw;
  srvsiplania: InfraBriefingSrvsiplaniaRaw;
}

interface CimHostProbeOutput {
  cimAvailable: boolean;
  cimError: string | null;
  osCaption: string | null;
  osUptimeSeconds: number | null;
  vcpuCount: number | null;
  cpuPercent: number | null;
  totalRamMb: number | null;
  freeRamMb: number | null;
  usedRamPercent: number | null;
  w3wpWorkingSetMb: number | null;
  volumes: InfraBriefingVolumeRaw[];
  services: InfraBriefingServiceRaw[];
}

let isCollectingInfraBriefing = false;

export function sanitizeBriefingErrorText(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? 'Erro desconhecido');
  return raw
    .replace(/password\s*=[^;\s]+/gi, 'password=[redacted]')
    .replace(/pwd\s*=[^;\s]+/gi, 'pwd=[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function getLocalLanIpv4(): string | null {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const addr of entries) {
      if (addr.family === 'IPv4' && !addr.internal && addr.address) {
        return addr.address;
      }
    }
  }
  return null;
}

export async function probeTcpPort(
  host: string,
  port: number,
  timeoutMs = 2000,
): Promise<{ reachable: boolean; latencyMs: number | null }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (reachable: boolean) => {
      if (settled) return;
      settled = true;
      const elapsed = Date.now() - start;
      try {
        socket.destroy();
      } catch {
        // Ignora erro ao destruir socket
      }
      resolve({ reachable, latencyMs: reachable ? elapsed : null });
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));

    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

async function probeHttpStatus(
  host: string,
  port: number,
  timeoutMs = 2200,
): Promise<{ ok: boolean; statusCode: number | null; latencyMs: number | null }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let settled = false;
    const isTls = port === 443;
    const mod = isTls ? https : http;

    const finish = (ok: boolean, statusCode: number | null) => {
      if (settled) return;
      settled = true;
      resolve({ ok, statusCode, latencyMs: ok ? Date.now() - start : null });
    };

    try {
      const req = mod.request(
        {
          hostname: host,
          port,
          path: '/',
          method: 'HEAD',
          timeout: timeoutMs,
          ...(isTls ? { rejectUnauthorized: false } : {}),
        },
        (res) => {
          res.resume();
          finish(true, typeof res.statusCode === 'number' ? res.statusCode : null);
        },
      );
      req.on('timeout', () => {
        req.destroy();
        finish(false, null);
      });
      req.on('error', () => finish(false, null));
      req.end();
    } catch {
      finish(false, null);
    }
  });
}

const CIM_HOST_PROBE_SCRIPT = `
$ErrorActionPreference = 'Stop'
$target = ($env:BRIEFING_TARGET_HOST + '').Trim()
$svcRegex = ($env:BRIEFING_SVC_REGEX + '').Trim()
$includeW3wp = ($env:BRIEFING_INCLUDE_W3WP + '').Trim() -eq '1'
if ([string]::IsNullOrWhiteSpace($target)) { exit 1 }

$localNames = @('localhost', '127.0.0.1', '::1', '.', $env:COMPUTERNAME.ToLower())
$shortTarget = $target.Split('.')[0].ToLower()
$isLocal = $localNames -contains $target.ToLower() -or $localNames -contains $shortTarget

$session = $null
try {
  if (-not $isLocal) {
    try {
      $session = New-CimSession -ComputerName $target -OperationTimeoutSec 3 -ErrorAction Stop
    } catch {
      $opt = New-CimSessionOption -Protocol Dcom
      $session = New-CimSession -ComputerName $target -SessionOption $opt -OperationTimeoutSec 3 -ErrorAction Stop
    }
  }

  $cimParams = @{ OperationTimeoutSec = 3 }
  if ($session) { $cimParams['CimSession'] = $session }

  $osObj = Get-CimInstance @cimParams -ClassName Win32_OperatingSystem | Select-Object -First 1
  $cpuRows = @(Get-CimInstance @cimParams -ClassName Win32_Processor)
  $disks = @(Get-CimInstance @cimParams -ClassName Win32_LogicalDisk -Filter "DriveType=3")
  $svcs = @(Get-CimInstance @cimParams -ClassName Win32_Service)

  $vcpu = 0
  $cpuSum = 0
  $cpuCnt = 0
  foreach ($c in $cpuRows) {
    if ($c.NumberOfLogicalProcessors) { $vcpu += [int]$c.NumberOfLogicalProcessors }
    if ($null -ne $c.LoadPercentage) { $cpuSum += [double]$c.LoadPercentage; $cpuCnt++ }
  }
  $cpuPct = if ($cpuCnt -gt 0) { [math]::Round(($cpuSum / $cpuCnt), 1) } else { $null }

  $totalRamMb = if ($osObj -and $osObj.TotalVisibleMemorySize) { [math]::Round(([double]$osObj.TotalVisibleMemorySize / 1024.0), 1) } else { $null }
  $freeRamMb = if ($osObj -and $null -ne $osObj.FreePhysicalMemory) { [math]::Round(([double]$osObj.FreePhysicalMemory / 1024.0), 1) } else { $null }
  $usedRamPct = if ($totalRamMb -and $freeRamMb -ne $null) { [math]::Round((($totalRamMb - $freeRamMb) / $totalRamMb) * 100.0, 1) } else { $null }
  $uptimeSec = if ($osObj -and $osObj.LastBootUpTime) { [int][math]::Max(0, ((Get-Date) - ([datetime]$osObj.LastBootUpTime)).TotalSeconds) } else { $null }

  $volList = foreach ($d in $disks) {
    if (-not $d.Size -or $d.Size -le 0) { continue }
    $tGb = [math]::Round(([double]$d.Size / 1GB), 2)
    $fGb = [math]::Round(([double]$d.FreeSpace / 1GB), 2)
    $fPct = if ($tGb -gt 0) { [math]::Round(($fGb / $tGb) * 100.0, 1) } else { $null }
    [pscustomobject]@{
      mountPoint = [string]$d.DeviceID
      label = if ($d.VolumeName) { [string]$d.VolumeName } else { $null }
      totalGb = $tGb
      freeGb = $fGb
      freePercent = $fPct
    }
  }

  $svcList = $svcs |
    Where-Object {
      if ($svcRegex) {
        $_.Name -match $svcRegex -or $_.DisplayName -match $svcRegex
      } else {
        $true
      }
    } |
    Select-Object -First 30 |
    ForEach-Object {
      [pscustomobject]@{
        serviceName = [string]$_.Name
        displayName = [string]$_.DisplayName
        state = if ($_.State -eq 'Running') { 'RUNNING' } else { 'STOPPED' }
        startMode = switch ($_.StartMode) { 'Auto' { 'AUTO' } 'Manual' { 'MANUAL' } default { 'DISABLED' } }
        pid = if ($_.ProcessId -gt 0) { [int]$_.ProcessId } else { $null }
      }
    }

  $w3wpMb = $null
  if ($includeW3wp) {
    try {
      $w3wpProcs = @(Get-CimInstance @cimParams -ClassName Win32_Process -Filter "Name='w3wp.exe'")
      if ($w3wpProcs.Count -gt 0) {
        $sumBytes = ($w3wpProcs | Measure-Object -Property WorkingSetSize -Sum).Sum
        $w3wpMb = [math]::Round(([double]$sumBytes / 1MB), 1)
      }
    } catch {}
  }

  [pscustomobject]@{
    osCaption = if ($osObj -and $osObj.Caption) { [string]$osObj.Caption } else { $null }
    osUptimeSeconds = $uptimeSec
    vcpuCount = if ($vcpu -gt 0) { $vcpu } else { $null }
    cpuPercent = $cpuPct
    totalRamMb = $totalRamMb
    freeRamMb = $freeRamMb
    usedRamPercent = $usedRamPct
    w3wpWorkingSetMb = $w3wpMb
    volumes = @($volList)
    services = @($svcList)
  } | ConvertTo-Json -Depth 4 -Compress
} finally {
  if ($session) { Remove-CimSession -CimSession $session -ErrorAction SilentlyContinue }
}
`.trim();

function emptyCimProbe(cimError: string | null): CimHostProbeOutput {
  return {
    cimAvailable: false,
    cimError,
    osCaption: null,
    osUptimeSeconds: null,
    vcpuCount: null,
    cpuPercent: null,
    totalRamMb: null,
    freeRamMb: null,
    usedRamPercent: null,
    w3wpWorkingSetMb: null,
    volumes: [],
    services: [],
  };
}

export async function probeWindowsHostViaCim(params: {
  host: string;
  svcRegex: string;
  includeW3wp?: boolean;
  timeoutMs?: number;
}): Promise<CimHostProbeOutput> {
  if (process.platform !== 'win32' || process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return emptyCimProbe('Coleta WMI/CIM executada somente em runtime Windows de produção.');
  }

  try {
    const encoded = Buffer.from(CIM_HOST_PROBE_SCRIPT, 'utf16le').toString('base64');
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      {
        timeout: params.timeoutMs ?? 6000,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
        env: {
          ...process.env,
          BRIEFING_TARGET_HOST: params.host,
          BRIEFING_SVC_REGEX: params.svcRegex,
          BRIEFING_INCLUDE_W3WP: params.includeW3wp ? '1' : '0',
        },
      },
    );

    const trimmed = (stdout || '').trim();
    if (!trimmed) {
      return emptyCimProbe(`Saída WMI/CIM vazia em ${params.host}.`);
    }

    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const rawVolumes = Array.isArray(parsed.volumes) ? parsed.volumes : [];
    const rawServices = Array.isArray(parsed.services) ? parsed.services : [];

    return {
      cimAvailable: true,
      cimError: null,
      osCaption: typeof parsed.osCaption === 'string' ? parsed.osCaption : null,
      osUptimeSeconds: typeof parsed.osUptimeSeconds === 'number' ? parsed.osUptimeSeconds : null,
      vcpuCount: typeof parsed.vcpuCount === 'number' ? parsed.vcpuCount : null,
      cpuPercent: typeof parsed.cpuPercent === 'number' ? parsed.cpuPercent : null,
      totalRamMb: typeof parsed.totalRamMb === 'number' ? parsed.totalRamMb : null,
      freeRamMb: typeof parsed.freeRamMb === 'number' ? parsed.freeRamMb : null,
      usedRamPercent: typeof parsed.usedRamPercent === 'number' ? parsed.usedRamPercent : null,
      w3wpWorkingSetMb: typeof parsed.w3wpWorkingSetMb === 'number' ? parsed.w3wpWorkingSetMb : null,
      volumes: rawVolumes.map((v: any) => ({
        mountPoint: String(v?.mountPoint || ''),
        label: typeof v?.label === 'string' && v.label.trim() ? v.label.trim() : null,
        totalGb: typeof v?.totalGb === 'number' ? v.totalGb : null,
        freeGb: typeof v?.freeGb === 'number' ? v.freeGb : null,
        freePercent: typeof v?.freePercent === 'number' ? v.freePercent : null,
      })),
      services: rawServices.map((s: any) => ({
        serviceName: String(s?.serviceName || ''),
        displayName: String(s?.displayName || s?.serviceName || ''),
        state: s?.state === 'RUNNING' ? 'RUNNING' : 'STOPPED',
        startMode:
          s?.startMode === 'AUTO' || s?.startMode === 'MANUAL' ? s.startMode : 'DISABLED',
        pid: typeof s?.pid === 'number' ? s.pid : null,
      })),
    };
  } catch (err: unknown) {
    return emptyCimProbe(
      `WMI/CIM remoto indisponível ou bloqueado pelo firewall em ${params.host}: ${sanitizeBriefingErrorText(err)}`,
    );
  }
}

async function collectSrvsqlSection(host: string, database: string): Promise<InfraBriefingSrvsqlRaw> {
  const result: InfraBriefingSrvsqlRaw = {
    host,
    sqlReachable: false,
    sqlLatencyMs: null,
    sqlStartTimeIso: null,
    windowsBootTimeIso: null,
    osUptimeSeconds: null,
    vcpuCount: null,
    cpuTotalPercent: null,
    sqlCpuPercent: null,
    totalRamMb: null,
    freeRamMb: null,
    usedRamPercent: null,
    memoryStateDesc: null,
    pleSeconds: null,
    bufferCacheHitRatioPercent: null,
    userSessionsCount: null,
    activeRequestsCount: null,
    blockedRequestsCount: null,
    zombieQueriesCount: null,
    memoryGrantsPending: null,
    iisReachable: false,
    iisLatencyMs: null,
    w3wpPid: null,
    w3wpFirstConnIso: null,
    w3wpConnectionsCount: null,
    w3wpWorkingSetMb: null,
    perfIndexesCount: null,
    perfIndexesSeeks: null,
    openCdsTasksCount: null,
    nonOnlineDatabases: [],
    highLogBackupDatabases: [],
    volumes: [],
    services: [],
    error: null,
  };

  const iisTcpPromise = probeTcpPort(host, 80, 1800);
  const cimPromise = probeWindowsHostViaCim({
    host,
    svcRegex: '^(MSSQL|SQLAgent|SQLSERVERAGENT|W3SVC|Zabbix|Veeam|AVP|klnagent)',
    includeW3wp: true,
    timeoutMs: 4500,
  });

  let pool: sql.ConnectionPool | null = null;
  try {
    const connectStart = Date.now();
    pool = await new sql.ConnectionPool({
      user: env.SQL_SERVER_USER,
      password: env.SQL_SERVER_PASSWORD,
      server: host,
      database,
      ...(process.env.SQL_SERVER_PORT ? { port: Number(process.env.SQL_SERVER_PORT) } : {}),
      connectionTimeout: 6000,
      requestTimeout: 8000,
      pool: { max: 1, min: 0, idleTimeoutMillis: 6000 },
      options: {
        encrypt: process.env.SQL_SERVER_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_SERVER_TRUST_CERT !== 'false',
        requestTimeout: 8000,
      },
    }).connect();

    await pool.request().query('SELECT 1 AS ok;');
    result.sqlReachable = true;
    result.sqlLatencyMs = Date.now() - connectStart;

    const [vitalsRes, cpuRes, w3wpRes, volRes, perfIdxRes, dbLogRes, cdsRes] = await Promise.all([
      pool.request().query(`
        SET NOCOUNT ON;
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SET LOCK_TIMEOUT 2000;
        SELECT
          CONVERT(VARCHAR(33), osi.sqlserver_start_time, 126) AS sqlserver_start_time_iso,
          CONVERT(VARCHAR(33), DATEADD(ms, -CAST(osi.ms_ticks AS BIGINT), GETDATE()), 126) AS windows_boot_time_iso,
          CAST(osi.ms_ticks / 1000 AS BIGINT) AS os_uptime_seconds,
          osi.cpu_count,
          CAST(osm.total_physical_memory_kb / 1024.0 AS FLOAT) AS total_ram_mb,
          CAST(osm.available_physical_memory_kb / 1024.0 AS FLOAT) AS free_ram_mb,
          CAST(osm.system_memory_state_desc AS VARCHAR(128)) AS memory_state_desc,
          (SELECT TOP 1 CAST(cntr_value AS INT)
           FROM sys.dm_os_performance_counters
           WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%') AS ple_seconds,
          (
            SELECT TOP 1 CASE WHEN b.cntr_value > 0 THEN CAST((a.cntr_value * 100.0) / b.cntr_value AS FLOAT) ELSE NULL END
            FROM sys.dm_os_performance_counters a
            CROSS JOIN sys.dm_os_performance_counters b
            WHERE a.object_name LIKE '%Buffer Manager%'
              AND a.counter_name = 'Buffer cache hit ratio'
              AND b.object_name LIKE '%Buffer Manager%'
              AND b.counter_name = 'Buffer cache hit ratio base'
          ) AS buffer_cache_hit_ratio_pct,
          (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1) AS user_sessions_count,
          (SELECT COUNT(*) FROM sys.dm_exec_requests WHERE session_id > 50 AND session_id <> @@SPID) AS active_requests_count,
          (SELECT COUNT(*) FROM sys.dm_exec_requests WHERE blocking_session_id > 0) AS blocked_requests_count,
          (SELECT COUNT(*) FROM sys.dm_exec_requests WHERE session_id > 50 AND session_id <> @@SPID AND total_elapsed_time > 120000) AS zombie_queries_count,
          (SELECT COUNT(*) FROM sys.dm_exec_query_memory_grants WHERE grant_time IS NULL) AS memory_grants_pending
        FROM sys.dm_os_sys_info osi
        CROSS JOIN sys.dm_os_sys_memory osm;
      `),
      pool.request().query(`
        SET NOCOUNT ON;
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SELECT TOP (1)
          record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS sql_cpu_percent,
          100 - record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS total_cpu_percent
        FROM (
          SELECT [timestamp], CONVERT(xml, record) AS [record]
          FROM sys.dm_os_ring_buffers WITH (NOLOCK)
          WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
            AND record LIKE N'%<SystemHealth>%'
        ) AS x
        ORDER BY [timestamp] DESC;
      `).catch(() => ({ recordset: [] as any[] })),
      pool.request().query(`
        SET NOCOUNT ON;
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SELECT TOP (1)
          s.host_process_id AS w3wp_pid,
          CONVERT(VARCHAR(33), MIN(s.login_time), 126) AS w3wp_first_conn_iso,
          COUNT(*) AS w3wp_connections_count
        FROM sys.dm_exec_sessions s
        WHERE s.is_user_process = 1
          AND s.host_process_id > 0
          AND s.program_name = '.Net SqlClient Data Provider'
          AND UPPER(LTRIM(RTRIM(ISNULL(s.host_name, '')))) = UPPER(LTRIM(RTRIM(CAST(SERVERPROPERTY('MachineName') AS VARCHAR(128)))))
        GROUP BY s.host_process_id
        ORDER BY COUNT(*) DESC;
      `).catch(() => ({ recordset: [] as any[] })),
      pool.request().query(`
        SET NOCOUNT ON;
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SELECT DISTINCT
          CAST(ISNULL(vs.volume_mount_point, LEFT(mf.physical_name, 3)) AS VARCHAR(64)) AS mount_point,
          CAST(ISNULL(vs.logical_volume_name, '') AS VARCHAR(128)) AS logical_name,
          CAST(vs.total_bytes / 1073741824.0 AS FLOAT) AS total_gb,
          CAST(vs.available_bytes / 1073741824.0 AS FLOAT) AS free_gb
        FROM sys.master_files mf
        CROSS APPLY sys.dm_os_volume_stats(mf.database_id, mf.file_id) vs;
      `).catch(() => ({ recordset: [] as any[] })),
      pool.request().query(`
        SET NOCOUNT ON;
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SELECT
          COUNT(DISTINCT i.object_id * 100000 + i.index_id) AS perf_indexes_count,
          ISNULL(SUM(ISNULL(us.user_seeks, 0)), 0) AS perf_indexes_seeks
        FROM sys.indexes i
        LEFT JOIN sys.dm_db_index_usage_stats us
          ON i.object_id = us.object_id AND i.index_id = us.index_id AND us.database_id = DB_ID()
        WHERE i.name LIKE 'IX_Perf_%' AND i.is_disabled = 0;
      `).catch(() => ({ recordset: [] as any[] })),
      pool.request().query(`
        SET NOCOUNT ON;
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        WITH pc_db AS (
          SELECT
            RTRIM(instance_name) AS db_name,
            MAX(CASE WHEN counter_name = 'Log File(s) Size (KB)' THEN CAST(cntr_value AS BIGINT) END) AS log_size_kb,
            MAX(CASE WHEN counter_name = 'Log File(s) Used Size (KB)' THEN CAST(cntr_value AS BIGINT) END) AS log_used_kb,
            MAX(CASE WHEN counter_name = 'Percent Log Used' THEN CAST(cntr_value AS FLOAT) END) AS pct_log_used
          FROM sys.dm_os_performance_counters
          WHERE object_name LIKE '%:Databases%'
            AND instance_name NOT IN ('_Total', '')
          GROUP BY RTRIM(instance_name)
        )
        SELECT
          CAST(d.name AS VARCHAR(128)) AS database_name,
          CAST(d.state_desc AS VARCHAR(32)) AS state_desc,
          CAST(d.log_reuse_wait_desc AS VARCHAR(64)) AS log_reuse_wait_desc,
          CAST(pc.log_used_kb / 1024.0 AS FLOAT) AS log_used_mb,
          CAST(pc.log_size_kb / 1024.0 AS FLOAT) AS log_total_mb,
          CAST(
            COALESCE(
              CASE WHEN pc.log_size_kb > 0 AND pc.log_used_kb IS NOT NULL THEN (pc.log_used_kb * 100.0) / pc.log_size_kb ELSE NULL END,
              pc.pct_log_used
            ) AS FLOAT
          ) AS log_used_percent
        FROM sys.databases d
        LEFT JOIN pc_db pc ON pc.db_name = d.name
        WHERE d.state_desc <> 'ONLINE'
           OR (d.log_reuse_wait_desc = 'LOG_BACKUP' AND d.database_id > 4);
      `).catch(() => ({ recordset: [] as any[] })),
      pool.request().query(`
        SET NOCOUNT ON;
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        IF HAS_PERMS_BY_NAME('dbo.tblCDSTarefa', 'OBJECT', 'SELECT') = 1
          SELECT COUNT(*) AS open_cds_tasks
          FROM dbo.tblCDSTarefa WITH (NOLOCK)
          WHERE FK_tblCDSSituacaoTipo_Id IN (1, 2) AND ISNULL(TarefaSuspensa, 0) = 0;
        ELSE
          SELECT CAST(NULL AS INT) AS open_cds_tasks;
      `).catch(() => ({ recordset: [{ open_cds_tasks: null }] })),
    ]);

    const v = vitalsRes.recordset[0] || {};
    const c = cpuRes.recordset[0] || {};
    const w = w3wpRes.recordset[0] || {};
    const pIdx = perfIdxRes.recordset[0] || {};
    const cdsRow = cdsRes.recordset[0] || {};

    const totalRamMb = typeof v.total_ram_mb === 'number' ? Math.round(v.total_ram_mb * 10) / 10 : null;
    const freeRamMb = typeof v.free_ram_mb === 'number' ? Math.round(v.free_ram_mb * 10) / 10 : null;

    result.sqlStartTimeIso = v.sqlserver_start_time_iso ? String(v.sqlserver_start_time_iso) : null;
    result.windowsBootTimeIso = v.windows_boot_time_iso ? String(v.windows_boot_time_iso) : null;
    result.osUptimeSeconds = typeof v.os_uptime_seconds === 'number' ? Number(v.os_uptime_seconds) : null;
    result.vcpuCount = typeof v.cpu_count === 'number' ? Number(v.cpu_count) : null;
    result.cpuTotalPercent =
      typeof c.total_cpu_percent === 'number' ? Math.max(0, Math.min(100, Number(c.total_cpu_percent))) : null;
    result.sqlCpuPercent =
      typeof c.sql_cpu_percent === 'number' ? Math.max(0, Math.min(100, Number(c.sql_cpu_percent))) : null;
    result.totalRamMb = totalRamMb;
    result.freeRamMb = freeRamMb;
    result.usedRamPercent =
      totalRamMb && freeRamMb !== null ? Math.round(((totalRamMb - freeRamMb) / totalRamMb) * 1000) / 10 : null;
    result.memoryStateDesc = v.memory_state_desc ? String(v.memory_state_desc) : null;
    result.pleSeconds = typeof v.ple_seconds === 'number' ? Number(v.ple_seconds) : null;
    result.bufferCacheHitRatioPercent =
      typeof v.buffer_cache_hit_ratio_pct === 'number'
        ? Math.round(Number(v.buffer_cache_hit_ratio_pct) * 100) / 100
        : null;
    result.userSessionsCount = typeof v.user_sessions_count === 'number' ? Number(v.user_sessions_count) : null;
    result.activeRequestsCount = typeof v.active_requests_count === 'number' ? Number(v.active_requests_count) : null;
    result.blockedRequestsCount = typeof v.blocked_requests_count === 'number' ? Number(v.blocked_requests_count) : null;
    result.zombieQueriesCount = typeof v.zombie_queries_count === 'number' ? Number(v.zombie_queries_count) : null;
    result.memoryGrantsPending = typeof v.memory_grants_pending === 'number' ? Number(v.memory_grants_pending) : null;

    result.w3wpPid = typeof w.w3wp_pid === 'number' ? Number(w.w3wp_pid) : null;
    result.w3wpFirstConnIso = w.w3wp_first_conn_iso ? String(w.w3wp_first_conn_iso) : null;
    result.w3wpConnectionsCount =
      typeof w.w3wp_connections_count === 'number' ? Number(w.w3wp_connections_count) : null;

    result.perfIndexesCount = typeof pIdx.perf_indexes_count === 'number' ? Number(pIdx.perf_indexes_count) : null;
    result.perfIndexesSeeks =
      pIdx.perf_indexes_seeks !== null && pIdx.perf_indexes_seeks !== undefined ? Number(pIdx.perf_indexes_seeks) : null;
    result.openCdsTasksCount =
      typeof cdsRow.open_cds_tasks === 'number' ? Number(cdsRow.open_cds_tasks) : null;

    result.volumes = (volRes.recordset || [])
      .filter((row: any) => typeof row.total_gb === 'number' && row.total_gb > 0)
      .map((row: any) => {
        const totalGb = Math.round(Number(row.total_gb) * 100) / 100;
        const freeGb = typeof row.free_gb === 'number' ? Math.round(Number(row.free_gb) * 100) / 100 : null;
        return {
          mountPoint: String(row.mount_point || '').trim(),
          label: typeof row.logical_name === 'string' && row.logical_name.trim() ? row.logical_name.trim() : null,
          totalGb,
          freeGb,
          freePercent: totalGb > 0 && freeGb !== null ? Math.round((freeGb / totalGb) * 1000) / 10 : null,
        };
      });

    for (const row of dbLogRes.recordset || []) {
      const dbName = String(row.database_name || '');
      const state = String(row.state_desc || '');
      if (state && state !== 'ONLINE') {
        result.nonOnlineDatabases.push(`${dbName} (${state})`);
      } else if (
        String(row.log_reuse_wait_desc || '') === 'LOG_BACKUP' &&
        typeof row.log_used_percent === 'number' &&
        row.log_used_percent >= 70
      ) {
        result.highLogBackupDatabases.push({
          databaseName: dbName,
          logUsedPercent: Math.round(Number(row.log_used_percent) * 10) / 10,
          logUsedMb: typeof row.log_used_mb === 'number' ? Math.round(Number(row.log_used_mb) * 10) / 10 : null,
          logTotalMb: typeof row.log_total_mb === 'number' ? Math.round(Number(row.log_total_mb) * 10) / 10 : null,
        });
      }
    }
  } catch (err: unknown) {
    result.error = sanitizeBriefingErrorText(err);
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }

  const [iisTcp, cim] = await Promise.all([iisTcpPromise, cimPromise]);
  result.iisReachable = iisTcp.reachable;
  result.iisLatencyMs = iisTcp.latencyMs;
  if (cim.cimAvailable) {
    result.w3wpWorkingSetMb = cim.w3wpWorkingSetMb;
    result.services = cim.services;
    if (result.volumes.length === 0 && cim.volumes.length > 0) {
      result.volumes = cim.volumes;
    }
  }

  return result;
}

async function collectSrvfilesSection(db?: DatabaseSync): Promise<InfraBriefingSrvfilesRaw> {
  const remoteCfg = runtimeDirective.getRemoteConfig();
  const fileServerPort = Number(remoteCfg.fileServerPort || process.env.DOCUMENTAL_FILE_SERVER_PORT || 8765);

  const totalRamMb = Math.round((os.totalmem() / 1024 / 1024) * 10) / 10;
  const freeRamMb = Math.round((os.freemem() / 1024 / 1024) * 10) / 10;
  const usedRamPercent = totalRamMb > 0 ? Math.round(((totalRamMb - freeRamMb) / totalRamMb) * 1000) / 10 : 0;

  const [cim, mysqlTcp, fileSrvTcp] = await Promise.all([
    probeWindowsHostViaCim({
      host: 'localhost',
      svcRegex: '^(MySQL|Veeam|Acronis|AVP|klnagent|KAVFS|Zabbix|LanmanServer|Fiorix)',
      timeoutMs: 6000,
    }),
    probeTcpPort('127.0.0.1', 3306, 1500),
    probeTcpPort('127.0.0.1', fileServerPort, 1500),
  ]);

  let queuePending: number | null = null;
  let queueFailed: number | null = null;
  let queueQuarantined: number | null = null;
  if (db) {
    try {
      const h = healthManager.getHealth(db, runtimeDirective.shouldRunSqlSync());
      queuePending = h.queue.pending;
      queueFailed = h.queue.failed;
      queueQuarantined = h.queue.quarantined;
    } catch {
      // Ignora indisponibilidade eventual da leitura SQLite
    }
  }

  return {
    host: os.hostname(),
    lanIp: getLocalLanIpv4(),
    osUptimeSeconds: Math.floor(os.uptime()),
    vcpuCount: Math.max(1, os.cpus()?.length || 1),
    cpuPercent: cim.cpuPercent,
    totalRamMb: cim.totalRamMb ?? totalRamMb,
    freeRamMb: cim.freeRamMb ?? freeRamMb,
    usedRamPercent: cim.usedRamPercent ?? usedRamPercent,
    volumes: cim.volumes,
    services: cim.services,
    mysqlPortReachable: mysqlTcp.reachable,
    mysqlLatencyMs: mysqlTcp.latencyMs,
    fileServerPort,
    fileServerReachable: fileSrvTcp.reachable,
    fileServerLatencyMs: fileSrvTcp.latencyMs,
    connectorVersion: AGENT_VERSION,
    connectorUptimeSeconds: Math.floor(process.uptime()),
    connectorOperationalState: runtimeDirective.getOperationalState(),
    queuePending,
    queueFailed,
    queueQuarantined,
    cimAvailable: cim.cimAvailable,
    cimError: cim.cimError,
  };
}

export function parseCandidatePorts(raw: string): number[] {
  const seen = new Set<number>();
  for (const token of String(raw || '').split(',')) {
    const port = Number(token.trim());
    if (Number.isInteger(port) && port > 0 && port <= 65535 && !seen.has(port)) {
      seen.add(port);
    }
  }
  return seen.size > 0 ? Array.from(seen) : [80, 443, 8080, 3000, 5000, 8000];
}

async function collectSrvsiplaniaSection(
  host: string,
  name: string,
  candidatePorts: number[],
  postgresPort: number,
  collectPostgresSql?: () => Promise<SiplanIaPostgresTelemetry>,
): Promise<InfraBriefingSrvsiplaniaRaw> {
  const [pgTcp, webTcpResults, cim] = await Promise.all([
    probeTcpPort(host, postgresPort, 2200),
    Promise.all(candidatePorts.map(async (port) => ({ port, ...(await probeTcpPort(host, port, 1800)) }))),
    probeWindowsHostViaCim({
      host,
      svcRegex: '^(postgresql|W3SVC|IISADMIN|nginx|Siplan|Docker|Zabbix|Veeam|Acronis|AVP|klnagent|node|pm2)',
      timeoutMs: 6500,
    }),
  ]);

  const pgSqlStats: SiplanIaPostgresTelemetry | null = pgTcp.reachable
    ? await (collectPostgresSql ?? coletarTelemetriaPostgresSiplanIaReadOnly)().catch(() => null)
    : null;

  const activeWeb = webTcpResults.find((r) => r.reachable) ?? null;
  let webReachable = Boolean(activeWeb);
  let webPort: number | null = activeWeb ? activeWeb.port : null;
  let webLatencyMs: number | null = activeWeb ? activeWeb.latencyMs : null;
  let httpStatusCode: number | null = null;

  if (activeWeb) {
    const httpRes = await probeHttpStatus(host, activeWeb.port, 2200);
    if (httpRes.ok) {
      webReachable = true;
      httpStatusCode = httpRes.statusCode;
      if (httpRes.latencyMs !== null) {
        webLatencyMs = httpRes.latencyMs;
      }
    }
  }

  return {
    host,
    name,
    webReachable,
    webPort,
    webLatencyMs,
    httpStatusCode,
    postgresPort,
    postgresReachable: pgTcp.reachable,
    postgresLatencyMs: pgTcp.latencyMs,
    ...(pgSqlStats ?? { postgresSqlAuthenticated: false }),
    cimAvailable: cim.cimAvailable,
    cimError: cim.cimError,
    osCaption: cim.osCaption,
    osUptimeSeconds: cim.osUptimeSeconds,
    vcpuCount: cim.vcpuCount,
    cpuPercent: cim.cpuPercent,
    totalRamMb: cim.totalRamMb,
    freeRamMb: cim.freeRamMb,
    usedRamPercent: cim.usedRamPercent,
    volumes: cim.volumes,
    services: cim.services,
  };
}

export async function collectAndSendInfraBriefing(
  trigger: InfraBriefingTrigger,
  db?: DatabaseSync,
  overrides?: {
    sendSample?: (payload: Record<string, unknown>) => Promise<boolean>;
    collectSrvsql?: () => Promise<InfraBriefingSrvsqlRaw>;
    collectSrvfiles?: () => Promise<InfraBriefingSrvfilesRaw>;
    collectSrvsiplania?: () => Promise<InfraBriefingSrvsiplaniaRaw>;
    collectSiplaniaPg?: () => Promise<SiplanIaPostgresTelemetry>;
  },
): Promise<boolean> {
  if (isCollectingInfraBriefing || env.SHADOW_MODE) {
    return false;
  }
  if (!runtimeDirective.shouldRunSqlSync() && trigger !== 'MANUAL_REFRESH') {
    return false;
  }

  isCollectingInfraBriefing = true;
  const startedAt = Date.now();
  try {
    const remoteCfg = runtimeDirective.getRemoteConfig();
    const sqlHost = remoteCfg.sqlHost || env.SQL_SERVER_HOST || '10.0.0.25';
    const sqlDatabase = remoteCfg.sqlDatabase || env.SQL_SERVER_DATABASE || 'WEBRI';
    const siplaniaHost = env.SIPLANIA_HOST || '10.0.0.6';
    const siplaniaName = env.SIPLANIA_NAME || 'SRVSIPLANIA';
    const candidatePorts = parseCandidatePorts(env.SIPLANIA_HTTP_PORTS);
    const pgPort = env.SIPLANIA_POSTGRES_PORT || 5432;

    const [srvsql, srvfiles, srvsiplania] = await Promise.all([
      overrides?.collectSrvsql ? overrides.collectSrvsql() : collectSrvsqlSection(sqlHost, sqlDatabase),
      overrides?.collectSrvfiles ? overrides.collectSrvfiles() : collectSrvfilesSection(db),
      overrides?.collectSrvsiplania
        ? overrides.collectSrvsiplania()
        : collectSrvsiplaniaSection(siplaniaHost, siplaniaName, candidatePorts, pgPort, overrides?.collectSiplaniaPg),
    ]);

    const payload: RawInfraBriefingSample = {
      observedAt: new Date().toISOString(),
      trigger,
      collectorVersion: AGENT_VERSION,
      connectorHost: os.hostname(),
      collectionDurationMs: Date.now() - startedAt,
      srvsql,
      srvfiles,
      srvsiplania,
    };

    const sender = overrides?.sendSample ?? sendInfraBriefingSample;
    const sent = await sender(payload as unknown as Record<string, unknown>);
    if (sent) {
      logger.info(
        `INFRA_BRIEFING: Snapshot dos 3 servidores enviado (${trigger}, ${payload.collectionDurationMs}ms, SRVSQL=${srvsql.sqlReachable ? 'OK' : 'OFF'}, SRVFILES=${srvfiles.volumes.length}vols, SRVSIPLANIA=web:${srvsiplania.webReachable}/pg:${srvsiplania.postgresReachable}/cim:${srvsiplania.cimAvailable}).`,
      );
    }
    return sent;
  } catch (err: unknown) {
    logger.warn(`INFRA_BRIEFING: Falha na coleta consolidada dos 3 servidores: ${sanitizeBriefingErrorText(err)}`);
    return false;
  } finally {
    isCollectingInfraBriefing = false;
  }
}

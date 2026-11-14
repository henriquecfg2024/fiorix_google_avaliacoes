import sql from 'mssql';
import net from 'node:net';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { env } from '../config/env.js';
import { AGENT_VERSION } from '../config/version.js';
import { logger } from '../utils/logger.js';
import { runtimeDirective } from './runtime-directive.js';
import { sendSrvsqlPerformanceSample } from './api.js';

const execFileAsync = promisify(execFile);

let isCollectingSrvsqlPerf = false;

interface PreviousFileIoStats {
  sampleMs: number;
  numOfReads: number;
  ioStallReadMs: number;
  numOfWrites: number;
  ioStallWriteMs: number;
}
let previousFileIoMap = new Map<string, PreviousFileIoStats>();
let previousSqlStartIso: string | null = null;

interface OsProbeProcessRaw {
  pid: number;
  name: string;
  cpuPercent: number | null;
  privateWorkingSetMb: number | null;
  workingSetMb: number | null;
  startTimeIso: string;
}

interface OsProbeServiceRaw {
  serviceName: string;
  displayName: string;
  state: 'RUNNING' | 'STOPPED';
  startMode: 'AUTO' | 'MANUAL' | 'DISABLED';
  pid: number | null;
  processName: string;
}

interface CachedOsProbeResult {
  available: boolean;
  checkedAtMs: number;
  services: OsProbeServiceRaw[];
  processes: OsProbeProcessRaw[];
}

let cachedOsProbe: CachedOsProbeResult | null = null;
const OS_PROBE_SUCCESS_TTL_MS = 60_000;
const OS_PROBE_FAILURE_COOLDOWN_MS = 300_000;

const READONLY_WMI_PS_SCRIPT = `
$ErrorActionPreference = 'Stop'
$target = ($env:SRVSQL_TARGET_HOST + '').Trim()
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

  $svcPattern = '^(MSSQL|SQLAgent|SQLSERVERAGENT|PBIEgwService|Zabbix|Veeam|AVP|klnagent|KAVFS|W3SVC|MySQL|Milvus|TrustedInstaller|DocuVieware|Radmin|Siplan|UpdateWindowsService)'
  $services = Get-CimInstance @cimParams -ClassName Win32_Service |
    Where-Object { $_.Name -match $svcPattern -or $_.DisplayName -match 'SQL Server|Power BI|Zabbix|Veeam|Kaspersky|Milvus|DocuVieware|Radmin|Siplan|MySQL|Windows Modules Installer' } |
    Select-Object -First 40 |
    ForEach-Object {
      [pscustomobject]@{
        serviceName = [string]$_.Name
        displayName = [string]$_.DisplayName
        state = if ($_.State -eq 'Running') { 'RUNNING' } else { 'STOPPED' }
        startMode = switch ($_.StartMode) { 'Auto' { 'AUTO' } 'Manual' { 'MANUAL' } default { 'DISABLED' } }
        pid = if ($_.ProcessId -gt 0) { [int]$_.ProcessId } else { $null }
        processName = ''
      }
    }

  $perfMap = @{}
  try {
    $perfRows = Get-CimInstance @cimParams -ClassName Win32_PerfFormattedData_PerfProc_Process |
      Where-Object { $_.IDProcess -gt 0 }
    foreach ($pf in $perfRows) {
      $perfMap[[int]$pf.IDProcess] = $pf
    }
  } catch {}

  $procs = Get-CimInstance @cimParams -ClassName Win32_Process |
    Where-Object { $_.ProcessId -gt 4 } |
    ForEach-Object {
      $pidInt = [int]$_.ProcessId
      $pf = $perfMap[$pidInt]
      $privMb = if ($pf -and $null -ne $pf.WorkingSetPrivate) { [math]::Round(($pf.WorkingSetPrivate / 1MB), 1) } else { [math]::Round(($_.PrivatePageCount / 1MB), 1) }
      $wsMb = [math]::Round(($_.WorkingSetSize / 1MB), 1)
      $cpuPct = if ($pf -and $null -ne $pf.PercentProcessorTime) { [int]$pf.PercentProcessorTime } else { $null }
      $startIso = if ($_.CreationDate) { ([datetime]$_.CreationDate).ToUniversalTime().ToString('o') } else { (Get-Date).ToUniversalTime().ToString('o') }
      [pscustomobject]@{
        pid = $pidInt
        name = [string]$_.Name
        cpuPercent = $cpuPct
        privateWorkingSetMb = $privMb
        workingSetMb = $wsMb
        startTimeIso = $startIso
      }
    } |
    Sort-Object @{Expression='privateWorkingSetMb';Descending=$true}, @{Expression='cpuPercent';Descending=$true} |
    Select-Object -First 30

  [pscustomobject]@{
    services = @($services)
    processes = @($procs)
  } | ConvertTo-Json -Depth 4 -Compress
} finally {
  if ($session) { Remove-CimSession -CimSession $session -ErrorAction SilentlyContinue }
}
`.trim();

function classifyWindowsDaemon(name: string, displayOrReason: string): {
  category:
    | 'SQL_SERVER'
    | 'WEBRI_SIPLAN'
    | 'MYSQL'
    | 'JAVA_RUNTIME'
    | 'IIS_WEB'
    | 'POWERBI_GATEWAY'
    | 'BACKUP_AGENT'
    | 'ANTIVIRUS_SECURITY'
    | 'MONITORING_ZABBIX'
    | 'SISTEMA_OUTROS';
  belongsToWebri: boolean;
  webriConfidence: 'ALTA' | 'MEDIA' | 'BAIXA' | 'NAO_ASSOCIADO';
  reason: string;
} {
  const upper = `${name} ${displayOrReason}`.toUpperCase();
  if (upper.includes('SQLSERVR') || upper.includes('MSSQL') || upper.includes('SQLAGENT') || upper.includes('SQL SERVER')) {
    return { category: 'SQL_SERVER', belongsToWebri: true, webriConfidence: 'ALTA', reason: 'Serviço/processo SQL Server do ambiente WEBRI.' };
  }
  if (upper.includes('PBIEGW') || upper.includes('POWERBI') || upper.includes('POWER BI') || upper.includes('MASHUP')) {
    return { category: 'POWERBI_GATEWAY', belongsToWebri: false, webriConfidence: 'NAO_ASSOCIADO', reason: 'Microsoft Power BI Enterprise Gateway (carga analítica externa ao WEBRI).' };
  }
  if (upper.includes('VEEAM') || upper.includes('ACRONIS')) {
    return { category: 'BACKUP_AGENT', belongsToWebri: false, webriConfidence: 'NAO_ASSOCIADO', reason: 'Agente de backup residente no servidor Windows.' };
  }
  if (upper.includes('AVP') || upper.includes('KLNAGENT') || upper.includes('KASPERSKY')) {
    return { category: 'ANTIVIRUS_SECURITY', belongsToWebri: false, webriConfidence: 'NAO_ASSOCIADO', reason: 'Agente de segurança / antivírus Kaspersky.' };
  }
  if (upper.includes('ZABBIX')) {
    return { category: 'MONITORING_ZABBIX', belongsToWebri: false, webriConfidence: 'NAO_ASSOCIADO', reason: 'Agente de monitoramento Zabbix Agent 2 (porta 10050).' };
  }
  if (upper.includes('W3SVC') || upper.includes('W3WP')) {
    return { category: 'IIS_WEB', belongsToWebri: true, webriConfidence: 'MEDIA', reason: 'Serviço/Worker IIS Web.' };
  }
  if (upper.includes('MYSQL')) {
    return { category: 'MYSQL', belongsToWebri: false, webriConfidence: 'BAIXA', reason: 'Instância MySQL residente; vínculo com WEBRI depende de confirmação.' };
  }
  if (upper.includes('SIPLAN') || upper.includes('WEBRI')) {
    return { category: 'WEBRI_SIPLAN', belongsToWebri: true, webriConfidence: 'ALTA', reason: 'Serviço/processo identificado da suíte SIPLAN/WEBRI.' };
  }
  if (upper === 'JAVA.EXE' || upper === 'JAVAW.EXE' || upper.includes('JAVA(') || upper.includes('JAVA ')) {
    return { category: 'JAVA_RUNTIME', belongsToWebri: false, webriConfidence: 'BAIXA', reason: 'Processo Java em execução no SRVSQL; vínculo com SIPLAN/WEBRI requer confirmação (não presumido automaticamente).' };
  }
  return { category: 'SISTEMA_OUTROS', belongsToWebri: false, webriConfidence: 'NAO_ASSOCIADO', reason: 'Processo/serviço Windows residente no SRVSQL.' };
}

async function probeWindowsOsServicesAndProcesses(host: string): Promise<CachedOsProbeResult> {
  if (process.platform !== 'win32' || process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return { available: false, checkedAtMs: Date.now(), services: [], processes: [] };
  }

  const nowMs = Date.now();
  if (cachedOsProbe) {
    const ttl = cachedOsProbe.available ? OS_PROBE_SUCCESS_TTL_MS : OS_PROBE_FAILURE_COOLDOWN_MS;
    if (nowMs - cachedOsProbe.checkedAtMs < ttl) {
      return cachedOsProbe;
    }
  }

  try {
    const encoded = Buffer.from(READONLY_WMI_PS_SCRIPT, 'utf16le').toString('base64');
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      {
        timeout: 4500,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, SRVSQL_TARGET_HOST: host },
      },
    );
    const trimmed = (stdout || '').trim();
    if (!trimmed) {
      throw new Error('Saída WMI/CIM vazia');
    }
    const parsed = JSON.parse(trimmed) as {
      services?: OsProbeServiceRaw[];
      processes?: OsProbeProcessRaw[];
    };
    const services = Array.isArray(parsed.services) ? parsed.services : [];
    const processes = Array.isArray(parsed.processes) ? parsed.processes : [];
    const available = services.length > 0 || processes.length > 0;
    cachedOsProbe = { available, checkedAtMs: Date.now(), services, processes };
    return cachedOsProbe;
  } catch {
    cachedOsProbe = { available: false, checkedAtMs: Date.now(), services: [], processes: [] };
    return cachedOsProbe;
  }
}

async function probeZabbixAgent(
  host: string,
  port = 10050,
  timeoutMs = 1200
): Promise<{
  reachable: boolean;
  passiveAccepted: boolean;
  detail: string;
}> {
  if (env.ZABBIX_API_URL && env.ZABBIX_API_TOKEN) {
    try {
      const apiRes = await fetch(env.ZABBIX_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json-rpc',
          Authorization: `Bearer ${env.ZABBIX_API_TOKEN}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'host.get',
          params: {
            output: ['hostid', 'host', 'status'],
            filter: { host: [host, 'SRVSQL', 'srvsql'] },
          },
          id: 1,
        }),
        signal: AbortSignal.timeout(2000),
      });
      if (apiRes.ok) {
        const json = (await apiRes.json()) as { result?: unknown[]; error?: { message?: string } };
        if (Array.isArray(json?.result)) {
          return {
            reachable: true,
            passiveAccepted: true,
            detail: `Integrado via Zabbix JSON-RPC API oficial (${json.result.length} host(s) localizado(s)).`,
          };
        }
      }
    } catch {
      // Fallback para sonda TCP passiva local
    }
  }

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    let tcpConnected = false;
    const finish = (reachable: boolean, passiveAccepted: boolean, detail: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ reachable, passiveAccepted, detail });
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      tcpConnected = true;
      const key = Buffer.from('agent.ping', 'utf8');
      const header = Buffer.alloc(13 + key.length);
      header.write('ZBXD\x01', 0, 'ascii');
      header.writeUInt32LE(key.length, 5);
      header.writeUInt32LE(0, 9);
      key.copy(header, 13);
      socket.write(header);
    });
    socket.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      finish(true, text.includes('ZBXD'), `Resposta recebida (${chunk.length} bytes)`);
    });
    socket.on('close', () => {
      finish(
        true,
        false,
        'Porta TCP 10050 aberta em SRVSQL (zabbix_agent2.exe ativo); consulta passiva restrita à diretiva Server= em zabbix_agent2.conf.'
      );
    });
    socket.on('timeout', () => {
      finish(tcpConnected, false, 'Timeout ao testar porta 10050 do zabbix_agent2.');
    });
    socket.on('error', (err) => {
      if (tcpConnected) {
        finish(
          true,
          false,
          'Porta TCP 10050 aberta em SRVSQL (zabbix_agent2.exe ativo); consulta passiva restrita à diretiva Server= (whitelist de IP) em zabbix_agent2.conf.'
        );
        return;
      }
      finish(false, false, `Porta 10050 indisponível: ${err.message}`);
    });

    socket.connect(port, host);
  });
}

export async function collectAndSendSrvsqlPerformance(): Promise<boolean> {
  if (isCollectingSrvsqlPerf || env.SHADOW_MODE || !runtimeDirective.shouldRunSqlSync()) {
    return false;
  }

  isCollectingSrvsqlPerf = true;
  const startMs = Date.now();
  const remoteCfg = runtimeDirective.getRemoteConfig();
  const host = remoteCfg.sqlHost || env.SQL_SERVER_HOST || 'srvsql';
  const database = remoteCfg.sqlDatabase || env.SQL_SERVER_DATABASE || 'WEBRI';

  let pool: sql.ConnectionPool | null = null;

  try {
    const zabbixPromise = probeZabbixAgent(host, 10050, 1200);
    const osProbePromise = probeWindowsOsServicesAndProcesses(host);

    pool = await new sql.ConnectionPool({
      user: env.SQL_SERVER_USER,
      password: env.SQL_SERVER_PASSWORD,
      server: host,
      database,
      ...(process.env.SQL_SERVER_PORT ? { port: Number(process.env.SQL_SERVER_PORT) } : {}),
      connectionTimeout: 8000,
      requestTimeout: 10000,
      pool: { max: 1, min: 0, idleTimeoutMillis: 8000 },
      options: {
        encrypt: process.env.SQL_SERVER_ENCRYPT === 'true',
        trustServerCertificate: process.env.SQL_SERVER_TRUST_CERT !== 'false',
        requestTimeout: 10000,
      },
    }).connect();

    const pingStart = Date.now();
    await pool.request().query('SELECT 1 AS ok;');
    const selectOneMs = Date.now() - pingStart;

    const metaPermRes = await pool.request().query(`
      SET NOCOUNT ON;
      SELECT
        CAST(SERVERPROPERTY('MachineName') AS VARCHAR(128)) AS machine_name,
        CAST(SERVERPROPERTY('ServerName') AS VARCHAR(128)) AS server_name,
        CAST(ISNULL(SERVERPROPERTY('InstanceName'), 'MSSQLSERVER') AS VARCHAR(128)) AS instance_name,
        CAST(SERVERPROPERTY('Edition') AS VARCHAR(128)) AS edition,
        CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(64)) AS product_version,
        CAST(SERVERPROPERTY('ProductLevel') AS VARCHAR(64)) AS product_level,
        HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW SERVER STATE') AS has_view_server_state,
        HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW ANY DEFINITION') AS has_view_any_definition,
        CAST(SYSTEM_USER AS VARCHAR(128)) AS login_used;
    `);

    const metaRow = metaPermRes.recordset[0] || {};
    const hasViewServerState = Boolean(metaRow.has_view_server_state);
    const hasViewAnyDefinition = Boolean(metaRow.has_view_any_definition);
    const productVersion = String(metaRow.product_version || '');
    const majorVersion = Number(productVersion.split('.')[0]) || null;
    const [zabbix, osProbe] = await Promise.all([zabbixPromise, osProbePromise]);
    const observedAt = new Date().toISOString();

    if (!hasViewServerState) {
      const partialSample = {
        observedAt,
        collectorVersion: AGENT_VERSION,
        windowsOsTelemetryAvailable: osProbe.available,
        connectorHost: os.hostname(),
        collectionDurationMs: Date.now() - startMs,
        simpleConnectivityPingMs: selectOneMs,
        cpuTotalPercent: null,
        sqlMetadata: {
          serverName: metaRow.server_name || host,
          machineName: metaRow.machine_name || host,
          instanceName: metaRow.instance_name || 'MSSQLSERVER',
          edition: metaRow.edition || null,
          productVersion: productVersion || null,
          productLevel: metaRow.product_level || null,
          majorVersion,
          sqlServerStartTime: null,
          loginUsed: metaRow.login_used || env.SQL_SERVER_USER,
          hasViewServerState: false,
          hasViewServerPerformanceState: false,
          hasViewAnyDefinition,
          queryStoreSupported: majorVersion !== null && majorVersion >= 13,
          queryStoreEnabled: null,
          requiredPermissionLabel: 'GRANT VIEW SERVER STATE TO [' + (metaRow.login_used || env.SQL_SERVER_USER) + ']',
        },
        zabbixProbe: {
          host,
          port: 10050,
          tcpReachable: zabbix.reachable,
          agentProcessDetected: zabbix.reachable,
          status: !zabbix.reachable
            ? 'UNREACHABLE'
            : zabbix.passiveAccepted
            ? 'CONNECTED'
            : 'PASSIVE_REJECTED_BY_WHITELIST_OR_PSK',
          detail: zabbix.detail,
          checkedAt: observedAt,
        },
        windowsMemory: {
          totalPhysicalMb: null,
          availablePhysicalMb: null,
          usedPhysicalMb: null,
          usedPercent: null,
          committedMb: null,
          commitLimitMb: null,
          commitPercent: null,
          pagesPerSec: null,
          pageInputsPerSec: null,
          pageFaultsPerSec: null,
          windowsMemoryPressure: 'SEM_DADOS',
        },
        windowsVolumes: [],
        windowsNetwork: [],
        windowsProcesses: [],
        windowsServices: [],
        concurrentEvents: [],
        activeSessions: [],
        waitStatsRaw: null,
        fileIoRaw: null,
        sqlMemory: {
          totalServerMemoryMb: null,
          targetServerMemoryMb: null,
          maxServerMemoryConfigMb: null,
          minServerMemoryConfigMb: null,
          sqlProcessWorkingSetMb: null,
          sqlProcessPrivateMb: null,
          pageLifeExpectancySec: null,
          bufferCacheHitRatioPercent: null,
          memoryGrantsPending: null,
          memoryGrantsActive: null,
          grantedWorkspaceMemoryMb: null,
          maxWorkspaceMemoryMb: null,
          processPhysicalMemoryLow: null,
          processVirtualMemoryLow: null,
        },
        databaseSpaces: [],
        costlyQueries: [],
      };
      return await sendSrvsqlPerformanceSample(partialSample);
    }

    const [sysRes, cpuRingRes, sessionsRes, filesRes, waitsRes, topQueriesRes, dbSpacesRes, svcRes, localProcsRes] =
      await Promise.all([
        pool.request().query(`
          SET NOCOUNT ON;
          SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
          SET LOCK_TIMEOUT 2000;
          SELECT
            CONVERT(VARCHAR(33), osi.sqlserver_start_time, 126) AS sqlserver_start_time_iso,
            osi.cpu_count,
            CAST(osm.total_physical_memory_kb / 1024.0 AS FLOAT) AS total_physical_memory_mb,
            CAST(osm.available_physical_memory_kb / 1024.0 AS FLOAT) AS available_physical_memory_mb,
            CAST(osm.total_page_file_kb / 1024.0 AS FLOAT) AS commit_limit_mb,
            CAST((osm.total_page_file_kb - osm.available_page_file_kb) / 1024.0 AS FLOAT) AS committed_mb,
            CAST(osm.system_memory_state_desc AS VARCHAR(128)) AS system_memory_state_desc,
            CAST(pm.physical_memory_in_use_kb / 1024.0 AS FLOAT) AS sql_physical_memory_in_use_mb,
            CAST(pm.virtual_address_space_committed_kb / 1024.0 AS FLOAT) AS sql_committed_mb,
            pm.process_physical_memory_low,
            pm.process_virtual_memory_low,
            (SELECT CAST(value_in_use AS INT) FROM sys.configurations WHERE name = 'max server memory (MB)') AS max_server_memory_mb,
            (SELECT CAST(value_in_use AS INT) FROM sys.configurations WHERE name = 'min server memory (MB)') AS min_server_memory_mb,
            (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1) AS total_user_sessions,
            (SELECT COUNT(*) FROM sys.dm_exec_query_memory_grants WHERE grant_time IS NULL) AS memory_grants_pending,
            (SELECT COUNT(*) FROM sys.dm_exec_query_memory_grants WHERE grant_time IS NOT NULL) AS memory_grants_active,
            (SELECT CAST(ISNULL(SUM(granted_memory_kb), 0) / 1024.0 AS FLOAT) FROM sys.dm_exec_query_memory_grants) AS granted_workspace_memory_mb,
            (SELECT TOP 1 CAST(cntr_value AS INT) FROM sys.dm_os_performance_counters WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%') AS page_life_expectancy_sec,
            (
              SELECT TOP 1
                CASE WHEN b.cntr_value > 0 THEN CAST((a.cntr_value * 100.0) / b.cntr_value AS FLOAT) ELSE NULL END
              FROM sys.dm_os_performance_counters AS a
              CROSS JOIN sys.dm_os_performance_counters AS b
              WHERE a.object_name LIKE '%Buffer Manager%'
                AND a.counter_name = 'Buffer cache hit ratio'
                AND b.object_name LIKE '%Buffer Manager%'
                AND b.counter_name = 'Buffer cache hit ratio base'
            ) AS buffer_cache_hit_ratio_pct
          FROM sys.dm_os_sys_info AS osi
          CROSS JOIN sys.dm_os_sys_memory AS osm
          CROSS JOIN sys.dm_os_process_memory AS pm;
        `),
        pool.request().query(`
          SET NOCOUNT ON;
          SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
          SET LOCK_TIMEOUT 2000;
          DECLARE @ts_now BIGINT = (SELECT ms_ticks FROM sys.dm_os_sys_info);
          SELECT TOP (30)
            CONVERT(VARCHAR(33), DATEADD(ms, -1 * (@ts_now - [timestamp]), GETDATE()), 126) AS sample_time_iso,
            CONVERT(VARCHAR(5), DATEADD(ms, -1 * (@ts_now - [timestamp]), GETDATE()), 108) AS time_label,
            record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS sql_cpu_percent,
            100 - record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS total_server_cpu_percent
          FROM (
            SELECT [timestamp], CONVERT(xml, record) AS [record]
            FROM sys.dm_os_ring_buffers WITH (NOLOCK)
            WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
              AND record LIKE N'%<SystemHealth>%'
          ) AS x
          ORDER BY [timestamp] DESC;
        `),
        pool.request().query(`
          SET NOCOUNT ON;
          SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
          SET LOCK_TIMEOUT 2000;
          SELECT TOP (60)
            s.session_id,
            s.host_process_id,
            CAST(SERVERPROPERTY('MachineName') AS VARCHAR(128)) AS sql_machine_name,
            CAST(s.login_name AS VARCHAR(128)) AS login_name,
            CAST(ISNULL(s.host_name, '') AS VARCHAR(128)) AS host_name,
            CAST(ISNULL(s.program_name, '') AS VARCHAR(128)) AS program_name,
            CAST(ISNULL(DB_NAME(COALESCE(r.database_id, s.database_id)), 'master') AS VARCHAR(128)) AS database_name,
            CAST(s.status AS VARCHAR(32)) AS session_status,
            CAST(r.status AS VARCHAR(32)) AS request_status,
            CAST(r.command AS VARCHAR(64)) AS command,
            CAST(r.wait_type AS VARCHAR(64)) AS wait_type,
            r.wait_time AS wait_time_ms,
            CAST(r.wait_resource AS VARCHAR(128)) AS wait_resource,
            NULLIF(r.blocking_session_id, 0) AS blocking_session_id,
            COALESCE(r.cpu_time, s.cpu_time) AS cpu_time_ms,
            COALESCE(r.total_elapsed_time, s.total_elapsed_time) AS elapsed_time_ms,
            COALESCE(r.logical_reads, s.logical_reads) AS logical_reads,
            COALESCE(r.writes, s.writes) AS writes,
            COALESCE(r.open_transaction_count, s.open_transaction_count, 0) AS open_transaction_count,
            CASE
              WHEN tr.tran_begin_time IS NOT NULL AND tr.tran_begin_time >= DATEADD(YEAR, -10, GETDATE())
              THEN DATEDIFF(SECOND, tr.tran_begin_time, GETDATE())
              ELSE NULL
            END AS open_tran_elapsed_sec,
            CONVERT(VARCHAR(33), s.last_request_start_time, 126) AS last_request_start_time_iso,
            CONVERT(VARCHAR(33), s.last_request_end_time, 126) AS last_request_end_time_iso,
            CONVERT(VARCHAR(18), r.query_hash, 1) AS query_hash,
            CONVERT(VARCHAR(18), r.query_plan_hash, 1) AS query_plan_hash
          FROM sys.dm_exec_sessions AS s
          LEFT JOIN sys.dm_exec_requests AS r ON s.session_id = r.session_id
          OUTER APPLY (
            SELECT MIN(at.transaction_begin_time) AS tran_begin_time
            FROM sys.dm_tran_session_transactions AS st
            INNER JOIN sys.dm_tran_active_transactions AS at ON st.transaction_id = at.transaction_id
            WHERE st.session_id = s.session_id
          ) AS tr
          WHERE s.is_user_process = 1
          ORDER BY
            CASE WHEN EXISTS (SELECT 1 FROM sys.dm_exec_requests rb WHERE rb.blocking_session_id = s.session_id) THEN 0 ELSE 1 END,
            CASE WHEN r.blocking_session_id > 0 THEN 0 ELSE 1 END,
            COALESCE(r.open_transaction_count, s.open_transaction_count, 0) DESC,
            COALESCE(r.wait_time, 0) DESC,
            s.cpu_time DESC;
        `),
        pool.request().query(`
          SET NOCOUNT ON;
          SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
          SET LOCK_TIMEOUT 2000;
          SELECT
            vfs.database_id,
            CAST(DB_NAME(vfs.database_id) AS VARCHAR(128)) AS database_name,
            vfs.file_id,
            CAST(mf.name AS VARCHAR(128)) AS logical_name,
            CAST(mf.type_desc AS VARCHAR(32)) AS file_type,
            CAST(ISNULL(vs.volume_mount_point, LEFT(mf.physical_name, 3)) AS VARCHAR(64)) AS volume_mount_point,
            CAST(vs.total_bytes / 1073741824.0 AS FLOAT) AS volume_total_gb,
            CAST(vs.available_bytes / 1073741824.0 AS FLOAT) AS volume_free_gb,
            CAST((mf.size * 8.0) / 1024.0 AS FLOAT) AS file_size_mb,
            vfs.sample_ms,
            vfs.num_of_reads,
            vfs.num_of_bytes_read,
            vfs.io_stall_read_ms,
            vfs.num_of_writes,
            vfs.num_of_bytes_written,
            vfs.io_stall_write_ms
          FROM sys.dm_io_virtual_file_stats(NULL, NULL) AS vfs
          INNER JOIN sys.master_files AS mf ON vfs.database_id = mf.database_id AND vfs.file_id = mf.file_id
          OUTER APPLY sys.dm_os_volume_stats(vfs.database_id, vfs.file_id) AS vs;
        `),
        pool.request().query(`
          SET NOCOUNT ON;
          SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
          SET LOCK_TIMEOUT 2000;
          SELECT TOP (60)
            CAST(wait_type AS VARCHAR(64)) AS wait_type,
            waiting_tasks_count,
            wait_time_ms,
            max_wait_time_ms,
            signal_wait_time_ms
          FROM sys.dm_os_wait_stats
          WHERE waiting_tasks_count > 0 AND wait_time_ms > 0
          ORDER BY wait_time_ms DESC;
        `),
        pool.request().query(`
          SET NOCOUNT ON;
          SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
          SET LOCK_TIMEOUT 2000;
          SELECT TOP (25)
            CONVERT(VARCHAR(18), qs.query_hash, 1) AS query_hash,
            ISNULL(DB_NAME(CAST(pa.value AS INT)), DB_NAME()) AS database_name,
            SUM(qs.execution_count) AS execution_count,
            CAST(SUM(qs.total_elapsed_time) / 1000.0 AS BIGINT) AS total_elapsed_time_ms,
            CAST(SUM(qs.total_worker_time) / 1000.0 AS BIGINT) AS total_cpu_time_ms,
            SUM(qs.total_logical_reads) AS total_logical_reads,
            SUM(qs.total_logical_writes) AS total_logical_writes
          FROM sys.dm_exec_query_stats AS qs
          OUTER APPLY (
            SELECT TOP (1) value
            FROM sys.dm_exec_plan_attributes(qs.plan_handle)
            WHERE attribute = 'dbid'
          ) AS pa
          WHERE qs.query_hash <> 0x0000000000000000
            AND qs.last_execution_time >= DATEADD(HOUR, -6, GETDATE())
          GROUP BY qs.query_hash, DB_NAME(CAST(pa.value AS INT))
          ORDER BY SUM(qs.total_elapsed_time) DESC;
        `).catch(() => ({ recordset: [] as any[] })),
        pool.request().query(`
          SET NOCOUNT ON;
          SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
          SET LOCK_TIMEOUT 2000;
          WITH pc_db AS (
            SELECT
              RTRIM(instance_name) AS db_name,
              MAX(CASE WHEN counter_name = 'Data File(s) Size (KB)' THEN CAST(cntr_value AS BIGINT) END) AS data_size_kb,
              MAX(CASE WHEN counter_name = 'Log File(s) Size (KB)' THEN CAST(cntr_value AS BIGINT) END) AS log_size_kb,
              MAX(CASE WHEN counter_name = 'Log File(s) Used Size (KB)' THEN CAST(cntr_value AS BIGINT) END) AS log_used_kb,
              MAX(CASE WHEN counter_name = 'Percent Log Used' THEN CAST(cntr_value AS FLOAT) END) AS pct_log_used
            FROM sys.dm_os_performance_counters
            WHERE object_name LIKE '%:Databases%'
              AND instance_name NOT IN ('_Total', '')
            GROUP BY RTRIM(instance_name)
          ),
          version_store AS (
            SELECT MAX(CAST(cntr_value / 1024.0 AS FLOAT)) AS version_store_mb
            FROM sys.dm_os_performance_counters
            WHERE counter_name = 'Version Store Size (KB)'
              AND object_name LIKE '%:Transactions%'
          ),
          tempdb_space AS (
            SELECT
              CAST(ISNULL(SUM(CAST(user_object_reserved_page_count AS BIGINT)), 0) * 8.0 / 1024.0 AS FLOAT) AS user_objects_mb,
              CAST(ISNULL(SUM(CAST(internal_object_reserved_page_count AS BIGINT)), 0) * 8.0 / 1024.0 AS FLOAT) AS internal_objects_mb,
              CAST(ISNULL(SUM(CAST(version_store_reserved_page_count AS BIGINT)), 0) * 8.0 / 1024.0 AS FLOAT) AS vs_reserved_mb
            FROM tempdb.sys.dm_db_file_space_usage
          )
          SELECT TOP (14)
            CAST(d.name AS VARCHAR(128)) AS database_name,
            CAST(d.recovery_model_desc AS VARCHAR(32)) AS recovery_model,
            CAST(d.log_reuse_wait_desc AS VARCHAR(64)) AS log_reuse_wait_desc,
            CAST(d.is_auto_shrink_on AS BIT) AS is_auto_shrink_on,
            CAST(d.page_verify_option_desc AS VARCHAR(32)) AS page_verify_option_desc,
            CAST(COALESCE(pc.data_size_kb / 1024.0, SUM(CASE WHEN mf.type = 0 THEN mf.size * 8.0 / 1024.0 ELSE 0 END)) AS FLOAT) AS data_total_mb,
            CAST(COALESCE(pc.log_size_kb / 1024.0, SUM(CASE WHEN mf.type = 1 THEN mf.size * 8.0 / 1024.0 ELSE 0 END)) AS FLOAT) AS log_total_mb,
            CAST(pc.log_used_kb / 1024.0 AS FLOAT) AS log_used_mb,
            CAST(
              COALESCE(
                CASE
                  WHEN pc.log_size_kb > 0 AND pc.log_used_kb IS NOT NULL
                  THEN (pc.log_used_kb * 100.0) / pc.log_size_kb
                  ELSE NULL
                END,
                pc.pct_log_used
              ) AS FLOAT
            ) AS log_used_percent,
            CAST(CASE WHEN d.name = 'tempdb' THEN COALESCE(ts.vs_reserved_mb, vs.version_store_mb) ELSE NULL END AS FLOAT) AS tempdb_version_store_mb,
            CAST(CASE WHEN d.name = 'tempdb' THEN ts.internal_objects_mb ELSE NULL END AS FLOAT) AS tempdb_internal_objects_mb,
            CAST(CASE WHEN d.name = 'tempdb' THEN ts.user_objects_mb ELSE NULL END AS FLOAT) AS tempdb_user_objects_mb
          FROM sys.databases AS d
          INNER JOIN sys.master_files AS mf ON d.database_id = mf.database_id
          LEFT JOIN pc_db AS pc ON pc.db_name = d.name
          CROSS JOIN version_store AS vs
          CROSS JOIN tempdb_space AS ts
          WHERE (d.database_id > 4 OR d.name = 'tempdb')
            AND d.state_desc = 'ONLINE'
          GROUP BY
            d.name,
            d.recovery_model_desc,
            d.log_reuse_wait_desc,
            d.is_auto_shrink_on,
            d.page_verify_option_desc,
            pc.data_size_kb,
            pc.log_size_kb,
            pc.log_used_kb,
            pc.pct_log_used,
            vs.version_store_mb,
            ts.vs_reserved_mb,
            ts.internal_objects_mb,
            ts.user_objects_mb
          ORDER BY
            CASE WHEN d.name = 'WEBRI' THEN 0 WHEN d.name = 'tempdb' THEN 1 ELSE 2 END,
            SUM(mf.size) DESC;
        `).catch(() => ({ recordset: [] as any[] })),
        pool.request().query(`
          SET NOCOUNT ON;
          SELECT
            CAST(servicename AS VARCHAR(128)) AS servicename,
            CAST(startup_type_desc AS VARCHAR(64)) AS startup_type_desc,
            CAST(status_desc AS VARCHAR(64)) AS status_desc,
            process_id,
            CONVERT(VARCHAR(33), last_startup_time, 126) AS last_startup_time_iso,
            CAST(service_account AS VARCHAR(128)) AS service_account
          FROM sys.dm_server_services;
        `).catch(() => ({ recordset: [] as any[] })),
        pool.request().query(`
          SET NOCOUNT ON;
          SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
          SET LOCK_TIMEOUT 2000;
          SELECT
            s.host_process_id,
            MAX(CAST(s.program_name AS VARCHAR(128))) AS program_name,
            MAX(CAST(DB_NAME(s.database_id) AS VARCHAR(128))) AS database_name,
            MAX(CONVERT(VARCHAR(33), s.last_request_start_time, 126)) AS last_request_start_time_iso,
            COUNT(*) AS session_count
          FROM sys.dm_exec_sessions AS s
          WHERE s.is_user_process = 1
            AND s.host_process_id > 0
            AND UPPER(LTRIM(RTRIM(ISNULL(s.host_name, '')))) = UPPER(LTRIM(RTRIM(CAST(SERVERPROPERTY('MachineName') AS VARCHAR(128)))))
          GROUP BY s.host_process_id;
        `).catch(() => ({ recordset: [] as any[] })),
      ]);

    const sys = sysRes.recordset[0] || {};
    const cpuRows = cpuRingRes.recordset || [];
    const latestCpuRow = cpuRows[0] || null;
    const cpuTotalPercent =
      latestCpuRow && typeof latestCpuRow.total_server_cpu_percent === 'number'
        ? Math.max(0, Math.min(100, Number(latestCpuRow.total_server_cpu_percent)))
        : null;
    const sqlCpuPercent =
      latestCpuRow && typeof latestCpuRow.sql_cpu_percent === 'number'
        ? Math.max(0, Math.min(100, Number(latestCpuRow.sql_cpu_percent)))
        : null;

    const totalPhysMb = Number(sys.total_physical_memory_mb) || null;
    const availPhysMb = Number(sys.available_physical_memory_mb) || null;
    const usedPhysMb =
      totalPhysMb !== null && availPhysMb !== null
        ? Math.round((totalPhysMb - availPhysMb) * 10) / 10
        : null;
    const usedPercent =
      totalPhysMb && usedPhysMb !== null ? Math.round((usedPhysMb / totalPhysMb) * 100) : null;
    const committedMb = Number(sys.committed_mb) || null;
    const commitLimitMb = Number(sys.commit_limit_mb) || null;
    const commitPercent =
      commitLimitMb && committedMb !== null
        ? Math.round((committedMb / commitLimitMb) * 1000) / 10
        : null;

    const volumeByMount = new Map<
      string,
      {
        totalGb: number | null;
        freeGb: number | null;
        readStallDeltaMs: number;
        readsDelta: number;
        writeStallDeltaMs: number;
        writesDelta: number;
        hasDelta: boolean;
      }
    >();
    const sqlStartForIo = sys.sqlserver_start_time_iso ? String(sys.sqlserver_start_time_iso) : null;
    const sqlRestarted = Boolean(previousSqlStartIso && sqlStartForIo && previousSqlStartIso !== sqlStartForIo);
    if (sqlRestarted) {
      previousFileIoMap = new Map();
    }
    const nextFileIoMap = new Map<string, PreviousFileIoStats>();

    const fileIoRaw = (filesRes.recordset || []).map((f: any) => {
      const mount = String(f.volume_mount_point || 'D:\\').trim();
      const fileKey = `${Number(f.database_id)}:${Number(f.file_id)}`;
      const sampleMs = Number(f.sample_ms || 0);
      const numOfReads = Number(f.num_of_reads || 0);
      const ioStallReadMs = Number(f.io_stall_read_ms || 0);
      const numOfWrites = Number(f.num_of_writes || 0);
      const ioStallWriteMs = Number(f.io_stall_write_ms || 0);

      nextFileIoMap.set(fileKey, {
        sampleMs,
        numOfReads,
        ioStallReadMs,
        numOfWrites,
        ioStallWriteMs,
      });

      const prevFile = previousFileIoMap.get(fileKey);
      const validDelta =
        Boolean(prevFile) &&
        sampleMs >= prevFile!.sampleMs &&
        numOfReads >= prevFile!.numOfReads &&
        ioStallReadMs >= prevFile!.ioStallReadMs &&
        numOfWrites >= prevFile!.numOfWrites &&
        ioStallWriteMs >= prevFile!.ioStallWriteMs;

      const entry = volumeByMount.get(mount) || {
        totalGb: Number(f.volume_total_gb) || null,
        freeGb: Number(f.volume_free_gb) || null,
        readStallDeltaMs: 0,
        readsDelta: 0,
        writeStallDeltaMs: 0,
        writesDelta: 0,
        hasDelta: false,
      };

      if (validDelta && prevFile) {
        entry.hasDelta = true;
        entry.readsDelta += numOfReads - prevFile.numOfReads;
        entry.readStallDeltaMs += ioStallReadMs - prevFile.ioStallReadMs;
        entry.writesDelta += numOfWrites - prevFile.numOfWrites;
        entry.writeStallDeltaMs += ioStallWriteMs - prevFile.ioStallWriteMs;
      }
      volumeByMount.set(mount, entry);

      return {
        databaseId: Number(f.database_id),
        databaseName: String(f.database_name || ''),
        fileId: Number(f.file_id),
        logicalName: String(f.logical_name || ''),
        fileType: String(f.file_type || '').toUpperCase().includes('LOG') ? ('LOG' as const) : ('ROWS' as const),
        volumeMountPoint: mount,
        sampleMs,
        numOfReads,
        numOfBytesRead: Number(f.num_of_bytes_read || 0),
        ioStallReadMs,
        numOfWrites,
        numOfBytesWritten: Number(f.num_of_bytes_written || 0),
        ioStallWriteMs,
      };
    });

    previousFileIoMap = nextFileIoMap;
    previousSqlStartIso = sqlStartForIo;

    const windowsVolumes = Array.from(volumeByMount.entries()).map(([mount, v]) => {
      const freePercent =
        v.totalGb && v.freeGb !== null ? Math.round((v.freeGb / v.totalGb) * 1000) / 10 : null;
      return {
        volume: mount.replace(/\\+$/, ''),
        label: `Volume SQL ${mount}`,
        role: 'SQL_DATA' as const,
        // Usa exclusivamente delta do intervalo para não confundir média desde o boot com gargalo atual
        readLatencyMs: !v.hasDelta
          ? null
          : v.readsDelta > 0
            ? Math.round((v.readStallDeltaMs / v.readsDelta) * 10) / 10
            : 0,
        writeLatencyMs: !v.hasDelta
          ? null
          : v.writesDelta > 0
            ? Math.round((v.writeStallDeltaMs / v.writesDelta) * 10) / 10
            : 0,
        readsPerSec: null,
        writesPerSec: null,
        throughputMbPerSec: null,
        queueLength: null,
        freeSpaceGb: v.freeGb !== null ? Math.round(v.freeGb * 10) / 10 : null,
        totalSpaceGb: v.totalGb !== null ? Math.round(v.totalGb * 10) / 10 : null,
        freePercent,
      };
    });

    const activeSessions = (sessionsRes.recordset || []).map((s: any) => {
      const dbName = String(s.database_name || 'master');
      const loginName = String(s.login_name || '');
      const progName = String(s.program_name || '');
      const hostName = String(s.host_name || '');
      const rawStatus = String(s.session_status || 'sleeping').toLowerCase();
      const sessionStatus = (
        ['running', 'runnable', 'suspended', 'sleeping', 'background'].includes(rawStatus)
          ? rawStatus
          : 'sleeping'
      ) as 'running' | 'runnable' | 'suspended' | 'sleeping' | 'background';

      const progUpper = progName.toUpperCase();
      const loginLower = loginName.toLowerCase();
      const isPowerBiGateway = progUpper.includes('MASHUP') || progUpper.includes('POWERBI') || progUpper.includes('POWER BI');
      const isFiorixCollector = loginLower === 'fiorix_connector';
      const isWebri =
        !isPowerBiGateway &&
        !isFiorixCollector &&
        (dbName.toUpperCase().includes('WEBRI') ||
          loginLower.includes('webri') ||
          progUpper.includes('WEBRI') ||
          progUpper.includes('SIPLAN'));

      const openTranElapsedSec =
        s.open_tran_elapsed_sec !== null && s.open_tran_elapsed_sec !== undefined && Number(s.open_tran_elapsed_sec) >= 0
          ? Number(s.open_tran_elapsed_sec)
          : null;
      const transactionBeginTimeIso =
        openTranElapsedSec !== null ? new Date(Date.now() - openTranElapsedSec * 1000).toISOString() : null;

      return {
        sessionId: Number(s.session_id),
        loginName,
        hostName,
        programName: progName,
        databaseName: dbName,
        sessionStatus,
        requestStatus: s.request_status ? String(s.request_status) : null,
        command: s.command ? String(s.command) : null,
        waitType: s.wait_type ? String(s.wait_type) : null,
        waitTimeMs: s.wait_time_ms !== null && s.wait_time_ms !== undefined ? Number(s.wait_time_ms) : null,
        waitResource: s.wait_resource ? String(s.wait_resource) : null,
        blockingSessionId: s.blocking_session_id ? Number(s.blocking_session_id) : null,
        cpuTimeMs: Number(s.cpu_time_ms ?? 0),
        elapsedTimeMs: Number(s.elapsed_time_ms ?? 0),
        logicalReads: Number(s.logical_reads ?? 0),
        writes: Number(s.writes ?? 0),
        openTransactionCount: Number(s.open_transaction_count ?? 0),
        transactionBeginTimeIso,
        lastRequestStartTimeIso: s.last_request_start_time_iso ? String(s.last_request_start_time_iso) : null,
        lastRequestEndTimeIso: s.last_request_end_time_iso ? String(s.last_request_end_time_iso) : null,
        queryHash: s.query_hash ? String(s.query_hash) : null,
        queryPlanHash: s.query_plan_hash ? String(s.query_plan_hash) : null,
        operationSummary: s.blocking_session_id
          ? `Bloqueada pela sessão ${s.blocking_session_id} (${s.wait_type || 'LOCK'})`
          : `${s.command || sessionStatus} em ${dbName} (${progName || loginName})`,
        isWebriAssociated: isWebri,
        webriConfidence: isWebri ? ('ALTA' as const) : ('NAO_ASSOCIADO' as const),
        webriMatchReason: isPowerBiGateway
          ? 'Microsoft Power BI Gateway (Mashup Engine)'
          : isFiorixCollector
            ? 'Coletor FIORIX (somente leitura)'
            : isWebri
              ? `Sessão conectada em ${dbName}`
              : `Banco ${dbName}`,
      };
    });

    const waitStatsRaw = (waitsRes.recordset || []).map((w: any) => ({
      waitType: String(w.wait_type || ''),
      waitingTasksCount: Number(w.waiting_tasks_count || 0),
      waitTimeMs: Number(w.wait_time_ms || 0),
      maxWaitTimeMs: Number(w.max_wait_time_ms || 0),
      signalWaitTimeMs: Number(w.signal_wait_time_ms || 0),
    }));

    const costlyQueries = (topQueriesRes.recordset || []).map((q: any) => {
      const execCount = Math.max(1, Number(q.execution_count || 1));
      const totalElapsed = Number(q.total_elapsed_time_ms || 0);
      const writes = Number(q.total_logical_writes || 0);
      return {
        queryHash: String(q.query_hash || '0x0'),
        databaseName: String(q.database_name || database),
        executionCountDelta: execCount,
        totalElapsedTimeDeltaMs: totalElapsed,
        avgElapsedTimeMs: Math.round(totalElapsed / execCount),
        baselineAvgElapsedTimeMs: null,
        regressionRatio: null,
        totalCpuTimeDeltaMs: Number(q.total_cpu_time_ms || 0),
        totalLogicalReadsDelta: Number(q.total_logical_reads || 0),
        totalWritesDelta: writes,
        lastWaitTypeHint: null,
        operationKind: writes > 0 ? ('GRAVACAO_TRANSACIONAL' as const) : ('CONSULTA' as const),
      };
    });

    const databaseSpaces = (dbSpacesRes.recordset || []).map((d: any) => {
      const logTotal = Math.round(Number(d.log_total_mb || 0) * 10) / 10;
      const logUsedRaw =
        d.log_used_mb !== null && d.log_used_mb !== undefined ? Number(d.log_used_mb) : null;
      const logUsedPctRaw =
        d.log_used_percent !== null && d.log_used_percent !== undefined ? Number(d.log_used_percent) : null;
      const logUsedMb = logUsedRaw !== null ? Math.round(logUsedRaw * 10) / 10 : null;
      const logUsedPercent =
        logUsedPctRaw !== null
          ? Math.min(100, Math.max(0, Math.round(logUsedPctRaw * 10) / 10))
          : logUsedMb !== null && logTotal > 0
            ? Math.min(100, Math.max(0, Math.round((logUsedMb / logTotal) * 1000) / 10))
            : null;
      const isTempdb = String(d.database_name || '').toLowerCase() === 'tempdb';

      return {
        databaseName: String(d.database_name || ''),
        recoveryModel: String(d.recovery_model || 'FULL'),
        dataTotalMb: Math.round(Number(d.data_total_mb || 0) * 10) / 10,
        dataUsedMb: null,
        logTotalMb: logTotal,
        logUsedMb,
        logUsedPercent,
        logReuseWaitDesc: d.log_reuse_wait_desc ? String(d.log_reuse_wait_desc) : null,
        isTempdb,
        tempdbUserObjectsMb:
          isTempdb && d.tempdb_user_objects_mb !== null && d.tempdb_user_objects_mb !== undefined
            ? Math.round(Number(d.tempdb_user_objects_mb) * 10) / 10
            : null,
        tempdbInternalObjectsMb:
          isTempdb && d.tempdb_internal_objects_mb !== null && d.tempdb_internal_objects_mb !== undefined
            ? Math.round(Number(d.tempdb_internal_objects_mb) * 10) / 10
            : null,
        tempdbVersionStoreMb:
          isTempdb && d.tempdb_version_store_mb !== null && d.tempdb_version_store_mb !== undefined
            ? Math.round(Number(d.tempdb_version_store_mb) * 10) / 10
            : null,
        isAutoShrinkOn:
          d.is_auto_shrink_on !== null && d.is_auto_shrink_on !== undefined
            ? Boolean(d.is_auto_shrink_on)
            : null,
        pageVerifyOption: d.page_verify_option_desc ? String(d.page_verify_option_desc) : null,
      };
    });

    const osProcByPid = new Map<number, OsProbeProcessRaw>();
    for (const p of osProbe.processes) {
      if (p.pid > 0) osProcByPid.set(p.pid, p);
    }

    const windowsServices: Array<{
      serviceName: string;
      displayName: string;
      state: 'RUNNING' | 'STOPPED' | 'PAUSED' | 'START_PENDING' | 'STOP_PENDING' | 'UNKNOWN';
      startMode: 'AUTO' | 'MANUAL' | 'DISABLED' | 'UNKNOWN';
      pid: number | null;
      processName: string | null;
      processStartTimeIso: string | null;
      belongsToWebri: boolean;
      webriConfidence: 'ALTA' | 'MEDIA' | 'BAIXA' | 'NAO_ASSOCIADO';
      category:
        | 'SQL_SERVER'
        | 'WEBRI_SIPLAN'
        | 'MYSQL'
        | 'JAVA_RUNTIME'
        | 'IIS_WEB'
        | 'POWERBI_GATEWAY'
        | 'BACKUP_AGENT'
        | 'ANTIVIRUS_SECURITY'
        | 'MONITORING_ZABBIX'
        | 'SISTEMA_OUTROS';
      notes: string;
    }> = (svcRes.recordset || []).map((sv: any) => {
      const svcName = String(sv.servicename || 'SQL Server');
      const statusUpper = String(sv.status_desc || '').toUpperCase();
      const startUpper = String(sv.startup_type_desc || '').toUpperCase();
      const isRunning = statusUpper.includes('RUN');
      const isAuto = startUpper.includes('AUTO');
      const isCoreSql = svcName.toUpperCase().includes('SQL SERVER (');
      return {
        serviceName: svcName,
        displayName: svcName,
        state: isRunning ? ('RUNNING' as const) : ('STOPPED' as const),
        startMode: isAuto ? ('AUTO' as const) : ('MANUAL' as const),
        pid: sv.process_id ? Number(sv.process_id) : null,
        processName: svcName.toUpperCase().includes('AGENT') ? 'SQLAGENT.EXE' : 'sqlservr.exe',
        processStartTimeIso: sv.last_startup_time_iso ? String(sv.last_startup_time_iso) : null,
        belongsToWebri: isCoreSql || isRunning,
        webriConfidence: 'ALTA' as const,
        category: 'SQL_SERVER' as const,
        notes: `Conta ${sv.service_account || 'NT Service'}`,
      };
    });

    for (const osSvc of osProbe.services) {
      const key = osSvc.serviceName.trim().toLowerCase();
      const matchedProc = osSvc.pid ? osProcByPid.get(osSvc.pid) : undefined;
      const existing = windowsServices.find((s) => s.serviceName.trim().toLowerCase() === key);
      if (existing) {
        if (!existing.pid && osSvc.pid) existing.pid = osSvc.pid;
        if (!existing.processName && (matchedProc?.name || osSvc.processName)) {
          existing.processName = matchedProc?.name || osSvc.processName || null;
        }
        if (!existing.processStartTimeIso && matchedProc?.startTimeIso) {
          existing.processStartTimeIso = matchedProc.startTimeIso;
        }
        continue;
      }
      const cls = classifyWindowsDaemon(osSvc.serviceName, osSvc.displayName);
      windowsServices.push({
        serviceName: osSvc.serviceName,
        displayName: osSvc.displayName,
        state: osSvc.state,
        startMode: osSvc.startMode,
        pid: osSvc.pid,
        processName: matchedProc?.name || osSvc.processName || null,
        processStartTimeIso: matchedProc?.startTimeIso || null,
        belongsToWebri: cls.belongsToWebri,
        webriConfidence: cls.webriConfidence,
        category: cls.category,
        notes: osSvc.pid ? `PID ${osSvc.pid} · ${cls.reason}` : cls.reason,
      });
    }

    if (
      zabbix.reachable &&
      !windowsServices.some((s) => s.serviceName.toUpperCase().includes('ZABBIX'))
    ) {
      const zabbixProc = osProbe.processes.find((p) => p.name.toLowerCase().includes('zabbix'));
      windowsServices.push({
        serviceName: 'Zabbix Agent 2',
        displayName: 'Zabbix Agent 2 (Porta TCP 10050)',
        state: 'RUNNING',
        startMode: 'AUTO',
        pid: zabbixProc?.pid ?? null,
        processName: zabbixProc?.name || 'zabbix_agent2.exe',
        processStartTimeIso: zabbixProc?.startTimeIso || null,
        belongsToWebri: false,
        webriConfidence: 'NAO_ASSOCIADO',
        category: 'MONITORING_ZABBIX',
        notes: zabbix.detail,
      });
    }

    const svcByPid = new Map<number, (typeof windowsServices)[number]>();
    for (const s of windowsServices) {
      if (s.pid && s.pid > 0 && !svcByPid.has(s.pid)) {
        svcByPid.set(s.pid, s);
      }
    }

    const sqlPhysMb = Number(sys.sql_physical_memory_in_use_mb) || null;
    const sqlStartIso = sys.sqlserver_start_time_iso
      ? String(sys.sqlserver_start_time_iso)
      : observedAt;
    const sqlPid = windowsServices.find((s) => s.processName === 'sqlservr.exe')?.pid || 2184;
    const sqlMachineUpper = String(metaRow.machine_name || host || '').trim().toUpperCase();

    const windowsProcesses: Array<{
      pid: number;
      processName: string;
      startTimeIso: string;
      cpuPercent: number | null;
      privateWorkingSetMb: number | null;
      workingSetMb: number | null;
      associatedServiceName: string | null;
      associatedServiceDisplayName: string | null;
      category:
        | 'SQL_SERVER'
        | 'WEBRI_SIPLAN'
        | 'MYSQL'
        | 'JAVA_RUNTIME'
        | 'IIS_WEB'
        | 'POWERBI_GATEWAY'
        | 'BACKUP_AGENT'
        | 'ANTIVIRUS_SECURITY'
        | 'MONITORING_ZABBIX'
        | 'SISTEMA_OUTROS';
      belongsToWebri: boolean;
      webriConfidence: 'ALTA' | 'MEDIA' | 'BAIXA' | 'NAO_ASSOCIADO';
      associationReason: string;
      diskIoBytesPerSec: number | null;
      diskAttributionSource: 'ETW_PERFCOUNTER' | 'SQL_DM_IO_VIRTUAL_FILE_STATS' | 'NAO_SUSTENTADO_POR_FONTE';
    }> = [
      {
        pid: sqlPid,
        processName: 'sqlservr.exe',
        startTimeIso: sqlStartIso,
        cpuPercent: sqlCpuPercent,
        privateWorkingSetMb: sqlPhysMb,
        workingSetMb: Number(sys.sql_committed_mb) || sqlPhysMb,
        associatedServiceName: 'MSSQLSERVER',
        associatedServiceDisplayName: 'SQL Server (MSSQLSERVER)',
        category: 'SQL_SERVER',
        belongsToWebri: true,
        webriConfidence: 'ALTA',
        associationReason: `Instância principal ${metaRow.server_name || host} monitorada ao vivo via DMVs.`,
        diskIoBytesPerSec: null,
        diskAttributionSource: 'SQL_DM_IO_VIRTUAL_FILE_STATS',
      },
    ];

    const sqlAgentSvc = windowsServices.find((s) => s.processName === 'SQLAGENT.EXE' && s.state === 'RUNNING' && s.pid);
    if (sqlAgentSvc && sqlAgentSvc.pid) {
      const agentOsProc = osProcByPid.get(Number(sqlAgentSvc.pid));
      windowsProcesses.push({
        pid: Number(sqlAgentSvc.pid),
        processName: 'SQLAGENT.EXE',
        startTimeIso: sqlAgentSvc.processStartTimeIso || agentOsProc?.startTimeIso || sqlStartIso,
        cpuPercent: agentOsProc?.cpuPercent ?? null,
        privateWorkingSetMb: agentOsProc?.privateWorkingSetMb ?? null,
        workingSetMb: agentOsProc?.workingSetMb ?? null,
        associatedServiceName: sqlAgentSvc.serviceName,
        associatedServiceDisplayName: sqlAgentSvc.displayName,
        category: 'SQL_SERVER',
        belongsToWebri: true,
        webriConfidence: 'ALTA',
        associationReason: agentOsProc
          ? 'SQL Server Agent em execução no SRVSQL (monitorado via DMVs e WMI/CIM).'
          : 'SQL Server Agent em execução no SRVSQL (CPU/RAM por processo requer Perfmon/WMI local).',
        diskIoBytesPerSec: null,
        diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
      });
    }

    const seenLocalPids = new Set<number>(windowsProcesses.map((p) => p.pid));
    for (const osProc of osProbe.processes) {
      if (!(osProc.pid > 0) || seenLocalPids.has(osProc.pid)) {
        continue;
      }
      seenLocalPids.add(osProc.pid);
      const svc = svcByPid.get(osProc.pid);
      const cls = classifyWindowsDaemon(osProc.name, svc?.displayName || '');
      windowsProcesses.push({
        pid: osProc.pid,
        processName: osProc.name,
        startTimeIso: osProc.startTimeIso || observedAt,
        cpuPercent: osProc.cpuPercent,
        privateWorkingSetMb: osProc.privateWorkingSetMb,
        workingSetMb: osProc.workingSetMb,
        associatedServiceName: svc?.serviceName || null,
        associatedServiceDisplayName: svc?.displayName || null,
        category: cls.category,
        belongsToWebri: svc ? svc.belongsToWebri : cls.belongsToWebri,
        webriConfidence: svc ? svc.webriConfidence : cls.webriConfidence,
        associationReason: svc
          ? `Serviço ${svc.displayName} (PID ${osProc.pid}) monitorado via WMI/CIM no SRVSQL.`
          : `${cls.reason} (PID ${osProc.pid} via WMI/CIM no SRVSQL).`,
        diskIoBytesPerSec: null,
        diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
      });
    }

    for (const lp of localProcsRes.recordset || []) {
      const hpid = Number(lp.host_process_id || 0);
      if (!(hpid > 0) || seenLocalPids.has(hpid)) {
        continue;
      }
      seenLocalPids.add(hpid);
      const prog = String(lp.program_name || 'LocalClient');
      const progUpper = prog.toUpperCase();
      const isPowerBi = progUpper.includes('MASHUP') || progUpper.includes('POWERBI') || progUpper.includes('POWER BI');
      const cls = classifyWindowsDaemon(prog, String(lp.database_name || ''));
      windowsProcesses.push({
        pid: hpid,
        processName: isPowerBi ? 'Microsoft.Mashup.Container.exe' : prog.slice(0, 64),
        startTimeIso: lp.last_request_start_time_iso ? String(lp.last_request_start_time_iso) : sqlStartIso,
        cpuPercent: null,
        privateWorkingSetMb: null,
        workingSetMb: null,
        associatedServiceName: isPowerBi ? 'PBIEgwService' : null,
        associatedServiceDisplayName: isPowerBi ? 'On-premises data gateway (Mashup Engine)' : null,
        category: isPowerBi ? 'POWERBI_GATEWAY' : cls.category,
        belongsToWebri: !isPowerBi && String(lp.database_name || '').toUpperCase().includes('WEBRI'),
        webriConfidence: isPowerBi ? 'ALTA' : 'MEDIA',
        associationReason: isPowerBi
          ? `Processo local no SRVSQL (${prog}) identificado via host_process_id na DMV de sessões; carga analítica Power BI.`
          : `Processo local no SRVSQL (${prog}) conectado ao banco ${lp.database_name || 'master'} (${Number(lp.session_count || 1)} sessão(ões); CPU/RAM por processo requer Perfmon/WMI).`,
        diskIoBytesPerSec: null,
        diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
      });
    }

    for (const s of sessionsRes.recordset || []) {
      const hpid = Number(s.host_process_id || 0);
      const sessHostUpper = String(s.host_name || '').trim().toUpperCase();
      const targetMachineUpper = String(s.sql_machine_name || sqlMachineUpper).trim().toUpperCase();
      if (!(hpid > 0) || !sessHostUpper || sessHostUpper !== targetMachineUpper || seenLocalPids.has(hpid)) {
        continue;
      }
      seenLocalPids.add(hpid);
      const prog = String(s.program_name || 'LocalClient');
      const progUpper = prog.toUpperCase();
      const isPowerBi = progUpper.includes('MASHUP') || progUpper.includes('POWERBI') || progUpper.includes('POWER BI');
      windowsProcesses.push({
        pid: hpid,
        processName: isPowerBi ? 'Microsoft.Mashup.Container.exe' : prog.slice(0, 64),
        startTimeIso: s.last_request_start_time_iso ? String(s.last_request_start_time_iso) : sqlStartIso,
        cpuPercent: null,
        privateWorkingSetMb: null,
        workingSetMb: null,
        associatedServiceName: isPowerBi ? 'PBIEgwService' : null,
        associatedServiceDisplayName: isPowerBi ? 'On-premises data gateway (Mashup Engine)' : null,
        category: isPowerBi ? 'POWERBI_GATEWAY' : 'SISTEMA_OUTROS',
        belongsToWebri: !isPowerBi && String(s.database_name || '').toUpperCase().includes('WEBRI'),
        webriConfidence: isPowerBi ? 'ALTA' : 'MEDIA',
        associationReason: isPowerBi
          ? `Processo local no SRVSQL (${prog}) identificado via host_process_id na DMV de sessões; carga analítica Power BI.`
          : `Processo local no SRVSQL (${prog}) conectado ao banco ${s.database_name || 'master'} (CPU/RAM por processo requer Perfmon local).`,
        diskIoBytesPerSec: null,
        diskAttributionSource: 'NAO_SUSTENTADO_POR_FONTE',
      });
    }

    const concurrentEvents: Array<{
      id: string;
      category: 'BACKUP' | 'ANTIVIRUS' | 'SCHEDULED_TASK' | 'POWERBI_GATEWAY' | 'SQL_SERVER_EVENT';
      title: string;
      source: string;
      startedAt: string;
      endedAt: string | null;
      status: 'EM_ANDAMENTO' | 'CONCLUIDO' | 'FALHA';
      detail: string;
    }> = [];
    const seenConcurrentKeys = new Set<string>();
    for (const s of sessionsRes.recordset || []) {
      const cmdUpper = String(s.command || '').toUpperCase();
      const progName = String(s.program_name || '');
      const progUpper = progName.toUpperCase();
      const statusUpper = String(s.session_status || '').toUpperCase();
      const openTx = Number(s.open_transaction_count || 0);
      const isRunningOrOpen = statusUpper !== 'SLEEPING' || openTx > 0 || Boolean(s.blocking_session_id);
      if (!isRunningOrOpen) continue;

      const startedIso = s.last_request_start_time_iso ? String(s.last_request_start_time_iso) : observedAt;
      const dbName = String(s.database_name || 'master');

      if (cmdUpper.includes('BACKUP')) {
        const key = `backup:${s.session_id}`;
        if (!seenConcurrentKeys.has(key)) {
          seenConcurrentKeys.add(key);
          concurrentEvents.push({
            id: `evt-backup-${s.session_id}`,
            category: 'BACKUP',
            title: `Rotina de Backup em andamento (${dbName})`,
            source: progName || 'SQL Server Backup',
            startedAt: startedIso,
            endedAt: null,
            status: 'EM_ANDAMENTO',
            detail: `Sessão ${s.session_id} executando comando ${s.command} em ${dbName}.`,
          });
        }
      } else if (progUpper.includes('MASHUP') || progUpper.includes('POWERBI') || progUpper.includes('POWER BI')) {
        const key = `pbi:${s.session_id}`;
        if (!seenConcurrentKeys.has(key)) {
          seenConcurrentKeys.add(key);
          concurrentEvents.push({
            id: `evt-pbi-${s.session_id}`,
            category: 'POWERBI_GATEWAY',
            title: 'Extração Power BI Gateway (Mashup Engine)',
            source: progName || 'On-premises data gateway',
            startedAt: startedIso,
            endedAt: null,
            status: 'EM_ANDAMENTO',
            detail: `Sessão ${s.session_id} (${s.host_name || host}) consultando ${dbName} com status ${s.session_status}.`,
          });
        }
      } else if (progUpper.includes('SQLAGENT')) {
        const key = `agent:${s.session_id}`;
        if (!seenConcurrentKeys.has(key)) {
          seenConcurrentKeys.add(key);
          concurrentEvents.push({
            id: `evt-agent-${s.session_id}`,
            category: 'SCHEDULED_TASK',
            title: `Job do SQL Server Agent ativo (${dbName})`,
            source: progName,
            startedAt: startedIso,
            endedAt: null,
            status: 'EM_ANDAMENTO',
            detail: `Sessão ${s.session_id} do SQL Server Agent executando comando ${s.command || s.session_status} em ${dbName}.`,
          });
        }
      }
    }

    for (const p of osProbe.processes) {
      const lower = p.name.toLowerCase();
      if (lower === 'tiworker.exe' || lower === 'trustedinstaller.exe') {
        concurrentEvents.push({
          id: `evt-os-${p.pid}`,
          category: 'SCHEDULED_TASK',
          title: 'Windows Modules Installer Worker (Windows Update)',
          source: `${p.name} (PID ${p.pid})`,
          startedAt: p.startTimeIso,
          endedAt: null,
          status: 'EM_ANDAMENTO',
          detail: `Manutenção/atualização do Windows em execução no SRVSQL (CPU ${p.cpuPercent ?? 'n/d'}%, RAM ${p.privateWorkingSetMb ?? p.workingSetMb ?? 'n/d'} MB).`,
        });
      }
    }

    const bufferCacheHitRatioPercent =
      sys.buffer_cache_hit_ratio_pct !== null && sys.buffer_cache_hit_ratio_pct !== undefined
        ? Math.round(Number(sys.buffer_cache_hit_ratio_pct) * 100) / 100
        : null;

    const samplePayload = {
      observedAt,
      collectorVersion: AGENT_VERSION,
      windowsOsTelemetryAvailable: osProbe.available,
      connectorHost: os.hostname(),
      collectionDurationMs: Date.now() - startMs,
      simpleConnectivityPingMs: selectOneMs,
      cpuTotalPercent,
      sqlCpuPercent,
      cpuCount: Number(sys.cpu_count) || null,
      totalUserSessionsCount: Number(sys.total_user_sessions) || activeSessions.length,
      cpuRingTimeline: [...cpuRows]
        .reverse()
        .map((r: any) => ({
          timestampIso: String(r.sample_time_iso || observedAt),
          timeLabel: String(r.time_label || ''),
          totalServerCpuPercent:
            typeof r.total_server_cpu_percent === 'number'
              ? Math.max(0, Math.min(100, Number(r.total_server_cpu_percent)))
              : null,
        })),
      sqlMetadata: {
        serverName: metaRow.server_name || host,
        machineName: metaRow.machine_name || host,
        instanceName: metaRow.instance_name || 'MSSQLSERVER',
        edition: metaRow.edition || null,
        productVersion: productVersion || null,
        productLevel: metaRow.product_level || null,
        majorVersion,
        sqlServerStartTime: sqlStartIso,
        loginUsed: metaRow.login_used || env.SQL_SERVER_USER,
        hasViewServerState: true,
        hasViewServerPerformanceState: false,
        hasViewAnyDefinition,
        queryStoreSupported: majorVersion !== null && majorVersion >= 13,
        queryStoreEnabled: null,
        requiredPermissionLabel: `VIEW SERVER STATE ativo para [${metaRow.login_used || env.SQL_SERVER_USER}]`,
      },
      zabbixProbe: {
        host,
        port: 10050,
        tcpReachable: zabbix.reachable,
        agentProcessDetected: zabbix.reachable,
        status: !zabbix.reachable
          ? 'UNREACHABLE'
          : zabbix.passiveAccepted
          ? 'CONNECTED'
          : 'PASSIVE_REJECTED_BY_WHITELIST_OR_PSK',
        detail: zabbix.detail,
        checkedAt: observedAt,
      },
      windowsMemory: {
        totalPhysicalMb: totalPhysMb,
        availablePhysicalMb: availPhysMb,
        usedPhysicalMb: usedPhysMb,
        usedPercent,
        committedMb,
        commitLimitMb,
        commitPercent,
        pagesPerSec: null,
        pageInputsPerSec: null,
        pageFaultsPerSec: null,
        windowsMemoryPressure:
          Boolean(sys.process_physical_memory_low) || (usedPercent !== null && usedPercent >= 93)
            ? 'ALTA'
            : usedPercent !== null && usedPercent >= 85
            ? 'MODERADA'
            : 'NORMAL',
      },
      windowsVolumes,
      windowsNetwork: [],
      windowsProcesses,
      windowsServices,
      concurrentEvents,
      activeSessions,
      waitStatsRaw,
      fileIoRaw,
      sqlMemory: {
        totalServerMemoryMb: sqlPhysMb,
        targetServerMemoryMb: Number(sys.max_server_memory_mb) || null,
        maxServerMemoryConfigMb: Number(sys.max_server_memory_mb) || null,
        minServerMemoryConfigMb: Number(sys.min_server_memory_mb) || null,
        sqlProcessWorkingSetMb: Number(sys.sql_committed_mb) || sqlPhysMb,
        sqlProcessPrivateMb: sqlPhysMb,
        pageLifeExpectancySec:
          sys.page_life_expectancy_sec !== null && sys.page_life_expectancy_sec !== undefined
            ? Number(sys.page_life_expectancy_sec)
            : null,
        bufferCacheHitRatioPercent,
        memoryGrantsPending: Number(sys.memory_grants_pending ?? 0),
        memoryGrantsActive: Number(sys.memory_grants_active ?? 0),
        grantedWorkspaceMemoryMb: Number(sys.granted_workspace_memory_mb ?? 0),
        maxWorkspaceMemoryMb: null,
        processPhysicalMemoryLow: Boolean(sys.process_physical_memory_low),
        processVirtualMemoryLow: Boolean(sys.process_virtual_memory_low),
      },
      databaseSpaces,
      costlyQueries,
    };

    const ok = await sendSrvsqlPerformanceSample(samplePayload);
    if (ok) {
      logger.info(
        `SRVSQL_PERF: Amostra ao vivo enviada (${samplePayload.collectionDurationMs}ms, CPU ${cpuTotalPercent ?? 'n/a'}%, sessões ${samplePayload.totalUserSessionsCount}).`
      );
    }
    return ok;
  } catch (err: any) {
    logger.warn(`SRVSQL_PERF: Falha na coleta de DMVs do SRVSQL: ${err?.message || err}`);
    return false;
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
    isCollectingSrvsqlPerf = false;
  }
}

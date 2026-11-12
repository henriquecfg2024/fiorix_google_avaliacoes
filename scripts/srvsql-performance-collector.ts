/**
 * Coletor Leve de Performance do SRVSQL (FIORIX Connector)
 *
 * Modos de execução:
 * - `npx tsx scripts/srvsql-performance-collector.ts --probe-only`   : Verifica conectividade, versão, edição e permissões DMVs.
 * - `npx tsx scripts/srvsql-performance-collector.ts --collect-json` : Executa 2 amostras com intervalo curto (ou 1 amostra completa + histórico de ring buffer) e imprime o snapshot real.
 */

import sql from 'mssql';
import net from 'node:net';
import { env } from '../src/config/env.js';

async function probeZabbixAgent(host: string, port = 10050, timeoutMs = 1500): Promise<{
  reachable: boolean;
  passiveAccepted: boolean;
  detail: string;
}> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (reachable: boolean, passiveAccepted: boolean, detail: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ reachable, passiveAccepted, detail });
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
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
        'Porta TCP 10050 aberta em SRVSQL (zabbix_agent2.exe ativo), mas conexões passivas diretas são restritas ao IP do servidor Zabbix em zabbix_agent2.conf.',
      );
    });
    socket.on('timeout', () => {
      finish(false, false, 'Timeout ao testar porta 10050 do zabbix_agent2.');
    });
    socket.on('error', (err) => {
      finish(false, false, `Falha de conexão na porta 10050: ${err.message}`);
    });

    socket.connect(port, host);
  });
}

export async function collectFullLiveSrvsqlSnapshot() {
  const host = env.SQL_SERVER_HOST || 'srvsql';
  const zabbix = await probeZabbixAgent(host, 10050, 1500);
  const startMs = Date.now();

  const pool = await sql.connect({
    user: env.SQL_SERVER_USER,
    password: env.SQL_SERVER_PASSWORD,
    server: host,
    database: env.SQL_SERVER_DATABASE,
    port: 1433,
    pool: { max: 2, min: 0, idleTimeoutMillis: 10000 },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 5000,
      requestTimeout: 5000,
    },
  });

  try {
    const pingStart = Date.now();
    await pool.request().query('SELECT 1 AS ok;');
    const selectOneMs = Date.now() - pingStart;

    // 1. Metadados + Memória do SO e do SQL Server + Boot time
    const sysRes = await pool.request().query(`
      SET NOCOUNT ON;
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
      SET LOCK_TIMEOUT 2000;

      SELECT
        CAST(SERVERPROPERTY('MachineName') AS VARCHAR(128)) AS machine_name,
        CAST(SERVERPROPERTY('ServerName') AS VARCHAR(128)) AS server_name,
        CAST(ISNULL(SERVERPROPERTY('InstanceName'), 'MSSQLSERVER') AS VARCHAR(128)) AS instance_name,
        CAST(SERVERPROPERTY('Edition') AS VARCHAR(128)) AS edition,
        CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(64)) AS product_version,
        CAST(SERVERPROPERTY('ProductLevel') AS VARCHAR(64)) AS product_level,
        HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW SERVER STATE') AS has_view_server_state,
        HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW ANY DEFINITION') AS has_view_any_definition,
        CAST(SYSTEM_USER AS VARCHAR(128)) AS login_used,
        CONVERT(VARCHAR(33), osi.sqlserver_start_time, 126) AS sqlserver_start_time_iso,
        osi.cpu_count,
        CAST(osm.total_physical_memory_kb / 1024.0 AS DECIMAL(12, 1)) AS total_physical_memory_mb,
        CAST(osm.available_physical_memory_kb / 1024.0 AS DECIMAL(12, 1)) AS available_physical_memory_mb,
        CAST(osm.total_page_file_kb / 1024.0 AS DECIMAL(12, 1)) AS commit_limit_mb,
        CAST((osm.total_page_file_kb - osm.available_page_file_kb) / 1024.0 AS DECIMAL(12, 1)) AS committed_mb,
        CAST(osm.system_memory_state_desc AS VARCHAR(128)) AS system_memory_state_desc,
        CAST(pm.physical_memory_in_use_kb / 1024.0 AS DECIMAL(12, 1)) AS sql_physical_memory_in_use_mb,
        CAST(pm.virtual_address_space_committed_kb / 1024.0 AS DECIMAL(12, 1)) AS sql_committed_mb,
        pm.page_fault_count,
        pm.process_physical_memory_low,
        pm.process_virtual_memory_low,
        (SELECT CAST(value_in_use AS INT) FROM sys.configurations WHERE name = 'max server memory (MB)') AS max_server_memory_mb,
        (SELECT CAST(value_in_use AS INT) FROM sys.configurations WHERE name = 'min server memory (MB)') AS min_server_memory_mb,
        (SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1) AS total_user_sessions,
        (SELECT COUNT(*) FROM sys.dm_exec_query_memory_grants WHERE grant_time IS NULL) AS memory_grants_pending,
        (SELECT COUNT(*) FROM sys.dm_exec_query_memory_grants WHERE grant_time IS NOT NULL) AS memory_grants_active,
        (SELECT CAST(ISNULL(SUM(granted_memory_kb), 0) / 1024.0 AS DECIMAL(12, 1)) FROM sys.dm_exec_query_memory_grants) AS granted_workspace_memory_mb,
        (SELECT TOP 1 CAST(cntr_value AS INT) FROM sys.dm_os_performance_counters WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%') AS page_life_expectancy_sec
      FROM sys.dm_os_sys_info AS osi
      CROSS JOIN sys.dm_os_sys_memory AS osm
      CROSS JOIN sys.dm_os_process_memory AS pm;
    `);

    // 2. Histórico real dos últimos 30 minutos de CPU do Windows e SQL Server via RING_BUFFER_SCHEDULER_MONITOR
    const cpuRingRes = await pool.request().query(`
      SET NOCOUNT ON;
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
      SET LOCK_TIMEOUT 2000;

      DECLARE @ts_now BIGINT = (SELECT cpu_ticks / (cpu_ticks / ms_ticks) FROM sys.dm_os_sys_info);

      SELECT TOP (30)
        CONVERT(VARCHAR(33), DATEADD(ms, -1 * (@ts_now - [timestamp]), GETDATE()), 126) AS sample_time_iso,
        CONVERT(VARCHAR(5), DATEADD(ms, -1 * (@ts_now - [timestamp]), GETDATE()), 108) AS time_label,
        record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS sql_cpu_percent,
        record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS system_idle_percent,
        100 - record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS total_server_cpu_percent,
        100 - record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int')
            - record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS other_processes_cpu_percent
      FROM (
        SELECT [timestamp], CONVERT(xml, record) AS [record]
        FROM sys.dm_os_ring_buffers WITH (NOLOCK)
        WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
          AND record LIKE N'%<SystemHealth>%'
      ) AS x
      ORDER BY [timestamp] DESC;
    `);

    // 3. Sessões ativas, transações abertas e bloqueadores
    const sessionsRes = await pool.request().query(`
      SET NOCOUNT ON;
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
      SET LOCK_TIMEOUT 2000;

      SELECT TOP (80)
        s.session_id,
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
        CONVERT(VARCHAR(33), s.last_request_start_time, 126) AS last_request_start_time_iso,
        CONVERT(VARCHAR(33), s.last_request_end_time, 126) AS last_request_end_time_iso,
        CONVERT(VARCHAR(18), r.query_hash, 1) AS query_hash,
        CONVERT(VARCHAR(18), r.query_plan_hash, 1) AS query_plan_hash
      FROM sys.dm_exec_sessions AS s
      LEFT JOIN sys.dm_exec_requests AS r
        ON s.session_id = r.session_id
      WHERE s.is_user_process = 1
      ORDER BY
        CASE WHEN EXISTS (SELECT 1 FROM sys.dm_exec_requests rb WHERE rb.blocking_session_id = s.session_id) THEN 0 ELSE 1 END,
        COALESCE(r.open_transaction_count, s.open_transaction_count, 0) DESC,
        COALESCE(r.wait_time, 0) DESC,
        s.cpu_time DESC;
    `);

    // 4. Volumes e Arquivos de Banco (sys.dm_io_virtual_file_stats + sys.dm_os_volume_stats)
    const filesRes = await pool.request().query(`
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
        CAST(ISNULL(vs.logical_volume_name, '') AS VARCHAR(64)) AS logical_volume_name,
        CAST(vs.total_bytes / 1073741824.0 AS DECIMAL(12, 1)) AS volume_total_gb,
        CAST(vs.available_bytes / 1073741824.0 AS DECIMAL(12, 1)) AS volume_free_gb,
        CAST((mf.size * 8.0) / 1024.0 AS DECIMAL(12, 1)) AS file_size_mb,
        vfs.sample_ms,
        vfs.num_of_reads,
        vfs.num_of_bytes_read,
        vfs.io_stall_read_ms,
        vfs.num_of_writes,
        vfs.num_of_bytes_written,
        vfs.io_stall_write_ms
      FROM sys.dm_io_virtual_file_stats(NULL, NULL) AS vfs
      INNER JOIN sys.master_files AS mf
        ON vfs.database_id = mf.database_id
       AND vfs.file_id = mf.file_id
      OUTER APPLY sys.dm_os_volume_stats(vfs.database_id, vfs.file_id) AS vs;
    `);

    // 5. Wait Stats brutos
    const waitsRes = await pool.request().query(`
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
      WHERE waiting_tasks_count > 0
        AND wait_time_ms > 0
      ORDER BY wait_time_ms DESC;
    `);

    // 6. Top Query Hashes (sys.dm_exec_query_stats)
    const topQueriesRes = await pool.request().query(`
      SET NOCOUNT ON;
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
      SET LOCK_TIMEOUT 2000;

      SELECT TOP (15)
        CONVERT(VARCHAR(18), qs.query_hash, 1) AS query_hash,
        SUM(qs.execution_count) AS execution_count,
        CAST(SUM(qs.total_elapsed_time) / 1000.0 AS BIGINT) AS total_elapsed_time_ms,
        CAST(SUM(qs.total_worker_time) / 1000.0 AS BIGINT) AS total_cpu_time_ms,
        SUM(qs.total_logical_reads) AS total_logical_reads,
        SUM(qs.total_logical_writes) AS total_logical_writes,
        CONVERT(VARCHAR(33), MAX(qs.last_execution_time), 126) AS last_execution_time_iso
      FROM sys.dm_exec_query_stats AS qs
      WHERE qs.query_hash <> 0x0000000000000000
      GROUP BY qs.query_hash
      ORDER BY SUM(qs.total_elapsed_time) DESC;
    `);

    // 7. Serviços do SQL Server (sys.dm_server_services disponível no SQL 2012 SP4!)
    let serverServices: any[] = [];
    try {
      const svcRes = await pool.request().query(`
        SET NOCOUNT ON;
        SELECT
          CAST(servicename AS VARCHAR(128)) AS servicename,
          CAST(startup_type_desc AS VARCHAR(64)) AS startup_type_desc,
          CAST(status_desc AS VARCHAR(64)) AS status_desc,
          process_id,
          CONVERT(VARCHAR(33), last_startup_time, 126) AS last_startup_time_iso,
          CAST(service_account AS VARCHAR(128)) AS service_account
        FROM sys.dm_server_services;
      `);
      serverServices = svcRes.recordset;
    } catch {
      // ignora caso restrito
    }

    return {
      observedAt: new Date().toISOString(),
      collectionDurationMs: Date.now() - startMs,
      selectOneMs,
      zabbix,
      sys: sysRes.recordset[0] || {},
      cpuTimeline: cpuRingRes.recordset,
      sessions: sessionsRes.recordset,
      files: filesRes.recordset,
      waits: waitsRes.recordset,
      topQueries: topQueriesRes.recordset,
      serverServices,
    };
  } finally {
    await pool.close().catch(() => {});
  }
}

if (process.argv.includes('--probe-only') || process.argv.includes('--collect-json')) {
  collectFullLiveSrvsqlSnapshot()
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Erro na coleta SRVSQL:', err?.message || err);
      process.exit(1);
    });
}

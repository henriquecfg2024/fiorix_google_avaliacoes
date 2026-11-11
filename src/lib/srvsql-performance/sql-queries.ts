/**
 * Catálogo oficial de consultas de diagnóstico T-SQL somente leitura para o SRVSQL (SQL Server 2012 SP4 a 2022)
 * e lista documentada de esperas ociosas filtradas (Idle/Benign Waits).
 *
 * Regras estritas:
 * - Somente leitura (`SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SET LOCK_TIMEOUT 2000;`).
 * - Limite explícito de linhas (`TOP (150)`) e orçamento de execução curto.
 * - Sem captura de textos SQL completos com literais sensíveis nem planos de execução pesados por padrão;
 *   utiliza `query_hash`, `query_plan_hash`, `wait_type`, `session_id` e contadores agregados.
 * - Nenhuma instrução `KILL`, `DBCC`, `ALTER`, `CREATE INDEX` ou escrita em bases da SIPLAN.
 */

export const BENIGN_IDLE_WAIT_TYPES: ReadonlySet<string> = new Set([
  'BROKER_EVENTHANDLER',
  'BROKER_RECEIVE_WAITFOR',
  'BROKER_TASK_STOP',
  'BROKER_TO_FLUSH',
  'BROKER_TRANSMITTER',
  'CHECKPOINT_QUEUE',
  'CHKPT',
  'CLR_AUTO_EVENT',
  'CLR_MANUAL_EVENT',
  'CLR_SEMAPHORE',
  'DBMIRROR_DBM_EVENT',
  'DBMIRROR_EVENTS_QUEUE',
  'DBMIRROR_WORKER_QUEUE',
  'DBMIRRORING_CMD',
  'DIRTY_PAGE_POLL',
  'DISPATCHER_QUEUE_SEMAPHORE',
  'EXECSYNC',
  'FSAGENT',
  'FT_IFTS_SCHEDULER_IDLE_WAIT',
  'FT_IFTSHC_MUTEX',
  'HADR_CLUSAPI_CALL',
  'HADR_FILESTREAM_IOMGR_IOCOMPLETION',
  'HADR_LOGCAPTURE_WAIT',
  'HADR_NOTIFICATION_DEQUEUE',
  'HADR_TIMER_TASK',
  'HADR_WORK_QUEUE',
  'KSOURCE_WAKEUP',
  'LAZYWRITER_SLEEP',
  'LOGMGR_QUEUE',
  'MEMORY_ALLOCATION_EXT',
  'ONDEMAND_TASK_QUEUE',
  'PARALLEL_REDO_DRAIN_WORKER',
  'PARALLEL_REDO_LOG_CACHE',
  'PARALLEL_REDO_TRAN_LIST',
  'PARALLEL_REDO_WORKER_SYNC',
  'PARALLEL_REDO_WORKER_WAIT_WORK',
  'PREEMPTIVE_XE_GETTARGETSTATE',
  'PWAIT_ALL_COMPONENTS_INITIALIZED',
  'PWAIT_DIRECTLOGCONSUMER_GETNEXT',
  'QDS_PERSIST_TASK_MAIN_LOOP_SLEEP',
  'QDS_ASYNC_QUEUE',
  'QDS_CLEANUP_STALE_QUERIES_TASK_MAIN_LOOP_SLEEP',
  'QDS_SHUTDOWN_QUEUE',
  'REDO_THREAD_PENDING_WORK',
  'REQUEST_FOR_DEADLOCK_SEARCH',
  'RESOURCE_QUEUE',
  'SERVER_IDLE_CHECK',
  'SLEEP_BPOOL_FLUSH',
  'SLEEP_DBSTARTUP',
  'SLEEP_DCOMSTARTUP',
  'SLEEP_MASTERDBREADY',
  'SLEEP_MASTERMDREADY',
  'SLEEP_MASTERUPGRADED',
  'SLEEP_MSDBSTARTUP',
  'SLEEP_SYSTEMTASK',
  'SLEEP_TASK',
  'SLEEP_TEMPDBSTARTUP',
  'SNI_HTTP_ACCEPT',
  'SP_SERVER_DIAGNOSTICS_SLEEP',
  'SQLTRACE_BUFFER_FLUSH',
  'SQLTRACE_INCREMENTAL_FLUSH_SLEEP',
  'SQLTRACE_WAIT_ENTRIES',
  'WAIT_FOR_RESULTS',
  'WAITFOR',
  'WAITFOR_TASKSHUTDOWN',
  'WAIT_XTP_RECOVERY',
  'WAIT_XTP_HOST_WAIT',
  'WAIT_XTP_OFFLINE_CKPT_NEW_LOG',
  'WAIT_XTP_CKPT_CLOSE',
  'XE_DISPATCHER_JOIN',
  'XE_DISPATCHER_WAIT',
  'XE_TIMER_EVENT',
]);

export const MINIMUM_PERMISSIONS_SQL_SCRIPT = `-- ============================================================================
-- PERMISSÕES MÍNIMAS PARA O COLETOR DE PERFORMANCE DO SRVSQL (SOMENTE LEITURA)
-- Compatível com SQL Server 2012 SP4 (11.0) até SQL Server 2022 (16.0)
-- NÃO exige perfil sysadmin.
-- ============================================================================

USE [master];
GO

-- 1. Em SQL Server 2012 a 2019 (como SRVSQL\\WEBRI 11.0 SP4):
GRANT VIEW SERVER STATE TO [fiorix_connector];
GRANT VIEW ANY DEFINITION TO [fiorix_connector];
GO

-- 2. Em SQL Server 2022+ (opcional, mais granular que VIEW SERVER STATE):
-- GRANT VIEW SERVER PERFORMANCE STATE TO [fiorix_connector];
-- GO
`;

export const DIAGNOSTIC_SQL_QUERIES = {
  /**
   * 1. Identificação de versão, edição, instância, horário de boot e permissões efetivas
   * Não exige VIEW SERVER STATE (exceto `sqlserver_start_time` em `sys.dm_os_sys_info` que é tentado separadamente).
   */
  INSTANCE_METADATA: `
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
      CAST(LEFT(CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(64)), CHARINDEX('.', CAST(SERVERPROPERTY('ProductVersion') AS VARCHAR(64))) - 1) AS INT) AS major_version,
      HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW SERVER STATE') AS has_view_server_state,
      HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW SERVER PERFORMANCE STATE') AS has_view_server_perf_state,
      HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW ANY DEFINITION') AS has_view_any_definition,
      CAST(SYSTEM_USER AS VARCHAR(128)) AS login_used;
  `,

  /**
   * 2. Horário de início do SQL Server (`sqlserver_start_time`) e memória física/alvo
   * Exige `VIEW SERVER STATE`. Usado para detectar reinicialização do serviço e reset de contadores.
   */
  SYS_INFO_AND_MEMORY: `
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
    SET LOCK_TIMEOUT 2000;

    SELECT
      CONVERT(VARCHAR(33), osi.sqlserver_start_time, 126) AS sqlserver_start_time_iso,
      CAST(osm.total_physical_memory_kb / 1024.0 AS DECIMAL(12, 1)) AS total_physical_memory_mb,
      CAST(osm.available_physical_memory_kb / 1024.0 AS DECIMAL(12, 1)) AS available_physical_memory_mb,
      CAST(osm.total_page_file_kb / 1024.0 AS DECIMAL(12, 1)) AS commit_limit_mb,
      CAST((osm.total_page_file_kb - osm.available_page_file_kb) / 1024.0 AS DECIMAL(12, 1)) AS committed_mb,
      osm.system_high_memory_signal_state,
      osm.system_low_memory_signal_state,
      CAST(pm.physical_memory_in_use_kb / 1024.0 AS DECIMAL(12, 1)) AS sql_physical_memory_in_use_mb,
      pm.process_physical_memory_low,
      pm.process_virtual_memory_low,
      (SELECT CAST(value_in_use AS INT) FROM sys.configurations WHERE name = 'max server memory (MB)') AS max_server_memory_mb,
      (SELECT CAST(value_in_use AS INT) FROM sys.configurations WHERE name = 'min server memory (MB)') AS min_server_memory_mb
    FROM sys.dm_os_sys_info AS osi
    CROSS JOIN sys.dm_os_sys_memory AS osm
    CROSS JOIN sys.dm_os_process_memory AS pm;
  `,

  /**
   * 3. Sessões ativas, requisições em andamento e sessões ociosas com transação aberta que bloqueiam outras.
   * Captura apenas `query_hash` e `query_plan_hash` (sem `sys.dm_exec_sql_text` por padrão para proteger dados pessoais/LGPD).
   */
  ACTIVE_SESSIONS_AND_BLOCKERS: `
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
    SET LOCK_TIMEOUT 2000;

    SELECT TOP (150)
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
      AND (
        r.session_id IS NOT NULL
        OR s.open_transaction_count > 0
        OR EXISTS (
          SELECT 1
          FROM sys.dm_exec_requests AS r_blocked
          WHERE r_blocked.blocking_session_id = s.session_id
        )
      )
    ORDER BY
      CASE WHEN EXISTS (SELECT 1 FROM sys.dm_exec_requests rb WHERE rb.blocking_session_id = s.session_id) THEN 0 ELSE 1 END,
      COALESCE(r.wait_time, 0) DESC,
      COALESCE(r.total_elapsed_time, 0) DESC;
  `,

  /**
   * 4. Estatísticas acumuladas de espera (`sys.dm_os_wait_stats`) para cálculo de diferenças (delta) entre coletas.
   */
  WAIT_STATS_RAW: `
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
    SET LOCK_TIMEOUT 2000;

    SELECT TOP (80)
      CAST(wait_type AS VARCHAR(64)) AS wait_type,
      waiting_tasks_count,
      wait_time_ms,
      max_wait_time_ms,
      signal_wait_time_ms
    FROM sys.dm_os_wait_stats
    WHERE waiting_tasks_count > 0
      AND wait_time_ms > 0
    ORDER BY wait_time_ms DESC;
  `,

  /**
   * 5. Estatísticas acumuladas de I/O por arquivo de dados e log (`sys.dm_io_virtual_file_stats`) para cálculo de latência por delta.
   */
  VIRTUAL_FILE_STATS_RAW: `
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
  `,

  /**
   * 6. Memory Grants pendentes (`sys.dm_exec_query_memory_grants` / `sys.dm_os_performance_counters`) e espaço em tempdb/logs.
   */
  MEMORY_GRANTS_AND_TEMPDB: `
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
    SET LOCK_TIMEOUT 2000;

    SELECT
      (SELECT COUNT(*) FROM sys.dm_exec_query_memory_grants WHERE grant_time IS NULL) AS memory_grants_pending,
      (SELECT COUNT(*) FROM sys.dm_exec_query_memory_grants WHERE grant_time IS NOT NULL) AS memory_grants_active,
      (SELECT CAST(ISNULL(SUM(granted_memory_kb), 0) / 1024.0 AS DECIMAL(12, 1)) FROM sys.dm_exec_query_memory_grants) AS granted_workspace_memory_mb,
      (SELECT CAST(cntr_value AS INT) FROM sys.dm_os_performance_counters WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%' AND instance_name = '') AS page_life_expectancy_sec;
  `,

  /**
   * 7. Top consultas agregadas por `query_hash` (`sys.dm_exec_query_stats`) sem captura de texto SQL bruto.
   */
  TOP_QUERY_HASHES_RAW: `
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
    SET LOCK_TIMEOUT 2000;

    SELECT TOP (25)
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
  `,
} as const;

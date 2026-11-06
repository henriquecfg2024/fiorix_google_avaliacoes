import sql from 'mssql';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { toSqlDateTime2Local } from '../utils/sqlDateTime.js';
import { healthManager } from '../services/health.js';
import { runtimeDirective } from '../services/runtime-directive.js';

function getSqlConfig(): sql.config {
  const remoteCfg = runtimeDirective.getRemoteConfig();
  return {
    user: env.SQL_SERVER_USER,
    password: env.SQL_SERVER_PASSWORD,
    database: remoteCfg.sqlDatabase || env.SQL_SERVER_DATABASE,
    server: remoteCfg.sqlHost || env.SQL_SERVER_HOST,
    requestTimeout: 45000,
    connectionTimeout: 15000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: false, // For local SQL Server instances usually false
      trustServerCertificate: true, // Trust local self-signed certs
      requestTimeout: 45000
    }
  };
}

export async function executeProcedure(sourceName: string, procedureName: string) {
  logger.info(`[MSSQL] Executando procedure ${procedureName} para fonte ${sourceName}...`);
  const startTime = Date.now();
  
  let pool;
  try {
    pool = await sql.connect(getSqlConfig());
    
    // Timeout configured for 45s
    const request = pool.request();
    request.timeout = 45000;
    
    const result = await request.execute(procedureName);
    
    const durationMs = Date.now() - startTime;
    const records = result.recordset || [];
    
    logger.info(`SQL_SUCCESS: ${sourceName} processada em ${durationMs}ms. Registros: ${records.length}`);
    
    return records;
  } catch (err: any) {
    logger.error(`SQL_ERROR: Falha na procedure ${procedureName}: ${err.message}`);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

export type BiIncrementalParams = {
  dataInicial: string;
  dataFinal: string;
  flag: number;
  cursorValue: string;
  overlapMinutes: number;
};

export async function executeBiIncrementalProcedure(params: BiIncrementalParams) {
  logger.info('[MSSQL] Executando procedure dbo.pr_Fiorix_BI_Incremental para fonte bi...');
  const startTime = Date.now();
  let pool;
  try {
    pool = await sql.connect(getSqlConfig());
    const request = pool.request();
    request.timeout = 30000;
    request.input('DataInicial', sql.VarChar(10), params.dataInicial);
    request.input('DataFinal', sql.VarChar(10), params.dataFinal);
    request.input('Flag', sql.Int, params.flag);
    request.input('CursorValue', sql.VarChar(23), toSqlDateTime2Local(params.cursorValue));
    request.input('OverlapMinutes', sql.Int, params.overlapMinutes);
    const result = await request.execute('dbo.pr_Fiorix_BI_Incremental');
    const durationMs = Date.now() - startTime;
    const records = result.recordset || [];
    logger.info(`SQL_SUCCESS: bi incremental processada em ${durationMs}ms. Registros: ${records.length}`);
    return { records, durationMs };
  } catch (err: any) {
    logger.error(`SQL_ERROR: Falha na procedure dbo.pr_Fiorix_BI_Incremental: ${err.message}`);

    throw err;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

export type BiIncrementalV2Params = {

  dataInicial?: string;
  dataFinal?: string;
  flag?: number;
  lastProtocolo?: number | null;
  lastSeqTitulo?: number | null;
  cursorValue?: string;
  overlapMinutes?: number;
};

export async function executeBiIncrementalV2Procedure(params: BiIncrementalV2Params) {
  logger.info('[MSSQL] Executando procedure dbo.pr_Fiorix_BI_Incremental_v2 para fonte bi...');
  const startTime = Date.now();
  let pool;
  try {
    pool = await sql.connect(getSqlConfig());
    const request = pool.request();
    request.timeout = 30000;
    if (params.dataInicial) request.input('DataInicial', sql.VarChar(10), params.dataInicial);
    if (params.dataFinal) request.input('DataFinal', sql.VarChar(10), params.dataFinal);
    request.input('Flag', sql.Int, params.flag ?? 0);
    if (params.lastProtocolo !== undefined && params.lastProtocolo !== null) {
      request.input('LastProtocolo', sql.Int, params.lastProtocolo);
    }
    if (params.lastSeqTitulo !== undefined && params.lastSeqTitulo !== null) {
      request.input('LastSeqTitulo', sql.Int, params.lastSeqTitulo);
    }
    if (params.cursorValue) {
      request.input('CursorValue', sql.VarChar(23), toSqlDateTime2Local(params.cursorValue));
    }
    request.input('OverlapMinutes', sql.Int, params.overlapMinutes ?? 0);
    const result = await request.execute('dbo.pr_Fiorix_BI_Incremental_v2');
    const durationMs = Date.now() - startTime;
    const records = result.recordset || [];
    logger.info(`SQL_SUCCESS: bi incremental v2 processada em ${durationMs}ms. Registros: ${records.length}`);
    return { records, durationMs };
  } catch (err: any) {
    logger.error(`SQL_ERROR: Falha na procedure dbo.pr_Fiorix_BI_Incremental_v2: ${err.message}`);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}


export type ProdutividadeIncrementalParams = {
  dataInicial: string;
  dataFinal: string;
  idCaixa?: string;
  cursorValue: string;
  overlapMinutes: number;
};

export async function executeProdutividadeIncrementalProcedure(params: ProdutividadeIncrementalParams) {
  logger.info('[MSSQL] Executando procedure dbo.pr_Fiorix_BI_Produtividade_Incremental para fonte produtividade...');
  const startTime = Date.now();
  let pool;
  try {
    pool = await sql.connect(getSqlConfig());
    const request = pool.request();
    request.timeout = 30000;
    request.input('DataInicial', sql.VarChar(10), params.dataInicial);
    request.input('DataFinal', sql.VarChar(10), params.dataFinal);
    request.input('IDCaixa', sql.VarChar(3), params.idCaixa ?? '0');
    request.input('CursorValue', sql.VarChar(23), toSqlDateTime2Local(params.cursorValue));
    request.input('OverlapMinutes', sql.Int, params.overlapMinutes);
    const result = await request.execute('dbo.pr_Fiorix_BI_Produtividade_Incremental');
    const durationMs = Date.now() - startTime;
    const records = result.recordset || [];
    logger.info(`SQL_SUCCESS: produtividade incremental processada em ${durationMs}ms. Registros: ${records.length}`);
    return { records, durationMs };
  } catch (err: any) {
    logger.error(`SQL_ERROR: Falha na procedure dbo.pr_Fiorix_BI_Produtividade_Incremental: ${err.message}`);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

export type TarefasIncrementalParams = {
  dataInicial?: string;
  dataFinal?: string;
  somenteAbertas?: boolean | number;
  cursorValue: string;
  overlapMinutes: number;
};

export async function executeTarefasIncrementalProcedure(params: TarefasIncrementalParams) {
  logger.info('[MSSQL] Executando procedure dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2 para fonte tarefas...');
  const startTime = Date.now();
  let pool;
  try {
    pool = await sql.connect(getSqlConfig());
    const request = pool.request();
    request.timeout = 30000;
    if (params.dataInicial) request.input('DataInicial', sql.Date, params.dataInicial);
    if (params.dataFinal) request.input('DataFinal', sql.Date, params.dataFinal);
    request.input('SomenteAbertas', sql.Bit, params.somenteAbertas ?? 0);
    request.input('CursorValue', sql.VarChar(23), toSqlDateTime2Local(params.cursorValue));
    request.input('OverlapMinutes', sql.Int, params.overlapMinutes);
    const result = await request.execute('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
    const durationMs = Date.now() - startTime;
    const records = result.recordset || [];
    logger.info(`SQL_SUCCESS: tarefas incremental v2 processada em ${durationMs}ms. Registros: ${records.length}`);
    return { records, durationMs };
  } catch (err: any) {
    logger.error(`SQL_ERROR: Falha na procedure dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2: ${err.message}`);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

export const executeTarefasIncrementalV2Procedure = executeTarefasIncrementalProcedure;

export type RetornosProcedureParams = {
  dataInicial?: string;
  dataFinal?: string;
  cursorIdAndamento?: number | string | null;
};

export async function executeRetornosProcedure(params?: RetornosProcedureParams) {
  logger.info('[MSSQL] Executando procedure dbo.pr_Fiorix_BI_Retornos para fonte retornos...');
  const startTime = Date.now();
  let pool;
  try {
    pool = await sql.connect(getSqlConfig());
    const request = pool.request();
    request.timeout = 45000;
    if (params?.dataInicial) request.input('DataInicial', sql.Date, params.dataInicial);
    if (params?.dataFinal) request.input('DataFinal', sql.Date, params.dataFinal);
    if (params?.cursorIdAndamento !== undefined && params?.cursorIdAndamento !== null) {
      request.input('CursorIdAndamento', sql.BigInt, params.cursorIdAndamento);
    }

    let result;
    try {
      result = await request.execute('dbo.pr_Fiorix_BI_Retornos');
    } catch (execErr: any) {
      // Fallback transparente se a procedure no banco ainda não tiver o parâmetro @CursorIdAndamento
      if (params?.cursorIdAndamento !== undefined && params?.cursorIdAndamento !== null &&
          (execErr.number === 8145 || execErr.message?.includes('not a parameter') || execErr.message?.includes('too many arguments') || execErr.message?.includes('muitos argumentos'))) {
        logger.warn('[MSSQL] Procedure dbo.pr_Fiorix_BI_Retornos ainda sem parâmetro @CursorIdAndamento. Executando fallback sem parâmetro (filtragem em memória)...');
        const fallbackReq = pool.request();
        fallbackReq.timeout = 45000;
        if (params?.dataInicial) fallbackReq.input('DataInicial', sql.Date, params.dataInicial);
        if (params?.dataFinal) fallbackReq.input('DataFinal', sql.Date, params.dataFinal);
        result = await fallbackReq.execute('dbo.pr_Fiorix_BI_Retornos');
      } else {
        throw execErr;
      }
    }

    const durationMs = Date.now() - startTime;
    const records = result.recordset || [];
    logger.info(`SQL_SUCCESS: retornos processada em ${durationMs}ms. Registros: ${records.length}`);
    return { records, durationMs };
  } catch (err: any) {
    logger.error(`SQL_ERROR: Falha na procedure dbo.pr_Fiorix_BI_Retornos: ${err.message}`);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

export type ImpressoesProcedureParams = {
  dataInicial?: string;
  dataFinal?: string;
  cursorIdAndamento?: number | string | null;
};

export async function executeImpressoesProcedure(params?: ImpressoesProcedureParams) {
  logger.info('[MSSQL] Executando procedure dbo.pr_Fiorix_BI_Impressoes para fonte impressoes...');
  const startTime = Date.now();
  let pool;
  try {
    pool = await sql.connect(getSqlConfig());
    const request = pool.request();
    request.timeout = 45000;
    if (params?.dataInicial) request.input('DataInicial', sql.Date, params.dataInicial);
    if (params?.dataFinal) request.input('DataFinal', sql.Date, params.dataFinal);
    if (params?.cursorIdAndamento !== undefined && params?.cursorIdAndamento !== null) {
      request.input('CursorIdAndamento', sql.BigInt, params.cursorIdAndamento);
    }

    let result;
    try {
      result = await request.execute('dbo.pr_Fiorix_BI_Impressoes');
    } catch (execErr: any) {
      if (params?.cursorIdAndamento !== undefined && params?.cursorIdAndamento !== null &&
          (execErr.number === 8145 || execErr.message?.includes('not a parameter') || execErr.message?.includes('too many arguments') || execErr.message?.includes('muitos argumentos'))) {
        logger.warn('[MSSQL] Procedure dbo.pr_Fiorix_BI_Impressoes ainda sem parâmetro @CursorIdAndamento. Executando fallback sem parâmetro...');
        const fallbackReq = pool.request();
        fallbackReq.timeout = 45000;
        if (params?.dataInicial) fallbackReq.input('DataInicial', sql.Date, params.dataInicial);
        if (params?.dataFinal) fallbackReq.input('DataFinal', sql.Date, params.dataFinal);
        result = await fallbackReq.execute('dbo.pr_Fiorix_BI_Impressoes');
      } else {
        throw execErr;
      }
    }

    const durationMs = Date.now() - startTime;
    const records = result.recordset || [];
    logger.info(`SQL_SUCCESS: impressoes processada em ${durationMs}ms. Registros: ${records.length}`);
    return { records, durationMs };
  } catch (err: any) {
    logger.error(`SQL_ERROR: Falha na procedure dbo.pr_Fiorix_BI_Impressoes: ${err.message}`);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

export async function executeTarefasIncrementalV1FallbackProcedure(params: TarefasIncrementalParams) {
  logger.warn('[MSSQL] Executando procedure fallback dbo.pr_Fiorix_BI_TAREFAS_Incremental para fonte tarefas...');
  const startTime = Date.now();
  let pool;
  try {
    pool = await sql.connect(getSqlConfig());
    const request = pool.request();
    request.timeout = 30000;
    if (params.dataInicial) request.input('DataInicial', sql.Date, params.dataInicial);
    if (params.dataFinal) request.input('DataFinal', sql.Date, params.dataFinal);
    request.input('SomenteAbertas', sql.Bit, params.somenteAbertas ?? 1);
    request.input('CursorValue', sql.VarChar(23), toSqlDateTime2Local(params.cursorValue));
    request.input('OverlapMinutes', sql.Int, params.overlapMinutes);
    const result = await request.execute('dbo.pr_Fiorix_BI_TAREFAS_Incremental');
    const durationMs = Date.now() - startTime;
    const records = result.recordset || [];
    logger.info(`SQL_SUCCESS: tarefas incremental v1 fallback processada em ${durationMs}ms. Registros: ${records.length}`);
    return { records, durationMs };
  } catch (err: any) {
    logger.error(`SQL_ERROR: Falha na procedure fallback dbo.pr_Fiorix_BI_TAREFAS_Incremental: ${err.message}`);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

export async function resetSqlServerPool(): Promise<boolean> {
  logger.info('[MSSQL] Executando reconexão matinal: recriando e validando pool de conexão com SQL Server (WEBRI)...');
  let pool;
  try {
    try {
      if (typeof (sql as any).close === 'function') {
        await (sql as any).close();
      }
    } catch {
      // Ignora erro se não houver pool global conectado
    }

    pool = await sql.connect(getSqlConfig());
    const request = pool.request();
    (request as any).timeout = 15000;
    const result = await request.query('SELECT 1 AS ping, DB_NAME() AS db');
    const dbName = result.recordset?.[0]?.db || env.SQL_SERVER_DATABASE;
    
    healthManager.recordDbQuerySuccess();
    logger.info(`[MSSQL] Pool de conexão do SQL Server (${dbName}) recriado e testado com sucesso.`);
    return true;
  } catch (err: any) {
    healthManager.recordDbFailure();
    logger.error(`[MSSQL] Erro ao recriar pool de conexão SQL Server (WEBRI): ${err.message}`);
    return false;
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch {
        // Ignora erro no fechamento
      }
    }
  }
}

export async function executeColaboradoresRhQuery(): Promise<{
  records: any[];
  durationMs: number;
  skippedNoPermission?: boolean;
}> {
  logger.info('[MSSQL] Consultando cadastro oficial de colaboradores (GESTOR / pr_Fiorix_RH_Colaboradores)...');
  const startTime = Date.now();
  let pool;
  try {
    pool = await sql.connect(getSqlConfig());
    const probeReq = pool.request();
    (probeReq as any).timeout = 15000;
    const probe = await probeReq.query(`
      SELECT
        OBJECT_ID('dbo.pr_Fiorix_RH_Colaboradores', 'P') AS procId,
        HAS_DBACCESS('GESTOR') AS canGestor
    `);
    const row = probe.recordset?.[0] || {};

    if (row.procId != null) {
      const execReq = pool.request();
      (execReq as any).timeout = 45000;
      const result = await execReq.execute('dbo.pr_Fiorix_RH_Colaboradores');
      const durationMs = Date.now() - startTime;
      const records = result.recordset || [];
      logger.info(`SQL_SUCCESS: colaboradores_rh via procedure processada em ${durationMs}ms. Registros: ${records.length}`);
      return { records, durationMs };
    }

    if (row.canGestor === 1) {
      // Caso fiorix_connector já possua leitura em GESTOR mesmo sem a procedure criada
      const directReq = pool.request();
      (directReq as any).timeout = 45000;
      const directResult = await directReq.query(`
        DECLARE @ColRegistro SYSNAME, @ColNome SYSNAME, @ColApelido SYSNAME, @ColCpf SYSNAME,
                @ColDataNasc SYSNAME, @ColDataAdm SYSNAME, @ColAtivo SYSNAME,
                @ColFkSexo SYSNAME, @ColFkEstCivil SYSNAME, @ColFkCidade SYSNAME, @ColFkNac SYSNAME;

        SELECT TOP 1 @ColRegistro = c.name FROM GESTOR.sys.columns c
        WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
          AND (c.name IN (N'Registro', N'PK_Colaborador', N'PK_Id', N'IdColaborador', N'ID', N'Codigo') OR c.is_identity = 1)
        ORDER BY CASE c.name WHEN N'Registro' THEN 1 WHEN N'PK_Colaborador' THEN 2 WHEN N'PK_Id' THEN 3 ELSE 4 END;

        SELECT TOP 1 @ColNome = c.name FROM GESTOR.sys.columns c
        WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
          AND c.name IN (N'NomeCompleto', N'Nome', N'Colaborador');

        SELECT TOP 1 @ColApelido = c.name FROM GESTOR.sys.columns c
        WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador')
          AND (c.name IN (N'ConhecidoComo', N'Apelido') OR c.name LIKE N'%Conhecido%');

        SELECT TOP 1 @ColCpf = c.name FROM GESTOR.sys.columns c
        WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador') AND c.name LIKE N'%CPF%';

        SELECT TOP 1 @ColDataNasc = c.name FROM GESTOR.sys.columns c
        WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador') AND c.name LIKE N'DataNasc%';

        SELECT TOP 1 @ColDataAdm = c.name FROM GESTOR.sys.columns c
        WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador') AND c.name LIKE N'%Admiss%';

        SELECT TOP 1 @ColAtivo = c.name FROM GESTOR.sys.columns c
        WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador') AND c.name IN (N'Ativo', N'FlagAtivo');

        SELECT TOP 1 @ColFkSexo = c.name FROM GESTOR.sys.columns c
        WHERE c.object_id = OBJECT_ID(N'GESTOR.dbo.tblColaborador') AND c.name LIKE N'%Sexo%';

        DECLARE @SqlQ NVARCHAR(MAX) = N'SELECT ' +
          CASE WHEN @ColRegistro IS NOT NULL THEN N'CAST(c.' + QUOTENAME(@ColRegistro) + N' AS INT)' ELSE N'ROW_NUMBER() OVER (ORDER BY (SELECT NULL))' END + N' AS Registro, ' +
          CASE WHEN @ColNome IS NOT NULL THEN N'LTRIM(RTRIM(CAST(c.' + QUOTENAME(@ColNome) + N' AS NVARCHAR(200))))' ELSE N'NULL' END + N' AS Nome, ' +
          CASE WHEN @ColApelido IS NOT NULL THEN N'NULLIF(LTRIM(RTRIM(CAST(c.' + QUOTENAME(@ColApelido) + N' AS NVARCHAR(120)))), '''')' ELSE N'NULL' END + N' AS Apelido, ' +
          CASE WHEN @ColCpf IS NOT NULL THEN N'NULLIF(LTRIM(RTRIM(CAST(c.' + QUOTENAME(@ColCpf) + N' AS VARCHAR(30)))), '''')' ELSE N'NULL' END + N' AS CPF, ' +
          CASE WHEN @ColDataNasc IS NOT NULL THEN N'CONVERT(VARCHAR(10), TRY_CAST(c.' + QUOTENAME(@ColDataNasc) + N' AS DATE), 23)' ELSE N'NULL' END + N' AS DataNascimento, ' +
          CASE WHEN @ColDataAdm IS NOT NULL THEN N'CONVERT(VARCHAR(10), TRY_CAST(c.' + QUOTENAME(@ColDataAdm) + N' AS DATE), 23)' ELSE N'NULL' END + N' AS DataAdmissao, ' +
          CASE WHEN @ColFkSexo IS NOT NULL THEN N'CASE CAST(c.' + QUOTENAME(@ColFkSexo) + N' AS VARCHAR(10)) WHEN ''1'' THEN ''Masculino'' WHEN ''2'' THEN ''Feminino'' ELSE NULL END' ELSE N'NULL' END + N' AS Sexo, ' +
          CASE WHEN @ColAtivo IS NOT NULL THEN N'CAST(CASE WHEN c.' + QUOTENAME(@ColAtivo) + N' IN (1, ''1'', ''S'', ''A'') THEN 1 ELSE 0 END AS BIT)' ELSE N'CAST(1 AS BIT)' END + N' AS Ativo ' +
          N'FROM GESTOR.dbo.tblColaborador c WITH (NOLOCK)';

        EXEC sp_executesql @SqlQ;
      `);
      const durationMs = Date.now() - startTime;
      const records = directResult.recordset || [];
      logger.info(`SQL_SUCCESS: colaboradores_rh via leitura direta GESTOR em ${durationMs}ms. Registros: ${records.length}`);
      return { records, durationMs };
    }

    const durationMs = Date.now() - startTime;
    logger.info('[MSSQL] Banco GESTOR / dbo.pr_Fiorix_RH_Colaboradores aguardando GRANT SELECT no SQL Server (veja sql/pr_Fiorix_RH_Colaboradores.sql). Ciclo ignorado sem falha.');
    return { records: [], durationMs, skippedNoPermission: true };
  } catch (err: any) {
    logger.error(`SQL_ERROR: Falha na consulta de colaboradores_rh: ${err.message}`);
    throw err;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}


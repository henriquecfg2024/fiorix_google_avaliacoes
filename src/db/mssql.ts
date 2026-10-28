import sql from 'mssql';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { toSqlDateTime2Local } from '../utils/sqlDateTime.js';
import { healthManager } from '../services/health.js';

const sqlConfig: sql.config = {
  user: env.SQL_SERVER_USER,
  password: env.SQL_SERVER_PASSWORD,
  database: env.SQL_SERVER_DATABASE,
  server: env.SQL_SERVER_HOST,
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

export async function executeProcedure(sourceName: string, procedureName: string) {
  logger.info(`[MSSQL] Executando procedure ${procedureName} para fonte ${sourceName}...`);
  const startTime = Date.now();
  
  let pool;
  try {
    pool = await sql.connect(sqlConfig);
    
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
    pool = await sql.connect(sqlConfig);
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
    pool = await sql.connect(sqlConfig);
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
    pool = await sql.connect(sqlConfig);
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
    pool = await sql.connect(sqlConfig);
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
    pool = await sql.connect(sqlConfig);
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
    pool = await sql.connect(sqlConfig);
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
    pool = await sql.connect(sqlConfig);
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

    pool = await sql.connect(sqlConfig);
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




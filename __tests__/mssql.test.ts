import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sql from 'mssql';
import { 
  executeBiIncrementalProcedure, 
  executeBiIncrementalV2Procedure,
  executeProcedure, 
  executeProdutividadeIncrementalProcedure,
  executeTarefasIncrementalProcedure,
  executeTarefasIncrementalV1FallbackProcedure,
  executeTarefasIncrementalV2Procedure,
  resetSqlServerPool
} from '../src/db/mssql.js';


vi.mock('mssql');
const mockedSql = vi.mocked(sql);

describe('MSSQL Service', () => {
  let mockRequest: any;
  let mockPool: any;

  beforeEach(() => {
    mockRequest = {
      input: vi.fn().mockReturnThis(),
      execute: vi.fn(),
      timeout: 0
    };

    mockPool = {
      request: vi.fn(() => mockRequest),
      close: vi.fn()
    };

    mockedSql.connect.mockResolvedValue(mockPool as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. SQL Conecta e procedure retorna dados', async () => {
    mockRequest.execute.mockResolvedValueOnce({
      recordset: [{ id: 1 }, { id: 2 }]
    });

    const result = await executeProcedure('bi', 'dbo.pr_Fiorix_BI');
    
    expect(mockedSql.connect).toHaveBeenCalled();
    expect(mockPool.request).toHaveBeenCalled();
    expect(mockRequest.execute).toHaveBeenCalledWith('dbo.pr_Fiorix_BI');
    expect(result).toHaveLength(2);
    expect(mockPool.close).toHaveBeenCalled();
  });

  it('2. Timeout/Falha na Procedure SQL', async () => {
    mockRequest.execute.mockRejectedValueOnce(new Error('Timeout expired'));

    await expect(executeProcedure('bi', 'dbo.pr_Fiorix_BI'))
      .rejects.toThrowError('Timeout expired');
      
    // Garante que o pool.close é chamado mesmo com erro
    expect(mockPool.close).toHaveBeenCalled();
  });

  it('3. Procedure retorna vazio', async () => {
    mockRequest.execute.mockResolvedValueOnce({
      recordset: []
    });

    const result = await executeProcedure('tarefas', 'dbo.pr_Fiorix_BI_TAREFAS');
    expect(result).toHaveLength(0);
  });

  it('binds BI incremental cursor as WEBRI local datetime2 text without Date conversion', async () => {
    mockRequest.execute.mockResolvedValueOnce({
      recordset: [{ id: 1 }]
    });

    await executeBiIncrementalProcedure({
      dataInicial: '31/08/2026',
      dataFinal: '01/09/2026',
      flag: 0,
      cursorValue: '2026-08-31T00:00:00.000',
      overlapMinutes: 5,
    });

    expect(mockRequest.input).toHaveBeenCalledWith('CursorValue', mockedSql.VarChar(23), '2026-08-31 00:00:00.000');
    expect(mockRequest.input).not.toHaveBeenCalledWith('CursorValue', expect.anything(), expect.any(Date));
  });

  it('binds Produtividade incremental cursor as WEBRI local datetime2 text without Date conversion', async () => {
    mockRequest.execute.mockResolvedValueOnce({
      recordset: [{ id: 1 }]
    });

    await executeProdutividadeIncrementalProcedure({
      dataInicial: '01/09/2026',
      dataFinal: '01/09/2026',
      idCaixa: '0',
      cursorValue: '2026-09-01T12:00:00.000',
      overlapMinutes: 5,
    });

    expect(mockRequest.input).toHaveBeenCalledWith('CursorValue', mockedSql.VarChar(23), '2026-09-01 12:00:00.000');
    expect(mockRequest.input).not.toHaveBeenCalledWith('CursorValue', expect.anything(), expect.any(Date));
  });

  it('binds Tarefas incremental cursor as WEBRI local datetime2 text and calls v2 by default', async () => {
    mockRequest.execute.mockResolvedValueOnce({
      recordset: [{ id: 1 }]
    });

    await executeTarefasIncrementalProcedure({
      dataInicial: '2026-09-01',
      dataFinal: '2026-09-08',
      somenteAbertas: 1,
      cursorValue: '2026-09-01T12:00:00.000',
      overlapMinutes: 5,
    });

    expect(mockRequest.input).toHaveBeenCalledWith('CursorValue', mockedSql.VarChar(23), '2026-09-01 12:00:00.000');
    expect(mockRequest.input).not.toHaveBeenCalledWith('CursorValue', expect.anything(), expect.any(Date));
    expect(mockRequest.execute).toHaveBeenCalledWith('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
  });

  it('executes Tarefas incremental v1 fallback explicitly when called', async () => {
    mockRequest.execute.mockResolvedValueOnce({
      recordset: [{ id: 1 }]
    });

    await executeTarefasIncrementalV1FallbackProcedure({
      dataInicial: '2026-09-01',
      dataFinal: '2026-09-08',
      somenteAbertas: 1,
      cursorValue: '2026-09-01T12:00:00.000',
      overlapMinutes: 5,
    });

    expect(mockRequest.execute).toHaveBeenCalledWith('dbo.pr_Fiorix_BI_TAREFAS_Incremental');
  });

  it('fails cleanly without silent fallback to v1 when v2 throws', async () => {
    mockRequest.execute.mockRejectedValueOnce(new Error('V2 procedure failure'));

    await expect(executeTarefasIncrementalProcedure({
      dataInicial: '2026-09-01',
      dataFinal: '2026-09-08',
      somenteAbertas: 1,
      cursorValue: '2026-09-01T12:00:00.000',
      overlapMinutes: 5,
    })).rejects.toThrowError('V2 procedure failure');

    expect(mockRequest.execute).toHaveBeenCalledTimes(1);
    expect(mockRequest.execute).toHaveBeenCalledWith('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
    expect(mockRequest.execute).not.toHaveBeenCalledWith('dbo.pr_Fiorix_BI_TAREFAS_Incremental');
  });

  it('binds BI incremental v2 monotonic protocol parameters and calls dbo.pr_Fiorix_BI_Incremental_v2', async () => {
    mockRequest.execute.mockResolvedValueOnce({
      recordset: [{ id: 1 }]
    });

    await executeBiIncrementalV2Procedure({
      dataInicial: '01/09/2026',
      dataFinal: '01/09/2026',
      lastProtocolo: 643699,
      lastSeqTitulo: 1,
    });

    expect(mockRequest.input).toHaveBeenCalledWith('LastProtocolo', mockedSql.Int, 643699);
    expect(mockRequest.input).toHaveBeenCalledWith('LastSeqTitulo', mockedSql.Int, 1);
    expect(mockRequest.execute).toHaveBeenCalledWith('dbo.pr_Fiorix_BI_Incremental_v2');
  });

  it('resetSqlServerPool recria pool e executa query de validação no SQL Server (WEBRI)', async () => {
    mockRequest.query = vi.fn().mockResolvedValueOnce({
      recordset: [{ ping: 1, db: 'WEBRI' }]
    });

    const result = await resetSqlServerPool();
    expect(result).toBe(true);
    expect(mockedSql.connect).toHaveBeenCalled();
    expect(mockRequest.query).toHaveBeenCalledWith('SELECT 1 AS ping, DB_NAME() AS db');
    expect(mockPool.close).toHaveBeenCalled();
  });
});






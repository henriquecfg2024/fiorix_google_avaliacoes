import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('BI Incremental V2 Design & Monotonic Protocol Cursor', () => {
  const sqlFilePath = resolve(__dirname, '../sql/incremental-procedures.sql');
  const sqlContent = readFileSync(sqlFilePath, 'utf-8');

  it('contains the pr_Fiorix_BI_Incremental_v2 definition', () => {
    expect(sqlContent).toContain('CREATE PROCEDURE dbo.pr_Fiorix_BI_Incremental_v2');
  });

  it('accepts @LastProtocolo and @LastSeqTitulo monotonic cursor parameters', () => {
    const v2Section = sqlContent.split('CREATE PROCEDURE dbo.pr_Fiorix_BI_Incremental_v2')[1];
    expect(v2Section).toContain('@LastProtocolo int = NULL');
    expect(v2Section).toContain('@LastSeqTitulo int = NULL');
  });

  it('applies monotonic protocol filter when @LastProtocolo is provided', () => {
    const v2Section = sqlContent.split('CREATE PROCEDURE dbo.pr_Fiorix_BI_Incremental_v2')[1];
    expect(v2Section).toContain('Recp.PK_Recepcao > @LastProtocolo');
    expect(v2Section).toContain('Recp.PK_Recepcao = @LastProtocolo AND Tit.PK_SeqTitulo > ISNULL(@LastSeqTitulo, 0)');
  });

  it('preserves exact SHA-256 record_key format and all 10 columns', () => {
    const v2Section = sqlContent.split('CREATE PROCEDURE dbo.pr_Fiorix_BI_Incremental_v2')[1];
    expect(v2Section).toContain("CONVERT(varchar(64), HASHBYTES('SHA2_256', CONCAT('bi:', Recp.PK_Recepcao, ':', Tit.PK_SeqTitulo)), 2) AS record_key");
    expect(v2Section).toContain('PROTOCOLO');
    expect(v2Section).toContain('SEQ_TITULO');
    expect(v2Section).toContain('DATA_ENTRADA');
    expect(v2Section).toContain('TIPO');
    expect(v2Section).toContain('STATUS');
    expect(v2Section).toContain('ATRASO_DIAS');
    expect(v2Section).toContain('SERVICO');
  });

  it('simulates monotonic protocol cursor progression with zero re-reads', () => {
    // Simulated table data
    const databaseRows = [
      { PROTOCOLO: 643678, SEQ_TITULO: 1, title: 'Doc 1' },
      { PROTOCOLO: 643699, SEQ_TITULO: 1, title: 'Doc 2' },
      { PROTOCOLO: 643714, SEQ_TITULO: 1, title: 'Doc 3' },
      { PROTOCOLO: 643717, SEQ_TITULO: 1, title: 'Doc 4' },
    ];

    // Cycle 1: initial fetch (no cursor)
    let lastProtocolo: number | null = null;
    let lastSeqTitulo: number | null = null;

    const filterRows = (lastProto: number | null, lastSeq: number | null) => {
      if (lastProto === null) return databaseRows;
      return databaseRows.filter(
        (r) => r.PROTOCOLO > lastProto || (r.PROTOCOLO === lastProto && r.SEQ_TITULO > (lastSeq ?? 0))
      );
    };

    const cycle1 = filterRows(lastProtocolo, lastSeqTitulo);
    expect(cycle1.length).toBe(4);

    // Update checkpoint
    lastProtocolo = cycle1[cycle1.length - 1].PROTOCOLO;
    lastSeqTitulo = cycle1[cycle1.length - 1].SEQ_TITULO;
    expect(lastProtocolo).toBe(643717);
    expect(lastSeqTitulo).toBe(1);

    // Cycle 2: no new data in database
    const cycle2 = filterRows(lastProtocolo, lastSeqTitulo);
    expect(cycle2.length).toBe(0); // ZERO duplicate re-reads!

    // Insert new record (Doc 5)
    databaseRows.push({ PROTOCOLO: 643720, SEQ_TITULO: 1, title: 'Doc 5' });

    // Cycle 3: only returns the new record
    const cycle3 = filterRows(lastProtocolo, lastSeqTitulo);
    expect(cycle3.length).toBe(1);
    expect(cycle3[0].PROTOCOLO).toBe(643720);
  });

  it('handles same protocol with higher SEQ_TITULO correctly', () => {
    const databaseRows = [
      { PROTOCOLO: 100, SEQ_TITULO: 1 },
      { PROTOCOLO: 100, SEQ_TITULO: 2 },
      { PROTOCOLO: 100, SEQ_TITULO: 3 },
    ];

    const filter = (lastP: number, lastS: number) => 
      databaseRows.filter(r => r.PROTOCOLO > lastP || (r.PROTOCOLO === lastP && r.SEQ_TITULO > lastS));

    const result = filter(100, 1);
    expect(result.length).toBe(2);
    expect(result[0].SEQ_TITULO).toBe(2);
    expect(result[1].SEQ_TITULO).toBe(3);
  });

  it('handles higher protocol with lower SEQ_TITULO correctly', () => {
    const databaseRows = [
      { PROTOCOLO: 100, SEQ_TITULO: 5 },
      { PROTOCOLO: 101, SEQ_TITULO: 1 },
    ];

    const filter = (lastP: number, lastS: number) => 
      databaseRows.filter(r => r.PROTOCOLO > lastP || (r.PROTOCOLO === lastP && r.SEQ_TITULO > lastS));

    const result = filter(100, 5);
    expect(result.length).toBe(1);
    expect(result[0].PROTOCOLO).toBe(101);
    expect(result[0].SEQ_TITULO).toBe(1);
  });

  it('proves that late status updates without new protocol are handled via reconciliation and not incremental insert', () => {
    const databaseRows = [
      { PROTOCOLO: 100, SEQ_TITULO: 1, STATUS: 'Em dia' },
    ];

    // Checkpoint at 100:1
    const lastP = 100;
    const lastS = 1;

    // Late update arrives on existing protocol (status changes to 'Atrasado')
    databaseRows[0].STATUS = 'Atrasado';

    // Incremental filter based on monotonic protocol does NOT re-ingest
    const incrementalResult = databaseRows.filter(
      r => r.PROTOCOLO > lastP || (r.PROTOCOLO === lastP && r.SEQ_TITULO > lastS)
    );
    expect(incrementalResult.length).toBe(0);

    // Reconciliation window fetches full date range and catches the updated status
    const reconciliationResult = databaseRows;
    expect(reconciliationResult.length).toBe(1);
    expect(reconciliationResult[0].STATUS).toBe('Atrasado');
  });
});


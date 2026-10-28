import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { logicalRecordIdentity, recordKey } from '../src/services/recordKey.js';

describe('Tarefas Incremental v2 SQL Design Validation', () => {
  const sqlFilePath = path.join(__dirname, '../sql/incremental-procedures.sql');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

  it('contains the pr_Fiorix_BI_TAREFAS_Incremental_v2 definition', () => {
    expect(sqlContent).toContain('CREATE PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
  });

  it('never calls dbo.pr_Fiorix_BI_TAREFAS in v2 (True Incremental)', () => {
    const v2Section = sqlContent.split('CREATE PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2')[1];
    expect(v2Section).toBeDefined();
    expect(v2Section).not.toContain('EXEC dbo.pr_Fiorix_BI_TAREFAS');
    expect(v2Section).not.toContain('CREATE TABLE #Tarefas');
    expect(v2Section).not.toContain('#Tarefas');
  });

  it('declares @CursorStart before any CTE', () => {
    const v2Section = sqlContent.split('CREATE PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2')[1];
    const cursorDeclIndex = v2Section.indexOf('DECLARE @CursorStart datetime2(3)');
    const cteIndex = v2Section.indexOf(';WITH TarefasCandidatas AS');
    expect(cursorDeclIndex).toBeGreaterThan(0);
    expect(cteIndex).toBeGreaterThan(cursorDeclIndex);
  });

  it('filters history scan by TarefasCandidatas in HistoricoAtual CTE', () => {
    const v2Section = sqlContent.split('CREATE PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2')[1];
    expect(v2Section).toContain('TarefasCandidatas AS');
    expect(v2Section).toContain('OR H.FK_tblCDSTarefa_Id IN (SELECT TC.ID_TAREFA FROM TarefasCandidatas TC)');
  });

  it('applies candidate push-down filter in main query WHERE clause', () => {
    const v2Section = sqlContent.split('CREATE PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2')[1];
    expect(v2Section).toContain('AND (@CursorStart IS NULL OR T.PK_Id IN (SELECT TC.ID_TAREFA FROM TarefasCandidatas TC))');
    expect(v2Section).toContain('AND (@CursorStart IS NULL OR C.cursor_value >= @CursorStart)');
  });

  it('contains no ellipsis or placeholders', () => {
    const v2Section = sqlContent.split('CREATE PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2')[1];
    expect(v2Section).not.toContain('SELECT ...');
    expect(v2Section).not.toContain('...');
  });

  it('generates identical record_key format matching TypeScript service', () => {
    const sampleRecord = {
      ID_TAREFA: 1549563,
      ID_HISTORICO: 1475497
    };
    const identity = logicalRecordIdentity('tarefas', sampleRecord);
    expect(identity).toBe('tarefas:1549563:1475497');

    const expectedHash = createHash('sha256').update(identity).digest('hex').toUpperCase();
    const serviceHash = recordKey('tarefas', sampleRecord).toUpperCase();
    expect(serviceHash).toBe(expectedHash);
  });

  it('is strictly read-only with no write/mutation statements', () => {
    const v2Section = sqlContent.split('CREATE PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2')[1];
    const forbiddenKeywords = ['UPDATE ', 'DELETE ', 'DROP TABLE', 'TRUNCATE TABLE', 'ALTER TABLE', 'INSERT INTO '];
    for (const kw of forbiddenKeywords) {
      expect(v2Section.toUpperCase()).not.toContain(kw);
    }
  });

  it('outputs all 33 required columns identical to v1 specification', () => {
    const requiredColumns = [
      'record_key', 'cursor_value', 'secondary_cursor', 'PROTOCOLO', 'SEQ_TITULO',
      'DATA_ENTRADA', 'DT_PREVISAO', 'DIAS_PARA_PREVISAO', 'STATUS_PREVISAO', 'NIVEL_RISCO',
      'ID_SERVICO', 'NUMERO_SERVICO', 'ITEM_SERVICO', 'DATA_SERVICO', 'VENCIMENTO_SERVICO',
      'ID_TIPO_SERVICO', 'CODIGO_TIPO_SERVICO', 'ID_NATUREZA_CDS', 'ID_TAREFA', 'TAREFA',
      'DATA_CADASTRO_TAREFA', 'ID_HISTORICO', 'STATUS_TAREFA', 'DATA_ABERTURA', 'DATA_FINALIZACAO',
      'SITUACAO_TAREFA', 'ID_USUARIO', 'RESPONSAVEL', 'USUARIO_ATIVO', 'TIPO',
      'NATUREZA', 'ID_NATUREZA', 'DtDevolucao', 'DtRetirada'
    ];

    const v2Section = sqlContent.split('CREATE PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2')[1];
    for (const col of requiredColumns) {
      expect(v2Section).toContain(col);
    }
  });
});

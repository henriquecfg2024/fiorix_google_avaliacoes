import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitCheckpointForBatch, getCheckpoint, initializeCheckpointSchema, markReconciliationSuccess, stageCheckpointCandidate } from '../src/db/checkpoint.js';
import { attachRecordKey, recordKey } from '../src/services/recordKey.js';
import { bootstrapMode, reconciliationWindow, requiresReconciliation } from '../src/services/reconciliation.js';

describe('hybrid incremental architecture', () => {
  it('persists checkpoints across restart and isolates every source', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fiorix-checkpoint-'));
    const filename = join(directory, 'queue.db');
    const db = new DatabaseSync(filename);
    initializeCheckpointSchema(db);
    for (const source of ['bi', 'produtividade', 'metas', 'tarefas']) {
      stageCheckpointCandidate(db, { batchId: `${source}-1`, source, cursorValue: `2026-09-01T10:0${source.length}:00.000Z` });
    }
    commitCheckpointForBatch(db, 'bi-1');
    expect(getCheckpoint(db, 'bi')).toMatchObject({ last_batch_id: 'bi-1' });
    expect(getCheckpoint(db, 'metas')).toBeNull();
    db.close();
    const reopened = new DatabaseSync(filename);
    expect(getCheckpoint(reopened, 'bi')).toMatchObject({ cursor_value: expect.any(String), last_batch_id: 'bi-1' });
    reopened.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('keeps prepared WEBRI procedures read-only and does not apply them', () => {
    const sql = readFileSync(new URL('../sql/incremental-procedures.sql', import.meta.url), 'utf8');
    expect(sql).not.toMatch(/\b(?:UPDATE|DELETE|MERGE)\s+dbo\./i);
    expect(sql).not.toMatch(/\bINSERT\s+INTO\s+dbo\./i);
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE)\b/i);
    expect(sql).toContain('EXEC dbo.pr_Fiorix_BI_TAREFAS');
    expect(sql).not.toMatch(/CREATE PROCEDURE dbo\.pr_Fiorix_BI_METAS_Incremental/i);
    expect(sql).toContain('reconciliation_required');
  });

  it('keeps both SaaS migrations additive and guarantees updatedAt on every raw upsert', () => {
    const syncModeUrl = new URL('../../fiorix/supabase/migrations/20260901000000_add_connector_sync_mode.sql', import.meta.url);
    const recordsUrl = new URL('../../fiorix/supabase/migrations/20260901010000_add_connector_sync_records.sql', import.meta.url);
    const routeUrl = new URL('../../fiorix/src/app/api/v1/connector/sync/route.ts', import.meta.url);
    if (!existsSync(syncModeUrl) || !existsSync(recordsUrl) || !existsSync(routeUrl)) {
      // Standalone connector CI checkout does not contain the sibling fiorix SaaS repo.
      return;
    }
    const syncMode = readFileSync(syncModeUrl, 'utf8');
    const records = readFileSync(recordsUrl, 'utf8');
    for (const migration of [syncMode, records]) {
      expect(migration).not.toMatch(/\b(?:DROP\s+(?:TABLE|COLUMN|INDEX|CONSTRAINT)|DELETE\s+FROM|TRUNCATE\s+TABLE|RENAME\s+(?:TABLE|COLUMN))\b/i);
    }
    expect(syncMode).toMatch(/"syncMode" TEXT NOT NULL DEFAULT 'full'/g);
    expect(records).toContain('"updatedAt" TIMESTAMP(3) NOT NULL');
    expect(records).toContain('PRIMARY KEY ("tenantId", "connectorId", "source", "recordKey")');
    const route = readFileSync(routeUrl, 'utf8');
    expect(route).toMatch(/"updatedAt"\s*\)\s*SELECT[\s\S]*NOW\(\), NOW\(\)/);
    expect(route).toMatch(/DO UPDATE SET[\s\S]*"updatedAt" = NOW\(\)/);
  });

  it('does not advance on SQL, HTTP or partial failures because an unconfirmed candidate is inert', () => {
    const db = new DatabaseSync(':memory:');
    stageCheckpointCandidate(db, { batchId: 'failed', source: 'tarefas', cursorValue: '2026-09-01T12:00:00.000Z' });
    expect(getCheckpoint(db, 'tarefas')).toBeNull();
  });

  it('generates deterministic keys and replaces the same logical identity', () => {
    const before = { PROTOCOLO: 10, SEQ_TITULO: 2, STATUS: 'Em dia' };
    const after = { ...before, STATUS: 'Atrasado' };
    expect(recordKey('bi', before)).toBe(recordKey('bi', after));
    expect(attachRecordKey('bi', before).record_key).toHaveLength(64);
  });

  it('uses real stable identities for produtividade, metas and tarefas', () => {
    expect(recordKey('produtividade', { CURSOR_VALUE: '2026-09-01T10:00:00', NumeroDocumento: 1, FlagDocumento: 2, FK_tblWRIHistorico_Id: 3 }))
      .toBe(recordKey('produtividade', { CURSOR_VALUE: '2026-09-01T10:00:00', NumeroDocumento: 1, FlagDocumento: 2, FK_tblWRIHistorico_Id: 3, nome: 'changed' }));
    expect(recordKey('metas', { PROTOCOLO: 9 })).toBe(recordKey('metas', { PROTOCOLO: 9, STATUS_META: 'changed' }));
    expect(recordKey('tarefas', { ID_TAREFA: 8, ID_HISTORICO: 7 })).toBe(recordKey('tarefas', { ID_TAREFA: 8, ID_HISTORICO: 7, STATUS_TAREFA: 2 }));
  });

  it('supports controlled bootstrap and seven-day reconciliation without scheduling it', () => {
    expect(bootstrapMode(null)).toBe('bootstrap');
    expect(requiresReconciliation('produtividade')).toBe(true);
    expect(reconciliationWindow(new Date('2026-09-01T12:00:00.000Z'), 7)).toEqual({ start: '2026-08-25T12:00:00.000Z', end: '2026-09-01T12:00:00.000Z' });
    const db = new DatabaseSync(':memory:');
    markReconciliationSuccess(db, 'metas', '2026-09-01T12:00:00.000Z');
    expect(getCheckpoint(db, 'metas')?.last_reconciliation_at).toBe('2026-09-01T12:00:00.000Z');
  });
});

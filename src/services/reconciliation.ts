import type { SyncCheckpoint } from '../db/checkpoint.js';

export type SyncMode = 'full' | 'incremental' | 'reconciliation';

export function bootstrapMode(checkpoint: SyncCheckpoint | null): 'bootstrap' | 'incremental' {
  return checkpoint?.cursor_value ? 'incremental' : 'bootstrap';
}

export function reconciliationWindow(now: Date, lookbackDays: number) {
  if (!Number.isInteger(lookbackDays) || lookbackDays <= 0) throw new Error('INVALID_RECONCILIATION_LOOKBACK');
  return {
    start: new Date(now.getTime() - lookbackDays * 86_400_000).toISOString(),
    end: now.toISOString(),
  };
}

export function requiresReconciliation(source: string): boolean {
  return ['bi', 'produtividade', 'metas', 'tarefas'].includes(source);
}

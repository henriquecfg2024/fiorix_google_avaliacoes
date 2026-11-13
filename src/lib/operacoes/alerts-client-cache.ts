'use client';

import type {
  AlertChannelConfig,
  AlertLogItem,
  WhatsAppConfig,
} from '@/lib/health/types';

export interface OperationsAlertsConfigSnapshot extends AlertChannelConfig {
  whatsappConfig?: WhatsAppConfig & {
    notifyDatabaseDegraded?: boolean;
    notifyZeroRecordsAnomalous?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
  };
}

export interface OperationsAlertsSnapshot {
  config?: OperationsAlertsConfigSnapshot | null;
  logs?: AlertLogItem[];
}

const ALERTS_CACHE_TTL_MS = 30_000;

let alertsPromise: Promise<OperationsAlertsSnapshot | null> | null = null;
let alertsFetchedAt = 0;

export function invalidateOperationsAlertsCache(): void {
  alertsPromise = null;
  alertsFetchedAt = 0;
}

export function fetchOperationsAlertsCached(
  force = false
): Promise<OperationsAlertsSnapshot | null> {
  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  const now = Date.now();

  if (!force && !isTestEnv && alertsPromise && now - alertsFetchedAt < ALERTS_CACHE_TTL_MS) {
    return alertsPromise;
  }

  alertsFetchedAt = now;
  const request = fetch('/api/v1/operacoes/alerts', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return null;
      return (await res.json()) as OperationsAlertsSnapshot;
    })
    .catch((err) => {
      alertsPromise = null;
      alertsFetchedAt = 0;
      throw err;
    });

  if (!isTestEnv) {
    alertsPromise = request;
  }
  return request;
}

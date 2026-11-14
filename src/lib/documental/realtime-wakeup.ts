import { createHmac } from 'node:crypto';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase';

export const REALTIME_DOCUMENT_WAKEUP_EVENT = 'job_queued';
const BROADCAST_COALESCE_WINDOW_MS = 200;
const BROADCAST_TIMEOUT_MS = 1500;

const lastBroadcastByTenant = new Map<string, number>();

export function __resetRealtimeWakeupForTests(): void {
  lastBroadcastByTenant.clear();
}

export function isRealtimeDocumentalWakeupEnabled(): boolean {
  const raw = process.env.USE_REALTIME_DOCUMENTAL_WAKEUP;
  if (raw === undefined || raw === null || raw.trim() === '') return true;
  const normalized = raw.trim().toLowerCase();
  return !['false', '0', 'off', 'no'].includes(normalized);
}

function getWakeupDerivationSecret(): string {
  const candidates = [
    process.env.REALTIME_WAKEUP_HMAC_SECRET,
    process.env.CONNECTOR_SECRET_ENCRYPTION_KEY,
    process.env.AUTH_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return 'fiorix-documental-wakeup-default-salt';
}

export function deriveTenantDocumentWakeupTopic(tenantId: string): string {
  const digest = createHmac('sha256', getWakeupDerivationSecret())
    .update(`document-wakeup:${tenantId}`)
    .digest('hex')
    .slice(0, 32);
  return `connector_doc_wake_${digest}`;
}

export interface RealtimeWakeupDirective {
  enabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  channelTopic: string;
  event: string;
}

export function getRealtimeWakeupDirective(
  tenantId: string,
  isActive: boolean,
): RealtimeWakeupDirective | null {
  if (!isActive || !tenantId || !isRealtimeDocumentalWakeupEnabled()) {
    return null;
  }

  try {
    const supabaseUrl = getSupabaseUrl().trim().replace(/\/$/, '');
    const supabaseAnonKey = getSupabaseAnonKey().trim();
    if (!supabaseUrl || !supabaseAnonKey || !/^https?:\/\//i.test(supabaseUrl)) {
      return null;
    }

    return {
      enabled: true,
      supabaseUrl,
      supabaseAnonKey,
      channelTopic: deriveTenantDocumentWakeupTopic(tenantId),
      event: REALTIME_DOCUMENT_WAKEUP_EVENT,
    };
  } catch {
    return null;
  }
}

export async function notifyConnectorJobQueued(tenantId: string): Promise<boolean> {
  if (!tenantId || !isRealtimeDocumentalWakeupEnabled()) {
    return false;
  }

  let supabaseUrl = '';
  let anonKey = '';
  try {
    supabaseUrl = getSupabaseUrl().trim().replace(/\/$/, '');
    anonKey = getSupabaseAnonKey().trim();
  } catch {
    return false;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const apiKey = serviceRoleKey || anonKey;
  if (!supabaseUrl || !apiKey || !/^https?:\/\//i.test(supabaseUrl)) {
    return false;
  }

  const now = Date.now();
  const lastSent = lastBroadcastByTenant.get(tenantId) ?? 0;
  if (now - lastSent < BROADCAST_COALESCE_WINDOW_MS) {
    return false;
  }
  lastBroadcastByTenant.set(tenantId, now);

  const topic = deriveTenantDocumentWakeupTopic(tenantId);
  try {
    const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic,
            event: REALTIME_DOCUMENT_WAKEUP_EVENT,
            payload: { ts: now },
            private: false,
          },
        ],
      }),
      signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => {});
    return response.ok;
  } catch {
    return false;
  }
}


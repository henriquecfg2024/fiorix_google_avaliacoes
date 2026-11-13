import { BoundedTtlMap } from '@/lib/security/bounded-ttl-map';

export const IMPRESSOES_CACHE_TTL_MS = 60_000;
export const IMPRESSOES_CACHE_MAX_ENTRIES = 32;

export const impressoesTenantCache = new BoundedTtlMap<string, unknown>(
  IMPRESSOES_CACHE_MAX_ENTRIES,
  IMPRESSOES_CACHE_TTL_MS
);

export function buildImpressoesCacheKey(
  tenantId: string,
  params: Record<string, string | number | boolean>
): string {
  return `${tenantId}::${JSON.stringify(params)}`;
}

export function invalidateImpressoesTenantCache(tenantId?: string): void {
  if (!tenantId) {
    impressoesTenantCache.clear();
    return;
  }
  impressoesTenantCache.deleteWhere((key) => key.startsWith(`${tenantId}::`));
}

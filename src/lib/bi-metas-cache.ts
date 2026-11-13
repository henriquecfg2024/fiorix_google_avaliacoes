import { BoundedTtlMap } from '@/lib/security/bounded-ttl-map';

export const METAS_CACHE_TTL_MS = 300_000;
export const METAS_CACHE_MAX_ENTRIES = 32;

export const metasTenantCache = new BoundedTtlMap<
  string,
  Record<string, unknown>[]
>(METAS_CACHE_MAX_ENTRIES, METAS_CACHE_TTL_MS);

export function buildMetasCacheKey(
  tenantId: string,
  dataInicio?: string | null,
  dataFim?: string | null
): string {
  return `${tenantId}::${dataInicio || 'all'}::${dataFim || 'all'}`;
}

export function invalidateMetasTenantCache(tenantId?: string): void {
  if (!tenantId) {
    metasTenantCache.clear();
    return;
  }
  metasTenantCache.delete(tenantId);
  metasTenantCache.deleteWhere((key) => key.startsWith(`${tenantId}::`));
}

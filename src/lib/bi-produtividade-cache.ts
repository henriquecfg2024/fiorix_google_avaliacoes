import { BoundedTtlMap } from '@/lib/security/bounded-ttl-map';

export const PRODUTIVIDADE_CACHE_TTL_MS = 60_000;
export const PRODUTIVIDADE_CACHE_MAX_TENANTS = 32;

export const produtividadeTenantCache = new BoundedTtlMap<
  string,
  Record<string, unknown>[]
>(PRODUTIVIDADE_CACHE_MAX_TENANTS, PRODUTIVIDADE_CACHE_TTL_MS);

export function buildProdutividadeCacheKey(
  tenantId: string,
  dataInicio?: string | null,
  dataFim?: string | null
): string {
  if (!dataInicio && !dataFim) {
    return tenantId;
  }
  return `${tenantId}::${dataInicio || 'all'}::${dataFim || 'all'}`;
}

export function invalidateProdutividadeTenantCache(tenantId?: string): void {
  if (!tenantId) {
    produtividadeTenantCache.clear();
    return;
  }
  produtividadeTenantCache.delete(tenantId);
  produtividadeTenantCache.deleteWhere((key) => key.startsWith(`${tenantId}::`));
}

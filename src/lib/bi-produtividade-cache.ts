import { BoundedTtlMap } from '@/lib/security/bounded-ttl-map';

export const PRODUTIVIDADE_CACHE_TTL_MS = 60_000;
export const PRODUTIVIDADE_CACHE_MAX_TENANTS = 32;

export const produtividadeTenantCache = new BoundedTtlMap<
  string,
  Record<string, unknown>[]
>(PRODUTIVIDADE_CACHE_MAX_TENANTS, PRODUTIVIDADE_CACHE_TTL_MS);

export function invalidateProdutividadeTenantCache(tenantId?: string): void {
  if (!tenantId) {
    produtividadeTenantCache.clear();
    return;
  }
  produtividadeTenantCache.delete(tenantId);
}


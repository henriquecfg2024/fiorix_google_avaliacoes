import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireTenant = vi.fn();
const mockIsRouteAllowedForUser = vi.fn();
const mockQueryRaw = vi.fn();
const mockQueryRawUnsafe = vi.fn();
const mockExecuteRawUnsafe = vi.fn();
const mockBiImportUpsert = vi.fn();
const mockBiImportUpdate = vi.fn();
const mockRefreshBiAggregates = vi.fn();
const mockCompareSecret = vi.fn();
const mockConnectorFindUnique = vi.fn();
const mockConnectorUpdate = vi.fn();
const mockBatchFindUnique = vi.fn();
const mockBatchCreate = vi.fn();
const mockBatchUpdate = vi.fn();
const mockStagingFindUnique = vi.fn();
const mockStagingCreate = vi.fn();
const mockSourceStatusUpsert = vi.fn();
const mockEvaluateSyncPermission = vi.fn();

vi.mock('@/lib/auth-helpers', () => ({
  requireTenant: (...args: unknown[]) => mockRequireTenant(...args),
}));

vi.mock('@/lib/audit', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/bi-aggregates', () => ({
  refreshBiAggregatesForImport: (...args: unknown[]) => mockRefreshBiAggregates(...args),
}));

vi.mock('@/lib/connector/ha-manager', () => ({
  evaluateConnectorSyncPermission: (...args: unknown[]) => mockEvaluateSyncPermission(...args),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: (...args: unknown[]) => mockCompareSecret(...args),
    genSalt: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock('@/lib/nav-permissions/service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/nav-permissions/service')>(
    '@/lib/nav-permissions/service'
  );
  return {
    ...actual,
    isRouteAllowedForUser: (...args: unknown[]) => mockIsRouteAllowedForUser(...args),
  };
});

vi.mock('@/lib/prisma', () => {
  type PrismaMockType = {
    $queryRaw: (...args: unknown[]) => unknown;
    $queryRawUnsafe: (...args: unknown[]) => unknown;
    $executeRawUnsafe: (...args: unknown[]) => unknown;
    fiorixBiImport: {
      upsert: (...args: unknown[]) => unknown;
      update: (...args: unknown[]) => unknown;
    };
    connector: {
      findUnique: (...args: unknown[]) => unknown;
      update: (...args: unknown[]) => unknown;
    };
    connectorSyncBatch: {
      findUnique: (...args: unknown[]) => unknown;
      create: (...args: unknown[]) => unknown;
      update: (...args: unknown[]) => unknown;
    };
    connectorSyncStaging: {
      findUnique: (...args: unknown[]) => unknown;
      create: (...args: unknown[]) => unknown;
    };
    connectorSourceStatus: {
      upsert: (...args: unknown[]) => unknown;
    };
    user: {
      findUnique: (...args: unknown[]) => unknown;
    };
    tenant: {
      findUnique: (...args: unknown[]) => unknown;
    };
    $transaction?: (cb: (tx: PrismaMockType) => Promise<unknown>) => Promise<unknown>;
  };

  const prismaMock: PrismaMockType = {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
    fiorixBiImport: {
      upsert: (...args: unknown[]) => mockBiImportUpsert(...args),
      update: (...args: unknown[]) => mockBiImportUpdate(...args),
    },
    connector: {
      findUnique: (...args: unknown[]) => mockConnectorFindUnique(...args),
      update: (...args: unknown[]) => mockConnectorUpdate(...args),
    },
    connectorSyncBatch: {
      findUnique: (...args: unknown[]) => mockBatchFindUnique(...args),
      create: (...args: unknown[]) => mockBatchCreate(...args),
      update: (...args: unknown[]) => mockBatchUpdate(...args),
    },
    connectorSyncStaging: {
      findUnique: (...args: unknown[]) => mockStagingFindUnique(...args),
      create: (...args: unknown[]) => mockStagingCreate(...args),
    },
    connectorSourceStatus: {
      upsert: (...args: unknown[]) => mockSourceStatusUpsert(...args),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  };
  prismaMock.$transaction = vi.fn((cb: (tx: PrismaMockType) => Promise<unknown>) => cb(prismaMock));
  return { prisma: prismaMock };
});

import {
  buildMetasCacheKey,
  invalidateMetasTenantCache,
  metasTenantCache,
} from '@/lib/bi-metas-cache';
import {
  buildProdutividadeCacheKey,
  invalidateProdutividadeTenantCache,
  produtividadeTenantCache,
} from '@/lib/bi-produtividade-cache';
import {
  buildImpressoesCacheKey,
  impressoesTenantCache,
  invalidateImpressoesTenantCache,
} from '@/lib/bi-impressoes-cache';
import { evaluateRouteAccessFromAllowedIds } from '@/lib/nav-permissions/evaluator';
import {
  getAllowedNavItemsForUser,
  resolveFirstAllowedRouteFromAllowedIds,
} from '@/lib/nav-permissions/service';
import { unpackLiveRecords } from '@/lib/connector/unpack-live';
import { GET as getMetasData } from '@/app/api/bi/metas/data/route';
import { GET as getControleImpressoes } from '@/app/api/controle-impressoes/route';
import { POST as postConnectorSync } from '@/app/api/v1/connector/sync/route';

describe('Fase 2 — Otimizações Estruturais Vercel (Isolamento, Cache, Navegação e Logs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    metasTenantCache.clear();
    produtividadeTenantCache.clear();
    impressoesTenantCache.clear();

    mockRequireTenant.mockResolvedValue({
      id: 'user-a',
      tenantId: 'tenant-a',
      role: 'ADMIN',
      departamento: null,
    });
    mockIsRouteAllowedForUser.mockResolvedValue(true);
    mockQueryRaw.mockResolvedValue([]);
    mockQueryRawUnsafe.mockResolvedValue([{ inserted: 1, updated: 0 }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);
    mockBiImportUpsert.mockResolvedValue({ id: 'live' });
    mockBiImportUpdate.mockResolvedValue({ id: 'live' });
    mockRefreshBiAggregates.mockResolvedValue(undefined);
    mockEvaluateSyncPermission.mockResolvedValue({ allowed: true });
    mockCompareSecret.mockResolvedValue(true);
    mockConnectorFindUnique.mockResolvedValue({
      id: 'conn-a',
      tenantId: 'tenant-a',
      enabled: true,
      credentialIdentifier: 'hash',
      tenant: { id: 'tenant-a' },
    });
    mockBatchFindUnique.mockResolvedValue(null);
    mockBatchCreate.mockResolvedValue({
      id: 'batch-row',
      chunkCount: 1,
      chunksReceived: 0,
      recordsReceived: 0,
      recordsInserted: 0,
      status: 'receiving',
      syncMode: 'full',
    });
    mockBatchUpdate.mockResolvedValue({
      id: 'batch-row',
      chunkCount: 1,
      chunksReceived: 1,
      recordsReceived: 0,
      recordsInserted: 0,
      status: 'completed',
      syncMode: 'full',
    });
    mockStagingFindUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('1. Isolamento Multi-Tenant nos Caches de BI (HIGH-08)', () => {
    it('isola chaves e invalidações entre tenant-a e tenant-b sem vazamento cruzado', () => {
      const metasKeyAAll = buildMetasCacheKey('tenant-a');
      const metasKeyARange = buildMetasCacheKey('tenant-a', '2026-10-01', '2026-10-31');
      const metasKeyB = buildMetasCacheKey('tenant-b', '2026-10-01', '2026-10-31');

      metasTenantCache.set(metasKeyAAll, [{ protocolo: 1001 }]);
      metasTenantCache.set(metasKeyARange, [{ protocolo: 1002 }]);
      metasTenantCache.set(metasKeyB, [{ protocolo: 2001 }]);

      const prodKeyA = buildProdutividadeCacheKey('tenant-a');
      const prodKeyARange = buildProdutividadeCacheKey('tenant-a', '2026-10-01', '2026-10-31');
      const prodKeyB = buildProdutividadeCacheKey('tenant-b');

      produtividadeTenantCache.set(prodKeyA, [{ pedido: 'A1' }]);
      produtividadeTenantCache.set(prodKeyARange, [{ pedido: 'A2' }]);
      produtividadeTenantCache.set(prodKeyB, [{ pedido: 'B1' }]);

      const impKeyA = buildImpressoesCacheKey('tenant-a', { visao: 'demanda', page: 1 });
      const impKeyB = buildImpressoesCacheKey('tenant-b', { visao: 'demanda', page: 1 });
      impressoesTenantCache.set(impKeyA, { totalRegistros: 10 });
      impressoesTenantCache.set(impKeyB, { totalRegistros: 20 });

      invalidateMetasTenantCache('tenant-a');
      invalidateProdutividadeTenantCache('tenant-a');
      invalidateImpressoesTenantCache('tenant-a');

      expect(metasTenantCache.get(metasKeyAAll)).toBeUndefined();
      expect(metasTenantCache.get(metasKeyARange)).toBeUndefined();
      expect(metasTenantCache.get(metasKeyB)).toEqual([{ protocolo: 2001 }]);

      expect(produtividadeTenantCache.get(prodKeyA)).toBeUndefined();
      expect(produtividadeTenantCache.get(prodKeyARange)).toBeUndefined();
      expect(produtividadeTenantCache.get(prodKeyB)).toEqual([{ pedido: 'B1' }]);

      expect(impressoesTenantCache.get(impKeyA)).toBeUndefined();
      expect(impressoesTenantCache.get(impKeyB)).toEqual({ totalRegistros: 20 });
    });
  });

  describe('2. Auth/RBAC antes do Cache e Controle de Cache Privado (HIGH-08)', () => {
    it('bloqueia usuário sem permissão em /api/bi/metas/data mesmo com cache aquecido', async () => {
      vi.stubEnv('VITEST', '');
      vi.stubEnv('NODE_ENV', 'production');

      metasTenantCache.set(buildMetasCacheKey('tenant-a'), [{ protocolo: 999 }]);
      mockIsRouteAllowedForUser.mockResolvedValueOnce(false);

      const res = await getMetasData(new Request('http://localhost/api/bi/metas/data'));
      expect(res.status).toBe(403);
      expect(mockQueryRaw).not.toHaveBeenCalled();
    });

    it('rejeita requisição não autenticada em /api/controle-impressoes antes de tocar no cache ou banco', async () => {
      vi.stubEnv('VITEST', '');
      vi.stubEnv('NODE_ENV', 'production');

      mockRequireTenant.mockRejectedValueOnce(new Error('Não autenticado'));
      const res = await getControleImpressoes(
        new NextRequest('http://localhost/api/controle-impressoes')
      );

      expect(res.status).toBe(401);
      expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
    });

    it('reutiliza cache escopado por tenant em /api/bi/metas/data com Cache-Control private e respeita ?refresh=true', async () => {
      vi.stubEnv('VITEST', '');
      vi.stubEnv('NODE_ENV', 'production');

      mockQueryRaw.mockResolvedValueOnce([
        {
          protocolo: 555,
          natureza: 'Certidão',
          data_apresentado: '2026-11-10T10:00:00Z',
        },
      ]);

      const firstRes = await getMetasData(new Request('http://localhost/api/bi/metas/data'));
      expect(firstRes.status).toBe(200);
      expect(firstRes.headers.get('cache-control')).toBe('private, no-store');
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);

      const secondRes = await getMetasData(new Request('http://localhost/api/bi/metas/data'));
      const secondJson = await secondRes.json();
      expect(secondRes.status).toBe(200);
      expect(secondJson.cached).toBe(true);
      expect(secondJson.data).toHaveLength(1);
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);

      // Tenant B nunca lê cache do Tenant A
      mockRequireTenant.mockResolvedValueOnce({
        id: 'user-b',
        tenantId: 'tenant-b',
        role: 'ADMIN',
        departamento: null,
      });
      mockQueryRaw.mockResolvedValueOnce([]);
      const tenantBRes = await getMetasData(new Request('http://localhost/api/bi/metas/data'));
      const tenantBJson = await tenantBRes.json();
      expect(tenantBJson.data).toEqual([]);
      expect(mockQueryRaw).toHaveBeenCalledTimes(2);

      // ?refresh=true força reconsulta mesmo com cache válido
      mockQueryRaw.mockResolvedValueOnce([]);
      const forcedRes = await getMetasData(
        new Request('http://localhost/api/bi/metas/data?refresh=true')
      );
      expect(forcedRes.status).toBe(200);
      expect(mockQueryRaw).toHaveBeenCalledTimes(3);
    });
  });

  describe('3. Paridade do Avaliador Local de Permissões (HIGH-05)', () => {
    it('mantém paridade exata entre evaluateRouteAccessFromAllowedIds e isRouteAllowedForUser', async () => {
      vi.stubEnv('FEATURE_NAV_PERMISSIONS_V1_ENABLED', 'true');
      mockQueryRawUnsafe.mockResolvedValue([]);
      const actualService = await vi.importActual<typeof import('@/lib/nav-permissions/service')>(
        '@/lib/nav-permissions/service'
      );

      const users = [
        { id: 'u-master', role: 'MASTER', tenantId: 'tenant-a', departamento: null },
        { id: 'u-admin', role: 'ADMIN', tenantId: 'tenant-a', departamento: null },
        { id: 'u-rh', role: 'RH', tenantId: 'tenant-a', departamento: null },
        { id: 'u-col', role: 'COLABORADOR', tenantId: 'tenant-a', departamento: null },
        { id: 'u-vis', role: 'VISITANTE', tenantId: 'tenant-a', departamento: null },
      ];

      const paths = [
        '/dashboard',
        '/minha-it',
        '/administracao/its',
        '/instrucoes-trabalho/IT-001',
        '/sistema/pessoas',
        '/sistema/pessoas/usuarios',
        '/configuracoes/departamentos',
        '/pessoas',
        '/bi/metas',
        '/master',
        '/configuracoes/grupos-permissoes',
        '/minha-conta',
        '/rota-inexistente-xyz',
      ];

      for (const user of users) {
        const perms = await getAllowedNavItemsForUser(user);
        for (const pathname of paths) {
          const serverAllowed = await actualService.isRouteAllowedForUser(pathname, user);
          const localResult = evaluateRouteAccessFromAllowedIds({
            pathname,
            role: user.role,
            enabled: perms.enabled,
            allowedItemIds: perms.allowedItemIds,
          });

          expect(localResult.allowed).toBe(serverAllowed);
          if (!localResult.allowed) {
            const expectedFallback = resolveFirstAllowedRouteFromAllowedIds(
              user.role,
              perms.allowedItemIds,
              perms.enabled
            );
            expect(localResult.fallbackHref).toBe(expectedFallback);
          }
        }
      }
    });
  });

  describe('4. Invalidação Automática no unpackLiveRecords (HIGH-08)', () => {
    it('invalida somente os caches do tenant sincronizado por fonte relevante', async () => {
      metasTenantCache.set(buildMetasCacheKey('tenant-a'), [{ protocolo: 1 }]);
      metasTenantCache.set(buildMetasCacheKey('tenant-b'), [{ protocolo: 2 }]);
      produtividadeTenantCache.set(buildProdutividadeCacheKey('tenant-a'), [{ pedido: '1' }]);
      produtividadeTenantCache.set(buildProdutividadeCacheKey('tenant-b'), [{ pedido: '2' }]);
      impressoesTenantCache.set(buildImpressoesCacheKey('tenant-a', { page: 1 }), { totalRegistros: 1 });
      impressoesTenantCache.set(buildImpressoesCacheKey('tenant-b', { page: 1 }), { totalRegistros: 2 });

      await unpackLiveRecords({
        tenantId: 'tenant-a',
        source: 'produtividade',
        records: [{ pedido: 10, data: '2026-11-13' }],
      });

      expect(produtividadeTenantCache.get(buildProdutividadeCacheKey('tenant-a'))).toBeUndefined();
      expect(metasTenantCache.get(buildMetasCacheKey('tenant-a'))).toBeUndefined();
      expect(produtividadeTenantCache.get(buildProdutividadeCacheKey('tenant-b'))).toEqual([{ pedido: '2' }]);
      expect(metasTenantCache.get(buildMetasCacheKey('tenant-b'))).toEqual([{ protocolo: 2 }]);

      metasTenantCache.set(buildMetasCacheKey('tenant-a'), [{ protocolo: 1 }]);
      await unpackLiveRecords({
        tenantId: 'tenant-a',
        source: 'bi',
        records: [{ PROTOCOLO: '10', SEQ_TITULO: 1, DATA_ENTRADA: '2026-11-13' }],
      });
      expect(metasTenantCache.get(buildMetasCacheKey('tenant-a'))).toBeUndefined();
      expect(metasTenantCache.get(buildMetasCacheKey('tenant-b'))).toEqual([{ protocolo: 2 }]);

      await unpackLiveRecords({
        tenantId: 'tenant-a',
        source: 'impressoes',
        records: [{ IdAndamento: 99 }],
      });
      expect(impressoesTenantCache.get(buildImpressoesCacheKey('tenant-a', { page: 1 }))).toBeUndefined();
      expect(impressoesTenantCache.get(buildImpressoesCacheKey('tenant-b', { page: 1 }))).toEqual({
        totalRegistros: 2,
      });
    });
  });

  describe('5. Gating de Logs Verbosos em Produção (MED-11)', () => {
    it('suprime console.info rotineiro em produção e permite habilitar com FIORIX_VERBOSE_LOGS=true', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const syncRequest = () =>
        new Request('http://localhost/api/v1/connector/sync', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-secret' },
          body: JSON.stringify({
            connector_id: 'conn-a',
            source: 'tarefas',
            batch_id: 'batch-med11',
            generated_at: new Date().toISOString(),
            records: [],
          }),
        });

      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('FIORIX_VERBOSE_LOGS', 'false');
      const prodRes = await postConnectorSync(syncRequest());
      expect(prodRes.status).toBe(200);
      expect(infoSpy).not.toHaveBeenCalled();

      vi.stubEnv('FIORIX_VERBOSE_LOGS', 'true');
      const verboseRes = await postConnectorSync(syncRequest());
      expect(verboseRes.status).toBe(200);
      expect(infoSpy).toHaveBeenCalled();
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetBucket = vi.fn();
const mockCreateBucket = vi.fn();
const mockUpdateBucket = vi.fn();
const mockListObjects = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockCreateSignedUrls = vi.fn();
const mockRemoveObjects = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseUrl: () => process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock-proj.supabase.co',
  getSupabaseAnonKey: () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key',
  getSupabaseAdmin: () => ({
    storage: {
      getBucket: (...args: unknown[]) => mockGetBucket(...args),
      createBucket: (...args: unknown[]) => mockCreateBucket(...args),
      updateBucket: (...args: unknown[]) => mockUpdateBucket(...args),
      from: () => ({
        list: (...args: unknown[]) => mockListObjects(...args),
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
        createSignedUrls: (...args: unknown[]) => mockCreateSignedUrls(...args),
        remove: (...args: unknown[]) => mockRemoveObjects(...args),
      }),
    },
  }),
}));

import {
  __resetEphemeralStorageStateForTests,
  computeDocumentStorageObjectPath,
  hydrateDocumentJobResultForBrowser,
  isSignedStorageDocumentalEnabled,
  isValidTenantStoragePath,
  STORAGE_MIN_CONNECTOR_VERSION,
} from '@/lib/documental/ephemeral-storage';
import {
  __resetRealtimeWakeupForTests,
  deriveTenantDocumentWakeupTopic,
  getRealtimeWakeupDirective,
  isRealtimeDocumentalWakeupEnabled,
  notifyConnectorJobQueued,
} from '@/lib/documental/realtime-wakeup';
import { buildDocumentalBlobCacheKey } from '@/lib/documental/pdfIndexedDbCache';

describe('Fase 3 Vercel Optimizations — Signed Storage, Realtime Wakeup & IndexedDB Cache', () => {
  const savedStorageFlag = process.env.USE_SIGNED_STORAGE_DOCUMENTAL;
  const savedWakeupFlag = process.env.USE_REALTIME_DOCUMENTAL_WAKEUP;
  const savedSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedSupabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const savedServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    __resetEphemeralStorageStateForTests();
    __resetRealtimeWakeupForTests();
    delete process.env.USE_SIGNED_STORAGE_DOCUMENTAL;
    delete process.env.USE_REALTIME_DOCUMENTAL_WAKEUP;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-proj.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (savedStorageFlag === undefined) delete process.env.USE_SIGNED_STORAGE_DOCUMENTAL;
    else process.env.USE_SIGNED_STORAGE_DOCUMENTAL = savedStorageFlag;

    if (savedWakeupFlag === undefined) delete process.env.USE_REALTIME_DOCUMENTAL_WAKEUP;
    else process.env.USE_REALTIME_DOCUMENTAL_WAKEUP = savedWakeupFlag;

    if (savedSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedSupabaseUrl;

    if (savedSupabaseAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedSupabaseAnon;

    if (savedServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceRole;
  });

  it('1. Ephemeral Storage: path deterministico multi-tenant, validacao anti-traversal e feature flag fallback', async () => {
    expect(STORAGE_MIN_CONNECTOR_VERSION).toBe('v2.6.13');
    expect(isSignedStorageDocumentalEnabled()).toBe(true);

    const pathA = computeDocumentStorageObjectPath({
      tenantId: 'cartorio_7ri',
      rootId: 'processos',
      relativePath: '.\\2026\\Certidao_123.pdf',
      sizeBytes: 3_500_000,
      mtimeMs: 1_760_000_000_000,
      ext: 'PDF',
      variant: 'pdf',
    });

    const pathASame = computeDocumentStorageObjectPath({
      tenantId: 'cartorio_7ri',
      rootId: 'processos',
      relativePath: '2026//Certidao_123.pdf',
      sizeBytes: 3_500_000,
      mtimeMs: 1_760_000_000_000,
      ext: '.pdf',
      variant: 'pdf',
    });

    expect(pathA).toBe(pathASame);
    expect(pathA).toMatch(/^cartorio_7ri\/[a-f0-9]{64}\.pdf$/);

    const pathOtherTenant = computeDocumentStorageObjectPath({
      tenantId: 'cartorio_outro',
      rootId: 'processos',
      relativePath: '2026/Certidao_123.pdf',
      sizeBytes: 3_500_000,
      mtimeMs: 1_760_000_000_000,
      ext: '.pdf',
      variant: 'pdf',
    });

    expect(isValidTenantStoragePath('cartorio_7ri', pathA)).toBe(true);
    expect(isValidTenantStoragePath('cartorio_7ri', pathOtherTenant)).toBe(false);
    expect(isValidTenantStoragePath('cartorio_7ri', 'cartorio_7ri/../outro/abc.pdf')).toBe(false);
    expect(() =>
      computeDocumentStorageObjectPath({
        tenantId: 'cartorio_7ri',
        rootId: 'processos',
        relativePath: '../segredo.pdf',
        sizeBytes: 100,
        mtimeMs: 1000,
      }),
    ).toThrow();

    process.env.USE_SIGNED_STORAGE_DOCUMENTAL = 'false';
    expect(isSignedStorageDocumentalEnabled()).toBe(false);

    const fallback = await hydrateDocumentJobResultForBrowser('cartorio_7ri', {
      storagePath: pathA,
      localUrl: 'http://srvfiles:8765/doc?t=1',
    });
    expect(fallback.storageValid).toBe(true);
    expect((fallback.result as { signedUrl?: string }).signedUrl).toBeUndefined();
  });

  it('2. Realtime Wakeup: topico HMAC opaco, diretiva condicional e coalescing de 200ms', async () => {
    const topic = deriveTenantDocumentWakeupTopic('tenant-sigiloso-7ri');
    expect(topic).toMatch(/^connector_doc_wake_[a-f0-9]{32}$/);
    expect(topic).not.toContain('tenant-sigiloso-7ri');
    expect(deriveTenantDocumentWakeupTopic('tenant-sigiloso-7ri')).toBe(topic);

    expect(isRealtimeDocumentalWakeupEnabled()).toBe(true);
    expect(getRealtimeWakeupDirective('tenant-sigiloso-7ri', false)).toBeNull();

    const activeDirective = getRealtimeWakeupDirective('tenant-sigiloso-7ri', true);
    expect(activeDirective).toEqual({
      enabled: true,
      supabaseUrl: 'https://mock-proj.supabase.co',
      supabaseAnonKey: 'mock-anon-key',
      channelTopic: topic,
      event: 'job_queued',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { cancel: vi.fn().mockResolvedValue(undefined) },
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const firstSent = await notifyConnectorJobQueued('tenant-sigiloso-7ri');
    const secondCoalesced = await notifyConnectorJobQueued('tenant-sigiloso-7ri');
    expect(firstSent).toBe(true);
    expect(secondCoalesced).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    process.env.USE_REALTIME_DOCUMENTAL_WAKEUP = '0';
    expect(isRealtimeDocumentalWakeupEnabled()).toBe(false);
    expect(getRealtimeWakeupDirective('tenant-sigiloso-7ri', true)).toBeNull();
  });

  it('3. IndexedDB Cache Key: normaliza barra invertida/case e isola tamanhos distintos', () => {
    const key1 = buildDocumentalBlobCacheKey({
      rootId: 'PROCESSOS',
      relativePath: '/2026\\Pasta\\Arquivo_Final.PDF/',
      size: 4_194_304,
    });
    const key2 = buildDocumentalBlobCacheKey({
      rootId: 'processos',
      relativePath: '2026/pasta/arquivo_final.pdf',
      size: 4_194_304,
    });
    const keyDifferentSize = buildDocumentalBlobCacheKey({
      rootId: 'processos',
      relativePath: '2026/pasta/arquivo_final.pdf',
      size: 4_194_999,
    });

    expect(key1).toBe('v1|processos|2026/pasta/arquivo_final.pdf|4194304');
    expect(key2).toBe(key1);
    expect(keyDifferentSize).not.toBe(key1);
    expect(buildDocumentalBlobCacheKey({ rootId: '', relativePath: 'a.pdf', size: 10 })).toBeNull();
  });
});


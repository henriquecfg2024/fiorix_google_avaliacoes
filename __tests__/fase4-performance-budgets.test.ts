import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { BoundedTtlMap } from '@/lib/security/bounded-ttl-map';
import { sanitizeDocumentHtml } from '@/lib/security/html-sanitizer';
import {
  PRODUTIVIDADE_CACHE_MAX_TENANTS,
  PRODUTIVIDADE_CACHE_TTL_MS,
  invalidateProdutividadeTenantCache,
  produtividadeTenantCache,
} from '@/lib/bi-produtividade-cache';

const RELEASE_BUNDLE_LIMIT_BYTES = 2.5 * 1024 * 1024; // 2.5 MB conforme connector/release e self-updater

describe('Fase 4 — Orçamentos de Performance & Regressão Estrutural', () => {
  it('verifica que public/connector-releases/index.js.gz respeita o teto de 2.5 MB (se presente)', () => {
    const bundlePath = path.resolve(
      __dirname,
      '../public/connector-releases/index.js.gz',
    );
    if (!fs.existsSync(bundlePath)) {
      // Artefato de release não existe em todos os checkouts; quando presente, precisa caber no teto.
      return;
    }
    const stats = fs.statSync(bundlePath);
    expect(stats.size).toBeGreaterThan(0);
    expect(stats.size).toBeLessThan(RELEASE_BUNDLE_LIMIT_BYTES);
  });

  it('garante BoundedTtlMap O(1)/LRU limitado a maxSize e abaixo de 300 ms para 10.000 operações', () => {
    const cache = new BoundedTtlMap<string, number>(128, 60_000);
    const start = performance.now();

    for (let i = 0; i < 10_000; i++) {
      cache.set(`key-${i % 256}`, i);
      cache.get(`key-${(i * 7) % 256}`);
    }

    const elapsedMs = performance.now() - start;
    expect(cache.size).toBeLessThanOrEqual(128);
    expect(elapsedMs).toBeLessThan(300);
  });

  it('mantém sanitização determinística de 50 KB de HTML documental abaixo de 200 ms', () => {
    const block =
      '<p class="MsoNormal">Certidão de <strong>Registro</strong> nº 12345 <script>alert(1)</script></p>';
    const payload = block.repeat(600); // ~57 KB
    const start = performance.now();
    const sanitized = sanitizeDocumentHtml(payload);
    const elapsedMs = performance.now() - start;

    expect(sanitized).toContain('<strong>Registro</strong>');
    expect(sanitized.toLowerCase()).not.toContain('<script');
    expect(elapsedMs).toBeLessThan(200);
  });

  it('preserva isolamento por tenant e invalidação seletiva no cache de produtividade BI', () => {
    produtividadeTenantCache.clear();
    expect(PRODUTIVIDADE_CACHE_MAX_TENANTS).toBe(32);
    expect(PRODUTIVIDADE_CACHE_TTL_MS).toBe(60_000);

    produtividadeTenantCache.set('tenant-alpha', [{ colaborador: 'Ana', total: 10 }]);
    produtividadeTenantCache.set('tenant-beta', [{ colaborador: 'Bruno', total: 20 }]);

    expect(produtividadeTenantCache.get('tenant-alpha')).toEqual([
      { colaborador: 'Ana', total: 10 },
    ]);

    invalidateProdutividadeTenantCache('tenant-alpha');
    expect(produtividadeTenantCache.get('tenant-alpha')).toBeUndefined();
    expect(produtividadeTenantCache.get('tenant-beta')).toEqual([
      { colaborador: 'Bruno', total: 20 },
    ]);

    produtividadeTenantCache.clear();
  });
});


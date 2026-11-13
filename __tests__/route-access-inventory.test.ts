import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROUTE_ACCESS_INVENTORY,
  inventoryKeyToUrlPath,
  type RouteAccessEntry,
} from '@/lib/access/route-access-inventory';
import { CANONICAL_MODULES } from '@/lib/plans/modules-catalog';

const SRC_APP_DIR = path.resolve(__dirname, '../src/app');

function walkRouteTargets(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkRouteTargets(fullPath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const relFromApp = path.relative(SRC_APP_DIR, fullPath).replace(/\\/g, '/');
    const isActionFileInActionsDir =
      relFromApp.startsWith('actions/') &&
      relFromApp.endsWith('.ts') &&
      !relFromApp.endsWith('.test.ts') &&
      !relFromApp.endsWith('.d.ts');

    if (
      entry.name === 'page.tsx' ||
      entry.name === 'route.ts' ||
      entry.name === 'actions.ts' ||
      isActionFileInActionsDir
    ) {
      results.push(`app/${relFromApp}`);
    }
  }
  return results.sort();
}

/**
 * Inventário estático de rotas/actions.
 * LIMITAÇÃO EXPLÍCITA: esta suíte verifica apenas governança e integridade de classificação
 * estática (rotas novas sem classificação, entradas obsoletas e rebaixamentos de criticidade).
 * Ela NÃO substitui testes de execução runtime (ver `fase4-runtime-authorization.test.ts`).
 */
describe('Fase 4 — Integridade e Anti-Regressão do Inventário de Acesso (Camada Estática)', () => {
  const diskKeys = walkRouteTargets(SRC_APP_DIR);
  const inventoryKeys = Object.keys(ROUTE_ACCESS_INVENTORY).sort();

  it('cobre 100% das páginas, APIs e server actions reais existentes em src/app', () => {
    const missingFromInventory = diskKeys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(ROUTE_ACCESS_INVENTORY, key),
    );
    expect(missingFromInventory).toEqual([]);
  });

  it('não mantém entradas obsoletas apontando para arquivos removidos do repositório', () => {
    const obsoleteEntries = inventoryKeys.filter((key) => {
      const entry = ROUTE_ACCESS_INVENTORY[key];
      if (entry.localOnly) {
        return false;
      }
      const relativeToSrc = key;
      const diskPath = path.resolve(__dirname, '../src', relativeToSrc);
      return !fs.existsSync(diskPath);
    });
    expect(obsoleteEntries).toEqual([]);
  });

  it('valida que toda classificação CANONICAL referencia um módulo válido de CANONICAL_MODULES', () => {
    const invalidModules: Array<{ key: string; moduleId?: string }> = [];
    for (const [key, entry] of Object.entries(ROUTE_ACCESS_INVENTORY)) {
      if (entry.scope === 'CANONICAL') {
        if (!entry.moduleId || !Object.prototype.hasOwnProperty.call(CANONICAL_MODULES, entry.moduleId)) {
          invalidModules.push({ key, moduleId: entry.moduleId });
        }
      }
    }
    expect(invalidModules).toEqual([]);
  });

  it('congela classificações PUBLIC_AUTH, DEV_ONLY e MINIMAL_SAFE contra ampliação indevida', () => {
    const publicAuthKeys = inventoryKeys.filter(
      (key) => ROUTE_ACCESS_INVENTORY[key].scope === 'PUBLIC_AUTH',
    );
    expect(publicAuthKeys).toEqual([
      'app/actions/auth.ts',
      'app/api/auth/[...nextauth]/route.ts',
      'app/api/auth/callback/google/route.ts',
      'app/api/auth/google/route.ts',
      'app/api/v1/connector/install.ps1/route.ts',
      'app/login/page.tsx',
      'app/verifica/[hash]/page.tsx',
    ]);

    const devOnlyKeys = inventoryKeys.filter(
      (key) => ROUTE_ACCESS_INVENTORY[key].scope === 'DEV_ONLY',
    );
    expect(devOnlyKeys).toEqual(['app/api/seed-reviews/route.ts']);

    const minimalSafeKeys = inventoryKeys.filter(
      (key) => ROUTE_ACCESS_INVENTORY[key].scope === 'MINIMAL_SAFE',
    );
    expect(minimalSafeKeys).toEqual(['app/(dashboard)/dashboard/page.tsx']);
  });

  it('impede rebaixamento de rotas críticas (admin, nav-permissions, conector, master, holerites, ken, operacoes)', () => {
    const criticalPrefixesOrKeys = [
      'app/(dashboard)/configuracoes/permissoes-menu/page.tsx',
      'app/(dashboard)/configuracoes/usuarios/page.tsx',
      'app/(dashboard)/master/mensagens/page.tsx',
      'app/(dashboard)/master/tenants/page.tsx',
      'app/actions/admin.ts',
      'app/actions/nav-permissions.ts',
      'app/actions/sessoes.ts',
      'app/actions/tenants.ts',
      'app/api/documental/ken/route.ts',
      'app/api/holerites/[id]/download/route.ts',
      'app/api/v1/connector/documentos/route.ts',
      'app/api/v1/connector/enroll/route.ts',
      'app/api/v1/operacoes/connectors/route.ts',
    ];

    for (const key of criticalPrefixesOrKeys) {
      const entry: RouteAccessEntry | undefined = ROUTE_ACCESS_INVENTORY[key];
      expect(entry, `Entrada obrigatória ausente: ${key}`).toBeDefined();
      expect(entry?.scope).not.toBe('PUBLIC_AUTH');
      expect(entry?.scope).not.toBe('MINIMAL_SAFE');
      expect(entry?.scope).not.toBe('SHARED_UTILITY');
      expect(['HIGH', 'CRITICAL']).toContain(entry?.risk);
    }

    expect(ROUTE_ACCESS_INVENTORY['app/(dashboard)/master/tenants/page.tsx'].scope).toBe('MASTER_SAAS');
    expect(ROUTE_ACCESS_INVENTORY['app/actions/tenants.ts'].scope).toBe('MASTER_SAAS');
    expect(ROUTE_ACCESS_INVENTORY['app/api/v1/connector/enroll/route.ts'].scope).toBe('MACHINE_TOKEN');
  });

  it('gera URLs normalizadas sem grupos de rota Next.js', () => {
    expect(inventoryKeyToUrlPath('app/(dashboard)/configuracoes/usuarios/page.tsx')).toBe(
      '/configuracoes/usuarios',
    );
    expect(inventoryKeyToUrlPath('app/api/holerites/[id]/download/route.ts')).toBe(
      '/api/holerites/[id]/download',
    );
  });
});


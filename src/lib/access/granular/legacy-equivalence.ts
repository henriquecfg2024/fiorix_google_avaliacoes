/**
 * FIORIX — Fase 6.3 | Equivalência com o legado (camada L1 — navegação, ação `view`)
 *
 * Compara, papel a papel e módulo a módulo, a decisão de visibilidade do legado
 * com a decisão do motor granular alimentado pelo "seed de equivalência" proposto
 * para a 6.4 (arquitetura §5: 23 serviços ativos, liberados ao departamento,
 * ações por papel iguais à matriz atual).
 *
 * A função legada é INJETADA pelo chamador (este módulo não importa UI).
 *
 * Limites (declarados no relatório):
 * - Só a ação `view` tem sinal legado na navegação; demais ações não são comparadas.
 * - Módulo sem item de menu para nenhum papel não tem sinal legado (lacuna de cobertura).
 */

import { CANONICAL_MODULES, getModuleByRoute } from '@/lib/plans/modules-catalog';
import { buildGranularSnapshot } from './snapshot-builder';
import { compareShadow, summarizeShadow, type ShadowRecord, type ShadowReport } from './shadow';
import type { GranularAction, GranularSnapshot } from './types';

/** Hrefs visíveis para o papel segundo o legado (ex.: derivado de filterNavigationByRole). */
export type LegacyVisibleHrefs = (role: string) => readonly string[];

/** Módulos canônicos que o legado torna visíveis para o papel. */
export function deriveLegacyViewModules(role: string, visibleHrefs: LegacyVisibleHrefs): Set<string> {
  const out = new Set<string>();
  for (const href of visibleHrefs(role)) {
    const mod = getModuleByRoute(href);
    if (mod) out.add(mod.id);
  }
  return out;
}

/**
 * Seed de equivalência para um sujeito: todos os serviços ativos, ALLOW no
 * departamento e, por papel, as ações suportadas somente nos módulos que o
 * legado torna visíveis.
 */
export function buildLegacyEquivalentSnapshot(input: {
  tenantId: string;
  userId: string;
  role: string;
  departmentId: string;
  legacyViewModules: ReadonlySet<string>;
}): GranularSnapshot {
  const base = buildGranularSnapshot({
    tenantId: input.tenantId,
    userId: input.userId,
    userRole: input.role,
    primaryDepartmentId: input.departmentId,
    departmentIds: [input.departmentId],
    deployments: Object.keys(CANONICAL_MODULES).map((nodeId) => ({
      nodeId,
      scopeType: 'DEPARTMENT' as const,
      targetId: input.departmentId,
      effect: 'ALLOW' as const,
    })),
  });
  const roleActions: Record<string, GranularAction[]> = {};
  for (const [id, mod] of Object.entries(CANONICAL_MODULES)) {
    roleActions[id] = input.legacyViewModules.has(id) ? [...(mod.supportedActions as GranularAction[])] : [];
  }
  return { ...base, roleActions };
}

export interface LegacyEquivalenceReport extends ShadowReport {
  byRole: Record<string, ShadowReport>;
  /** Módulos sem item de menu para nenhum papel (sem sinal legado de `view`). */
  modulesWithoutLegacySignal: string[];
  /** Matriz legada derivada: papel → módulos visíveis. */
  legacyMatrix: Record<string, string[]>;
}

export function runLegacyViewEquivalence(input: {
  roles: readonly string[];
  visibleHrefs: LegacyVisibleHrefs;
  tenantId: string;
  departmentId: string;
  /** Permite substituir o seed (controle negativo em testes). */
  snapshotFor?: (role: string, legacyViewModules: ReadonlySet<string>) => GranularSnapshot;
}): LegacyEquivalenceReport {
  const all: ShadowRecord[] = [];
  const byRole: Record<string, ShadowReport> = {};
  const legacyMatrix: Record<string, string[]> = {};
  const seen = new Set<string>();
  const now = new Date(0);

  for (const role of input.roles) {
    const userId = `shadow-${role.toLowerCase()}`;
    const viewModules = deriveLegacyViewModules(role, input.visibleHrefs);
    viewModules.forEach((m) => seen.add(m));
    legacyMatrix[role] = [...viewModules].sort();

    const snapshot = input.snapshotFor
      ? input.snapshotFor(role, viewModules)
      : buildLegacyEquivalentSnapshot({ tenantId: input.tenantId, userId, role, departmentId: input.departmentId, legacyViewModules: viewModules });

    const records: ShadowRecord[] = [];
    for (const nodeId of Object.keys(CANONICAL_MODULES)) {
      records.push(
        compareShadow(
          {
            request: { subject: { userId, tenantId: input.tenantId, role }, nodeId, action: 'view', space: 'TENANT_OPERATIONAL' },
            legacyAllowed: viewModules.has(nodeId),
            snapshot,
          },
          now,
        ),
      );
    }
    byRole[role] = summarizeShadow(records);
    all.push(...records);
  }

  return {
    ...summarizeShadow(all),
    byRole,
    legacyMatrix,
    modulesWithoutLegacySignal: Object.keys(CANONICAL_MODULES).filter((id) => !seen.has(id)).sort(),
  };
}

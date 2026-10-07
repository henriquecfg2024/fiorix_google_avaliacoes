/**
 * FIORIX — Fase 6.1 | Construtor em Memória de Snapshot Granular (Snapshot Builder)
 *
 * Função pura e desacoplada de banco para montar a estrutura de decisão
 * `GranularSnapshot` a partir de registros normalizados em memória.
 */

import {
  GRANULAR_ACTIONS,
  type GranularSnapshot,
  type GranularRule,
  type GranularSuspension,
  type GranularAction,
} from './types';
import { CANONICAL_MODULES } from '@/lib/plans/modules-catalog';

export interface RawDeploymentRecord {
  nodeId: string;
  scopeType: 'DEPARTMENT' | 'USER';
  targetId: string;
  effect: 'ALLOW' | 'DENY';
  actionCeiling?: string[] | null;
}

export interface BuildSnapshotInput {
  tenantId: string;
  userId: string;
  userRole: string;
  primaryDepartmentId?: string | null;
  departmentIds?: string[];
  tenantActiveNodeIds?: string[];
  deployments?: RawDeploymentRecord[];
  suspensions?: GranularSuspension[];
}

export function buildGranularSnapshot(input: BuildSnapshotInput): GranularSnapshot {
  const userRules: Record<string, GranularRule> = {};
  const departmentRules: Record<string, Record<string, GranularRule>> = {};

  // Inicializa mapas de regras dos departamentos informados
  const deptList = input.departmentIds ?? (input.primaryDepartmentId ? [input.primaryDepartmentId] : []);
  for (const dId of deptList) {
    departmentRules[dId] = {};
  }

  // Processa as regras de implantação (departamento e usuário)
  for (const dep of input.deployments ?? []) {
    const rule: GranularRule = {
      effect: dep.effect,
      actionCeiling: dep.actionCeiling
        ? (dep.actionCeiling.filter((a) => (GRANULAR_ACTIONS as readonly string[]).includes(a)) as GranularAction[])
        : undefined,
    };

    if (dep.scopeType === 'USER' && dep.targetId === input.userId) {
      userRules[dep.nodeId] = rule;
    } else if (dep.scopeType === 'DEPARTMENT') {
      if (!departmentRules[dep.targetId]) {
        departmentRules[dep.targetId] = {};
      }
      departmentRules[dep.targetId][dep.nodeId] = rule;
    }
  }

  // Constrói catálogo de ações suportadas por nó a partir dos módulos canônicos
  const nodeSupportedActions: Record<string, GranularAction[]> = {};
  for (const [id, mod] of Object.entries(CANONICAL_MODULES)) {
    nodeSupportedActions[id] = [...(mod.supportedActions as GranularAction[])];
  }

  // Matriz de ações por papel (padrão canônico)
  const roleActions: Record<string, GranularAction[]> = {};
  for (const [id, mod] of Object.entries(CANONICAL_MODULES)) {
    roleActions[id] = [...(mod.supportedActions as GranularAction[])];
  }

  return {
    tenantActiveNodeIds: input.tenantActiveNodeIds ?? Object.keys(CANONICAL_MODULES),
    suspensions: input.suspensions ?? [],
    userRules,
    departmentIds: deptList,
    primaryDepartmentId: input.primaryDepartmentId ?? null,
    departmentRules,
    roleActions,
    nodeSupportedActions,
  };
}

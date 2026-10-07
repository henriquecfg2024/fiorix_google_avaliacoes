/**
 * FIORIX — Fase 6.0 | Motor granular (contrato executável, NÃO integrado)
 *
 * Função pura que implementa a matriz de precedência P1–P9 da arquitetura
 * (docs/governanca/arquitetura-implantacao-granular-fiorix.md, §3).
 *
 * Garantias:
 * - Deny by default: ausência de regra, entrada inválida ou qualquer exceção
 *   resultam em negação. A função NUNCA lança exceção e NUNCA libera por falha.
 * - Única exceção controlada: Início (`core.dashboard`, ação `view`) em modo
 *   mínimo seguro para sujeito válido (Decisão MASTER nº 4).
 * - MASTER: acesso irrestrito apenas ao espaço MASTER_SAAS (Decisão nº 1).
 *   Acesso a dados operacionais de cliente exige modo de suporte auditado,
 *   ainda não implementado ⇒ negado (Decisão nº 2).
 * - Modo LEGACY_ONLY (constante desta fase): `decideAccess` devolve a decisão
 *   legada sem alteração.
 */

import { isMinimalSafeAction, isMinimalSafeModule } from '@/lib/access/minimal-safe';
import {
  GRANULAR_ACTIONS,
  type AccessDecision,
  type AccessReasonCode,
  type AccessRequest,
  type AccessScopeLevel,
  type GranularAction,
  type GranularEngineMode,
  type GranularRule,
  type GranularSnapshot,
} from './types';

/** Constante da Fase 6.0: o motor granular não decide nada em runtime. */
export const GRANULAR_ENGINE_MODE: GranularEngineMode = 'LEGACY_ONLY';

const MASTER_ROLE = 'MASTER';

function deny(
  reason: AccessReasonCode,
  request: Partial<AccessRequest> | null | undefined,
  decidedBy: AccessDecision['decidedBy'] = 'ENGINE'
): AccessDecision {
  return {
    allowed: false,
    mode: 'NONE',
    reason,
    decidedBy,
    engine: 'GRANULAR',
    nodeId: typeof request?.nodeId === 'string' ? request.nodeId : null,
    action: isGranularAction(request?.action) ? request!.action! : null,
    allowedActions: [],
  };
}

function minimal(request: AccessRequest): AccessDecision {
  return {
    allowed: true,
    mode: 'MINIMAL',
    reason: 'MINIMAL_SAFE_MODE',
    decidedBy: 'ENGINE',
    engine: 'GRANULAR',
    nodeId: request.nodeId,
    action: request.action,
    allowedActions: ['view'],
  };
}

export function isGranularAction(value: unknown): value is GranularAction {
  return typeof value === 'string' && (GRANULAR_ACTIONS as readonly string[]).includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidRequest(request: unknown): request is AccessRequest {
  if (!request || typeof request !== 'object') return false;
  const r = request as AccessRequest;
  if (!r.subject || typeof r.subject !== 'object') return false;
  if (!isNonEmptyString(r.subject.userId)) return false;
  if (!isNonEmptyString(r.subject.role)) return false;
  if (!isNonEmptyString(r.nodeId)) return false;
  if (!isGranularAction(r.action)) return false;
  if (r.space !== 'TENANT_OPERATIONAL' && r.space !== 'MASTER_SAAS') return false;
  if (r.ancestorIds !== undefined && !Array.isArray(r.ancestorIds)) return false;
  return true;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

/**
 * Validação estrutural do snapshot. Qualquer forma inesperada ⇒ falso ⇒ nega.
 * O departamento principal, quando informado, precisa pertencer aos vínculos.
 */
function isStructurallyValidSnapshot(snapshot: unknown): snapshot is GranularSnapshot {
  if (!isPlainRecord(snapshot)) return false;
  const s = snapshot as unknown as GranularSnapshot;
  if (!isStringArray(s.tenantActiveNodeIds)) return false;
  if (!isStringArray(s.departmentIds)) return false;
  if (!Array.isArray(s.suspensions) || !s.suspensions.every((x) => isPlainRecord(x) && isNonEmptyString(x.nodeId))) {
    return false;
  }
  if (s.primaryDepartmentId !== null) {
    if (!isNonEmptyString(s.primaryDepartmentId)) return false;
    if (!s.departmentIds.includes(s.primaryDepartmentId)) return false;
  }
  if (!isPlainRecord(s.userRules)) return false;
  if (!isPlainRecord(s.departmentRules)) return false;
  if (!isPlainRecord(s.roleActions)) return false;
  if (!isPlainRecord(s.nodeSupportedActions)) return false;
  return true;
}

/** Cadeia hierárquica (ancestrais → nó). */
function nodeChain(request: AccessRequest): string[] {
  const ancestors = (request.ancestorIds ?? []).filter(isNonEmptyString);
  return [...ancestors, request.nodeId];
}

interface CombinedRule {
  effect: 'ALLOW' | 'DENY' | 'NONE';
  ceiling: Set<GranularAction> | null;
}

/**
 * P8: um filho nunca fica mais aberto que o pai. Qualquer DENY na cadeia nega;
 * ALLOW em qualquer nível libera, com tetos de ação intersectados.
 */
function combineChainRules(chain: string[], rules: Readonly<Record<string, GranularRule>> | undefined): CombinedRule {
  if (!rules || typeof rules !== 'object') return { effect: 'NONE', ceiling: null };
  let sawAllow = false;
  let ceiling: Set<GranularAction> | null = null;
  for (const nodeId of chain) {
    const rule = rules[nodeId];
    if (!rule) continue;
    if (rule.effect === 'DENY') return { effect: 'DENY', ceiling: null };
    if (rule.effect !== 'ALLOW') return { effect: 'DENY', ceiling: null }; // valor inesperado ⇒ nega
    sawAllow = true;
    if (rule.actionCeiling !== undefined) {
      const rawCeiling: unknown = rule.actionCeiling;
      if (!Array.isArray(rawCeiling)) return { effect: 'DENY', ceiling: null };
      const next = new Set<GranularAction>(rawCeiling.filter(isGranularAction));
      ceiling = intersectCeilings(ceiling, next);
    }
  }
  return sawAllow ? { effect: 'ALLOW', ceiling } : { effect: 'NONE', ceiling: null };
}

function intersectCeilings(a: Set<GranularAction> | null, b: Set<GranularAction> | null): Set<GranularAction> | null {
  if (!a) return b;
  if (!b) return a;
  return new Set([...a].filter((x) => b.has(x)));
}

function suspensionMatches(
  scope: AccessScopeLevel,
  targetId: string | null,
  request: AccessRequest,
  snapshot: GranularSnapshot
): boolean {
  switch (scope) {
    case 'GLOBAL':
      return true;
    case 'TENANT':
      return targetId !== null && targetId === request.subject.tenantId;
    case 'DEPARTMENT':
      return targetId !== null && snapshot.departmentIds.includes(targetId);
    case 'USER':
      return targetId !== null && targetId === request.subject.userId;
    case 'ROLE':
      return targetId !== null && targetId.toUpperCase() === request.subject.role.toUpperCase();
    default:
      // Escopo desconhecido é tratado como suspensão (falha segura).
      return true;
  }
}

function evaluate(request: AccessRequest, snapshot: GranularSnapshot): AccessDecision {
  const role = request.subject.role.toUpperCase();

  // Decisões nº 1 e nº 2 — espaço MASTER SAAS e modo de suporte
  if (request.space === 'MASTER_SAAS') {
    if (role !== MASTER_ROLE) return deny('MASTER_SAAS_ONLY', request);
    return {
      allowed: true,
      mode: 'FULL',
      reason: 'MASTER_SAAS_SPACE',
      decidedBy: 'ENGINE',
      engine: 'GRANULAR',
      nodeId: request.nodeId,
      action: request.action,
      allowedActions: [...GRANULAR_ACTIONS],
    };
  }
  if (role === MASTER_ROLE) {
    // MASTER em dado operacional de cliente: somente via suporte auditado (futuro).
    return isMinimalSafeModule(request.nodeId) && isMinimalSafeAction(request.action)
      ? minimal(request)
      : deny('SUPPORT_MODE_REQUIRED', request);
  }

  // Decisão nº 4 — Início sempre disponível em modo mínimo seguro
  if (isMinimalSafeModule(request.nodeId) && isMinimalSafeAction(request.action)) {
    return minimal(request);
  }

  if (!isNonEmptyString(request.subject.tenantId)) return deny('INVALID_INPUT', request);
  if (!isStructurallyValidSnapshot(snapshot)) return deny('RESOLVER_ERROR', request);

  const chain = nodeChain(request);

  // P1 — C1: nó e todos os ancestrais ativos para o cliente
  const active = new Set(snapshot.tenantActiveNodeIds);
  if (!chain.every((id) => active.has(id))) return deny('TENANT_SERVICE_INACTIVE', request, 'TENANT');

  // P2 — C4: suspensão vence liberação
  for (const s of snapshot.suspensions) {
    if (chain.includes(s.nodeId) && suspensionMatches(s.scope, s.targetId, request, snapshot)) {
      return deny('SUSPENDED', request, s.scope);
    }
  }

  // P3 — regra individual vence departamento
  let ceiling: Set<GranularAction> | null = null;
  let decidedBy: AccessScopeLevel = 'USER';
  const userRule = combineChainRules(chain, snapshot.userRules);
  if (userRule.effect === 'DENY') return deny('USER_DENY', request, 'USER');

  if (userRule.effect === 'ALLOW') {
    ceiling = userRule.ceiling;
  } else {
    decidedBy = 'DEPARTMENT';
    const primary = snapshot.primaryDepartmentId;
    if (isNonEmptyString(primary)) {
      // P4 — departamento principal decide
      const deptRule = combineChainRules(chain, snapshot.departmentRules[primary]);
      if (deptRule.effect === 'DENY') return deny('DEPARTMENT_DENY', request, 'DEPARTMENT');
      if (deptRule.effect === 'NONE') return deny('NO_RULE', request, 'DEPARTMENT');
      ceiling = deptRule.ceiling;
    } else {
      // P5 — sem principal: ALLOW somente se TODOS permitirem; P7 se não houver depto
      const depts = snapshot.departmentIds.filter(isNonEmptyString);
      if (depts.length === 0) return deny('NO_RULE', request, 'DEPARTMENT');
      for (const deptId of depts) {
        const deptRule = combineChainRules(chain, snapshot.departmentRules[deptId]);
        if (deptRule.effect === 'DENY') return deny('DEPARTMENT_DENY', request, 'DEPARTMENT');
        if (deptRule.effect === 'NONE') return deny('NO_RULE', request, 'DEPARTMENT');
        ceiling = intersectCeilings(ceiling, deptRule.ceiling ?? null);
      }
    }
  }

  // P6 — C3: ação ∈ papel ∩ teto ∩ suportadas pelo nó
  const roleActions = snapshot.roleActions[request.nodeId];
  const supported = snapshot.nodeSupportedActions[request.nodeId];
  if (!Array.isArray(roleActions) || !Array.isArray(supported)) {
    return deny('ACTION_NOT_ALLOWED', request, 'ROLE');
  }
  const supportedSet = new Set(supported.filter(isGranularAction));
  const effective = roleActions
    .filter(isGranularAction)
    .filter((a) => supportedSet.has(a))
    .filter((a) => (ceiling ? ceiling.has(a) : true));
  const effectiveUnique = [...new Set(effective)];

  if (!effectiveUnique.includes(request.action)) return deny('ACTION_NOT_ALLOWED', request, 'ROLE');

  return {
    allowed: true,
    mode: 'FULL',
    reason: 'ALLOWED',
    decidedBy,
    engine: 'GRANULAR',
    nodeId: request.nodeId,
    action: request.action,
    allowedActions: effectiveUnique,
  };
}

/**
 * Resolve o acesso pelo motor granular. Nunca lança; nunca libera por falha.
 */
export function resolveGranularAccess(request: AccessRequest, snapshot: GranularSnapshot | null | undefined): AccessDecision {
  let valid = false;
  try {
    valid = isValidRequest(request);
    if (!valid) return deny('INVALID_INPUT', request);
    return evaluate(request, snapshot as GranularSnapshot);
  } catch {
    // Falha segura. Mesmo em erro, Início permanece em modo mínimo (Decisão nº 4).
    try {
      if (valid && isMinimalSafeModule(request.nodeId) && isMinimalSafeAction(request.action)) {
        return minimal(request);
      }
    } catch {
      /* ignora: cai na negação */
    }
    return deny('RESOLVER_ERROR', null);
  }
}

/**
 * P9 / caso 14 — somente o MASTER, no espaço MASTER SAAS, pode configurar
 * disponibilidade. O step-up crítico (senha + TOTP) continua obrigatório na
 * camada de ação; este helper não o substitui.
 */
export function canConfigureAvailability(subject: { userId: string; role: string } | null | undefined): AccessDecision {
  try {
    if (!subject || !isNonEmptyString(subject.userId) || !isNonEmptyString(subject.role)) {
      return deny('INVALID_INPUT', null);
    }
    if (subject.role.toUpperCase() !== MASTER_ROLE) return deny('CONFIG_MASTER_ONLY', null, 'ROLE');
    return {
      allowed: true,
      mode: 'FULL',
      reason: 'MASTER_SAAS_SPACE',
      decidedBy: 'ENGINE',
      engine: 'GRANULAR',
      nodeId: null,
      action: 'admin',
      allowedActions: ['admin'],
    };
  } catch {
    return deny('RESOLVER_ERROR', null);
  }
}

/** Decisão do modelo legado, já calculada pelo chamador (comportamento atual). */
export interface LegacyDecisionInput {
  allowed: boolean;
}

/**
 * Ponto único de decisão futura.
 * - LEGACY_ONLY (Fase 6.0): devolve a decisão legada sem qualquer alteração.
 * - GRANULAR_ENFORCED: usa exclusivamente o motor granular (deny by default).
 *   Não há caminho em runtime que selecione este modo nesta fase.
 */
export function decideAccess(
  request: AccessRequest,
  deps: { legacy: LegacyDecisionInput; snapshot?: GranularSnapshot | null },
  mode: GranularEngineMode = GRANULAR_ENGINE_MODE
): AccessDecision {
  if (mode === 'GRANULAR_ENFORCED') {
    return resolveGranularAccess(request, deps?.snapshot ?? null);
  }
  const legacyAllowed = deps?.legacy?.allowed === true;
  return {
    allowed: legacyAllowed,
    mode: 'LEGACY',
    reason: 'LEGACY_PASSTHROUGH',
    decidedBy: 'LEGACY',
    engine: 'LEGACY',
    nodeId: typeof request?.nodeId === 'string' ? request.nodeId : null,
    action: isGranularAction(request?.action) ? request.action : null,
    allowedActions: [],
  };
}

import { prisma } from '@/lib/prisma';
import {
  CANONICAL_MODULES,
  CANONICAL_MODULES_LIST,
  getDefaultModulesForTier,
  type ModuleAction,
  type PlanTier,
} from './modules-catalog';
import { getMinimalSafeModules } from '@/lib/access/minimal-safe';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FASE 6.0 — SEPARAÇÃO "COMPATIBILIDADE LEGADA" × "NOVO MOTOR"
 *
 * COMPATIBILIDADE LEGADA (flags desligadas — estado atual em todos os ambientes):
 *   - getTenantAllowedModules → todos os módulos canônicos (comportamento inalterado);
 *   - hasModuleAccess → true;
 *   - hasActionPermission → matriz estática (MASTER soberano, legado preservado).
 *
 * CAMINHO DE PLANOS COM FLAG LIGADA (ainda não ativado):
 *   - Antes da Fase 6.0, erro de consulta, tenant inexistente ou plano
 *     desconhecido resultavam em OMEGA (todos os módulos) — fallback permissivo.
 *   - Agora resultam no MODO MÍNIMO SEGURO (somente `core.dashboard`).
 *
 * NOVO MOTOR GRANULAR (src/lib/access/granular): contrato separado, deny by
 * default, não integrado a rotas nesta fase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Resolve o tier oficial a partir do código do plano; desconhecido → null. */
export function resolveOfficialTier(rawPlano: string | null | undefined): PlanTier | null {
  if (typeof rawPlano !== 'string') return null;
  const normalized = rawPlano.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized.includes('BASIC')) return 'BASIC';
  if (normalized.includes('PRO')) return 'PRO';
  if (normalized.includes('OMEGA')) return 'OMEGA';
  return null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FEATURE FLAGS GLOBAIS
 * Por padrão desligadas em produção. Enquanto false, o FIORIX opera 100% no
 * modo legado sem qualquer bloqueio ou restrição de plano.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function isSaasPlansEnabled(): boolean {
  return process.env.FEATURE_SAAS_PLANS_V1_ENABLED === 'true';
}

export function isRolePoliciesEnabled(): boolean {
  return process.env.FEATURE_ROLE_POLICIES_V1_ENABLED === 'true';
}

export function isSaasShadowEnabled(): boolean {
  return process.env.FEATURE_SAAS_SHADOW_V1_ENABLED === 'true';
}

// Cache em memória de curta duração (60s) para performance < 1ms
interface TenantPlanCache {
  planCode: string;
  modules: string[];
  cachedAt: number;
}
const tenantPlanCache = new Map<string, TenantPlanCache>();

interface RolePolicyCache {
  policies: Map<string, Set<ModuleAction>>;
  cachedAt: number;
}
const rolePolicyCache = new Map<string, RolePolicyCache>();

const CACHE_TTL_MS = 60_000;

export function invalidatePlanCache(tenantId?: string) {
  if (tenantId) {
    tenantPlanCache.delete(tenantId);
    rolePolicyCache.delete(tenantId);
  } else {
    tenantPlanCache.clear();
    rolePolicyCache.clear();
  }
}

/**
 * Obtém os módulos liberados para o plano de um tenant.
 */
export async function getTenantAllowedModules(tenantId: string): Promise<string[]> {
  // Se a feature flag estiver desligada, libera todos os módulos (zero regressão)
  if (!isSaasPlansEnabled()) {
    return Object.keys(CANONICAL_MODULES);
  }

  const now = Date.now();
  const cached = tenantPlanCache.get(tenantId);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.modules;
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plano: true },
    });

    // Fase 6.0: tenant inexistente ou sem plano NÃO recebe mais OMEGA por padrão.
    if (!tenant || typeof tenant.plano !== 'string' || !tenant.plano.trim()) {
      console.warn('[PlanService] Tenant sem plano resolvível. Aplicando modo mínimo seguro.');
      return getMinimalSafeModules();
    }

    const rawPlano = tenant.plano.trim().toUpperCase();
    let planModules: string[] = [];

    // 1. Tenta buscar plano personalizado ou oficial no banco se a tabela existir
    try {
      const customPlan = await prisma.$queryRawUnsafe<any[]>(
        `
        SELECT modules FROM public.fiorix_saas_plans
        WHERE (tenant_id = $1 OR code = $2) AND is_active = true
        ORDER BY CASE WHEN tenant_id = $1 THEN 0 ELSE 1 END
        LIMIT 1;
      `,
        tenantId,
        rawPlano
      );

      if (customPlan.length > 0 && customPlan[0].modules) {
        const rawJson = customPlan[0].modules;
        planModules = Array.isArray(rawJson) ? rawJson : JSON.parse(rawJson);
      }
    } catch {
      // Tabela fiorix_saas_plans pode não estar criada em ambientes anteriores
    }

    // 2. Se não encontrou no banco, resolve pelos modelos oficiais do catálogo
    if (planModules.length === 0) {
      const tier = resolveOfficialTier(rawPlano);
      if (!tier) {
        // Fase 6.0: plano desconhecido não cai mais em OMEGA. Não é cacheado
        // para permitir correção imediata do cadastro.
        console.warn('[PlanService] Plano desconhecido. Aplicando modo mínimo seguro.');
        return getMinimalSafeModules();
      }
      planModules = getDefaultModulesForTier(tier);
    }

    tenantPlanCache.set(tenantId, {
      planCode: rawPlano,
      modules: planModules,
      cachedAt: now,
    });

    return planModules;
  } catch {
    // Fase 6.0: falha NUNCA concede acesso amplo. Detalhe do erro não é logado
    // para evitar vazamento de dados de conexão.
    console.warn('[PlanService] Falha ao consultar plano do tenant. Aplicando modo mínimo seguro.');
    return getMinimalSafeModules();
  }
}

/**
 * Verifica se um módulo específico está incluído no plano contratado pelo tenant.
 */
export async function hasModuleAccess(tenantId: string, moduleId: string): Promise<boolean> {
  if (!isSaasPlansEnabled()) {
    return true; // Zero bloqueio com feature flag desligada
  }

  const allowedModules = await getTenantAllowedModules(tenantId);
  return allowedModules.includes(moduleId);
}

/**
 * Matriz estática canônica de permissões por papel (Fallback seguro e RBAC base)
 */
export function getStaticRolePermissions(role: string, moduleId: string): Set<ModuleAction> {
  const normalizedRole = role.toUpperCase();
  const mod = CANONICAL_MODULES[moduleId];
  if (!mod) return new Set();

  const actions = new Set<ModuleAction>();

  // MASTER possui acesso total irrestrito a todas as ações suportadas
  if (normalizedRole === 'MASTER') {
    mod.supportedActions.forEach((a) => actions.add(a));
    return actions;
  }

  // ADMIN do tenant possui acesso administrativo amplo
  if (normalizedRole === 'ADMIN') {
    mod.supportedActions.forEach((a) => actions.add(a));
    return actions;
  }

  // GESTOR e SUBSTITUTO (Preserva integralmente o papel legado SUBSTITUTO com aprovações)
  if (normalizedRole === 'GESTOR' || normalizedRole === 'SUBSTITUTO') {
    actions.add('view');
    if (mod.supportedActions.includes('create')) actions.add('create');
    if (mod.supportedActions.includes('edit')) actions.add('edit');
    if (mod.supportedActions.includes('approve')) actions.add('approve');
    if (mod.supportedActions.includes('export')) actions.add('export');
    return actions;
  }

  // RH (Gestão de pessoas, comunicados e relatórios)
  if (normalizedRole === 'RH') {
    actions.add('view');
    if (mod.category === 'GESTAO_PESSOAS' || mod.id.startsWith('rotina.comunicados')) {
      if (mod.supportedActions.includes('create')) actions.add('create');
      if (mod.supportedActions.includes('edit')) actions.add('edit');
      if (mod.supportedActions.includes('approve')) actions.add('approve');
      if (mod.supportedActions.includes('export')) actions.add('export');
    }
    return actions;
  }

  // USER (Preserva integralmente o papel legado USER de operação)
  if (normalizedRole === 'USER') {
    actions.add('view');
    if (mod.supportedActions.includes('export')) {
      actions.add('export');
    }
    return actions;
  }

  // COLABORADOR (Acesso restrito ao próprio espaço e leitura geral permitida)
  if (normalizedRole === 'COLABORADOR') {
    if (
      mod.id === 'its.minha_it' ||
      mod.id === 'rotina.comunicados' ||
      mod.id === 'pessoas.holerites' ||
      mod.id === 'pessoas.ferias' ||
      mod.id === 'rotina.mensagens'
    ) {
      actions.add('view');
      if (mod.id === 'pessoas.ferias' || mod.id === 'rotina.mensagens') {
        actions.add('create');
      }
    }
    return actions;
  }

  // CONSULTA (Leitura sem gravação ou exclusão)
  if (normalizedRole === 'CONSULTA') {
    actions.add('view');
    return actions;
  }

  return actions;
}

/**
 * Validação de Ação Efetiva:
 * Acesso = (Módulo no Plano) E (Ação permitida no Papel)
 */
export async function hasActionPermission(
  tenantId: string,
  role: string,
  moduleId: string,
  action: ModuleAction
): Promise<boolean> {
  // MASTER é sempre soberano
  if (role.toUpperCase() === 'MASTER') return true;

  // 1. Verifica se o módulo está contratado no plano
  const moduleInPlan = await hasModuleAccess(tenantId, moduleId);
  if (!moduleInPlan) {
    return false;
  }

  // 2. Se a feature flag de políticas de papel estiver desligada, usa a matriz estática
  if (!isRolePoliciesEnabled()) {
    const staticActions = getStaticRolePermissions(role, moduleId);
    return staticActions.has(action);
  }

  // 3. Consulta políticas dinâmicas do banco com fallback para matriz estática
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT can_view, can_create, can_edit, can_approve, can_delete, can_export, can_admin
      FROM public.fiorix_saas_role_policies
      WHERE role = $1 AND module_id = $2 AND (tenant_id = $3 OR tenant_id IS NULL)
      ORDER BY CASE WHEN tenant_id = $3 THEN 0 ELSE 1 END
      LIMIT 1;
    `,
      role.toUpperCase(),
      moduleId,
      tenantId
    );

    if (rows.length > 0) {
      const r = rows[0];
      const map: Record<ModuleAction, boolean> = {
        view: Boolean(r.can_view),
        create: Boolean(r.can_create),
        edit: Boolean(r.can_edit),
        approve: Boolean(r.can_approve),
        delete: Boolean(r.can_delete),
        export: Boolean(r.can_export),
        admin: Boolean(r.can_admin),
      };
      return map[action] ?? false;
    }
  } catch {
    // Tabela fiorix_saas_role_policies ainda não criada ou transitória
  }

  const staticActions = getStaticRolePermissions(role, moduleId);
  return staticActions.has(action);
}

/**
 * Simulador de Permissões Efetivas para o Painel MASTER
 */
export interface PermissionSimulationResult {
  tenantId: string;
  planCode: string;
  role: string;
  modules: Array<{
    moduleId: string;
    moduleName: string;
    category: string;
    includedInPlan: boolean;
    allowedActions: ModuleAction[];
    deniedActions: ModuleAction[];
    reason: string;
  }>;
}

export async function simulateEffectivePermissions(
  tenantId: string,
  planTier: PlanTier,
  role: string
): Promise<PermissionSimulationResult> {
  const allowedModulesInPlan = getDefaultModulesForTier(planTier);

  const results: PermissionSimulationResult['modules'] = [];

  for (const def of CANONICAL_MODULES_LIST) {
    const includedInPlan = allowedModulesInPlan.includes(def.id);
    const roleActions = getStaticRolePermissions(role, def.id);

    const allowedActions: ModuleAction[] = [];
    const deniedActions: ModuleAction[] = [];

    def.supportedActions.forEach((act) => {
      if (includedInPlan && roleActions.has(act)) {
        allowedActions.push(act);
      } else {
        deniedActions.push(act);
      }
    });

    let reason = 'Acesso regular concedido pelo plano e papel.';
    if (!includedInPlan) {
      reason = `Módulo não contratado no plano ${planTier}.`;
    } else if (allowedActions.length === 0) {
      reason = `Papel ${role} não possui privilégios de acesso a este módulo.`;
    }

    results.push({
      moduleId: def.id,
      moduleName: def.name,
      category: def.categoryLabel,
      includedInPlan,
      allowedActions,
      deniedActions,
      reason,
    });
  }

  return {
    tenantId,
    planCode: planTier,
    role,
    modules: results,
  };
}

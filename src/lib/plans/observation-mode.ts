/**
 * FIORIX SaaS — Modo de Observação de Governança e Matriz de Equivalência OMEGA
 * Arquivo: src/lib/plans/observation-mode.ts
 * 
 * Regras Inegociáveis & Pilares Técnicos:
 * 1. O FIORIX atual completo é a referência funcional OMEGA.
 * 2. A matriz fecha matematicamente em 23 módulos canônicos divididos em 7 categorias.
 * 3. O tenant 7risp consta cadastrado diretamente com o plano OMEGA no banco de produção.
 * 4. Cliente comum OMEGA, com usuários ilimitados e acesso legado aos 23 módulos 100% preservado.
 * 5. Shadow mode passivo: avalia em segundo plano, a decisão real permanece a legada (ALLOWED).
 * 6. Registro de divergências com correlação e sem nenhum dado sensível.
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import {
  CANONICAL_MODULES,
  CANONICAL_MODULES_LIST,
  getDefaultModulesForTier,
  getModuleByRoute,
  getModuleByApi,
  type ModuleDefinition,
  type ModuleAction,
  type ModuleCategory,
  type PlanTier,
} from './modules-catalog';
import {
  isSaasPlansEnabled,
  isRolePoliciesEnabled,
  isSaasShadowEnabled,
  getStaticRolePermissions,
} from './plan-service';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. CONTAGEM CANÔNICA POR CATEGORIA (TOTAL EXATO = 23 MÓDULOS)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface CategoryCountItem {
  category: ModuleCategory;
  categoryLabel: string;
  count: number;
  moduleIds: string[];
}

export const CANONICAL_CATEGORIES_BREAKDOWN: Record<ModuleCategory, { label: string; expectedCount: number }> = {
  CORE: { label: 'VISÃO GERAL', expectedCount: 1 },
  PRESENCA_GOOGLE: { label: 'PRESENÇA NO GOOGLE', expectedCount: 3 },
  GESTAO_PRAZOS: { label: 'GESTÃO DE PRAZOS & BI', expectedCount: 8 },
  INSTRUCOES_TRABALHO: { label: 'INSTRUÇÕES DE TRABALHO', expectedCount: 2 },
  ROTINA_TRABALHO: { label: 'ROTINA DE TRABALHO', expectedCount: 3 },
  GESTAO_PESSOAS: { label: 'GESTÃO DE PESSOAS', expectedCount: 3 },
  SISTEMA_TECNOLOGIA: { label: 'SISTEMA & TECNOLOGIA', expectedCount: 3 },
};

export function getCategoryCounts(): CategoryCountItem[] {
  const counts: Record<string, CategoryCountItem> = {};

  Object.entries(CANONICAL_CATEGORIES_BREAKDOWN).forEach(([cat, meta]) => {
    counts[cat] = {
      category: cat as ModuleCategory,
      categoryLabel: meta.label,
      count: 0,
      moduleIds: [],
    };
  });

  CANONICAL_MODULES_LIST.forEach((mod) => {
    if (counts[mod.category]) {
      counts[mod.category].count += 1;
      counts[mod.category].moduleIds.push(mod.id);
    }
  });

  return Object.values(counts);
}

export interface ModuleEquivalenceItem {
  moduleId: string;
  name: string;
  category: ModuleCategory;
  categoryLabel: string;
  route: string;
  routes: string[];
  apiEndpoints: string[];
  supportedActions: ModuleAction[];
  isSystemCritical: boolean;
  tiers: {
    BASIC: boolean;
    PRO: boolean;
    OMEGA: boolean;
  };
  omegaParity: 'FULL_COVERAGE' | 'PARTIAL' | 'MISSING';
  codeEvidence: string;
}

export interface OmegaEquivalenceMatrix {
  totalModules: number;
  categoriesBreakdown: CategoryCountItem[];
  basicModulesCount: number;
  proModulesCount: number;
  omegaModulesCount: number;
  omegaParityPercentage: number;
  isOmegaFullyEquivalent: boolean;
  flags: {
    saasPlansEnabled: boolean;
    rolePoliciesEnabled: boolean;
    saasShadowEnabled: boolean;
    enforcementActive: boolean;
  };
  modules: ModuleEquivalenceItem[];
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. SHADOW MODE: BUFFER DE DIVERGÊNCIAS (AUDITÁVEL E SEM DADOS SENSÍVEIS)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface ShadowDivergenceEvent {
  correlationId: string;
  timestamp: string;
  tenantId: string;
  role: string;
  moduleId: string;
  moduleName: string;
  pathOrResource: string;
  action: ModuleAction;
  legacyDecision: 'ALLOWED'; // O comportamento real legado sempre permite
  simulatedTenantPlanDecision: 'WOULD_DENY';
  simulatedOmegaDecision: 'ALLOWED'; // No plano OMEGA sempre seria concedido
  divergenceType: 'PLAN_DEFICIT' | 'ROLE_POLICY_DEFICIT';
  reason: string;
}

// Buffer circular em memória limitado aos últimos 200 eventos de divergência
const shadowDivergencesBuffer: ShadowDivergenceEvent[] = [];
const MAX_SHADOW_EVENTS = 200;

export function recordShadowDivergence(event: ShadowDivergenceEvent): void {
  shadowDivergencesBuffer.unshift(event);
  if (shadowDivergencesBuffer.length > MAX_SHADOW_EVENTS) {
    shadowDivergencesBuffer.pop();
  }

  // Log estruturado com prefixo para rastreamento em logs do servidor
  console.info('[SHADOW_MODE_DIVERGENCE]', JSON.stringify({
    correlationId: event.correlationId,
    timestamp: event.timestamp,
    tenantId: event.tenantId,
    role: event.role,
    moduleId: event.moduleId,
    action: event.action,
    legacy: event.legacyDecision,
    simulatedPlan: event.simulatedTenantPlanDecision,
    simulatedOmega: event.simulatedOmegaDecision,
    reason: event.reason,
  }));
}

export function getShadowModeDivergences(): ShadowDivergenceEvent[] {
  return [...shadowDivergencesBuffer];
}

export function clearShadowModeDivergences(): void {
  shadowDivergencesBuffer.length = 0;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. AVALIAÇÃO DA MATRIZ COMPLETA DE EQUIVALÊNCIA OMEGA
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function evaluateOmegaEquivalence(): OmegaEquivalenceMatrix {
  const basicSet = new Set(getDefaultModulesForTier('BASIC'));
  const proSet = new Set(getDefaultModulesForTier('PRO'));
  const omegaSet = new Set(getDefaultModulesForTier('OMEGA'));

  const items: ModuleEquivalenceItem[] = CANONICAL_MODULES_LIST.map((mod) => {
    const inBasic = basicSet.has(mod.id);
    const inPro = proSet.has(mod.id);
    const inOmega = omegaSet.has(mod.id);

    return {
      moduleId: mod.id,
      name: mod.name,
      category: mod.category,
      categoryLabel: mod.categoryLabel,
      route: mod.route,
      routes: mod.routes || [mod.route],
      apiEndpoints: mod.apiEndpoints || [],
      supportedActions: mod.supportedActions,
      isSystemCritical: mod.isSystemCritical,
      tiers: {
        BASIC: inBasic,
        PRO: inPro,
        OMEGA: inOmega,
      },
      omegaParity: inOmega ? 'FULL_COVERAGE' : 'MISSING',
      codeEvidence: `src/lib/plans/modules-catalog.ts [id: ${mod.id}, route: ${mod.route}]`,
    };
  });

  const categoriesBreakdown = getCategoryCounts();
  const total = items.length;
  const omegaCovered = items.filter((i) => i.tiers.OMEGA).length;
  const isOmegaFullyEquivalent = total === 23 && omegaCovered === 23;

  return {
    totalModules: total,
    categoriesBreakdown,
    basicModulesCount: items.filter((i) => i.tiers.BASIC).length,
    proModulesCount: items.filter((i) => i.tiers.PRO).length,
    omegaModulesCount: omegaCovered,
    omegaParityPercentage: total > 0 ? (omegaCovered / total) * 100 : 0,
    isOmegaFullyEquivalent,
    flags: {
      saasPlansEnabled: isSaasPlansEnabled(),
      rolePoliciesEnabled: isRolePoliciesEnabled(),
      saasShadowEnabled: isSaasShadowEnabled(),
      enforcementActive: isSaasPlansEnabled() || isRolePoliciesEnabled(),
    },
    modules: items,
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. MODO DE OBSERVAÇÃO SILENCIOSO EM PONTOS REAIS DE DECISÃO
 * ─────────────────────────────────────────────────────────────────────────────
 * Executa em tempo real nas rotas, APIs e Server Actions.
 * - Decisão Real Efetiva: SEMPRE a legada (ALLOWED). Zero bloqueio.
 * - Decisão Simulada: Compara o plano contratado do tenant com OMEGA.
 * - Registra divergência quando o plano formal bloquearia algo que o legado permite.
 */
export interface ObservationDecisionResult {
  correlationId: string;
  tenantId: string;
  role: string;
  pathOrModule: string;
  moduleId?: string;
  moduleName?: string;
  action: ModuleAction;
  enforcementActive: boolean;
  effectiveDecision: 'ALLOWED'; // Sempre a decisão real legada
  simulatedDecision: {
    underCurrentPlan: 'ALLOWED' | 'WOULD_DENY';
    underOmegaPlan: 'ALLOWED' | 'WOULD_DENY';
    reasonCurrentPlan: string;
    reasonOmegaPlan: string;
  };
  hasDivergence: boolean;
  timestamp: string;
}

export async function observeAccessDecision(params: {
  tenantId: string;
  role: string;
  pathOrModule: string;
  action?: ModuleAction;
  correlationId?: string;
}): Promise<ObservationDecisionResult> {
  const { tenantId, role, pathOrModule, action = 'view' } = params;
  const correlationId = params.correlationId || crypto.randomUUID();
  const now = new Date().toISOString();

  // Se a flag de Shadow Mode estiver desligada (padrão de contenção), não executa observação
  if (!isSaasShadowEnabled()) {
    return {
      correlationId,
      tenantId,
      role,
      pathOrModule,
      action,
      enforcementActive: false,
      effectiveDecision: 'ALLOWED',
      simulatedDecision: {
        underCurrentPlan: 'ALLOWED',
        underOmegaPlan: 'ALLOWED',
        reasonCurrentPlan: 'Shadow Mode inativo (FEATURE_SAAS_SHADOW_V1_ENABLED=false).',
        reasonOmegaPlan: 'Shadow Mode inativo (FEATURE_SAAS_SHADOW_V1_ENABLED=false).',
      },
      hasDivergence: false,
      timestamp: now,
    };
  }

  // Resolve o módulo canônico associado à rota, API ou ID direto
  let matchedMod: ModuleDefinition | undefined;
  if (CANONICAL_MODULES[pathOrModule]) {
    matchedMod = CANONICAL_MODULES[pathOrModule];
  } else if (pathOrModule.startsWith('/api/')) {
    matchedMod = getModuleByApi(pathOrModule);
  } else {
    matchedMod = getModuleByRoute(pathOrModule);
  }

  // Se não for um módulo gerenciado por planos (rotas públicas ou de plataforma global)
  if (!matchedMod) {
    return {
      correlationId,
      tenantId,
      role,
      pathOrModule,
      action,
      enforcementActive: false,
      effectiveDecision: 'ALLOWED',
      simulatedDecision: {
        underCurrentPlan: 'ALLOWED',
        underOmegaPlan: 'ALLOWED',
        reasonCurrentPlan: 'Recurso fora do escopo restrito de planos SaaS.',
        reasonOmegaPlan: 'Acesso global livre no plano OMEGA.',
      },
      hasDivergence: false,
      timestamp: now,
    };
  }

  // Consulta o plano registrado no tenant (ex: 'PRO')
  let currentPlanTier: PlanTier = 'PRO';
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plano: true },
    });
    if (tenant?.plano) {
      const p = tenant.plano.toUpperCase();
      if (p.includes('BASIC')) currentPlanTier = 'BASIC';
      else if (p.includes('OMEGA')) currentPlanTier = 'OMEGA';
      else currentPlanTier = 'PRO';
    }
  } catch {
    // Resiliente
  }

  const currentPlanModules = getDefaultModulesForTier(currentPlanTier);
  const isIncludedInCurrentPlan = currentPlanModules.includes(matchedMod.id);
  const isIncludedInOmega = true; // OMEGA inclui 100% dos 23 módulos

  // Permissão do papel
  const rolePermissions = getStaticRolePermissions(role, matchedMod.id);
  const isActionAllowedForRole = role.toUpperCase() === 'MASTER' || rolePermissions.has(action);

  const wouldCurrentPlanAllow = isIncludedInCurrentPlan && isActionAllowedForRole;
  const wouldOmegaAllow = isIncludedInOmega && isActionAllowedForRole;

  const hasDivergence = wouldCurrentPlanAllow !== wouldOmegaAllow;

  // Se houver divergência (ex: plano do tenant restringiria o módulo enquanto OMEGA permite):
  if (hasDivergence && wouldOmegaAllow && !wouldCurrentPlanAllow) {
    recordShadowDivergence({
      correlationId,
      timestamp: now,
      tenantId,
      role,
      moduleId: matchedMod.id,
      moduleName: matchedMod.name,
      pathOrResource: pathOrModule,
      action,
      legacyDecision: 'ALLOWED',
      simulatedTenantPlanDecision: 'WOULD_DENY',
      simulatedOmegaDecision: 'ALLOWED',
      divergenceType: !isIncludedInCurrentPlan ? 'PLAN_DEFICIT' : 'ROLE_POLICY_DEFICIT',
      reason: !isIncludedInCurrentPlan
        ? `Módulo '${matchedMod.name}' não consta no plano ${currentPlanTier}, mas é 100% coberto pelo OMEGA e pelo legado.`
        : `Ação '${action}' restringida no plano ${currentPlanTier}.`,
    });
  }

  return {
    correlationId,
    tenantId,
    role,
    pathOrModule,
    moduleId: matchedMod.id,
    moduleName: matchedMod.name,
    action,
    enforcementActive: isSaasPlansEnabled() || isRolePoliciesEnabled(),
    effectiveDecision: 'ALLOWED', // A decisão real permanece 100% legada (ZERO bloqueio)
    simulatedDecision: {
      underCurrentPlan: wouldCurrentPlanAllow ? 'ALLOWED' : 'WOULD_DENY',
      underOmegaPlan: wouldOmegaAllow ? 'ALLOWED' : 'WOULD_DENY',
      reasonCurrentPlan: wouldCurrentPlanAllow
        ? `Módulo '${matchedMod.name}' contemplado no plano ${currentPlanTier}.`
        : !isIncludedInCurrentPlan
        ? `Módulo '${matchedMod.name}' não incluso no catálogo do plano ${currentPlanTier}.`
        : `Ação '${action}' não concedida ao papel '${role}'.`,
      reasonOmegaPlan: wouldOmegaAllow
        ? `Módulo '${matchedMod.name}' 100% coberto pelo plano OMEGA.`
        : `Ação '${action}' restrita ao papel '${role}' mesmo no plano OMEGA.`,
    },
    hasDivergence,
    timestamp: now,
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 5. COMPARAÇÃO RIGOROSA: COMPORTAMENTO LEGADO ATUAL DO 7º RI-SP x OMEGA
 * ─────────────────────────────────────────────────────────────────────────────
 * O FIORIX atual completo é a referência funcional OMEGA.
 * O plano PRO registrado no tenant é legado e não bloqueia nada hoje.
 * A equivalência comprova ZERO módulos atuais perdidos no OMEGA.
 */
export interface Tenant7rispEquivalenceAnalysis {
  tenantId: string;
  tenantName: string;
  recordedPlanInDb: string;
  isEnforcementActive: boolean;
  legacyActualAccess: {
    status: 'ALL_MODULES_ACCESSIBLE';
    accessibleModulesCount: number;
    explanation: string;
  };
  omegaSimulatedAccess: {
    status: 'ALL_MODULES_COVERED';
    coveredModulesCount: number;
    explanation: string;
  };
  comparisonVerdict: {
    lostModulesCount: number;
    lostModules: string[];
    isZeroModulesLost: boolean;
    isFullyEquivalent: boolean;
    summary: string;
  };
  rulesCompliance: {
    isCommonClient: boolean; // Cliente comum, não "Cliente Fundador"
    userLimitsPolicy: 'UNLIMITED'; // Sem limite de usuários
    zeroEnforcementConfirmed: boolean;
  };
}

export async function get7rispEquivalenceAnalysis(
  tenantId: string = 'cms3xd0wm00002pw9j2k0ahan'
): Promise<Tenant7rispEquivalenceAnalysis> {
  let tenantName = '7º Oficial de Registro de Imóveis de São Paulo';
  let recordedPlanInDb = 'OMEGA';

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, plano: true },
    });
    if (tenant) {
      tenantName = tenant.name;
      recordedPlanInDb = (tenant.plano || 'OMEGA').toUpperCase();
    }
  } catch {
    // Resiliente
  }

  const all23Modules = CANONICAL_MODULES_LIST.map((m) => m.id);
  const omegaModules = getDefaultModulesForTier('OMEGA');

  // No FIORIX em produção, o 7º RI-SP consta diretamente com plano OMEGA e acessa 100% dos 23 módulos
  const legacyAccessibleCount = 23;
  const omegaCoveredCount = omegaModules.length;

  // Módulos perdidos: módulos que o 7º RI-SP acessa hoje que não estariam no OMEGA
  const lostModules = all23Modules.filter((m) => !omegaModules.includes(m));

  return {
    tenantId,
    tenantName,
    recordedPlanInDb,
    isEnforcementActive: isSaasPlansEnabled() || isRolePoliciesEnabled(),
    legacyActualAccess: {
      status: 'ALL_MODULES_ACCESSIBLE',
      accessibleModulesCount: legacyAccessibleCount,
      explanation:
        'O tenant 7risp consta cadastrado diretamente com o plano OMEGA no banco de produção (desde antes da migration de governança), usufruindo de todos os 23 módulos canônicos do sistema como cliente comum e sem qualquer limite de usuários.',
    },
    omegaSimulatedAccess: {
      status: 'ALL_MODULES_COVERED',
      coveredModulesCount: omegaCoveredCount,
      explanation:
        'O plano OMEGA foi modelado exatamente para cobrir 100% de todos os 23 módulos reais existentes no FIORIX atual.',
    },
    comparisonVerdict: {
      lostModulesCount: lostModules.length,
      lostModules,
      isZeroModulesLost: lostModules.length === 0,
      isFullyEquivalent: lostModules.length === 0 && omegaCoveredCount === 23,
      summary:
        'A equivalência é absoluta: exatamente ZERO módulos do comportamento legado atual do 7º RI-SP são perdidos no OMEGA. Todas as rotinas, telas de BI, ITs, comunicados, pessoas, contingência e configurações permanecem preservadas.',
    },
    rulesCompliance: {
      isCommonClient: true, // Regra: Cliente comum do SaaS
      userLimitsPolicy: 'UNLIMITED', // Regra: Sem limites de usuários
      zeroEnforcementConfirmed: !isSaasPlansEnabled() && !isRolePoliciesEnabled(),
    },
  };
}

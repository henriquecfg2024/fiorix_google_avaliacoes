/**
 * FIORIX — Fase 6.0 | Contrato técnico do motor granular (Cliente → Departamento → Usuário)
 *
 * SOMENTE CONTRATO. Não integrado a rotas, menus, APIs ou páginas.
 * Nenhum arquivo de `src/app` ou `src/components` pode importar este módulo
 * nesta fase (garantido por teste estático).
 *
 * Identidade: o sujeito é identificado exclusivamente por `userId` (ID
 * imutável de `public."User"`). Não existe campo de e-mail neste contrato.
 */

export const GRANULAR_ACTIONS = ['view', 'create', 'edit', 'approve', 'export', 'admin', 'delete'] as const;
export type GranularAction = (typeof GRANULAR_ACTIONS)[number];

/** Escopos de regra/suspensão. */
export type AccessScopeLevel = 'GLOBAL' | 'TENANT' | 'DEPARTMENT' | 'USER' | 'ROLE';

/**
 * Espaço da requisição.
 * - TENANT_OPERATIONAL: dados operacionais de um cliente.
 * - MASTER_SAAS: espaço administrativo da plataforma (Decisão MASTER nº 1).
 */
export type AccessSpace = 'TENANT_OPERATIONAL' | 'MASTER_SAAS';

/**
 * FULL    → acesso concedido pelas regras granulares.
 * MINIMAL → modo mínimo seguro (Início), Decisão MASTER nº 4.
 * NONE    → negado.
 * LEGACY  → decisão do modelo legado repassada sem alteração.
 */
export type AccessDecisionMode = 'FULL' | 'MINIMAL' | 'NONE' | 'LEGACY';

export type AccessReasonCode =
  | 'ALLOWED'
  | 'MINIMAL_SAFE_MODE'
  | 'MASTER_SAAS_SPACE'
  | 'MASTER_SAAS_ONLY'
  | 'SUPPORT_MODE_REQUIRED'
  | 'INVALID_INPUT'
  | 'TENANT_SERVICE_INACTIVE'
  | 'SUSPENDED'
  | 'USER_DENY'
  | 'DEPARTMENT_DENY'
  | 'NO_RULE'
  | 'ACTION_NOT_ALLOWED'
  | 'CONFIG_MASTER_ONLY'
  | 'RESOLVER_ERROR'
  | 'LEGACY_PASSTHROUGH';

export type RuleEffect = 'ALLOW' | 'DENY';

export interface AccessSubject {
  /** ID imutável de public."User" (derivado da sessão no servidor). */
  userId: string;
  tenantId: string | null;
  role: string;
}

export interface AccessRequest {
  subject: AccessSubject;
  /** Nó do catálogo canônico (módulo/menu/submenu/ação). */
  nodeId: string;
  /** Ancestrais do nó, do mais alto ao mais próximo (P8 — hierarquia). */
  ancestorIds?: readonly string[];
  action: GranularAction;
  space: AccessSpace;
}

export interface GranularRule {
  effect: RuleEffect;
  /** Teto de ações (interseção com o papel — P6). Ausente = sem teto adicional. */
  actionCeiling?: readonly GranularAction[];
}

export interface GranularSuspension {
  scope: AccessScopeLevel;
  /** null somente para GLOBAL. */
  targetId: string | null;
  nodeId: string;
}

/**
 * Fotografia já resolvida no servidor para uma decisão. O carregamento do
 * snapshot (banco) NÃO faz parte desta fase.
 */
export interface GranularSnapshot {
  /** C1 — nós ativos e vigentes para o cliente. */
  tenantActiveNodeIds: readonly string[];
  /** C4 — suspensões explícitas do MASTER. */
  suspensions: readonly GranularSuspension[];
  /** Regras individuais do usuário por nó (P3). */
  userRules: Readonly<Record<string, GranularRule>>;
  /** Departamentos de implantação do usuário (IDs imutáveis). */
  departmentIds: readonly string[];
  primaryDepartmentId: string | null;
  /** Regras por departamento → nó (P4/P5). */
  departmentRules: Readonly<Record<string, Readonly<Record<string, GranularRule>>>>;
  /** C3 — ações do tipo de usuário por nó. */
  roleActions: Readonly<Record<string, readonly GranularAction[]>>;
  /** Ações suportadas pelo nó no catálogo canônico. */
  nodeSupportedActions: Readonly<Record<string, readonly GranularAction[]>>;
}

export interface AccessDecision {
  allowed: boolean;
  mode: AccessDecisionMode;
  reason: AccessReasonCode;
  /** Escopo que determinou a decisão, quando aplicável. */
  decidedBy: AccessScopeLevel | 'ENGINE' | 'LEGACY' | null;
  engine: 'GRANULAR' | 'LEGACY';
  nodeId: string | null;
  action: GranularAction | null;
  /** Ações efetivamente permitidas no nó (vazio quando negado). */
  allowedActions: GranularAction[];
}

/**
 * Modo do motor. Nesta fase é constante: somente LEGACY_ONLY.
 * Não há variável de ambiente nem flag nova (decisão D10 pendente).
 */
export type GranularEngineMode = 'LEGACY_ONLY' | 'GRANULAR_ENFORCED';

export type TargetType = 'ROLE' | 'USER' | 'PERFIL' | 'COLABORADOR';

export type UiTargetMode = 'PERFIL' | 'COLABORADOR';

export type OverrideValue = 'ALLOW' | 'DENY';

export type EffectiveAccessStatus =
  | 'ALLOWED_INHERITED'
  | 'DENIED_INHERITED'
  | 'ALLOWED_INDIVIDUAL'
  | 'DENIED_INDIVIDUAL'
  | 'BLOCKED_BY_SYSTEM'
  | 'PROTECTED_SYSTEM';

export interface NavCatalogItem {
  id: string;
  label: string;
  href: string;
  description?: string;
  groupId: string;
  groupLabel: string;
  /** Roles mínimos exigidos no servidor pelo código legado (guardas estruturais) */
  structuralRoles?: string[];
  /** Se o item é exclusivo do MASTER (não editável) */
  isMasterOnly?: boolean;
  /** Se o item é rota base pós-login ou essencial (não editável) */
  isProtected?: boolean;
  /** Se a rota é compartilhada com outro item por URL/query */
  sharedWithId?: string;
  sharedNote?: string;
}

export interface NavCatalogGroup {
  id: string;
  label: string;
  href?: string;
  items: NavCatalogItem[];
  isMasterOnly?: boolean;
}

export interface RoleRuleRecord {
  id?: string;
  tenantId: string;
  role: string;
  itemId: string;
  visible: boolean;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface UserRuleRecord {
  id?: string;
  tenantId: string;
  userId: string;
  itemId: string;
  override: OverrideValue;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface ItemEffectiveState {
  item: NavCatalogItem;
  roleRule: boolean | null; // true = ALLOW, false = DENY, null = sem regra (usa legado)
  userOverride: OverrideValue | null; // 'ALLOW' | 'DENY' | null (herdar)
  effectiveStatus: EffectiveAccessStatus;
  effectiveAllowed: boolean;
  isBlockedBySystem: boolean;
  blockedReason?: string;
}

export interface NavPermissionsGroupView {
  id: string;
  label: string;
  href?: string;
  items: ItemEffectiveState[];
}

export interface NavPermissionsTreeResponse {
  groups: NavPermissionsGroupView[];
  itemsState: ItemEffectiveState[];
  isFlagActive: boolean;
}

export interface TenantContextItem {
  id: string;
  name: string;
  status: string;
  plano?: string | null;
  cidade?: string;
  estado?: string;
}

export interface EligibleUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  departamento?: string | null;
  cargo?: string | null;
  status: string;
}

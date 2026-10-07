import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit';
import { filterNavigationByRole } from '@/lib/navigation/permissions';
import {
  ALL_NAV_CATALOG_ITEMS,
  ITEM_BY_ID,
  NAV_CATALOG_GROUPS,
  checkStructuralRestriction,
} from './catalog';
import {
  ItemEffectiveState,
  NavCatalogItem,
  NavPermissionsTreeResponse,
  OverrideValue,
  RoleRuleRecord,
  TargetType,
  UserRuleRecord,
} from './types';

export const NAV_PERMISSIONS_FLAG = 'FEATURE_NAV_PERMISSIONS_V1_ENABLED';

export function isNavPermissionsFeatureEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env[NAV_PERMISSIONS_FLAG] === 'true';
}

/**
 * Deriva se o item do catálogo é visível no menu legado para o papel informado.
 */
export function isItemVisibleInLegacy(item: NavCatalogItem, role: string): boolean {
  if (item.isMasterOnly) return role === 'MASTER';
  const filtered = filterNavigationByRole(role);
  for (const group of Object.values(filtered)) {
    if ((group as any).href === item.href) return true;
    if (group.items?.some((i) => i.href === item.href)) return true;
  }
  return false;
}

/**
 * Lê as regras salvas para um perfil na organização selecionada.
 * Resiliente: se a tabela ainda não existir, retorna lista vazia.
 */
export async function getRoleRulesFromDb(tenantId: string, role: string): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT item_id, visible FROM public.fiorix_nav_role_rules WHERE tenant_id = $1 AND role = $2`,
      tenantId,
      role
    );
    for (const r of rows) {
      map.set(r.item_id, Boolean(r.visible));
    }
  } catch (err: any) {
    // Tabela ainda não aplicada no ambiente - retorna mapa vazio (preserva legado)
  }
  return map;
}

/**
 * Lê as regras salvas para um colaborador na organização selecionada.
 * Resiliente: se a tabela ainda não existir, retorna lista vazia.
 */
export async function getUserRulesFromDb(tenantId: string, userId: string): Promise<Map<string, OverrideValue>> {
  const map = new Map<string, OverrideValue>();
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT item_id, override FROM public.fiorix_nav_user_rules WHERE tenant_id = $1 AND user_id = $2`,
      tenantId,
      userId
    );
    for (const r of rows) {
      map.set(r.item_id, r.override as OverrideValue);
    }
  } catch (err: any) {
    // Tabela ainda não aplicada no ambiente - retorna mapa vazio (preserva legado)
  }
  return map;
}

/**
 * Calcula o estado efetivo de cada item do catálogo para o alvo (ROLE/PERFIL ou USER/COLABORADOR)
 */
export async function computeNavPermissionsState(params: {
  tenantId: string;
  targetType: TargetType;
  targetId: string; // role ou userId
  userRole?: string; // no modo USER, a role de origem do colaborador
}): Promise<NavPermissionsTreeResponse> {
  const { tenantId, targetType, targetId, userRole } = params;
  const isFlagActive = isNavPermissionsFeatureEnabled();

  const isRoleMode = targetType === 'ROLE' || targetType === 'PERFIL';
  const effectiveRole = isRoleMode ? targetId : (userRole || 'USER');

  // 1. Busca regras de perfil da role correspondente
  const roleRules = await getRoleRulesFromDb(tenantId, effectiveRole);

  // 2. Se for modo USER/COLABORADOR, busca regras individuais
  const userRules = !isRoleMode ? await getUserRulesFromDb(tenantId, targetId) : new Map();

  const itemsState: ItemEffectiveState[] = ALL_NAV_CATALOG_ITEMS.map((item) => {
    const roleRuleVal = roleRules.has(item.id) ? roleRules.get(item.id)! : null;
    const userOverrideVal = userRules.has(item.id) ? userRules.get(item.id)! : null;

    // A. Verifica guarda estrutural no servidor
    const structuralCheck = checkStructuralRestriction(item, effectiveRole);

    let effectiveAllowed = false;
    let effectiveStatus: ItemEffectiveState['effectiveStatus'] = 'ALLOWED_INHERITED';

    if (structuralCheck.isBlocked) {
      effectiveAllowed = false;
      effectiveStatus = item.isMasterOnly || item.isProtected ? 'PROTECTED_SYSTEM' : 'BLOCKED_BY_SYSTEM';
    } else if (!isRoleMode && userOverrideVal === 'ALLOW') {
      effectiveAllowed = true;
      effectiveStatus = 'ALLOWED_INDIVIDUAL';
    } else if (!isRoleMode && userOverrideVal === 'DENY') {
      effectiveAllowed = false;
      effectiveStatus = 'DENIED_INDIVIDUAL';
    } else {
      // Herança da Role ou Legado
      if (roleRuleVal !== null) {
        effectiveAllowed = roleRuleVal;
        effectiveStatus = roleRuleVal ? 'ALLOWED_INHERITED' : 'DENIED_INHERITED';
      } else {
        // Fallback Legado
        const legacyAllowed = isItemVisibleInLegacy(item, effectiveRole);
        effectiveAllowed = legacyAllowed;
        effectiveStatus = legacyAllowed ? 'ALLOWED_INHERITED' : 'DENIED_INHERITED';
      }
    }

    return {
      item,
      roleRule: roleRuleVal,
      userOverride: userOverrideVal,
      effectiveStatus,
      effectiveAllowed,
      isBlockedBySystem: structuralCheck.isBlocked,
      blockedReason: structuralCheck.reason,
    };
  });

  const stateMap = new Map(itemsState.map((s) => [s.item.id, s]));
  const groups = NAV_CATALOG_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    href: g.href,
    items: g.items.map((item) => stateMap.get(item.id)!),
  }));

  return { groups, itemsState, isFlagActive };
}

/**
 * Salva lote de permissões com validação atômica, auditoria e sincronização de rotas compartilhadas.
 */
export async function saveNavPermissionsBatch(params: {
  tenantId: string;
  targetType: TargetType;
  targetId: string;
  changes: Array<{
    itemId: string;
    action: 'HERDAR' | 'ALLOW' | 'DENY';
  }>;
  masterUser: { id: string; name?: string | null; email?: string | null; role: string };
  targetRoleForUser?: string;
}): Promise<{ success: boolean; updatedCount: number; message: string }> {
  const { tenantId, targetType, targetId, changes, masterUser, targetRoleForUser } = params;

  if (masterUser.role !== 'MASTER') {
    throw new Error('Acesso negado: somente o MASTER pode alterar permissões de menu.');
  }

  const isRoleMode = targetType === 'ROLE' || targetType === 'PERFIL';

  // Não permite editar conta MASTER
  if (!isRoleMode) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { role: true, tenantId: true },
    });
    if (!targetUser || targetUser.tenantId !== tenantId) {
      throw new Error('Usuário alvo inválido ou pertencente a outra organização.');
    }
    if (targetUser.role === 'MASTER') {
      throw new Error('Contas com papel MASTER não podem ter permissões editadas.');
    }
  }

  // Expande e sincroniza rotas compartilhadas (ex: gestao_comunicados e gestao_pessoas)
  const normalizedChangesMap = new Map<string, 'HERDAR' | 'ALLOW' | 'DENY'>();
  for (const c of changes) {
    const item = ITEM_BY_ID.get(c.itemId);
    if (!item) continue;

    // Impede alterar itens exclusivos do MASTER ou protegidos
    if (item.isMasterOnly || item.isProtected) continue;

    // Se houver restrição estrutural intransponível, não permite ativação
    const roleForCheck = isRoleMode ? targetId : (targetRoleForUser || 'USER');
    const restriction = checkStructuralRestriction(item, roleForCheck);
    if (restriction.isBlocked && c.action === 'ALLOW') {
      throw new Error(`O item "${item.label}" está bloqueado pelo sistema para o perfil ${roleForCheck}.`);
    }

    normalizedChangesMap.set(c.itemId, c.action);

    // Sincroniza rota compartilhada se houver
    if (item.sharedWithId && !normalizedChangesMap.has(item.sharedWithId)) {
      normalizedChangesMap.set(item.sharedWithId, c.action);
    }
  }

  let updatedCount = 0;

  // Execução atômica em transação
  await prisma.$transaction(async (tx) => {
    for (const [itemId, action] of normalizedChangesMap.entries()) {
      if (isRoleMode) {
        const isVisible = action === 'ALLOW';
        await tx.$executeRawUnsafe(
          `INSERT INTO public.fiorix_nav_role_rules 
             (id, tenant_id, role, item_id, visible, created_at, updated_at, updated_by)
           VALUES 
             (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW(), $5)
           ON CONFLICT (tenant_id, role, item_id)
           DO UPDATE SET 
             visible = EXCLUDED.visible,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by`,
          tenantId,
          targetId,
          itemId,
          isVisible,
          masterUser.id
        );
        updatedCount++;
      } else {
        // Modo USER
        if (action === 'HERDAR') {
          // Remover exceção individual (volta para herança)
          await tx.$executeRawUnsafe(
            `DELETE FROM public.fiorix_nav_user_rules 
             WHERE tenant_id = $1 AND user_id = $2 AND item_id = $3`,
            tenantId,
            targetId,
            itemId
          );
        } else {
          // ALLOW ou DENY explícito
          await tx.$executeRawUnsafe(
            `INSERT INTO public.fiorix_nav_user_rules 
               (id, tenant_id, user_id, item_id, override, created_at, updated_at, updated_by)
             VALUES 
               (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW(), $5)
             ON CONFLICT (tenant_id, user_id, item_id)
             DO UPDATE SET 
               override = EXCLUDED.override,
               updated_at = NOW(),
               updated_by = EXCLUDED.updated_by`,
            tenantId,
            targetId,
            itemId,
            action,
            masterUser.id
          );
        }
        updatedCount++;
      }
    }
  });

  // Registra auditoria
  await recordAuditLog({
    modulo: 'PERMISSOES_MENU' as any,
    acao: 'ALTERACAO',
    registroId: `${targetType}:${targetId}`,
    registroDescricao: `Atualização de ${updatedCount} regras de menu para ${targetType} [${targetId}] no tenant [${tenantId}]`,
    detalhes: {
      tenantId,
      targetType,
      targetId,
      alteracoes: Array.from(normalizedChangesMap.entries()).map(([itemId, action]) => ({ itemId, action })),
    },
    userOverride: masterUser as any,
  });

  return {
    success: true,
    updatedCount,
    message: `Permissões salvas com sucesso (${updatedCount} itens atualizados).`,
  };
}

/**
 * Obtém a navegação dinâmica efetiva para o usuário logado no tenant atual.
 * Se a feature flag estiver desativada, retorna exatamente o comportamento legado.
 */
export async function getEffectiveUserNavigation(user: {
  id: string;
  role: string;
  tenantId: string;
}): Promise<Record<string, any>> {
  if (!isNavPermissionsFeatureEnabled()) {
    return filterNavigationByRole(user.role);
  }

  // Se MASTER, mantém navegação completa de MASTER
  if (user.role === 'MASTER') {
    return filterNavigationByRole('MASTER');
  }

  const roleRules = await getRoleRulesFromDb(user.tenantId, user.role);
  const userRules = await getUserRulesFromDb(user.tenantId, user.id);

  const filteredGroups: Record<string, any> = {};

  for (const group of NAV_CATALOG_GROUPS) {
    if (group.isMasterOnly) continue;

    // Avalia os itens do grupo
    const visibleItems = group.items.filter((item) => {
      // 1. Guarda estrutural
      const structural = checkStructuralRestriction(item, user.role);
      if (structural.isBlocked) return false;

      // 2. Exceção individual de usuário
      if (userRules.has(item.id)) {
        return userRules.get(item.id) === 'ALLOW';
      }

      // 3. Regra de perfil
      if (roleRules.has(item.id)) {
        return roleRules.get(item.id) === true;
      }

      // 4. Fallback legado
      return isItemVisibleInLegacy(item, user.role);
    });

    const isGroupHrefVisible = group.href
      ? visibleItems.some((i) => i.href === group.href) ||
        (group.items.length === 0 &&
          (userRules.has(group.id)
            ? userRules.get(group.id) === 'ALLOW'
            : roleRules.has(group.id)
            ? roleRules.get(group.id) === true
            : isItemVisibleInLegacy({ id: group.id, href: group.href } as any, user.role)))
      : false;

    if (visibleItems.length > 0 || isGroupHrefVisible) {
      filteredGroups[group.id] = {
        label: group.label,
        href: group.href,
        items: visibleItems.map((vi) => ({
          id: vi.id,
          label: vi.label,
          href: vi.href,
          description: vi.description,
        })),
      };
    }
  }

  return filteredGroups;
}

/**
 * Avalia se o usuário tem permissão para acessar a rota dada.
 * Se a flag estiver desligada, permite o acesso (preserva legado).
 */
export async function isRouteAllowedForUser(
  pathname: string,
  user: { id: string; role: string; tenantId: string }
): Promise<boolean> {
  if (!isNavPermissionsFeatureEnabled()) return true;
  if (user.role === 'MASTER') return true;

  if (pathname === '/dashboard' || pathname === '/') return true;

  const matchingItem = ALL_NAV_CATALOG_ITEMS.find((item) => {
    if (item.href === pathname) return true;
    if (item.href.includes('?') && item.href.split('?')[0] === pathname) return true;
    return false;
  });

  if (!matchingItem) {
    return true;
  }

  // 1. Guarda estrutural
  const structural = checkStructuralRestriction(matchingItem, user.role);
  if (structural.isBlocked) return false;

  // 2. Exceção do usuário
  const userRules = await getUserRulesFromDb(user.tenantId, user.id);
  if (userRules.has(matchingItem.id)) {
    return userRules.get(matchingItem.id) === 'ALLOW';
  }

  // 3. Regra de perfil
  const roleRules = await getRoleRulesFromDb(user.tenantId, user.role);
  if (roleRules.has(matchingItem.id)) {
    return roleRules.get(matchingItem.id) === true;
  }

  // 4. Fallback legado
  return isItemVisibleInLegacy(matchingItem, user.role);
}

/**
 * Retorna os IDs dos itens permitidos para o usuário.
 * Se a flag estiver desligada, retorna enabled: false (usar legado).
 */
export async function getAllowedNavItemsForUser(user: {
  id: string;
  role: string;
  tenantId: string;
}): Promise<{ enabled: boolean; allowedItemIds: string[] }> {
  if (!isNavPermissionsFeatureEnabled()) {
    return { enabled: false, allowedItemIds: [] };
  }

  // Se for MASTER, tem acesso a tudo
  if (user.role === 'MASTER') {
    return {
      enabled: true,
      allowedItemIds: ALL_NAV_CATALOG_ITEMS.map((i) => i.id),
    };
  }

  const roleRules = await getRoleRulesFromDb(user.tenantId, user.role);
  const userRules = await getUserRulesFromDb(user.tenantId, user.id);

  const allowedItemIds: string[] = [];

  for (const item of ALL_NAV_CATALOG_ITEMS) {
    if (item.isMasterOnly) continue;

    // 1. Guarda estrutural
    const structural = checkStructuralRestriction(item, user.role);
    if (structural.isBlocked) continue;

    // 2. Exceção do usuário
    if (userRules.has(item.id)) {
      if (userRules.get(item.id) === 'ALLOW') {
        allowedItemIds.push(item.id);
      }
      continue;
    }

    // 3. Regra de perfil
    if (roleRules.has(item.id)) {
      if (roleRules.get(item.id) === true) {
        allowedItemIds.push(item.id);
      }
      continue;
    }

    // 4. Fallback legado
    if (isItemVisibleInLegacy(item, user.role)) {
      allowedItemIds.push(item.id);
    }
  }

  return {
    enabled: true,
    allowedItemIds,
  };
}

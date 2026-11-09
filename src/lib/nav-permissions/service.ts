import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit';
import { filterNavigationByRole } from '@/lib/navigation/permissions';
import { getHomeRouteForRole } from '@/lib/permissions';
import {
  ALL_NAV_CATALOG_ITEMS,
  ITEM_BY_ID,
  NAV_CATALOG_GROUPS,
  checkStructuralRestriction,
} from './catalog';
import {
  DepartmentUserOverrideSummary,
  ItemEffectiveState,
  NavCatalogItem,
  NavPermissionsTreeResponse,
  OverrideValue,
  TargetType,
} from './types';

export const NAV_PERMISSIONS_FLAG = 'FEATURE_NAV_PERMISSIONS_V1_ENABLED';

export function isNavPermissionsFeatureEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env[NAV_PERMISSIONS_FLAG] !== 'false';
}

/**
 * Deriva se o item do catálogo é visível no menu legado para o papel informado.
 */
export function isItemVisibleInLegacy(item: NavCatalogItem, role: string): boolean {
  if (item.isMasterOnly) return role === 'MASTER';
  if (item.id === 'inicio' || item.href === '/dashboard') {
    const upper = String(role || '').toUpperCase();
    return ['MASTER', 'ADMIN', 'SUBSTITUTO', 'VISITANTE', 'USER'].includes(upper);
  }
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
export async function getRoleRulesFromDb(
  tenantId: string,
  role: string
): Promise<Map<string, boolean>> {
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
    if (!map.has('historico_documental') && map.has('gestao_documental')) {
      map.set('historico_documental', map.get('gestao_documental')!);
    }
  } catch {
    // Tabela ainda não aplicada no ambiente - retorna mapa vazio (preserva legado)
  }
  return map;
}

/**
 * Lê as regras salvas para um departamento na organização selecionada.
 * Comparação case-insensitive e sem espaços excedentes.
 */
export async function getDepartmentRulesFromDb(
  tenantId: string,
  departamento?: string | null
): Promise<Map<string, OverrideValue>> {
  const map = new Map<string, OverrideValue>();
  const trimmed = (departamento || '').trim();
  if (!trimmed) return map;

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT item_id, override
       FROM public.fiorix_nav_department_rules
       WHERE tenant_id = $1 AND LOWER(TRIM(departamento)) = LOWER(TRIM($2))`,
      tenantId,
      trimmed
    );
    for (const r of rows) {
      map.set(r.item_id, r.override as OverrideValue);
    }
    if (!map.has('historico_documental') && map.has('gestao_documental')) {
      map.set('historico_documental', map.get('gestao_documental')!);
    }
  } catch {
    // Tabela ainda não aplicada no ambiente - retorna mapa vazio (preserva legado)
  }
  return map;
}

/**
 * Lê as regras salvas para um colaborador na organização selecionada.
 * Resiliente: se a tabela ainda não existir, retorna lista vazia.
 */
export async function getUserRulesFromDb(
  tenantId: string,
  userId: string
): Promise<Map<string, OverrideValue>> {
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
    if (!map.has('historico_documental') && map.has('gestao_documental')) {
      map.set('historico_documental', map.get('gestao_documental')!);
    }
  } catch {
    // Tabela ainda não aplicada no ambiente - retorna mapa vazio (preserva legado)
  }
  return map;
}

/**
 * Lista colaboradores de um departamento que possuem exceções individuais em fiorix_nav_user_rules
 * (as quais têm precedência sobre as regras do departamento).
 */
export async function getDepartmentUsersWithOverrides(
  tenantId: string,
  departamento?: string | null
): Promise<DepartmentUserOverrideSummary[]> {
  const trimmed = (departamento || '').trim();
  if (!trimmed) return [];

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         u.id AS "userId",
         COALESCE(u.name, 'Sem Nome') AS name,
         u.email,
         COUNT(*) FILTER (WHERE ur.override = 'ALLOW')::int AS "allowCount",
         COUNT(*) FILTER (WHERE ur.override = 'DENY')::int AS "denyCount",
         COUNT(*)::int AS "totalOverrides"
       FROM public.fiorix_nav_user_rules ur
       JOIN public."User" u
         ON u.id = ur.user_id AND u."tenantId" = ur.tenant_id
       WHERE ur.tenant_id = $1
         AND u.role <> 'MASTER'
         AND LOWER(TRIM(COALESCE(u.departamento, ''))) = LOWER(TRIM($2))
       GROUP BY u.id, u.name, u.email
       ORDER BY LOWER(COALESCE(u.name, '')) ASC`,
      tenantId,
      trimmed
    );
    return rows.map((r) => ({
      userId: String(r.userId),
      name: String(r.name || 'Sem Nome'),
      email: String(r.email || ''),
      allowCount: Number(r.allowCount || 0),
      denyCount: Number(r.denyCount || 0),
      totalOverrides: Number(r.totalOverrides || 0),
    }));
  } catch {
    return [];
  }
}

/**
 * Calcula o estado efetivo de cada item do catálogo para o alvo:
 * ROLE/PERFIL, DEPARTMENT/DEPARTAMENTO ou USER/COLABORADOR.
 */
export async function computeNavPermissionsState(params: {
  tenantId: string;
  targetType: TargetType;
  targetId: string; // role, nome do departamento ou userId
  userRole?: string; // no modo USER, a role de origem do colaborador
  userDepartamento?: string | null; // no modo USER, o departamento do colaborador
}): Promise<NavPermissionsTreeResponse> {
  const { tenantId, targetType, targetId, userRole, userDepartamento } = params;
  const isFlagActive = isNavPermissionsFeatureEnabled();

  const isRoleMode = targetType === 'ROLE' || targetType === 'PERFIL';
  const isDeptMode = targetType === 'DEPARTMENT' || targetType === 'DEPARTAMENTO';
  const isUserMode = !isRoleMode && !isDeptMode;

  const effectiveRole = isRoleMode ? targetId : isDeptMode ? 'USER' : userRole || 'USER';

  // 1. Busca regras de perfil da role correspondente
  const roleRules = await getRoleRulesFromDb(tenantId, effectiveRole);

  // 2. Busca regras de departamento (no modo DEPARTAMENTO ou quando o colaborador possui departamento)
  const deptRules = isDeptMode
    ? await getDepartmentRulesFromDb(tenantId, targetId)
    : isUserMode && userDepartamento && userDepartamento.trim()
      ? await getDepartmentRulesFromDb(tenantId, userDepartamento)
      : new Map<string, OverrideValue>();

  // 3. Se for modo USER/COLABORADOR, busca regras individuais
  const userRules = isUserMode
    ? await getUserRulesFromDb(tenantId, targetId)
    : new Map<string, OverrideValue>();

  // 4. Se for modo DEPARTAMENTO, identifica colaboradores deste departamento com exceções individuais conflitantes
  const departmentUsersWithOverrides = isDeptMode
    ? await getDepartmentUsersWithOverrides(tenantId, targetId)
    : undefined;

  const itemsState: ItemEffectiveState[] = ALL_NAV_CATALOG_ITEMS.map((item) => {
    const roleRuleVal = roleRules.has(item.id) ? roleRules.get(item.id)! : null;
    const deptOverrideVal = deptRules.has(item.id) ? deptRules.get(item.id)! : null;
    const userOverrideVal = userRules.has(item.id) ? userRules.get(item.id)! : null;
    const legacyAllowed = isItemVisibleInLegacy(item, effectiveRole);

    // A. Verifica guarda estrutural no servidor
    // No modo DEPARTAMENTO, um departamento pode conter colaboradores ADMIN/SUBSTITUTO/RH/VISITANTE/USER;
    // bloqueamos apenas itens exclusivos MASTER ou protegidos, mantendo a guarda estrutural por role em runtime.
    const structuralCheck = isDeptMode
      ? item.isMasterOnly
        ? { isBlocked: true, reason: 'Recurso exclusivo do MASTER da plataforma.' }
        : item.isProtected
          ? { isBlocked: true, reason: 'Recurso essencial do sistema; acesso protegido.' }
          : {
              isBlocked: false,
              reason:
                item.structuralRoles && item.structuralRoles.length > 0
                  ? `Exige também perfil compatível na conta: [${item.structuralRoles.join(', ')}].`
                  : undefined,
            }
      : checkStructuralRestriction(item, effectiveRole);

    let effectiveAllowed = false;
    let effectiveStatus: ItemEffectiveState['effectiveStatus'] = 'ALLOWED_INHERITED';

    if (structuralCheck.isBlocked) {
      effectiveAllowed = false;
      effectiveStatus =
        item.isMasterOnly || item.isProtected ? 'PROTECTED_SYSTEM' : 'BLOCKED_BY_SYSTEM';
    } else if (isUserMode && userOverrideVal === 'ALLOW') {
      effectiveAllowed = true;
      effectiveStatus = 'ALLOWED_INDIVIDUAL';
    } else if (isUserMode && userOverrideVal === 'DENY') {
      effectiveAllowed = false;
      effectiveStatus = 'DENIED_INDIVIDUAL';
    } else if ((isDeptMode || isUserMode) && deptOverrideVal === 'ALLOW') {
      effectiveAllowed = true;
      effectiveStatus = 'ALLOWED_DEPARTMENT';
    } else if ((isDeptMode || isUserMode) && deptOverrideVal === 'DENY') {
      effectiveAllowed = false;
      effectiveStatus = 'DENIED_DEPARTMENT';
    } else {
      // Herança da Role ou Legado
      if (roleRuleVal !== null) {
        effectiveAllowed = roleRuleVal;
        effectiveStatus = roleRuleVal ? 'ALLOWED_INHERITED' : 'DENIED_INHERITED';
      } else {
        effectiveAllowed = legacyAllowed;
        effectiveStatus = legacyAllowed ? 'ALLOWED_INHERITED' : 'DENIED_INHERITED';
      }
    }

    return {
      item,
      roleRule: roleRuleVal,
      departmentOverride: deptOverrideVal,
      userOverride: userOverrideVal,
      legacyAllowed,
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

  return {
    groups,
    itemsState,
    isFlagActive,
    ...(departmentUsersWithOverrides !== undefined ? { departmentUsersWithOverrides } : {}),
  };
}

/**
 * Remove todas as exceções individuais (fiorix_nav_user_rules) dos colaboradores pertencentes
 * ao departamento informado, garantindo que passem a herdar integralmente as regras do departamento.
 */
export async function clearDepartmentUsersIndividualOverrides(params: {
  tenantId: string;
  departamento: string;
  masterUser: { id: string; name?: string | null; email?: string | null; role: string };
}): Promise<{
  success: boolean;
  deletedRulesCount: number;
  affectedUsersCount: number;
  message: string;
}> {
  const { tenantId, departamento, masterUser } = params;
  if (masterUser.role !== 'MASTER') {
    throw new Error('Acesso negado: somente o MASTER pode alterar permissões de menu.');
  }

  const trimmedDepto = (departamento || '').trim();
  if (!trimmedDepto) {
    throw new Error('Departamento alvo inválido.');
  }

  const affectedUsers = await getDepartmentUsersWithOverrides(tenantId, trimmedDepto);
  const affectedUsersCount = affectedUsers.length;

  let deletedRulesCount = 0;
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.$executeRawUnsafe(
      `DELETE FROM public.fiorix_nav_user_rules ur
       USING public."User" u
       WHERE ur.tenant_id = $1
         AND u.id = ur.user_id
         AND u."tenantId" = ur.tenant_id
         AND u.role <> 'MASTER'
         AND LOWER(TRIM(COALESCE(u.departamento, ''))) = LOWER(TRIM($2))`,
      tenantId,
      trimmedDepto
    );
    deletedRulesCount = Number(deleted || 0);
  });

  await recordAuditLog({
    modulo: 'PERMISSOES_MENU' as any,
    acao: 'ALTERACAO',
    registroId: `DEPARTMENT_CLEAR_USER_OVERRIDES:${trimmedDepto}`,
    registroDescricao: `Remoção de ${deletedRulesCount} exceções individuais de ${affectedUsersCount} colaborador(es) do departamento [${trimmedDepto}] no tenant [${tenantId}]`,
    detalhes: {
      tenantId,
      departamento: trimmedDepto,
      deletedRulesCount,
      affectedUsersCount,
      affectedUsers: affectedUsers.map((u) => ({
        userId: u.userId,
        name: u.name,
        email: u.email,
        totalOverrides: u.totalOverrides,
      })),
    },
    userOverride: masterUser as any,
  });

  return {
    success: true,
    deletedRulesCount,
    affectedUsersCount,
    message:
      deletedRulesCount > 0
        ? `Exceções individuais removidas (${deletedRulesCount} regras em ${affectedUsersCount} colaborador(es)). Agora todos herdam as regras do departamento ${trimmedDepto}.`
        : `Nenhuma exceção individual pendente no departamento ${trimmedDepto}.`,
  };
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
  const isDeptMode = targetType === 'DEPARTMENT' || targetType === 'DEPARTAMENTO';
  const isUserMode = !isRoleMode && !isDeptMode;

  if (isDeptMode && !(targetId || '').trim()) {
    throw new Error('Departamento alvo inválido.');
  }

  // Não permite editar conta MASTER no modo colaborador
  if (isUserMode) {
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

    // Se houver restrição estrutural intransponível no modo PERFIL ou COLABORADOR, não permite ativação
    if (!isDeptMode) {
      const roleForCheck = isRoleMode ? targetId : targetRoleForUser || 'USER';
      const restriction = checkStructuralRestriction(item, roleForCheck);
      if (restriction.isBlocked && c.action === 'ALLOW') {
        throw new Error(
          `O item "${item.label}" está bloqueado pelo sistema para o perfil ${roleForCheck}.`
        );
      }
    }

    normalizedChangesMap.set(c.itemId, c.action);

    // Sincroniza rota compartilhada se houver
    if (item.sharedWithId && !normalizedChangesMap.has(item.sharedWithId)) {
      normalizedChangesMap.set(item.sharedWithId, c.action);
    }
  }

  let updatedCount = 0;
  const trimmedDepto = isDeptMode ? targetId.trim() : '';

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
      } else if (isDeptMode) {
        if (action === 'HERDAR') {
          await tx.$executeRawUnsafe(
            `DELETE FROM public.fiorix_nav_department_rules
             WHERE tenant_id = $1 AND LOWER(TRIM(departamento)) = LOWER(TRIM($2)) AND item_id = $3`,
            tenantId,
            trimmedDepto,
            itemId
          );
        } else {
          await tx.$executeRawUnsafe(
            `DELETE FROM public.fiorix_nav_department_rules
             WHERE tenant_id = $1 AND LOWER(TRIM(departamento)) = LOWER(TRIM($2)) AND departamento <> $2 AND item_id = $3`,
            tenantId,
            trimmedDepto,
            itemId
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO public.fiorix_nav_department_rules
               (id, tenant_id, departamento, item_id, override, created_at, updated_at, updated_by)
             VALUES
               (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW(), $5)
             ON CONFLICT (tenant_id, departamento, item_id)
             DO UPDATE SET
               override = EXCLUDED.override,
               updated_at = NOW(),
               updated_by = EXCLUDED.updated_by`,
            tenantId,
            trimmedDepto,
            itemId,
            action,
            masterUser.id
          );
        }
        updatedCount++;
      } else {
        // Modo USER
        if (action === 'HERDAR') {
          await tx.$executeRawUnsafe(
            `DELETE FROM public.fiorix_nav_user_rules 
             WHERE tenant_id = $1 AND user_id = $2 AND item_id = $3`,
            tenantId,
            targetId,
            itemId
          );
        } else {
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
      alteracoes: Array.from(normalizedChangesMap.entries()).map(([itemId, action]) => ({
        itemId,
        action,
      })),
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
 * Precedência: Guarda Estrutural > Colaborador > Departamento > Perfil > Legado.
 */
export async function getEffectiveUserNavigation(user: {
  id: string;
  role: string;
  tenantId: string;
  departamento?: string | null;
}): Promise<Record<string, any>> {
  if (!isNavPermissionsFeatureEnabled()) {
    return filterNavigationByRole(user.role);
  }

  if (user.role === 'MASTER') {
    return filterNavigationByRole('MASTER');
  }

  const roleRules = await getRoleRulesFromDb(user.tenantId, user.role);
  const userRules = await getUserRulesFromDb(user.tenantId, user.id);
  const deptRules =
    user.departamento && user.departamento.trim()
      ? await getDepartmentRulesFromDb(user.tenantId, user.departamento)
      : new Map<string, OverrideValue>();

  const filteredGroups: Record<string, any> = {};

  for (const group of NAV_CATALOG_GROUPS) {
    if (group.isMasterOnly) continue;

    const visibleItems = group.items.filter((item) => {
      // 1. Guarda estrutural
      const structural = checkStructuralRestriction(item, user.role);
      if (structural.isBlocked) return false;

      // 2. Exceção individual de usuário
      if (userRules.has(item.id)) {
        return userRules.get(item.id) === 'ALLOW';
      }

      // 3. Regra de departamento
      if (deptRules.has(item.id)) {
        return deptRules.get(item.id) === 'ALLOW';
      }

      // 4. Regra de perfil
      if (roleRules.has(item.id)) {
        return roleRules.get(item.id) === true;
      }

      // 5. Fallback legado
      return isItemVisibleInLegacy(item, user.role);
    });

    const isGroupHrefVisible = group.href
      ? visibleItems.some((i) => i.href === group.href) ||
        (group.items.length === 0 &&
          (userRules.has(group.id)
            ? userRules.get(group.id) === 'ALLOW'
            : deptRules.has(group.id)
              ? deptRules.get(group.id) === 'ALLOW'
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
 * Precedência: Guarda Estrutural > Colaborador > Departamento > Perfil > Legado.
 */
export async function isRouteAllowedForUser(
  pathname: string,
  user: { id: string; role: string; tenantId: string; departamento?: string | null }
): Promise<boolean> {
  if (!isNavPermissionsFeatureEnabled()) return true;
  if (user.role === 'MASTER') return true;

  if (pathname === '/' || pathname === '/minha-conta') return true;

  const matchingItem = ALL_NAV_CATALOG_ITEMS.find((item) => {
    if (item.href === pathname) return true;
    if (item.href.includes('?') && item.href.split('?')[0] === pathname) return true;
    if (pathname.startsWith('/cartorio-virtual/certidoes/') && item.id === 'cv_certidoes') return true;
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

  // 3. Regra de departamento
  if (user.departamento && user.departamento.trim()) {
    const deptRules = await getDepartmentRulesFromDb(user.tenantId, user.departamento);
    if (deptRules.has(matchingItem.id)) {
      return deptRules.get(matchingItem.id) === 'ALLOW';
    }
  }

  // 4. Regra de perfil
  const roleRules = await getRoleRulesFromDb(user.tenantId, user.role);
  if (roleRules.has(matchingItem.id)) {
    return roleRules.get(matchingItem.id) === true;
  }

  // 5. Fallback legado
  return isItemVisibleInLegacy(matchingItem, user.role);
}

/**
 * Retorna os IDs dos itens permitidos para o usuário.
 * Precedência: Guarda Estrutural > Colaborador > Departamento > Perfil > Legado.
 */
export async function getAllowedNavItemsForUser(user: {
  id: string;
  role: string;
  tenantId: string;
  departamento?: string | null;
}): Promise<{ enabled: boolean; allowedItemIds: string[] }> {
  if (!isNavPermissionsFeatureEnabled()) {
    return { enabled: false, allowedItemIds: [] };
  }

  if (user.role === 'MASTER') {
    return {
      enabled: true,
      allowedItemIds: ALL_NAV_CATALOG_ITEMS.map((i) => i.id),
    };
  }

  const roleRules = await getRoleRulesFromDb(user.tenantId, user.role);
  const userRules = await getUserRulesFromDb(user.tenantId, user.id);
  const deptRules =
    user.departamento && user.departamento.trim()
      ? await getDepartmentRulesFromDb(user.tenantId, user.departamento)
      : new Map<string, OverrideValue>();

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

    // 3. Regra de departamento
    if (deptRules.has(item.id)) {
      if (deptRules.get(item.id) === 'ALLOW') {
        allowedItemIds.push(item.id);
      }
      continue;
    }

    // 4. Regra de perfil
    if (roleRules.has(item.id)) {
      if (roleRules.get(item.id) === true) {
        allowedItemIds.push(item.id);
      }
      continue;
    }

    // 5. Fallback legado
    if (isItemVisibleInLegacy(item, user.role)) {
      allowedItemIds.push(item.id);
    }
  }

  return {
    enabled: true,
    allowedItemIds,
  };
}

/**
 * Resolve a primeira rota permitida para o usuário quando sua rota padrão (ou /dashboard) estiver desativada.
 * Evita redirecionamento indevido para /dashboard quando o menu INICIAL está desativado.
 */
export async function getFirstAllowedRouteForUser(user: {
  id: string;
  role: string;
  tenantId: string;
  departamento?: string | null;
}): Promise<string> {
  const defaultRoleHome = getHomeRouteForRole(user.role);

  if (!isNavPermissionsFeatureEnabled() || user.role === 'MASTER') {
    return defaultRoleHome;
  }

  const { allowedItemIds } = await getAllowedNavItemsForUser(user);
  const allowedSet = new Set(allowedItemIds);

  // 1. Se a rota canônica do perfil estiver permitida, prioriza-a
  if (defaultRoleHome === '/sistema/pessoas') {
    const rhHomeItem = ['gestao_comunicados', 'rh_ferias', 'rh_holerites']
      .map((id) => ITEM_BY_ID.get(id))
      .find((item) => item && allowedSet.has(item.id));
    if (rhHomeItem) {
      return rhHomeItem.href;
    }
  }
  const roleHomeItem = ALL_NAV_CATALOG_ITEMS.find(
    (item) => item.href === defaultRoleHome || item.href.split('?')[0] === defaultRoleHome
  );
  if (roleHomeItem && allowedSet.has(roleHomeItem.id)) {
    return roleHomeItem.href;
  }

  // 2. Se o menu Início (/dashboard) estiver permitido, utiliza-o
  if (allowedSet.has('inicio')) {
    return '/dashboard';
  }

  // 3. Caso contrário, retorna o primeiro módulo permitido na ordem do catálogo (ex: /bi/qualidade)
  const firstAllowedItem = ALL_NAV_CATALOG_ITEMS.find(
    (item) => !item.isMasterOnly && allowedSet.has(item.id)
  );
  if (firstAllowedItem) {
    return firstAllowedItem.href;
  }

  // 4. Fallback seguro sempre acessível caso nenhum menu esteja ativo
  return '/minha-conta';
}

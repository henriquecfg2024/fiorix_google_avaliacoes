'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { auth } from '@/auth';
import {
  computeNavPermissionsState,
  getEffectiveUserNavigation,
  getAllowedNavItemsForUser,
  isRouteAllowedForUser,
  saveNavPermissionsBatch,
} from '@/lib/nav-permissions/service';
import {
  EligibleUserItem,
  TargetType,
  TenantContextItem,
} from '@/lib/nav-permissions/types';

import { getMasterTenants } from './tenants';

/**
 * Busca todos os tenants da plataforma para o seletor exclusivo do MASTER, alimentado por getMasterTenants().
 */
export async function getNavTenantsAction(): Promise<TenantContextItem[]> {
  await requireRole('MASTER');
  const result = await getMasterTenants();

  return result.tenants.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    plano: t.plano,
    cidade: t.cidade || undefined,
    estado: t.estado || undefined,
  }));
}

/**
 * Busca os colaboradores elegíveis (contas User) da organização selecionada.
 * Exclui contas MASTER da edição.
 */
export async function getEligibleUsersForTenantAction(
  tenantId: string
): Promise<EligibleUserItem[]> {
  const master = await requireRole('MASTER');

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       id, 
       name, 
       email, 
       role, 
       departamento, 
       cargo, 
       status
     FROM public."User"
     WHERE "tenantId" = $1 AND role <> 'MASTER'
     ORDER BY name ASC`,
    tenantId
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name || 'Sem Nome',
    email: r.email,
    role: String(r.role),
    departamento: r.departamento || null,
    cargo: r.cargo || null,
    status: r.status === 'inativo' ? 'inativo' : 'ativo',
  }));
}

/**
 * Carrega a árvore de permissões e estados efetivos para o alvo selecionado (ROLE ou USER).
 */
export async function getPermissionsForTargetAction(params: {
  tenantId: string;
  targetType: TargetType;
  targetId: string;
  userRole?: string;
}) {
  const master = await requireRole('MASTER');

  // Garante que o tenant existe
  const tenantExists = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: { id: true },
  });
  if (!tenantExists) {
    throw new Error('Organização não encontrada.');
  }

  return computeNavPermissionsState(params);
}

/**
 * Salva as alterações de permissões em lote no servidor.
 */
export async function savePermissionsBatchAction(params: {
  tenantId: string;
  targetType: TargetType;
  targetId: string;
  changes: Array<{
    itemId: string;
    action: 'HERDAR' | 'ALLOW' | 'DENY';
  }>;
  targetRoleForUser?: string;
}) {
  try {
    const master = await requireRole('MASTER');

    return await saveNavPermissionsBatch({
      ...params,
      masterUser: master,
    });
  } catch (err: any) {
    return {
      success: false,
      updatedCount: 0,
      message: err?.message || 'Falha ao salvar permissões no servidor.',
    };
  }
}

/**
 * Retorna os IDs dos itens permitidos para a navegação do usuário da sessão.
 */
export async function getUserNavPermissionsAction(): Promise<{
  enabled: boolean;
  allowedItemIds: string[];
}> {
  const session = await auth();
  if (!session?.user) {
    return { enabled: false, allowedItemIds: [] };
  }

  return getAllowedNavItemsForUser({
    id: session.user.id || '',
    role: session.user.role || 'USER',
    tenantId: (session.user as any).tenantId || '',
  });
}

/**
 * Retorna a navegação dinâmica efetiva para o usuário autenticado na sessão.
 */
export async function getCurrentUserNavigationAction(): Promise<Record<string, any> | null> {
  const session = await auth();
  if (!session?.user) return null;

  return getEffectiveUserNavigation({
    id: session.user.id || '',
    role: session.user.role || 'USER',
    tenantId: (session.user as any).tenantId || '',
  });
}

/**
 * Valida no servidor se a rota acessada é permitida para o usuário da sessão.
 */
export async function checkRouteAccessAction(pathname: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return true;

  return isRouteAllowedForUser(pathname, {
    id: session.user.id || '',
    role: session.user.role || 'USER',
    tenantId: (session.user as any).tenantId || '',
  });
}

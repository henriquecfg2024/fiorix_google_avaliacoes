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
  DepartmentContextItem,
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
 * Busca todos os departamentos da organização selecionada (em ordem alfabética pt-BR),
 * consolidando a tabela fiorix_departamentos com eventuais departamentos vinculados às contas User.
 */
export async function getDepartmentsForTenantNavAction(
  tenantId: string
): Promise<DepartmentContextItem[]> {
  await requireRole('MASTER');

  const deptoMap = new Map<string, DepartmentContextItem>();

  try {
    const dbDeptos = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         d.id,
         d.nome,
         d.sigla,
         d.cor,
         d.ativo,
         (SELECT COUNT(*)::int FROM public."User" u
          WHERE u."tenantId" = d.tenant_id
            AND LOWER(TRIM(COALESCE(u.departamento, ''))) = LOWER(TRIM(d.nome))) AS "totalColaboradores"
       FROM public.fiorix_departamentos d
       WHERE d.tenant_id = $1
       ORDER BY LOWER(d.nome) ASC`,
      tenantId
    );

    for (const r of dbDeptos) {
      const key = String(r.nome || '').trim().toLowerCase();
      if (!key) continue;
      deptoMap.set(key, {
        id: String(r.id),
        nome: String(r.nome).trim(),
        sigla: r.sigla ? String(r.sigla) : null,
        cor: r.cor ? String(r.cor) : '#6366f1',
        ativo: r.ativo !== false,
        totalColaboradores: Number(r.totalColaboradores || 0),
      });
    }
  } catch {
    // Caso a tabela fiorix_departamentos não exista no ambiente, consolida via User
  }

  try {
    const userDeptos = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         TRIM(departamento) AS nome,
         COUNT(*)::int AS total
       FROM public."User"
       WHERE "tenantId" = $1
         AND departamento IS NOT NULL
         AND TRIM(departamento) <> ''
       GROUP BY TRIM(departamento)`,
      tenantId
    );

    for (const r of userDeptos) {
      const nome = String(r.nome || '').trim();
      const key = nome.toLowerCase();
      if (!key) continue;
      if (!deptoMap.has(key)) {
        deptoMap.set(key, {
          id: `user-depto:${key}`,
          nome,
          sigla: nome.slice(0, 3).toUpperCase(),
          cor: '#6366f1',
          ativo: true,
          totalColaboradores: Number(r.total || 0),
        });
      }
    }
  } catch {
    // Ignora falha secundária mantendo os departamentos já carregados
  }

  return Array.from(deptoMap.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  );
}

/**
 * Busca os colaboradores elegíveis (contas User) da organização selecionada.
 * Exclui contas MASTER da edição.
 */
export async function getEligibleUsersForTenantAction(
  tenantId: string
): Promise<EligibleUserItem[]> {
  await requireRole('MASTER');

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
     ORDER BY LOWER(COALESCE(name, '')) ASC`,
    tenantId
  );

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name || 'Sem Nome',
      email: r.email,
      role: String(r.role),
      departamento: r.departamento || null,
      cargo: r.cargo || null,
      status: r.status === 'inativo' ? 'inativo' : 'ativo',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}

/**
 * Carrega a árvore de permissões e estados efetivos para o alvo selecionado (ROLE, DEPARTMENT ou USER).
 */
export async function getPermissionsForTargetAction(params: {
  tenantId: string;
  targetType: TargetType;
  targetId: string;
  userRole?: string;
  userDepartamento?: string | null;
}) {
  await requireRole('MASTER');

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

async function resolveSessionUserContext() {
  const session = await auth();
  if (!session?.user) return null;

  let role = session.user.role || 'USER';
  let tenantId = (session.user as any).tenantId || '';
  let departamento: string | null = (session.user as any).departamento || null;
  const id = session.user.id || '';

  if (id) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id },
        select: { role: true, tenantId: true, departamento: true },
      });
      if (dbUser) {
        role = String(dbUser.role || role);
        tenantId = dbUser.tenantId || tenantId;
        departamento = dbUser.departamento ?? departamento;
      }
    } catch {
      // Mantém contexto da sessão caso o banco oscile
    }
  }

  return { id, role, tenantId, departamento };
}

/**
 * Retorna os IDs dos itens permitidos para a navegação do usuário da sessão.
 */
export async function getUserNavPermissionsAction(): Promise<{
  enabled: boolean;
  allowedItemIds: string[];
}> {
  const ctx = await resolveSessionUserContext();
  if (!ctx) {
    return { enabled: false, allowedItemIds: [] };
  }

  return getAllowedNavItemsForUser(ctx);
}

/**
 * Retorna a navegação dinâmica efetiva para o usuário autenticado na sessão.
 */
export async function getCurrentUserNavigationAction(): Promise<Record<string, any> | null> {
  const ctx = await resolveSessionUserContext();
  if (!ctx) return null;

  return getEffectiveUserNavigation(ctx);
}

/**
 * Valida no servidor se a rota acessada é permitida para o usuário da sessão.
 */
export async function checkRouteAccessAction(pathname: string): Promise<boolean> {
  const ctx = await resolveSessionUserContext();
  if (!ctx) return true;

  return isRouteAllowedForUser(pathname, ctx);
}

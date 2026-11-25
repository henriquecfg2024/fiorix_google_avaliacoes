import { requireAuth, type AuthenticatedUser } from '@/lib/auth-helpers';
import { isSameOriginRequest } from '@/lib/documental/origin';
import {
  isNavPermissionsFeatureEnabled,
  isRouteAllowedForUser,
} from '@/lib/nav-permissions/service';
import type { AgendaEventDTO, AgendaVisibility } from './types';

export class AgendaAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AgendaAccessError';
    this.status = status;
  }
}

export interface AgendaAccessContext {
  user: AuthenticatedUser;
  roleUpper: string;
  canView: boolean;
  canCreateOwn: boolean;
  canAssignOrCreateSetorial: boolean;
  canCreateInstitucional: boolean;
  canManageCategories: boolean;
  canManageModule: boolean;
  isReadOnly: boolean;
}

/**
 * Avalia acesso completo ao módulo Agenda Inteligente usando identidade derivada
 * exclusivamente do servidor (nunca confia em role/tenant_id/user_id enviados pelo cliente).
 */
export async function requireAgendaAccess(req?: Request): Promise<AgendaAccessContext> {
  if (req && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    if (!isSameOriginRequest(req)) {
      throw new AgendaAccessError('Origem não autorizada para operação na Agenda.', 403);
    }
  }

  let user: AuthenticatedUser;
  try {
    user = await requireAuth();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Não autorizado.';
    throw new AgendaAccessError(msg, 401);
  }

  const roleUpper = String(user.role || 'USER').toUpperCase();

  if (isNavPermissionsFeatureEnabled() && roleUpper !== 'MASTER') {
    const allowedRoute = await isRouteAllowedForUser('/agenda', user);
    if (!allowedRoute) {
      throw new AgendaAccessError(
        'Acesso negado à Agenda Inteligente. Solicite liberação em Permissões de Navegação.',
        403
      );
    }
  }

  if (roleUpper === 'VISITANTE') {
    return {
      user,
      roleUpper,
      canView: true,
      canCreateOwn: false,
      canAssignOrCreateSetorial: false,
      canCreateInstitucional: false,
      canManageCategories: false,
      canManageModule: false,
      isReadOnly: true,
    };
  }

  const isMaster = roleUpper === 'MASTER';
  const isAdmin = roleUpper === 'ADMIN' || roleUpper === 'SUBSTITUTO';
  const isRh = roleUpper === 'RH';

  return {
    user,
    roleUpper,
    canView: true,
    canCreateOwn: true,
    canAssignOrCreateSetorial: isMaster || isAdmin || isRh,
    canCreateInstitucional: isMaster || isAdmin,
    canManageCategories: isMaster || isAdmin,
    canManageModule: isMaster,
    isReadOnly: false,
  };
}

/**
 * Garante isolamento multi-tenant + privacidade absoluta de compromissos INDIVIDUAL.
 * Nenhum perfil (nem ADMIN nem MASTER) possui acesso automático à agenda privada de terceiros.
 */
export function canUserViewEvent(
  event: Pick<
    AgendaEventDTO,
    'tenantId' | 'visibility' | 'ownerUserId' | 'createdBy' | 'department' | 'participants'
  >,
  user: Pick<AuthenticatedUser, 'id' | 'tenantId' | 'departamento'>
): boolean {
  if (event.tenantId !== user.tenantId) return false;
  if (event.ownerUserId === user.id || event.createdBy === user.id) return true;
  if (event.participants.some((p) => p.userId === user.id)) return true;

  if (event.visibility === 'INDIVIDUAL') {
    return false;
  }
  if (event.visibility === 'COMPARTILHADO') {
    return false; // Já checou owner, creator e participants acima
  }
  if (event.visibility === 'SETORIAL') {
    if (!event.department || !user.departamento) return false;
    return (
      event.department.trim().toLowerCase() === user.departamento.trim().toLowerCase()
    );
  }
  // INSTITUCIONAL dentro do mesmo tenant
  return true;
}

export function canUserEditEvent(
  event: AgendaEventDTO,
  ctx: AgendaAccessContext
): boolean {
  if (ctx.isReadOnly || event.tenantId !== ctx.user.tenantId) return false;
  if (event.visibility === 'INDIVIDUAL') {
    return event.ownerUserId === ctx.user.id || event.createdBy === ctx.user.id;
  }
  if (event.ownerUserId === ctx.user.id || event.createdBy === ctx.user.id) {
    return true;
  }
  const participant = event.participants.find((p) => p.userId === ctx.user.id);
  if (participant?.canEdit) return true;

  if (event.visibility === 'SETORIAL') {
    return (
      (ctx.roleUpper === 'RH' || ctx.roleUpper === 'ADMIN' || ctx.roleUpper === 'MASTER' || ctx.roleUpper === 'SUBSTITUTO') &&
      Boolean(event.department) &&
      Boolean(ctx.user.departamento) &&
      event.department!.trim().toLowerCase() === ctx.user.departamento!.trim().toLowerCase()
    );
  }

  if (event.visibility === 'INSTITUCIONAL') {
    return ctx.roleUpper === 'ADMIN' || ctx.roleUpper === 'MASTER' || ctx.roleUpper === 'SUBSTITUTO';
  }

  return false;
}

export function canUserConcludeEvent(
  event: AgendaEventDTO,
  ctx: AgendaAccessContext
): boolean {
  if (ctx.isReadOnly || event.tenantId !== ctx.user.tenantId) return false;
  if (canUserEditEvent(event, ctx)) return true;
  return event.participants.some((p) => p.userId === ctx.user.id);
}

export function canUserDeleteEvent(
  event: AgendaEventDTO,
  ctx: AgendaAccessContext
): boolean {
  if (ctx.isReadOnly || event.tenantId !== ctx.user.tenantId) return false;
  // Regras de retenção LGPD/Governança 5 anos não permitem exclusão destrutiva por usuários comuns
  if (event.retentionClass === 'GOVERNANCA_5_ANOS' && ctx.roleUpper !== 'MASTER') {
    return false;
  }
  if (event.visibility === 'INDIVIDUAL') {
    return event.ownerUserId === ctx.user.id || event.createdBy === ctx.user.id;
  }
  if (event.ownerUserId === ctx.user.id || event.createdBy === ctx.user.id) return true;
  if (event.visibility === 'INSTITUCIONAL') {
    return ctx.roleUpper === 'ADMIN' || ctx.roleUpper === 'MASTER';
  }
  return false;
}

export function canUserCreateVisibility(
  visibility: AgendaVisibility,
  ctx: AgendaAccessContext
): boolean {
  if (ctx.isReadOnly) return false;
  if (visibility === 'INDIVIDUAL' || visibility === 'COMPARTILHADO') {
    return ctx.canCreateOwn;
  }
  if (visibility === 'SETORIAL') {
    return ctx.canAssignOrCreateSetorial;
  }
  if (visibility === 'INSTITUCIONAL') {
    return ctx.canCreateInstitucional;
  }
  return false;
}

export function isCronAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get('authorization')?.trim() || '';
  if (!cronSecret || cronSecret.length < 16) {
    return false;
  }
  return authHeader === `Bearer ${cronSecret}`;
}

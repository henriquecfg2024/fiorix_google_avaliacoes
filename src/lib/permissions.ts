/**
 * Centralized RBAC & Permissions Engine for FIORIX
 * Supported Roles: MASTER, ADMIN, USER, RH, COLABORADOR
 */

export type AppRole = 'MASTER' | 'ADMIN' | 'USER' | 'RH' | 'COLABORADOR';

export interface UserLike {
  role?: string | null;
  tenantId?: string | null;
  id?: string | null;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  MASTER: 'Master',
  ADMIN: 'Administrador',
  RH: 'RH',
  USER: 'Usuário',
  COLABORADOR: 'Colaborador',
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  COLABORADOR: 'Acesso somente a Comunicados, Férias e Holerites pessoais.',
  USER: 'Acesso operacional padrão do FIORIX.',
  RH: 'Gerenciamento de Comunicados, Férias e Holerites.',
  ADMIN: 'Acesso administrativo da organização.',
  MASTER: 'Acesso irrestrito ao sistema.',
};

/**
 * Checks if the user is MASTER
 */
export function isMaster(userOrRole?: UserLike | string | null): boolean {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === 'MASTER';
}

/**
 * Checks if the user is ADMIN or MASTER
 */
export function isAdmin(userOrRole?: UserLike | string | null): boolean {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === 'ADMIN' || role === 'MASTER';
}

/**
 * Checks if the user can manage People (Comunicados, Férias, Holerites da organização)
 * Allowed: RH, ADMIN, MASTER
 */
export function canManagePeople(userOrRole?: UserLike | string | null): boolean {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === 'RH' || role === 'ADMIN' || role === 'MASTER';
}

/**
 * Checks if the user can manage Users in Settings
 * Allowed: ADMIN, MASTER
 */
export function canManageUsers(userOrRole?: UserLike | string | null): boolean {
  return isAdmin(userOrRole);
}

/**
 * Checks if the user can access global settings
 * Allowed: ADMIN, MASTER
 */
export function canAccessSettings(userOrRole?: UserLike | string | null): boolean {
  return isAdmin(userOrRole);
}

/**
 * Checks if the user can access Operational BI modules
 * Allowed: USER, ADMIN, MASTER (COLABORADOR and RH are restricted to Pessoas)
 */
export function canAccessBi(userOrRole?: UserLike | string | null): boolean {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === 'USER' || role === 'ADMIN' || role === 'MASTER';
}

/**
 * Checks if the user can access Management modules (Avaliações, Estatísticas, Relatórios)
 * Allowed: USER, ADMIN, MASTER
 */
export function canAccessGestao(userOrRole?: UserLike | string | null): boolean {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  return role === 'USER' || role === 'ADMIN' || role === 'MASTER';
}

/**
 * Comprehensive permission matrix verification
 */
export function canAccess(userOrRole: UserLike | string | null, resource: string): boolean {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  if (!role) return false;
  if (role === 'MASTER') return true;

  switch (resource) {
    case 'people.read_self':
    case 'people.communications.read':
    case 'people.communications.ack':
    case 'people.payroll.read_self':
    case 'people.vacations.read_self':
      return true;

    case 'people.communications.manage':
    case 'people.payroll.manage':
    case 'people.vacations.manage':
    case 'people.audit.read':
      return role === 'RH' || role === 'ADMIN' || role === 'MASTER';

    case 'users.manage':
    case 'organization.manage':
    case 'system.settings':
      return role === 'ADMIN' || role === 'MASTER';

    case 'bi.read':
    case 'reviews.read':
    case 'reports.read':
      return role === 'USER' || role === 'ADMIN' || role === 'MASTER';

    default:
      return false;
  }
}

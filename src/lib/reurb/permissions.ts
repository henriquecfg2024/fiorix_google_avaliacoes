import { requireAuth, type AuthenticatedUser } from '@/lib/auth-helpers';
import { isSameOriginRequest } from '@/lib/documental/origin';
import {
  getAllowedNavItemsForUser,
  isNavPermissionsFeatureEnabled,
  isRouteAllowedForUser,
} from '@/lib/nav-permissions/service';

export class ReurbAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ReurbAccessError';
    this.status = status;
  }
}

export interface ReurbAccessContext {
  user: AuthenticatedUser;
  canView: boolean;
  canExportJson: boolean;
  canConfirmImport: boolean;
  isReadOnly: boolean;
}

export function isReurbDemoModeActive(): boolean {
  return process.env.REURB_DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';
}

export async function requireReurbAccess(): Promise<ReurbAccessContext> {
  let user: AuthenticatedUser;
  try {
    user = await requireAuth();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Não autorizado.';
    throw new ReurbAccessError(msg, 401);
  }

  const roleUpper = String(user.role || '').toUpperCase();

  if (isNavPermissionsFeatureEnabled()) {
    const allowedRoute = await isRouteAllowedForUser('/reurb', user);
    if (!allowedRoute) {
      throw new ReurbAccessError(
        'Acesso negado à Central REURB. Solicite habilitação ao administrador em Permissões de Navegação.',
        403
      );
    }

    if (roleUpper === 'VISITANTE') {
      return {
        user,
        canView: true,
        canExportJson: false,
        canConfirmImport: false,
        isReadOnly: true,
      };
    }

    if (roleUpper === 'MASTER') {
      return {
        user,
        canView: true,
        canExportJson: true,
        canConfirmImport: true,
        isReadOnly: false,
      };
    }

    const { allowedItemIds } = await getAllowedNavItemsForUser(user);
    const canExportJson = allowedItemIds.includes('reurb_exportar_json');
    const canConfirmImport = allowedItemIds.includes('reurb_confirmar_importacao');

    return {
      user,
      canView: true,
      canExportJson,
      canConfirmImport,
      isReadOnly: !canExportJson && !canConfirmImport,
    };
  }

  if (roleUpper === 'VISITANTE') {
    return {
      user,
      canView: true,
      canExportJson: false,
      canConfirmImport: false,
      isReadOnly: true,
    };
  }

  const allowedLegacyRoles = new Set(['MASTER', 'ADMIN', 'SUBSTITUTO', 'USER', 'COLABORADOR']);
  if (!allowedLegacyRoles.has(roleUpper)) {
    throw new ReurbAccessError('Perfil sem acesso à Central REURB.', 403);
  }

  const canWriteLegacy = ['MASTER', 'ADMIN', 'SUBSTITUTO'].includes(roleUpper);
  return {
    user,
    canView: true,
    canExportJson: canWriteLegacy,
    canConfirmImport: canWriteLegacy,
    isReadOnly: !canWriteLegacy,
  };
}

export async function requireReurbExportAccess(req?: Request): Promise<ReurbAccessContext> {
  if (req && !isSameOriginRequest(req)) {
    throw new ReurbAccessError('Origem da requisição inválida.', 403);
  }
  const ctx = await requireReurbAccess();
  if (ctx.isReadOnly || !ctx.canExportJson) {
    throw new ReurbAccessError(
      'Permissão insuficiente: perfil em modo somente leitura ou sem permissão para exportar JSON ONR.',
      403
    );
  }
  return ctx;
}

export async function requireReurbConfirmImportAccess(req?: Request): Promise<ReurbAccessContext> {
  if (req && !isSameOriginRequest(req)) {
    throw new ReurbAccessError('Origem da requisição inválida.', 403);
  }
  const ctx = await requireReurbAccess();
  if (ctx.isReadOnly || !ctx.canConfirmImport) {
    throw new ReurbAccessError(
      'Permissão insuficiente: perfil sem permissão para confirmar importação manual no ONR.',
      403
    );
  }
  return ctx;
}

import { requireAuth, type AuthenticatedUser } from '@/lib/auth-helpers';
import { isNavPermissionsFeatureEnabled, isRouteAllowedForUser } from '@/lib/nav-permissions/service';

export class DocumentAccessError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Perfis de gestão/supervisão utilizados apenas como fallback quando Permissões de Menu V1 está desativado. */
const PERFIS_GESTAO = ['ADMIN', 'MASTER', 'SUBSTITUTO', 'VISITANTE'];

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Escrevente lotado no setor de Usucapião (utilizado no fallback legado). */
export function isSetorUsucapiao(departamento?: string | null): boolean {
  return !!departamento && normalizar(departamento).includes('usucapiao');
}

async function autenticar(): Promise<AuthenticatedUser> {
  try {
    return await requireAuth();
  } catch {
    throw new DocumentAccessError(403, 'Acesso não autorizado.');
  }
}

/**
 * Valida acesso à Gestão Documental delegando integralmente à tela de Permissões de Menu
 * quando ativa (qualquer grupo/perfil, departamento ou colaborador liberado pelo MASTER).
 * Se `requiredRoute` não for informada (ex.: API compartilhada do Connector ou janela auxiliar),
 * aceita permissão em Manifestações (/gestao-documental) OU Visualizador (/gestao-documental/visualizador).
 */
export async function requireDocumentAccess(
  requiredRoute?: '/gestao-documental' | '/gestao-documental/visualizador'
) {
  const user = await autenticar();

  if (isNavPermissionsFeatureEnabled()) {
    const allowed = requiredRoute
      ? await isRouteAllowedForUser(requiredRoute, user)
      : (await isRouteAllowedForUser('/gestao-documental', user)) ||
        (await isRouteAllowedForUser('/gestao-documental/visualizador', user));

    if (!allowed) {
      throw new DocumentAccessError(403, 'Acesso não autorizado.');
    }
  } else {
    if (!PERFIS_GESTAO.includes(String(user.role)) && !isSetorUsucapiao(user.departamento)) {
      throw new DocumentAccessError(403, 'Acesso não autorizado.');
    }
  }

  if (process.env.DOCUMENTAL_ENABLED !== 'true') {
    throw new DocumentAccessError(503, 'Gestão Documental ainda não habilitada.');
  }

  return user;
}

/**
 * Fila de conferência e histórico de Manifestações: controlado pela permissão
 * de Manifestações (/gestao-documental) na tela de Permissões de Menu.
 */
export async function requireManifestacaoAccess() {
  return requireDocumentAccess('/gestao-documental');
}

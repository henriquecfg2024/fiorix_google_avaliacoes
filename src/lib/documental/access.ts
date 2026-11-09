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
 * aceita permissão em Manifestações (/gestao-documental), Visualizador (/gestao-documental/visualizador),
 * Histórico (/gestao-documental/historico) ou Cartório Virtual (/cartorio-virtual, para abertura do LV2 a partir dos pedidos).
 */
export async function requireDocumentAccess(
  requiredRoute?: '/gestao-documental' | '/gestao-documental/visualizador' | '/gestao-documental/historico'
) {
  const user = await autenticar();

  if (isNavPermissionsFeatureEnabled()) {
    const allowed =
      requiredRoute === '/gestao-documental'
        ? await isRouteAllowedForUser('/gestao-documental', user)
        : requiredRoute === '/gestao-documental/historico'
          ? await isRouteAllowedForUser('/gestao-documental/historico', user)
          : (await isRouteAllowedForUser('/gestao-documental/visualizador', user)) ||
            (await isRouteAllowedForUser('/gestao-documental', user)) ||
            (await isRouteAllowedForUser('/gestao-documental/historico', user)) ||
            (await isRouteAllowedForUser('/cartorio-virtual', user));

    if (!allowed) {
      throw new DocumentAccessError(403, 'Acesso não autorizado.');
    }
  } else {
    const perfisPermitidos =
      requiredRoute === '/gestao-documental' || requiredRoute === '/gestao-documental/historico'
        ? PERFIS_GESTAO
        : [...PERFIS_GESTAO, 'COLABORADOR'];
    if (!perfisPermitidos.includes(String(user.role)) && !isSetorUsucapiao(user.departamento)) {
      throw new DocumentAccessError(403, 'Acesso não autorizado.');
    }
  }

  if (process.env.DOCUMENTAL_ENABLED !== 'true') {
    throw new DocumentAccessError(503, 'Gestão Documental ainda não habilitada.');
  }

  return user;
}

/**
 * Fila de conferência de Manifestações: controlado pela permissão
 * de Manifestações (/gestao-documental) na tela de Permissões de Menu.
 */
export async function requireManifestacaoAccess() {
  return requireDocumentAccess('/gestao-documental');
}

/**
 * Histórico de Manifestações: controlado pela permissão individual
 * de Histórico (/gestao-documental/historico) na tela de Permissões de Menu.
 */
export async function requireHistoricoManifestacaoAccess() {
  return requireDocumentAccess('/gestao-documental/historico');
}

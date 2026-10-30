import { requireAuth, type AuthenticatedUser } from '@/lib/auth-helpers';
import { isRouteAllowedForUser } from '@/lib/nav-permissions/service';

export class DocumentAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Perfis de gestão/supervisão que já tinham acesso à Gestão Documental. */
const PERFIS_GESTAO = ['ADMIN', 'MASTER', 'SUBSTITUTO'];

const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Escrevente lotado no setor de Usucapião (campo "Departamento" do cadastro de usuários). */
export function isSetorUsucapiao(departamento?: string | null): boolean {
  return !!departamento && normalizar(departamento).includes('usucapiao');
}

async function autenticar(): Promise<AuthenticatedUser> {
  try { return await requireAuth(); }
  catch { throw new DocumentAccessError(403, 'Acesso não autorizado.'); }
}

export async function requireDocumentAccess() {
  const user = await autenticar();
  // Gestão (Oficial/substitutos/TI) ou escreventes do setor de Usucapião
  if (!PERFIS_GESTAO.includes(String(user.role)) && !isSetorUsucapiao(user.departamento)) {
    throw new DocumentAccessError(403, 'Acesso não autorizado.');
  }
  if (!await isRouteAllowedForUser('/gestao-documental', user)) throw new DocumentAccessError(403, 'Acesso não autorizado.');
  if (process.env.DOCUMENTAL_ENABLED !== 'true') throw new DocumentAccessError(503, 'Gestão Documental ainda não habilitada.');
  return user;
}

/**
 * Fila de conferência e histórico de Manifestações: escreventes do setor de Usucapião
 * e os perfis de gestão (o Oficial e substitutos conferem as fichas).
 */
export async function requireManifestacaoAccess() {
  const user = await requireDocumentAccess();
  if (!PERFIS_GESTAO.includes(String(user.role)) && !isSetorUsucapiao(user.departamento)) {
    throw new DocumentAccessError(403, 'O histórico de Manifestações é restrito ao setor de Usucapião.');
  }
  return user;
}

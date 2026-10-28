import { requireRole } from '@/lib/auth-helpers';
import { isRouteAllowedForUser } from '@/lib/nav-permissions/service';

export class DocumentAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function requireDocumentAccess() {
  let user;
  try { user = await requireRole('ADMIN', 'MASTER', 'SUBSTITUTO'); }
  catch { throw new DocumentAccessError(403, 'Acesso não autorizado.'); }
  if (!await isRouteAllowedForUser('/gestao-documental', user)) throw new DocumentAccessError(403, 'Acesso não autorizado.');
  if (process.env.DOCUMENTAL_ENABLED !== 'true') throw new DocumentAccessError(503, 'Gestão Documental ainda não habilitada.');
  return user;
}

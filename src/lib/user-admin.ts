import type { User } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getAdminSession } from '@/lib/tenant';

interface AuthorizeOptions {
  /** Message shown when the caller is not ADMIN/MASTER. */
  forbidden: string;
  /** Message shown when a non-MASTER caller targets a MASTER account. */
  masterTarget: string;
}

export type AuthorizeUserResult =
  | { error: string; targetUser?: undefined }
  | { error?: undefined; targetUser: User };

/**
 * Resolves the target user of an admin operation, enforcing that the caller is
 * an administrator, may act on MASTER accounts and stays inside its own tenant.
 */
export async function authorizeUserManagement(
  userId: string,
  options: AuthorizeOptions
): Promise<AuthorizeUserResult> {
  const auth = await getAdminSession(options.forbidden);
  if (auth.error !== undefined) return { error: auth.error };

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: 'Usuário não encontrado.' };

  const callerRole = auth.session.user.role;
  if (targetUser.role === 'MASTER' && callerRole !== 'MASTER') {
    return { error: options.masterTarget };
  }

  if (callerRole !== 'MASTER' && targetUser.tenantId !== auth.session.user.tenantId) {
    return { error: 'Não autorizado a alterar este usuário.' };
  }

  return { targetUser };
}

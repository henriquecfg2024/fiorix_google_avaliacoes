import type { Session } from 'next-auth';

import { auth } from '@/auth';

export const DEFAULT_TENANT_ID = 'cartorio-7ri-sp';

export const UNAUTHORIZED_MESSAGE = 'Não autorizado';

export type AdminRole = 'ADMIN' | 'MASTER';

/** Tenant of the current session, falling back to the demo tenant. */
export async function getTenantIdOrDefault() {
  const session = await auth();
  return (session?.user?.tenantId as string) || DEFAULT_TENANT_ID;
}

/** Tenant of the current session, or null when unauthenticated. */
export async function getSessionTenantId() {
  const session = await auth();
  return session?.user?.tenantId || null;
}

/** Tenant of the current session; throws when unauthenticated. */
export async function requireTenantId() {
  const tenantId = await getSessionTenantId();
  if (!tenantId) throw new Error(UNAUTHORIZED_MESSAGE);
  return tenantId;
}

/** Session of a MASTER user; throws with `message` for anyone else. */
export async function requireMasterSession(message: string) {
  const session = await auth();
  if (session?.user?.role !== 'MASTER') throw new Error(message);
  return session;
}

export type AdminSessionResult =
  | { error: string; session?: undefined }
  | { error?: undefined; session: Session };

/**
 * Session of an ADMIN/MASTER user. Returns an `error` instead of throwing so
 * server actions can forward it straight to the UI.
 */
export async function getAdminSession(forbiddenMessage: string): Promise<AdminSessionResult> {
  const session = await auth();
  if (!session?.user?.tenantId) return { error: UNAUTHORIZED_MESSAGE };
  if (!session.user.role || !['ADMIN', 'MASTER'].includes(session.user.role)) {
    return { error: forbiddenMessage };
  }
  return { session };
}

import { auth } from '@/auth';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role | string;
  tenantId: string;
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();

  if (!session?.user?.id || !session?.user?.tenantId) {
    throw new Error('Não autorizado: Sessão não encontrada ou inválida.');
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: (session.user.role as Role) || 'USER',
    tenantId: session.user.tenantId,
  };
}

export async function requireRole(...allowedRoles: Array<Role | string>): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    throw new Error('Acesso negado: Permissão insuficiente para realizar esta operação.');
  }

  return user;
}

export async function requireTenant(): Promise<AuthenticatedUser> {
  return requireAuth();
}

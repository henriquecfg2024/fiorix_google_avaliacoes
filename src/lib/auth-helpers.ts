import { auth } from '@/auth';
import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role | string;
  tenantId: string;
  departamento?: string;
  cargo?: string;
}

import { prisma } from '@/lib/prisma';

export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Não autorizado: Sessão não encontrada ou inválida.');
  }

  let tenantId: string | undefined = session.user.tenantId;

  if (!tenantId) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { tenantId: true },
      });
      tenantId = dbUser?.tenantId || undefined;
    } catch (err) {
      console.warn('Erro ao buscar tenantId do usuário:', err);
    }
  }

  if (!tenantId) {
    throw new Error('Usuário sem tenant válido.');
  }

  let departamento: string | undefined = undefined;
  let cargo: string | undefined = undefined;

  try {
    const rawUser = await prisma.$queryRawUnsafe<any[]>(
      `SELECT departamento, cargo FROM public."User" WHERE id = $1 LIMIT 1`,
      session.user.id
    );
    if (rawUser && rawUser.length > 0) {
      departamento = rawUser[0].departamento || undefined;
      cargo = rawUser[0].cargo || undefined;
    }
  } catch (err) {
    console.warn('Erro ao buscar departamento do usuário:', err);
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: (session.user.role as Role) || 'USER',
    tenantId,
    departamento,
    cargo,
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

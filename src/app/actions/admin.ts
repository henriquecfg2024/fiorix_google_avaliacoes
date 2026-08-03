'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
  const session = await auth();
  if (!session?.user?.tenantId) return [];

  return prisma.user.findMany({
    where: { tenantId: session.user.tenantId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getTenants() {
  const session = await auth();
  if (!session?.user?.role || session.user.role !== 'MASTER') {
    return [];
  }

  return prisma.tenant.findMany({
    include: {
      _count: {
        select: { users: true, reviews: true, colaboradores: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createUser(formData: FormData) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error('Não autorizado');

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role = (formData.get('role') as 'ADMIN' | 'USER') || 'USER';

  if (!email || !password) {
    throw new Error('E-mail e senha são obrigatórios.');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('Já existe um usuário cadastrado com este e-mail.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      tenantId: session.user.tenantId,
    }
  });

  revalidatePath('/configuracoes');
}

export async function createTenant(formData: FormData) {
  const session = await auth();
  if (!session?.user?.role || session.user.role !== 'MASTER') {
    throw new Error('Apenas usuários Master podem cadastrar novos Cartórios.');
  }

  const tenantName = formData.get('tenantName') as string;
  const adminEmail = formData.get('adminEmail') as string;
  const adminPassword = formData.get('adminPassword') as string;
  const adminName = formData.get('adminName') as string;

  if (!tenantName || !adminEmail || !adminPassword) {
    throw new Error('Preencha o nome do cartório, e-mail e senha do administrador.');
  }

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    throw new Error('E-mail do administrador já está em uso.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: tenantName }
    });

    await tx.user.create({
      data: {
        name: adminName || 'Administrador',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        tenantId: tenant.id
      }
    });
  });

  revalidatePath('/configuracoes');
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const session = await auth();
  if (!session?.user?.tenantId) return { error: 'Não autorizado' };
  if (!session?.user?.role || !['ADMIN', 'MASTER'].includes(session.user.role)) {
    return { error: 'Apenas administradores podem resetar senhas.' };
  }

  if (!userId || !newPassword || newPassword.trim().length < 6) {
    return { error: 'A nova senha deve ter no mínimo 6 caracteres.' };
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: 'Usuário não encontrado.' };

  if (targetUser.role === 'MASTER' && session.user.role !== 'MASTER') {
    return { error: 'Apenas usuários MASTER podem resetar a senha de contas MASTER.' };
  }

  if (session.user.role !== 'MASTER' && targetUser.tenantId !== session.user.tenantId) {
    return { error: 'Não autorizado a alterar este usuário.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}

export async function updateUserRole(userId: string, newRole: 'ADMIN' | 'USER') {
  const session = await auth();
  if (!session?.user?.tenantId) return { error: 'Não autorizado' };
  if (!session?.user?.role || !['ADMIN', 'MASTER'].includes(session.user.role)) {
    return { error: 'Apenas administradores podem alterar funções.' };
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: 'Usuário não encontrado.' };

  if (targetUser.role === 'MASTER' && session.user.role !== 'MASTER') {
    return { error: 'Não é possível alterar a função de um usuário MASTER.' };
  }

  if (session.user.role !== 'MASTER' && targetUser.tenantId !== session.user.tenantId) {
    return { error: 'Não autorizado a alterar este usuário.' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole }
  });

  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}

export async function updateUserName(userId: string, newName: string) {
  const session = await auth();
  if (!session?.user?.tenantId) return { error: 'Não autorizado' };
  if (!session?.user?.role || !['ADMIN', 'MASTER'].includes(session.user.role)) {
    return { error: 'Apenas administradores podem alterar nomes.' };
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: 'Usuário não encontrado.' };

  if (targetUser.role === 'MASTER' && session.user.role !== 'MASTER') {
    return { error: 'Apenas usuários MASTER podem alterar o nome de uma conta MASTER.' };
  }

  if (session.user.role !== 'MASTER' && targetUser.tenantId !== session.user.tenantId) {
    return { error: 'Não autorizado a alterar este usuário.' };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { name: newName.trim() }
  });

  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}




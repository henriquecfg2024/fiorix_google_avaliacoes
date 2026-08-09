'use server';

import { prisma } from '@/lib/prisma';
import { hashPassword, MIN_PASSWORD_LENGTH } from '@/lib/password';
import { getSessionTenantId, requireMasterSession, requireTenantId } from '@/lib/tenant';
import { authorizeUserManagement } from '@/lib/user-admin';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
  const tenantId = await getSessionTenantId();
  if (!tenantId) return [];

  return prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });
}

export async function getTenants() {
  try {
    await requireMasterSession('Apenas usuários Master podem listar Cartórios.');
  } catch {
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
  const tenantId = await requireTenantId();

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

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      tenantId,
    }
  });

  revalidatePath('/configuracoes');
}

export async function createTenant(formData: FormData) {
  await requireMasterSession('Apenas usuários Master podem cadastrar novos Cartórios.');

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

  const passwordHash = await hashPassword(adminPassword);

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
  if (!userId || !newPassword || newPassword.trim().length < MIN_PASSWORD_LENGTH) {
    return { error: `A nova senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.` };
  }

  const authorized = await authorizeUserManagement(userId, {
    forbidden: 'Apenas administradores podem resetar senhas.',
    masterTarget: 'Apenas usuários MASTER podem resetar a senha de contas MASTER.',
  });
  if (authorized.error) return { error: authorized.error };

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}

export async function updateUserRole(userId: string, newRole: 'ADMIN' | 'USER') {
  const authorized = await authorizeUserManagement(userId, {
    forbidden: 'Apenas administradores podem alterar funções.',
    masterTarget: 'Não é possível alterar a função de um usuário MASTER.',
  });
  if (authorized.error) return { error: authorized.error };

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole }
  });

  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}

export async function updateUserName(userId: string, newName: string) {
  const authorized = await authorizeUserManagement(userId, {
    forbidden: 'Apenas administradores podem alterar nomes.',
    masterTarget: 'Apenas usuários MASTER podem alterar o nome de uma conta MASTER.',
  });
  if (authorized.error) return { error: authorized.error };

  await prisma.user.update({
    where: { id: userId },
    data: { name: newName.trim() }
  });

  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}




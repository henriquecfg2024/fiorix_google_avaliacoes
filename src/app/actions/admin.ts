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

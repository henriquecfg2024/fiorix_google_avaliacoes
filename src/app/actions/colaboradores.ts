'use server';

import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';

export async function getColaboradores() {
  const user = await requireTenant();

  return prisma.colaborador.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function addColaborador(formData: FormData) {
  const user = await requireTenant();

  const name = formData.get('name') as string;
  const aliasesRaw = formData.get('aliases') as string;

  if (!name || name.trim() === '') {
    throw new Error('Nome é obrigatório');
  }

  const aliases = aliasesRaw 
    ? aliasesRaw.split(',').map(a => a.trim()).filter(a => a.length > 0)
    : [];

  await prisma.colaborador.create({
    data: {
      name,
      aliases,
      tenantId: user.tenantId,
    }
  });

  revalidatePath('/configuracoes/colaboradores');
}

export async function toggleColaboradorActive(id: string, currentStatus: boolean) {
  const user = await requireTenant();

  const target = await prisma.colaborador.findFirst({
    where: { id, tenantId: user.tenantId }
  });
  if (!target) throw new Error('Colaborador não encontrado.');

  await prisma.colaborador.update({
    where: { id },
    data: { active: !currentStatus }
  });

  revalidatePath('/configuracoes/colaboradores');
}

export async function deleteColaborador(id: string) {
  const user = await requireTenant();

  const target = await prisma.colaborador.findFirst({
    where: { id, tenantId: user.tenantId }
  });
  if (!target) throw new Error('Colaborador não encontrado.');

  await prisma.colaborador.delete({
    where: { id }
  });

  revalidatePath('/configuracoes/colaboradores');
}


'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

export async function getColaboradores() {
  const session = await auth();
  if (!session?.user?.tenantId) return [];

  return prisma.colaborador.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function addColaborador(formData: FormData) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error('Não autorizado');

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
      tenantId: session.user.tenantId,
    }
  });

  revalidatePath('/configuracoes/colaboradores');
}

export async function toggleColaboradorActive(id: string, currentStatus: boolean) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error('Não autorizado');

  await prisma.colaborador.update({
    where: { id },
    data: { active: !currentStatus }
  });

  revalidatePath('/configuracoes/colaboradores');
}

export async function deleteColaborador(id: string) {
  const session = await auth();
  if (!session?.user?.tenantId) throw new Error('Não autorizado');

  await prisma.colaborador.delete({
    where: { id }
  });

  revalidatePath('/configuracoes/colaboradores');
}

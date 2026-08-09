'use server';

import { prisma } from '@/lib/prisma';
import { getSessionTenantId, requireTenantId } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';

export async function getColaboradores() {
  const tenantId = await getSessionTenantId();
  if (!tenantId) return [];

  return prisma.colaborador.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function addColaborador(formData: FormData) {
  const tenantId = await requireTenantId();

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
      tenantId,
    }
  });

  revalidatePath('/configuracoes/colaboradores');
}

export async function toggleColaboradorActive(id: string, currentStatus: boolean) {
  await requireTenantId();

  await prisma.colaborador.update({
    where: { id },
    data: { active: !currentStatus }
  });

  revalidatePath('/configuracoes/colaboradores');
}

export async function deleteColaborador(id: string) {
  await requireTenantId();

  await prisma.colaborador.delete({
    where: { id }
  });

  revalidatePath('/configuracoes/colaboradores');
}

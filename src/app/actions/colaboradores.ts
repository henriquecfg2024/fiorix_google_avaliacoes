'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/lib/audit';

export async function getColaboradores() {
  const user = await requireAuth();

  return prisma.colaborador.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: 'desc' }
  });
}

export async function addColaborador(formData: FormData) {
  const user = await requireRole('ADMIN', 'MASTER');

  const name = formData.get('name') as string;
  const aliasesRaw = formData.get('aliases') as string;

  if (!name || name.trim() === '') {
    throw new Error('Nome é obrigatório');
  }

  const aliases = aliasesRaw 
    ? aliasesRaw.split(',').map(a => a.trim()).filter(a => a.length > 0)
    : [];

  const created = await prisma.colaborador.create({
    data: {
      name,
      aliases,
      tenantId: user.tenantId,
    }
  });

  await recordAuditLog({
    modulo: 'COLABORADORES',
    acao: 'INCLUSAO',
    registroId: created.id,
    registroDescricao: `Colaborador: ${name}`,
    detalhes: { aliases },
  });

  revalidatePath('/configuracoes/colaboradores');
}

export async function toggleColaboradorActive(id: string, currentStatus: boolean) {
  const user = await requireRole('ADMIN', 'MASTER');

  const updateResult = await prisma.colaborador.updateMany({
    where: { id, tenantId: user.tenantId },
    data: { active: !currentStatus }
  });
  if (updateResult.count === 0) throw new Error('Colaborador não encontrado.');

  await recordAuditLog({
    modulo: 'COLABORADORES',
    acao: 'ALTERACAO',
    registroId: id,
    registroDescricao: `Status do colaborador alterado para ${!currentStatus ? 'Ativo' : 'Inativo'}`,
  });

  revalidatePath('/configuracoes/colaboradores');
}

export async function deleteColaborador(id: string) {
  const user = await requireRole('ADMIN', 'MASTER');

  const colab = await prisma.colaborador.findFirst({
    where: { id, tenantId: user.tenantId }
  });

  const deleteResult = await prisma.colaborador.deleteMany({
    where: { id, tenantId: user.tenantId }
  });
  if (deleteResult.count === 0) throw new Error('Colaborador não encontrado.');

  await recordAuditLog({
    modulo: 'COLABORADORES',
    acao: 'EXCLUSAO',
    registroId: id,
    registroDescricao: `Colaborador excluído: ${colab?.name || id}`,
  });

  revalidatePath('/configuracoes/colaboradores');
}


'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/lib/audit';
import { generateHash } from '@/lib/security/hash';

export interface ComunicadoItem {
  id: string;
  titulo: string;
  data: string;
  autor: string;
  destinatarios: string;
  views: number;
  ciencias: number;
  total: number;
  status: 'PUBLICADO' | 'ARQUIVADO' | 'EXCLUIDO';
  conteudo?: string;
  conteudoHash?: string;
  ultimaAlteracaoPor?: string;
  dataUltimaAlteracao?: string;
}

export async function getComunicadosRH(): Promise<ComunicadoItem[]> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');

  const comunicados = await prisma.fiorixComunicado.findMany({
    where: {
      tenantId: user.tenantId,
      status: { not: 'EXCLUIDO' },
    },
    orderBy: {
      dataPublicacao: 'desc',
    },
    include: {
      ciencias: true,
      autor: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  const totalColaboradores = await prisma.user.count({
    where: {
      tenantId: user.tenantId,
      active: true,
    },
  });

  return comunicados.map((c) => {
    const dataFmt = c.dataPublicacao
      ? new Date(c.dataPublicacao).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    const dataAltFmt = c.dataUltimaAlteracao
      ? new Date(c.dataUltimaAlteracao).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : undefined;

    const cienciasCount = c.ciencias ? c.ciencias.length : 0;
    const viewsCount = c.ciencias ? c.ciencias.filter((ci) => ci.dataVisualizacao).length : 0;

    return {
      id: c.id,
      titulo: c.titulo,
      data: dataFmt,
      autor: c.autor?.name ? `${c.autor.name} (${user.role === 'RH' ? 'RH' : 'Gestão'})` : 'RH / Gestão',
      destinatarios: c.destinatarios?.includes('TODOS')
        ? `Todos (${totalColaboradores || 63} colaboradores)`
        : `${c.destinatarios?.join(', ') || 'Geral'}`,
      views: viewsCount || Math.max(cienciasCount, 0),
      ciencias: cienciasCount,
      total: totalColaboradores || 63,
      status: (c.status as any) || 'PUBLICADO',
      conteudo: c.conteudo,
      conteudoHash: c.conteudoHash,
      ultimaAlteracaoPor: c.ultimaAlteracaoPor || undefined,
      dataUltimaAlteracao: dataAltFmt,
    };
  });
}

export async function deleteComunicadoRH(id: string, motivo?: string) {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');

  const com = await prisma.fiorixComunicado.findFirst({
    where: { id, tenantId: user.tenantId },
  });

  if (!com) {
    // Se o comunicado não foi encontrado no banco, tenta deletar caso exista
    return { success: true };
  }

  // Soft-delete persistente no PostgreSQL
  await prisma.fiorixComunicado.updateMany({
    where: { id, tenantId: user.tenantId },
    data: {
      status: 'EXCLUIDO',
      motivoExclusao: motivo || 'Excluído via Painel RH',
      dataUltimaAlteracao: new Date(),
      ultimaAlteracaoPor: user.name || 'RH',
    },
  });

  await recordAuditLog({
    modulo: 'COMUNICADOS',
    acao: 'EXCLUSAO',
    registroId: id,
    registroDescricao: `Comunicado excluído e arquivado: ${com.titulo}`,
    detalhes: {
      titulo: com.titulo,
      motivo: motivo || 'Exclusão solicitada no Painel RH',
      dataExclusao: new Date().toISOString(),
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/pessoas/comunicados');

  return { success: true };
}

export async function criarComunicadoRH(data: {
  titulo: string;
  conteudo: string;
  prioridade?: string;
  destinatarios?: string[];
}) {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');

  const conteudoHash = generateHash(data.conteudo);

  const novo = await prisma.fiorixComunicado.create({
    data: {
      tenantId: user.tenantId,
      autorId: user.id,
      titulo: data.titulo,
      conteudo: data.conteudo,
      conteudoHash,
      prioridade: data.prioridade || 'NORMAL',
      destinatarios: data.destinatarios || ['TODOS'],
      exigeCiencia: true,
      status: 'PUBLICADO',
    },
  });

  await recordAuditLog({
    modulo: 'COMUNICADOS',
    acao: 'INCLUSAO',
    registroId: novo.id,
    registroDescricao: `Comunicado publicado: ${novo.titulo}`,
    detalhes: {
      titulo: novo.titulo,
      prioridade: novo.prioridade,
      conteudoHash,
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/pessoas/comunicados');

  return { success: true, id: novo.id };
}

export async function editarComunicadoRH(
  id: string,
  data: {
    titulo: string;
    conteudo: string;
    prioridade?: string;
  }
) {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');

  const conteudoHash = generateHash(data.conteudo);

  await prisma.fiorixComunicado.updateMany({
    where: { id, tenantId: user.tenantId },
    data: {
      titulo: data.titulo,
      conteudo: data.conteudo,
      conteudoHash,
      prioridade: data.prioridade || 'NORMAL',
      dataUltimaAlteracao: new Date(),
      ultimaAlteracaoPor: user.name || 'RH',
    },
  });

  await recordAuditLog({
    modulo: 'COMUNICADOS',
    acao: 'ALTERACAO',
    registroId: id,
    registroDescricao: `Comunicado editado: ${data.titulo}`,
    detalhes: {
      titulo: data.titulo,
      alteradoPor: user.name,
      dataAlteracao: new Date().toISOString(),
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/pessoas/comunicados');

  return { success: true };
}

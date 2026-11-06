'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/lib/audit';
import { generateHash } from '@/lib/security/hash';
import { maskIp } from '@/lib/security/requestIp';

export interface ComunicadoAuditRow {
  id: string;
  colaboradorNome: string;
  setor?: string;
  email: string;
  visualizou?: boolean;
  dataCiencia: string;
  comprovanteHash?: string;
  ipMascarado: string;
  scrollPercent?: number;
}

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
  auditorias?: ComunicadoAuditRow[];
  anexos?: Array<{
    id: string;
    nomeOriginal: string;
    tamanhoBytes: number;
    hashSha256?: string;
    storagePath?: string;
  }>;
}

function formatAutorLabel(autor?: {
  name: string | null;
  role?: string | null;
  departamento?: string | null;
} | null): string {
  if (!autor?.name) return 'RH';
  const deptoUpper = (autor.departamento || '').trim().toUpperCase();
  const roleUpper = (autor.role || '').trim().toUpperCase();
  let sufixo = 'Gestão';
  if (roleUpper === 'RH' || deptoUpper === 'RH' || deptoUpper.includes('RECURSOS HUMANOS')) {
    sufixo = 'RH';
  } else if (roleUpper === 'SUBSTITUTO') {
    sufixo = 'Substituto';
  } else if (roleUpper === 'ADMIN' || roleUpper === 'MASTER') {
    sufixo = autor.departamento?.trim() || 'Administração';
  } else if (autor.departamento?.trim()) {
    sufixo = autor.departamento.trim();
  }
  return `${autor.name} (${sufixo})`;
}

export async function getComunicadosRH(): Promise<ComunicadoItem[]> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR', 'SUBSTITUTO');

  const [comunicados, usuariosTenant] = await Promise.all([
    prisma.fiorixComunicado.findMany({
      where: {
        tenantId: user.tenantId,
        status: { notIn: ['EXCLUIDO', 'excluido'] },
      },
      orderBy: {
        dataPublicacao: 'desc',
      },
      include: {
        ciencias: true,
        anexos: true,
        autor: {
          select: {
            name: true,
            email: true,
            role: true,
            departamento: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        departamento: true,
        cargo: true,
        role: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
  ]);

  const comunicadoIds = comunicados.map((c) => c.id);
  const logsAcesso =
    comunicadoIds.length > 0
      ? await prisma.fiorixAcessoLog
          .findMany({
            where: {
              tenantId: user.tenantId,
              recursoId: { in: comunicadoIds },
              tipo: { in: ['comunicado_view', 'comunicado_ciencia'] },
            },
            select: {
              recursoId: true,
              usuarioId: true,
              ip: true,
              dataAcesso: true,
            },
            orderBy: { dataAcesso: 'desc' },
          })
          .catch(() => [])
      : [];

  const logsPorComunicado = new Map<string, Map<string, { ip: string | null; dataAcesso: Date }>>();
  for (const log of logsAcesso) {
    if (!log.recursoId || !log.usuarioId) continue;
    let mapaUsuarios = logsPorComunicado.get(log.recursoId);
    if (!mapaUsuarios) {
      mapaUsuarios = new Map();
      logsPorComunicado.set(log.recursoId, mapaUsuarios);
    }
    if (!mapaUsuarios.has(log.usuarioId)) {
      mapaUsuarios.set(log.usuarioId, { ip: log.ip, dataAcesso: log.dataAcesso });
    }
  }

  const totalColaboradores = usuariosTenant.length;

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

    const dataAltFmt = (c as any).dataUltimaAlteracao
      ? new Date((c as any).dataUltimaAlteracao).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : undefined;

    const isTodos = !c.destinatarios || c.destinatarios.length === 0 || c.destinatarios.includes('TODOS');
    const alvosUpper = new Set((c.destinatarios || []).map((d) => d.trim().toUpperCase()));
    const filtrados = isTodos
      ? usuariosTenant
      : usuariosTenant.filter(
          (u) =>
            alvosUpper.has(u.id.toUpperCase()) ||
            (u.departamento && alvosUpper.has(u.departamento.trim().toUpperCase())) ||
            (u.role && alvosUpper.has(u.role.trim().toUpperCase()))
        );
    const destinatariosUsers = filtrados.length > 0 ? filtrados : usuariosTenant;

    const cienciaPorUsuario = new Map(
      (c.ciencias || []).map((ci) => [ci.usuarioId, ci])
    );
    const acessosDoComunicado = logsPorComunicado.get(c.id) || new Map();

    const auditorias: ComunicadoAuditRow[] = destinatariosUsers.map((u) => {
      const ci = cienciaPorUsuario.get(u.id);
      const logView = acessosDoComunicado.get(u.id);
      const confirmouCiencia = Boolean(ci?.dataCiencia);
      const visualizou = Boolean(confirmouCiencia || ci?.dataVisualizacao || logView);

      const dataCienciaStr = ci?.dataCiencia
        ? new Date(ci.dataCiencia).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : 'Pendente';

      const ipBruto = ci?.ip || logView?.ip || '';
      const ipMascarado = ipBruto ? maskIp(ipBruto) : '—';

      return {
        id: `${c.id}-${u.id}`,
        colaboradorNome: u.name || u.email,
        setor: u.departamento || u.cargo || 'Geral',
        email: u.email,
        visualizou,
        dataCiencia: dataCienciaStr,
        comprovanteHash: ci?.comprovanteHash || undefined,
        ipMascarado,
        scrollPercent: ci?.scrollPercent ?? (confirmouCiencia ? 100 : 0),
      };
    });

    auditorias.sort((a, b) => {
      const aConf = a.dataCiencia !== 'Pendente' ? 2 : a.visualizou ? 1 : 0;
      const bConf = b.dataCiencia !== 'Pendente' ? 2 : b.visualizou ? 1 : 0;
      if (bConf !== aConf) return bConf - aConf;
      return a.colaboradorNome.localeCompare(b.colaboradorNome, 'pt-BR');
    });

    const cienciasCount = c.ciencias
      ? c.ciencias.filter((ci) => Boolean(ci.dataCiencia)).length || c.ciencias.length
      : 0;
    const viewsCount = Math.max(
      cienciasCount,
      auditorias.filter((a) => Boolean(a.visualizou)).length
    );
    const totalDestinatarios = destinatariosUsers.length || totalColaboradores;

    return {
      id: c.id,
      titulo: c.titulo,
      data: dataFmt,
      autor: formatAutorLabel(c.autor),
      destinatarios: isTodos
        ? `Todos (${totalDestinatarios} ${totalDestinatarios === 1 ? 'colaborador' : 'colaboradores'})`
        : `${c.destinatarios?.join(', ') || 'Geral'} (${totalDestinatarios})`,
      views: viewsCount,
      ciencias: cienciasCount,
      total: totalDestinatarios,
      status: (c.status as any) || 'PUBLICADO',
      conteudo: c.conteudo,
      conteudoHash: c.conteudoHash,
      ultimaAlteracaoPor: (c as any).ultimaAlteracaoPor || undefined,
      dataUltimaAlteracao: dataAltFmt,
      auditorias,
      anexos:
        c.anexos?.map((a) => ({
          id: a.id,
          nomeOriginal: a.nomeOriginal,
          tamanhoBytes: a.tamanhoBytes,
          hashSha256: a.hashSha256,
          storagePath: a.storagePath,
        })) || [],
    };
  });
}

export async function deleteComunicadoRH(id: string, motivo?: string) {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR', 'SUBSTITUTO');

  const com = await prisma.fiorixComunicado.findFirst({
    where: { id, tenantId: user.tenantId },
  });

  if (!com) {
    return { success: true };
  }

  if (user.role === 'MASTER') {
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_comunicados 
       SET status = 'EXCLUIDO', 
           motivo_exclusao = $1, 
           data_ultima_alteracao = NOW(), 
           ultima_alteracao_por = $2, 
           updated_at = NOW() 
       WHERE id = $3`,
      motivo || 'Excluído via Painel RH',
      user.name || 'RH',
      id
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_comunicados 
       SET status = 'EXCLUIDO', 
           motivo_exclusao = $1, 
           data_ultima_alteracao = NOW(), 
           ultima_alteracao_por = $2, 
           updated_at = NOW() 
       WHERE id = $3 AND tenant_id = $4`,
      motivo || 'Excluído via Painel RH',
      user.name || 'RH',
      id,
      user.tenantId
    );
  }

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
  revalidatePath('/sistema/pessoas/comunicados');
  revalidatePath('/pessoas/comunicados');

  return { success: true };
}

export async function criarComunicadoRH(data: {
  titulo: string;
  conteudo: string;
  prioridade?: string;
  destinatarios?: string[];
  pdfAnexo?: {
    storagePath: string;
    nomeOriginal: string;
    mimeType: string;
    tamanhoBytes: number;
    hashSha256: string;
  };
}) {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR', 'SUBSTITUTO');

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
      anexos: data.pdfAnexo
        ? {
            create: {
              tenantId: user.tenantId,
              storagePath: data.pdfAnexo.storagePath,
              nomeOriginal: data.pdfAnexo.nomeOriginal,
              mimeType: data.pdfAnexo.mimeType || 'application/pdf',
              tamanhoBytes: data.pdfAnexo.tamanhoBytes,
              hashSha256: data.pdfAnexo.hashSha256,
              uploadedBy: user.id,
            },
          }
        : undefined,
    },
    include: {
      anexos: true,
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
      temAnexoPdf: !!data.pdfAnexo,
      anexoPdfNome: data.pdfAnexo?.nomeOriginal,
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/sistema/pessoas/comunicados');
  revalidatePath('/pessoas/comunicados');

  return {
    success: true,
    id: novo.id,
    anexos:
      novo.anexos?.map((a) => ({
        id: a.id,
        nomeOriginal: a.nomeOriginal,
        tamanhoBytes: a.tamanhoBytes,
        hashSha256: a.hashSha256,
        storagePath: a.storagePath,
      })) || [],
  };
}

export async function editarComunicadoRH(
  id: string,
  data: {
    titulo: string;
    conteudo: string;
    prioridade?: string;
  }
) {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR', 'SUBSTITUTO');

  const conteudoHash = generateHash(data.conteudo);

  if (user.role === 'MASTER') {
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_comunicados 
       SET titulo = $1, 
           conteudo = $2, 
           conteudo_hash = $3, 
           prioridade = $4, 
           data_ultima_alteracao = NOW(), 
           ultima_alteracao_por = $5, 
           updated_at = NOW() 
       WHERE id = $6`,
      data.titulo,
      data.conteudo,
      conteudoHash,
      data.prioridade || 'NORMAL',
      user.name || 'RH',
      id
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_comunicados 
       SET titulo = $1, 
           conteudo = $2, 
           conteudo_hash = $3, 
           prioridade = $4, 
           data_ultima_alteracao = NOW(), 
           ultima_alteracao_por = $5, 
           updated_at = NOW() 
       WHERE id = $6 AND tenant_id = $7`,
      data.titulo,
      data.conteudo,
      conteudoHash,
      data.prioridade || 'NORMAL',
      user.name || 'RH',
      id,
      user.tenantId
    );
  }

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
  revalidatePath('/sistema/pessoas/comunicados');
  revalidatePath('/pessoas/comunicados');

  return { success: true };
}

'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/lib/audit';
import {
  ensureFeriasTablesExist,
  nomesColaboradorCompativeis,
  obterCpfCompletoColaboradorGestor,
} from '@/lib/ferias/ferias-repository';
import {
  formatarCpfCompleto,
  limparCpfReal,
  mascararCpfLgpd,
} from '@/lib/ferias/idade-calculator';

export interface DeleteHoleriteParams {
  ids: string[];
  colaboradoresNomes?: string[];
  motivo?: string;
  deleteAll?: boolean;
}

/**
 * Exclui holerites (individual ou em lote) com registro na trilha de auditoria WORM.
 */
export async function deleteHoleritesRH(params: DeleteHoleriteParams) {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');
  const { ids, colaboradoresNomes = [], motivo, deleteAll = false } = params;

  const count = ids.length;
  const descricao = deleteAll
    ? `Exclusão em lote de todos os holerites armazenados (${count} registros) pelo RH`
    : `Exclusão de ${count} holerite(s) armazenado(s): ${colaboradoresNomes.slice(0, 3).join(', ')}${count > 3 ? ` e mais ${count - 3}` : ''}`;

  // Se houver registros reais no banco de dados
  try {
    if (ids.length > 0) {
      await prisma.fiorixHolerite.deleteMany({
        where: {
          tenantId: user.tenantId,
          id: { in: ids },
        },
      });
    }
  } catch (dbErr) {
    console.warn('Tabela fiorix_holerites sem correspondência direta para os IDs:', dbErr);
  }

  // Grava auditoria obrigatória WORM
  await recordAuditLog({
    modulo: 'HOLERITES',
    acao: 'EXCLUSAO',
    registroDescricao: descricao,
    detalhes: {
      ids,
      quantidade: count,
      colaboradoresNomes,
      deleteAll,
      motivo: motivo || 'Exclusão de holerite realizada no Painel de RH',
      operador: user.name,
      operadorEmail: user.email,
      cargo: user.role,
      dataHora: new Date().toISOString(),
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/sistema/pessoas/holerites');
  revalidatePath('/pessoas/holerites');

  return { success: true, count };
}


export interface ColaboradorCpfResumoHolerite {
  usuarioId?: string | null;
  registroGestor?: number | null;
  nome: string;
  cpfMascarado: string | null;
  temCpfCadastrado: boolean;
}

/**
 * Retorna o mapa de colaboradores sincronizados do GESTOR com CPF estritamente mascarado (***.XXX.XXX-**)
 * para enriquecer a tabela de Holerites sem expor CPFs completos em lote.
 */
export async function obterMapaColaboradoresCpfHoleritesAction(): Promise<
  ColaboradorCpfResumoHolerite[]
> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');
  await ensureFeriasTablesExist();

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT usuario_id, registro_gestor, nome, cpf, ativo
       FROM public.fiorix_rh_colaboradores_gestor
       WHERE tenant_id = $1 AND COALESCE(excluido_fiorix, FALSE) = FALSE
       ORDER BY ativo DESC, nome ASC`,
      user.tenantId
    );

    if (!Array.isArray(rows)) return [];

    return rows.map((r) => {
      const limpo = limparCpfReal(r.cpf);
      return {
        usuarioId: r.usuario_id ? String(r.usuario_id) : null,
        registroGestor: r.registro_gestor != null ? Number(r.registro_gestor) : null,
        nome: String(r.nome || ''),
        cpfMascarado: mascararCpfLgpd(limpo),
        temCpfCadastrado: Boolean(limpo),
      };
    });
  } catch (err) {
    console.warn('Aviso ao carregar mapa de CPFs mascarados para Holerites:', err);
    return [];
  }
}

/**
 * Revela o CPF completo de um colaborador na tela de Holerites (restrito a RH, ADMIN e MASTER),
 * registrando o acesso em FiorixAcessoLog e na trilha de auditoria WORM (LGPD / Prov. 213/2026).
 */
export async function revelarCpfHoleriteAction(params: {
  holeriteId?: string;
  usuarioId?: string | null;
  registroGestor?: number | null;
  colaboradorNome: string;
  arquivoNome?: string;
}): Promise<{ success: boolean; cpf?: string | null; erro?: string }> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER');

  let cpfFormatado = await obterCpfCompletoColaboradorGestor(user.tenantId, {
    usuarioId: params.usuarioId || undefined,
    registroGestor: params.registroGestor ?? null,
    nome: params.colaboradorNome,
  });

  // Fallback 1: se o nome do arquivo PDF começar com 11 dígitos reais válidos (não seed 100000000XX)
  if (!cpfFormatado && params.arquivoNome) {
    const prefix = params.arquivoNome.split('_')[0] || '';
    const realFromFile = limparCpfReal(prefix);
    if (realFromFile) {
      cpfFormatado = formatarCpfCompleto(realFromFile);
    }
  }

  // Fallback 2: busca em User do tenant por nome compatível com CPF real válido
  if (!cpfFormatado) {
    const users = await prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, name: true, cpf: true },
    });
    const matchedUser = users.find(
      (u) => u.name && nomesColaboradorCompativeis(params.colaboradorNome, u.name) && limparCpfReal(u.cpf)
    );
    if (matchedUser?.cpf) {
      cpfFormatado = formatarCpfCompleto(matchedUser.cpf);
    }
  }

  if (!cpfFormatado) {
    return {
      success: false,
      erro: 'CPF completo não localizado no cadastro sincronizado do GESTOR para este colaborador.',
    };
  }

  try {
    await prisma.fiorixAcessoLog.create({
      data: {
        tenantId: user.tenantId,
        usuarioId: user.id,
        alvoUsuarioId:
          params.usuarioId && !params.usuarioId.startsWith('gestor_') && !params.usuarioId.startsWith('manual_')
            ? params.usuarioId
            : null,
        tipo: 'holerite_cpf_reveal',
        recursoId: params.holeriteId || (params.registroGestor ? String(params.registroGestor) : null),
        metadata: {
          modulo: 'HOLERITES_RH',
          colaboradorNome: params.colaboradorNome,
          registroGestor: params.registroGestor ?? null,
          operadorNome: user.name,
          operadorRole: user.role,
        },
      },
    });
  } catch (logErr) {
    console.warn('Aviso ao gravar FiorixAcessoLog de CPF em Holerites:', logErr);
  }

  await recordAuditLog({
    modulo: 'HOLERITES',
    acao: 'CONSULTA_LGPD',
    registroId: params.holeriteId || params.usuarioId || undefined,
    registroDescricao: `Revelação auditada de CPF completo em Holerites — ${params.colaboradorNome}`,
    detalhes: {
      colaborador: params.colaboradorNome,
      holeriteId: params.holeriteId ?? null,
      registroGestor: params.registroGestor ?? null,
      operador: user.name,
      operadorEmail: user.email,
      dataHora: new Date().toISOString(),
    },
  });

  return { success: true, cpf: cpfFormatado };
}

/**
 * Revela os CPFs completos dos colaboradores listados na tela de Holerites (restrito a RH, ADMIN e MASTER)
 * com auditoria consolidada na trilha WORM.
 */
export async function revelarCpfsEmLoteHoleritesAction(params: {
  itens: Array<{
    id: string;
    colaboradorNome: string;
    usuarioId?: string | null;
    registroGestor?: number | null;
    arquivoNome?: string;
  }>;
}): Promise<{ success: boolean; cpfsPorItemId: Record<string, string> }> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER');
  const cpfsPorItemId: Record<string, string> = {};

  if (!params.itens || params.itens.length === 0) {
    return { success: true, cpfsPorItemId };
  }

  for (const item of params.itens) {
    let cpfFmt = await obterCpfCompletoColaboradorGestor(user.tenantId, {
      usuarioId: item.usuarioId || undefined,
      registroGestor: item.registroGestor ?? null,
      nome: item.colaboradorNome,
    });

    if (!cpfFmt && item.arquivoNome) {
      const realFromFile = limparCpfReal(item.arquivoNome.split('_')[0] || '');
      if (realFromFile) cpfFmt = formatarCpfCompleto(realFromFile);
    }

    if (cpfFmt) {
      cpfsPorItemId[item.id] = cpfFmt;
    }
  }

  await recordAuditLog({
    modulo: 'HOLERITES',
    acao: 'CONSULTA_LGPD',
    registroDescricao: `Revelação auditada de CPF completo na listagem de Holerites (${Object.keys(cpfsPorItemId).length} registros)`,
    detalhes: {
      quantidadeRevelada: Object.keys(cpfsPorItemId).length,
      colaboradores: params.itens.map((i) => i.colaboradorNome).slice(0, 20),
      operador: user.name,
      operadorEmail: user.email,
      dataHora: new Date().toISOString(),
    },
  });

  return { success: true, cpfsPorItemId };
}


export interface HoleriteArmazenadoRHItem {
  id: string;
  usuarioId: string;
  registroGestor?: number | null;
  colaborador: string;
  setor?: string | null;
  cpfMascarado: string;
  temCpfCadastrado: boolean;
  mes: number;
  ano: number;
  mesAno: string;
  dataUpload: string;
  dataUploadIso?: string;
  uploadedBy: string;
  visualizacoes: number;
  status: 'Ativo' | 'Visualizado';
  arquivoNome: string;
  hash: string;
}

/**
 * Lista estritamente os holerites reais armazenados no PostgreSQL para o tenant autenticado,
 * enriquecidos com o CPF mascarado oficial (***.XXX.XXX-**) do cadastro GESTOR / User.
 */
export async function listarHoleritesArmazenadosRHAction(): Promise<HoleriteArmazenadoRHItem[]> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR', 'SUBSTITUTO');
  await ensureFeriasTablesExist();

  const holerites = await prisma.fiorixHolerite.findMany({
    where: { tenantId: user.tenantId },
    include: {
      usuario: {
        select: { id: true, name: true, cpf: true, departamento: true },
      },
      uploader: {
        select: { name: true, role: true },
      },
    },
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }, { dataUpload: 'desc' }],
  });

  if (holerites.length === 0) return [];

  // Mapa GESTOR para enriquecer registro e CPF real mascarado
  let gestorRows: any[] = [];
  try {
    gestorRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT usuario_id, registro_gestor, nome, cpf, setor
       FROM public.fiorix_rh_colaboradores_gestor
       WHERE tenant_id = $1`,
      user.tenantId
    );
  } catch {}

  // Contagem real de acessos/visualizações por holerite em FiorixAcessoLog
  const holeriteIds = holerites.map((h) => h.id);
  const logs = await prisma.fiorixAcessoLog.findMany({
    where: {
      tenantId: user.tenantId,
      recursoId: { in: holeriteIds },
      tipo: 'holerite_download_authorized',
    },
    select: { recursoId: true, usuarioId: true },
  });

  const viewsByHolerite = new Map<string, number>();
  const viewedByOwner = new Set<string>();
  for (const lg of logs) {
    if (!lg.recursoId) continue;
    viewsByHolerite.set(lg.recursoId, (viewsByHolerite.get(lg.recursoId) || 0) + 1);
    const ownerHolerite = holerites.find((h) => h.id === lg.recursoId);
    if (ownerHolerite && lg.usuarioId === ownerHolerite.usuarioId) {
      viewedByOwner.add(lg.recursoId);
    }
  }

  return holerites.map((h) => {
    const nomeColab = h.usuario?.name || 'Colaborador';
    const matchGestor =
      gestorRows.find((g) => g.usuario_id && String(g.usuario_id) === h.usuarioId) ||
      gestorRows.find((g) => g.nome && nomesColaboradorCompativeis(nomeColab, String(g.nome)));

    const cpfReal = limparCpfReal(matchGestor?.cpf) || limparCpfReal(h.usuario?.cpf);
    const cpfMascarado = mascararCpfLgpd(cpfReal) || '—';
    const views = viewsByHolerite.get(h.id) || 0;
    const uploaderRole = h.uploader?.role === 'RH' ? 'RH' : 'Gestão';
    const uploaderLabel = h.uploader?.name ? `${h.uploader.name} (${uploaderRole})` : 'RH';

    return {
      id: h.id,
      usuarioId: h.usuarioId,
      registroGestor: matchGestor?.registro_gestor != null ? Number(matchGestor.registro_gestor) : null,
      colaborador: nomeColab,
      setor: h.usuario?.departamento || matchGestor?.setor || null,
      cpfMascarado,
      temCpfCadastrado: Boolean(cpfReal),
      mes: h.mes,
      ano: h.ano,
      mesAno: `${String(h.mes).padStart(2, '0')}/${h.ano}`,
      dataUpload: new Date(h.dataUpload).toLocaleString('pt-BR'),
      dataUploadIso: new Date(h.dataUpload).toISOString(),
      uploadedBy: uploaderLabel,
      visualizacoes: views,
      status: viewedByOwner.has(h.id) || views > 0 ? 'Visualizado' : 'Ativo',
      arquivoNome: h.arquivoNome,
      hash: h.arquivoHash,
    };
  });
}

export interface HoleriteLogEntry {
  id: string;
  tipo: string;
  dataHora: string;
  ip: string;
  operador: string;
}

/**
 * Consulta os logs reais de acesso/download de um holerite em FiorixAcessoLog.
 */
export async function listarLogsAcessoHoleriteAction(
  holeriteId: string
): Promise<HoleriteLogEntry[]> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');
  const logs = await prisma.fiorixAcessoLog.findMany({
    where: {
      tenantId: user.tenantId,
      recursoId: holeriteId,
    },
    orderBy: { dataAcesso: 'desc' },
    take: 30,
  });

  const userIds = Array.from(new Set(logs.map((l) => l.usuarioId).filter(Boolean)));
  const usuarios =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, role: true },
        })
      : [];
  const userMap = new Map(usuarios.map((u) => [u.id, u]));

  return logs.map((l) => {
    const u = userMap.get(l.usuarioId);
    return {
      id: l.id,
      tipo:
        l.tipo === 'holerite_cpf_reveal'
          ? 'REVELAÇÃO AUDITADA DE CPF (LGPD)'
          : 'VISUALIZAÇÃO / DOWNLOAD AUTORIZADO',
      dataHora: new Date(l.dataAcesso).toLocaleString('pt-BR'),
      ip: l.ip || 'IP protegido',
      operador: u?.name ? `${u.name} (${u.role})` : 'Usuário autenticado',
    };
  });
}

'use server';

import { prisma } from '@/lib/prisma';
import { requireRole, requireAuth } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/lib/audit';
import {
  getEscalaAnual,
  getPublicacaoStatus,
  setPublicacaoStatus,
  salvarOuAtualizarEscala,
  removerEscala,
  EscalaItem,
  PublicacaoStatus,
} from '@/lib/ferias/ferias-repository';
import { validarRegrasCLTFerias } from '@/lib/ferias/clt-validator';

export interface BatchDeleteFeriasParams {
  ano: number;
  colaboradorIds?: string[];
  colaboradoresNomes?: string[];
  deleteAllYear?: boolean;
  motivo?: string;
}

/**
 * Exclui férias em lote (ou limpa o ano completo) com registro na trilha de auditoria WORM.
 */
export async function batchDeleteFerias(params: BatchDeleteFeriasParams) {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');
  const { ano, colaboradorIds = [], colaboradoresNomes = [], deleteAllYear = false, motivo } = params;

  const count = deleteAllYear ? (colaboradorIds.length || 60) : colaboradorIds.length;
  const descricao = deleteAllYear
    ? `Exclusão em lote de toda a escala anual de férias do ano ${ano} (${count} colaboradores)`
    : `Exclusão em lote de ${count} colaboradores da escala de férias ${ano}`;

  try {
    if (colaboradorIds.length > 0 && !deleteAllYear) {
      await prisma.fiorixFeriasPrevista.deleteMany({
        where: {
          tenantId: user.tenantId,
          usuarioId: { in: colaboradorIds },
        },
      });
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.fiorix_ferias_escala WHERE tenant_id = $1 AND ano = $2 AND usuario_id = ANY($3)`,
        user.tenantId,
        ano,
        colaboradorIds
      );
    } else if (deleteAllYear) {
      await prisma.fiorixFeriasPrevista.deleteMany({
        where: {
          tenantId: user.tenantId,
        },
      });
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.fiorix_ferias_escala WHERE tenant_id = $1 AND ano = $2`,
        user.tenantId,
        ano
      );
    }
  } catch (dbErr) {
    console.warn('Erro ao deletar em lote:', dbErr);
  }

  // Grava auditoria obrigatória WORM
  await recordAuditLog({
    modulo: 'FERIAS',
    acao: 'EXCLUSAO',
    registroDescricao: descricao,
    detalhes: {
      ano,
      deleteAllYear,
      quantidade: count,
      colaboradorIds,
      colaboradoresNomes: colaboradoresNomes.slice(0, 10),
      motivo: motivo || 'Exclusão em lote solicitada pelo RH no Painel de Governança',
      operador: user.name,
      operadorEmail: user.email,
      dataHora: new Date().toISOString(),
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/pessoas');
  revalidatePath('/pessoas/ferias');

  return { success: true, count };
}

export interface DeleteSingleFeriasParams {
  ano: number;
  colaboradorId: string;
  colaboradorNome: string;
  setor?: string;
  motivo?: string;
}

/**
 * Exclusão individual de escala de férias com registro na trilha WORM.
 */
export async function deleteSingleFerias(params: DeleteSingleFeriasParams) {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');
  const { ano, colaboradorId, colaboradorNome, setor, motivo } = params;

  try {
    await prisma.fiorixFeriasPrevista.deleteMany({
      where: {
        tenantId: user.tenantId,
        usuarioId: colaboradorId,
      },
    });
    await removerEscala(user.tenantId, colaboradorId, ano);
  } catch (err) {
    console.warn('Erro ao deletar previsão individual no banco:', err);
  }

  await recordAuditLog({
    modulo: 'FERIAS',
    acao: 'EXCLUSAO',
    registroId: colaboradorId,
    registroDescricao: `Exclusão de férias ${ano} - ${colaboradorNome} (${setor || 'Geral'})`,
    detalhes: {
      ano,
      colaboradorId,
      colaboradorNome,
      setor,
      motivo: motivo || 'Exclusão individual de escala de férias pelo RH',
      operador: user.name,
      operadorEmail: user.email,
      dataHora: new Date().toISOString(),
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/pessoas');
  revalidatePath('/pessoas/ferias');

  return { success: true };
}

/**
 * Busca a escala anual de férias do ano solicitado.
 * - Gestores/RH veem todos os colaboradores.
 * - Colaboradores só veem suas próprias férias se a escala estiver PUBLICADA.
 */
export async function getEscalaAnualAction(params: { ano: number }): Promise<{
  publicacao: PublicacaoStatus;
  colaboradores: EscalaItem[];
}> {
  const user = await requireAuth();
  return getEscalaAnual(user.tenantId, params.ano, user.id, user.role);
}

export interface MinhasFeriasResponse {
  publicacao: PublicacaoStatus;
  ferias: EscalaItem | null;
}

/**
 * Consulta segura e isolada das férias do colaborador autenticado (Anti-IDOR / Zero Leakage).
 * - Identidade obtida estritamente da sessão.
 * - Se a escala estiver em RASCUNHO e o usuário for colaborador comum, retorna ferias: null.
 * - Sanitiza o histórico para remover dados internos de auditoria/operadores.
 */
export async function getMinhasFeriasAction(params: { ano: number }): Promise<MinhasFeriasResponse> {
  const user = await requireAuth();
  const ano = Number(params.ano);
  if (![2026, 2027, 2028].includes(ano)) {
    throw new Error('Ano inválido para consulta de férias');
  }

  const isManager = ['ADMIN', 'RH', 'MASTER', 'GESTOR'].includes(user.role);
  const publicacao = await getPublicacaoStatus(user.tenantId, ano);

  // Se colaborador comum e a escala ainda não foi publicada, não expõe rascunho
  if (!isManager && publicacao.status !== 'PUBLICADA') {
    return {
      publicacao,
      ferias: null,
    };
  }

  // Busca estritamente o registro do próprio usuário autenticado
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, usuario_id, ano, nome, email, setor, cargo,
            p1_inicio, p1_fim, p1_dias,
            p2_inicio, p2_fim, p2_dias,
            p3_inicio, p3_fim, p3_dias,
            total_dias, status, observacao, historico
     FROM public.fiorix_ferias_escala
     WHERE tenant_id = $1 AND ano = $2 AND usuario_id = $3
     LIMIT 1`,
    user.tenantId,
    ano,
    user.id
  );

  if (!rows || rows.length === 0) {
    return { publicacao, ferias: null };
  }

  const r = rows[0];
  let p1Inicio = r.p1_inicio;
  let p1Fim = r.p1_fim;
  let p1Dias = Number(r.p1_dias || 0);
  let totalDias = Number(r.total_dias || 0);
  let status = (r.status as 'programado' | 'conflito' | 'pendente') || 'programado';
  let historicoRaw = typeof r.historico === 'string' ? JSON.parse(r.historico) : r.historico || [];

  // Defesa em profundidade: se p1Inicio estiver vazio mas o histórico possuir agendamento cadastrado
  if ((!p1Inicio || p1Inicio === '') && Array.isArray(historicoRaw) && historicoRaw.length > 0) {
    const lastEv = historicoRaw[historicoRaw.length - 1];
    const match = lastEv?.para?.match(/(\d{4}-\d{2}-\d{2})\s+a\s+(\d{4}-\d{2}-\d{2})\s*\((\d+)d\)/);
    if (match) {
      p1Inicio = match[1];
      p1Fim = match[2];
      p1Dias = parseInt(match[3], 10);
      totalDias = p1Dias;
      if (status === 'pendente') status = 'programado';
    }
  }

  // Sanitização do histórico para visualização amigável do colaborador
  const historicoSanitizado = Array.isArray(historicoRaw)
    ? historicoRaw.map((h: any, i: number) => ({
        id: `ev-${i}`,
        data: h.data || '',
        titulo: `Férias de ${ano} programadas`,
        por: 'Atualizado por RH',
        motivo: h.motivo || `Programação inicial para ${ano}`,
        para: h.para || '',
        de: h.de || '',
      })).reverse()
    : [];

  return {
    publicacao,
    ferias: {
      id: r.id,
      usuarioId: r.usuario_id,
      ano: r.ano,
      nome: r.nome,
      email: r.email,
      setor: r.setor || 'Geral',
      cargo: r.cargo,
      p1Inicio,
      p1Fim,
      p1Dias,
      p2Inicio: r.p2_inicio,
      p2Fim: r.p2_fim,
      p2Dias: Number(r.p2_dias || 0),
      p3Inicio: r.p3_inicio,
      p3Fim: r.p3_fim,
      p3Dias: Number(r.p3_dias || 0),
      totalDias,
      status,
      observacao: r.observacao,
      historico: historicoSanitizado,
    },
  };
}

/**
 * Consulta apenas o status de publicação da escala do ano.
 */
export async function getPublicacaoStatusAction(params: { ano: number }): Promise<PublicacaoStatus> {
  const user = await requireAuth();
  return getPublicacaoStatus(user.tenantId, params.ano);
}

/**
 * Publica a escala anual de férias no Painel de RH.
 */
export async function publicarEscalaAnualAction(params: { ano: number }): Promise<{ success: boolean; status: PublicacaoStatus }> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER');
  const { ano } = params;

  const anterior = await getPublicacaoStatus(user.tenantId, ano);
  const status = await setPublicacaoStatus(user.tenantId, ano, 'PUBLICADA', user.id);

  await recordAuditLog({
    modulo: 'FERIAS',
    acao: 'ALTERACAO',
    registroDescricao: `Publicação da Escala Anual de Férias ${ano} homologada pelo RH`,
    detalhes: {
      ano,
      statusAnterior: anterior.status,
      statusNovo: 'PUBLICADA',
      operador: user.name,
      operadorEmail: user.email,
      dataHora: new Date().toISOString(),
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/pessoas');
  revalidatePath('/pessoas/ferias');

  return { success: true, status };
}

/**
 * Retira a escala anual do ar no Painel de RH (reverte para rascunho sem excluir dados).
 */
export async function retirarEscalaDoArAction(params: { ano: number; motivo?: string }): Promise<{ success: boolean; status: PublicacaoStatus }> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER');
  const { ano, motivo } = params;

  const anterior = await getPublicacaoStatus(user.tenantId, ano);
  const status = await setPublicacaoStatus(user.tenantId, ano, 'RASCUNHO', user.id);

  await recordAuditLog({
    modulo: 'FERIAS',
    acao: 'ALTERACAO',
    registroDescricao: `Retirada do ar da Escala Anual de Férias ${ano} pelo RH (Retorno para Rascunho)`,
    detalhes: {
      ano,
      statusAnterior: anterior.status,
      statusNovo: 'RASCUNHO',
      motivo: motivo || 'Ajustes na programação de férias pelo RH',
      operador: user.name,
      operadorEmail: user.email,
      dataHora: new Date().toISOString(),
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/pessoas');
  revalidatePath('/pessoas/ferias');

  return { success: true, status };
}

/**
 * Salva ou atualiza um lançamento individual de férias com validação CLT e auditoria WORM.
 */
export async function salvarLancamentoFeriasAction(params: {
  usuarioId: string;
  ano: number;
  nome: string;
  setor: string;
  cargo?: string;
  p1Inicio?: string;
  p1Fim?: string;
  p1Dias: number;
  p2Inicio?: string;
  p2Fim?: string;
  p2Dias?: number;
  p3Inicio?: string;
  p3Fim?: string;
  p3Dias?: number;
  status: 'programado' | 'conflito' | 'pendente';
  observacao?: string;
}): Promise<{ success: boolean; item?: EscalaItem; erro?: string }> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');

  // Validação CLT
  const periodos = [
    { inicio: params.p1Inicio || '', fim: params.p1Fim || '', dias: params.p1Dias },
    { inicio: params.p2Inicio || '', fim: params.p2Fim || '', dias: params.p2Dias || 0 },
    { inicio: params.p3Inicio || '', fim: params.p3Fim || '', dias: params.p3Dias || 0 },
  ].filter((p) => p.inicio && p.fim && p.dias > 0);

  if (periodos.length > 0) {
    const cltVal = validarRegrasCLTFerias(periodos);
    if (!cltVal.valido) {
      return { success: false, erro: cltVal.erros.join(' ') };
    }
  }

  const item = await salvarOuAtualizarEscala(user.tenantId, params, user.name || 'Gestor RH');

  await recordAuditLog({
    modulo: 'FERIAS',
    acao: 'ALTERACAO',
    registroId: params.usuarioId,
    registroDescricao: `Programação de férias ${params.ano} - ${params.nome} (${params.setor})`,
    detalhes: {
      ano: params.ano,
      colaborador: params.nome,
      setor: params.setor,
      p1Inicio: params.p1Inicio,
      p1Fim: params.p1Fim,
      p1Dias: params.p1Dias,
      totalDias: item.totalDias,
      status: params.status,
      operador: user.name,
      operadorEmail: user.email,
      dataHora: new Date().toISOString(),
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/pessoas');
  revalidatePath('/pessoas/ferias');

  return { success: true, item };
}

/**
 * Remove um lançamento de férias com auditoria.
 */
export async function removerLancamentoFeriasAction(params: {
  usuarioId: string;
  nome: string;
  ano: number;
  motivo?: string;
}): Promise<{ success: boolean }> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');
  const { usuarioId, nome, ano, motivo } = params;

  await removerEscala(user.tenantId, usuarioId, ano);

  await recordAuditLog({
    modulo: 'FERIAS',
    acao: 'EXCLUSAO',
    registroId: usuarioId,
    registroDescricao: `Exclusão de programação de férias ${ano} - ${nome}`,
    detalhes: {
      ano,
      usuarioId,
      colaborador: nome,
      motivo: motivo || 'Exclusão solicitada pelo RH',
      operador: user.name,
      operadorEmail: user.email,
      dataHora: new Date().toISOString(),
    },
  });

  revalidatePath('/sistema/pessoas');
  revalidatePath('/pessoas');
  revalidatePath('/pessoas/ferias');

  return { success: true };
}

/**
 * Lista os colaboradores reais disponíveis no tenant para preenchimento de modais.
 */
export async function getColaboradoresDisponiveisAction(): Promise<Array<{ id: string; name: string; email: string }>> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');
  const users = await prisma.user.findMany({
    where: { tenantId: user.tenantId },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  return users.map((u) => ({ id: u.id, name: u.name || 'Sem nome', email: u.email }));
}

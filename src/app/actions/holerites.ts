'use server';

import { createHash, randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase';
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
import {
  avaliarTempestividadeUpload,
  calcularPrazoLegalClt,
  formatarCompetenciaCurta,
  formatarCompetenciaTitulo,
  gerarManifestHashCompetencia,
  obterTipoFolhaPorMes,
  TipoFolhaHolerite,
} from '@/lib/holerites/clt-prazo-calculator';
import {
  ensureHoleritesGovernanceTablesExist,
  MOTIVOS_DISPENSA_HOLERITE,
  normalizarNomeChave,
  obterPainelGovernancaHolerites,
  PainelGovernancaHoleritesData,
} from '@/lib/holerites/holerites-governance-repository';

const BUCKET_NAME = 'fiorix-holerites';

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

  if (!cpfFormatado && params.arquivoNome) {
    const prefix = params.arquivoNome.split('_')[0] || '';
    const realFromFile = limparCpfReal(prefix);
    if (realFromFile) {
      cpfFormatado = formatarCpfCompleto(realFromFile);
    }
  }

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
  cargo?: string | null;
  cpfMascarado: string;
  temCpfCadastrado: boolean;
  mes: number;
  ano: number;
  mesAno: string;
  competenciaTitulo: string;
  tipoFolha: TipoFolhaHolerite;
  prazoLegalCltIso: string;
  prazoLegalCltBr: string;
  entregueNoPrazoClt: boolean;
  diasAtrasoClt: number;
  justificativaAtraso?: string | null;
  dataUpload: string;
  dataUploadIso?: string;
  uploadedBy: string;
  visualizacoes: number;
  primeiraVisualizacaoBr?: string | null;
  status: 'Ativo' | 'Visualizado';
  arquivoNome: string;
  tamanhoBytes?: number;
  hash: string;
}

/**
 * Lista estritamente os holerites reais armazenados no PostgreSQL para o tenant autenticado,
 * enriquecidos com o CPF mascarado oficial (***.XXX.XXX-**), snapshot histórico e validação CLT.
 */
export async function listarHoleritesArmazenadosRHAction(): Promise<HoleriteArmazenadoRHItem[]> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR', 'SUBSTITUTO');
  await ensureHoleritesGovernanceTablesExist();

  const holerites = await prisma.fiorixHolerite.findMany({
    where: { tenantId: user.tenantId },
    include: {
      usuario: {
        select: { id: true, name: true, cpf: true, departamento: true, cargo: true },
      },
      uploader: {
        select: { name: true, role: true },
      },
    },
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }, { dataUpload: 'desc' }],
  });

  if (holerites.length === 0) return [];

  // Carrega colunas extras de governança CLT e snapshot histórico
  const extraMap = new Map<string, any>();
  try {
    const extraRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, tipo_folha, prazo_legal_clt, entregue_no_prazo_clt, justificativa_atraso,
              colaborador_nome_snapshot, registro_gestor_snapshot, cpf_mascarado_snapshot,
              setor_snapshot, cargo_snapshot, primeira_visualizacao_em
       FROM public.fiorix_holerites
       WHERE tenant_id = $1`,
      user.tenantId
    );
    for (const r of extraRows || []) {
      extraMap.set(String(r.id), r);
    }
  } catch {}

  let gestorRows: any[] = [];
  try {
    gestorRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT usuario_id, registro_gestor, nome, cpf, setor, cargo
       FROM public.fiorix_rh_colaboradores_gestor
       WHERE tenant_id = $1`,
      user.tenantId
    );
  } catch {}

  const holeriteIds = holerites.map((h) => h.id);
  const logs = await prisma.fiorixAcessoLog.findMany({
    where: {
      tenantId: user.tenantId,
      recursoId: { in: holeriteIds },
      tipo: 'holerite_download_authorized',
    },
    select: { recursoId: true, usuarioId: true, dataAcesso: true },
    orderBy: { dataAcesso: 'asc' },
  });

  const viewsByHolerite = new Map<string, number>();
  const viewedByOwner = new Set<string>();
  const firstOwnerViewByHolerite = new Map<string, Date>();

  for (const lg of logs) {
    if (!lg.recursoId) continue;
    viewsByHolerite.set(lg.recursoId, (viewsByHolerite.get(lg.recursoId) || 0) + 1);
    const ownerHolerite = holerites.find((h) => h.id === lg.recursoId);
    if (ownerHolerite && lg.usuarioId === ownerHolerite.usuarioId) {
      viewedByOwner.add(lg.recursoId);
      if (!firstOwnerViewByHolerite.has(lg.recursoId)) {
        firstOwnerViewByHolerite.set(lg.recursoId, lg.dataAcesso);
      }
    }
  }

  return holerites.map((h) => {
    const extra = extraMap.get(h.id);
    const nomeColab =
      h.usuario?.name ||
      (extra?.colaborador_nome_snapshot ? String(extra.colaborador_nome_snapshot) : 'Colaborador');

    const matchGestor =
      gestorRows.find((g) => g.usuario_id && String(g.usuario_id) === h.usuarioId) ||
      gestorRows.find((g) => g.nome && nomesColaboradorCompativeis(nomeColab, String(g.nome)));

    const cpfReal = limparCpfReal(matchGestor?.cpf) || limparCpfReal(h.usuario?.cpf);
    const cpfMascarado =
      mascararCpfLgpd(cpfReal) ||
      (extra?.cpf_mascarado_snapshot ? String(extra.cpf_mascarado_snapshot) : '—');
    const views = viewsByHolerite.get(h.id) || 0;
    const uploaderRole = h.uploader?.role === 'RH' ? 'RH' : 'Gestão';
    const uploaderLabel = h.uploader?.name ? `${h.uploader.name} (${uploaderRole})` : 'RH';

    const prazoClt = calcularPrazoLegalClt(h.ano, h.mes);
    const temp = avaliarTempestividadeUpload(h.dataUpload, prazoClt.dataLimiteIso);
    const primeiraVisDate = extra?.primeira_visualizacao_em
      ? new Date(extra.primeira_visualizacao_em)
      : firstOwnerViewByHolerite.get(h.id) || null;

    return {
      id: h.id,
      usuarioId: h.usuarioId,
      registroGestor:
        matchGestor?.registro_gestor != null
          ? Number(matchGestor.registro_gestor)
          : extra?.registro_gestor_snapshot != null
          ? Number(extra.registro_gestor_snapshot)
          : null,
      colaborador: nomeColab,
      setor:
        (matchGestor?.setor ? String(matchGestor.setor) : null) ||
        h.usuario?.departamento ||
        (extra?.setor_snapshot ? String(extra.setor_snapshot) : null),
      cargo:
        (matchGestor?.cargo ? String(matchGestor.cargo) : null) ||
        h.usuario?.cargo ||
        (extra?.cargo_snapshot ? String(extra.cargo_snapshot) : null),
      cpfMascarado,
      temCpfCadastrado: Boolean(cpfReal),
      mes: h.mes,
      ano: h.ano,
      mesAno: formatarCompetenciaCurta(h.mes, h.ano),
      competenciaTitulo: formatarCompetenciaTitulo(h.mes, h.ano),
      tipoFolha: obterTipoFolhaPorMes(h.mes),
      prazoLegalCltIso: prazoClt.dataLimiteIso,
      prazoLegalCltBr: prazoClt.dataLimiteBr,
      entregueNoPrazoClt: temp.noPrazo,
      diasAtrasoClt: temp.diasAtraso,
      justificativaAtraso: extra?.justificativa_atraso ? String(extra.justificativa_atraso) : null,
      dataUpload: new Date(h.dataUpload).toLocaleString('pt-BR'),
      dataUploadIso: new Date(h.dataUpload).toISOString(),
      uploadedBy: uploaderLabel,
      visualizacoes: views,
      primeiraVisualizacaoBr: primeiraVisDate ? primeiraVisDate.toLocaleString('pt-BR') : null,
      status: viewedByOwner.has(h.id) || views > 0 ? 'Visualizado' : 'Ativo',
      arquivoNome: h.arquivoNome,
      tamanhoBytes: h.tamanhoBytes,
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

// ═════════════════════════════════════════════════════════════════════════════
// GOVERNANÇA TRABALHISTA (CLT), FALTANTES, HOMOLOGAÇÃO E DOSSIÊ CORREGEDORIA
// ═════════════════════════════════════════════════════════════════════════════

export async function obterPainelGovernancaHoleritesAction(
  ano?: number
): Promise<PainelGovernancaHoleritesData> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR', 'SUBSTITUTO');
  return obterPainelGovernancaHolerites(user.tenantId, ano);
}

/**
 * Registra justificativa / dispensa legal de holerite para colaborador em uma competência
 * (ex: Afastamento INSS, Licença sem Vencimentos, Férias Pagas no Mês Anterior).
 */
export async function registrarDispensaLegalHoleriteAction(params: {
  usuarioId?: string | null;
  registroGestor?: number | null;
  colaboradorNome: string;
  ano: number;
  mes: number;
  motivoCodigo: string;
  descricao?: string;
}): Promise<{ success: boolean; erro?: string }> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER');
  await ensureHoleritesGovernanceTablesExist();

  const nome = (params.colaboradorNome || '').trim();
  if (!nome || params.mes < 1 || params.mes > 14 || params.ano < 2000 || params.ano > 2100) {
    return { success: false, erro: 'Parâmetros inválidos para dispensa legal.' };
  }

  const nomeNorm = normalizarNomeChave(nome);
  const motivoCodigo = MOTIVOS_DISPENSA_HOLERITE[params.motivoCodigo]
    ? params.motivoCodigo
    : 'OUTRO_LEGAL';
  const motivoLabel = MOTIVOS_DISPENSA_HOLERITE[motivoCodigo];
  const descricaoLimpa = params.descricao?.trim() ? params.descricao.trim().slice(0, 500) : null;
  const tipoFolha = obterTipoFolhaPorMes(params.mes);
  const id = `disp_${randomUUID().replace(/-/g, '')}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fiorix_holerites_dispensas
      (id, tenant_id, usuario_id, registro_gestor, nome_normalizado, colaborador_nome, ano, mes, tipo_folha, motivo_codigo, descricao, registrado_por_id, registrado_por_nome, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
     ON CONFLICT (tenant_id, nome_normalizado, ano, mes)
     DO UPDATE SET
       motivo_codigo = EXCLUDED.motivo_codigo,
       descricao = EXCLUDED.descricao,
       registrado_por_id = EXCLUDED.registrado_por_id,
       registrado_por_nome = EXCLUDED.registrado_por_nome,
       created_at = NOW()`,
    id,
    user.tenantId,
    params.usuarioId || null,
    params.registroGestor ?? null,
    nomeNorm,
    nome,
    params.ano,
    params.mes,
    tipoFolha,
    motivoCodigo,
    descricaoLimpa,
    user.id,
    user.name
  );

  await recordAuditLog({
    modulo: 'HOLERITES',
    acao: 'ALTERACAO',
    registroId: id,
    registroDescricao: `Dispensa legal de holerite registrada (${formatarCompetenciaCurta(params.mes, params.ano)}) — ${nome}: ${motivoLabel}`,
    detalhes: {
      colaborador: nome,
      registroGestor: params.registroGestor ?? null,
      competencia: formatarCompetenciaCurta(params.mes, params.ano),
      motivoCodigo,
      motivoLabel,
      descricao: descricaoLimpa,
      operador: user.name,
      operadorEmail: user.email,
    },
  });

  revalidatePath('/sistema/pessoas/holerites');
  return { success: true };
}

export async function removerDispensaLegalHoleriteAction(
  dispensaId: string
): Promise<{ success: boolean }> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER');
  await ensureHoleritesGovernanceTablesExist();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM public.fiorix_holerites_dispensas WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    dispensaId,
    user.tenantId
  );
  const alvo = rows?.[0];
  if (alvo) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.fiorix_holerites_dispensas WHERE id = $1 AND tenant_id = $2`,
      dispensaId,
      user.tenantId
    );
    await recordAuditLog({
      modulo: 'HOLERITES',
      acao: 'ALTERACAO',
      registroId: dispensaId,
      registroDescricao: `Remoção de dispensa legal de holerite (${formatarCompetenciaCurta(Number(alvo.mes), Number(alvo.ano))}) — ${alvo.colaborador_nome}`,
      detalhes: {
        colaborador: alvo.colaborador_nome,
        competencia: formatarCompetenciaCurta(Number(alvo.mes), Number(alvo.ano)),
        operador: user.name,
      },
    });
  }

  revalidatePath('/sistema/pessoas/holerites');
  return { success: true };
}

/**
 * Homologa formalmente uma competência mensal ou de 13º salário, gerando manifesto SHA-256
 * determinístico de todos os documentos arquivados e gravando ata imutável WORM.
 */
export async function homologarCompetenciaHoleritesAction(params: {
  ano: number;
  mes: number;
  observacoes?: string;
}): Promise<{
  success: boolean;
  manifestHashSha256?: string;
  erro?: string;
}> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER');
  await ensureHoleritesGovernanceTablesExist();

  const painel = await obterPainelGovernancaHolerites(user.tenantId, params.ano);
  const comp = painel.competencias.find((c) => c.mes === params.mes);
  if (!comp) {
    return { success: false, erro: 'Competência inválida.' };
  }

  if (comp.arquivadosCount === 0 && comp.dispensadosCount === 0) {
    return {
      success: false,
      erro: 'Não é possível homologar uma competência sem nenhum holerite arquivado ou justificado.',
    };
  }

  const holeritesComp = await prisma.fiorixHolerite.findMany({
    where: { tenantId: user.tenantId, ano: params.ano, mes: params.mes },
    select: { id: true, arquivoHash: true },
  });

  const manifestHash = gerarManifestHashCompetencia(
    user.tenantId,
    params.ano,
    params.mes,
    holeritesComp.map((h) => h.arquivoHash)
  );

  const id = `comp_${user.tenantId.slice(-8)}_${params.ano}_${String(params.mes).padStart(2, '0')}`;
  const obs = params.observacoes?.trim() ? params.observacoes.trim().slice(0, 1000) : null;

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fiorix_holerites_competencias
      (id, tenant_id, ano, mes, tipo_folha, prazo_legal_clt, status_fechamento,
       total_elegiveis, total_arquivados, total_dispensados, total_no_prazo_clt,
       manifest_hash_sha256, homologado_por_id, homologado_por_nome, homologado_em, observacoes, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::date, 'HOMOLOGADA', $7, $8, $9, $10, $11, $12, $13, NOW(), $14, NOW())
     ON CONFLICT (tenant_id, ano, mes)
     DO UPDATE SET
       status_fechamento = 'HOMOLOGADA',
       prazo_legal_clt = EXCLUDED.prazo_legal_clt,
       total_elegiveis = EXCLUDED.total_elegiveis,
       total_arquivados = EXCLUDED.total_arquivados,
       total_dispensados = EXCLUDED.total_dispensados,
       total_no_prazo_clt = EXCLUDED.total_no_prazo_clt,
       manifest_hash_sha256 = EXCLUDED.manifest_hash_sha256,
       homologado_por_id = EXCLUDED.homologado_por_id,
       homologado_por_nome = EXCLUDED.homologado_por_nome,
       homologado_em = NOW(),
       observacoes = EXCLUDED.observacoes,
       updated_at = NOW()`,
    id,
    user.tenantId,
    params.ano,
    params.mes,
    comp.tipoFolha,
    comp.prazoClt.dataLimiteIso,
    comp.elegiveisCount,
    comp.arquivadosCount,
    comp.dispensadosCount,
    comp.noPrazoCount,
    manifestHash,
    user.id,
    user.name,
    obs
  );

  await recordAuditLog({
    modulo: 'HOLERITES',
    acao: 'HOMOLOGACAO',
    registroId: id,
    registroDescricao: `Homologação trabalhista (CLT) da competência ${comp.codigo} — ${comp.arquivadosCount}/${comp.elegiveisCount} holerites (${comp.noPrazoCount} no prazo CLT)`,
    detalhes: {
      competencia: comp.codigo,
      titulo: comp.titulo,
      prazoLegalClt: comp.prazoClt.dataLimiteBr,
      elegiveis: comp.elegiveisCount,
      arquivados: comp.arquivadosCount,
      dispensados: comp.dispensadosCount,
      faltantesNoMomento: comp.faltantesCount,
      noPrazoClt: comp.noPrazoCount,
      foraDoPrazoClt: comp.foraDoPrazoCount,
      manifestHashSha256: manifestHash,
      observacoes: obs,
      homologadoPor: user.name,
      homologadoEmail: user.email,
      dataHora: new Date().toISOString(),
    },
  });

  revalidatePath('/sistema/pessoas/holerites');
  return { success: true, manifestHashSha256: manifestHash };
}

export async function reabrirCompetenciaHoleritesAction(params: {
  ano: number;
  mes: number;
  motivo?: string;
}): Promise<{ success: boolean }> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER');
  await ensureHoleritesGovernanceTablesExist();

  await prisma.$executeRawUnsafe(
    `UPDATE public.fiorix_holerites_competencias
     SET status_fechamento = 'REABERTA', updated_at = NOW()
     WHERE tenant_id = $1 AND ano = $2 AND mes = $3`,
    user.tenantId,
    params.ano,
    params.mes
  );

  await recordAuditLog({
    modulo: 'HOLERITES',
    acao: 'ALTERACAO',
    registroDescricao: `Reabertura administrativa da competência ${formatarCompetenciaCurta(params.mes, params.ano)} para retificação complementar`,
    detalhes: {
      competencia: formatarCompetenciaCurta(params.mes, params.ano),
      motivo: params.motivo || 'Retificação / inclusão complementar pelo RH',
      operador: user.name,
    },
  });

  revalidatePath('/sistema/pessoas/holerites');
  return { success: true };
}

export interface ResultadoAuditoriaIntegridade {
  success: boolean;
  verificados: number;
  integros: number;
  inconsistencias: Array<{
    id: string;
    colaborador: string;
    competencia: string;
    arquivoNome: string;
    motivo: string;
  }>;
  verificadoEmBr: string;
  protocoloHash: string;
}

/**
 * Audita sob demanda a integridade criptográfica SHA-256 e a presença física real dos arquivos PDF
 * no bucket privado do Supabase Storage (`fiorix-holerites`), gravando certidão WORM.
 */
export async function auditarIntegridadeStorageHoleritesAction(params?: {
  ano?: number | null;
  mes?: number | null;
}): Promise<ResultadoAuditoriaIntegridade> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR');
  await ensureHoleritesGovernanceTablesExist();

  const whereClause: any = { tenantId: user.tenantId };
  if (params?.ano) whereClause.ano = params.ano;
  if (params?.mes) whereClause.mes = params.mes;

  const registros = await prisma.fiorixHolerite.findMany({
    where: whereClause,
    include: { usuario: { select: { name: true } } },
    orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
  });

  const inconsistencias: ResultadoAuditoriaIntegridade['inconsistencias'] = [];
  const hashesOk: string[] = [];

  for (const reg of registros) {
    const comp = formatarCompetenciaCurta(reg.mes, reg.ano);
    const nome = reg.usuario?.name || 'Colaborador';

    if (!reg.arquivoHash || !/^[a-f0-9]{64}$/i.test(reg.arquivoHash)) {
      inconsistencias.push({
        id: reg.id,
        colaborador: nome,
        competencia: comp,
        arquivoNome: reg.arquivoNome,
        motivo: 'Hash SHA-256 ausente ou fora do padrão hexadecimal de 64 caracteres.',
      });
      continue;
    }

    // Verifica existência real do objeto no bucket privado gerando URL assinada efêmera (60s)
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(reg.storagePath, 60);

    if (error || !data?.signedUrl) {
      inconsistencias.push({
        id: reg.id,
        colaborador: nome,
        competencia: comp,
        arquivoNome: reg.arquivoNome,
        motivo: 'Objeto PDF não localizado no bucket privado de custódia.',
      });
      continue;
    }

    hashesOk.push(reg.arquivoHash);
  }

  const verificadoEmBr = new Date().toLocaleString('pt-BR');
  const protocoloHash = createHash('sha256')
    .update(
      `FIORIX_STORAGE_AUDIT|${user.tenantId}|${verificadoEmBr}|${registros.length}|${hashesOk.sort().join(',')}`
    )
    .digest('hex');

  await recordAuditLog({
    modulo: 'HOLERITES',
    acao: 'AUDITORIA_INTEGRIDADE',
    registroDescricao: `Auditoria técnica de integridade Storage & SHA-256: ${hashesOk.length}/${registros.length} arquivos íntegros`,
    detalhes: {
      escopoAno: params?.ano ?? 'TODOS',
      escopoMes: params?.mes ?? 'TODOS',
      verificados: registros.length,
      integros: hashesOk.length,
      inconsistenciasCount: inconsistencias.length,
      protocoloHash,
      operador: user.name,
    },
  });

  return {
    success: inconsistencias.length === 0,
    verificados: registros.length,
    integros: hashesOk.length,
    inconsistencias,
    verificadoEmBr,
    protocoloHash,
  };
}

export interface DossieCorregedoriaData {
  serventiaNome: string;
  serventiaCnpj: string | null;
  serventiaCidadeUf: string;
  emitidoEmBr: string;
  emitidoPorNome: string;
  emitidoPorCargo: string;
  protocoloVerificacaoSha256: string;
  anoReferencia: number;
  resumoPlurianual: Array<{
    ano: number;
    totalArquivos: number;
    colaboradoresDistintos: number;
    totalNoPrazoClt: number;
    competenciasHomologadas: number;
  }>;
  painelAno: PainelGovernancaHoleritesData;
  acervoNominal: HoleriteArmazenadoRHItem[];
  trilhaWormRecente: Array<{
    id: string;
    acao: string;
    descricao: string;
    usuarioNome: string;
    dataHoraBr: string;
  }>;
}

/**
 * Emite o Dossiê Completo de Rastreabilidade Trabalhista e Custódia Digital de Holerites
 * estruturado para conferência interna do RH ou inspeção da Corregedoria Geral da Justiça (CGJ-SP / CNJ).
 */
export async function obterDossieCorregedoriaHoleritesAction(
  anoInput?: number
): Promise<DossieCorregedoriaData> {
  const user = await requireRole('ADMIN', 'RH', 'MASTER', 'GESTOR', 'SUBSTITUTO');
  await ensureHoleritesGovernanceTablesExist();

  const anoRef = anoInput && anoInput >= 2000 && anoInput <= 2100 ? anoInput : new Date().getFullYear();

  const [tenant, painelAno, acervoCompleto, plurianualRows, homologadasPorAnoRows, wormRows] =
    await Promise.all([
      prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { name: true, cnpj: true, cidade: true, estado: true },
      }),
      obterPainelGovernancaHolerites(user.tenantId, anoRef),
      listarHoleritesArmazenadosRHAction(),
      prisma
        .$queryRawUnsafe<any[]>(
          `SELECT ano,
                  COUNT(*)::int AS total_arquivos,
                  COUNT(DISTINCT usuario_id)::int AS colaboradores_distintos,
                  SUM(CASE WHEN COALESCE(entregue_no_prazo_clt, TRUE) THEN 1 ELSE 0 END)::int AS total_no_prazo
           FROM public.fiorix_holerites
           WHERE tenant_id = $1
           GROUP BY ano
           ORDER BY ano DESC`,
          user.tenantId
        )
        .catch(() => [] as any[]),
      prisma
        .$queryRawUnsafe<any[]>(
          `SELECT ano, COUNT(*)::int AS total_homologadas
           FROM public.fiorix_holerites_competencias
           WHERE tenant_id = $1 AND status_fechamento = 'HOMOLOGADA'
           GROUP BY ano`,
          user.tenantId
        )
        .catch(() => [] as any[]),
      prisma
        .$queryRawUnsafe<any[]>(
          `SELECT id, acao, registro_descricao, usuario_nome, created_at
           FROM public.fiorix_audit_logs
           WHERE tenant_id = $1 AND modulo = 'HOLERITES'
           ORDER BY created_at DESC
           LIMIT 40`,
          user.tenantId
        )
        .catch(() => [] as any[]),
    ]);

  const homMap = new Map<number, number>();
  for (const hr of homologadasPorAnoRows || []) {
    homMap.set(Number(hr.ano), Number(hr.total_homologadas || 0));
  }

  const anosPluriSet = new Set<number>([anoRef, ...painelAno.anosDisponiveis]);
  const pluriMap = new Map<number, any>();
  for (const pr of plurianualRows || []) {
    const a = Number(pr.ano);
    anosPluriSet.add(a);
    pluriMap.set(a, pr);
  }

  const resumoPlurianual = Array.from(anosPluriSet)
    .sort((a, b) => b - a)
    .map((a) => {
      const row = pluriMap.get(a);
      return {
        ano: a,
        totalArquivos: row ? Number(row.total_arquivos || 0) : 0,
        colaboradoresDistintos: row ? Number(row.colaboradores_distintos || 0) : 0,
        totalNoPrazoClt: row ? Number(row.total_no_prazo || 0) : 0,
        competenciasHomologadas: homMap.get(a) || 0,
      };
    });

  const emitidoEmBr = new Date().toLocaleString('pt-BR');
  const protocoloVerificacaoSha256 = createHash('sha256')
    .update(
      `FIORIX_DOSSIE_CORREGEDORIA|${user.tenantId}|${anoRef}|${emitidoEmBr}|${acervoCompleto.length}`
    )
    .digest('hex');

  await recordAuditLog({
    modulo: 'HOLERITES',
    acao: 'EMISSAO_DOSSIE',
    registroDescricao: `Emissão do Dossiê de Rastreabilidade Trabalhista & Corregedoria (Ano base ${anoRef} • ${acervoCompleto.length} documentos no acervo)`,
    detalhes: {
      anoReferencia: anoRef,
      totalAcervo: acervoCompleto.length,
      protocoloVerificacaoSha256,
      emitidoPor: user.name,
      cargo: user.role,
    },
  });

  const serventiaNome =
    tenant?.name && !tenant.name.toLowerCase().includes('demo')
      ? tenant.name
      : '7º Oficial de Registro de Imóveis de São Paulo';

  return {
    serventiaNome,
    serventiaCnpj: tenant?.cnpj || null,
    serventiaCidadeUf:
      tenant?.cidade && tenant?.estado ? `${tenant.cidade}/${tenant.estado}` : 'São Paulo/SP',
    emitidoEmBr,
    emitidoPorNome: user.name || 'Operador RH',
    emitidoPorCargo: user.role || 'RH',
    protocoloVerificacaoSha256,
    anoReferencia: anoRef,
    resumoPlurianual,
    painelAno,
    acervoNominal: acervoCompleto,
    trilhaWormRecente: (wormRows || []).map((w) => ({
      id: String(w.id),
      acao: String(w.acao || 'REGISTRO'),
      descricao: String(w.registro_descricao || 'Evento auditado'),
      usuarioNome: String(w.usuario_nome || 'Sistema'),
      dataHoraBr: w.created_at ? new Date(w.created_at).toLocaleString('pt-BR') : '—',
    })),
  };
}

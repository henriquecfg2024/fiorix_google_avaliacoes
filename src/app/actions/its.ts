'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth-helpers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export interface ITItem {
  id: string;
  codigo: string;
  titulo: string;
  departamento: string;
  versao: string;
  vigencia: string;
  status: string;
  objetivo?: string;
  quandoUsar?: string;
  tempoLeituraMin: number;
  raci?: { R?: string; A?: string; C?: string; I?: string };
  passoAPasso?: Array<{ ordem: number; titulo: string; desc: string }>;
  checklist?: string[];
  errosComuns?: string[];
  updatedAt: string;
  hashVersao?: string;
  diasSemRevisao: number;
  guardiaoId?: string;
  guardiaoNome?: string;
  guardiaoEmail?: string;
  substitutoId?: string;
  substitutoNome?: string;
  substitutoAte?: string;
  faqExcecoes?: Array<{ pergunta: string; resposta: string }>;
  pdfOriginalUrl?: string;
}

export interface AuditLogItem {
  id: string;
  itId: string;
  itCodigo: string;
  itTitulo: string;
  versaoAnterior: string;
  versaoNova: string;
  autorId: string;
  autorNome: string;
  autorEmail: string;
  motivo: string;
  diffSnapshot: any;
  arquivoOriginalUrl?: string;
  hashSha256: string;
  createdAt: string;
}

export interface CienciaItem {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  departamento: string;
  versao: string;
  status: 'ciente' | 'pendente';
  cienteEm?: string;
}

export interface ITDetailData {
  it: ITItem;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    departamento: string;
  };
  isGuardiao: boolean;
  minhaCiencia: {
    status: 'ciente' | 'pendente';
    cienteEm?: string;
  };
  equipeCiencias: CienciaItem[];
  colegasDepto: Array<{ id: string; name: string; email?: string; cargo?: string }>;
  historicoAudit: AuditLogItem[];
}

export interface ColaboradorItem {
  id: string;
  name: string;
  email: string;
  role: string;
  departamento: string;
  cargo: string;
  podeSerTutor: boolean;
  status: string;
}

export interface MatrizEntry {
  id: string;
  usuarioId: string;
  itId: string;
  nivel: number;
  dataAvaliacao?: string;
  observacao?: string;
}

export interface SolicitacaoItem {
  id: string;
  solicitanteId: string;
  solicitanteNome: string;
  solicitanteDepto: string;
  departamentoDestino: string;
  itId: string;
  itCodigo: string;
  itTitulo: string;
  motivo: string;
  urgencia: string;
  status: string;
  diasLiberacao: number;
  createdAt: string;
}

export interface TrilhaItem {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  itId: string;
  itCodigo: string;
  itTitulo: string;
  status: string;
  progressoLeitura: number;
  seloApto: boolean;
  createdAt: string;
}

export interface AceiteStatus {
  assinado: boolean;
  hash?: string;
  dataAssinatura?: string;
  declaracao?: string;
}

export async function getItsPageData() {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  // 1. Buscar ITs ativas
  const rawIts = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       id,
       codigo,
       titulo,
       departamento,
       versao,
       vigencia::text,
       status,
       objetivo,
       quando_usar as "quandoUsar",
       responsavel_raci as "responsavelRaci",
       passo_a_passo as "passoAPasso",
       checklist,
       erros_comuns as "errosComuns",
       tempo_leitura_min as "tempoLeituraMin",
       updated_at as "updatedAt",
       hash_versao as "hashVersao",
       ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400)::int as "diasSemRevisao"
     FROM public.fiorix_its
     WHERE tenant_id = $1 AND deleted_at IS NULL
     ORDER BY codigo ASC`,
    tenantId
  );

  const its: ITItem[] = rawIts.map((row) => ({
    id: String(row.id),
    codigo: row.codigo,
    titulo: row.titulo,
    departamento: row.departamento,
    versao: row.versao || '1.0',
    vigencia: row.vigencia || new Date().toISOString().split('T')[0],
    status: row.status || 'ativa',
    objetivo: row.objetivo || '',
    quandoUsar: row.quandoUsar || '',
    tempoLeituraMin: Number(row.tempoLeituraMin || 5),
    raci: typeof row.responsavelRaci === 'object' ? row.responsavelRaci : {},
    passoAPasso: Array.isArray(row.passoAPasso) ? row.passoAPasso : [],
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    errosComuns: Array.isArray(row.errosComuns) ? row.errosComuns : [],
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    hashVersao: row.hashVersao || '',
    diasSemRevisao: Number(row.diasSemRevisao || 0),
  }));

  // 2. Buscar status do Aceite Mensal do usuário logado (Mês/Ano corrente)
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  const rawAceite = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, hash_aceite, declaracao, created_at
     FROM public.fiorix_its_aceites
     WHERE tenant_id = $1 
       AND usuario_id = $2 
       AND mes = $3 
       AND ano = $4 
       AND tipo = 'mensal'
     LIMIT 1`,
    tenantId,
    currentUser.id,
    mesAtual,
    anoAtual
  );

  const aceiteStatus: AceiteStatus = rawAceite.length > 0
    ? {
        assinado: true,
        hash: rawAceite[0].hash_aceite,
        dataAssinatura: new Date(rawAceite[0].created_at).toLocaleString('pt-BR'),
        declaracao: rawAceite[0].declaracao,
      }
    : {
        assinado: false,
      };

  // 3. Buscar colaboradores reais
  const rawColaboradores = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       id, 
       name, 
       email, 
       role, 
       COALESCE(departamento, 'Atendimento') as departamento, 
       COALESCE(cargo, 'auxiliar') as cargo, 
       COALESCE(pode_ser_tutor, false) as "podeSerTutor", 
       COALESCE(status, 'ativo') as status
     FROM public."User"
     WHERE "tenantId" = $1
     ORDER BY 
       CASE WHEN role = 'MASTER' THEN 0 WHEN role = 'ADMIN' THEN 1 WHEN role = 'RH' THEN 2 ELSE 3 END,
       name ASC`,
    tenantId
  );

  const colaboradores: ColaboradorItem[] = rawColaboradores.map((c) => ({
    id: String(c.id),
    name: c.name || 'Sem Nome',
    email: c.email || '',
    role: c.role || 'COLABORADOR',
    departamento: c.departamento,
    cargo: c.cargo,
    podeSerTutor: Boolean(c.podeSerTutor),
    status: c.status,
  }));

  // 4. Buscar dados da Matriz de Polivalência
  const rawMatriz = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       id::text as id,
       usuario_id as "usuarioId",
       it_id::text as "itId",
       nivel,
       data_avaliacao::text as "dataAvaliacao",
       observacao
     FROM public.fiorix_matriz_polivalencia
     WHERE tenant_id = $1`,
    tenantId
  );

  const matriz: MatrizEntry[] = rawMatriz.map((m) => ({
    id: m.id,
    usuarioId: m.usuarioId,
    itId: m.itId,
    nivel: Number(m.nivel || 0),
    dataAvaliacao: m.dataAvaliacao,
    observacao: m.observacao || '',
  }));

  // 5. Buscar Solicitações Cross-Setor
  const rawSolicitacoes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       s.id::text,
       s.solicitante_id as "solicitanteId",
       u.name as "solicitanteNome",
       COALESCE(u.departamento, 'Atendimento') as "solicitanteDepto",
       s.departamento_destino as "departamentoDestino",
       s.it_id::text as "itId",
       i.codigo as "itCodigo",
       i.titulo as "itTitulo",
       s.motivo,
       s.urgencia,
       s.status,
       s.dias_liberacao as "diasLiberacao",
       s.created_at as "createdAt"
     FROM public.fiorix_its_solicitacoes s
     LEFT JOIN public."User" u ON u.id = s.solicitante_id
     LEFT JOIN public.fiorix_its i ON i.id = s.it_id
     WHERE s.tenant_id = $1
     ORDER BY s.created_at DESC`,
    tenantId
  );

  const solicitacoes: SolicitacaoItem[] = rawSolicitacoes.map((s) => ({
    id: s.id,
    solicitanteId: s.solicitanteId,
    solicitanteNome: s.solicitanteNome || 'Colaborador',
    solicitanteDepto: s.solicitanteDepto,
    departamentoDestino: s.departamentoDestino,
    itId: s.itId,
    itCodigo: s.itCodigo || '',
    itTitulo: s.itTitulo || '',
    motivo: s.motivo,
    urgencia: s.urgencia,
    status: s.status,
    diasLiberacao: Number(s.diasLiberacao || 7),
    createdAt: new Date(s.createdAt).toLocaleDateString('pt-BR'),
  }));

  // 6. Buscar Trilhas de Estudo
  const rawTrilhas = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       t.id::text,
       t.usuario_id as "usuarioId",
       u.name as "usuarioNome",
       t.it_id::text as "itId",
       i.codigo as "itCodigo",
       i.titulo as "itTitulo",
       t.status,
       t.progresso_leitura as "progressoLeitura",
       t.selo_apto as "seloApto",
       t.created_at as "createdAt"
     FROM public.fiorix_trilhas_estudo t
     LEFT JOIN public."User" u ON u.id = t.usuario_id
     LEFT JOIN public.fiorix_its i ON i.id = t.it_id
     WHERE t.tenant_id = $1
     ORDER BY t.created_at DESC`,
    tenantId
  );

  const trilhas: TrilhaItem[] = rawTrilhas.map((t) => ({
    id: t.id,
    usuarioId: t.usuarioId,
    usuarioNome: t.usuarioNome || 'Colaborador',
    itId: t.itId,
    itCodigo: t.itCodigo || '',
    itTitulo: t.itTitulo || '',
    status: t.status,
    progressoLeitura: Number(t.progressoLeitura || 0),
    seloApto: Boolean(t.seloApto),
    createdAt: new Date(t.createdAt).toLocaleDateString('pt-BR'),
  }));

  return {
    currentUser: {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role,
      departamento: rawColaboradores.find((c) => c.id === currentUser.id)?.departamento || 'Atendimento',
    },
    its,
    aceiteStatus,
    colaboradores,
    matriz,
    solicitacoes,
    trilhas,
  };
}

export async function registrarAceiteMensal(params: {
  departamento: string;
  itsRevisadas: string[];
}) {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const declaracao = 'Declaro que revisei e minhas ITs estão atualizadas conforme o padrão interno';
  const dataToHash = `${tenantId}:${currentUser.id}:${params.departamento}:${mes}:${ano}:${declaracao}:${now.toISOString()}`;
  const hashAceite = crypto.createHash('sha256').update(dataToHash).digest('hex');

  await prisma.$queryRawUnsafe(
    `INSERT INTO public.fiorix_its_aceites (
       tenant_id, 
       usuario_id, 
       departamento, 
       mes, 
       ano, 
       tipo, 
       its_revisadas, 
       declaracao, 
       hash_aceite, 
       created_at
     ) VALUES (
       $1, $2, $3, $4, $5, 'mensal', $6::uuid[], $7, $8, NOW()
     )
     ON CONFLICT (tenant_id, usuario_id, departamento, mes, ano, tipo)
     DO UPDATE SET 
       hash_aceite = EXCLUDED.hash_aceite,
       its_revisadas = EXCLUDED.its_revisadas,
       created_at = NOW()`,
    tenantId,
    currentUser.id,
    params.departamento,
    mes,
    ano,
    params.itsRevisadas.map((id) => id),
    declaracao,
    hashAceite
  );

  revalidatePath('/administracao/its');
  return { success: true, hash: hashAceite };
}

export async function salvarOuAtualizarIt(data: {
  id?: string;
  codigo: string;
  titulo: string;
  departamento: string;
  tempo: number;
  objetivo: string;
  quandoUsar: string;
  raci?: { R?: string; A?: string; C?: string; I?: string };
  passos?: Array<{ ordem: number; titulo: string; desc: string }>;
  checklist?: string[];
  errosComuns?: string[];
}) {
  const currentUser = await requireRole('ADMIN', 'RH', 'MASTER');
  const tenantId = currentUser.tenantId;

  const snapshotString = JSON.stringify(data);
  const hashVersao = crypto.createHash('sha256').update(snapshotString).digest('hex');

  if (data.id) {
    // Atualização com nova versão
    await prisma.$queryRawUnsafe(
      `UPDATE public.fiorix_its
       SET 
         titulo = $1,
         departamento = $2,
         tempo_leitura_min = $3,
         objetivo = $4,
         quando_usar = $5,
         responsavel_raci = $6::jsonb,
         passo_a_passo = $7::jsonb,
         checklist = $8::jsonb,
         erros_comuns = $9::jsonb,
         hash_versao = $10,
         updated_at = NOW()
       WHERE id = $11::uuid AND tenant_id = $12`,
      data.titulo,
      data.departamento,
      data.tempo,
      data.objetivo,
      data.quandoUsar,
      JSON.stringify(data.raci || {}),
      JSON.stringify(data.passos || []),
      JSON.stringify(data.checklist || []),
      JSON.stringify(data.errosComuns || []),
      hashVersao,
      data.id,
      tenantId
    );

    // Registra versão no histórico
    await prisma.$queryRawUnsafe(
      `INSERT INTO public.fiorix_its_versoes (
         it_id, versao, conteudo_snapshot, alteracoes, autor_id, hash_versao
       ) VALUES (
         $1::uuid, '1.1', $2::jsonb, 'Atualização de conteúdo operacional', $3, $4
       )`,
      data.id,
      JSON.stringify(data),
      currentUser.id,
      hashVersao
    );
  } else {
    // Nova IT
    const result = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO public.fiorix_its (
         tenant_id,
         codigo,
         titulo,
         departamento,
         versao,
         tempo_leitura_min,
         objetivo,
         quando_usar,
         responsavel_raci,
         passo_a_passo,
         checklist,
         erros_comuns,
         hash_versao,
         autor_id
       ) VALUES (
         $1, $2, $3, $4, '1.0', $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13
       )
       RETURNING id::text`,
      tenantId,
      data.codigo,
      data.titulo,
      data.departamento,
      data.tempo,
      data.objetivo,
      data.quandoUsar,
      JSON.stringify(data.raci || {}),
      JSON.stringify(data.passos || []),
      JSON.stringify(data.checklist || []),
      JSON.stringify(data.errosComuns || []),
      hashVersao,
      currentUser.id
    );

    if (result.length > 0) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO public.fiorix_its_versoes (
           it_id, versao, conteudo_snapshot, alteracoes, autor_id, hash_versao
         ) VALUES (
           $1::uuid, '1.0', $2::jsonb, 'Criação inicial da IT', $3, $4
         )`,
        result[0].id,
        JSON.stringify(data),
        currentUser.id,
        hashVersao
      );
    }
  }

  revalidatePath('/administracao/its');
  return { success: true };
}

export async function excluirItWorm(itId: string, motivo: string, senhaAdmin: string) {
  const currentUser = await requireRole('ADMIN', 'MASTER');

  // Validação de senha
  const userRecord = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { password: true },
  });

  if (!userRecord?.password) {
    throw new Error('Usuário sem senha cadastrada.');
  }

  const senhaValida = await bcrypt.compare(senhaAdmin, userRecord.password);
  if (!senhaValida) {
    throw new Error('Senha incorreta.');
  }

  // Soft-delete WORM imutável (registra deleted_at)
  await prisma.$queryRawUnsafe(
    `UPDATE public.fiorix_its
     SET deleted_at = NOW()
     WHERE id = $1::uuid AND tenant_id = $2`,
    itId,
    currentUser.tenantId
  );

  revalidatePath('/administracao/its');
  return { success: true };
}

export async function solicitarAcessoCross(data: {
  departamentoDestino: string;
  itId: string;
  motivo: string;
  urgencia: string;
}) {
  const currentUser = await requireAuth();

  await prisma.$queryRawUnsafe(
    `INSERT INTO public.fiorix_its_solicitacoes (
       tenant_id, solicitante_id, departamento_destino, it_id, motivo, urgencia, status
     ) VALUES (
       $1, $2, $3, $4::uuid, $5, $6, 'pendente'
     )`,
    currentUser.tenantId,
    currentUser.id,
    data.departamentoDestino,
    data.itId,
    data.motivo,
    data.urgencia || 'normal'
  );

  revalidatePath('/administracao/its');
  return { success: true };
}

export async function responderSolicitacaoCross(
  solicitacaoId: string,
  acao: 'aprovar' | 'rejeitar',
  diasLiberacao: number = 7,
  motivoReprovacao?: string
) {
  const currentUser = await requireRole('ADMIN', 'RH', 'MASTER');

  if (acao === 'aprovar') {
    await prisma.$queryRawUnsafe(
      `UPDATE public.fiorix_its_solicitacoes
       SET 
         status = 'aprovado',
         aprovado_por = $1,
         dias_liberacao = $2,
         data_aprovacao = NOW(),
         data_expiracao = CURRENT_DATE + ($2 || ' days')::interval
       WHERE id = $3::uuid AND tenant_id = $4`,
      currentUser.id,
      diasLiberacao,
      solicitacaoId,
      currentUser.tenantId
    );

    // Cria trilha de estudo se não existir
    const sol = await prisma.$queryRawUnsafe<any[]>(
      `SELECT solicitante_id, it_id FROM public.fiorix_its_solicitacoes WHERE id = $1::uuid`,
      solicitacaoId
    );

    if (sol.length > 0) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO public.fiorix_trilhas_estudo (
           tenant_id, usuario_id, it_id, solicitacao_id, status
         ) VALUES (
           $1, $2, $3, $4::uuid, 'leitura'
         )
         ON CONFLICT DO NOTHING`,
        currentUser.tenantId,
        sol[0].solicitante_id,
        sol[0].it_id,
        solicitacaoId
      );
    }
  } else {
    await prisma.$queryRawUnsafe(
      `UPDATE public.fiorix_its_solicitacoes
       SET 
         status = 'reprovado',
         aprovado_por = $1,
         motivo_reprovacao = $2
       WHERE id = $3::uuid AND tenant_id = $4`,
      currentUser.id,
      motivoReprovacao || 'Não atende aos pré-requisitos atuais.',
      solicitacaoId,
      currentUser.tenantId
    );
  }

  revalidatePath('/administracao/its');
  return { success: true };
}

export async function atualizarNivelMatriz(
  usuarioId: string,
  itId: string,
  nivel: number,
  observacao?: string
) {
  const currentUser = await requireRole('ADMIN', 'RH', 'MASTER');

  await prisma.$queryRawUnsafe(
    `INSERT INTO public.fiorix_matriz_polivalencia (
       tenant_id, usuario_id, it_id, nivel, avaliado_por, data_avaliacao, observacao
     ) VALUES (
       $1, $2, $3::uuid, $4, $5, CURRENT_DATE, $6
     )
     ON CONFLICT (tenant_id, usuario_id, it_id)
     DO UPDATE SET 
       nivel = EXCLUDED.nivel,
       avaliado_por = EXCLUDED.avaliado_por,
       data_avaliacao = CURRENT_DATE,
       observacao = EXCLUDED.observacao`,
    currentUser.tenantId,
    usuarioId,
    itId,
    nivel,
    currentUser.id,
    observacao || null
  );

  revalidatePath('/administracao/its');
  return { success: true };
}

export async function toggleColaboradorTutor(usuarioId: string, novoStatus: boolean) {
  await requireRole('ADMIN', 'RH', 'MASTER');

  // Proteção Master: nunca alterar admin@fiorix.com.br
  await prisma.$queryRawUnsafe(
    `UPDATE public."User"
     SET pode_ser_tutor = $1
     WHERE id = $2 AND role != 'MASTER' AND email != 'admin@fiorix.com.br'`,
    novoStatus,
    usuarioId
  );

  revalidatePath('/administracao/its');
  return { success: true };
}

// ══════════════════════════════════════════════════════════════════════════════
// NOVO MÓDULO ITs v5.0 — GUARDIÃO, CIÊNCIA SIMPLES & GOVERNANÇA (7º RI SP)
// ══════════════════════════════════════════════════════════════════════════════

export async function getItDetailData(idOrCodigo: string): Promise<ITDetailData | null> {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  // Busca a IT por ID (se UUID) ou por código
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCodigo);
  
  const raw = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       i.id::text,
       i.codigo,
       i.titulo,
       i.departamento,
       i.versao,
       i.vigencia::text,
       i.status,
       i.objetivo,
       i.quando_usar as "quandoUsar",
       i.responsavel_raci as "responsavelRaci",
       i.passo_a_passo as "passoAPasso",
       i.checklist,
       i.erros_comuns as "errosComuns",
       i.tempo_leitura_min as "tempoLeituraMin",
       i.updated_at as "updatedAt",
       i.hash_versao as "hashVersao",
       ROUND(EXTRACT(EPOCH FROM (NOW() - i.updated_at)) / 86400)::int as "diasSemRevisao",
       i.guardiao_id as "guardiaoId",
       g.name as "guardiaoNome",
       g.email as "guardiaoEmail",
       i.substituto_id as "substitutoId",
       sub.name as "substitutoNome",
       i.substituto_ate::text as "substitutoAte",
       i.faq_excecoes as "faqExcecoes",
       i.pdf_original_url as "pdfOriginalUrl"
     FROM public.fiorix_its i
     LEFT JOIN public."User" g ON g.id = i.guardiao_id
     LEFT JOIN public."User" sub ON sub.id = i.substituto_id
     WHERE i.tenant_id = $1 
       AND i.deleted_at IS NULL
       AND (${isUuid ? 'i.id = $2::uuid' : 'i.codigo = $2'})
     LIMIT 1`,
    tenantId,
    idOrCodigo
  );

  if (raw.length === 0) return null;
  const row = raw[0];

  const it: ITItem = {
    id: row.id,
    codigo: row.codigo,
    titulo: row.titulo,
    departamento: row.departamento,
    versao: row.versao || '1.0',
    vigencia: row.vigencia || new Date().toISOString().split('T')[0],
    status: row.status || 'ativa',
    objetivo: row.objetivo || '',
    quandoUsar: row.quandoUsar || '',
    tempoLeituraMin: Number(row.tempoLeituraMin || 5),
    raci: typeof row.responsavelRaci === 'object' ? row.responsavelRaci : {},
    passoAPasso: Array.isArray(row.passoAPasso) ? row.passoAPasso : [],
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    errosComuns: Array.isArray(row.errosComuns) ? row.errosComuns : [],
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    hashVersao: row.hashVersao || '',
    diasSemRevisao: Number(row.diasSemRevisao || 0),
    guardiaoId: row.guardiaoId,
    guardiaoNome: row.guardiaoNome || 'Não atribuído',
    guardiaoEmail: row.guardiaoEmail || '',
    substitutoId: row.substitutoId,
    substitutoNome: row.substitutoNome,
    substitutoAte: row.substitutoAte,
    faqExcecoes: Array.isArray(row.faqExcecoes) ? row.faqExcecoes : [],
    pdfOriginalUrl: row.pdfOriginalUrl || null,
  };

  // Verifica se usuário logado é o Guardião ativo ou Substituto de férias
  const isGuardiaoTitular = currentUser.id === it.guardiaoId;
  const isSubstitutoAtivo = Boolean(
    it.substitutoId === currentUser.id &&
    it.substitutoAte &&
    new Date(it.substitutoAte) >= new Date()
  );
  const isGuardiao = isGuardiaoTitular || isSubstitutoAtivo || ['ADMIN', 'MASTER'].includes(currentUser.role);

  // Busca status de ciência do usuário logado
  const rawMinhaCiencia = await prisma.$queryRawUnsafe<any[]>(
    `SELECT status, ciente_em as "cienteEm"
     FROM public.fiorix_its_ciencias
     WHERE tenant_id = $1 AND it_id = $2::uuid AND usuario_id = $3 AND versao = $4
     LIMIT 1`,
    tenantId,
    it.id,
    currentUser.id,
    it.versao
  );

  const minhaCiencia = {
    status: (rawMinhaCiencia[0]?.status || 'pendente') as 'ciente' | 'pendente',
    cienteEm: rawMinhaCiencia[0]?.cienteEm ? new Date(rawMinhaCiencia[0].cienteEm).toLocaleString('pt-BR') : undefined,
  };

  // Busca ciências de toda a equipe para esta versão
  const rawEquipeCiencias = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       c.id::text,
       c.usuario_id as "usuarioId",
       u.name as "usuarioNome",
       COALESCE(u.departamento, $3) as departamento,
       c.versao,
       c.status,
       c.ciente_em as "cienteEm"
     FROM public.fiorix_its_ciencias c
     JOIN public."User" u ON u.id = c.usuario_id
     WHERE c.tenant_id = $1 AND c.it_id = $2::uuid AND c.versao = $4
     ORDER BY c.status DESC, u.name ASC`,
    tenantId,
    it.id,
    it.departamento,
    it.versao
  );

  const equipeCiencias: CienciaItem[] = rawEquipeCiencias.map(c => ({
    id: c.id,
    usuarioId: c.usuarioId,
    usuarioNome: c.usuarioNome || 'Colaborador',
    departamento: c.departamento,
    versao: c.versao,
    status: c.status as 'ciente' | 'pendente',
    cienteEm: c.cienteEm ? new Date(c.cienteEm).toLocaleString('pt-BR') : undefined,
  }));

  // Busca colegas do mesmo departamento para passar bastão
  const rawColegas = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, email, COALESCE(cargo, 'escrevente') as cargo
     FROM public."User"
     WHERE "tenantId" = $1 AND departamento = $2 AND id != $3
     ORDER BY name ASC`,
    tenantId,
    it.departamento,
    currentUser.id
  );

  const colegasDepto = rawColegas.map(c => ({
    id: c.id,
    name: c.name || 'Colaborador',
    email: c.email,
    cargo: c.cargo,
  }));

  // Busca histórico de auditoria imutável (últimos 10 registros)
  const rawAudit = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       a.id::text,
       a.it_id::text as "itId",
       i.codigo as "itCodigo",
       i.titulo as "itTitulo",
       a.versao_anterior as "versaoAnterior",
       a.versao_nova as "versaoNova",
       a.autor_id as "autorId",
       u.name as "autorNome",
       u.email as "autorEmail",
       a.motivo,
       a.diff_snapshot as "diffSnapshot",
       a.arquivo_original_url as "arquivoOriginalUrl",
       a.hash_sha256 as "hashSha256",
       a.created_at as "createdAt"
     FROM public.fiorix_its_audit_log a
     JOIN public.fiorix_its i ON i.id = a.it_id
     LEFT JOIN public."User" u ON u.id = a.autor_id
     WHERE a.tenant_id = $1 AND a.it_id = $2::uuid
     ORDER BY a.created_at DESC
     LIMIT 10`,
    tenantId,
    it.id
  );

  const historicoAudit: AuditLogItem[] = rawAudit.map(a => ({
    id: a.id,
    itId: a.itId,
    itCodigo: a.itCodigo,
    itTitulo: a.itTitulo,
    versaoAnterior: a.versaoAnterior,
    versaoNova: a.versaoNova,
    autorId: a.autorId,
    autorNome: a.autorNome || 'Colaborador',
    autorEmail: a.autorEmail || '',
    motivo: a.motivo,
    diffSnapshot: a.diffSnapshot,
    arquivoOriginalUrl: a.arquivoOriginalUrl,
    hashSha256: a.hashSha256,
    createdAt: new Date(a.createdAt).toLocaleString('pt-BR'),
  }));

  return {
    it,
    currentUser: {
      id: currentUser.id,
      name: currentUser.name || 'Colaborador',
      email: currentUser.email,
      role: currentUser.role,
      departamento: currentUser.departamento || it.departamento,
    },
    isGuardiao,
    minhaCiencia,
    equipeCiencias,
    colegasDepto,
    historicoAudit,
  };
}

export async function registrarCienciaIt(itId: string, versao: string) {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  await prisma.$queryRawUnsafe(
    `INSERT INTO public.fiorix_its_ciencias (
       tenant_id, it_id, usuario_id, versao, status, ciente_em, created_at
     ) VALUES (
       $1, $2::uuid, $3, $4, 'ciente', NOW(), NOW()
     )
     ON CONFLICT (tenant_id, it_id, usuario_id, versao)
     DO UPDATE SET 
       status = 'ciente',
       ciente_em = NOW()`,
    tenantId,
    itId,
    currentUser.id,
    versao
  );

  revalidatePath(`/instrucoes-trabalho/${itId}`);
  revalidatePath('/gestao/rh/instrucoes-trabalho-monitoramento');
  return { success: true };
}

export interface SalvarNovaVersaoParams {
  itId: string;
  novaVersao: string;
  objetivo: string;
  quandoUsar?: string;
  procedimento: Array<{ ordem: number; titulo: string; desc: string }>;
  checklist?: string[];
  errosComuns?: string[];
  motivo: string;
  arquivoOriginalUrl?: string;
}

export async function salvarNovaVersaoComDiff(params: SalvarNovaVersaoParams) {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  // 1. Busca a IT atual para gerar o snapshot de diff
  const current = (await prisma.$queryRawUnsafe<any[]>(
    `SELECT versao, objetivo, quando_usar, passo_a_passo, checklist, erros_comuns, departamento, codigo, titulo
     FROM public.fiorix_its
     WHERE id = $1::uuid AND tenant_id = $2`,
    params.itId,
    tenantId
  ))[0];

  if (!current) throw new Error('Instrução de Trabalho não encontrada.');

  const versaoAnterior = current.versao || '1.0';

  // 2. Calcula novo hash SHA-256
  const dataToHash = JSON.stringify({
    tenantId,
    itId: params.itId,
    versao: params.novaVersao,
    objetivo: params.objetivo,
    procedimento: params.procedimento,
    motivo: params.motivo,
    timestamp: new Date().toISOString(),
  });
  const hashSha256 = crypto.createHash('sha256').update(dataToHash).digest('hex');

  const diffSnapshot = {
    anterior: {
      versao: versaoAnterior,
      objetivo: current.objetivo,
      quandoUsar: current.quando_usar,
      procedimento: current.passo_a_passo,
    },
    novo: {
      versao: params.novaVersao,
      objetivo: params.objetivo,
      quandoUsar: params.quandoUsar,
      procedimento: params.procedimento,
    },
  };

  // 3. Atualiza fiorix_its
  await prisma.$queryRawUnsafe(
    `UPDATE public.fiorix_its
     SET 
       versao = $1,
       objetivo = $2,
       quando_usar = COALESCE($3, quando_usar),
       passo_a_passo = $4::jsonb,
       checklist = $5::jsonb,
       erros_comuns = $6::jsonb,
       hash_versao = $7,
       pdf_original_url = COALESCE($8, pdf_original_url),
       updated_at = NOW()
     WHERE id = $9::uuid AND tenant_id = $10`,
    params.novaVersao,
    params.objetivo,
    params.quandoUsar || null,
    JSON.stringify(params.procedimento),
    JSON.stringify(params.checklist || []),
    JSON.stringify(params.errosComuns || []),
    hashSha256,
    params.arquivoOriginalUrl || null,
    params.itId,
    tenantId
  );

  // 4. Insere no Audit Log Imutável (WORM)
  await prisma.$queryRawUnsafe(
    `INSERT INTO public.fiorix_its_audit_log (
       tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, arquivo_original_url, hash_sha256, created_at
     ) VALUES (
       $1, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW()
     )`,
    tenantId,
    params.itId,
    versaoAnterior,
    params.novaVersao,
    currentUser.id,
    params.motivo,
    JSON.stringify(diffSnapshot),
    params.arquivoOriginalUrl || null,
    hashSha256
  );

  // 5. Gera ciências para o departamento: Autor fica Ciente, outros ficam Pendentes
  const deptoUsers = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM public."User" WHERE "tenantId" = $1 AND departamento = $2`,
    tenantId,
    current.departamento
  );

  for (const user of deptoUsers) {
    const isAutor = user.id === currentUser.id;
    await prisma.$queryRawUnsafe(
      `INSERT INTO public.fiorix_its_ciencias (
         tenant_id, it_id, usuario_id, versao, status, ciente_em, created_at
       ) VALUES (
         $1, $2::uuid, $3, $4, $5, $6, NOW()
       )
       ON CONFLICT (tenant_id, it_id, usuario_id, versao)
       DO UPDATE SET 
         status = EXCLUDED.status,
         ciente_em = EXCLUDED.ciente_em`,
      tenantId,
      params.itId,
      user.id,
      params.novaVersao,
      isAutor ? 'ciente' : 'pendente',
      isAutor ? new Date() : null
    );
  }

  revalidatePath(`/instrucoes-trabalho/${params.itId}`);
  revalidatePath('/gestao/rh/instrucoes-trabalho-monitoramento');
  revalidatePath('/administracao/its');

  return { success: true, hash: hashSha256, versao: params.novaVersao };
}

export async function delegarGuardiaoTemporario(itId: string, substitutoId: string, dataAte: string) {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  await prisma.$queryRawUnsafe(
    `UPDATE public.fiorix_its
     SET substituto_id = $1, substituto_ate = $2::date, updated_at = NOW()
     WHERE id = $3::uuid AND tenant_id = $4`,
    substitutoId,
    dataAte,
    itId,
    tenantId
  );

  revalidatePath(`/instrucoes-trabalho/${itId}`);
  return { success: true };
}

export async function adicionarFaqExcecao(itId: string, pergunta: string, resposta: string) {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  const currentFaqRaw = (await prisma.$queryRawUnsafe<any[]>(
    `SELECT faq_excecoes FROM public.fiorix_its WHERE id = $1::uuid AND tenant_id = $2`,
    itId,
    tenantId
  ))[0];

  const currentFaq = Array.isArray(currentFaqRaw?.faq_excecoes) ? currentFaqRaw.faq_excecoes : [];
  currentFaq.push({ pergunta, resposta, adicionadoPor: currentUser.name, data: new Date().toISOString() });

  await prisma.$queryRawUnsafe(
    `UPDATE public.fiorix_its
     SET faq_excecoes = $1::jsonb
     WHERE id = $2::uuid AND tenant_id = $3`,
    JSON.stringify(currentFaq),
    itId,
    tenantId
  );

  revalidatePath(`/instrucoes-trabalho/${itId}`);
  return { success: true };
}

export async function getGovernancaRhData() {
  const currentUser = await requireRole('ADMIN', 'RH', 'MASTER');
  const tenantId = currentUser.tenantId;

  // 1. KPIs
  const totalIts = Number(
    (await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int as count FROM public.fiorix_its WHERE tenant_id = $1 AND deleted_at IS NULL`,
      tenantId
    ))[0]?.count || 0
  );

  const itsAtualizadas7d = Number(
    (await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int as count 
       FROM public.fiorix_its 
       WHERE tenant_id = $1 AND deleted_at IS NULL AND updated_at >= NOW() - interval '7 days'`,
      tenantId
    ))[0]?.count || 0
  );

  const itsAtualizadas30d = Number(
    (await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int as count 
       FROM public.fiorix_its 
       WHERE tenant_id = $1 AND deleted_at IS NULL AND updated_at >= NOW() - interval '30 days'`,
      tenantId
    ))[0]?.count || 0
  );

  const itsVencidas = Number(
    (await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int as count 
       FROM public.fiorix_its 
       WHERE tenant_id = $1 AND deleted_at IS NULL AND updated_at < NOW() - interval '120 days'`,
      tenantId
    ))[0]?.count || 0
  );

  const cienciasAgg = (await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       count(*)::int as total,
       count(CASE WHEN status = 'ciente' THEN 1 END)::int as cientes,
       count(CASE WHEN status = 'pendente' THEN 1 END)::int as pendentes
     FROM public.fiorix_its_ciencias
     WHERE tenant_id = $1`,
    tenantId
  ))[0];

  const totalCiencias = Number(cienciasAgg?.total || 0);
  const totalCientes = Number(cienciasAgg?.cientes || 0);
  const totalPendentes = Number(cienciasAgg?.pendentes || 0);
  const taxaConformidade = totalCiencias > 0 ? Math.round((totalCientes / totalCiencias) * 100) : 100;

  // 2. Timeline de Auditoria (Últimos 50 logs WORM)
  const auditLogsRaw = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       a.id::text,
       a.it_id::text as "itId",
       i.codigo as "itCodigo",
       i.titulo as "itTitulo",
       a.versao_anterior as "versaoAnterior",
       a.versao_nova as "versaoNova",
       a.autor_id as "autorId",
       u.name as "autorNome",
       u.email as "autorEmail",
       a.motivo,
       a.diff_snapshot as "diffSnapshot",
       a.arquivo_original_url as "arquivoOriginalUrl",
       a.hash_sha256 as "hashSha256",
       a.created_at as "createdAt"
     FROM public.fiorix_its_audit_log a
     JOIN public.fiorix_its i ON i.id = a.it_id
     LEFT JOIN public."User" u ON u.id = a.autor_id
     WHERE a.tenant_id = $1
     ORDER BY a.created_at DESC
     LIMIT 50`,
    tenantId
  );

  const timelineAudit: AuditLogItem[] = auditLogsRaw.map(a => ({
    id: a.id,
    itId: a.itId,
    itCodigo: a.itCodigo,
    itTitulo: a.itTitulo,
    versaoAnterior: a.versaoAnterior,
    versaoNova: a.versaoNova,
    autorId: a.autorId,
    autorNome: a.autorNome || 'Colaborador',
    autorEmail: a.autorEmail || '',
    motivo: a.motivo,
    diffSnapshot: a.diffSnapshot,
    arquivoOriginalUrl: a.arquivoOriginalUrl,
    hashSha256: a.hashSha256,
    createdAt: new Date(a.createdAt).toLocaleString('pt-BR'),
  }));

  // 3. Controle por IT com status de ciências da equipe
  const itsListRaw = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       i.id::text,
       i.codigo,
       i.titulo,
       i.departamento,
       i.versao,
       i.updated_at as "updatedAt",
       ROUND(EXTRACT(EPOCH FROM (NOW() - i.updated_at)) / 86400)::int as "diasSemRevisao",
       g.name as "guardiaoNome"
     FROM public.fiorix_its i
     LEFT JOIN public."User" g ON g.id = i.guardiao_id
     WHERE i.tenant_id = $1 AND i.deleted_at IS NULL
     ORDER BY i.codigo ASC`,
    tenantId
  );

  const conformidadePorIt = [];
  for (const it of itsListRaw) {
    const cienciasIt = await prisma.$queryRawUnsafe<any[]>(
      `SELECT 
         c.status,
         u.name as "usuarioNome"
       FROM public.fiorix_its_ciencias c
       JOIN public."User" u ON u.id = c.usuario_id
       WHERE c.tenant_id = $1 AND c.it_id = $2::uuid AND c.versao = $3`,
      tenantId,
      it.id,
      it.versao || '1.0'
    );

    const cientesCount = cienciasIt.filter(c => c.status === 'ciente').length;
    const pendentesList = cienciasIt.filter(c => c.status === 'pendente').map(c => c.usuarioNome);

    conformidadePorIt.push({
      id: it.id,
      codigo: it.codigo,
      titulo: it.titulo,
      departamento: it.departamento,
      versao: it.versao,
      guardiaoNome: it.guardiaoNome || 'Não definido',
      diasSemRevisao: Number(it.diasSemRevisao || 0),
      totalEquipe: cienciasIt.length,
      cientesCount,
      pendentesCount: pendentesList.length,
      pendentesNomes: pendentesList,
    });
  }

  return {
    kpis: {
      totalIts,
      itsAtualizadas7d,
      itsAtualizadas30d,
      taxaConformidade,
      totalPendentes,
      itsVencidas,
    },
    timelineAudit,
    conformidadePorIt,
  };
}

export async function obterMinhaItId(): Promise<string | null> {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  // 1. Tenta achar IT onde o usuário é guardião
  const guardiaoIt = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text FROM public.fiorix_its 
     WHERE tenant_id = $1 AND guardiao_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    tenantId,
    currentUser.id
  );
  if (guardiaoIt.length > 0) return guardiaoIt[0].id;

  // 2. Tenta achar IT do departamento do usuário
  const deptoIt = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text FROM public.fiorix_its 
     WHERE tenant_id = $1 AND departamento = $2 AND deleted_at IS NULL
     ORDER BY codigo ASC
     LIMIT 1`,
    tenantId,
    currentUser.departamento || 'Atendimento'
  );
  if (deptoIt.length > 0) return deptoIt[0].id;

  // 3. Fallback: primeira IT disponível
  const firstIt = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text FROM public.fiorix_its 
     WHERE tenant_id = $1 AND deleted_at IS NULL
     ORDER BY codigo ASC
     LIMIT 1`,
    tenantId
  );
  return firstIt[0]?.id || null;
}

'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth-helpers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/lib/audit';
import { supabaseAdmin } from '@/lib/supabase';

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
  pdfPath?: string;
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

  // Apenas SUBSTITUTO, ADMIN e MASTER possuem prerrogativa de acessar a Governança Geral de ITs
  if (!['SUBSTITUTO', 'ADMIN', 'MASTER'].includes(currentUser.role)) {
    throw new Error('Acesso restrito: Apenas Oficiais Substitutos e Administradores possuem acesso à Governança de ITs.');
  }

  // 1. Buscar ITs publicadas/vigentes para o Catálogo
  // ITs em fluxo de aprovação (enviada_para_analise, correcao_solicitada, aprovada, rejeitada)
  // NÃO aparecem no catálogo geral. São tratadas separadamente na Fiscalização.
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
       pdf_original_url as "pdfOriginalUrl",
       pdf_path as "pdfPath",
       ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400)::int as "diasSemRevisao"
     FROM public.fiorix_its
     WHERE tenant_id = $1
       AND deleted_at IS NULL
       AND status IN ('vigente', 'ativa', 'publicada')
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
    pdfOriginalUrl: row.pdfOriginalUrl || undefined,
    pdfPath: row.pdfPath || undefined,
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

  // 3. Buscar colaboradores reais (excluindo MASTER que é conta de sistema)
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
     WHERE "tenantId" = $1 AND role != 'MASTER'
     ORDER BY 
       CASE WHEN role = 'ADMIN' THEN 0 WHEN role = 'RH' THEN 1 ELSE 2 END,
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
  pdfOriginalUrl?: string;
  pdfPath?: string;
}) {
  const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
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
         pdf_original_url = COALESCE($13, pdf_original_url),
         pdf_path = COALESCE($14, pdf_path),
         updated_at = NOW()
       WHERE id = $11::uuid AND tenant_id = $12`,
      data.titulo.toUpperCase().trim(),
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
      tenantId,
      data.pdfOriginalUrl || null,
      data.pdfPath || null
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
         autor_id,
         guardiao_id,
         pdf_original_url,
         pdf_path
       ) VALUES (
         $1, $2, $3, $4, '1.0', $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, $14, $15, $16
       )
       RETURNING id::text`,
      tenantId,
      data.codigo,
      data.titulo.toUpperCase().trim(),
      data.departamento,
      data.tempo,
      data.objetivo,
      data.quandoUsar,
      JSON.stringify(data.raci || {}),
      JSON.stringify(data.passos || []),
      JSON.stringify(data.checklist || []),
      JSON.stringify(data.errosComuns || []),
      hashVersao,
      currentUser.id,
      currentUser.id,
      data.pdfOriginalUrl || null,
      data.pdfPath || null
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
    select: { passwordHash: true },
  });

  if (!userRecord?.passwordHash) {
    throw new Error('Usuário sem senha cadastrada.');
  }

  const senhaValida = await bcrypt.compare(senhaAdmin, userRecord.passwordHash);
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
  const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');

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
  const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');

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
  await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');

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
  const isPrivileged = ['ADMIN', 'MASTER', 'RH'].includes(currentUser.role);
  const isGuardiao = isGuardiaoTitular || isSubstitutoAtivo || isPrivileged;

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

  // Busca se tem permissão por trilha de estudo
  const rawTrilha = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM public.fiorix_trilhas_estudo
     WHERE tenant_id = $1 AND it_id = $2::uuid AND usuario_id = $3
     LIMIT 1`,
    tenantId,
    it.id,
    currentUser.id
  );

  const temPermissaoRh = rawMinhaCiencia.length > 0 || rawTrilha.length > 0;

  // SEGURANÇA E PRIVACIDADE: Colaborador comum só pode visualizar IT sob sua guarda ou com permissão expressa do RH
  if (!isGuardiaoTitular && !isSubstitutoAtivo && !isPrivileged && !temPermissaoRh) {
    return null;
  }

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
      email: currentUser.email as string,
      role: currentUser.role,
      departamento: (currentUser as any).departamento || it.departamento,
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

export async function getITUploadSignedUrl(fileName: string, contentType?: string) {
  try {
    const currentUser = await requireAuth();
    const timestamp = Date.now();
    const safeFileName = (fileName || 'documento')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const tenantFolder = currentUser.tenantId || 'global';
    const storagePath = `uploads/${tenantFolder}_${timestamp}_${safeFileName}`;

    const { data, error } = await supabaseAdmin.storage
      .from('it-documentos')
      .createSignedUploadUrl(storagePath);

    if (error || !data?.signedUrl) {
      console.error('Erro ao gerar Signed URL no Supabase:', error);
      return {
        success: false,
        error: `Falha ao autorizar upload no armazenamento: ${error?.message || 'Erro desconhecido'}`,
        signedUrl: '',
        publicUrl: '',
        storagePath: '',
      };
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('it-documentos')
      .getPublicUrl(storagePath);

    return {
      success: true,
      signedUrl: data.signedUrl,
      publicUrl: publicUrlData.publicUrl,
      storagePath,
    };
  } catch (err: any) {
    console.error('Erro no getITUploadSignedUrl:', err);
    return {
      success: false,
      error: err?.message || 'Falha ao autorizar upload no armazenamento.',
      signedUrl: '',
      publicUrl: '',
      storagePath: '',
    };
  }
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

  await recordAuditLog({
    modulo: 'ITS',
    acao: 'REVISAO',
    registroId: params.itId,
    registroDescricao: `Nova versão ${params.novaVersao} da IT "${current.codigo} - ${current.titulo}"`,
    detalhes: { versaoAnterior, versaoNova: params.novaVersao, motivo: params.motivo, hashSha256 },
    userOverride: currentUser,
  });

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
  const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
  const tenantId = currentUser.tenantId;

  // 1. KPIs
  // totalIts = apenas ITs efetivamente publicadas/vigentes
  const totalIts = Number(
    (await prisma.$queryRawUnsafe<any[]>(
      `SELECT count(*)::int as count
       FROM public.fiorix_its
       WHERE tenant_id = $1
         AND deleted_at IS NULL
         AND status IN ('vigente', 'ativa', 'publicada')`,
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
       count(c.id)::int as total,
       count(CASE WHEN c.status = 'ciente' THEN 1 END)::int as cientes,
       count(CASE WHEN c.status = 'pendente' THEN 1 END)::int as pendentes
     FROM public.fiorix_its_ciencias c
     JOIN public.fiorix_its i ON i.id = c.it_id AND i.deleted_at IS NULL
     WHERE c.tenant_id = $1`,
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

  // 3. Column Config
  const columnConfigRaw = await prisma.$queryRawUnsafe<any[]>(
    `SELECT coluna_key, coluna_label FROM public.fiorix_its_column_config WHERE tenant_id = $1`,
    tenantId
  );
  const defaultCols: Record<string, string> = {
    codigo: 'Código / IT', setor: 'Setor', versao: 'Versão',
    guardiao: 'Guardião Responsável', revisao: 'Última Revisão',
    ciencia: 'Ciência da Equipe', acoes: 'Ações',
  };
  const columnConfig: Record<string, string> = { ...defaultCols };
  for (const row of columnConfigRaw) {
    columnConfig[row.coluna_key] = row.coluna_label;
  }

  // 4. Todos os colaboradores do tenant (para modais de gestão, excluindo MASTER)
  const colaboradoresTenantRaw = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, email, COALESCE(departamento, 'Atendimento') as departamento, COALESCE(cargo, 'auxiliar') as cargo
     FROM public."User"
     WHERE "tenantId" = $1 AND role != 'MASTER'
     ORDER BY name ASC`,
    tenantId
  );
  const colaboradoresTenant = colaboradoresTenantRaw.map(c => ({
    id: c.id,
    name: c.name || 'Colaborador',
    email: c.email || '',
    departamento: c.departamento,
    cargo: c.cargo,
  }));

  // 5. Controle por IT publicada/vigente com status de ciências da equipe
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
     WHERE i.tenant_id = $1
       AND i.deleted_at IS NULL
       AND i.status IN ('vigente', 'ativa', 'publicada')
     ORDER BY i.codigo ASC`,
    tenantId
  );

  // 6. ITs pendentes de aprovação (enviadas por colaboradores ou em fluxo)
  const itsPendentesRaw = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
       i.id::text,
       i.codigo,
       i.titulo,
       i.departamento,
       i.versao,
       i.status,
       i.objetivo,
       i.pdf_original_url as "pdfUrl",
       i.pdf_path as "pdfPath",
       i.created_at as "criadoEm",
       i.updated_at as "atualizadoEm",
       u.name as "autorNome",
       u.email as "autorEmail",
       -- campo de motivo de correção/rejeição se existir
       i.objetivo as "motivoCorrecao"
     FROM public.fiorix_its i
     LEFT JOIN public."User" u ON u.id = i.autor_id
     WHERE i.tenant_id = $1
       AND i.deleted_at IS NULL
       AND i.status IN ('enviada_para_analise', 'correcao_solicitada', 'aprovada')
     ORDER BY i.created_at ASC`,
    tenantId
  );

  // Verificar se já existe IT publicada com título semelhante
  const itsPendentesAprovacao = await Promise.all(
    itsPendentesRaw.map(async (p) => {
      // Busca ITs publicadas com título semelhante (case-insensitive)
      const similares = await prisma.$queryRawUnsafe<any[]>(
        `SELECT codigo, titulo FROM public.fiorix_its
         WHERE tenant_id = $1
           AND deleted_at IS NULL
           AND status IN ('vigente', 'ativa', 'publicada')
           AND LOWER(titulo) LIKE LOWER($2)
           AND id != $3::uuid
         LIMIT 1`,
        tenantId,
        `%${p.titulo.replace(/[^a-z0-9]/gi, '%').substring(0, 30)}%`,
        p.id
      );
      return {
        id: p.id,
        codigo: p.codigo,
        titulo: p.titulo,
        departamento: p.departamento,
        versao: p.versao,
        status: p.status,
        objetivo: p.objetivo || '',
        pdfUrl: p.pdfUrl || null,
        pdfPath: p.pdfPath || null,
        autorNome: p.autorNome || 'Colaborador',
        autorEmail: p.autorEmail || '',
        criadoEm: new Date(p.criadoEm).toLocaleString('pt-BR'),
        itSimilar: similares.length > 0
          ? { codigo: similares[0].codigo, titulo: similares[0].titulo }
          : null,
      };
    })
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
    itsPendentesAprovacao,
    columnConfig,
    colaboradoresTenant,
  };
}

// ═══════════════════════════════════════════════
// ACTIONS DO FLUXO DE APROVAÇÃO DE ITs
// ═══════════════════════════════════════════════

export interface ItPendenteAprovacaoDetalhe {
  id: string;
  codigo: string;
  titulo: string;
  departamento: string;
  versao: string;
  status: string;
  objetivo: string;
  pdfUrl: string | null;
  autorNome: string;
  autorEmail: string;
  criadoEm: string;
  itSimilar: { codigo: string; titulo: string } | null;
}

export async function analisarItColaborador(
  itId: string
): Promise<{ success: boolean; data?: ItPendenteAprovacaoDetalhe; error?: string }> {
  try {
    const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
    const tenantId = currentUser.tenantId;

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         i.id::text, i.codigo, i.titulo, i.departamento, i.versao, i.status,
         i.objetivo, i.pdf_original_url as "pdfUrl",
         i.created_at as "criadoEm",
         u.name as "autorNome", u.email as "autorEmail"
       FROM public.fiorix_its i
       LEFT JOIN public."User" u ON u.id = i.autor_id
       WHERE i.id = $1::uuid AND i.tenant_id = $2 AND i.deleted_at IS NULL
       LIMIT 1`,
      itId, tenantId
    );
    if (!rows.length) return { success: false, error: 'IT não encontrada.' };
    const row = rows[0];

    const similares = await prisma.$queryRawUnsafe<any[]>(
      `SELECT codigo, titulo FROM public.fiorix_its
       WHERE tenant_id = $1 AND deleted_at IS NULL
         AND status IN ('vigente','ativa','publicada')
         AND LOWER(titulo) = LOWER($2) AND id != $3::uuid
       LIMIT 1`,
      tenantId, row.titulo, itId
    );

    return {
      success: true,
      data: {
        id: row.id,
        codigo: row.codigo,
        titulo: row.titulo,
        departamento: row.departamento,
        versao: row.versao,
        status: row.status,
        objetivo: row.objetivo || '',
        pdfUrl: row.pdfUrl || null,
        autorNome: row.autorNome || 'Colaborador',
        autorEmail: row.autorEmail || '',
        criadoEm: new Date(row.criadoEm).toLocaleString('pt-BR'),
        itSimilar: similares.length > 0
          ? { codigo: similares[0].codigo, titulo: similares[0].titulo }
          : null,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao carregar IT.' };
  }
}

export async function aprovarItColaborador(
  itId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
    const tenantId = currentUser.tenantId;

    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its
       SET status = 'aprovada', updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2 AND deleted_at IS NULL
         AND status IN ('enviada_para_analise', 'correcao_solicitada')`,
      itId, tenantId
    );

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.fiorix_its_versoes (
           id, it_id, versao, conteudo_snapshot, alteracoes, autor_id, hash_versao, created_at, tenant_id
         ) VALUES (
           gen_random_uuid(), $1::uuid, '1.0', '{}'::jsonb,
           $2, $3, '', NOW(), $4
         )`,
        itId,
        `IT aprovada por ${currentUser.name || currentUser.email}`,
        currentUser.id,
        tenantId
      );
    } catch { /* histórico opcional */ }

    revalidatePath('/administracao/its');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao aprovar IT.' };
  }
}

export async function publicarItColaborador(
  itId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
    const tenantId = currentUser.tenantId;

    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its
       SET status = 'publicada', updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2 AND deleted_at IS NULL
         AND status = 'aprovada'`,
      itId, tenantId
    );

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.fiorix_its_versoes (
           id, it_id, versao, conteudo_snapshot, alteracoes, autor_id, hash_versao, created_at, tenant_id
         ) VALUES (
           gen_random_uuid(), $1::uuid, '1.0', '{}'::jsonb,
           $2, $3, '', NOW(), $4
         )`,
        itId,
        `IT publicada por ${currentUser.name || currentUser.email}`,
        currentUser.id,
        tenantId
      );
    } catch { /* histórico opcional */ }

    revalidatePath('/administracao/its');
    revalidatePath('/instrucoes-trabalho');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao publicar IT.' };
  }
}

export async function solicitarCorrecaoIt(
  itId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
    const tenantId = currentUser.tenantId;

    if (!motivo?.trim()) return { success: false, error: 'O motivo da correção é obrigatório.' };

    // Grava motivo no campo objetivo como nota de correção (armazenamento provisório)
    // até que exista coluna dedicada no schema
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its
       SET status = 'correcao_solicitada',
           updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2 AND deleted_at IS NULL
         AND status IN ('enviada_para_analise', 'aprovada')`,
      itId, tenantId
    );

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.fiorix_its_versoes (
           id, it_id, versao, conteudo_snapshot, alteracoes, autor_id, hash_versao, created_at, tenant_id
         ) VALUES (
           gen_random_uuid(), $1::uuid, '1.0', '{}'::jsonb,
           $2, $3, '', NOW(), $4
         )`,
        itId,
        `Correção solicitada por ${currentUser.name || currentUser.email}: ${motivo.trim()}`,
        currentUser.id,
        tenantId
      );
    } catch { /* histórico opcional */ }

    revalidatePath('/administracao/its');
    revalidatePath('/minha-it');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao solicitar correção.' };
  }
}

export async function rejeitarItColaborador(
  itId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
    const tenantId = currentUser.tenantId;

    if (!motivo?.trim()) return { success: false, error: 'O motivo da rejeição é obrigatório.' };

    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its
       SET status = 'rejeitada', updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2 AND deleted_at IS NULL
         AND status IN ('enviada_para_analise', 'correcao_solicitada')`,
      itId, tenantId
    );

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.fiorix_its_versoes (
           id, it_id, versao, conteudo_snapshot, alteracoes, autor_id, hash_versao, created_at, tenant_id
         ) VALUES (
           gen_random_uuid(), $1::uuid, '1.0', '{}'::jsonb,
           $2, $3, '', NOW(), $4
         )`,
        itId,
        `IT rejeitada por ${currentUser.name || currentUser.email}: ${motivo.trim()}`,
        currentUser.id,
        tenantId
      );
    } catch { /* histórico opcional */ }

    revalidatePath('/administracao/its');
    revalidatePath('/minha-it');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao rejeitar IT.' };
  }
}

export interface MinhaItCardItem {
  id: string;
  codigo: string;
  titulo: string;
  departamento: string;
  versao: string;
  vigencia: string;
  tempoLeituraMin: number;
  objetivo: string;
  quandoUsar?: string;
  isGuardiao: boolean;
  isAutorizadoRh: boolean;
  guardiaoNome?: string;
  statusCiencia: 'ciente' | 'pendente';
  cienteEm?: string;
  diasSemRevisao: number;
}

export interface MinhasItsPageData {
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    departamento: string;
    cargo: string;
  };
  its: MinhaItCardItem[];
  stats: {
    total: number;
    cientes: number;
    pendentes: number;
    custodias: number;
  };
}

export async function getMinhasItsData(): Promise<MinhasItsPageData> {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  // Busca departamento e cargo atualizados diretamente no banco
  let userDepto = currentUser.departamento;
  let userCargo = currentUser.cargo;
  if (!userDepto || !userCargo) {
    const rawUser = await prisma.$queryRawUnsafe<any[]>(
      `SELECT departamento, cargo FROM public."User" WHERE id = $1 LIMIT 1`,
      currentUser.id
    );
    if (rawUser && rawUser.length > 0) {
      userDepto = rawUser[0].departamento || userDepto;
      userCargo = rawUser[0].cargo || userCargo;
    }
  }
  userDepto = userDepto || 'Atendimento';
  userCargo = userCargo || 'colaborador';

  const isMasterOrAdmin = ['ADMIN', 'MASTER', 'RH'].includes(currentUser.role);

  // REGRA ESTRITA: Apenas o Guardião Oficial vê a IT, ou colaborador expressamente autorizado pelo RH
  const rawIts = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       i.id::text,
       i.codigo,
       i.titulo,
       i.departamento,
       i.versao,
       i.vigencia::text,
       i.tempo_leitura_min as "tempoLeituraMin",
       i.objetivo,
       i.quando_usar as "quandoUsar",
       i.guardiao_id as "guardiaoId",
       g.name as "guardiaoNome",
       c.status as "cienciaStatus",
       c.ciente_em as "cienteEm",
       ROUND(EXTRACT(EPOCH FROM (NOW() - i.updated_at)) / 86400)::int as "diasSemRevisao",
       CASE WHEN i.guardiao_id = $2 OR (i.substituto_id = $2 AND (i.substituto_ate IS NULL OR i.substituto_ate >= CURRENT_DATE)) THEN true ELSE false END as "isCustodia",
       CASE WHEN i.guardiao_id != $2 AND (c.id IS NOT NULL OR t.id IS NOT NULL) THEN true ELSE false END as "isAutorizado"
     FROM public.fiorix_its i
     LEFT JOIN public."User" g ON g.id = i.guardiao_id
     LEFT JOIN public.fiorix_its_ciencias c ON c.it_id = i.id AND c.usuario_id = $2 AND c.versao = i.versao
     LEFT JOIN public.fiorix_trilhas_estudo t ON t.it_id = i.id AND t.usuario_id = $2
     WHERE i.tenant_id = $1 
       AND i.deleted_at IS NULL
       AND (
         -- 1. É o Guardião / Responsável oficial
         i.guardiao_id = $2
         -- 2. É Substituto ativo
         OR (i.substituto_id = $2 AND (i.substituto_ate IS NULL OR i.substituto_ate >= CURRENT_DATE))
         -- 3. Permissão explícita concedida pelo RH (inclusão na ciência ou trilha aprovada)
         OR c.id IS NOT NULL
         OR t.id IS NOT NULL
       )
     ORDER BY 
       CASE WHEN i.guardiao_id = $2 THEN 0 ELSE 1 END,
       CASE WHEN c.status = 'pendente' THEN 0 ELSE 1 END,
       i.codigo ASC`,
    tenantId,
    currentUser.id
  );

  const its: MinhaItCardItem[] = rawIts.map((row) => ({
    id: row.id,
    codigo: row.codigo,
    titulo: row.titulo,
    departamento: row.departamento,
    versao: row.versao || '1.0',
    vigencia: row.vigencia || new Date().toISOString().split('T')[0],
    tempoLeituraMin: Number(row.tempoLeituraMin || 5),
    objetivo: row.objetivo || '',
    quandoUsar: row.quandoUsar || '',
    isGuardiao: Boolean(row.isCustodia),
    isAutorizadoRh: Boolean(row.isAutorizado),
    guardiaoNome: row.guardiaoNome || undefined,
    statusCiencia: row.cienciaStatus === 'ciente' ? 'ciente' : 'pendente',
    cienteEm: row.cienteEm ? new Date(row.cienteEm).toLocaleDateString('pt-BR') : undefined,
    diasSemRevisao: Number(row.diasSemRevisao || 0),
  }));

  const cientes = its.filter((it) => it.statusCiencia === 'ciente').length;
  const pendentes = its.filter((it) => it.statusCiencia === 'pendente').length;
  const custodias = its.filter((it) => it.isGuardiao).length;

  return {
    currentUser: {
      id: currentUser.id,
      name: currentUser.name || 'Colaborador',
      email: currentUser.email || '',
      role: currentUser.role,
      departamento: userDepto,
      cargo: userCargo,
    },
    its,
    stats: {
      total: its.length,
      cientes,
      pendentes,
      custodias,
    },
  };
}

export async function obterMinhaItId(): Promise<string | null> {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  // 1. Tenta achar IT onde o usuário é guardião oficial
  const guardiaoIt = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text FROM public.fiorix_its 
     WHERE tenant_id = $1 AND guardiao_id = $2 AND deleted_at IS NULL
     ORDER BY codigo ASC
     LIMIT 1`,
    tenantId,
    currentUser.id
  );
  if (guardiaoIt.length > 0) return guardiaoIt[0].id;

  // 2. Tenta achar IT onde o usuário é substituto oficial ativo
  const substitutoIt = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id::text FROM public.fiorix_its 
     WHERE tenant_id = $1 AND substituto_id = $2 AND deleted_at IS NULL
       AND (substituto_ate IS NULL OR substituto_ate >= CURRENT_DATE)
     ORDER BY codigo ASC
     LIMIT 1`,
    tenantId,
    currentUser.id
  );
  if (substitutoIt.length > 0) return substitutoIt[0].id;

  // 3. Tenta achar IT onde o RH deu permissão explícita
  const permissaoIt = await prisma.$queryRawUnsafe<any[]>(
    `SELECT i.id::text 
     FROM public.fiorix_its i
     JOIN public.fiorix_its_ciencias c ON c.it_id = i.id AND c.usuario_id = $2 AND c.versao = i.versao
     WHERE i.tenant_id = $1 AND i.deleted_at IS NULL
     ORDER BY CASE WHEN c.status = 'pendente' THEN 0 ELSE 1 END, i.codigo ASC
     LIMIT 1`,
    tenantId,
    currentUser.id
  );
  if (permissaoIt.length > 0) return permissaoIt[0].id;

  // 4. Sem IT sob sua responsabilidade e sem permissão do RH -> null
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// GOVERNANÇA ADMIN — COLUNAS EDITÁVEIS, CRUD ITs, GESTÃO DE CIÊNCIA
// ══════════════════════════════════════════════════════════════════════════════

export interface ColumnConfigItem {
  colunaKey: string;
  colunaLabel: string;
}

export async function getColumnConfig(): Promise<Record<string, string>> {
  const currentUser = await requireAuth();
  const tenantId = currentUser.tenantId;

  const raw = await prisma.$queryRawUnsafe<any[]>(
    `SELECT coluna_key, coluna_label FROM public.fiorix_its_column_config WHERE tenant_id = $1`,
    tenantId
  );

  const config: Record<string, string> = {};
  for (const row of raw) {
    config[row.coluna_key] = row.coluna_label;
  }

  // Defaults caso não existam registros
  const defaults: Record<string, string> = {
    codigo: 'Código / IT',
    setor: 'Setor',
    versao: 'Versão',
    guardiao: 'Guardião Responsável',
    revisao: 'Última Revisão',
    ciencia: 'Ciência da Equipe',
    acoes: 'Ações',
  };

  return { ...defaults, ...config };
}

export async function updateColumnLabel(colunaKey: string, novoLabel: string) {
  const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
  const tenantId = currentUser.tenantId;

  if (!novoLabel.trim()) throw new Error('O nome da coluna não pode ser vazio.');

  await prisma.$queryRawUnsafe(
    `INSERT INTO public.fiorix_its_column_config (tenant_id, coluna_key, coluna_label, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (tenant_id, coluna_key)
     DO UPDATE SET coluna_label = EXCLUDED.coluna_label, updated_at = NOW()`,
    tenantId,
    colunaKey,
    novoLabel.trim()
  );

  revalidatePath('/gestao/rh/instrucoes-trabalho-monitoramento');
  return { success: true };
}

export async function criarItRapida(data: {
  codigo: string;
  titulo: string;
  departamento: string;
  guardiaoId?: string;
  pdfOriginalUrl?: string;
  pdfPath?: string;
}) {
  const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
  const tenantId = currentUser.tenantId;

  if (!data.codigo.trim() || !data.titulo.trim()) {
    throw new Error('Código e Título são obrigatórios.');
  }

  // Verifica se já existe IT ativa com o mesmo código
  const existingActive = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM public.fiorix_its WHERE tenant_id = $1 AND codigo = $2 AND deleted_at IS NULL`,
    tenantId,
    data.codigo.trim()
  );
  if (existingActive.length > 0) {
    throw new Error(`Já existe uma IT ativa com o código "${data.codigo}". Escolha um código diferente.`);
  }

  const hashVersao = crypto.createHash('sha256').update(
    JSON.stringify({ tenantId, ...data, timestamp: new Date().toISOString() })
  ).digest('hex');

  let result: any[];
  try {
    result = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO public.fiorix_its (
         tenant_id, codigo, titulo, departamento, versao, tempo_leitura_min, 
         objetivo, hash_versao, autor_id, guardiao_id, pdf_original_url, pdf_path
       ) VALUES (
         $1, $2, $3, $4, '1.0', 5, 'Instrução de Trabalho', $5, $6, $7, $8, $9
       )
       RETURNING id::text`,
      tenantId,
      data.codigo.trim(),
      data.titulo.toUpperCase().trim(),
      data.departamento,
      hashVersao,
      currentUser.id,
      data.guardiaoId || currentUser.id,
      data.pdfOriginalUrl || null,
      data.pdfPath || null
    );
  } catch (err: any) {
    // Código 23505 = unique_violation no PostgreSQL
    if (err?.message?.includes('23505') || err?.message?.includes('already exists')) {
      throw new Error(
        `Código "${data.codigo}" já está em uso (incluindo ITs arquivadas). Use um código diferente.`
      );
    }
    throw err;
  }

  if (result.length > 0) {
    // Registra versão inicial
    await prisma.$queryRawUnsafe(
      `INSERT INTO public.fiorix_its_versoes (
         it_id, versao, conteudo_snapshot, alteracoes, autor_id, hash_versao
       ) VALUES (
         $1::uuid, '1.0', $2::jsonb, 'Criação rápida via Governança', $3, $4
       )`,
      result[0].id,
      JSON.stringify(data),
      currentUser.id,
      hashVersao
    );

    // Gera ciência pendente para o departamento
    const deptoUsers = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public."User" WHERE "tenantId" = $1 AND departamento = $2`,
      tenantId,
      data.departamento
    );

    for (const user of deptoUsers) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO public.fiorix_its_ciencias (tenant_id, it_id, usuario_id, versao, status, created_at)
         VALUES ($1, $2::uuid, $3, '1.0', 'pendente', NOW())
         ON CONFLICT (tenant_id, it_id, usuario_id, versao) DO NOTHING`,
        tenantId,
        result[0].id,
        user.id
      );
    }
  }

  revalidatePath('/gestao/rh/instrucoes-trabalho-monitoramento');
  revalidatePath('/administracao/its');
  return { success: true, id: result[0]?.id };
}

export async function excluirItGovernanca(itId: string, motivo: string, senhaAdmin: string) {
  const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');

  // Validação de senha
  const userRecord = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { passwordHash: true },
  });

  if (!userRecord?.passwordHash) {
    throw new Error('Usuário sem senha cadastrada.');
  }

  const senhaValida = await bcrypt.compare(senhaAdmin, userRecord.passwordHash);
  if (!senhaValida) {
    throw new Error('Senha incorreta. A exclusão requer confirmação por senha.');
  }

  // Soft-delete WORM
  await prisma.$queryRawUnsafe(
    `UPDATE public.fiorix_its
     SET deleted_at = NOW()
     WHERE id = $1::uuid AND tenant_id = $2`,
    itId,
    currentUser.tenantId
  );

  // Registra no audit log
  const hashSha256 = crypto.createHash('sha256').update(
    JSON.stringify({ itId, motivo, autor: currentUser.id, timestamp: new Date().toISOString() })
  ).digest('hex');

  await prisma.$queryRawUnsafe(
    `INSERT INTO public.fiorix_its_audit_log (
       tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, hash_sha256, created_at
     ) VALUES (
       $1, $2::uuid, 'N/A', 'EXCLUÍDA', $3, $4, $5::jsonb, $6, NOW()
     )`,
    currentUser.tenantId,
    itId,
    currentUser.id,
    `EXCLUSÃO: ${motivo}`,
    JSON.stringify({ acao: 'exclusao', motivo }),
    hashSha256
  );

  revalidatePath('/gestao/rh/instrucoes-trabalho-monitoramento');
  revalidatePath('/administracao/its');
  return { success: true };
}

export async function adicionarColaboradorCiencia(itId: string, usuarioId: string, versao: string) {
  const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
  const tenantId = currentUser.tenantId;

  await prisma.$queryRawUnsafe(
    `INSERT INTO public.fiorix_its_ciencias (tenant_id, it_id, usuario_id, versao, status, created_at)
     VALUES ($1, $2::uuid, $3, $4, 'pendente', NOW())
     ON CONFLICT (tenant_id, it_id, usuario_id, versao) DO NOTHING`,
    tenantId,
    itId,
    usuarioId,
    versao
  );

  revalidatePath('/gestao/rh/instrucoes-trabalho-monitoramento');
  return { success: true };
}

export async function removerColaboradorCiencia(itId: string, usuarioId: string, versao: string) {
  const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
  const tenantId = currentUser.tenantId;

  await prisma.$queryRawUnsafe(
    `DELETE FROM public.fiorix_its_ciencias
     WHERE tenant_id = $1 AND it_id = $2::uuid AND usuario_id = $3 AND versao = $4`,
    tenantId,
    itId,
    usuarioId,
    versao
  );

  revalidatePath('/gestao/rh/instrucoes-trabalho-monitoramento');
  return { success: true };
}

export interface ColaboradorCienciaOption {
  id: string;
  name: string;
  email: string;
  departamento: string;
  cargo: string;
  jaIncluso: boolean;
  status?: string;
  cienteEm?: string;
}

export async function getColaboradoresParaCiencia(itId: string, versao: string): Promise<ColaboradorCienciaOption[]> {
  const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
  const tenantId = currentUser.tenantId;

  const allUsers = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name, email, COALESCE(departamento, 'Atendimento') as departamento, COALESCE(cargo, 'auxiliar') as cargo
     FROM public."User"
     WHERE "tenantId" = $1
     ORDER BY name ASC`,
    tenantId
  );

  const cienciasExistentes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT usuario_id, status, ciente_em
     FROM public.fiorix_its_ciencias
     WHERE tenant_id = $1 AND it_id = $2::uuid AND versao = $3`,
    tenantId,
    itId,
    versao
  );

  const cienciaMap = new Map<string, { status: string; cienteEm: any }>();
  for (const c of cienciasExistentes) {
    cienciaMap.set(c.usuario_id, { status: c.status, cienteEm: c.ciente_em });
  }

  return allUsers.map(u => ({
    id: u.id,
    name: u.name || 'Colaborador',
    email: u.email || '',
    departamento: u.departamento,
    cargo: u.cargo,
    jaIncluso: cienciaMap.has(u.id),
    status: cienciaMap.get(u.id)?.status,
    cienteEm: cienciaMap.get(u.id)?.cienteEm
      ? new Date(cienciaMap.get(u.id)!.cienteEm).toLocaleString('pt-BR')
      : undefined,
  }));
}

// ═══════════════════════════════════════════════════════════════
// CICLO DE VIDA DAS ITs — Exclusão, Cancelamento, Arquivamento
// ═══════════════════════════════════════════════════════════════

/**
 * Exclui um rascunho ou submissão não aprovada.
 * Permitido para: COLABORADOR (somente o próprio), ADMIN, SUBSTITUTO, MASTER.
 * Realiza soft-delete + audit log. Não requer senha (nunca foi publicada).
 */
export async function excluirRascunhoIt(
  itId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;
    const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);

    if (!motivo?.trim()) {
      return { success: false, error: 'O motivo da exclusão é obrigatório.' };
    }

    // Busca a IT para validar status e propriedade
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text, codigo, titulo, status, autor_id
       FROM public.fiorix_its
       WHERE id = $1::uuid AND tenant_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      itId, tenantId
    );
    if (!rows.length) return { success: false, error: 'IT não encontrada.' };
    const it = rows[0];

    // Validação: status deve ser rascunho/enviada/correcao/rejeitada — nunca aprovada/publicada
    const statusPermitidos = ['rascunho', 'enviada_para_analise', 'correcao_solicitada', 'rejeitada'];
    if (!statusPermitidos.includes(it.status)) {
      return {
        success: false,
        error: `Não é possível excluir uma IT com status "${it.status}". Use "Arquivar" para ITs publicadas.`,
      };
    }

    // Colaborador só pode excluir o próprio registro
    if (!isGestao && it.autor_id !== currentUser.id) {
      return { success: false, error: 'Você só pode excluir suas próprias submissões.' };
    }

    // Soft-delete
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2`,
      itId, tenantId
    );

    // Audit log
    const hash = crypto.createHash('sha256').update(
      JSON.stringify({ itId, motivo, autor: currentUser.id, acao: 'EXCLUSAO_RASCUNHO', timestamp: new Date().toISOString() })
    ).digest('hex');

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_its_audit_log (
         tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, hash_sha256, created_at
       ) VALUES (
         $1, $2::uuid, $3, 'EXCLUÍDO', $4, $5, $6::jsonb, $7, NOW()
       )`,
      tenantId, itId, it.status, currentUser.id,
      `Exclusão de rascunho: ${motivo.trim()}`,
      JSON.stringify({ acao: 'exclusao_rascunho', statusAnterior: it.status, motivo, autor: currentUser.name }),
      hash
    );

    revalidatePath('/administracao/its');
    revalidatePath('/minha-it');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao excluir rascunho.' };
  }
}

/**
 * Cancela um envio que ainda está em análise, revertendo para "rascunho".
 * Permitido para: COLABORADOR (somente o próprio), ADMIN, SUBSTITUTO, MASTER.
 */
export async function cancelarEnvioIt(
  itId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;
    const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text, codigo, status, autor_id
       FROM public.fiorix_its
       WHERE id = $1::uuid AND tenant_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      itId, tenantId
    );
    if (!rows.length) return { success: false, error: 'IT não encontrada.' };
    const it = rows[0];

    if (it.status !== 'enviada_para_analise') {
      return { success: false, error: `Não é possível cancelar: o status atual é "${it.status}".` };
    }
    if (!isGestao && it.autor_id !== currentUser.id) {
      return { success: false, error: 'Você só pode cancelar suas próprias submissões.' };
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its
       SET status = 'rascunho', updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2`,
      itId, tenantId
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_its_versoes (
         id, it_id, versao, conteudo_snapshot, alteracoes, autor_id, hash_versao, created_at, tenant_id
       ) VALUES (
         gen_random_uuid(), $1::uuid, '1.0', '{}'::jsonb, $2, $3, '', NOW(), $4
       )`,
      itId,
      `Envio cancelado por ${currentUser.name || currentUser.email} — IT retornou ao estado de rascunho`,
      currentUser.id, tenantId
    );

    revalidatePath('/minha-it');
    revalidatePath('/administracao/its');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao cancelar envio.' };
  }
}

/**
 * Arquiva uma IT publicada/vigente/ativa.
 * IT arquivada não aparece no Catálogo mas mantém histórico completo.
 * Requer: ADMIN, SUBSTITUTO ou MASTER + motivo obrigatório.
 */
export async function arquivarItPublicada(
  itId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER');
    const tenantId = currentUser.tenantId;

    if (!motivo?.trim()) {
      return { success: false, error: 'O motivo do arquivamento é obrigatório.' };
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text, codigo, titulo, versao, status
       FROM public.fiorix_its
       WHERE id = $1::uuid AND tenant_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      itId, tenantId
    );
    if (!rows.length) return { success: false, error: 'IT não encontrada.' };
    const it = rows[0];

    const statusPublicados = ['vigente', 'ativa', 'publicada'];
    if (!statusPublicados.includes(it.status)) {
      return {
        success: false,
        error: `Somente ITs publicadas podem ser arquivadas. Status atual: "${it.status}".`,
      };
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its
       SET status = 'arquivada', updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2`,
      itId, tenantId
    );

    const hash = crypto.createHash('sha256').update(
      JSON.stringify({ itId, motivo, autor: currentUser.id, acao: 'ARQUIVAMENTO', timestamp: new Date().toISOString() })
    ).digest('hex');

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_its_audit_log (
         tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, hash_sha256, created_at
       ) VALUES (
         $1, $2::uuid, $3, 'ARQUIVADA', $4, $5, $6::jsonb, $7, NOW()
       )`,
      tenantId, itId, it.versao, currentUser.id,
      `Arquivamento: ${motivo.trim()}`,
      JSON.stringify({ acao: 'arquivamento', statusAnterior: it.status, motivo, autor: currentUser.name }),
      hash
    );

    await recordAuditLog({
      modulo: 'ITS',
      acao: 'EXCLUSAO',
      registroId: itId,
      registroDescricao: `IT "${it.codigo} — ${it.titulo}" arquivada`,
      detalhes: { motivo, statusAnterior: it.status, tipoAcao: 'ARQUIVAMENTO' },
      userOverride: currentUser,
    });

    revalidatePath('/administracao/its');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao arquivar IT.' };
  }
}

/**
 * Exclusão permanente — SOMENTE MASTER.
 * Realiza soft-delete definitivo com flag no audit_log (preserva integridade referencial).
 * Exige: senha, código da IT digitado corretamente, motivo (mín. 20 chars).
 */
export async function excluirPermanenteIt(params: {
  itId: string;
  codigoConfirmacao: string;
  motivo: string;
  senha: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireRole('MASTER');
    const tenantId = currentUser.tenantId;

    if (!params.motivo?.trim() || params.motivo.trim().length < 20) {
      return { success: false, error: 'O motivo deve ter no mínimo 20 caracteres.' };
    }

    // Validar senha
    const userRecord = await prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { passwordHash: true },
    });
    if (!userRecord?.passwordHash) {
      return { success: false, error: 'Usuário sem senha cadastrada.' };
    }
    const senhaValida = await bcrypt.compare(params.senha, userRecord.passwordHash);
    if (!senhaValida) {
      return { success: false, error: 'Senha incorreta. A exclusão permanente requer confirmação.' };
    }

    // Buscar IT
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text, codigo, titulo, versao, status
       FROM public.fiorix_its
       WHERE id = $1::uuid AND tenant_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      params.itId, tenantId
    );
    if (!rows.length) return { success: false, error: 'IT não encontrada.' };
    const it = rows[0];

    // Validar código de confirmação
    if (params.codigoConfirmacao.trim().toUpperCase() !== it.codigo.toUpperCase()) {
      return { success: false, error: `Código incorreto. Digite exatamente: ${it.codigo}` };
    }

    // AUDIT LOG antes de qualquer alteração (registro imutável)
    const hash = crypto.createHash('sha256').update(
      JSON.stringify({
        itId: params.itId, codigo: it.codigo, motivo: params.motivo,
        autor: currentUser.id, acao: 'EXCLUSAO_PERMANENTE',
        timestamp: new Date().toISOString(),
      })
    ).digest('hex');

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_its_audit_log (
         tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, hash_sha256, created_at
       ) VALUES (
         $1, $2::uuid, $3, 'EXCLUÍDA PERMANENTEMENTE', $4, $5, $6::jsonb, $7, NOW()
       )`,
      tenantId, params.itId, it.versao, currentUser.id,
      `EXCLUSÃO PERMANENTE (MASTER): ${params.motivo.trim()}`,
      JSON.stringify({
        acao: 'exclusao_permanente',
        codigo: it.codigo,
        titulo: it.titulo,
        statusAnterior: it.status,
        motivo: params.motivo,
        executor: { id: currentUser.id, name: currentUser.name, email: currentUser.email },
      }),
      hash
    );

    // Soft-delete definitivo: deleted_at + status marcado
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its
       SET deleted_at = NOW(), status = 'excluida_permanentemente', updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2`,
      params.itId, tenantId
    );

    await recordAuditLog({
      modulo: 'ITS',
      acao: 'EXCLUSAO',
      registroId: params.itId,
      registroDescricao: `IT "${it.codigo} — ${it.titulo}" excluída permanentemente por MASTER`,
      detalhes: { motivo: params.motivo, codigo: it.codigo, hashProva: hash, tipoAcao: 'EXCLUSAO_PERMANENTE' },
      userOverride: currentUser,
    });

    revalidatePath('/administracao/its');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro na exclusão permanente.' };
  }
}

// Tipos do histórico
export interface VersaoHistoricoItem {
  id: string;
  versao: string;
  alteracoes: string;
  autorNome: string;
  autorEmail: string;
  criadoEm: string;
  hashVersao: string;
}

export interface AuditHistoricoItem {
  id: string;
  versaoAnterior: string;
  versaoNova: string;
  autorNome: string;
  autorEmail: string;
  motivo: string;
  diffSnapshot: any;
  hashSha256: string;
  criadoEm: string;
}

export interface HistoricoVersoesData {
  it: { id: string; codigo: string; titulo: string; status: string; versaoAtual: string };
  versoes: VersaoHistoricoItem[];
  auditLog: AuditHistoricoItem[];
}

/**
 * Retorna histórico completo de versões + audit log de uma IT.
 * Requer: ADMIN, SUBSTITUTO, MASTER ou RH.
 */
export async function getHistoricoVersoes(
  itId: string
): Promise<{ success: boolean; data?: HistoricoVersoesData; error?: string }> {
  try {
    const currentUser = await requireRole('ADMIN', 'SUBSTITUTO', 'MASTER', 'RH');
    const tenantId = currentUser.tenantId;

    // Dados da IT
    const itRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text, codigo, titulo, status, versao
       FROM public.fiorix_its
       WHERE id = $1::uuid AND tenant_id = $2
       LIMIT 1`,
      itId, tenantId
    );
    if (!itRows.length) return { success: false, error: 'IT não encontrada.' };
    const it = itRows[0];

    // Versões
    const versoesRaw = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         v.id::text,
         v.versao,
         v.alteracoes,
         u.name as "autorNome",
         u.email as "autorEmail",
         v.created_at as "criadoEm",
         v.hash_versao as "hashVersao"
       FROM public.fiorix_its_versoes v
       LEFT JOIN public."User" u ON u.id = v.autor_id
       WHERE v.it_id = $1::uuid AND v.tenant_id = $2
       ORDER BY v.created_at DESC
       LIMIT 50`,
      itId, tenantId
    );

    // Audit log
    const auditRaw = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         a.id::text,
         a.versao_anterior as "versaoAnterior",
         a.versao_nova as "versaoNova",
         u.name as "autorNome",
         u.email as "autorEmail",
         a.motivo,
         a.diff_snapshot as "diffSnapshot",
         a.hash_sha256 as "hashSha256",
         a.created_at as "criadoEm"
       FROM public.fiorix_its_audit_log a
       LEFT JOIN public."User" u ON u.id = a.autor_id
       WHERE a.it_id = $1::uuid AND a.tenant_id = $2
       ORDER BY a.created_at DESC
       LIMIT 50`,
      itId, tenantId
    );

    return {
      success: true,
      data: {
        it: { id: it.id, codigo: it.codigo, titulo: it.titulo, status: it.status, versaoAtual: it.versao },
        versoes: versoesRaw.map(v => ({
          id: v.id,
          versao: v.versao,
          alteracoes: v.alteracoes || '',
          autorNome: v.autorNome || 'Sistema',
          autorEmail: v.autorEmail || '',
          criadoEm: new Date(v.criadoEm).toLocaleString('pt-BR'),
          hashVersao: v.hashVersao || '',
        })),
        auditLog: auditRaw.map(a => ({
          id: a.id,
          versaoAnterior: a.versaoAnterior || '',
          versaoNova: a.versaoNova || '',
          autorNome: a.autorNome || 'Sistema',
          autorEmail: a.autorEmail || '',
          motivo: a.motivo || '',
          diffSnapshot: a.diffSnapshot || null,
          hashSha256: a.hashSha256 || '',
          criadoEm: new Date(a.criadoEm).toLocaleString('pt-BR'),
        })),
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao carregar histórico.' };
  }
}

// ═══════════════════════════════════════════════════════════════
// RESPONSABILIDADE CONJUNTA — Participantes das ITs
// ═══════════════════════════════════════════════════════════════

export type PapelNaIt = 'RESPONSAVEL_PRINCIPAL' | 'CORRESPONSAVEL' | 'LEITOR';

export interface ItParticipante {
  id: string;
  usuarioId: string;
  nome: string;
  email: string;
  departamento: string;
  cargo: string;
  papel: PapelNaIt;
  status: 'ativo' | 'inativo';
  podeColaborarRascunho: boolean;
  incluidoPor: string;
  vinculadoEm: string;
}

/**
 * Retorna todos os participantes ativos de uma IT.
 * Visível para: ADMIN, SUBSTITUTO, MASTER, e qualquer participante da IT.
 */
export async function getParticipantesIt(
  itId: string
): Promise<{ success: boolean; participantes?: ItParticipante[]; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         p.id::text,
         p.usuario_id as "usuarioId",
         p.papel,
         p.status,
         p.pode_colaborar_rascunho as "podeColaborarRascunho",
         p.incluido_por as "incluidoPor",
         p.created_at as "vinculadoEm",
         u.name,
         u.email,
         u.departamento,
         u.cargo
       FROM public.fiorix_its_participants p
       LEFT JOIN public."User" u ON u.id = p.usuario_id
       WHERE p.it_id = $1::uuid
         AND p.tenant_id = $2
         AND p.status = 'ativo'
       ORDER BY
         CASE p.papel WHEN 'RESPONSAVEL_PRINCIPAL' THEN 0 WHEN 'CORRESPONSAVEL' THEN 1 ELSE 2 END,
         p.created_at ASC`,
      itId, tenantId
    );

    // Se ainda não há participantes registrados, auto-sincroniza com o responsavel_tecnico_id de fiorix_its
    if (rows.length === 0) {
      try {
        const itRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT responsavel_tecnico_id FROM public.fiorix_its WHERE id = $1::uuid AND tenant_id = $2 LIMIT 1`,
          itId, tenantId
        );
        if (itRows.length && itRows[0].responsavel_tecnico_id) {
          const respId = itRows[0].responsavel_tecnico_id;
          await prisma.$executeRawUnsafe(
            `INSERT INTO public.fiorix_its_participants (tenant_id, it_id, usuario_id, papel, status, incluido_por, created_at, updated_at)
             VALUES ($1, $2::uuid, $3, 'RESPONSAVEL_PRINCIPAL', 'ativo', $3, NOW(), NOW())
             ON CONFLICT DO NOTHING`,
            tenantId, itId, respId
          );
          const syncRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT
               p.id::text, p.usuario_id as "usuarioId", p.papel, p.status,
               p.pode_colaborar_rascunho as "podeColaborarRascunho", p.incluido_por as "incluidoPor",
               p.created_at as "vinculadoEm", u.name, u.email, u.departamento, u.cargo
             FROM public.fiorix_its_participants p
             LEFT JOIN public."User" u ON u.id = p.usuario_id
             WHERE p.it_id = $1::uuid AND p.tenant_id = $2 AND p.status = 'ativo'`,
            itId, tenantId
          );
          if (syncRows.length) rows.push(...syncRows);
        }
      } catch (seedErr) {
        console.warn('Aviso ao sincronizar responsável técnico inicial:', seedErr);
      }
    }

    return {
      success: true,
      participantes: rows.map(r => ({
        id: r.id,
        usuarioId: r.usuarioId,
        nome: r.name || 'Usuário',
        email: r.email || '',
        departamento: r.departamento || '',
        cargo: r.cargo || '',
        papel: r.papel as PapelNaIt,
        status: r.status,
        podeColaborarRascunho: r.podeColaborarRascunho || false,
        incluidoPor: r.incluidoPor || '',
        vinculadoEm: new Date(r.vinculadoEm).toLocaleDateString('pt-BR'),
      })),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao listar participantes.' };
  }
}

/**
 * Adiciona participante a uma IT.
 * - RESPONSAVEL_PRINCIPAL pode adicionar CORRESPONSAVEL/LEITOR do mesmo setor.
 * - Cross-setor requer ADMIN ou MASTER.
 * - ADMIN/MASTER podem adicionar qualquer papel.
 */
export async function adicionarParticipanteIt(params: {
  itId: string;
  usuarioId: string;
  papel: PapelNaIt;
  podeColaborarRascunho?: boolean;
}): Promise<{ success: boolean; error?: string; pendente?: boolean }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;
    const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);

    // Buscar a IT
    const itRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text, codigo, titulo, departamento, status
       FROM public.fiorix_its
       WHERE id = $1::uuid AND tenant_id = $2 AND deleted_at IS NULL LIMIT 1`,
      params.itId, tenantId
    );
    if (!itRows.length) return { success: false, error: 'IT não encontrada.' };
    const it = itRows[0];

    // Verificar se o executor é RESPONSAVEL_PRINCIPAL, responsavel_tecnico ou autor da IT
    if (!isGestao) {
      const papelAtual = await prisma.$queryRawUnsafe<any[]>(
        `SELECT papel FROM public.fiorix_its_participants
         WHERE it_id = $1::uuid AND usuario_id = $2 AND status = 'ativo' LIMIT 1`,
        params.itId, currentUser.id
      );
      // Verifica se é responsavel_tecnico_id OU autor_id (cobre ITs legadas sem responsavel_tecnico_id)
      const isRespOuAutor = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM public.fiorix_its
         WHERE id = $1::uuid AND (responsavel_tecnico_id = $2 OR autor_id = $2)
         LIMIT 1`,
        params.itId, currentUser.id
      );
      const temPermissao =
        (papelAtual.length > 0 && papelAtual[0].papel === 'RESPONSAVEL_PRINCIPAL') ||
        isRespOuAutor.length > 0;
      if (!temPermissao) {
        return { success: false, error: 'Apenas o responsável principal ou gestão podem adicionar participantes.' };
      }
    }

    // Não permitir duplicação
    const existente = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.fiorix_its_participants
       WHERE it_id = $1::uuid AND usuario_id = $2 AND status = 'ativo' AND tenant_id = $3 LIMIT 1`,
      params.itId, params.usuarioId, tenantId
    );
    if (existente.length) return { success: false, error: 'Este colaborador já é participante desta IT.' };

    // Não permitir responsável principal como corresponsável
    if (params.papel !== 'RESPONSAVEL_PRINCIPAL') {
      const isRespPrincipal = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM public.fiorix_its_participants
         WHERE it_id = $1::uuid AND usuario_id = $2 AND papel = 'RESPONSAVEL_PRINCIPAL' AND status = 'ativo' LIMIT 1`,
        params.itId, params.usuarioId
      );
      if (isRespPrincipal.length) return { success: false, error: 'O responsável principal não pode ser adicionado como corresponsável.' };
    }

    // Verificar setor do novo participante
    const novoUser = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, email, departamento FROM public."User" WHERE id = $1 LIMIT 1`,
      params.usuarioId
    );
    if (!novoUser.length) return { success: false, error: 'Usuário não encontrado.' };

    const mesmoSetor = (novoUser[0].departamento || '').trim().toLowerCase() === (it.departamento || '').trim().toLowerCase();

    // Cross-setor: responsável técnico/autor pode adicionar de qualquer setor
    // Apenas bloqueia se NÃO for gestão E NÃO for responsável/autor da IT
    if (!mesmoSetor && !isGestao) {
      // Verifica se é responsável técnico ou autor — eles podem adicionar de qualquer setor
      const isRespOuAutor = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM public.fiorix_its
         WHERE id = $1::uuid AND (responsavel_tecnico_id = $2 OR autor_id = $2)
         LIMIT 1`,
        params.itId, currentUser.id
      );
      const isRespPart = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM public.fiorix_its_participants
         WHERE it_id = $1::uuid AND usuario_id = $2 AND papel = 'RESPONSAVEL_PRINCIPAL' AND status = 'ativo'
         LIMIT 1`,
        params.itId, currentUser.id
      );
      if (isRespOuAutor.length === 0 && isRespPart.length === 0) {
        return {
          success: false,
          pendente: true,
          error: `Este colaborador pertence a outro setor (${novoUser[0].departamento}). A vinculação depende de aprovação administrativa.`,
        };
      }
    }

    // Inserir participante
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_its_participants (
         tenant_id, it_id, usuario_id, papel, status, incluido_por,
         pode_colaborar_rascunho, created_at, updated_at
       ) VALUES (
         $1, $2::uuid, $3, $4, 'ativo', $5, $6, NOW(), NOW()
       )`,
      tenantId, params.itId, params.usuarioId, params.papel,
      currentUser.id, params.podeColaborarRascunho || false
    );

    // Audit log
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_its_audit_log (
         tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, hash_sha256, created_at
       ) VALUES (
         $1, $2::uuid, 'PARTICIPANTE', 'ADICIONADO', $3, $4, $5::jsonb, '', NOW()
       )`,
      tenantId, params.itId, currentUser.id,
      `Participante adicionado: ${novoUser[0].name} como ${params.papel}`,
      JSON.stringify({ acao: 'adicionar_participante', papel: params.papel, usuarioId: params.usuarioId, nome: novoUser[0].name, porSetor: mesmoSetor ? 'mesmo' : 'outro' })
    );

    revalidatePath('/minha-it');
    revalidatePath('/administracao/its');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao adicionar participante.' };
  }
}

/**
 * Remove (inativa) um participante de uma IT.
 * - RESPONSAVEL_PRINCIPAL pode remover CORRESPONSAVEL/LEITOR do mesmo setor.
 * - ADMIN/MASTER podem remover qualquer participante, exceto o próprio RESPONSAVEL_PRINCIPAL (requer transferência).
 */
export async function removerParticipanteIt(
  itId: string,
  usuarioId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;
    const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);

    if (!motivo?.trim()) return { success: false, error: 'O motivo da remoção é obrigatório.' };

    // Verificar o participante a ser removido
    const alvo = await prisma.$queryRawUnsafe<any[]>(
      `SELECT p.id::text, p.papel, u.name, u.departamento
       FROM public.fiorix_its_participants p
       LEFT JOIN public."User" u ON u.id = p.usuario_id
       WHERE p.it_id = $1::uuid AND p.usuario_id = $2 AND p.status = 'ativo' AND p.tenant_id = $3 LIMIT 1`,
      itId, usuarioId, tenantId
    );
    if (!alvo.length) return { success: false, error: 'Participante não encontrado ou já removido.' };
    const a = alvo[0];

    // Não permitir remover RESPONSAVEL_PRINCIPAL sem transferência formal
    if (a.papel === 'RESPONSAVEL_PRINCIPAL') {
      return { success: false, error: 'Não é possível remover o responsável principal diretamente. Use "Solicitar transferência" para transferir a responsabilidade primeiro.' };
    }

    // Verificar permissão do executor
    if (!isGestao) {
      const papelExecutor = await prisma.$queryRawUnsafe<any[]>(
        `SELECT papel, u.departamento FROM public.fiorix_its_participants p
         LEFT JOIN public."User" u ON u.id = p.usuario_id
         WHERE p.it_id = $1::uuid AND p.usuario_id = $2 AND p.status = 'ativo' AND p.tenant_id = $3 LIMIT 1`,
        itId, currentUser.id, tenantId
      );
      if (!papelExecutor.length || papelExecutor[0].papel !== 'RESPONSAVEL_PRINCIPAL') {
        return { success: false, error: 'Apenas o responsável principal ou gestão podem remover participantes.' };
      }
      // Responsável principal só pode remover do mesmo setor
      const mesmoSetor = (a.departamento || '').trim().toLowerCase() === (papelExecutor[0].departamento || '').trim().toLowerCase();
      if (!mesmoSetor) {
        return { success: false, error: 'O responsável principal só pode remover participantes do mesmo setor. Solicite a remoção ao ADMIN.' };
      }
    }

    // Inativar participante (soft-delete — preserva histórico)
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its_participants
       SET status = 'inativo', removido_em = NOW(), motivo_remocao = $1, updated_at = NOW()
       WHERE it_id = $2::uuid AND usuario_id = $3 AND status = 'ativo' AND tenant_id = $4`,
      motivo.trim(), itId, usuarioId, tenantId
    );

    // Audit log
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_its_audit_log (
         tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, hash_sha256, created_at
       ) VALUES ($1, $2::uuid, 'PARTICIPANTE', 'REMOVIDO', $3, $4, $5::jsonb, '', NOW())`,
      tenantId, itId, currentUser.id,
      `Remoção de ${a.papel}: ${a.name} — ${motivo.trim()}`,
      JSON.stringify({ acao: 'remover_participante', papel: a.papel, usuarioId, nome: a.name, motivo })
    );

    revalidatePath('/minha-it');
    revalidatePath('/administracao/its');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao remover participante.' };
  }
}

/**
 * Solicita transferência da responsabilidade principal para outro colaborador.
 * O responsável atual ou ADMIN/MASTER pode solicitar.
 * Executa a transferência diretamente (sem aprovação separada pois o solicitante
 * é o responsável atual ou gestão que já tem autoridade).
 * ADMIN/MASTER → transferência imediata.
 * RESPONSAVEL_PRINCIPAL → transferência imediata (conforme fluxo simplificado aprovado).
 */
export async function transferirResponsabilidadeIt(params: {
  itId: string;
  novoResponsavelId: string;
  motivo: string;
  manterComoCorresponsavel?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;
    const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);

    if (!params.motivo?.trim()) return { success: false, error: 'O motivo da transferência é obrigatório.' };

    // Verificar se o executor é o responsável atual ou gestão
    if (!isGestao) {
      const papelAtual = await prisma.$queryRawUnsafe<any[]>(
        `SELECT papel FROM public.fiorix_its_participants
         WHERE it_id = $1::uuid AND usuario_id = $2 AND status = 'ativo' AND papel = 'RESPONSAVEL_PRINCIPAL' AND tenant_id = $3`,
        params.itId, currentUser.id, tenantId
      );
      if (!papelAtual.length) return { success: false, error: 'Apenas o responsável principal ou gestão podem transferir a responsabilidade.' };
    }

    // Verificar se o novo responsável existe
    const novoResp = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, email FROM public."User" WHERE id = $1 LIMIT 1`,
      params.novoResponsavelId
    );
    if (!novoResp.length) return { success: false, error: 'Novo responsável não encontrado.' };

    // Buscar responsável atual para referência
    const respAtualRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT p.id::text, p.usuario_id, u.name FROM public.fiorix_its_participants p
       LEFT JOIN public."User" u ON u.id = p.usuario_id
       WHERE p.it_id = $1::uuid AND p.papel = 'RESPONSAVEL_PRINCIPAL' AND p.status = 'ativo' AND p.tenant_id = $2 LIMIT 1`,
      params.itId, tenantId
    );
    const respAtualId = respAtualRows[0]?.usuario_id;
    const respAtualNome = respAtualRows[0]?.name || 'anterior';

    // 1. Inativar responsável atual
    if (respAtualId) {
      await prisma.$executeRawUnsafe(
        `UPDATE public.fiorix_its_participants
         SET status = 'inativo', removido_em = NOW(), motivo_remocao = $1, updated_at = NOW()
         WHERE it_id = $2::uuid AND usuario_id = $3 AND status = 'ativo' AND tenant_id = $4`,
        `Transferência: ${params.motivo.trim()}`, params.itId, respAtualId, tenantId
      );

      // 2. Se solicitado, adicionar antigo como CORRESPONSAVEL
      if (params.manterComoCorresponsavel && respAtualId !== params.novoResponsavelId) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO public.fiorix_its_participants (tenant_id, it_id, usuario_id, papel, status, incluido_por, created_at, updated_at)
           VALUES ($1, $2::uuid, $3, 'CORRESPONSAVEL', 'ativo', $4, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          tenantId, params.itId, respAtualId, currentUser.id
        );
      }
    }

    // 3. Se o novo já existe como participante, promover
    const existeVinculo = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.fiorix_its_participants WHERE it_id = $1::uuid AND usuario_id = $2 AND status = 'ativo' AND tenant_id = $3`,
      params.itId, params.novoResponsavelId, tenantId
    );
    if (existeVinculo.length) {
      await prisma.$executeRawUnsafe(
        `UPDATE public.fiorix_its_participants
         SET papel = 'RESPONSAVEL_PRINCIPAL', updated_at = NOW()
         WHERE it_id = $1::uuid AND usuario_id = $2 AND tenant_id = $3`,
        params.itId, params.novoResponsavelId, tenantId
      );
    } else {
      // 4. Inserir como novo RESPONSAVEL_PRINCIPAL
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.fiorix_its_participants (tenant_id, it_id, usuario_id, papel, status, incluido_por, created_at, updated_at)
         VALUES ($1, $2::uuid, $3, 'RESPONSAVEL_PRINCIPAL', 'ativo', $4, NOW(), NOW())`,
        tenantId, params.itId, params.novoResponsavelId, currentUser.id
      );
    }

    // Audit log WORM
    const hash = crypto.createHash('sha256').update(
      JSON.stringify({ itId: params.itId, de: respAtualId, para: params.novoResponsavelId, motivo: params.motivo, ts: new Date().toISOString() })
    ).digest('hex');

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_its_audit_log (
         tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, hash_sha256, created_at
       ) VALUES ($1, $2::uuid, 'RESPONSAVEL_PRINCIPAL', $3, $4, $5, $6::jsonb, $7, NOW())`,
      tenantId, params.itId,
      `TRANSFERIDO_PARA_${novoResp[0].name}`,
      currentUser.id,
      `Transferência de responsabilidade: ${params.motivo.trim()}`,
      JSON.stringify({ acao: 'transferencia_responsabilidade', de: { id: respAtualId, nome: respAtualNome }, para: { id: params.novoResponsavelId, nome: novoResp[0].name }, motivo: params.motivo, manterComoCorresponsavel: params.manterComoCorresponsavel }),
      hash
    );

    revalidatePath('/minha-it');
    revalidatePath('/administracao/its');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao transferir responsabilidade.' };
  }
}

/**
 * Bloqueia edição de uma IT (evita edição simultânea).
 * Só o autor do bloqueio, ADMIN ou MASTER pode liberar.
 */
export async function bloquearEdicaoIt(itId: string): Promise<{ success: boolean; error?: string; bloqueadoPor?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;

    // Verificar se já está bloqueada por outra pessoa
    const itRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT editando_por_id, editando_desde,
         (SELECT name FROM public."User" WHERE id = editando_por_id) as editando_nome
       FROM public.fiorix_its
       WHERE id = $1::uuid AND tenant_id = $2 LIMIT 1`,
      itId, tenantId
    );
    if (!itRows.length) return { success: false, error: 'IT não encontrada.' };
    const it = itRows[0];

    if (it.editando_por_id && it.editando_por_id !== currentUser.id) {
      const desde = it.editando_desde ? new Date(it.editando_desde).toLocaleString('pt-BR') : '';
      return {
        success: false,
        bloqueadoPor: it.editando_nome,
        error: `Atualização em andamento por ${it.editando_nome} desde ${desde}.`,
      };
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its SET editando_por_id = $1, editando_desde = NOW(), updated_at = NOW()
       WHERE id = $2::uuid AND tenant_id = $3`,
      currentUser.id, itId, tenantId
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao bloquear edição.' };
  }
}

/**
 * Libera bloqueio de edição de uma IT.
 * ADMIN/MASTER podem liberar qualquer bloqueio (com motivo).
 */
export async function liberarEdicaoIt(
  itId: string,
  motivo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;
    const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);

    const itRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT editando_por_id FROM public.fiorix_its WHERE id = $1::uuid AND tenant_id = $2 LIMIT 1`,
      itId, tenantId
    );
    if (!itRows.length) return { success: false, error: 'IT não encontrada.' };

    const bloqueadoPor = itRows[0].editando_por_id;
    if (bloqueadoPor && bloqueadoPor !== currentUser.id && !isGestao) {
      return { success: false, error: 'Apenas o editor atual ou gestão pode liberar a edição.' };
    }

    // Se gestão libera edição de outra pessoa, registrar no audit
    if (bloqueadoPor && bloqueadoPor !== currentUser.id && isGestao) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.fiorix_its_audit_log (tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, hash_sha256, created_at)
         VALUES ($1, $2::uuid, 'EDICAO_BLOQUEADA', 'EDICAO_LIBERADA', $3, $4, $5::jsonb, '', NOW())`,
        tenantId, itId, currentUser.id,
        `Edição liberada por gestão: ${motivo || 'sem motivo'}`,
        JSON.stringify({ acao: 'liberar_edicao_forcado', editandoPor: bloqueadoPor, motivo })
      );
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its SET editando_por_id = NULL, editando_desde = NULL, updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2`,
      itId, tenantId
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao liberar edição.' };
  }
}

/**
 * Busca usuários disponíveis para adicionar como participantes.
 * Filtra por tenant + ativos + ainda não vinculados à IT.
 */
export async function buscarColaboradoresParaVincular(
  itId: string,
  termo: string,
  setorFiltro?: string
): Promise<{
  success: boolean;
  usuarios?: Array<{ id: string; nome: string; email: string; departamento: string; cargo: string; mesmoSetor: boolean }>;
  setoresDisponiveis?: string[];
  error?: string;
}> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;

    // Pegar departamento da IT
    const itRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT departamento FROM public.fiorix_its WHERE id = $1::uuid AND tenant_id = $2 LIMIT 1`,
      itId, tenantId
    );
    const itDepto = (itRows[0]?.departamento || '').trim().toLowerCase();

    // Buscar lista de todos os setores/departamentos disponíveis no cartório
    const deptRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT departamento FROM public."User"
       WHERE "tenantId" = $1 AND departamento IS NOT NULL AND departamento != ''
       ORDER BY departamento ASC`,
      tenantId
    );
    const setoresDisponiveis = deptRows.map(d => String(d.departamento));

    let querySetor = '';
    const queryParams: any[] = [tenantId, currentUser.id, `%${termo || ''}%`, itId, itDepto];

    if (setorFiltro && setorFiltro !== 'TODOS') {
      queryParams.push(setorFiltro);
      querySetor = `AND LOWER(u.departamento) = LOWER($${queryParams.length})`;
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT u.id, u.name, u.email, u.departamento, u.cargo
       FROM public."User" u
       WHERE u."tenantId" = $1
         AND u.id != $2
         AND (
           $3 = '%%'
           OR LOWER(u.name) LIKE LOWER($3)
           OR LOWER(u.email) LIKE LOWER($3)
           OR LOWER(COALESCE(u.cargo, '')) LIKE LOWER($3)
           OR LOWER(COALESCE(u.departamento, '')) LIKE LOWER($3)
         )
         ${querySetor}
         AND u.id NOT IN (
           SELECT usuario_id FROM public.fiorix_its_participants
           WHERE it_id = $4::uuid AND status = 'ativo'
         )
         AND u.id NOT IN (
           SELECT COALESCE(responsavel_tecnico_id, '') FROM public.fiorix_its
           WHERE id = $4::uuid
         )
       ORDER BY 
         (CASE WHEN LOWER(COALESCE(u.departamento, '')) = LOWER($5) THEN 0 ELSE 1 END) ASC,
         u.name ASC
       LIMIT 50`,
      ...queryParams
    );

    return {
      success: true,
      setoresDisponiveis,
      usuarios: rows.map(u => ({
        id: u.id,
        nome: u.name || '',
        email: u.email || '',
        departamento: u.departamento || '',
        cargo: u.cargo || '',
        mesmoSetor: (u.departamento || '').trim().toLowerCase() === itDepto,
      })),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao buscar colaboradores.' };
  }
}

/**
 * Retorna todos os participantes ativos de uma IT para a view de "Gerenciar equipe".
 * Inclui todos os papéis. Operações de desvinculação são restritas no servidor
 * a papéis diferentes de RESPONSAVEL_PRINCIPAL.
 */
export async function getEquipeLeitorIt(itId: string): Promise<{
  success: boolean;
  membros?: Array<{
    id: string;
    usuarioId: string;
    nome: string;
    email: string;
    departamento: string;
    cargo: string;
    papel: PapelNaIt;
    vinculadoEm: string;
  }>;
  error?: string;
}> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         p.id::text,
         p.usuario_id as "usuarioId",
         p.papel,
         p.created_at as "vinculadoEm",
         u.name,
         u.email,
         u.departamento,
         u.cargo
       FROM public.fiorix_its_participants p
       LEFT JOIN public."User" u ON u.id = p.usuario_id
       WHERE p.it_id = $1::uuid
         AND p.tenant_id = $2
         AND p.status = 'ativo'
       ORDER BY
         CASE p.papel WHEN 'RESPONSAVEL_PRINCIPAL' THEN 0 WHEN 'CORRESPONSAVEL' THEN 1 ELSE 2 END,
         p.created_at ASC`,
      itId, tenantId
    );

    return {
      success: true,
      membros: rows.map(r => ({
        id: r.id,
        usuarioId: r.usuarioId,
        nome: r.name || 'Usuário',
        email: r.email || '',
        departamento: r.departamento || '',
        cargo: r.cargo || '',
        papel: r.papel as PapelNaIt,
        vinculadoEm: new Date(r.vinculadoEm).toLocaleDateString('pt-BR'),
      })),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao carregar equipe.' };
  }
}

// ═══════════════════════════════════════════════════════════════
// FASE 3 — PROPOSTAS DE ATUALIZAÇÃO (CORRESPONSÁVEL)
// ═══════════════════════════════════════════════════════════════

export interface ItProposta {
  id: string;
  itId: string;
  itCodigo: string;
  itTitulo: string;
  autorId: string;
  autorNome: string;
  autorDepartamento: string;
  motivo: string;
  resumo: string;
  pdfUrl: string | null;
  observacoes: string | null;
  status: 'pendente' | 'aceita' | 'recusada' | 'esclarecimento' | 'cancelada';
  respondidoPor: string | null;
  resposta: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/** Helper interno — cria notificação sem expor ao cliente diretamente. */
async function criarNotificacaoInterna(params: {
  tenantId: string;
  usuarioId: string;
  tipo: string;
  titulo: string;
  mensagem?: string;
  referenciaId?: string | null;
  referenciaTipo?: string | null;
}): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_notificacoes (tenant_id, usuario_id, tipo, titulo, mensagem, referencia_id, referencia_tipo, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      params.tenantId, params.usuarioId, params.tipo, params.titulo,
      params.mensagem || null,
      params.referenciaId || null,
      params.referenciaTipo || null
    );
  } catch {
    // Silencioso — notificação não deve bloquear a ação principal
  }
}

/**
 * Corresponsável (ou responsável principal) cria uma proposta de atualização para a IT.
 * Não publica nem substitui a versão vigente automaticamente.
 */
export async function criarPropostaAtualizacao(params: {
  itId: string;
  motivo: string;
  resumo: string;
  pdfUrl?: string;
  pdfPath?: string;
  observacoes?: string;
}): Promise<{ success: boolean; propostaId?: string; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;

    if (!params.motivo?.trim()) return { success: false, error: 'O motivo é obrigatório.' };
    if (!params.resumo?.trim()) return { success: false, error: 'O resumo da sugestão é obrigatório.' };

    // Verificar participação ativa na IT
    const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);
    if (!isGestao) {
      const papelRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT papel FROM public.fiorix_its_participants
         WHERE it_id = $1::uuid AND usuario_id = $2 AND status = 'ativo' AND tenant_id = $3 LIMIT 1`,
        params.itId, currentUser.id, tenantId
      );
      if (!papelRows.length) return { success: false, error: 'Você não é participante desta IT.' };
      if (papelRows[0].papel === 'LEITOR') return { success: false, error: 'Leitores não podem propor atualizações.' };
    }

    // Buscar IT e responsável principal para notificação
    const itRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT i.id::text, i.codigo, i.titulo,
         p.usuario_id as resp_id
       FROM public.fiorix_its i
       LEFT JOIN public.fiorix_its_participants p ON p.it_id = i.id
         AND p.papel = 'RESPONSAVEL_PRINCIPAL' AND p.status = 'ativo' AND p.tenant_id = $2
       WHERE i.id = $1::uuid AND i.tenant_id = $2 AND i.deleted_at IS NULL LIMIT 1`,
      params.itId, tenantId
    );
    if (!itRows.length) return { success: false, error: 'IT não encontrada.' };
    const it = itRows[0];

    // Criar proposta
    const result = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO public.fiorix_its_propostas (
         tenant_id, it_id, autor_id, motivo, resumo, pdf_url, pdf_path, observacoes, status, created_at, updated_at
       ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, 'pendente', NOW(), NOW())
       RETURNING id::text`,
      tenantId, params.itId, currentUser.id,
      params.motivo.trim(), params.resumo.trim(),
      params.pdfUrl || null, params.pdfPath || null,
      params.observacoes?.trim() || null
    );
    const propostaId = result[0]?.id;

    // Notificar responsável principal
    if (it.resp_id && it.resp_id !== currentUser.id) {
      await criarNotificacaoInterna({
        tenantId, usuarioId: it.resp_id,
        tipo: 'NOVA_PROPOSTA_ATUALIZACAO',
        titulo: 'Nova proposta de atualização',
        mensagem: `${currentUser.name || 'Um corresponsável'} propôs uma atualização para "${it.titulo}": ${params.resumo.trim().substring(0, 120)}`,
        referenciaId: propostaId,
        referenciaTipo: 'PROPOSTA',
      });
    }

    // Audit log
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_its_audit_log (tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, hash_sha256, created_at)
       VALUES ($1, $2::uuid, 'PROPOSTA', 'CRIADA', $3, $4, $5::jsonb, '', NOW())`,
      tenantId, params.itId, currentUser.id,
      `Proposta de atualização criada por ${currentUser.name || currentUser.id}`,
      JSON.stringify({ propostaId, motivo: params.motivo, resumo: params.resumo })
    );

    revalidatePath('/minha-it');
    return { success: true, propostaId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao criar proposta.' };
  }
}

/**
 * Responsável principal (ou ADMIN/MASTER) responde a uma proposta.
 * Aceitar NÃO publica automaticamente — o responsável deve criar nova versão manualmente.
 */
export async function responderPropostaAtualizacao(params: {
  propostaId: string;
  acao: 'aceita' | 'recusada' | 'esclarecimento';
  resposta: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;
    const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);

    if (!params.resposta?.trim()) return { success: false, error: 'A resposta é obrigatória.' };

    const propRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT p.id::text, p.it_id::text, p.autor_id, p.status,
         i.titulo as it_titulo,
         part.usuario_id as resp_id
       FROM public.fiorix_its_propostas p
       JOIN public.fiorix_its i ON i.id = p.it_id
       LEFT JOIN public.fiorix_its_participants part ON part.it_id = p.it_id
         AND part.papel = 'RESPONSAVEL_PRINCIPAL' AND part.status = 'ativo' AND part.tenant_id = $2
       WHERE p.id = $1::uuid AND p.tenant_id = $2 LIMIT 1`,
      params.propostaId, tenantId
    );
    if (!propRows.length) return { success: false, error: 'Proposta não encontrada.' };
    const prop = propRows[0];

    if (prop.status !== 'pendente' && prop.status !== 'esclarecimento') {
      return { success: false, error: `Esta proposta já foi ${prop.status}.` };
    }
    if (!isGestao && prop.resp_id !== currentUser.id) {
      return { success: false, error: 'Apenas o responsável principal ou gestão pode responder propostas.' };
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its_propostas
       SET status = $1, respondido_por = $2, resposta = $3, updated_at = NOW()
       WHERE id = $4::uuid AND tenant_id = $5`,
      params.acao, currentUser.id, params.resposta.trim(), params.propostaId, tenantId
    );

    // Notificar autor
    const acaoLabel = { aceita: 'aceita ✅', recusada: 'recusada ❌', esclarecimento: 'devolvida para esclarecimento 💬' }[params.acao];
    await criarNotificacaoInterna({
      tenantId, usuarioId: prop.autor_id,
      tipo: `PROPOSTA_${params.acao.toUpperCase()}`,
      titulo: `Proposta ${acaoLabel}`,
      mensagem: `Sua proposta para "${prop.it_titulo}" foi ${acaoLabel}. Resposta: ${params.resposta.trim().substring(0, 150)}`,
      referenciaId: params.propostaId,
      referenciaTipo: 'PROPOSTA',
    });

    // Audit log
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_its_audit_log (tenant_id, it_id, versao_anterior, versao_nova, autor_id, motivo, diff_snapshot, hash_sha256, created_at)
       VALUES ($1, $2::uuid, 'PROPOSTA_PENDENTE', $3, $4, $5, $6::jsonb, '', NOW())`,
      tenantId, prop.it_id,
      `PROPOSTA_${params.acao.toUpperCase()}`,
      currentUser.id,
      `Proposta ${params.acao} por ${currentUser.name}: ${params.resposta.trim().substring(0, 200)}`,
      JSON.stringify({ propostaId: params.propostaId, acao: params.acao, resposta: params.resposta })
    );

    revalidatePath('/minha-it');
    revalidatePath('/administracao/its');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao responder proposta.' };
  }
}

/**
 * Cancela uma proposta pendente (autor ou gestão).
 */
export async function cancelarProposta(
  propostaId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;
    const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT autor_id, status FROM public.fiorix_its_propostas WHERE id = $1::uuid AND tenant_id = $2 LIMIT 1`,
      propostaId, tenantId
    );
    if (!rows.length) return { success: false, error: 'Proposta não encontrada.' };
    const p = rows[0];
    if (p.status !== 'pendente' && p.status !== 'esclarecimento') {
      return { success: false, error: 'Apenas propostas pendentes podem ser canceladas.' };
    }
    if (p.autor_id !== currentUser.id && !isGestao) {
      return { success: false, error: 'Apenas o autor ou gestão pode cancelar esta proposta.' };
    }

    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its_propostas SET status = 'cancelada', updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2`,
      propostaId, tenantId
    );

    revalidatePath('/minha-it');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao cancelar proposta.' };
  }
}

/**
 * Lista propostas de uma IT específica.
 */
export async function getPropostasIt(
  itId: string
): Promise<{ success: boolean; propostas?: ItProposta[]; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT p.id::text, p.it_id::text as "itId",
         i.codigo as "itCodigo", i.titulo as "itTitulo",
         p.autor_id as "autorId", u.name as "autorNome",
         COALESCE(u.departamento, '') as "autorDepartamento",
         p.motivo, p.resumo, p.pdf_url as "pdfUrl", p.observacoes, p.status,
         p.respondido_por as "respondidoPor", p.resposta,
         p.created_at as "criadoEm", p.updated_at as "atualizadoEm"
       FROM public.fiorix_its_propostas p
       JOIN public.fiorix_its i ON i.id = p.it_id
       LEFT JOIN public."User" u ON u.id = p.autor_id
       WHERE p.it_id = $1::uuid AND p.tenant_id = $2
       ORDER BY p.created_at DESC LIMIT 50`,
      itId, tenantId
    );

    return {
      success: true,
      propostas: rows.map(r => ({
        ...r,
        criadoEm: new Date(r.criadoEm).toLocaleDateString('pt-BR'),
        atualizadoEm: new Date(r.atualizadoEm).toLocaleDateString('pt-BR'),
      })),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao listar propostas.' };
  }
}

/**
 * Propostas pendentes onde o usuário logado é responsável principal.
 */
export async function getMinhasPropostasPendentes(): Promise<{ success: boolean; propostas?: ItProposta[]; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT p.id::text, p.it_id::text as "itId",
         i.codigo as "itCodigo", i.titulo as "itTitulo",
         p.autor_id as "autorId", u.name as "autorNome",
         COALESCE(u.departamento, '') as "autorDepartamento",
         p.motivo, p.resumo, p.pdf_url as "pdfUrl", p.observacoes, p.status,
         p.respondido_por as "respondidoPor", p.resposta,
         p.created_at as "criadoEm", p.updated_at as "atualizadoEm"
       FROM public.fiorix_its_propostas p
       JOIN public.fiorix_its i ON i.id = p.it_id
       JOIN public.fiorix_its_participants part ON part.it_id = p.it_id
         AND part.usuario_id = $1 AND part.papel = 'RESPONSAVEL_PRINCIPAL'
         AND part.status = 'ativo' AND part.tenant_id = $2
       LEFT JOIN public."User" u ON u.id = p.autor_id
       WHERE p.tenant_id = $2 AND p.status IN ('pendente', 'esclarecimento')
       ORDER BY p.created_at DESC`,
      currentUser.id, tenantId
    );

    return {
      success: true,
      propostas: rows.map(r => ({
        ...r,
        criadoEm: new Date(r.criadoEm).toLocaleDateString('pt-BR'),
        atualizadoEm: new Date(r.atualizadoEm).toLocaleDateString('pt-BR'),
      })),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao buscar propostas pendentes.' };
  }
}

// ═══════════════════════════════════════════════════════════════
// FASE 4 — NOTIFICAÇÕES INTERNAS
// ═══════════════════════════════════════════════════════════════

export interface FiorixNotificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  lida: boolean;
  referenciaId: string | null;
  referenciaTipo: string | null;
  criadoEm: string;
}

/**
 * Busca notificações do usuário logado.
 */
export async function getNotificacoesUsuario(
  apenasNaoLidas = false
): Promise<{ success: boolean; notificacoes?: FiorixNotificacao[]; naoLidas?: number; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;

    const filtro = apenasNaoLidas ? 'AND lida = false' : '';

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id::text, tipo, titulo, mensagem, lida,
         referencia_id::text as "referenciaId", referencia_tipo as "referenciaTipo",
         created_at as "criadoEm"
       FROM public.fiorix_notificacoes
       WHERE usuario_id = $1 AND tenant_id = $2 ${filtro}
       ORDER BY created_at DESC LIMIT 50`,
      currentUser.id, tenantId
    );

    const naoLidas = rows.filter(r => !r.lida).length;

    return {
      success: true,
      naoLidas,
      notificacoes: rows.map(r => ({
        ...r,
        criadoEm: new Date(r.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
      })),
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao buscar notificações.' };
  }
}

/**
 * Marca uma notificação como lida.
 */
export async function marcarNotificacaoLida(
  notificacaoId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_notificacoes SET lida = true WHERE id = $1::uuid AND usuario_id = $2`,
      notificacaoId, currentUser.id
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Marca todas as notificações do usuário como lidas.
 */
export async function marcarTodasNotificacoesLidas(): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await requireAuth();
    const tenantId = currentUser.tenantId;
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_notificacoes SET lida = true WHERE usuario_id = $1 AND tenant_id = $2 AND lida = false`,
      currentUser.id, tenantId
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

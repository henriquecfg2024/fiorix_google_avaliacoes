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

'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import {
  CadastroSessao,
  CADASTRO_SESSOES_COMPLETO,
  converterCaminhoUncLocal,
} from '@/lib/documental/sessoes';

export type { CadastroSessao };

let tableInitialized = false;

export async function ensureSessoesTable() {
  if (tableInitialized) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_documental_sessoes (
      id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      grupo TEXT NOT NULL DEFAULT 'Sessões sem Grupo',
      descricao TEXT,
      sequencia INTEGER NOT NULL DEFAULT 0,
      padrao_localizacao TEXT NOT NULL DEFAULT 'milhar',
      caminho_unc TEXT NOT NULL,
      pasta_local TEXT,
      confidencial BOOLEAN NOT NULL DEFAULT false,
      alias TEXT[] DEFAULT '{}',
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fiorix_documental_sessoes_pkey PRIMARY KEY (tenant_id, id)
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_fiorix_sessoes_tenant_seq 
    ON public.fiorix_documental_sessoes (tenant_id, sequencia ASC, nome ASC);
  `);

  tableInitialized = true;
}

/**
 * Busca todas as sessões configuradas para o tenant.
 * Acesso exclusivo por MASTER e ADMIN.
 * Se o tenant ainda não tiver sessões salvas no banco, inicializa com o cadastro padrão de 44 sessões Siplan.
 */
export async function getSessoesConfig(): Promise<CadastroSessao[]> {
  const currentUser = await requireRole('ADMIN', 'MASTER');
  const tenantId = currentUser.tenantId;

  await ensureSessoesTable();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       id,
       nome,
       grupo,
       descricao,
       sequencia,
       padrao_localizacao as "padraoLocalizacao",
       caminho_unc as "caminhoUnc",
       pasta_local as "pastaLocal",
       confidencial,
       alias
     FROM public.fiorix_documental_sessoes
     WHERE tenant_id = $1
     ORDER BY sequencia ASC, nome ASC`,
    tenantId
  );

  // Se o tenant ainda não tiver registros no banco, popula inicialmente com o catálogo padrão do Siplan
  if (rows.length === 0) {
    try {
      for (const sessao of CADASTRO_SESSOES_COMPLETO) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO public.fiorix_documental_sessoes (
             id, tenant_id, nome, grupo, descricao, sequencia,
             padrao_localizacao, caminho_unc, pasta_local, confidencial, alias,
             created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
           ) ON CONFLICT (tenant_id, id) DO NOTHING`,
          sessao.id,
          tenantId,
          sessao.nome,
          sessao.grupo || 'Sessões sem Grupo',
          sessao.descricao || '',
          sessao.sequencia || 0,
          sessao.padraoLocalizacao || 'milhar',
          sessao.caminhoUnc,
          sessao.pastaLocal || converterCaminhoUncLocal(sessao.caminhoUnc, false),
          sessao.confidencial || false,
          sessao.alias || []
        );
      }

      // Retorna o catálogo padrão
      return CADASTRO_SESSOES_COMPLETO;
    } catch (err) {
      console.warn('Aviso ao inicializar sessões no banco para o tenant:', err);
      return CADASTRO_SESSOES_COMPLETO;
    }
  }

  return rows.map((r) => ({
    id: String(r.id),
    nome: String(r.nome),
    grupo: (r.grupo || 'Sessões sem Grupo') as 'Sessões sem Grupo',
    descricao: String(r.descricao || ''),
    sequencia: Number(r.sequencia || 0),
    padraoLocalizacao: (r.padraoLocalizacao || 'milhar') as any,
    caminhoUnc: String(r.caminhoUnc),
    pastaLocal: String(r.pastaLocal || converterCaminhoUncLocal(r.caminhoUnc, false)),
    confidencial: Boolean(r.confidencial),
    alias: Array.isArray(r.alias) ? r.alias : [],
  }));
}

export interface SalvarSessaoInput {
  id?: string;
  nome: string;
  grupo?: string;
  descricao?: string;
  sequencia?: number;
  padraoLocalizacao: 'milhar' | 'tomo' | 'protocolo' | 'processo' | 'direto';
  caminhoUnc: string;
  pastaLocal?: string;
  confidencial?: boolean;
  alias?: string[];
}

/**
 * Cria ou atualiza uma sessão no catálogo do tenant.
 * Acesso exclusivo por MASTER e ADMIN.
 */
export async function salvarSessao(dados: SalvarSessaoInput) {
  const currentUser = await requireRole('ADMIN', 'MASTER');
  const tenantId = currentUser.tenantId;

  await ensureSessoesTable();

  const nomeLimpo = dados.nome.trim();
  if (!nomeLimpo) {
    throw new Error('O Nome da Sessão é obrigatório.');
  }

  const caminhoUncLimpo = dados.caminhoUnc.trim();
  if (!caminhoUncLimpo) {
    throw new Error('O Local das Imagens (Caminho UNC) é obrigatório.');
  }

  // Se id não foi fornecido, gera a partir do nome
  const sessaoId = (dados.id || nomeLimpo)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 50);

  const pastaLocal = dados.pastaLocal?.trim() || converterCaminhoUncLocal(caminhoUncLimpo, false);
  const grupo = dados.grupo?.trim() || 'Sessões sem Grupo';
  const descricao = dados.descricao?.trim() || nomeLimpo;
  const sequencia = typeof dados.sequencia === 'number' ? dados.sequencia : 0;
  const padraoLocalizacao = dados.padraoLocalizacao || 'milhar';
  const confidencial = Boolean(dados.confidencial);
  const alias = dados.alias || [];

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fiorix_documental_sessoes (
       id, tenant_id, nome, grupo, descricao, sequencia,
       padrao_localizacao, caminho_unc, pasta_local, confidencial, alias,
       created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
     )
     ON CONFLICT (tenant_id, id) DO UPDATE SET
       nome = EXCLUDED.nome,
       grupo = EXCLUDED.grupo,
       descricao = EXCLUDED.descricao,
       sequencia = EXCLUDED.sequencia,
       padrao_localizacao = EXCLUDED.padrao_localizacao,
       caminho_unc = EXCLUDED.caminho_unc,
       pasta_local = EXCLUDED.pasta_local,
       confidencial = EXCLUDED.confidencial,
       alias = EXCLUDED.alias,
       updated_at = NOW()`,
    sessaoId,
    tenantId,
    nomeLimpo,
    grupo,
    descricao,
    sequencia,
    padraoLocalizacao,
    caminhoUncLimpo,
    pastaLocal,
    confidencial,
    alias
  );

  revalidatePath('/configuracoes/sessoes');
  revalidatePath('/configuracoes');
  revalidatePath('/gestao-documental');
  revalidatePath('/gestao-documental/visualizador');
  revalidatePath('/gestao-documental/visualizador-janela');

  return { success: true, id: sessaoId };
}

/**
 * Exclui uma sessão do catálogo do tenant.
 * Acesso exclusivo por MASTER e ADMIN.
 */
export async function excluirSessao(sessaoId: string) {
  const currentUser = await requireRole('ADMIN', 'MASTER');
  const tenantId = currentUser.tenantId;

  await ensureSessoesTable();

  await prisma.$executeRawUnsafe(
    `DELETE FROM public.fiorix_documental_sessoes WHERE tenant_id = $1 AND id = $2`,
    tenantId,
    sessaoId
  );

  revalidatePath('/configuracoes/sessoes');
  revalidatePath('/configuracoes');
  revalidatePath('/gestao-documental');
  revalidatePath('/gestao-documental/visualizador');
  revalidatePath('/gestao-documental/visualizador-janela');

  return { success: true };
}

/**
 * Restaura todas as 44 sessões padrão do Siplan para o tenant atual.
 */
export async function restaurarSessoesPadrao() {
  const currentUser = await requireRole('ADMIN', 'MASTER');
  const tenantId = currentUser.tenantId;

  await ensureSessoesTable();

  for (const sessao of CADASTRO_SESSOES_COMPLETO) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_documental_sessoes (
         id, tenant_id, nome, grupo, descricao, sequencia,
         padrao_localizacao, caminho_unc, pasta_local, confidencial, alias,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
       )
       ON CONFLICT (tenant_id, id) DO UPDATE SET
         nome = EXCLUDED.nome,
         grupo = EXCLUDED.grupo,
         descricao = EXCLUDED.descricao,
         sequencia = EXCLUDED.sequencia,
         padrao_localizacao = EXCLUDED.padrao_localizacao,
         caminho_unc = EXCLUDED.caminho_unc,
         pasta_local = EXCLUDED.pasta_local,
         confidencial = EXCLUDED.confidencial,
         alias = EXCLUDED.alias,
         updated_at = NOW()`,
      sessao.id,
      tenantId,
      sessao.nome,
      sessao.grupo || 'Sessões sem Grupo',
      sessao.descricao || '',
      sessao.sequencia || 0,
      sessao.padraoLocalizacao || 'milhar',
      sessao.caminhoUnc,
      sessao.pastaLocal || converterCaminhoUncLocal(sessao.caminhoUnc, false),
      sessao.confidencial || false,
      sessao.alias || []
    );
  }

  revalidatePath('/configuracoes/sessoes');
  revalidatePath('/configuracoes');
  revalidatePath('/gestao-documental');
  revalidatePath('/gestao-documental/visualizador');
  revalidatePath('/gestao-documental/visualizador-janela');

  return { success: true, total: CADASTRO_SESSOES_COMPLETO.length };
}

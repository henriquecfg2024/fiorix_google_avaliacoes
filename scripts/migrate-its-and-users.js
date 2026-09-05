const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigrations() {
  console.log('--- Iniciando Migração Módulo 4 & Usuários ---');

  const statements = [
    // 1. Campos extras na tabela "User"
    `ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS cpf TEXT;`,
    `ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS departamento TEXT DEFAULT 'Atendimento';`,
    `ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS cargo TEXT;`,
    `ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS ramal TEXT;`,
    `ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS pode_ser_tutor BOOLEAN DEFAULT false;`,
    `ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_cpf ON public."User"(cpf) WHERE cpf IS NOT NULL;`,

    // 2. Tabela fiorix_its
    `CREATE TABLE IF NOT EXISTS public.fiorix_its (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      codigo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      departamento TEXT NOT NULL,
      versao TEXT DEFAULT '1.0',
      vigencia DATE DEFAULT CURRENT_DATE,
      status TEXT DEFAULT 'ativa',
      objetivo TEXT,
      quando_usar TEXT,
      responsavel_raci JSONB,
      passo_a_passo JSONB DEFAULT '[]',
      checklist JSONB DEFAULT '[]',
      erros_comuns JSONB DEFAULT '[]',
      video_url TEXT,
      tempo_leitura_min INT DEFAULT 5,
      tutor_id TEXT,
      autor_id TEXT,
      aprovador_id TEXT,
      anexos JSONB DEFAULT '[]',
      tags TEXT[] DEFAULT '{}',
      visualizacoes INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      hash_versao TEXT,
      CONSTRAINT uq_its_tenant_codigo UNIQUE (tenant_id, codigo)
    );`,

    // 3. Tabela fiorix_its_versoes
    `CREATE TABLE IF NOT EXISTS public.fiorix_its_versoes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      it_id UUID REFERENCES public.fiorix_its(id) ON DELETE CASCADE,
      versao TEXT NOT NULL,
      conteudo_snapshot JSONB NOT NULL,
      alteracoes TEXT,
      autor_id TEXT,
      hash_versao TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 4. Tabela fiorix_its_aceites
    `CREATE TABLE IF NOT EXISTS public.fiorix_its_aceites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      departamento TEXT NOT NULL,
      mes INT,
      ano INT,
      tipo TEXT DEFAULT 'mensal',
      its_revisadas UUID[] DEFAULT '{}',
      declaracao TEXT DEFAULT 'Declaro que revisei e minhas ITs estão atualizadas conforme o padrão interno',
      hash_aceite TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, usuario_id, departamento, mes, ano, tipo)
    );`,

    // 5. Tabela fiorix_its_solicitacoes
    `CREATE TABLE IF NOT EXISTS public.fiorix_its_solicitacoes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      solicitante_id TEXT NOT NULL,
      departamento_destino TEXT NOT NULL,
      it_id UUID REFERENCES public.fiorix_its(id),
      motivo TEXT NOT NULL,
      urgencia TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pendente',
      aprovado_por TEXT,
      motivo_reprovacao TEXT,
      dias_liberacao INT DEFAULT 7,
      data_aprovacao TIMESTAMPTZ,
      data_expiracao DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 6. Tabela fiorix_trilhas_estudo
    `CREATE TABLE IF NOT EXISTS public.fiorix_trilhas_estudo (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      it_id UUID REFERENCES public.fiorix_its(id),
      solicitacao_id UUID REFERENCES public.fiorix_its_solicitacoes(id),
      status TEXT DEFAULT 'leitura',
      progresso_leitura INT DEFAULT 0,
      progresso_quiz INT DEFAULT 0,
      nota_quiz INT,
      tentativas_quiz INT DEFAULT 0,
      tutor_id TEXT,
      data_agendamento_sombra TIMESTAMPTZ,
      feedback_tutor TEXT,
      selo_apto BOOLEAN DEFAULT false,
      hash_conclusao TEXT,
      data_conclusao TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`,

    // 7. Tabela fiorix_matriz_polivalencia
    `CREATE TABLE IF NOT EXISTS public.fiorix_matriz_polivalencia (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      usuario_id TEXT NOT NULL,
      it_id UUID REFERENCES public.fiorix_its(id),
      nivel INT DEFAULT 0 CHECK (nivel BETWEEN 0 AND 4),
      avaliado_por TEXT,
      data_avaliacao DATE DEFAULT CURRENT_DATE,
      observacao TEXT,
      UNIQUE(tenant_id, usuario_id, it_id)
    );`,
  ];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`[${i + 1}/${statements.length}] Sucesso`);
    } catch (err) {
      console.error(`[${i + 1}/${statements.length}] Erro ao executar:`, err.message);
    }
  }

  console.log('--- Migração concluída com sucesso! ---');
}

runMigrations()
  .catch((e) => {
    console.error('Erro fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

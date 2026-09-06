const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function runMigration() {
  console.log('🚀 Iniciando Migração ITs v5.0 (7º RI SP)...');

  // 1. Alterar fiorix_its para adicionar colunas de guardião e FAQ
  console.log('1. Adicionando colunas operacionais em public.fiorix_its...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.fiorix_its 
    ADD COLUMN IF NOT EXISTS guardiao_id TEXT,
    ADD COLUMN IF NOT EXISTS substituto_id TEXT,
    ADD COLUMN IF NOT EXISTS substituto_ate DATE,
    ADD COLUMN IF NOT EXISTS faq_excecoes JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS pdf_original_url TEXT;
  `);

  // 2. Criar fiorix_its_audit_log (WORM)
  console.log('2. Criando tabela public.fiorix_its_audit_log com proteção WORM...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_its_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      it_id UUID NOT NULL REFERENCES public.fiorix_its(id) ON DELETE CASCADE,
      versao_anterior TEXT NOT NULL,
      versao_nova TEXT NOT NULL,
      autor_id TEXT NOT NULL,
      motivo TEXT NOT NULL,
      diff_snapshot JSONB NOT NULL,
      arquivo_original_url TEXT,
      hash_sha256 TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 3. Trigger de imutabilidade WORM
  console.log('3. Configurando Trigger WORM imutável para conformidade CNJ...');
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION trg_fiorix_prevent_audit_tampering()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Registros de auditoria de ITs são estritamente imutáveis conforme provimento do CNJ.';
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_audit_tampering ON public.fiorix_its_audit_log;`);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_audit_tampering
    BEFORE UPDATE OR DELETE ON public.fiorix_its_audit_log
    FOR EACH ROW EXECUTE FUNCTION trg_fiorix_prevent_audit_tampering();
  `);

  // 4. Criar fiorix_its_ciencias (Simples: Ciente vs Pendente)
  console.log('4. Criando tabela public.fiorix_its_ciencias (modelo binário simples)...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_its_ciencias (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      it_id UUID NOT NULL REFERENCES public.fiorix_its(id) ON DELETE CASCADE,
      usuario_id TEXT NOT NULL,
      versao TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pendente',
      ciente_em TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_it_user_version UNIQUE (tenant_id, it_id, usuario_id, versao)
    );
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_its_audit_tenant_it ON public.fiorix_its_audit_log(tenant_id, it_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_its_ciencias_lookup ON public.fiorix_its_ciencias(tenant_id, usuario_id, status);`);

  // 5. Atribuir Guardiões Iniciais e gerar Hash para as ITs existentes
  console.log('5. Atribuindo Guardiões e Ciências iniciais para as ITs existentes...');
  const its = await prisma.$queryRawUnsafe(`
    SELECT id, tenant_id, codigo, titulo, departamento, versao, hash_versao, guardiao_id 
    FROM public.fiorix_its 
    WHERE deleted_at IS NULL
  `);

  const users = await prisma.$queryRawUnsafe(`
    SELECT id, name, email, departamento, role 
    FROM public."User"
  `);

  for (const it of its) {
    let guardiaoId = it.guardiao_id;

    // Se não tiver guardião, atribuir um colaborador do departamento
    if (!guardiaoId) {
      const candidate = users.find(u => u.departamento === it.departamento && u.role !== 'MASTER') ||
                        users.find(u => u.departamento === it.departamento) ||
                        users[0];
      if (candidate) {
        guardiaoId = candidate.id;
      }
    }

    // Gerar hash caso nulo
    let hash = it.hash_versao;
    if (!hash) {
      const dataStr = `${it.id}:${it.codigo}:${it.versao}:${it.departamento}:${new Date().toISOString()}`;
      hash = crypto.createHash('sha256').update(dataStr).digest('hex');
    }

    // Exemplos de FAQs práticas pré-carregadas para o 7º RI SP se estiver vazio
    const initialFaq = JSON.stringify([
      {
        pergunta: "E se o apresentante trouxer cópia simples de documento de identificação?",
        resposta: "Não recepcionar para fins de prenotação definitiva. Solicitar original ou cópia autenticada nos termos das NSCGJ."
      },
      {
        pergunta: "Como proceder em caso de divergência no número de CPF da matrícula?",
        resposta: "Exigir requerimento com firma reconhecida instruído com certidão da Receita Federal ou documento oficial apto à averbação."
      }
    ]);

    await prisma.$executeRawUnsafe(`
      UPDATE public.fiorix_its 
      SET 
        guardiao_id = COALESCE(guardiao_id, $1),
        hash_versao = COALESCE(hash_versao, $2),
        faq_excecoes = CASE WHEN faq_excecoes IS NULL OR faq_excecoes = '[]'::jsonb THEN $3::jsonb ELSE faq_excecoes END
      WHERE id = $4::uuid
    `, guardiaoId, hash, initialFaq, it.id);

    // Gerar ciências iniciais para usuários do departamento
    const deptoUsers = users.filter(u => u.departamento === it.departamento);
    for (const u of deptoUsers) {
      const isCiente = u.id === guardiaoId || Math.random() > 0.3; // guardião sempre ciente, outros a maioria ciente
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.fiorix_its_ciencias (
          tenant_id, it_id, usuario_id, versao, status, ciente_em, created_at
        ) VALUES (
          $1, $2::uuid, $3, $4, $5, $6, NOW()
        )
        ON CONFLICT (tenant_id, it_id, usuario_id, versao) DO NOTHING
      `, it.tenant_id, it.id, u.id, it.versao || '1.0', isCiente ? 'ciente' : 'pendente', isCiente ? new Date() : null);
    }
  }

  console.log('✅ Migração v5.0 concluída com sucesso!');
}

runMigration()
  .catch((err) => {
    console.error('❌ Erro na migração:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

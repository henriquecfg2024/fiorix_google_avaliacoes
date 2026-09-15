/**
 * MIGRATION — fiorix_its_propostas + fiorix_notificacoes
 * Execute: npx tsx scripts/migration-its-propostas.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== MIGRATION: fiorix_its_propostas + fiorix_notificacoes ===\n');

  // 1. Tabela de propostas de atualização
  console.log('1. Criando fiorix_its_propostas...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_its_propostas (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       TEXT NOT NULL,
      it_id           UUID NOT NULL,
      autor_id        TEXT NOT NULL,
      motivo          TEXT NOT NULL,
      resumo          TEXT NOT NULL,
      pdf_url         TEXT,
      pdf_path        TEXT,
      observacoes     TEXT,
      status          TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','aceita','recusada','esclarecimento','cancelada')),
      respondido_por  TEXT,
      resposta        TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_its_propostas_it_id
      ON public.fiorix_its_propostas (it_id, status)
  `);

  // 2. Tabela de notificações internas
  console.log('2. Criando fiorix_notificacoes...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_notificacoes (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id      TEXT NOT NULL,
      usuario_id     TEXT NOT NULL,
      tipo           TEXT NOT NULL,
      titulo         TEXT NOT NULL,
      mensagem       TEXT,
      lida           BOOLEAN NOT NULL DEFAULT false,
      referencia_id  UUID,
      referencia_tipo TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario
      ON public.fiorix_notificacoes (usuario_id, tenant_id, lida, created_at DESC)
  `);

  console.log('\n✅ Migration concluída!');
}

main().catch(console.error).finally(() => prisma.$disconnect());

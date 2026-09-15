/**
 * MIGRATION — fiorix_its_participants
 * Cria a tabela de participantes das ITs e popula com guardiões existentes.
 * Execute: npx tsx scripts/migration-its-participants.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== MIGRATION: fiorix_its_participants ===\n');

  // 1. Criar tabela fiorix_its_participants
  console.log('1. Criando tabela fiorix_its_participants...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_its_participants (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id                TEXT NOT NULL,
      it_id                    UUID NOT NULL,
      usuario_id               TEXT NOT NULL,
      papel                    TEXT NOT NULL CHECK (papel IN ('RESPONSAVEL_PRINCIPAL','CORRESPONSAVEL','LEITOR')),
      status                   TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
      incluido_por             TEXT,
      pode_colaborar_rascunho  BOOLEAN NOT NULL DEFAULT false,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      removido_em              TIMESTAMPTZ,
      motivo_remocao           TEXT,
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 2. Índice único: apenas 1 RESPONSAVEL_PRINCIPAL ativo por IT
  console.log('2. Criando índice único de responsável principal...');
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_its_participants_responsavel_ativo
      ON public.fiorix_its_participants (tenant_id, it_id)
      WHERE papel = 'RESPONSAVEL_PRINCIPAL' AND status = 'ativo'
  `);

  // 3. Índice único: sem vínculo ativo duplicado para mesmo usuário+IT
  console.log('3. Criando índice de unicidade ativo...');
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_its_participants_usuario_ativo
      ON public.fiorix_its_participants (tenant_id, it_id, usuario_id)
      WHERE status = 'ativo'
  `);

  // 4. Adicionar colunas de bloqueio de edição em fiorix_its
  console.log('4. Adicionando colunas de bloqueio de edição...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.fiorix_its
      ADD COLUMN IF NOT EXISTS editando_por_id TEXT,
      ADD COLUMN IF NOT EXISTS editando_desde  TIMESTAMPTZ
  `);

  // 5. Popular: migrar guardiao_id existentes como RESPONSAVEL_PRINCIPAL
  console.log('5. Migrando guardiões existentes como RESPONSAVEL_PRINCIPAL...');
  const guardioes = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id::text as it_id, tenant_id, guardiao_id as usuario_id
    FROM public.fiorix_its
    WHERE guardiao_id IS NOT NULL
      AND deleted_at IS NULL
  `);

  console.log(`   Encontrados ${guardioes.length} guardiões para migrar.`);
  let migrados = 0;
  let ignorados = 0;

  for (const g of guardioes) {
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.fiorix_its_participants (
          tenant_id, it_id, usuario_id, papel, status, incluido_por, created_at, updated_at
        ) VALUES (
          $1, $2::uuid, $3, 'RESPONSAVEL_PRINCIPAL', 'ativo', $3, NOW(), NOW()
        )
        ON CONFLICT DO NOTHING
      `, g.tenant_id, g.it_id, g.usuario_id);
      migrados++;
    } catch (e: any) {
      console.warn(`   Aviso ao migrar ${g.it_id}: ${e.message}`);
      ignorados++;
    }
  }

  console.log(`   Migrados: ${migrados} | Ignorados (duplicados): ${ignorados}`);

  // 6. Verificar estado final
  const totais = await prisma.$queryRawUnsafe<any[]>(`
    SELECT papel, COUNT(*)::int as total
    FROM public.fiorix_its_participants
    GROUP BY papel
    ORDER BY papel
  `);
  console.log('\nEstado final da tabela:');
  totais.forEach(r => console.log(`  ${r.papel}: ${r.total}`));

  console.log('\n✅ Migration concluída com sucesso!');
}

main().catch(console.error).finally(() => prisma.$disconnect());

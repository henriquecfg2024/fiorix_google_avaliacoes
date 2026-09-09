const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('--- Iniciando migração V5.1 Minha IT: Responsável Técnico ---');

  // 1. Adicionar responsavel_tecnico_id em fiorix_its
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.fiorix_its 
    ADD COLUMN IF NOT EXISTS responsavel_tecnico_id TEXT REFERENCES public."User"(id);
  `);
  console.log('✓ Coluna responsavel_tecnico_id verificada/adicionada.');

  // 2. Adicionar pdf_path em fiorix_its se não existir
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.fiorix_its 
    ADD COLUMN IF NOT EXISTS pdf_path TEXT;
  `);
  console.log('✓ Coluna pdf_path verificada/adicionada.');

  // 3. Migrar dados de guardiao_id para responsavel_tecnico_id
  const migrated = await prisma.$executeRawUnsafe(`
    UPDATE public.fiorix_its 
    SET responsavel_tecnico_id = guardiao_id 
    WHERE responsavel_tecnico_id IS NULL AND guardiao_id IS NOT NULL;
  `);
  console.log(`✓ ${migrated} ITs migradas de guardiao_id para responsavel_tecnico_id.`);

  // 4. Criar índices
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fiorix_its_resp_tecnico ON public.fiorix_its(responsavel_tecnico_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fiorix_its_tenant_cod ON public.fiorix_its(tenant_id, codigo);`);
  console.log('✓ Índices de performance criados.');

  // 5. Garantir estrutura e índices de fiorix_its_ciencias
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_its_ciencias (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id TEXT NOT NULL,
      it_id UUID REFERENCES public.fiorix_its(id) ON DELETE CASCADE,
      usuario_id TEXT REFERENCES public."User"(id) ON DELETE CASCADE,
      versao TEXT NOT NULL,
      status TEXT DEFAULT 'ciente',
      ciente_em TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(it_id, usuario_id, versao)
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ciencias_it_versao ON public.fiorix_its_ciencias(it_id, versao);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_ciencias_tenant_user ON public.fiorix_its_ciencias(tenant_id, usuario_id);`);
  console.log('✓ Tabela fiorix_its_ciencias verificada.');

  // 6. Atribuir Marcia Pinheiro Baptista e Henrique Gama como responsáveis técnicos de exemplo no 7º RI
  const marcia = await prisma.user.findFirst({
    where: { name: { contains: 'Marcia Pinheiro', mode: 'insensitive' } },
    select: { id: true, name: true, email: true }
  });

  const henrique = await prisma.user.findFirst({
    where: { email: 'henrique@7risp.com.br' },
    select: { id: true, name: true, email: true }
  });

  if (marcia) {
    await prisma.$executeRawUnsafe(`
      UPDATE public.fiorix_its 
      SET responsavel_tecnico_id = $1 
      WHERE codigo IN ('IT-ATD-001', 'IT-ATD-002', 'IT-ATD-003', 'IT-ATD-004');
    `, marcia.id);
    console.log(`✓ IT-ATD-001 a 004 atribuídas para Marcia Pinheiro Baptista (${marcia.email}).`);
  }

  if (henrique) {
    await prisma.$executeRawUnsafe(`
      UPDATE public.fiorix_its 
      SET responsavel_tecnico_id = $1 
      WHERE codigo IN ('IT-TI-001', 'IT-REG-001');
    `, henrique.id);
    console.log(`✓ IT-TI-001 e IT-REG-001 atribuídas para Henrique Gama (${henrique.email}).`);
  }

  // Preencher hash_versao padrão se nulo
  await prisma.$executeRawUnsafe(`
    UPDATE public.fiorix_its 
    SET hash_versao = 'a4e1f902bc12d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0'
    WHERE hash_versao IS NULL OR hash_versao = '';
  `);

  console.log('--- Migração concluída com sucesso! ---');
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

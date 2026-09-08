const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Migrating fiorix_comunicados tables ---');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_comunicados (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      conteudo TEXT NOT NULL,
      conteudo_hash TEXT NOT NULL,
      versao INT DEFAULT 1,
      prioridade TEXT DEFAULT 'NORMAL',
      autor_id TEXT NOT NULL REFERENCES public."User"(id),
      destinatarios TEXT[] DEFAULT ARRAY['TODOS'],
      data_publicacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      data_expiracao TIMESTAMP WITH TIME ZONE,
      exige_ciencia BOOLEAN DEFAULT true,
      notificar BOOLEAN DEFAULT true,
      status TEXT DEFAULT 'PUBLICADO',
      imutavel BOOLEAN DEFAULT true,
      ultima_alteracao_por TEXT,
      data_ultima_alteracao TIMESTAMP WITH TIME ZONE,
      motivo_exclusao TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('Table fiorix_comunicados created/verified.');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_comunicados_anexos (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
      comunicado_id TEXT NOT NULL REFERENCES public.fiorix_comunicados(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      nome_original TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      tamanho_bytes INT NOT NULL,
      hash_sha256 TEXT NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES public."User"(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('Table fiorix_comunicados_anexos created/verified.');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.fiorix_comunicados_ciencia (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
      comunicado_id TEXT NOT NULL REFERENCES public.fiorix_comunicados(id) ON DELETE CASCADE,
      usuario_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
      data_visualizacao TIMESTAMP WITH TIME ZONE,
      data_ciencia TIMESTAMP WITH TIME ZONE,
      ip TEXT,
      user_agent TEXT,
      scroll_percent INT,
      comunicado_hash TEXT NOT NULL,
      comprovante_hash TEXT UNIQUE NOT NULL,
      qr_code_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE (tenant_id, comunicado_id, usuario_id)
    );
  `);
  console.log('Table fiorix_comunicados_ciencia created/verified.');

  // Create indexes
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fiorix_comunicados_tenant ON public.fiorix_comunicados(tenant_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fiorix_comunicados_status ON public.fiorix_comunicados(tenant_id, status);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_fiorix_comunicados_ciencia_user ON public.fiorix_comunicados_ciencia(usuario_id);`);

  // Seed default items for 7º RI (tenant cms3xd0wm00002pw9j2k0ahan)
  const tenant = await prisma.tenant.findFirst();
  const tenantId = tenant ? tenant.id : 'cms3xd0wm00002pw9j2k0ahan';
  const nadia = await prisma.user.findFirst({ where: { role: 'RH', tenantId } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', tenantId } });
  const authorId = nadia ? nadia.id : (admin ? admin.id : 'cmtja9tsq0001rpuru8s3dkvl');

  const count = await prisma.fiorixComunicado.count({ where: { tenantId } });
  console.log(`Current comunicado count for tenant ${tenantId}:`, count);

  if (count === 0) {
    console.log('Seeding initial 3 comunicados...');
    await prisma.fiorixComunicado.createMany({
      data: [
        {
          id: 'com-1',
          tenantId,
          titulo: 'Alteração de Horário - Plantão de Fim de Ano',
          conteudo: 'Informamos a escala especial de plantão de atendimento ao público durante o recesso de fim de ano. Todos os colaboradores devem registrar sua ciência formal com hash SHA-256.',
          conteudoHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          autorId: authorId,
          destinatarios: ['TODOS'],
          prioridade: 'URGENTE',
          status: 'PUBLICADO',
          exigeCiencia: true,
          dataPublicacao: new Date('2026-08-30T09:00:00Z'),
        },
        {
          id: 'com-2',
          tenantId,
          titulo: 'Diretriz Operacional Interna - Balcão e Qualificação 2026',
          conteudo: 'Diretrizes de conformidade jurídica e padrão interno de excelência para os balcões e qualificações de títulos do 7º RI SP.',
          conteudoHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
          autorId: admin ? admin.id : authorId,
          destinatarios: ['TODOS'],
          prioridade: 'IMPORTANTE',
          status: 'PUBLICADO',
          exigeCiencia: true,
          dataPublicacao: new Date('2026-08-28T14:30:00Z'),
        },
        {
          id: 'com-3',
          tenantId,
          titulo: 'Campanha Setembro Amarelo - Saúde Mental',
          conteudo: 'Palestras e atendimentos com psicólogos credenciados para o bem-estar da equipe do 7º Registro de Imóveis.',
          conteudoHash: 'a1b2c3d4e5f67a89bc012d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a',
          autorId: authorId,
          destinatarios: ['TODOS'],
          prioridade: 'NORMAL',
          status: 'PUBLICADO',
          exigeCiencia: true,
          dataPublicacao: new Date('2026-08-27T10:15:00Z'),
        },
      ]
    });
    console.log('3 comunicados seeded successfully!');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

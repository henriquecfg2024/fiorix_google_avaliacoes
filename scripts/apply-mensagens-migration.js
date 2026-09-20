const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  console.log('Lendo migration modulo_mensagens.sql...');
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260919200000_modulo_mensagens.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Executando migration no PostgreSQL...');
  await prisma.$executeRawUnsafe(sql);
  console.log('Migration executada com sucesso!');

  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name LIKE 'fiorix_%'
    ORDER BY table_name;
  `);
  console.log('Tabelas encontradas:', tables.map(t => t.table_name));
}

runMigration()
  .catch((err) => {
    console.error('Erro na migração:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

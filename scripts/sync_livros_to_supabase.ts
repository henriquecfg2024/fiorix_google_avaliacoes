import sql from 'mssql';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import path from 'path';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../fiorix/node_modules/@prisma/client');

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

async function syncLivros() {
  console.log('Iniciando sincronizacao de NUMERO_LIVRO do SQL Server para o Supabase...');
  
  const pool = await sql.connect({
    user: process.env.SQL_SERVER_USER,
    password: process.env.SQL_SERVER_PASSWORD,
    server: process.env.SQL_SERVER_HOST,
    database: process.env.SQL_SERVER_DATABASE,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 10000
    }
  });

  const prisma = new PrismaClient();

  const req = pool.request();
  req.timeout = 120000;
  req.input('DataInicial', sql.Date, '2026-07-01');
  req.input('DataFinal', sql.Date, '2026-10-31');
  req.input('SomenteAbertas', sql.Bit, 0);

  console.log('Executando dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2 no SQL Server...');
  const res = await req.execute('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
  const records = res.recordset || [];
  console.log(`Registros retornados do SQL Server: ${records.length}`);

  // Filtrar apenas registros com NUMERO_LIVRO preenchido
  const withLivro = records.filter((r: any) => r.NUMERO_LIVRO && r.NUMERO_LIVRO.trim() !== '');
  console.log(`Registros com NUMERO_LIVRO valido: ${withLivro.length}`);

  // Agrupar por protocolo para update em lote
  const protoMap = new Map<number, string>();
  for (const r of withLivro) {
    if (r.PROTOCOLO && !protoMap.has(r.PROTOCOLO)) {
      protoMap.set(r.PROTOCOLO, r.NUMERO_LIVRO.trim());
    }
  }

  console.log(`Total de protocolos distintos com Livro: ${protoMap.size}`);

  // Atualizar no Supabase fiorix_tarefas_dados
  let updatedCount = 0;
  const entries = Array.from(protoMap.entries());
  
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    const whenClauses = chunk.map(([proto, livro]) => `WHEN ${proto} THEN '${livro.replace(/'/g, "''")}'`).join(' ');
    const protoList = chunk.map(([proto]) => proto).join(',');

    const query = `
      UPDATE public.fiorix_tarefas_dados
      SET numero_livro = CASE protocolo ${whenClauses} END
      WHERE protocolo IN (${protoList})
    `;

    await prisma.$executeRawUnsafe(query);
    updatedCount += chunk.length;
    process.stdout.write(`\rAtualizados: ${updatedCount} de ${protoMap.size} protocolos no Supabase...`);
  }

  console.log('\nSincronizacao concluida com sucesso!');

  const countRes = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as total_com_livro FROM public.fiorix_tarefas_dados WHERE numero_livro IS NOT NULL
  `);
  console.log('Total de linhas em fiorix_tarefas_dados com numero_livro:', countRes);

  await pool.close();
  await prisma.$disconnect();
}

syncLivros().catch(console.error);

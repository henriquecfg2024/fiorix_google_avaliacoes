import sql from 'mssql';
import { env } from './src/config/env.js';

async function checkDefs() {
  const pool = await sql.connect({
    user: env.SQL_SERVER_USER,
    password: env.SQL_SERVER_PASSWORD,
    server: env.SQL_SERVER_HOST,
    database: env.SQL_SERVER_DATABASE,
    port: 1433,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 5000
    }
  });

  const procs = [
    'dbo.pr_Fiorix_BI_METAS',
    'dbo.pr_Fiorix_BI_Incremental_v2',
    'dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2',
    'dbo.pr_Fiorix_BI_Produtividade'
  ];

  for (const p of procs) {
    console.log(`\n=== DEFINICAO DE ${p} ===`);
    try {
      const res = await pool.request().query(`SELECT OBJECT_DEFINITION(OBJECT_ID('${p}')) as def`);
      const def = res.recordset[0]?.def;
      if (def) {
        console.log(`Tamanho: ${def.length} caracteres`);
        // Log first 1000 and any mentions of livro or matricula or ato
        const lines = def.split('\n');
        const relevant = lines.filter((l: string) => /livro|matricula|ato|numero|recp/i.test(l));
        console.log('Linhas com livro/matricula/ato:', relevant.slice(0, 20));
      } else {
        console.log('Sem permissao para ver definicao direta ou NULL.');
      }
    } catch (e: any) {
      console.log('Erro ao ler def:', e.message);
    }
  }

  await pool.close();
}

checkDefs().catch(console.error);

import sql from 'mssql';
import { env } from '../src/config/env.js';

async function run() {
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

  const request = pool.request();
  request.timeout = 30000;
  request.input('DataInicial', sql.Date, '2026-09-15');
  request.input('DataFinal', sql.Date, '2026-09-30');
  request.input('SomenteAbertas', sql.Bit, 0);

  console.log('Executando pr_Fiorix_BI_TAREFAS_Incremental_v2...');
  const result = await request.execute('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
  const records = result.recordset || [];
  console.log(`Total registros retornados: ${records.length}`);

  const withLivro = records.filter((r: any) => r.NUMERO_LIVRO && r.NUMERO_LIVRO.trim() !== '');
  console.log(`Registros com NUMERO_LIVRO preenchido: ${withLivro.length}`);
  console.log('Amostra de 5:', withLivro.slice(0, 5).map((r: any) => ({
    PROTOCOLO: r.PROTOCOLO,
    NUMERO_LIVRO: r.NUMERO_LIVRO,
    TAREFA: r.TAREFA,
    NATUREZA: r.NATUREZA
  })));

  const p644377 = records.filter((r: any) => r.PROTOCOLO == 644377);
  console.log('644377 na procedure:', p644377.map((r: any) => ({
    PROTOCOLO: r.PROTOCOLO,
    NUMERO_LIVRO: r.NUMERO_LIVRO,
    TAREFA: r.TAREFA
  })));

  await pool.close();
}

run().catch(console.error);

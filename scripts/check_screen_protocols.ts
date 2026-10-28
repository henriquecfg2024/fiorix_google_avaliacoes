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
  request.timeout = 60000;
  request.input('DataInicial', sql.Date, '2026-08-15');
  request.input('DataFinal', sql.Date, '2026-10-15');
  request.input('SomenteAbertas', sql.Bit, 0);

  const result = await request.execute('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
  const records = result.recordset || [];
  
  const protos = [644399, 644393, 644392, 644389, 644386, 644319, 644315, 644314, 644239, 644102, 644377];
  
  for (const p of protos) {
    const found = records.filter((r: any) => r.PROTOCOLO == p);
    console.log(`Protocolo ${p}: ${found.length} tarefas. NUMERO_LIVRO = ${found[0]?.NUMERO_LIVRO || 'NULL'} | NATUREZA = ${found[0]?.NATUREZA || 'NULL'}`);
  }

  await pool.close();
}

run().catch(console.error);

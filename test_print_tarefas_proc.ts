import sql from 'mssql';
import { env } from './src/config/env.js';

async function printTarefasProc() {
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

  const res = await pool.request().query(`
    SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2')) as def
  `);
  console.log('=== DEFINICAO REAL DA PROCEDURE pr_Fiorix_BI_TAREFAS_Incremental_v2 NO SRVSQL ===');
  console.log(res.recordset[0]?.def);

  await pool.close();
}

printTarefasProc().catch(console.error);

import sql from 'mssql';
import { env } from './src/config/env.js';

async function printDefs() {
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

  const res1 = await pool.request().query(`SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.pr_Fiorix_BI_Incremental_v2')) as def`);
  console.log('=== dbo.pr_Fiorix_BI_Incremental_v2 ===');
  console.log(res1.recordset[0]?.def);

  const res2 = await pool.request().query(`SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.pr_Fiorix_BI_Produtividade')) as def`);
  console.log('=== dbo.pr_Fiorix_BI_Produtividade ===');
  console.log(res2.recordset[0]?.def);

  await pool.close();
}

printDefs().catch(console.error);

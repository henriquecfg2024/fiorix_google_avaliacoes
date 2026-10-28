import sql from 'mssql';
import { env } from './src/config/env.js';
import fs from 'fs';

async function printMetasProc() {
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
    SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.pr_Fiorix_BI_METAS')) as def
  `);
  
  const def = res.recordset[0]?.def || '';
  fs.writeFileSync('metas_def.sql', def, 'utf8');
  console.log('Salvo metas_def.sql com tamanho:', def.length);

  await pool.close();
}

printMetasProc().catch(console.error);

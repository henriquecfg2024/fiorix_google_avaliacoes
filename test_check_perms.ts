import sql from 'mssql';
import { env } from './src/config/env.js';

async function checkPerms() {
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

  const perms = await pool.request().query(`
    SELECT entity_name, permission_name 
    FROM fn_my_permissions('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2', 'OBJECT')
  `);
  console.log("Permissions on pr_Fiorix_BI_TAREFAS_Incremental_v2:", perms.recordset);

  await pool.close();
}

checkPerms().catch(console.error);

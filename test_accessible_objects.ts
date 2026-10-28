import sql from 'mssql';
import { env } from './src/config/env.js';

async function checkAccessibleObjects() {
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

  console.log('=== PROCEDURES DISPONIVEIS PARA O USUARIO ===');
  const procs = await pool.request().query(`
    SELECT ROUTINE_SCHEMA, ROUTINE_NAME 
    FROM INFORMATION_SCHEMA.ROUTINES 
    WHERE ROUTINE_TYPE = 'PROCEDURE'
    ORDER BY ROUTINE_NAME;
  `);
  console.log(procs.recordset);

  console.log('\n=== VIEWS DISPONIVEIS ===');
  const views = await pool.request().query(`
    SELECT TABLE_SCHEMA, TABLE_NAME 
    FROM INFORMATION_SCHEMA.VIEWS 
    ORDER BY TABLE_NAME;
  `);
  console.log(views.recordset);

  console.log('\n=== PERMISSOES NO BANCO ===');
  const perms = await pool.request().query(`
    SELECT * FROM fn_my_permissions(NULL, 'DATABASE');
  `);
  console.log(perms.recordset);

  await pool.close();
}

checkAccessibleObjects().catch(console.error);

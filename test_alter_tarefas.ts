import sql from 'mssql';
import { env } from './src/config/env.js';

async function testAlter() {
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

  try {
    // Get current def
    const res = await pool.request().query(`
      SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2')) as def
    `);
    let def = res.recordset[0].def;
    
    // Test if we can add a comment to def
    def = def.replace('CREATE PROCEDURE', 'ALTER PROCEDURE');
    await pool.request().batch(def);
    console.log('ALTER PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2 SUCESSO!');
  } catch (e: any) {
    console.log('FALHA NO ALTER PROCEDURE:', e.message);
  }

  await pool.close();
}

testAlter().catch(console.error);

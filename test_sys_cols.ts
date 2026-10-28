import sql from 'mssql';
import { env } from './src/config/env.js';

async function testSysColumns() {
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

  const res1 = await pool.request().query("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tblWRILivro')");
  console.log('sys.columns para tblWRILivro:', res1.recordset.map((r: any) => r.name));

  const res2 = await pool.request().query("SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.tblWRITitulosParticipantes')");
  console.log('sys.columns para tblWRITitulosParticipantes:', res2.recordset.map((r: any) => r.name));

  await pool.close();
}

testSysColumns().catch(console.error);

import sql from 'mssql';
import { env } from './src/config/env.js';

async function testColumnResolution() {
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
    await pool.request().query('SELECT FakeColumnThatDoesNotExist999 FROM dbo.tblWRITitulosParticipantes');
  } catch (e: any) {
    console.log('Erro com FakeColumn:', e.message);
  }

  await pool.close();
}

testColumnResolution().catch(console.error);

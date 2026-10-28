import sql from 'mssql';
import { env } from './src/config/env.js';

async function listDbs() {
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
    const res = await pool.request().query('SELECT name FROM sys.databases');
    console.log('Databases:', res.recordset.map((r: any) => r.name));
  } catch (e: any) {
    console.log('Erro sys.databases:', e.message);
  }

  await pool.close();
}

listDbs().catch(console.error);

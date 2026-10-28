import sql from 'mssql';
import { env } from './src/config/env.js';

async function querySysTables() {
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
    const res = await pool.request().query(`
      SELECT name FROM sys.tables ORDER BY name
    `);
    console.log(`Total tabelas em sys.tables: ${res.recordset.length}`);
    const names = res.recordset.map((r: any) => r.name);
    console.log('Tabelas relevantes:', names.filter((n: string) => /livro|mat|ato|tit|recep|reg|prenot/i.test(n)));
  } catch (e: any) {
    console.log('Erro ao ler sys.tables:', e.message);
  }

  await pool.close();
}

querySysTables().catch(console.error);

import sql from 'mssql';
import { env } from './src/config/env.js';

async function listTables() {
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
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = 'dbo'
    ORDER BY TABLE_NAME;
  `);
  console.log(`Total de tabelas: ${res.recordset.length}`);
  const tables = res.recordset.map((r: any) => r.TABLE_NAME);
  console.log('Tabelas com LIVRO, MAT, ATO, REG, CERT, TITULO, RECEP:');
  console.log(tables.filter((t: string) => /livro|mat|ato|reg|cert|tit|recep|prenot/i.test(t)));

  await pool.close();
}

listTables().catch(console.error);

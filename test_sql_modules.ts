import sql from 'mssql';
import { env } from './src/config/env.js';

async function testSqlModules() {
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
    const res = await pool.request().query('SELECT definition FROM sys.sql_modules');
    console.log(`sys.sql_modules tem ${res.recordset.length} linhas!`);
    
    // Search in definitions
    for (const row of res.recordset) {
      const def = row.definition || '';
      const matches = def.match(/tblWRI[A-Za-z0-9_]+/g);
      if (matches) {
        console.log('Tabelas tblWRI encontradas em sql_modules:', Array.from(new Set(matches)));
      }
    }
  } catch (e: any) {
    console.log('Erro sys.sql_modules:', e.message);
  }

  await pool.close();
}

testSqlModules().catch(console.error);

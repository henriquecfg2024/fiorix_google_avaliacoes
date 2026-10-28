import sql from 'mssql';
import { env } from './src/config/env.js';

async function test() {
  const config: sql.config = {
    server: env.SQL_SERVER_HOST,
    database: env.SQL_SERVER_DATABASE,
    user: env.SQL_SERVER_USER,
    password: env.SQL_SERVER_PASSWORD,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    requestTimeout: 60000,
  };

  const pool = await sql.connect(config);
  console.log('Conectado ao SQL Server. Testando pr_Fiorix_BI_Impressoes com DataInicial...');

  const startTime = Date.now();
  const req = pool.request();
  // Passando os últimos 15 dias
  const d = new Date(Date.now() - 15 * 86400000).toISOString().substring(0, 10);
  req.input('DataInicial', sql.Date, d);
  
  try {
    const res = await req.execute('dbo.pr_Fiorix_BI_Impressoes');
    console.log(`Sucesso! Registros: ${res.recordset.length} em ${Date.now() - startTime}ms`);
    if (res.recordset.length > 0) {
      console.log('Primeiro registro:', res.recordset[0]);
      console.log('Último registro:', res.recordset[res.recordset.length - 1]);
    }
  } catch (err: any) {
    console.error('Erro ao executar:', err.message);
  } finally {
    await pool.close();
  }
}

test();

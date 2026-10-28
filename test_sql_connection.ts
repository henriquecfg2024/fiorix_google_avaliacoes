import sql from 'mssql';
import { env } from './src/config/env.js';

async function testConnection() {
  const startTime = Date.now();
  let connected = false;
  let errorMsg = '';

  try {
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
    
    connected = true;
    await pool.close();
  } catch (err: any) {
    errorMsg = err.message;
  }

  const duration = Date.now() - startTime;

  console.log(`SQL_CONNECTED: ${connected ? 'SIM' : 'NÃO'}`);
  console.log(`database conectada: ${env.SQL_SERVER_DATABASE}`);
  console.log(`usuário utilizado: ${env.SQL_SERVER_USER}`);
  console.log(`tempo de conexão: ${duration}ms`);
  
  if (errorMsg) {
    console.log(`erro técnico: ${errorMsg}`);
  }
}

testConnection().catch(console.error);

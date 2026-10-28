import sql from 'mssql';
import { env } from './src/config/env.js';

async function testObjectId() {
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
    SELECT 
      OBJECT_ID('dbo.tblWRITitulos') as tblWRITitulos,
      OBJECT_ID('dbo.tblWRIRecepcao') as tblWRIRecepcao,
      OBJECT_ID('dbo.tblWRILivro') as tblWRILivro,
      OBJECT_ID('dbo.TableThatDoesNotExist') as nonExistent
  `);
  console.log('Resultado OBJECT_ID:', res.recordset[0]);

  await pool.close();
}

testObjectId().catch(console.error);

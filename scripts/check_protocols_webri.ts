import sql from 'mssql';
import { env } from '../src/config/env.js';

async function run() {
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

  const cols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME IN ('tblWRITitulos', 'tblWRIRecepcao')
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);

  console.log('Colunas:', JSON.stringify(cols.recordset, null, 2));

  const sample = await pool.request().query(`
    SELECT r.PK_Recepcao, r.Observacao, r.TipoPrenotacao
    FROM dbo.tblWRIRecepcao r
    WHERE r.PK_Recepcao IN (644399, 644393, 644377)
  `);
  console.log('Sample Recepcao:', JSON.stringify(sample.recordset, null, 2));

  await pool.close();
}

run().catch(console.error);

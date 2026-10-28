import sql from 'mssql';
import { env } from './src/config/env.js';

async function investigateSchema() {
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

  console.log('--- BUSCANDO COLUNAS COM "LIVRO" OU "MATRICULA" EM TABELAS DE TITULOS/CDS/RECEPCAO ---');
  const cols = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE (COLUMN_NAME LIKE '%livro%' OR COLUMN_NAME LIKE '%matricula%' OR COLUMN_NAME LIKE '%folha%' OR COLUMN_NAME LIKE '%prenotacao%')
      AND TABLE_NAME NOT LIKE 'sys%'
    ORDER BY TABLE_NAME, COLUMN_NAME;
  `);
  console.log('Colunas encontradas:', cols.recordset);

  const protos = [644854, 644853, 644851, 644850, 644849, 644686, 643999, 644377];
  console.log('\n--- VERIFICANDO DADOS DE tblWRITitulos PARA ESSES PROTOCOLOS ---');
  const titulos = await pool.request().query(`
    SELECT TOP 20 *
    FROM dbo.tblWRITitulos
    WHERE FK_tblWRIRecepcaoRecepcao IN (${protos.join(',')})
  `);
  console.log('tblWRITitulos:', titulos.recordset);

  console.log('\n--- VERIFICANDO DADOS DE tblWRIRecepcao PARA ESSES PROTOCOLOS ---');
  const recp = await pool.request().query(`
    SELECT TOP 20 *
    FROM dbo.tblWRIRecepcao
    WHERE PK_Recepcao IN (${protos.join(',')})
  `);
  console.log('tblWRIRecepcao:', recp.recordset);

  await pool.close();
}

investigateSchema().catch(console.error);

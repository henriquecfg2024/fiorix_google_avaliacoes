import sql from 'mssql';
import { env } from './src/config/env.js';

async function checkFks() {
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
      SELECT 
        fk.name AS fk_name,
        tp.name AS parent_table,
        cp.name AS parent_column,
        tr.name AS referenced_table,
        cr.name AS referenced_column
      FROM sys.foreign_keys fk
      INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
      INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      WHERE tr.name IN ('tblWRIRecepcao', 'tblWRITitulos')
      ORDER BY tp.name;
    `);
    console.log(`Encontradas ${res.recordset.length} FKs para tblWRIRecepcao / tblWRITitulos:`);
    console.log(res.recordset);
  } catch (e: any) {
    console.log('Erro ao ler foreign_keys:', e.message);
  }

  await pool.close();
}

checkFks().catch(console.error);

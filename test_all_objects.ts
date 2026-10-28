import sql from 'mssql';
import { env } from './src/config/env.js';

async function testAllObjects() {
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

  const res = await pool.request().query("SELECT name, type FROM sys.all_objects WHERE name LIKE 'tblWRI%' ORDER BY name");
  console.log(`sys.all_objects tem ${res.recordset.length} objetos tblWRI!`);
  console.log(res.recordset.map((r: any) => `${r.name} (${r.type.trim()})`));

  await pool.close();
}

testAllObjects().catch(console.error);

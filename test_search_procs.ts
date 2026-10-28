import sql from 'mssql';
import { env } from './src/config/env.js';

async function searchAllProcsForLivro() {
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

  const procs = await pool.request().query(`
    SELECT ROUTINE_SCHEMA, ROUTINE_NAME 
    FROM INFORMATION_SCHEMA.ROUTINES 
    WHERE ROUTINE_TYPE = 'PROCEDURE'
    ORDER BY ROUTINE_NAME;
  `);

  for (const p of procs.recordset) {
    const fullName = `${p.ROUTINE_SCHEMA}.${p.ROUTINE_NAME}`;
    try {
      const res = await pool.request().query(`SELECT OBJECT_DEFINITION(OBJECT_ID('${fullName}')) as def`);
      const def = res.recordset[0]?.def || '';
      if (/livro|matricula/i.test(def)) {
        console.log(`\nProcedure ${fullName} CONTÉM livro ou matricula!`);
        const lines = def.split('\n');
        lines.forEach((l: string, idx: number) => {
          if (/livro|matricula/i.test(l)) {
            console.log(`  L${idx + 1}: ${l.trim()}`);
          }
        });
      }
    } catch (e: any) {
      // ignore
    }
  }

  await pool.close();
}

searchAllProcsForLivro().catch(console.error);

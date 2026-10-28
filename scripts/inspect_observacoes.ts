import sql from 'mssql';
import { env } from '../src/config/env.js';
import fs from 'fs';
import path from 'path';

async function alterProc() {
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

  const sqlPath = path.join(process.cwd(), 'sql', 'atualizacao_procedure_tarefas_livro.sql');
  let sqlContent = fs.readFileSync(sqlPath, 'utf8');

  // Ensure OBSERVACAO_RECEPCAO is returned
  if (!sqlContent.includes('OBSERVACAO_RECEPCAO')) {
    sqlContent = sqlContent.replace(
      'AS NUMERO_LIVRO',
      'AS NUMERO_LIVRO,\n    Recp.Observacao AS OBSERVACAO_RECEPCAO'
    );
    fs.writeFileSync(sqlPath, sqlContent, 'utf8');
  }

  // Remove USE and GO for direct execution
  const batches = sqlContent
    .split(/\bGO\b/i)
    .map(b => b.trim())
    .filter(b => b.length > 0 && !b.toUpperCase().startsWith('USE'));

  for (const batch of batches) {
    console.log('Executando batch de alteração da procedure...');
    await pool.request().batch(batch);
  }

  console.log('Procedure atualizada com sucesso!');

  // Now run procedure for the screen protocols
  const req = pool.request();
  req.input('DataInicial', sql.Date, '2026-08-15');
  req.input('DataFinal', sql.Date, '2026-10-15');
  req.input('SomenteAbertas', sql.Bit, 0);

  const res = await req.execute('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
  const protos = [644399, 644393, 644392, 644389, 644386, 644377];
  
  for (const p of protos) {
    const f = res.recordset.find((r: any) => r.PROTOCOLO == p);
    if (f) {
      console.log(`\n--- PROTOCOLO ${p} ---`);
      console.log(`NUMERO_LIVRO: ${f.NUMERO_LIVRO}`);
      console.log(`NATUREZA: ${f.NATUREZA}`);
      console.log(`OBSERVACAO: ${f.OBSERVACAO_RECEPCAO}`);
    }
  }

  await pool.close();
}

alterProc().catch(console.error);

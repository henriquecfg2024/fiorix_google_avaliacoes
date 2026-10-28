import sql from 'mssql';
import { env } from './src/config/env.js';

async function check645454InProc() {
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

  const req = pool.request();
  req.input('DataInicial', sql.Date, '2026-09-01');
  req.input('DataFinal', sql.Date, '2026-09-30');
  req.input('SomenteAbertas', sql.Bit, 0);

  const res = await req.execute('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
  const matching = (res.recordset || []).filter((r: any) => r.PROTOCOLO == 645454);

  console.log(`Linhas para 645454 em pr_Fiorix_BI_TAREFAS_Incremental_v2: ${matching.length}`);
  console.table(matching.map((m: any) => ({
    IdTarefa: m.ID_TAREFA,
    Tarefa: m.TAREFA,
    Situacao: m.SITUACAO_TAREFA,
    Abertura: m.DATA_ABERTURA,
    Finalizacao: m.DATA_FINALIZACAO,
    Responsavel: m.RESPONSAVEL
  })));

  await pool.close();
}

check645454InProc().catch(console.error);

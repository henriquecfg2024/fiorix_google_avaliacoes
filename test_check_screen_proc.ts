import sql from 'mssql';
import { env } from './src/config/env.js';

async function checkScreenProtosInProc() {
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

  const protos = [644854, 644853, 644851, 644850, 644849, 644686, 644592, 643999, 643987, 643946];

  const req = pool.request();
  req.timeout = 60000;
  req.input('DataInicial', sql.Date, '2026-08-01');
  req.input('DataFinal', sql.Date, '2026-10-31');
  req.input('SomenteAbertas', sql.Bit, 0);

  console.log('Executando pr_Fiorix_BI_TAREFAS_Incremental_v2...');
  const res = await req.execute('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
  const records = res.recordset || [];
  console.log(`Total retornado: ${records.length}`);

  for (const p of protos) {
    const matching = records.filter((r: any) => r.PROTOCOLO == p);
    console.log(`\n================ PROTOCOLO ${p} (${matching.length} tarefas) ================`);
    if (matching.length > 0) {
      console.log('NUMERO_LIVRO:', matching[0].NUMERO_LIVRO);
      console.log('TIPO:', matching[0].TIPO);
      console.log('NATUREZA:', matching[0].NATUREZA);
      console.log('OBSERVACAO_RECEPCAO:', matching[0].OBSERVACAO_RECEPCAO);
      console.log('Tarefas:', matching.map((m: any) => ({
        tarefa: m.TAREFA,
        situacao: m.SITUACAO_TAREFA,
        abertura: m.DATA_ABERTURA,
        finalizacao: m.DATA_FINALIZACAO
      })));
    } else {
      console.log('Não retornado pela procedure pr_Fiorix_BI_TAREFAS_Incremental_v2 com os parâmetros de data.');
    }
  }

  await pool.close();
}

checkScreenProtosInProc().catch(console.error);

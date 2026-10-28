import sql from 'mssql';
import { env } from './src/config/env.js';

async function checkObs() {
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
  req.input('DataFinal', sql.Date, '2026-09-22');
  req.input('SomenteAbertas', sql.Bit, 0);

  const res = await req.execute('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
  const records = res.recordset || [];
  
  const protos = [644854, 644853, 644851, 644850, 644849, 644686, 644592, 643999, 643987, 643946];
  for (const p of protos) {
    const f = records.find((r: any) => r.PROTOCOLO == p);
    console.log(`Proto ${p}: OBS = "${f?.OBSERVACAO_RECEPCAO}" | NATUREZA = "${f?.NATUREZA}" | TIPO = "${f?.TIPO}"`);
  }

  // Also print 10 samples of OBSERVACAO_RECEPCAO from records that DO have something in OBSERVACAO_RECEPCAO
  const withObs = records.filter((r: any) => r.OBSERVACAO_RECEPCAO && r.OBSERVACAO_RECEPCAO.trim().length > 0);
  console.log(`\nTotal com OBSERVACAO_RECEPCAO preenchida: ${withObs.length} de ${records.length}`);
  for (const r of withObs.slice(0, 10)) {
    console.log(`Proto ${r.PROTOCOLO}: ${r.OBSERVACAO_RECEPCAO}`);
  }

  await pool.close();
}

checkObs().catch(console.error);

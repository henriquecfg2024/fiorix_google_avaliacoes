/**
 * ═══════════════════════════════════════════════════════════════
 * FIORIX CONNECTOR — Carga Retroativa Única (One-Shot Full Sync)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Executa as procedures no SQL Server com intervalo de datas
 * retroativo e envia todos os registros para o FIORIX SaaS.
 * 
 * USO:
 *   npx tsx src/scripts/fullSync.ts
 * 
 * IMPORTANTE: Pare o serviço FIORIXConnector antes de rodar.
 */

import sql from 'mssql';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';

// ── Configuração ──────────────────────────────────────────────
const DATA_INICIAL = '01/07/2026';  // dd/mm/yyyy
const DATA_FINAL   = '05/09/2026';  // dd/mm/yyyy
const CHUNK_SIZE   = 500;
const DELAY_BETWEEN_CHUNKS_MS = 2000;  // 2 segundos entre chunks
const MAX_RETRIES = 3;

// Fontes já enviadas com sucesso (pular estas)
const SKIP_SOURCES: string[] = ['bi'];  // BI já foi enviado com 4162 registros

// Carrega .env.production
dotenv.config({ path: path.join(process.cwd(), '.env.production'), override: true });

const FIORIX_API_URL = process.env.FIORIX_API_URL!;
const CONNECTOR_ID = process.env.CONNECTOR_ID!;
const CONNECTOR_SECRET = process.env.CONNECTOR_SECRET!;

const sqlConfig: sql.config = {
  user: process.env.SQL_SERVER_USER!,
  password: process.env.SQL_SERVER_PASSWORD!,
  database: process.env.SQL_SERVER_DATABASE!,
  server: process.env.SQL_SERVER_HOST!,
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 120000,  // 2 minutos — procedures retroativas podem ser lentas
};

const apiClient = axios.create({
  baseURL: FIORIX_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CONNECTOR_SECRET}`,
  },
  timeout: 60000,
  proxy: process.env.PROXY_ENABLED === 'true' ? {
    protocol: 'http',
    host: process.env.PROXY_HOST!,
    port: Number(process.env.PROXY_PORT || 3128),
    auth: {
      username: process.env.PROXY_USERNAME!,
      password: process.env.PROXY_PASSWORD!,
    },
  } : undefined,
});

// ── Helpers ───────────────────────────────────────────────────
function recordKey(source: string, record: any): string {
  let identity: string;
  switch (source) {
    case 'bi':
      identity = `bi:${record.PROTOCOLO}:${record.SEQ_TITULO}`;
      break;
    case 'produtividade':
      identity = `produtividade:${record.cursor_value}:${record.NumeroDocumento}:${record.FlagDocumento}:${record.FK_tblWRIHistorico_Id}`;
      break;
    case 'metas':
      identity = `metas:${record.PROTOCOLO}`;
      break;
    case 'tarefas':
      identity = `tarefas:${record.ID_TAREFA}:${record.ID_HISTORICO ?? 0}`;
      break;
    default:
      identity = `${source}:${JSON.stringify(record)}`;
  }
  return createHash('sha256').update(identity).digest('hex');
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function sendBatch(source: string, records: any[]): Promise<void> {
  if (records.length === 0) {
    console.log(`  ⏭️  ${source}: 0 registros — pulando.`);
    return;
  }

  // Attach record_key to each record
  const enrichedRecords = records.map(r => ({
    ...r,
    record_key: r.record_key || recordKey(source, r),
  }));

  const batchId = uuidv4();
  const generatedAt = new Date().toISOString();
  const chunks = chunkArray(enrichedRecords, CHUNK_SIZE);

  console.log(`  📦 ${source}: ${records.length} registros → ${chunks.length} chunks de até ${CHUNK_SIZE}`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const payload = {
      connector_id: CONNECTOR_ID,
      source,
      batch_id: batchId,
      generated_at: generatedAt,
      records: chunk,
      chunk_index: i,
      chunk_count: chunks.length,
      sync_mode: 'full',
    };

    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await apiClient.post('', payload);
        console.log(`    ✅ Chunk ${i + 1}/${chunks.length} enviado (${chunk.length} registros) — HTTP ${res.status}`);
        success = true;
        break;
      } catch (err: any) {
        const status = err.response?.status || 'N/A';
        const msg = err.response?.data?.error || err.message;
        if (attempt < MAX_RETRIES && (status === 401 || status === 429 || status === 503)) {
          const backoff = attempt * 5000; // 5s, 10s, 15s
          console.warn(`    ⚠️  Chunk ${i + 1}/${chunks.length} — HTTP ${status}. Aguardando ${backoff/1000}s antes de retry ${attempt}/${MAX_RETRIES}...`);
          await new Promise(r => setTimeout(r, backoff));
        } else {
          console.error(`    ❌ Chunk ${i + 1}/${chunks.length} FALHOU — HTTP ${status}: ${msg}`);
          throw err;
        }
      }
    }

    // Pausa entre chunks para não sobrecarregar a API
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_CHUNKS_MS));
    }
  }

  console.log(`  ✅ ${source}: Batch ${batchId} completo!\n`);
}

// ── Procedures ────────────────────────────────────────────────
async function runBI(pool: sql.ConnectionPool): Promise<any[]> {
  console.log('\n🔹 [BI] Executando dbo.pr_Fiorix_BI_Incremental_v2...');
  const start = Date.now();
  const request = pool.request();
  request.timeout = 120000;
  request.input('DataInicial', sql.VarChar(10), DATA_INICIAL);
  request.input('DataFinal', sql.VarChar(10), DATA_FINAL);
  request.input('Flag', sql.Int, 0);
  request.input('OverlapMinutes', sql.Int, 0);
  const result = await request.execute('dbo.pr_Fiorix_BI_Incremental_v2');
  const records = result.recordset || [];
  console.log(`  SQL OK em ${Date.now() - start}ms — ${records.length} registros`);
  return records;
}

async function runProdutividade(pool: sql.ConnectionPool): Promise<any[]> {
  console.log('\n🔹 [PRODUTIVIDADE] Executando dbo.pr_Fiorix_BI_Produtividade_Incremental...');
  const start = Date.now();
  const request = pool.request();
  request.timeout = 120000;
  request.input('DataInicial', sql.VarChar(10), DATA_INICIAL);
  request.input('DataFinal', sql.VarChar(10), DATA_FINAL);
  request.input('IDCaixa', sql.VarChar(3), '0');
  // Sem cursorValue = pega tudo
  request.input('OverlapMinutes', sql.Int, 0);
  const result = await request.execute('dbo.pr_Fiorix_BI_Produtividade_Incremental');
  const records = result.recordset || [];
  console.log(`  SQL OK em ${Date.now() - start}ms — ${records.length} registros`);
  return records;
}

async function runTarefas(pool: sql.ConnectionPool): Promise<any[]> {
  console.log('\n🔹 [TAREFAS] Executando dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2...');
  const start = Date.now();
  const request = pool.request();
  request.timeout = 120000;
  // Para tarefas, usamos o formato ISO (yyyy-mm-dd)
  request.input('DataInicial', sql.Date, '2026-07-01');
  request.input('DataFinal', sql.Date, '2026-09-20');  // +15 dias de margem
  request.input('SomenteAbertas', sql.Bit, 0); // 0 = todas (abertas + finalizadas)
  // Sem cursorValue = pega tudo
  request.input('OverlapMinutes', sql.Int, 0);
  const result = await request.execute('dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2');
  const records = result.recordset || [];
  console.log(`  SQL OK em ${Date.now() - start}ms — ${records.length} registros`);
  return records;
}

async function runMetas(pool: sql.ConnectionPool): Promise<any[]> {
  console.log('\n🔹 [METAS] Executando dbo.pr_Fiorix_BI_METAS...');
  const start = Date.now();
  const request = pool.request();
  request.timeout = 120000;
  const result = await request.execute('dbo.pr_Fiorix_BI_METAS');
  const records = (result.recordset || []).map((r: any) => ({
    ...r,
    record_key: recordKey('metas', r),
  }));
  console.log(`  SQL OK em ${Date.now() - start}ms — ${records.length} registros`);
  return records;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  FIORIX CONNECTOR — Carga Retroativa Única');
  console.log(`  Período: ${DATA_INICIAL} até ${DATA_FINAL}`);
  console.log(`  API: ${FIORIX_API_URL}`);
  console.log(`  SQL Server: ${process.env.SQL_SERVER_HOST}\\${process.env.SQL_SERVER_DATABASE}`);
  console.log('═══════════════════════════════════════════════════════════');

  let pool: sql.ConnectionPool | null = null;
  const results: { source: string; records: number; status: string }[] = [];

  try {
    pool = await sql.connect(sqlConfig);
    console.log('✅ Conectado ao SQL Server\n');

    const sources: { name: string; run: (pool: sql.ConnectionPool) => Promise<any[]> }[] = [
      { name: 'bi', run: runBI },
      { name: 'produtividade', run: runProdutividade },
      { name: 'tarefas', run: runTarefas },
      { name: 'metas', run: runMetas },
    ];

    for (const src of sources) {
      if (SKIP_SOURCES.includes(src.name)) {
        console.log(`\n⏭️  [${src.name.toUpperCase()}] Pulando — já enviado anteriormente.`);
        results.push({ source: src.name, records: 0, status: '⏭️ Pulado' });
        continue;
      }

      try {
        const records = await src.run(pool);
        await sendBatch(src.name, records);
        results.push({ source: src.name, records: records.length, status: '✅ OK' });

        // Pausa de 5s entre fontes para resetar rate limits
        console.log('  ⏳ Aguardando 5s antes da próxima fonte...');
        await new Promise(r => setTimeout(r, 5000));
      } catch (err: any) {
        console.error(`❌ ${src.name} falhou: ${err.message}`);
        results.push({ source: src.name, records: 0, status: `❌ ${err.message}` });
      }
    }

  } finally {
    if (pool) await pool.close();
  }

  // Resumo final
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  RESUMO DA CARGA RETROATIVA');
  console.log('═══════════════════════════════════════════════════════════');
  for (const r of results) {
    console.log(`  ${r.status} ${r.source.padEnd(15)} ${r.records} registros`);
  }
  const total = results.reduce((sum, r) => sum + r.records, 0);
  console.log(`\n  TOTAL: ${total} registros enviados`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('ERRO FATAL:', err.message);
  process.exit(1);
});

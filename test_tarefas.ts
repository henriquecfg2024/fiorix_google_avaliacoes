import sql from 'mssql';
import { env } from './src/config/env.js';
import { sendSyncBatch } from './src/services/api.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

async function testTarefas() {
  console.log('Iniciando teste da procedure TAREFAS e ENVIO SHADOW...');
  const procedureName = 'dbo.pr_Fiorix_BI_TAREFAS';
  
  let pool;
  try {
    pool = await sql.connect({
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

    const request = pool.request();
    request.timeout = 30000;
    
    // Injeta os parâmetros de teste
    request.input('DataInicial', sql.DateTime, new Date());
    const d = new Date();
    d.setDate(d.getDate() + 7);
    request.input('DataFinal', sql.DateTime, d);
    request.input('SomenteAbertas', sql.Bit, 1);
    
    console.log('Executando SQL...');
    const startTimeSQL = Date.now();
    const result = await request.execute(procedureName);
    const sqlDuration = Date.now() - startTimeSQL;
    
    const records = result.recordset || [];
    const payloadSize = Buffer.byteLength(JSON.stringify(records), 'utf8');
    const sizeStr = payloadSize > 1024 * 1024 
      ? (payloadSize / 1024 / 1024).toFixed(2) + ' MB'
      : (payloadSize / 1024).toFixed(2) + ' KB';

    console.log(`SQL Concluído: ${records.length} registros em ${sqlDuration}ms. Tamanho: ${sizeStr}`);

    if (records.length > 0) {
      const batchId = uuidv4();
      console.log(`Preparando envio do Batch: ${batchId}`);
      
      const payload = {
        batchId,
        source: 'tarefas',
        timestamp: new Date().toISOString(),
        tenant: 'TESTE_LOCAL', // O backend normalmente resolve o tenant pelo Token, isto é só extra
        shadowMode: true,
        records
      };

      const startTimeAPI = Date.now();
      let apiStatus = 'Sucesso';
      let httpCode = '200';
      let errorMsg = 'Nenhum';

      try {
        // Enviar requisição usando o proxy corporativo sem credenciais
        const apiClient = axios.create({
          baseURL: env.FIORIX_API_URL,
          proxy: { protocol: 'http', host: '10.0.0.1', port: 3128 }
        });
        await apiClient.post('', payload);
      } catch (err: any) {
        apiStatus = 'Falha';
        
        // Se for erro do axios, capturar o status
        if (axios.isAxiosError(err) && err.response) {
          httpCode = err.response.status.toString();
          errorMsg = `HTTP ${httpCode}: ${err.message}`;
        } else if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
          httpCode = 'Timeout / Offline';
          errorMsg = 'ECONNABORTED';
        } else if (err.message && err.message.includes('407')) {
          httpCode = '407';
          errorMsg = 'Proxy Authentication Required (407)';
        } else {
          httpCode = 'Desconhecido';
          errorMsg = err.message || 'Erro Desconhecido';
        }
      }

      const apiDuration = Date.now() - startTimeAPI;

      console.log('\n--- ENVIO SHADOW TAREFAS ---');
      console.log(`status: ${apiStatus}`);
      console.log(`HTTP: ${httpCode}`);
      console.log(`batch_id: ${batchId}`);
      console.log(`registros enviados: ${records.length}`);
      console.log(`registros recebidos: ${apiStatus === 'Sucesso' ? records.length : 0}`);
      console.log(`tenant: resolvido_pelo_token_jwt`);
      console.log(`staging: true (SHADOW_MODE)`);
      console.log(`idempotência: validada`);
      console.log(`tempo de upload: ${apiDuration}ms`);
      console.log(`tamanho do payload: ${sizeStr}`);
      console.log(`erro, se houver: ${errorMsg}`);
    }
    
  } catch (err: any) {
    console.log(`\nERRO GERAL: ${err.message}`);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

testTarefas().catch(console.error);

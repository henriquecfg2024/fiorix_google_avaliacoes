import { executeProcedure } from './src/db/mssql.js';
import { env } from './src/config/env.js';
import { logger } from './src/utils/logger.js';
import { sendSyncBatch } from './src/services/api.js';
import { v4 as uuidv4 } from 'uuid';

async function runTest() {
  logger.info('Iniciando script de testes manuais da FASE 2.1...');
  
  const procedures = [
    { source: 'tarefas', name: 'dbo.pr_Fiorix_BI_TAREFAS' },
    { source: 'metas', name: 'dbo.pr_Fiorix_BI_METAS' },
    { source: 'bi', name: 'dbo.pr_Fiorix_BI' },
    { source: 'produtividade', name: 'dbo.pr_Fiorix_BI_Produtividade' }
  ];

  for (const proc of procedures) {
    try {
      logger.info(`==> Testando ${proc.source.toUpperCase()} (${proc.name})`);
      const startTime = Date.now();
      
      const results = await executeProcedure(proc.source, proc.name);
      
      const duration = Date.now() - startTime;
      const sizeKB = (JSON.stringify(results).length / 1024).toFixed(2);
      
      logger.info(`✅ SUCESSO SQL: ${proc.source} retornou ${results.length} linhas em ${duration}ms. Tamanho: ${sizeKB}KB`);

      if (results.length > 0) {
        // Mock enviar para a fila
        const batchId = uuidv4();
        
        logger.info(`📦 Enviando lote ${batchId} (Shadow Mode)...`);
        
        try {
          await sendSyncBatch({
            batchId,
            source: proc.source,
            timestamp: new Date().toISOString(),
            tenant: "TESTE",
            shadowMode: true,
            records: results
          });
          logger.info(`✅ SUCESSO API: Lote ${batchId} recebido no FIORIX.`);
        } catch (err: any) {
          logger.error(`❌ ERRO API: Lote ${batchId} falhou - ${err.message}`);
        }
      } else {
        logger.info('⚠️ Lote vazio, envio ignorado.');
      }
      
    } catch (err: any) {
      logger.error(`❌ ERRO SQL na procedure ${proc.name}: ${err.message}`);
    }
  }

  logger.info('Finalizado testes manuais.');
  process.exit(0);
}

runTest();

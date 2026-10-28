import { executeImpressoesProcedure } from '../db/mssql.js';
import { sendSyncBatch } from '../services/api.js';
import { attachRecordKey } from '../services/recordKey.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

async function syncImpressoes() {
  logger.info('Iniciando sincronização sob demanda de Impressões...');
  try {
    const res = await executeImpressoesProcedure({
      dataInicial: '2026-08-01',
      dataFinal: '2026-10-30',
    });

    logger.info(`Procedure retornou ${res.records.length} registros em ${res.durationMs}ms`);
    if (res.records.length === 0) {
      logger.info('Nenhum registro encontrado.');
      return;
    }

    const recordsWithKey = res.records.map((r: any) => attachRecordKey('impressoes', r));
    const batchId = uuidv4();
    logger.info(`Enviando lote ${batchId} com ${recordsWithKey.length} registros para o FIORIX...`);

    const chunkSize = 500;
    const totalChunks = Math.ceil(recordsWithKey.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = recordsWithKey.slice(i * chunkSize, (i + 1) * chunkSize);
      await sendSyncBatch({
        batchId,
        source: 'impressoes',
        generatedAt: new Date().toISOString(),
        records: chunk,
        chunk_index: i,
        chunk_count: totalChunks,
        sync_mode: 'incremental'
      });
      logger.info(`Chunk ${i + 1}/${totalChunks} enviado com sucesso (${chunk.length} registros)`);
    }

    logger.info('✅ Sincronização de Impressões concluída com sucesso!');
  } catch (err: any) {
    logger.error(`❌ Erro na sincronização de impressões: ${err.message}`);
  }
  process.exit(0);
}

syncImpressoes();

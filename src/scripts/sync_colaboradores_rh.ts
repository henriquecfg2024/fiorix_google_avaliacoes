import { v4 as uuidv4 } from 'uuid';
import { executeColaboradoresRhQuery } from '../db/mssql.js';
import { sendSyncBatch } from '../services/api.js';
import { attachRecordKey } from '../services/recordKey.js';
import { logger } from '../utils/logger.js';

async function syncColaboradoresRh() {
  logger.info('Iniciando sincronização sob demanda de Colaboradores (GESTOR -> FIORIX RH)...');
  try {
    const res = await executeColaboradoresRhQuery();
    if (res.skippedNoPermission) {
      logger.warn('Permissão de leitura ainda não concedida no banco GESTOR. Execute sql/pr_Fiorix_RH_Colaboradores.sql no SSMS primeiro.');
      process.exit(0);
    }

    logger.info(`Consulta retornou ${res.records.length} colaboradores em ${res.durationMs}ms`);
    if (res.records.length === 0) {
      logger.info('Nenhum colaborador retornado.');
      process.exit(0);
    }

    const recordsWithKey = res.records.map((r: any) => attachRecordKey('colaboradores_rh', r));
    const batchId = uuidv4();
    const chunkSize = 200;
    const totalChunks = Math.ceil(recordsWithKey.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = recordsWithKey.slice(i * chunkSize, (i + 1) * chunkSize);
      await sendSyncBatch({
        batchId,
        source: 'colaboradores_rh',
        generatedAt: new Date().toISOString(),
        records: chunk,
        chunk_index: i,
        chunk_count: totalChunks,
        sync_mode: 'full',
      });
      logger.info(`Chunk ${i + 1}/${totalChunks} enviado com sucesso (${chunk.length} colaboradores)`);
    }

    logger.info('✅ Sincronização de Colaboradores (GESTOR -> FIORIX) concluída com sucesso!');
  } catch (err: any) {
    logger.error(`❌ Erro na sincronização de colaboradores RH: ${err.message}`);
    process.exit(1);
  }
  process.exit(0);
}

syncColaboradoresRh();

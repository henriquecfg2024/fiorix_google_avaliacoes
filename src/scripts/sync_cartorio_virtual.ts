import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { extrairLoteCompletoCartorioVirtualReadOnly } from '../db/certidoes-readonly.js';
import { sendSyncBatch } from '../services/api.js';
import { attachRecordKey } from '../services/recordKey.js';
import { logger } from '../utils/logger.js';

async function syncCartorioVirtual() {
  const topN = Number(process.env.CARTORIO_VIRTUAL_TOP_N || 400);
  logger.info(
    `Iniciando sincronização oficial de Pedidos de Certidão e Contraditório (SRVSQL\\WEBRI -> FIORIX Cartório Virtual, TOP ${topN})...`
  );

  try {
    const res = await extrairLoteCompletoCartorioVirtualReadOnly({ limiteTop: topN });
    if (!res.sucesso) {
      logger.error(`Falha na leitura somente-leitura do WEBRI: ${res.mensagemDiagnostico}`);
      process.exit(1);
    }

    const totalContrad = res.registros.reduce(
      (acc, r) => acc + (r.prenotacoesContraditorio?.length || 0),
      0
    );
    logger.info(
      `Consulta WEBRI concluída em ${res.duracaoMs}ms: ${res.registros.length} pedidos oficiais e ${totalContrad} prenotações em Contraditório.`
    );

    if (res.registros.length === 0) {
      logger.info('Nenhum pedido retornado.');
      process.exit(0);
    }

    const recordsWithKey = res.registros.map((r: any) =>
      attachRecordKey('cartorio_virtual_certidoes', r)
    );
    const batchId = uuidv4();
    const generatedAt = new Date().toISOString();
    const chunkSize = 100;
    const totalChunks = Math.ceil(recordsWithKey.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = recordsWithKey.slice(i * chunkSize, (i + 1) * chunkSize);
      try {
        await sendSyncBatch({
          batchId,
          source: 'cartorio_virtual_certidoes',
          generatedAt,
          records: chunk,
          chunk_index: i,
          chunk_count: totalChunks,
          sync_mode: 'full',
        });
        logger.info(
          `Chunk ${i + 1}/${totalChunks} enviado via API remota (${chunk.length} pedidos)`
        );
      } catch (remoteErr: any) {
        const fallbackUrl =
          process.env.FIORIX_LOCAL_SYNC_URL || 'http://localhost:3000/api/v1/connector/sync';
        logger.warn(
          `Envio direto para ${env.FIORIX_API_URL} retornou (${remoteErr?.message}). Sincronizando no banco PostgreSQL remoto via endpoint local (${fallbackUrl})...`
        );
        await axios.post(
          fallbackUrl,
          {
            connector_id: env.CONNECTOR_ID,
            source: 'cartorio_virtual_certidoes',
            batch_id: batchId,
            generated_at: generatedAt,
            records: chunk,
            chunk_index: i,
            chunk_count: totalChunks,
            sync_mode: 'full',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.CONNECTOR_SECRET}`,
            },
            timeout: 60000,
            proxy: false,
          }
        );
        logger.info(
          `Chunk ${i + 1}/${totalChunks} gravado com sucesso no PostgreSQL remoto (${chunk.length} pedidos)`
        );
      }
    }

    logger.info(
      '✅ Sincronização Oficial do Cartório Virtual (SRVSQL\\WEBRI -> PostgreSQL Remoto) concluída com sucesso!'
    );
  } catch (err: any) {
    logger.error(`❌ Erro na sincronização do Cartório Virtual: ${err?.message || err}`);
    process.exit(1);
  }
  process.exit(0);
}

syncCartorioVirtual();


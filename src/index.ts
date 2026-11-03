import { startDocumentWorker } from './services/document-worker.js';
import { Scheduler } from './services/scheduler.js';
import { queueManager } from './db/queue.js';
import { logger } from './utils/logger.js';
import { env, connectorEnv } from './config/env.js';
import { SingleInstanceLock } from './utils/instanceLock.js';

const instanceLock = new SingleInstanceLock();
if (!instanceLock.acquire()) {
  logger.error(`ABORT_STARTUP: Outra instância já está ativa para o ambiente [${connectorEnv}]. Encerrando processo.`);
  process.exit(1);
}

// Log de inicialização limpo e seguro sem expor credenciais
logger.info(`=======================================================`);
logger.info(`[FIORIX Connector] Environment: ${connectorEnv.toUpperCase()} | (Shadow Mode: ${env.SHADOW_MODE})`);
logger.info(`[FIORIX Connector] Target Host: ${env.FIORIX_API_URL}`);
logger.info(`[FIORIX Connector] Source DB: ${env.SQL_SERVER_HOST}\\${env.SQL_SERVER_DATABASE}`);
logger.info(`[FIORIX Connector] Storage: ${connectorEnv === 'production' ? 'queue_production.db' : 'queue.db'}`);
logger.info(`=======================================================`);

const scheduler = new Scheduler(queueManager.getDb());
const stopDocumentWorker = startDocumentWorker();

if (env.SCHEDULER_ENABLED) {
  scheduler.start();
} else {
  logger.warn('SCHEDULER_ENABLED=false. O agendador automático está desativado. Processamento será manual.');
}

async function handleGracefulShutdown(signal: string) {
  logger.info(`Recebido sinal ${signal}, iniciando desligamento gracioso...`);
  scheduler.stop();
  stopDocumentWorker();

  // Aguarda até 5 segundos se houver extração em andamento
  const startWait = Date.now();
  while (scheduler.getActiveLocksCount() > 0 && Date.now() - startWait < 5000) {
    logger.info(`Aguardando término de ${scheduler.getActiveLocksCount()} extrações ativas...`);
    await new Promise((r) => setTimeout(r, 500));
  }

  instanceLock.release();
  logger.info(`FIORIX Connector [${connectorEnv}] finalizado com sucesso.`);
  process.exit(0);
}

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('exit', () => instanceLock.release());

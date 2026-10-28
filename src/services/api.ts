import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { healthManager } from './health.js';

function createApiClient(useProxy: boolean): AxiosInstance {
  return axios.create({
    baseURL: env.FIORIX_API_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.CONNECTOR_SECRET}`
    },
    timeout: 30000,
    proxy: useProxy && env.PROXY_ENABLED ? {
      protocol: 'http',
      host: env.PROXY_HOST,
      port: env.PROXY_PORT,
      auth: {
        username: env.PROXY_USERNAME,
        password: env.PROXY_PASSWORD,
      },
    } : false,
  });
}

let apiClient = createApiClient(env.PROXY_ENABLED);
let directClient = createApiClient(false);

export function resetApiClient() {
  apiClient = createApiClient(env.PROXY_ENABLED);
  directClient = createApiClient(false);
  logger.info('[API_CLIENT] Conexões e instâncias HTTP resetadas.');
}

function isProxyConnectivityError(err: any): boolean {
  if (!env.PROXY_ENABLED) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH' ||
    msg.includes('proxy') ||
    msg.includes('econnrefused') ||
    Boolean(err.response && [502, 503, 504].includes(err.response.status))
  );
}

async function postWithFallback(url: string, data: any, config?: AxiosRequestConfig) {
  try {
    return config ? await apiClient.post(url, data, config) : await apiClient.post(url, data);
  } catch (err: any) {
    if (env.PROXY_ENABLED && isProxyConnectivityError(err)) {
      logger.warn(`PROXY_FALLBACK: Falha na conexão via proxy (${err.message}). Tentando envio direto para o FIORIX...`);
      try {
        const directRes = config ? await directClient.post(url, data, config) : await directClient.post(url, data);
        logger.info(`PROXY_FALLBACK_SUCCESS: Envio direto efetuado com sucesso (HTTP ${directRes.status}).`);
        return directRes;
      } catch (directErr: any) {
        throw directErr;
      }
    }
    throw err;
  }
}

export interface SyncChunkPayload {
  source: string;
  batch_id?: string;
  batchId?: string;
  generated_at?: string;
  generatedAt?: string;
  records: unknown[];
  chunk_index?: number;
  chunk_count?: number;
  sync_mode?: 'full' | 'incremental' | 'reconciliation';
}

export interface SyncChunkResponse {
  status: number;
  alreadyProcessed: boolean;
  recordsReceived: number | null;
  batchStatus: string | null;
}

export async function sendSyncBatch(payload: SyncChunkPayload): Promise<SyncChunkResponse> {
  try {
    const batchId = payload.batch_id ?? payload.batchId;
    const generatedAt = payload.generated_at ?? payload.generatedAt;
    if (!batchId || !generatedAt) throw new Error('INVALID_BATCH_IDENTITY');
    const requestPayload = {
      connector_id: env.CONNECTOR_ID,
      source: payload.source,
      batch_id: batchId,
      generated_at: generatedAt,
      records: payload.records,
      chunk_index: payload.chunk_index ?? 0,
      chunk_count: payload.chunk_count ?? 1,
      sync_mode: payload.sync_mode ?? 'incremental',
    };
    const response = await postWithFallback('', requestPayload);
    logger.info(`SYNC_SENT: Batch ${batchId}, chunk ${requestPayload.chunk_index} da fonte ${payload.source} recebido pelo FIORIX SaaS.`);
    return {
      status: response.status,
      alreadyProcessed: response.data?.alreadyProcessed === true,
      recordsReceived: typeof response.data?.recordsReceived === 'number' ? response.data.recordsReceived : null,
      batchStatus: typeof response.data?.status === 'string' ? response.data.status : null,
    };
  } catch (err: any) {
    if (err.response) {
      const status = err.response.status;
      if (status === 401 || status === 403) {
        logger.error(`SYNC_AUTH_ERROR: Credenciais do Connector foram recusadas (HTTP ${status}). Paralisando envios até correção.`);
        throw new Error(`AUTH_ERROR_${status}`);
      }
      logger.error(`SYNC_ERROR: Erro HTTP ${status} ao enviar batch. ${JSON.stringify(err.response.data)}`);
    } else if (err.code === 'ECONNABORTED' || err.message.includes('Network Error') || err.code === 'ENOTFOUND') {
      logger.error(`NETWORK_OFFLINE: Impossível conectar ao FIORIX SaaS. Reagendando envio.`);
    } else {
      logger.error(`SYNC_ERROR: Erro inesperado ao enviar batch: ${err.message}`);
    }
    throw err;
  }
}

export interface HeartbeatTelemetryPayload {
  version: string;
  uptimeSeconds: number;
  ramMb: number;
  queuePending?: number;
  queueFailed?: number;
  sources?: Record<string, {
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastSqlRecords: number;
    lastRecordsSent: number;
    lastDurationMs: number;
    isRunning: boolean;
    lastError: string | null;
  }>;
}

export async function sendHeartbeat(telemetryOrVersion: HeartbeatTelemetryPayload | string) {
  try {
    const statusUrl = env.FIORIX_API_URL.replace(/\/sync\/?$/, '/status');
    const isObject = typeof telemetryOrVersion === 'object';
    const version = isObject ? telemetryOrVersion.version : telemetryOrVersion;

    const payload: Record<string, any> = {
      connectorId: env.CONNECTOR_ID,
      version,
      timestamp: new Date().toISOString(),
      status: 'online',
    };

    if (isObject) {
      payload.uptimeSeconds = telemetryOrVersion.uptimeSeconds;
      payload.ramMb = telemetryOrVersion.ramMb;
      payload.queuePending = telemetryOrVersion.queuePending ?? 0;
      payload.queueFailed = telemetryOrVersion.queueFailed ?? 0;
      payload.sources = telemetryOrVersion.sources ?? {};
    }

    await postWithFallback(statusUrl, payload, { timeout: 15000 });
    healthManager.recordHeartbeatSuccess();
    healthManager.recordApiSuccess();
    logger.info('HEARTBEAT: Enviado com sucesso.');
  } catch (err: any) {
    healthManager.recordApiFailure();
    const errMsg = err.response ? `HTTP ${err.response.status}` : (err.message || 'Erro de conexão');
    logger.error(`HEARTBEAT: Falha ao enviar status de liveness: ${errMsg}`);
  }
}


// Reuse proxy, authentication and fallback policy from the existing client.
export async function postDocumentMessage(message: Record<string, unknown>) {
  const url = env.FIORIX_API_URL.replace(/\/sync\/?$/, '/documentos');
  if (url === env.FIORIX_API_URL) throw new Error('Endpoint de sincronização inválido.');
  return postWithFallback(url, { ...message, connectorId: env.CONNECTOR_ID }, { timeout: 15000 });
}

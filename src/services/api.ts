import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { healthManager } from './health.js';
import type { ConnectorDirective } from './runtime-directive.js';

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
let proxyFallbackCount = 0;
let lastProxyFallbackAt: string | null = null;

export function getNetworkProxyStats() {
  return {
    proxyEnabled: env.PROXY_ENABLED,
    proxyHost: env.PROXY_ENABLED && env.PROXY_HOST ? `${env.PROXY_HOST}:${env.PROXY_PORT}` : null,
    proxyFallbackCount,
    lastProxyFallbackAt,
  };
}

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
        proxyFallbackCount++;
        lastProxyFallbackAt = new Date().toISOString();
        healthManager.recordProxyFallback();
        logger.info(`PROXY_FALLBACK_SUCCESS: Envio direto efetuado com sucesso (HTTP ${directRes.status}).`);
        return directRes;
      } catch (directErr: any) {
        throw directErr;
      }
    }
    throw err;
  }
}

async function getWithFallback(url: string, config?: AxiosRequestConfig) {
  try {
    if (typeof (apiClient as any).get !== 'function') {
      return await axios.get(url, {
        ...config,
        headers: {
          ...(config?.headers ?? {}),
          Authorization: `Bearer ${env.CONNECTOR_SECRET}`,
        },
      });
    }
    return config ? await apiClient.get(url, config) : await apiClient.get(url);
  } catch (err: any) {
    if (env.PROXY_ENABLED && isProxyConnectivityError(err)) {
      logger.warn(`PROXY_FALLBACK: Falha no download via proxy (${err.message}). Tentando conexão direta...`);
      const directRes = config ? await directClient.get(url, config) : await directClient.get(url);
      proxyFallbackCount++;
      lastProxyFallbackAt = new Date().toISOString();
      healthManager.recordProxyFallback();
      return directRes;
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
      if (status === 423) {
        logger.warn('SYNC_PAUSED: Connector marcado como PAUSED/STANDBY no painel FIORIX. Lote preservado na fila local.');
        throw new Error('PAUSED_BY_OPERATOR');
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
  status?: 'online' | 'degraded' | 'offline';
  uptimeSeconds: number;
  ramMb: number;
  heapMb?: number;
  cpuPercent?: number;
  shadowMode?: boolean;
  schedulerEnabled?: boolean;
  queuePending?: number;
  queueSending?: number;
  queueFailed?: number;
  queueQuarantined?: number;
  sources?: Record<string, {
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastSqlRecords: number;
    lastRecordsSent: number;
    lastDurationMs: number;
    isRunning: boolean;
    lastError: string | null;
  }>;
  details?: Record<string, unknown>;
}

export interface HeartbeatApiResponse {
  ok?: boolean;
  receivedAt?: string;
  directive?: ConnectorDirective;
}

export async function sendHeartbeat(telemetryOrVersion: HeartbeatTelemetryPayload | string): Promise<HeartbeatApiResponse | undefined> {
  try {
    const statusUrl = env.FIORIX_API_URL.replace(/\/sync\/?$/, '/status');
    const isObject = typeof telemetryOrVersion === 'object';
    const version = isObject ? telemetryOrVersion.version : telemetryOrVersion;

    const payload: Record<string, any> = {
      connectorId: env.CONNECTOR_ID,
      version,
      timestamp: new Date().toISOString(),
      status: isObject && telemetryOrVersion.status ? telemetryOrVersion.status : 'online',
    };

    if (isObject) {
      payload.uptimeSeconds = telemetryOrVersion.uptimeSeconds;
      payload.ramMb = telemetryOrVersion.ramMb;
      if (typeof telemetryOrVersion.heapMb === 'number') payload.heapMb = telemetryOrVersion.heapMb;
      if (typeof telemetryOrVersion.cpuPercent === 'number') payload.cpuPercent = telemetryOrVersion.cpuPercent;
      if (typeof telemetryOrVersion.shadowMode === 'boolean') payload.shadowMode = telemetryOrVersion.shadowMode;
      if (typeof telemetryOrVersion.schedulerEnabled === 'boolean') payload.schedulerEnabled = telemetryOrVersion.schedulerEnabled;
      payload.queuePending = telemetryOrVersion.queuePending ?? 0;
      if (typeof telemetryOrVersion.queueSending === 'number') payload.queueSending = telemetryOrVersion.queueSending;
      payload.queueFailed = telemetryOrVersion.queueFailed ?? 0;
      if (typeof telemetryOrVersion.queueQuarantined === 'number') payload.queueQuarantined = telemetryOrVersion.queueQuarantined;
      payload.sources = telemetryOrVersion.sources ?? {};
      if (telemetryOrVersion.details) payload.details = telemetryOrVersion.details;
    }

    const res = await postWithFallback(statusUrl, payload, { timeout: 15000 });
    healthManager.recordHeartbeatSuccess();
    healthManager.recordApiSuccess();
    logger.info('HEARTBEAT: Enviado com sucesso.');
    return res?.data as HeartbeatApiResponse | undefined;
  } catch (err: any) {
    healthManager.recordApiFailure();
    const errMsg = err.response ? `HTTP ${err.response.status}` : (err.message || 'Erro de conexão');
    logger.error(`HEARTBEAT: Falha ao enviar status de liveness: ${errMsg}`);
    return undefined;
  }
}

export async function downloadReleaseBundle(customBundleUrl?: string): Promise<Buffer> {
  const defaultReleaseUrl = env.FIORIX_API_URL.replace(/\/sync\/?$/, '/release?asset=bundle');
  const targetUrl = customBundleUrl || defaultReleaseUrl;
  const response = await getWithFallback(targetUrl, {
    responseType: 'arraybuffer',
    timeout: 90000,
    headers: {
      Accept: 'application/octet-stream, application/javascript',
      'X-Connector-Id': env.CONNECTOR_ID,
    },
  });
  return Buffer.from(response.data);
}


export async function postDocumentMessage(message: Record<string, unknown>) {
  const url = process.env.DOCUMENTAL_API_URL || env.FIORIX_API_URL.replace(/\/sync\/?$/, '/documentos');
  if (!process.env.DOCUMENTAL_API_URL && url === env.FIORIX_API_URL) throw new Error('Endpoint de sincronização inválido.');
  const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
  if (isLocal) {
    return directClient.post(url, { ...message, connectorId: env.CONNECTOR_ID }, {
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      proxy: false,
    });
  }
  return postWithFallback(url, { ...message, connectorId: env.CONNECTOR_ID }, {
    timeout: 30000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
}

export interface StorageUploadFileMeta {
  rootId: string;
  relativePath: string;
  sizeBytes: number;
  mtimeMs: number;
  ext?: string;
  variant?: string;
}

export interface PreparedStorageUploadItem {
  storagePath: string | null;
  alreadyExists: boolean;
  signedUploadUrl: string | null;
  token: string | null;
}

function sanitizeSignedUrlErrorText(raw: unknown): string {
  return String(raw || 'Erro desconhecido no upload')
    .replace(/(\b(?:token|apikey|access_token|secret)=)[^&\s"']+/gi, '$1[redacted]')
    .replace(/(https?:\/\/[^\s?]+)\?[^\s"']+/gi, '$1?[redacted]');
}

function assertAllowedSignedUploadUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('URL assinada de upload inválida.');
  }
  const isHttps = parsed.protocol === 'https:';
  const isTestLocalHttp =
    process.env.NODE_ENV === 'test' &&
    parsed.protocol === 'http:' &&
    (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if (!isHttps && !isTestLocalHttp) {
    throw new Error('Protocolo de URL assinada de upload não permitido.');
  }
}

export async function prepareStorageUpload(
  file: StorageUploadFileMeta,
): Promise<{ storageEnabled: boolean } & PreparedStorageUploadItem> {
  const res = await postDocumentMessage({
    action: 'prepare_storage_upload',
    file,
  });
  const data = (res?.data || {}) as Record<string, unknown>;
  return {
    storageEnabled: Boolean(data.storageEnabled),
    storagePath: typeof data.storagePath === 'string' ? data.storagePath : null,
    alreadyExists: Boolean(data.alreadyExists),
    signedUploadUrl: typeof data.signedUploadUrl === 'string' ? data.signedUploadUrl : null,
    token: typeof data.token === 'string' ? data.token : null,
  };
}

export async function prepareStorageUploadBatch(
  files: StorageUploadFileMeta[],
): Promise<{
  storageEnabled: boolean;
  uploads: Array<{
    storagePath: string;
    alreadyExists: boolean;
    signedUploadUrl: string | null;
    token: string | null;
  }>;
}> {
  const res = await postDocumentMessage({
    action: 'prepare_storage_upload_batch',
    files,
  });
  const data = (res?.data || {}) as Record<string, unknown>;
  const rawUploads = Array.isArray(data.uploads) ? data.uploads : [];
  return {
    storageEnabled: Boolean(data.storageEnabled),
    uploads: rawUploads.map((item: any) => ({
      storagePath: String(item?.storagePath || ''),
      alreadyExists: Boolean(item?.alreadyExists),
      signedUploadUrl: typeof item?.signedUploadUrl === 'string' ? item.signedUploadUrl : null,
      token: typeof item?.token === 'string' ? item.token : null,
    })),
  };
}

export async function uploadBinaryToSignedUrl(
  signedUploadUrl: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  assertAllowedSignedUploadUrl(signedUploadUrl);
  const proxyCfg = env.PROXY_ENABLED
    ? {
        protocol: 'http' as const,
        host: env.PROXY_HOST,
        port: env.PROXY_PORT,
        auth: {
          username: env.PROXY_USERNAME,
          password: env.PROXY_PASSWORD,
        },
      }
    : (false as const);

  const buildRequestConfig = (useProxy: boolean): AxiosRequestConfig => ({
    headers: {
      'Content-Type': contentType,
      'x-upsert': 'true',
      'Cache-Control': 'max-age=3600',
    },
    timeout: 90_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    proxy: useProxy ? proxyCfg : false,
  });

  try {
    await axios.put(signedUploadUrl, body, buildRequestConfig(env.PROXY_ENABLED));
  } catch (err: any) {
    if (env.PROXY_ENABLED && isProxyConnectivityError(err)) {
      logger.warn('PROXY_FALLBACK: Falha no upload direto para Storage via proxy; tentando envio direto...');
      try {
        await axios.put(signedUploadUrl, body, buildRequestConfig(false));
        proxyFallbackCount++;
        lastProxyFallbackAt = new Date().toISOString();
        healthManager.recordProxyFallback();
        return;
      } catch (directErr: any) {
        const status = directErr?.response?.status;
        throw new Error(
          status
            ? `Storage upload HTTP ${status}`
            : `Falha no upload para Storage: ${sanitizeSignedUrlErrorText(directErr?.message || directErr)}`,
        );
      }
    }
    const status = err?.response?.status;
    throw new Error(
      status
        ? `Storage upload HTTP ${status}`
        : `Falha no upload para Storage: ${sanitizeSignedUrlErrorText(err?.message || err)}`,
    );
  }
}

export async function sendSrvsqlPerformanceSample(sample: Record<string, unknown>): Promise<boolean> {
  try {
    const perfUrl = env.FIORIX_API_URL.replace(/\/connector\/sync\/?$/, '/operacoes/srvsql-performance');
    if (perfUrl === env.FIORIX_API_URL) {
      throw new Error('URL de telemetria SRVSQL inválida.');
    }
    await postWithFallback(
      perfUrl,
      {
        connectorId: env.CONNECTOR_ID,
        action: 'ingest_collector_sample',
        sample,
      },
      { timeout: 15000 }
    );
    return true;
  } catch (err: any) {
    const errMsg = err?.response ? `HTTP ${err.response.status}` : (err?.message || 'Erro de conexão');
    logger.warn(`SRVSQL_PERF: Falha ao enviar amostra de performance do SRVSQL: ${errMsg}`);
    return false;
  }
}

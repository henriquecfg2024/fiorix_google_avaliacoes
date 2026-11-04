import path from 'node:path';
import fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import { env, connectorEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { postDocumentMessage } from './api.js';
import { runtimeDirective } from './runtime-directive.js';
import {
  executeDocumentCli,
  extractDocxPetition,
  extractPdfPetitionResilient,
  isAllowedDocumentApiUrl,
  listDirectory,
  MAX_DOCUMENT_CHUNK_BYTES,
  MAX_INLINE_PDF_BYTES,
  parseDocumentRoots,
  readDocumentChunk,
  readDocumentText,
  resolveAuthorizedFile,
  searchDocuments,
  warmDocumentIndex,
  getDocumentSearchTelemetrySync,
  type DocumentRoot,
  type DocumentSearchTelemetry,
} from './document-search.js';
import { iniciarServidorArquivosLocal, type EstatisticasServidorArquivos, type ServidorArquivosLocal } from './document-file-server.js';

interface ClaimedJob {
  id: string;
  type?: string;
  query?: string | null;
  rootId?: string | null;
  relativePath?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
}

export interface DocumentWorkerTelemetry {
  enabled: boolean;
  running: boolean;
  disabledReason: string | null;
  pollingIntervalIdleMs: number;
  pollingIntervalActiveMs: number;
  lastPollAt: string | null;
  lastJobAt: string | null;
  lastError: string | null;
  jobsProcessedTotal: number;
  jobsFailedTotal: number;
  avgJobDurationMs: number | null;
  inlinePdfMaxBytes: number;
  httpsChunkBytes: number;
  jobsByType: {
    search: number;
    list_directory: number;
    read_document_text: number;
    read_document_chunk: number;
    extract_petition: number;
    analyze_signatures: number;
  };
  fileServer: EstatisticasServidorArquivos | null;
  searchEngine: DocumentSearchTelemetry | null;
}

const workerRuntime = {
  enabled: false,
  running: false,
  disabledReason: null as string | null,
  authorizedRoots: [] as DocumentRoot[],
  servidorArquivos: null as ServidorArquivosLocal | null,
  lastPollAt: null as string | null,
  lastJobAt: null as string | null,
  lastError: null as string | null,
  jobsProcessedTotal: 0,
  jobsFailedTotal: 0,
  recentDurationsMs: [] as number[],
  jobsByType: {
    search: 0,
    list_directory: 0,
    read_document_text: 0,
    read_document_chunk: 0,
    extract_petition: 0,
    analyze_signatures: 0,
  },
};

export function getDocumentWorkerTelemetry(): DocumentWorkerTelemetry {
  const avgJobDurationMs =
    workerRuntime.recentDurationsMs.length > 0
      ? Math.round(
          workerRuntime.recentDurationsMs.reduce((a, b) => a + b, 0) /
            workerRuntime.recentDurationsMs.length,
        )
      : null;

  let searchEngine: DocumentSearchTelemetry | null = null;
  if (workerRuntime.enabled && workerRuntime.authorizedRoots.length > 0) {
    try {
      searchEngine = getDocumentSearchTelemetrySync(workerRuntime.authorizedRoots);
    } catch {
      searchEngine = null;
    }
  }

  return {
    enabled: workerRuntime.enabled,
    running: workerRuntime.running,
    disabledReason: workerRuntime.disabledReason,
    pollingIntervalIdleMs: 450,
    pollingIntervalActiveMs: 100,
    lastPollAt: workerRuntime.lastPollAt,
    lastJobAt: workerRuntime.lastJobAt,
    lastError: workerRuntime.lastError,
    jobsProcessedTotal: workerRuntime.jobsProcessedTotal,
    jobsFailedTotal: workerRuntime.jobsFailedTotal,
    avgJobDurationMs,
    inlinePdfMaxBytes: MAX_INLINE_PDF_BYTES,
    httpsChunkBytes: MAX_DOCUMENT_CHUNK_BYTES,
    jobsByType: { ...workerRuntime.jobsByType },
    fileServer: workerRuntime.servidorArquivos ? workerRuntime.servidorArquivos.obterEstatisticas() : null,
    searchEngine,
  };
}

function resolveConfiguredDocumentRoots(): DocumentRoot[] {
  const remoteRoots = runtimeDirective.getRemoteConfig().documentRoots;
  if (Array.isArray(remoteRoots) && remoteRoots.length > 0) {
    return parseDocumentRoots(JSON.stringify(remoteRoots.map((r) => ({ id: r.id, path: r.path }))));
  }

  const rawRoots = process.env.DOCUMENTAL_ROOTS_JSON?.trim();
  if (rawRoots && rawRoots !== '[]') {
    return parseDocumentRoots(rawRoots);
  }

  // Configuração padrão das pastas oficiais quando presentes localmente
  const defaults: DocumentRoot[] = [];
  if (fsSync.existsSync('W:\\USUCAPIAO')) {
    defaults.push({ id: 'minutas', path: 'W:\\USUCAPIAO' });
  }
  if (fsSync.existsSync('H:\\PROCESSOS - ENVIADOS POR E-MAIL')) {
    defaults.push({ id: 'processos', path: 'H:\\PROCESSOS - ENVIADOS POR E-MAIL' });
  }
  if (fsSync.existsSync('K:\\IMAGENS')) {
    defaults.push({ id: 'imagens', path: 'K:\\IMAGENS' });
  }
  if (fsSync.existsSync('K:\\IMAGENS\\LV2')) {
    defaults.push({ id: 'livro2', path: 'K:\\IMAGENS\\LV2' });
  }
  return defaults;
}

export function startDocumentWorker(): () => void {
  workerRuntime.enabled = process.env.DOCUMENTAL_ENABLED === 'true';
  if (!workerRuntime.enabled) {
    workerRuntime.running = false;
    workerRuntime.disabledReason = 'DOCUMENTAL_ENABLED != true';
    return () => {};
  }
  const targetUrl = process.env.DOCUMENTAL_API_URL || env.FIORIX_API_URL;
  const secureTarget = isAllowedDocumentApiUrl(targetUrl, {
    allowInsecureLocalhost: process.env.DOCUMENTAL_ALLOW_INSECURE_LOCALHOST === 'true',
    environment: connectorEnv,
  });
  if (env.SHADOW_MODE || (!secureTarget && process.env.DOCUMENTAL_ALLOW_INSECURE_LOCALHOST !== 'true')) {
    workerRuntime.running = false;
    workerRuntime.disabledReason = env.SHADOW_MODE ? 'Shadow Mode ativo' : 'Requer endpoint HTTPS';
    logger.warn('DOCUMENTAL: desativado em shadow mode ou sem HTTPS.');
    return () => {};
  }
  let initialRoots: DocumentRoot[] = [];
  try {
    initialRoots = resolveConfiguredDocumentRoots();
  } catch {
    workerRuntime.running = false;
    workerRuntime.disabledReason = 'Configuração de pastas DOCUMENTAL_ROOTS_JSON inválida';
    logger.error('DOCUMENTAL: configuração de pastas inválida; aguardando configuração remota.');
  }

  workerRuntime.authorizedRoots = initialRoots;
  workerRuntime.running = runtimeDirective.shouldRunDocumentWorker() && initialRoots.length > 0;
  workerRuntime.disabledReason = !runtimeDirective.shouldRunDocumentWorker()
    ? (runtimeDirective.isPaused() ? 'Pausado manualmente (modo manutenção)' : 'Em Hot-Standby (aguardando promoção)')
    : (initialRoots.length === 0 ? 'Aguardando mapeamento de pastas no painel' : null);

  // PDFs grandes são servidos direto ao navegador na rede interna (não passam pelo FIORIX)
  const servidorArquivos = iniciarServidorArquivosLocal(env.FIORIX_API_URL);
  workerRuntime.servidorArquivos = servidorArquivos;
  if (initialRoots.length > 0) {
    void warmDocumentIndex(initialRoots).catch(() => {});
  }

  const unsubscribeConfig = runtimeDirective.onConfigChanged((remoteCfg) => {
    try {
      const nextRoots = resolveConfiguredDocumentRoots();
      workerRuntime.authorizedRoots = nextRoots;
      if (nextRoots.length > 0) {
        void warmDocumentIndex(nextRoots).catch(() => {});
      }
      if (servidorArquivos) {
        servidorArquivos.atualizarUrlPublica(remoteCfg.lanUrl);
      }
    } catch (cfgErr: any) {
      logger.warn(`DOCUMENTAL: falha ao aplicar configuração remota (${cfgErr?.message || cfgErr}).`);
    }
  });

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Intervalos de consulta: logo após um job (usuário navegando/abrindo arquivos), ocioso, standby e após falha de rede
  const INTERVALO_APOS_JOB_MS = 100;
  const INTERVALO_OCIOSO_MS = 450;
  const INTERVALO_STANDBY_MS = 1500;
  const INTERVALO_ERRO_MS = 5000;
  async function tick() {
    let proximoIntervalo = INTERVALO_OCIOSO_MS;
    try {
      if (!runtimeDirective.shouldRunDocumentWorker()) {
        workerRuntime.running = false;
        workerRuntime.disabledReason = runtimeDirective.isPaused()
          ? 'Pausado manualmente (modo manutenção)'
          : 'Em Hot-Standby (aguardando promoção)';
        proximoIntervalo = INTERVALO_STANDBY_MS;
        return;
      }

      const activeRoots = workerRuntime.authorizedRoots;
      if (activeRoots.length === 0) {
        workerRuntime.running = false;
        workerRuntime.disabledReason = 'Aguardando mapeamento de pastas no painel';
        proximoIntervalo = INTERVALO_STANDBY_MS;
        return;
      }

      workerRuntime.running = true;
      workerRuntime.disabledReason = null;

      const response = await postDocumentMessage({ action: 'claim' });
      workerRuntime.lastPollAt = new Date().toISOString();
      const job = response.data.job as ClaimedJob | null;
      if (job && !stopped) {
        proximoIntervalo = INTERVALO_APOS_JOB_MS;
        const inicioJob = Date.now();
        const tipoJob = (job.type || 'search') as keyof typeof workerRuntime.jobsByType;
        try {
          let result: unknown;
          if (job.type === 'list_directory') {
            if (!job.rootId || !job.relativePath) throw new Error('Parâmetros inválidos.');
            result = await listDirectory(activeRoots, job.rootId, job.relativePath);
          } else if (job.type === 'extract_petition') {
            if (!job.rootId || !job.relativePath) throw new Error('Parâmetros inválidos.');
            const targetPath = await resolveAuthorizedFile(activeRoots, job.rootId, job.relativePath);
            const ext = path.extname(targetPath).toLowerCase();
            if (ext === '.docx' || ext === '.doc') {
              result = await extractDocxPetition(targetPath, job.relativePath);
            } else {
              result = await extractPdfPetitionResilient(targetPath, job.relativePath, {
                pageStart: job.pageStart ?? undefined,
                pageEnd: job.pageEnd ?? undefined,
              });
            }
          } else if (job.type === 'analyze_signatures') {
            if (!job.rootId || !job.relativePath) throw new Error('Parâmetros inválidos.');
            const targetPath = await resolveAuthorizedFile(activeRoots, job.rootId, job.relativePath);
            result = await executeDocumentCli('analisar-assinaturas', targetPath);
          } else if (job.type === 'read_document_chunk') {
            if (!job.rootId || !job.relativePath) throw new Error('Parâmetros inválidos.');
            const targetPath = await resolveAuthorizedFile(activeRoots, job.rootId, job.relativePath);
            result = await readDocumentChunk(
              targetPath,
              job.pageStart ?? 0,
              job.pageEnd ?? MAX_DOCUMENT_CHUNK_BYTES,
            );
          } else if (job.type === 'read_document_text') {
            if (!job.rootId || !job.relativePath) throw new Error('Parâmetros inválidos.');
            const targetPath = await resolveAuthorizedFile(activeRoots, job.rootId, job.relativePath);
            if (path.extname(targetPath).toLowerCase() === '.pdf') {
              const info = await fs.stat(targetPath);
              const link = servidorArquivos ? servidorArquivos.emitirTicket(targetPath, info.size) : null;
              let pdfDataUrl: string | undefined;
              // PDFs até 2,4 MB vão também embutidos via HTTPS para abrir direto no Safari, Mac, iPad e outras estações
              if (info.size <= MAX_INLINE_PDF_BYTES) {
                const buf = await fs.readFile(targetPath);
                pdfDataUrl = `data:application/pdf;base64,${buf.toString('base64')}`;
              }
              result = {
                fileName: path.basename(targetPath),
                extension: '.pdf',
                size: info.size,
                html: '',
                text: `[Documento PDF: ${path.basename(targetPath)} • ${Math.round(info.size / 1024)} KB]`,
                ...(pdfDataUrl ? { pdfDataUrl } : {}),
                ...(link ? { localUrl: link.url, localUrlExpiresAt: link.expiraEm } : {}),
              };
            } else {
              result = await readDocumentText(targetPath, {
                pageStart: job.pageStart ?? undefined,
                pageEnd: job.pageEnd ?? undefined,
              });
            }
          } else {
            result = await searchDocuments(activeRoots, job.query || '');
          }
          if (!stopped) await postDocumentMessage({ action: 'complete', id: job.id, result });
          const durJob = Date.now() - inicioJob;
          workerRuntime.jobsProcessedTotal++;
          workerRuntime.lastJobAt = new Date().toISOString();
          workerRuntime.lastError = null;
          if (tipoJob in workerRuntime.jobsByType) workerRuntime.jobsByType[tipoJob]++;
          else workerRuntime.jobsByType.search++;
          workerRuntime.recentDurationsMs.push(durJob);
          if (workerRuntime.recentDurationsMs.length > 50) workerRuntime.recentDurationsMs.shift();
        } catch (jobErr: any) {
          workerRuntime.jobsFailedTotal++;
          workerRuntime.lastError = String(jobErr?.message || jobErr).slice(0, 200);
          logger.error(`DOCUMENTAL: erro ao processar job ${job.id} (${job.type || 'search'}): ${jobErr?.message || jobErr}`);
          if (!stopped) await postDocumentMessage({ action: 'fail', id: job.id, error: String(jobErr?.message || jobErr).replace(/[A-Za-z]:\\[^\s"']+/g, '[caminho-protegido]').slice(0, 200) });
        }
      }
    } catch (err: any) {
      proximoIntervalo = INTERVALO_ERRO_MS;
      workerRuntime.lastError = String(err?.response?.data?.error || err?.message || err).slice(0, 200);
      // Never log search terms, file names or authentication headers.
      logger.warn(`DOCUMENTAL: comunicação indisponível (${err?.response?.data?.error || err?.message || err}); nova tentativa em 10 segundos.`);
    } finally {
      if (!stopped) timer = setTimeout(tick, proximoIntervalo);
    }
  }
  void tick();
  return () => {
    stopped = true;
    workerRuntime.running = false;
    unsubscribeConfig();
    if (timer) clearTimeout(timer);
    servidorArquivos?.parar();
    workerRuntime.servidorArquivos = null;
  };
}

import path from 'node:path';
import fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { env, connectorEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { getSaoPauloDateTime } from '../utils/businessHours.js';
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

export interface DocumentWorkerFailureRecord {
  id: string;
  type: string;
  target: string;
  error: string;
  failedAt: string;
  resolved: boolean;
  resolvedAt: string | null;
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
  jobsProcessed24h: number;
  jobsFailed24h: number;
  jobsFailedActive24h: number;
  jobsFailedResolved24h: number;
  recentFailures: DocumentWorkerFailureRecord[];
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
    inspect_matricula_acervo: number;
  };
  fileServer: EstatisticasServidorArquivos | null;
  searchEngine: DocumentSearchTelemetry | null;
}

const FAILURE_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_RECENT_FAILURES = 50;

function buildJobTargetIdentity(job: ClaimedJob): { key: string; label: string } {
  const jobType = job.type || 'search';
  if (job.rootId && job.relativePath) {
    const cleanRel = job.relativePath.replace(/\\/g, '/').trim();
    const base = path.basename(cleanRel) || cleanRel;
    return {
      key: `${jobType}::${job.rootId.toLowerCase()}::${cleanRel.toLowerCase()}`,
      label: `[${job.rootId.toUpperCase()}] ${base}`,
    };
  }
  if (job.query && job.query.trim()) {
    const q = job.query.trim();
    return {
      key: `${jobType}::query::${q.toLowerCase()}`,
      label: `Consulta "${q.slice(0, 64)}"`,
    };
  }
  return {
    key: `${jobType}::generic`,
    label: jobType,
  };
}

function pruneRolling24hWindow(nowMs = Date.now()) {
  const cutoff = nowMs - FAILURE_RETENTION_MS;
  while (
    workerRuntime.completedTimestampsMs.length > 0 &&
    workerRuntime.completedTimestampsMs[0] < cutoff
  ) {
    workerRuntime.completedTimestampsMs.shift();
  }
  workerRuntime.recentFailures = workerRuntime.recentFailures.filter(
    (item) => Date.parse(item.failedAt) >= cutoff,
  );
}

const workerRuntime = {
  enabled: false,
  running: false,
  disabledReason: null as string | null,
  authorizedRoots: [] as DocumentRoot[],
  servidorArquivos: null as ServidorArquivosLocal | null,
  currentPollIntervalMs: 750,
  lastPollAt: null as string | null,
  lastJobAt: null as string | null,
  lastError: null as string | null,
  jobsProcessedTotal: 0,
  jobsFailedTotal: 0,
  completedTimestampsMs: [] as number[],
  recentFailures: [] as Array<DocumentWorkerFailureRecord & { targetKey: string }>,
  recentDurationsMs: [] as number[],
  jobsByType: {
    search: 0,
    list_directory: 0,
    read_document_text: 0,
    read_document_chunk: 0,
    extract_petition: 0,
    analyze_signatures: 0,
    inspect_matricula_acervo: 0,
  },
};

export function getDocumentWorkerTelemetry(): DocumentWorkerTelemetry {
  pruneRolling24hWindow();
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

  const sortedFailures = [...workerRuntime.recentFailures]
    .sort((a, b) => Date.parse(b.failedAt) - Date.parse(a.failedAt))
    .slice(0, 25)
    .map(({ targetKey: _tk, ...rest }) => rest);
  const jobsFailedActive24h = workerRuntime.recentFailures.filter((f) => !f.resolved).length;
  const jobsFailedResolved24h = workerRuntime.recentFailures.filter((f) => f.resolved).length;

  return {
    enabled: workerRuntime.enabled,
    running: workerRuntime.running,
    disabledReason: workerRuntime.disabledReason,
    pollingIntervalIdleMs: workerRuntime.currentPollIntervalMs,
    pollingIntervalActiveMs: 150,
    lastPollAt: workerRuntime.lastPollAt,
    lastJobAt: workerRuntime.lastJobAt,
    lastError: workerRuntime.lastError,
    jobsProcessedTotal: workerRuntime.jobsProcessedTotal,
    jobsFailedTotal: workerRuntime.jobsFailedTotal,
    jobsProcessed24h: workerRuntime.completedTimestampsMs.length,
    jobsFailed24h: workerRuntime.recentFailures.length,
    jobsFailedActive24h,
    jobsFailedResolved24h,
    recentFailures: sortedFailures,
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
  if (fsSync.existsSync('H:\\')) {
    defaults.push({ id: 'vol1', path: 'H:\\' });
  }
  if (fsSync.existsSync('W:\\')) {
    defaults.push({ id: 'deptos', path: 'W:\\' });
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
  let ultimoJobTimestampMs = Date.now();

  // Intervalos adaptativos: sub-segundo durante navegação ativa e backoff progressivo em ociosidade
  const INTERVALO_APOS_JOB_MS = 150;
  const INTERVALO_JANELA_ATIVA_MS = 750;
  const INTERVALO_OCIOSO_CURTO_MS = 1500;
  const INTERVALO_OCIOSO_MEDIO_MS = 3000;
  const INTERVALO_OCIOSO_MAX_EXPEDIENTE_MS = Number(process.env.DOCUMENTAL_IDLE_MAX_MS) || 5000;
  const INTERVALO_OCIOSO_FORA_EXPEDIENTE_MS = Number(process.env.DOCUMENTAL_OFFHOURS_POLL_MS) || 15000;
  const INTERVALO_STANDBY_MS = 10000;
  const INTERVALO_ERRO_MS = 5000;

  function calcularProximoIntervaloOcioso(): number {
    const agoraMs = Date.now();
    const tempoSemJobMs = Math.max(0, agoraMs - ultimoJobTimestampMs);

    // Primeiros 30s após qualquer ação do usuário: mantém resposta sub-segundo (750ms)
    if (tempoSemJobMs <= 30_000) {
      return INTERVALO_JANELA_ATIVA_MS;
    }
    // De 30s a 2 minutos sem busca: 1,5s
    if (tempoSemJobMs <= 120_000) {
      return INTERVALO_OCIOSO_CURTO_MS;
    }
    // De 2 a 10 minutos sem busca: 3,0s
    if (tempoSemJobMs <= 600_000) {
      return INTERVALO_OCIOSO_MEDIO_MS;
    }

    // Acima de 10 minutos ocioso: 5s no expediente (Seg-Sáb 07h-19h BRT) ou 15s fora do expediente
    const sp = getSaoPauloDateTime(new Date(agoraMs));
    const emExpediente = sp.dayOfWeek >= 1 && sp.dayOfWeek <= 6 && sp.hour >= 7 && sp.hour < 19;
    return emExpediente ? INTERVALO_OCIOSO_MAX_EXPEDIENTE_MS : INTERVALO_OCIOSO_FORA_EXPEDIENTE_MS;
  }

  async function tick() {
    let proximoIntervalo = calcularProximoIntervaloOcioso();
    try {
      if (!runtimeDirective.shouldRunDocumentWorker()) {
        workerRuntime.running = false;
        workerRuntime.disabledReason = runtimeDirective.isPaused()
          ? 'Pausado manualmente (modo manutenção)'
          : 'Em Hot-Standby (aguardando promoção)';
        proximoIntervalo = INTERVALO_STANDBY_MS;
        workerRuntime.currentPollIntervalMs = proximoIntervalo;
        return;
      }

      const activeRoots = workerRuntime.authorizedRoots;
      if (activeRoots.length === 0) {
        workerRuntime.running = false;
        workerRuntime.disabledReason = 'Aguardando mapeamento de pastas no painel';
        proximoIntervalo = INTERVALO_STANDBY_MS;
        workerRuntime.currentPollIntervalMs = proximoIntervalo;
        return;
      }

      workerRuntime.running = true;
      workerRuntime.disabledReason = null;

      const response = await postDocumentMessage({ action: 'claim' });
      const claimNowIso = new Date().toISOString();
      workerRuntime.lastPollAt = claimNowIso;
      for (const f of workerRuntime.recentFailures) {
        if (!f.resolved && f.targetKey === 'worker_poll::api') {
          f.resolved = true;
          f.resolvedAt = claimNowIso;
        }
      }
      const job = response.data.job as ClaimedJob | null;
      if (job && !stopped) {
        ultimoJobTimestampMs = Date.now();
        proximoIntervalo = INTERVALO_APOS_JOB_MS;
        workerRuntime.currentPollIntervalMs = INTERVALO_JANELA_ATIVA_MS;
        const inicioJob = Date.now();
        const tipoJob = (job.type || 'search') as keyof typeof workerRuntime.jobsByType;
        const targetIdentity = buildJobTargetIdentity(job);
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
          } else if (job.type === 'inspect_matricula_acervo') {
            const matriculaLimpa = String(job.query || '').replace(/\D+/g, '');
            if (!matriculaLimpa) throw new Error('Número de matrícula inválido.');
            const raizesAcervo = activeRoots.filter(
              (r) => r.id === 'livro2' || r.id === 'imagens',
            );
            const alvoRaizes = raizesAcervo.length > 0 ? raizesAcervo : activeRoots;
            const busca = await searchDocuments(alvoRaizes, matriculaLimpa);
            const candidato =
              busca.files.find((f) => f.matricula === matriculaLimpa) || busca.files[0] || null;

            if (!candidato) {
              result = {
                numeroMatricula: Number(matriculaLimpa),
                possuiArquivoDigitalizado: false,
                formatoArquivo: 'AUSENTE',
                tamanhoBytes: 0,
                ultimaDigitalizacaoIso: null,
                sha256: null,
              };
            } else {
              const absPath = await resolveAuthorizedFile(
                alvoRaizes,
                candidato.rootId,
                candidato.relativePath,
              );
              const stat = await fs.stat(absPath);
              const extUpper = path.extname(absPath).replace('.', '').toUpperCase();
              let sha256: string | null = null;
              if (stat.size <= 32 * 1024 * 1024) {
                const fileBuf = await fs.readFile(absPath);
                sha256 = createHash('sha256').update(fileBuf).digest('hex');
              }
              result = {
                numeroMatricula: Number(matriculaLimpa),
                possuiArquivoDigitalizado: true,
                formatoArquivo:
                  extUpper === 'PDF' || extUpper === 'TIF' || extUpper === 'KEN'
                    ? extUpper
                    : 'PDF',
                tamanhoBytes: stat.size,
                ultimaDigitalizacaoIso: stat.mtime.toISOString(),
                sha256,
              };
            }
          } else {
            result = await searchDocuments(activeRoots, job.query || '');
          }
          if (!stopped) await postDocumentMessage({ action: 'complete', id: job.id, result });
          const fimJob = Date.now();
          const fimJobIso = new Date(fimJob).toISOString();
          ultimoJobTimestampMs = fimJob;
          const durJob = fimJob - inicioJob;
          workerRuntime.jobsProcessedTotal++;
          workerRuntime.completedTimestampsMs.push(fimJob);
          pruneRolling24hWindow(fimJob);
          for (const f of workerRuntime.recentFailures) {
            if (!f.resolved && f.targetKey === targetIdentity.key) {
              f.resolved = true;
              f.resolvedAt = fimJobIso;
            }
          }
          workerRuntime.lastJobAt = fimJobIso;
          workerRuntime.lastError = null;
          if (tipoJob in workerRuntime.jobsByType) workerRuntime.jobsByType[tipoJob]++;
          else workerRuntime.jobsByType.search++;
          workerRuntime.recentDurationsMs.push(durJob);
          if (workerRuntime.recentDurationsMs.length > 50) workerRuntime.recentDurationsMs.shift();
        } catch (jobErr: any) {
          const sanitizedError = String(jobErr?.message || jobErr)
            .replace(/[A-Za-z]:\\[^\s"']+/g, '[caminho-protegido]')
            .slice(0, 200);
          const failIso = new Date().toISOString();
          workerRuntime.jobsFailedTotal++;
          workerRuntime.lastError = sanitizedError;
          pruneRolling24hWindow();
          workerRuntime.recentFailures.push({
            id: job.id,
            type: job.type || 'search',
            target: targetIdentity.label,
            targetKey: targetIdentity.key,
            error: sanitizedError,
            failedAt: failIso,
            resolved: false,
            resolvedAt: null,
          });
          if (workerRuntime.recentFailures.length > MAX_RECENT_FAILURES) {
            workerRuntime.recentFailures.shift();
          }
          logger.error(`DOCUMENTAL: erro ao processar job ${job.id} (${job.type || 'search'}): ${jobErr?.message || jobErr}`);
          if (!stopped) await postDocumentMessage({ action: 'fail', id: job.id, error: sanitizedError });
        }
      } else {
        workerRuntime.currentPollIntervalMs = proximoIntervalo;
      }
    } catch (err: any) {
      proximoIntervalo = INTERVALO_ERRO_MS;
      workerRuntime.currentPollIntervalMs = proximoIntervalo;
      const pollErrMsg = String(err?.response?.data?.error || err?.message || err)
        .replace(/[A-Za-z]:\\[^\s"']+/g, '[caminho-protegido]')
        .slice(0, 200);
      workerRuntime.lastError = pollErrMsg;
      pruneRolling24hWindow();
      const existingOpenPollFail = workerRuntime.recentFailures.find(
        (f) => !f.resolved && f.targetKey === 'worker_poll::api',
      );
      if (!existingOpenPollFail) {
        workerRuntime.recentFailures.push({
          id: `poll-${Date.now()}`,
          type: 'comunicacao_api',
          target: 'Polling SaaS (/api/documental/messages)',
          targetKey: 'worker_poll::api',
          error: pollErrMsg,
          failedAt: new Date().toISOString(),
          resolved: false,
          resolvedAt: null,
        });
        if (workerRuntime.recentFailures.length > MAX_RECENT_FAILURES) {
          workerRuntime.recentFailures.shift();
        }
      }
      // Never log search terms, file names or authentication headers.
      logger.warn(`DOCUMENTAL: comunicação indisponível (${err?.response?.data?.error || err?.message || err}); nova tentativa em 5 segundos.`);
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

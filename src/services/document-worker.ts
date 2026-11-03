import path from 'node:path';
import fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import { env, connectorEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { postDocumentMessage } from './api.js';
import {
  enrichPetitionData,
  executeDocumentCli,
  extractDocxPetition,
  isAllowedDocumentApiUrl,
  listDirectory,
  parseDocumentRoots,
  readDocumentText,
  resolveAuthorizedFile,
  searchDocuments,
  warmDocumentIndex,
} from './document-search.js';
import { iniciarServidorArquivosLocal } from './document-file-server.js';

interface ClaimedJob {
  id: string;
  type?: string;
  query?: string | null;
  rootId?: string | null;
  relativePath?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
}

export function startDocumentWorker(): () => void {
  if (process.env.DOCUMENTAL_ENABLED !== 'true') return () => {};
  const targetUrl = process.env.DOCUMENTAL_API_URL || env.FIORIX_API_URL;
  const secureTarget = isAllowedDocumentApiUrl(targetUrl, {
    allowInsecureLocalhost: process.env.DOCUMENTAL_ALLOW_INSECURE_LOCALHOST === 'true',
    environment: connectorEnv,
  });
  if (env.SHADOW_MODE || (!secureTarget && process.env.DOCUMENTAL_ALLOW_INSECURE_LOCALHOST !== 'true')) {
    logger.warn('DOCUMENTAL: desativado em shadow mode ou sem HTTPS.');
    return () => {};
  }
  let roots;
  try {
    const rawRoots = process.env.DOCUMENTAL_ROOTS_JSON?.trim();
    if (rawRoots && rawRoots !== '[]') {
      roots = parseDocumentRoots(rawRoots);
    } else {
      // Configuração padrão das 3 pastas oficiais do 7º RI
      const defaults = [];
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
      roots = defaults.length > 0 ? defaults : parseDocumentRoots('[]');
    }
  } catch {
    logger.error('DOCUMENTAL: configuração de pastas inválida; worker desativado.');
    return () => {};
  }
  const authorizedRoots = roots;
  // PDFs grandes são servidos direto ao navegador na rede interna (não passam pelo FIORIX)
  const servidorArquivos = iniciarServidorArquivosLocal(env.FIORIX_API_URL);
  void warmDocumentIndex(authorizedRoots).catch(() => {});
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Intervalos de consulta: logo após um job (usuário navegando/abrindo arquivos), ocioso e após falha de rede
  const INTERVALO_APOS_JOB_MS = 100;
  const INTERVALO_OCIOSO_MS = 450;
  const INTERVALO_ERRO_MS = 5000;
  async function tick() {
    let proximoIntervalo = INTERVALO_OCIOSO_MS;
    try {
      const response = await postDocumentMessage({ action: 'claim' });
      const job = response.data.job as ClaimedJob | null;
      if (job && !stopped) {
        proximoIntervalo = INTERVALO_APOS_JOB_MS;
        try {
          let result: unknown;
          if (job.type === 'list_directory') {
            if (!job.rootId || !job.relativePath) throw new Error('Parâmetros inválidos.');
            result = await listDirectory(authorizedRoots, job.rootId, job.relativePath);
          } else if (job.type === 'extract_petition') {
            if (!job.rootId || !job.relativePath) throw new Error('Parâmetros inválidos.');
            const targetPath = await resolveAuthorizedFile(authorizedRoots, job.rootId, job.relativePath);
            const ext = path.extname(targetPath).toLowerCase();
            if (ext === '.docx' || ext === '.doc') {
              result = await extractDocxPetition(targetPath, job.relativePath);
            } else {
              const cliResult = await executeDocumentCli('extrair-peticao', targetPath, {
                pageStart: job.pageStart ?? undefined,
                pageEnd: job.pageEnd ?? undefined,
              }) as Record<string, any>;
              result = enrichPetitionData(cliResult, job.relativePath);
            }
          } else if (job.type === 'analyze_signatures') {
            if (!job.rootId || !job.relativePath) throw new Error('Parâmetros inválidos.');
            const targetPath = await resolveAuthorizedFile(authorizedRoots, job.rootId, job.relativePath);
            result = await executeDocumentCli('analisar-assinaturas', targetPath);
          } else if (job.type === 'read_document_text') {
            if (!job.rootId || !job.relativePath) throw new Error('Parâmetros inválidos.');
            const targetPath = await resolveAuthorizedFile(authorizedRoots, job.rootId, job.relativePath);
            if (servidorArquivos && path.extname(targetPath).toLowerCase() === '.pdf') {
              const info = await fs.stat(targetPath);
              const link = servidorArquivos.emitirTicket(targetPath, info.size);
              result = {
                fileName: path.basename(targetPath),
                extension: '.pdf',
                size: info.size,
                html: '',
                text: `[Documento PDF: ${path.basename(targetPath)} • ${Math.round(info.size / 1024)} KB]`,
                localUrl: link.url,
                localUrlExpiresAt: link.expiraEm,
              };
            } else {
              result = await readDocumentText(targetPath);
            }
          } else {
            result = await searchDocuments(authorizedRoots, job.query || '');
          }
          if (!stopped) await postDocumentMessage({ action: 'complete', id: job.id, result });
        } catch (jobErr: any) {
          logger.error(`DOCUMENTAL: erro ao processar job ${job.id} (${job.type || 'search'}): ${jobErr?.message || jobErr}`);
          if (!stopped) await postDocumentMessage({ action: 'fail', id: job.id });
        }
      }
    } catch (err: any) {
      proximoIntervalo = INTERVALO_ERRO_MS;
      // Never log search terms, file names or authentication headers.
      logger.warn(`DOCUMENTAL: comunicação indisponível (${err?.response?.data?.error || err?.message || err}); nova tentativa em 10 segundos.`);
    } finally {
      if (!stopped) timer = setTimeout(tick, proximoIntervalo);
    }
  }
  void tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); servidorArquivos?.parar(); };
}


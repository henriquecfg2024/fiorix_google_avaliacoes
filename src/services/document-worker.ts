import { env, connectorEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { postDocumentMessage } from './api.js';
import {
  executeDocumentCli,
  isAllowedDocumentApiUrl,
  parseDocumentRoots,
  resolveAuthorizedFile,
  searchDocuments,
} from './document-search.js';

interface ClaimedJob {
  id: string;
  type?: string;
  query?: string | null;
  rootId?: string | null;
  relativePath?: string | null;
}

export function startDocumentWorker(): () => void {
  if (process.env.DOCUMENTAL_ENABLED !== 'true') return () => {};
  const secureTarget = isAllowedDocumentApiUrl(env.FIORIX_API_URL, {
    allowInsecureLocalhost: process.env.DOCUMENTAL_ALLOW_INSECURE_LOCALHOST === 'true',
    environment: connectorEnv,
  });
  if (env.SHADOW_MODE || !secureTarget) {
    logger.warn('DOCUMENTAL: desativado em shadow mode ou sem HTTPS.');
    return () => {};
  }
  let roots;
  try { roots = parseDocumentRoots(process.env.DOCUMENTAL_ROOTS_JSON || '[]'); }
  catch { logger.error('DOCUMENTAL: configuração de pastas inválida; worker desativado.'); return () => {}; }
  const authorizedRoots = roots;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function tick() {
    try {
      const response = await postDocumentMessage({ action: 'claim' });
      const job = response.data.job as ClaimedJob | null;
      if (job && !stopped) {
        try {
          let result: unknown;
          if (job.type === 'extract_petition' || job.type === 'analyze_signatures') {
            if (!job.rootId || !job.relativePath) throw new Error('Parâmetros inválidos.');
            const targetPath = await resolveAuthorizedFile(authorizedRoots, job.rootId, job.relativePath);
            const cmd = job.type === 'extract_petition' ? 'extrair-peticao' : 'analisar-assinaturas';
            result = await executeDocumentCli(cmd, targetPath);
          } else {
            result = await searchDocuments(authorizedRoots, job.query || '');
          }
          if (!stopped) await postDocumentMessage({ action: 'complete', id: job.id, result });
        } catch {
          if (!stopped) await postDocumentMessage({ action: 'fail', id: job.id });
        }
      }
    } catch {
      // Never log search terms, file names or authentication headers.
      logger.warn('DOCUMENTAL: comunicação indisponível; nova tentativa em 10 segundos.');
    } finally {
      if (!stopped) timer = setTimeout(tick, 10000);
    }
  }
  void tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}


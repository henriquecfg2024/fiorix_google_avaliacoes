import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { postDocumentMessage } from './api.js';
import { parseDocumentRoots, searchDocuments } from './document-search.js';

export function startDocumentWorker(): () => void {
  if (process.env.DOCUMENTAL_ENABLED !== 'true') return () => {};
  if (env.SHADOW_MODE || !env.FIORIX_API_URL.startsWith('https://')) {
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
      const job = response.data.job as { id: string; query: string } | null;
      if (job && !stopped) {
        try {
          const result = await searchDocuments(authorizedRoots, job.query);
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

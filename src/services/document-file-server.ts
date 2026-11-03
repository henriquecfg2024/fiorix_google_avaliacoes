import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { logger } from '../utils/logger.js';

/**
 * Servidor de arquivos da rede interna (somente leitura).
 *
 * PDFs de processos têm de 10 a 200 MB e não cabem no canal Connector -> FIORIX (limite de 15 MB),
 * além de não deverem sair do cartório. Em vez de enviar os bytes ao FIORIX, o Connector:
 *   1. valida o arquivo dentro das pastas autorizadas (resolveAuthorizedFile, feito pelo worker);
 *   2. emite um "ticket" aleatório (256 bits) válido por poucos minutos e ligado a UM arquivo;
 *   3. devolve ao FIORIX apenas a URL interna com o ticket.
 * O navegador do usuário (na rede do cartório) baixa o PDF direto deste servidor.
 *
 * Variáveis de ambiente:
 *   DOCUMENTAL_FILE_SERVER_PORT          porta (padrão 8765)
 *   DOCUMENTAL_FILE_SERVER_HOST          interface de escuta (padrão 0.0.0.0)
 *   DOCUMENTAL_FILE_SERVER_PUBLIC_URL    URL que os navegadores usam (padrão http://localhost:PORTA)
 *   DOCUMENTAL_FILE_SERVER_TLS_CERT/KEY  certificado/chave PEM para HTTPS (obrigatório fora do localhost
 *                                        quando o FIORIX é servido por HTTPS — "mixed content")
 *   DOCUMENTAL_FILE_SERVER_ORIGINS       origens do FIORIX autorizadas (separadas por vírgula)
 */

const TTL_TICKET_MS = 15 * 60 * 1000;

interface Ticket {
  caminho: string;
  nomeArquivo: string;
  tamanho: number;
  expiraEm: number;
}

export interface EstatisticasServidorArquivos {
  active: boolean;
  protocol: 'HTTP' | 'HTTPS';
  port: number;
  publicUrl: string;
  activeTicketsCount: number;
  ticketsIssuedTotal: number;
  bytesServedTotal: number;
  rangeRequestsTotal: number;
  lastError: string | null;
}

export interface ServidorArquivosLocal {
  urlPublica: string;
  emitirTicket(caminhoAutorizado: string, tamanho: number): { url: string; expiraEm: string };
  obterEstatisticas(): EstatisticasServidorArquivos;
  parar(): void;
}

function origensAutorizadas(fiorixApiUrl: string): Set<string> {
  const origens = new Set<string>(['http://localhost:3000', 'http://127.0.0.1:3000']);
  try { origens.add(new URL(fiorixApiUrl).origin); } catch { /* URL inválida: validada em env.ts */ }
  for (const o of (process.env.DOCUMENTAL_FILE_SERVER_ORIGINS || '').split(',')) {
    const limpa = o.trim().replace(/\/+$/, '');
    if (limpa) origens.add(limpa);
  }
  return origens;
}

function nomeContentDisposition(nome: string): string {
  const ascii = nome.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

export function iniciarServidorArquivosLocal(fiorixApiUrl: string): ServidorArquivosLocal | null {
  const porta = Number(process.env.DOCUMENTAL_FILE_SERVER_PORT || 8765);
  if (!Number.isInteger(porta) || porta <= 0 || porta > 65535) {
    logger.error('DOCUMENTAL: porta do servidor de arquivos inválida; visualização de PDFs grandes desativada.');
    return null;
  }
  const host = process.env.DOCUMENTAL_FILE_SERVER_HOST || '0.0.0.0';
  const certPath = process.env.DOCUMENTAL_FILE_SERVER_TLS_CERT;
  const keyPath = process.env.DOCUMENTAL_FILE_SERVER_TLS_KEY;
  const usarTls = !!(certPath && keyPath);
  const urlPublica = (process.env.DOCUMENTAL_FILE_SERVER_PUBLIC_URL || `${usarTls ? 'https' : 'http'}://localhost:${porta}`).replace(/\/+$/, '');
  const origens = origensAutorizadas(fiorixApiUrl);
  const tickets = new Map<string, Ticket>();
  let servidorAtivo = false;
  let ticketsEmitidosTotal = 0;
  let bytesServidosTotal = 0;
  let requisicoesRangeTotal = 0;
  let ultimoErroServidor: string | null = null;

  const limparExpirados = () => {
    const agora = Date.now();
    for (const [token, t] of tickets) if (t.expiraEm <= agora) tickets.delete(token);
  };

  const limpeza = setInterval(limparExpirados, 60_000);
  limpeza.unref();

  const tratar: http.RequestListener = (req, res) => {
    const origem = req.headers.origin;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (origem) {
      if (!origens.has(origem)) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origem);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition');
    }

    if (req.method === 'OPTIONS') {
      // Preflight (inclui Private Network Access do Chrome: site público -> rede interna)
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      if (req.headers['access-control-request-private-network'] === 'true') {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
      }
      res.setHeader('Access-Control-Max-Age', '600');
      res.writeHead(204).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD, OPTIONS' }).end();
      return;
    }

    const match = /^\/arquivo\/([A-Za-z0-9_-]{43})$/.exec((req.url || '').split('?')[0]);
    const ticket = match ? tickets.get(match[1]) : undefined;
    if (!ticket || ticket.expiraEm <= Date.now()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Link expirado. Abra o documento novamente pelo FIORIX.');
      return;
    }

    let inicio = 0;
    let fim = ticket.tamanho - 1;
    let status = 200;
    const range = req.headers.range;
    if (range) {
      const r = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!r || (!r[1] && !r[2])) {
        res.writeHead(416, { 'Content-Range': `bytes */${ticket.tamanho}` }).end();
        return;
      }
      if (r[1]) {
        inicio = Number(r[1]);
        if (r[2]) fim = Math.min(Number(r[2]), ticket.tamanho - 1);
      } else {
        inicio = Math.max(0, ticket.tamanho - Number(r[2]));
      }
      if (inicio > fim || inicio >= ticket.tamanho) {
        res.writeHead(416, { 'Content-Range': `bytes */${ticket.tamanho}` }).end();
        return;
      }
      status = 206;
      requisicoesRangeTotal++;
      res.setHeader('Content-Range', `bytes ${inicio}-${fim}/${ticket.tamanho}`);
    }

    const bytesIntervalo = Math.max(0, fim - inicio + 1);
    res.writeHead(status, {
      'Content-Type': 'application/pdf',
      'Content-Length': String(bytesIntervalo),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': nomeContentDisposition(ticket.nomeArquivo),
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    bytesServidosTotal += bytesIntervalo;
    const stream = fs.createReadStream(ticket.caminho, { start: inicio, end: fim });
    stream.on('error', () => { res.destroy(); });
    stream.pipe(res);
  };

  let servidor: http.Server | https.Server;
  try {
    servidor = usarTls
      ? https.createServer({ cert: fs.readFileSync(certPath!), key: fs.readFileSync(keyPath!) }, tratar)
      : http.createServer(tratar);
  } catch {
    logger.error('DOCUMENTAL: certificado TLS do servidor de arquivos inválido; visualização de PDFs grandes desativada.');
    return null;
  }
  servidor.on('error', (err: NodeJS.ErrnoException) => {
    servidorAtivo = false;
    ultimoErroServidor = err.code || err.message || 'erro';
    logger.error(`DOCUMENTAL: servidor de arquivos indisponível (${err.code || 'erro'}) na porta ${porta}.`);
  });
  servidor.listen(porta, host, () => {
    servidorAtivo = true;
    ultimoErroServidor = null;
    logger.info(`DOCUMENTAL: servidor de arquivos da rede interna ativo em ${urlPublica} (${usarTls ? 'HTTPS' : 'HTTP'}).`);
  });

  return {
    urlPublica,
    emitirTicket(caminhoAutorizado, tamanho) {
      ticketsEmitidosTotal++;
      const token = randomBytes(32).toString('base64url');
      const expiraEm = Date.now() + TTL_TICKET_MS;
      tickets.set(token, { caminho: caminhoAutorizado, nomeArquivo: path.basename(caminhoAutorizado), tamanho, expiraEm });
      return { url: `${urlPublica}/arquivo/${token}`, expiraEm: new Date(expiraEm).toISOString() };
    },
    obterEstatisticas() {
      limparExpirados();
      return {
        active: servidorAtivo,
        protocol: usarTls ? 'HTTPS' : 'HTTP',
        port: porta,
        publicUrl: urlPublica,
        activeTicketsCount: tickets.size,
        ticketsIssuedTotal: ticketsEmitidosTotal,
        bytesServedTotal: bytesServidosTotal,
        rangeRequestsTotal: requisicoesRangeTotal,
        lastError: ultimoErroServidor,
      };
    },
    parar() {
      servidorAtivo = false;
      clearInterval(limpeza);
      tickets.clear();
      servidor.close();
    },
  };
}

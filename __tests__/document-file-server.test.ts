import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { iniciarServidorArquivosLocal, type ServidorArquivosLocal } from '../src/services/document-file-server.js';

const PORTA = 18765;
const ORIGEM_FIORIX = 'https://fiorix.exemplo.com.br';

describe('servidor de arquivos da rede interna (PDFs grandes)', () => {
  let servidor: ServidorArquivosLocal;
  let dir: string;
  let arquivo: string;
  const conteudo = Buffer.from('%PDF-1.7\n' + 'x'.repeat(5000) + '\n%%EOF');

  beforeAll(async () => {
    process.env.DOCUMENTAL_FILE_SERVER_PORT = String(PORTA);
    process.env.DOCUMENTAL_FILE_SERVER_HOST = '127.0.0.1';
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fiorix-fs-'));
    arquivo = path.join(dir, '1162956-97.2024.8.26.0100.pdf');
    await fs.writeFile(arquivo, conteudo);
    servidor = iniciarServidorArquivosLocal(ORIGEM_FIORIX + '/api')!;
    // aguarda o listen
    for (let i = 0; i < 50; i++) {
      try { await fetch(`http://127.0.0.1:${PORTA}/`); break; } catch { await new Promise(r => setTimeout(r, 50)); }
    }
  });

  afterAll(async () => {
    servidor?.parar();
    delete process.env.DOCUMENTAL_FILE_SERVER_PORT;
    delete process.env.DOCUMENTAL_FILE_SERVER_HOST;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('entrega o PDF inteiro somente com ticket válido', async () => {
    const { url, expiraEm } = servidor.emitirTicket(arquivo, conteudo.length);
    expect(url).toMatch(/\/arquivo\/[A-Za-z0-9_-]{43}$/);
    expect(Date.parse(expiraEm)).toBeGreaterThan(Date.now());
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(Buffer.from(await res.arrayBuffer()).equals(conteudo)).toBe(true);
  });

  it('suporta Range (leitura parcial)', async () => {
    const { url } = servidor.emitirTicket(arquivo, conteudo.length);
    const res = await fetch(url, { headers: { Range: 'bytes=0-7' } });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe(`bytes 0-7/${conteudo.length}`);
    expect(await res.text()).toBe('%PDF-1.7');
  });

  it('recusa ticket inexistente e caminhos fora do padrão', async () => {
    expect((await fetch(`http://127.0.0.1:${PORTA}/arquivo/${'a'.repeat(43)}`)).status).toBe(404);
    expect((await fetch(`http://127.0.0.1:${PORTA}/arquivo/..%2F..%2Fwindows`)).status).toBe(404);
  });

  it('libera CORS/Private Network só para o FIORIX autorizado', async () => {
    const { url } = servidor.emitirTicket(arquivo, conteudo.length);
    const preflight = await fetch(url, {
      method: 'OPTIONS',
      headers: { Origin: ORIGEM_FIORIX, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Private-Network': 'true' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(ORIGEM_FIORIX);
    expect(preflight.headers.get('access-control-allow-private-network')).toBe('true');

    const intruso = await fetch(url, { headers: { Origin: 'https://site-malicioso.com' } });
    expect(intruso.status).toBe(403);
  });

  it('não aceita escrita', async () => {
    const { url } = servidor.emitirTicket(arquivo, conteudo.length);
    expect((await fetch(url, { method: 'PUT', body: 'x' })).status).toBe(405);
  });
});

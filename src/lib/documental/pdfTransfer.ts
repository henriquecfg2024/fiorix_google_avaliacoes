'use client';

import {
  buildDocumentalBlobCacheKey,
  getCachedDocumentBlob,
  MAX_SINGLE_BLOB_BYTES,
  putCachedDocumentBlob,
} from './pdfIndexedDbCache';

/**
 * Utilitário multi-navegador (Safari macOS/iPadOS/iOS, Chrome, Edge, Firefox)
 * para download, conversão em Blob e abertura segura de PDFs e matrículas .KEN
 * a partir de qualquer estação, Mac, tablet ou celular.
 */

export const TAMANHO_BLOCO_PDF_HTTPS = 2_490_368; // ~2,38 MB bruto (~3,17 MB em base64, abaixo do limite de 2,40 MB do Connector e 4,5 MB serverless)
const CONCORRENCIA_BLOCOS_HTTPS = 4; // Janela paralela para manter o Connector alimentado sem intervalos ociosos
const MAX_BLOCOS_PDF_HTTPS = 220; // Suporta processos digitais volumosos de até ~520 MB

export class LinkLocalExpiradoError extends Error {
  constructor(msg = 'Link temporário do PDF expirado.') {
    super(msg);
    this.name = 'LinkLocalExpiradoError';
  }
}

export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // Safari real possui "Safari" sem "Chrome", "Chromium", "CriOS", "Edg", "OPR" ou "FxiOS"
  return /Safari/i.test(ua) && !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS)/i.test(ua);
}

export function isIOSOrIPadOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ em modo desktop reporta Macintosh com suporte multitoque
  return /Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
}

export function decodificarBase64ParaBytes(base64: string): Uint8Array {
  const limpo = base64.replace(/\s+/g, '');
  const bin = atob(limpo);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converte data:application/pdf;base64,... em Blob + blob: URL.
 * Essencial para Safari e Chrome (que bloqueiam ou truncam data: URLs longos em <iframe>/<object>).
 */
export function converterDataUrlPdfParaBlob(dataUrl: string): { blob: Blob; url: string } | null {
  if (!dataUrl || !dataUrl.startsWith('data:application/pdf')) return null;
  const idxVirgula = dataUrl.indexOf(',');
  if (idxVirgula < 0) return null;
  const cabecalho = dataUrl.slice(0, idxVirgula);
  const corpo = dataUrl.slice(idxVirgula + 1);
  if (!cabecalho.includes(';base64')) return null;
  const bytes = decodificarBase64ParaBytes(corpo);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  return { blob, url: URL.createObjectURL(blob) };
}

/**
 * Cópia segura para área de transferência em qualquer navegador (incluindo Safari e contextos restritos).
 */
export async function copiarTextoSeguro(texto: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Fallback via textarea abaixo
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', 'true');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.left = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, texto.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Aguarda o carregamento/decodificação de todas as imagens de uma janela de impressão
 * antes de acionar print(), evitando páginas em branco no Safari/WebKit.
 */
export function imprimirJanelaQuandoImagensCarregarem(printWindow: Window, atrasoExtraMs = 150): void {
  const disparar = () => {
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {}
    }, atrasoExtraMs);
  };

  try {
    const imagens = Array.from(printWindow.document.images || []);
    if (imagens.length === 0) {
      disparar();
      return;
    }
    let finalizado = false;
    const concluirUmaVez = () => {
      if (finalizado) return;
      finalizado = true;
      disparar();
    };
    const timeoutSeguranca = setTimeout(concluirUmaVez, 3500);
    Promise.all(
      imagens.map(
        img =>
          new Promise<void>(resolve => {
            if (img.complete && img.naturalWidth > 0) {
              if (typeof img.decode === 'function') {
                img.decode().catch(() => {}).finally(() => resolve());
              } else {
                resolve();
              }
              return;
            }
            const fim = () => resolve();
            img.addEventListener('load', fim, { once: true });
            img.addEventListener('error', fim, { once: true });
          }),
      ),
    ).finally(() => {
      clearTimeout(timeoutSeguranca);
      concluirUmaVez();
    });
  } catch {
    disparar();
  }
}

interface ChunkJobPayload {
  chunkBase64?: string;
  bytesRead?: number;
  totalSize?: number;
  eof?: boolean;
  isChunk?: boolean;
}

export interface OpcoesDownloadPdf {
  connectorId?: string;
  rootId?: string;
  relativePath?: string;
  tamanhoEsperado?: number;
  onProgress?: (recebido: number, total: number) => void;
  signal?: AbortSignal;
}

function criarErroAbortado(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Transferência de documento cancelada.', 'AbortError');
  }
  const erro = new Error('Transferência de documento cancelada.');
  erro.name = 'AbortError';
  return erro;
}

function lancarSeCancelado(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw criarErroAbortado();
  }
}

function ehErroAbortado(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError');
}

function aguardarComCancelamento(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return new Promise(resolve => setTimeout(resolve, ms));
  if (signal.aborted) return Promise.reject(criarErroAbortado());
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(criarErroAbortado());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function podeTentarServidorLocalDireto(localUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const u = new URL(localUrl);
    const paginaHttps = window.location.protocol === 'https:';
    // Safari bloqueia estritamente fetch HTTP (conteúdo misto) a partir de páginas HTTPS, mesmo para localhost
    if (paginaHttps && u.protocol === 'http:' && (isSafariBrowser() || isIOSOrIPadOS())) {
      return false;
    }
    // Em páginas HTTPS fora do Safari, Chrome/Edge permitem http://localhost se for a própria máquina do Connector
    if (paginaHttps && u.protocol === 'http:') {
      const hostLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
      return hostLocal;
    }
    return true;
  } catch {
    return false;
  }
}

async function tentarBaixarDiretoRedeLocal(
  url: string,
  tamanhoEsperado: number,
  onProgress?: (recebido: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ blob: Blob; url: string }> {
  lancarSeCancelado(signal);
  const controller = new AbortController();
  const aoAbortarExterno = () => controller.abort();
  signal?.addEventListener('abort', aoAbortarExterno, { once: true });
  // Timeout curto de conexão inicial (2s) para não travar estações remotas antes do fallback HTTPS
  const timerConexao = setTimeout(() => controller.abort(), 2200);
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timerConexao);
    signal?.removeEventListener('abort', aoAbortarExterno);
  }

  if (signal?.aborted) {
    throw criarErroAbortado();
  }

  if (response.status === 404) {
    throw new LinkLocalExpiradoError();
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const total = Number(response.headers.get('Content-Length')) || tamanhoEsperado;
  const reader = response.body?.getReader();
  if (!reader) {
    const rawBlob = await response.blob();
    const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' });
    onProgress?.(pdfBlob.size, Math.max(total, pdfBlob.size));
    return { blob: pdfBlob, url: URL.createObjectURL(pdfBlob) };
  }

  const partes: Uint8Array[] = [];
  let recebido = 0;
  let ultimaAtualizacao = 0;
  try {
    for (;;) {
      lancarSeCancelado(signal);
      const { done, value } = await reader.read();
      if (done) break;
      partes.push(value);
      recebido += value.length;
      const agora = performance.now();
      if (onProgress && agora - ultimaAtualizacao > 120) {
        ultimaAtualizacao = agora;
        onProgress(recebido, Math.max(total, recebido));
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      try {
        await reader.cancel();
      } catch {}
      throw criarErroAbortado();
    }
    throw err;
  }
  onProgress?.(recebido, Math.max(total, recebido));
  const pdfBlob = new Blob(partes as BlobPart[], { type: 'application/pdf' });
  return { blob: pdfBlob, url: URL.createObjectURL(pdfBlob) };
}

export function mimePorExtensao(nomeOuExt: string): string {
  const lower = (nomeOuExt || '').trim().toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.rtf')) return 'application/rtf';
  if (lower.endsWith('.txt')) return 'text/plain;charset=utf-8';
  if (lower.endsWith('.tif') || lower.endsWith('.tiff') || lower.endsWith('.ken')) return 'image/tiff';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function solicitarBlocoUnicoViaHttps(opcoes: {
  connectorId: string;
  rootId: string;
  relativePath: string;
  offset: number;
  length: number;
  ehPrimeiroBloco: boolean;
  signal?: AbortSignal;
}): Promise<ChunkJobPayload> {
  const { connectorId, rootId, relativePath, offset, length, ehPrimeiroBloco, signal } = opcoes;
  let chunkData: ChunkJobPayload | null = null;
  let ultimoErroBloco: Error | null = null;

  for (let tentativaBloco = 0; tentativaBloco < 3; tentativaBloco++) {
    lancarSeCancelado(signal);
    if (tentativaBloco > 0) {
      await aguardarComCancelamento(350 * tentativaBloco, signal);
    }
    try {
      const postRes = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId,
          type: 'read_document_chunk',
          rootId,
          relativePath,
          offset,
          length,
        }),
        signal,
      });
      const postBody = await postRes.json();
      if (!postRes.ok) {
        throw new Error(postBody.error || 'Falha ao solicitar bloco do arquivo ao Connector.');
      }

      if (postBody.status === 'complete' && postBody.result) {
        chunkData = postBody.result as ChunkJobPayload;
        break;
      }

      const deadline = Date.now() + 60000;
      let tent = 0;
      while (Date.now() < deadline) {
        await aguardarComCancelamento(tent === 0 ? 350 : tent < 5 ? 500 : 700, signal);
        tent++;
        const pollRes = await fetch('/api/gestao-documental?id=' + encodeURIComponent(postBody.id), {
          cache: 'no-store',
          signal,
        });
        const pollState = await pollRes.json();
        if (!pollRes.ok) throw new Error(pollState.error || 'Erro ao baixar bloco do documento.');
        if (pollState.status === 'complete' && pollState.result) {
          chunkData = pollState.result as ChunkJobPayload;
          break;
        }
        if (pollState.status === 'failed') {
          const detalheErro =
            pollState.result && typeof pollState.result === 'object' && typeof (pollState.result as Record<string, unknown>).error === 'string'
              ? String((pollState.result as Record<string, unknown>).error)
              : '';
          if (!detalheErro && ehPrimeiroBloco) {
            throw new Error(
              'O serviço FIORIX Connector no servidor Windows precisa ser reiniciado uma vez ' +
                '(execute reiniciar-servico-connector.bat como Administrador) para liberar a transferência de arquivos via HTTPS.',
            );
          }
          throw new Error(
            detalheErro
              ? `O Connector não conseguiu ler o arquivo solicitado (${detalheErro}).`
              : 'O Connector não conseguiu ler o arquivo solicitado.',
          );
        }
      }

      if (chunkData) break;
      ultimoErroBloco = new Error('Tempo limite excedido durante a transferência de um bloco do arquivo.');
    } catch (err) {
      if (ehErroAbortado(err) || signal?.aborted) {
        throw criarErroAbortado();
      }
      ultimoErroBloco = err instanceof Error ? err : new Error('Falha ao transferir bloco do arquivo.');
      if (ultimoErroBloco.message.includes('reiniciar-servico-connector.bat')) {
        throw ultimoErroBloco;
      }
    }
  }

  if (!chunkData) {
    throw ultimoErroBloco || new Error('Tempo limite excedido durante a transferência do arquivo.');
  }

  if (typeof chunkData.chunkBase64 !== 'string') {
    throw new Error(
      'O serviço FIORIX Connector no servidor Windows precisa ser reiniciado uma vez (reiniciar-servico-connector.bat) ' +
        'para habilitar a transferência de arquivos em qualquer navegador/estação via HTTPS.',
    );
  }

  return chunkData;
}

async function baixarFaixaExataViaHttps(opcoes: {
  connectorId: string;
  rootId: string;
  relativePath: string;
  inicio: number;
  tamanhoFaixa: number;
  ehPrimeiroBloco: boolean;
  signal?: AbortSignal;
  aoReceberParte: (bytesLidos: number, totalReportado?: number) => void;
}): Promise<{ partes: Uint8Array[]; eof: boolean; totalSize: number }> {
  const { connectorId, rootId, relativePath, inicio, tamanhoFaixa, ehPrimeiroBloco, signal, aoReceberParte } = opcoes;
  const partes: Uint8Array[] = [];
  let deslocamento = 0;
  let eof = false;
  let totalSize = 0;

  while (deslocamento < tamanhoFaixa) {
    lancarSeCancelado(signal);
    const restante = Math.min(TAMANHO_BLOCO_PDF_HTTPS, tamanhoFaixa - deslocamento);
    const chunk = await solicitarBlocoUnicoViaHttps({
      connectorId,
      rootId,
      relativePath,
      offset: inicio + deslocamento,
      length: restante,
      ehPrimeiroBloco: ehPrimeiroBloco && deslocamento === 0,
      signal,
    });

    if (typeof chunk.totalSize === 'number' && chunk.totalSize > 0) {
      totalSize = chunk.totalSize;
    }

    const bytes = chunk.chunkBase64 && chunk.chunkBase64.length > 0 ? decodificarBase64ParaBytes(chunk.chunkBase64) : new Uint8Array(0);
    const lidos = chunk.bytesRead ?? bytes.length;
    if (bytes.length > 0) {
      partes.push(bytes);
      deslocamento += lidos;
      aoReceberParte(bytes.length, totalSize);
    }

    if (chunk.eof || lidos === 0) {
      eof = true;
      break;
    }
  }

  return { partes, eof, totalSize };
}

/**
 * Fallback universal via HTTPS (funciona em Safari, Mac, iPad, iPhone, Android e qualquer PC fora do servidor do Connector):
 * transfere o PDF ou arquivo original (.DOC, .DOCX, etc.) em janela paralela de blocos seguros pelo canal autenticado do Connector.
 */
export async function baixarPdfEmBlocosViaHttps(opcoes: {
  connectorId: string;
  rootId: string;
  relativePath: string;
  mimeType?: string;
  tamanhoEsperado?: number;
  onProgress?: (recebido: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<{ blob: Blob; url: string }> {
  const { connectorId, rootId, relativePath, onProgress, signal } = opcoes;
  const mimeType = opcoes.mimeType || 'application/pdf';
  lancarSeCancelado(signal);

  let total = opcoes.tamanhoEsperado || 0;
  let bytesRecebidos = 0;
  onProgress?.(0, total);

  const controladorInterno = new AbortController();
  const aoAbortarExterno = () => controladorInterno.abort();
  signal?.addEventListener('abort', aoAbortarExterno, { once: true });

  try {
    const partesFinais: Uint8Array[] = [];
    let offsetBase = 0;

    // Se o tamanho ainda não é conhecido, busca o bloco 0 primeiro para descobrir totalSize
    if (total <= 0) {
      const inicial = await baixarFaixaExataViaHttps({
        connectorId,
        rootId,
        relativePath,
        inicio: 0,
        tamanhoFaixa: TAMANHO_BLOCO_PDF_HTTPS,
        ehPrimeiroBloco: true,
        signal: controladorInterno.signal,
        aoReceberParte: (lidos, reportado) => {
          if (reportado && reportado > total) total = reportado;
          bytesRecebidos += lidos;
          onProgress?.(bytesRecebidos, Math.max(total, bytesRecebidos));
        },
      });
      partesFinais.push(...inicial.partes);
      offsetBase = bytesRecebidos;
      if (inicial.totalSize > total) total = inicial.totalSize;

      if (inicial.eof || (total > 0 && offsetBase >= total)) {
        const blobUnico = new Blob(partesFinais as BlobPart[], { type: mimeType });
        return { blob: blobUnico, url: URL.createObjectURL(blobUnico) };
      }
    }

    // Se temos o tamanho total, dispara os blocos restantes em janela paralela ordenada (4 em voo)
    if (total > offsetBase) {
      const limiteBytes = Math.min(total, MAX_BLOCOS_PDF_HTTPS * TAMANHO_BLOCO_PDF_HTTPS);
      const faixas: Array<{ slot: number; inicio: number; tamanho: number }> = [];
      for (let pos = offsetBase, idx = 0; pos < limiteBytes && idx < MAX_BLOCOS_PDF_HTTPS; pos += TAMANHO_BLOCO_PDF_HTTPS, idx++) {
        faixas.push({
          slot: idx,
          inicio: pos,
          tamanho: Math.min(TAMANHO_BLOCO_PDF_HTTPS, limiteBytes - pos),
        });
      }

      const resultadosPorSlot: Uint8Array[][] = new Array(faixas.length);
      let cursor = 0;
      let erroFatal: unknown = null;

      const executarTrabalhador = async () => {
        while (true) {
          if (erroFatal) return;
          const meuIndice = cursor++;
          if (meuIndice >= faixas.length) return;
          const faixa = faixas[meuIndice];
          try {
            const resFaixa = await baixarFaixaExataViaHttps({
              connectorId,
              rootId,
              relativePath,
              inicio: faixa.inicio,
              tamanhoFaixa: faixa.tamanho,
              ehPrimeiroBloco: offsetBase === 0 && faixa.slot === 0,
              signal: controladorInterno.signal,
              aoReceberParte: (lidos, reportado) => {
                if (reportado && reportado > total) total = reportado;
                bytesRecebidos += lidos;
                onProgress?.(bytesRecebidos, Math.max(total, bytesRecebidos));
              },
            });
            resultadosPorSlot[faixa.slot] = resFaixa.partes;
          } catch (err) {
            if (!erroFatal) {
              erroFatal = err;
              controladorInterno.abort();
            }
            return;
          }
        }
      };

      const qtdWorkers = Math.min(CONCORRENCIA_BLOCOS_HTTPS, faixas.length);
      await Promise.all(Array.from({ length: qtdWorkers }, () => executarTrabalhador()));

      if (erroFatal) {
        if (signal?.aborted) throw criarErroAbortado();
        throw erroFatal;
      }

      for (const grupo of resultadosPorSlot) {
        if (grupo) partesFinais.push(...grupo);
      }
      offsetBase = limiteBytes;
    }

    // Caso o arquivo tenha bytes remanescentes além do tamanho inicialmente estimado, conclui sequencialmente
    let segurancaExtra = 0;
    while (total > offsetBase && offsetBase < MAX_BLOCOS_PDF_HTTPS * TAMANHO_BLOCO_PDF_HTTPS && segurancaExtra < 20) {
      segurancaExtra++;
      const cauda = await baixarFaixaExataViaHttps({
        connectorId,
        rootId,
        relativePath,
        inicio: offsetBase,
        tamanhoFaixa: Math.min(TAMANHO_BLOCO_PDF_HTTPS, total - offsetBase),
        ehPrimeiroBloco: false,
        signal: controladorInterno.signal,
        aoReceberParte: (lidos, reportado) => {
          if (reportado && reportado > total) total = reportado;
          bytesRecebidos += lidos;
          onProgress?.(bytesRecebidos, Math.max(total, bytesRecebidos));
        },
      });
      partesFinais.push(...cauda.partes);
      offsetBase = bytesRecebidos;
      if (cauda.eof) break;
    }

    const blob = new Blob(partesFinais as BlobPart[], { type: mimeType });
    onProgress?.(blob.size, Math.max(total, blob.size));
    return { blob, url: URL.createObjectURL(blob) };
  } finally {
    signal?.removeEventListener('abort', aoAbortarExterno);
  }
}

async function baixarViaSignedUrl(
  signedUrl: string,
  mimeType: string,
  tamanhoEsperado: number,
  onProgress?: (recebido: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ blob: Blob; url: string }> {
  lancarSeCancelado(signal);
  const response = await fetch(signedUrl, {
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  });

  if (signal?.aborted) {
    throw criarErroAbortado();
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao baixar do Storage.`);
  }

  const total = Number(response.headers.get('Content-Length')) || tamanhoEsperado;
  const reader = response.body?.getReader();
  if (!reader) {
    const rawBlob = await response.blob();
    const typedBlob = rawBlob.type === mimeType ? rawBlob : new Blob([rawBlob], { type: mimeType });
    onProgress?.(typedBlob.size, Math.max(total, typedBlob.size));
    return { blob: typedBlob, url: URL.createObjectURL(typedBlob) };
  }

  const partes: Uint8Array[] = [];
  let recebido = 0;
  let ultimaAtualizacao = 0;
  try {
    for (;;) {
      lancarSeCancelado(signal);
      const { done, value } = await reader.read();
      if (done) break;
      partes.push(value);
      recebido += value.length;
      const agora = performance.now();
      if (onProgress && agora - ultimaAtualizacao > 120) {
        ultimaAtualizacao = agora;
        onProgress(recebido, Math.max(total, recebido));
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      try {
        await reader.cancel();
      } catch {}
      throw criarErroAbortado();
    }
    throw err;
  }

  onProgress?.(recebido, Math.max(total, recebido));
  const typedBlob = new Blob(partes as BlobPart[], { type: mimeType });
  return { blob: typedBlob, url: URL.createObjectURL(typedBlob) };
}

async function solicitarStagingSignedUrlViaHttps(opcoes: {
  connectorId: string;
  rootId: string;
  relativePath: string;
  signal?: AbortSignal;
}): Promise<string | null> {
  const { connectorId, rootId, relativePath, signal } = opcoes;
  lancarSeCancelado(signal);
  try {
    const postRes = await fetch('/api/gestao-documental', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectorId,
        type: 'stage_document_file',
        rootId,
        relativePath,
      }),
      signal,
    });
    if (!postRes.ok) return null;
    const postBody = (await postRes.json()) as {
      id?: string;
      status?: string;
      result?: { signedUrl?: unknown; fallbackToChunk?: unknown } | null;
    };

    if (postBody.status === 'complete') {
      if (postBody.result?.fallbackToChunk) return null;
      return typeof postBody.result?.signedUrl === 'string' ? postBody.result.signedUrl : null;
    }
    if (!postBody.id) return null;

    const deadline = Date.now() + 45_000;
    let tent = 0;
    while (Date.now() < deadline) {
      await aguardarComCancelamento(tent === 0 ? 350 : tent < 5 ? 500 : 700, signal);
      tent++;
      const pollRes = await fetch('/api/gestao-documental?id=' + encodeURIComponent(postBody.id), {
        cache: 'no-store',
        signal,
      });
      if (!pollRes.ok) return null;
      const pollState = (await pollRes.json()) as {
        status?: string;
        result?: { signedUrl?: unknown; fallbackToChunk?: unknown } | null;
      };
      if (pollState.status === 'complete') {
        if (pollState.result?.fallbackToChunk) return null;
        return typeof pollState.result?.signedUrl === 'string' ? pollState.result.signedUrl : null;
      }
      if (pollState.status === 'failed') {
        return null;
      }
    }
    return null;
  } catch (err) {
    if (ehErroAbortado(err) || signal?.aborted) {
      throw criarErroAbortado();
    }
    return null;
  }
}

/**
 * Baixa qualquer arquivo original do acervo (.DOC, .DOCX, .RTF, .TXT, .KEN, .PDF)
 * diretamente pelo canal autenticado HTTPS do Connector ativo do cartório,
 * funcionando em qualquer estação, navegador ou dispositivo (sem depender de disco local na Vercel).
 */
export async function baixarArquivoOriginalViaHttps(opcoes: {
  connectorId?: string;
  rootId: string;
  relativePath: string;
  fileName: string;
  tamanhoEsperado?: number;
  onProgress?: (recebido: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  let cid = (opcoes.connectorId || '').trim();
  if (!cid) {
    const cRes = await fetch('/api/gestao-documental', { cache: 'no-store', signal: opcoes.signal });
    if (cRes.ok) {
      const cData = await cRes.json();
      const lista: Array<{ id: string; operationalState?: string; lastSeenAt?: string | null }> = cData.connectors || [];
      const ativoOnline = lista.find(
        c => c.operationalState === 'ACTIVE' && c.lastSeenAt && Date.now() - new Date(c.lastSeenAt).getTime() < 120000,
      );
      const qualquerOnline = lista.find(
        c => c.operationalState !== 'PAUSED' && c.lastSeenAt && Date.now() - new Date(c.lastSeenAt).getTime() < 120000,
      );
      cid = ativoOnline?.id || qualquerOnline?.id || lista[0]?.id || '';
    }
  }

  if (!cid) {
    throw new Error('Nenhum servidor Connector online disponível para baixar o arquivo original.');
  }

  const mimeType = mimePorExtensao(opcoes.fileName);
  const tamanho = opcoes.tamanhoEsperado ?? 0;
  const cacheKey = buildDocumentalBlobCacheKey({
    connectorId: cid,
    rootId: opcoes.rootId,
    relativePath: opcoes.relativePath,
    size: tamanho,
  });

  let resolvido: { blob: Blob; url: string } | null = null;
  if (cacheKey) {
    const cachedBlob = await getCachedDocumentBlob(cacheKey);
    if (cachedBlob) {
      opcoes.onProgress?.(cachedBlob.size, cachedBlob.size);
      resolvido = { blob: cachedBlob, url: URL.createObjectURL(cachedBlob) };
    }
  }

  if (!resolvido && (tamanho === 0 || tamanho <= MAX_SINGLE_BLOB_BYTES)) {
    const signedUrl = await solicitarStagingSignedUrlViaHttps({
      connectorId: cid,
      rootId: opcoes.rootId,
      relativePath: opcoes.relativePath,
      signal: opcoes.signal,
    });
    if (signedUrl) {
      try {
        resolvido = await baixarViaSignedUrl(
          signedUrl,
          mimeType,
          tamanho,
          opcoes.onProgress,
          opcoes.signal,
        );
        if (cacheKey && resolvido.blob.size <= MAX_SINGLE_BLOB_BYTES) {
          void putCachedDocumentBlob(cacheKey, resolvido.blob);
        }
      } catch (err) {
        if (ehErroAbortado(err) || opcoes.signal?.aborted) {
          throw criarErroAbortado();
        }
        resolvido = null;
      }
    }
  }

  if (!resolvido) {
    resolvido = await baixarPdfEmBlocosViaHttps({
      connectorId: cid,
      rootId: opcoes.rootId,
      relativePath: opcoes.relativePath,
      mimeType,
      tamanhoEsperado: opcoes.tamanhoEsperado,
      onProgress: opcoes.onProgress,
      signal: opcoes.signal,
    });
    if (cacheKey && resolvido.blob.size <= MAX_SINGLE_BLOB_BYTES) {
      void putCachedDocumentBlob(cacheKey, resolvido.blob);
    }
  }

  const { url } = resolvido;
  const link = document.createElement('a');
  link.href = url;
  link.download = opcoes.fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Resolve qualquer resultado de PDF (cache IndexedDB, data: base64, Signed URL, link local da rede interna ou blocos HTTPS)
 * em um `blob:` URL pronto para Safari, Chrome, Edge e Firefox em qualquer dispositivo.
 */
export async function resolverPdfParaNavegador(
  resultado: {
    pdfDataUrl?: string;
    localUrl?: string;
    signedUrl?: string;
    signedUrlExpiresAt?: string;
    size?: number;
  },
  opcoes: OpcoesDownloadPdf = {},
): Promise<{ url: string; blob?: Blob } | null> {
  lancarSeCancelado(opcoes.signal);

  const tamanho = opcoes.tamanhoEsperado ?? resultado.size ?? 0;
  const cacheKey = buildDocumentalBlobCacheKey({
    connectorId: opcoes.connectorId,
    rootId: opcoes.rootId,
    relativePath: opcoes.relativePath,
    size: tamanho,
  });

  // 0. Cache local persistente em IndexedDB (zero tráfego extra ao reabrir o mesmo documento)
  if (cacheKey) {
    const cachedBlob = await getCachedDocumentBlob(cacheKey);
    if (cachedBlob) {
      opcoes.onProgress?.(cachedBlob.size, cachedBlob.size);
      return { blob: cachedBlob, url: URL.createObjectURL(cachedBlob) };
    }
  }

  // 1. Se já veio embutido como data:application/pdf;base64,... (ex.: PDFs até 2,4 MB), converte direto em Blob local
  if (resultado.pdfDataUrl) {
    if (resultado.pdfDataUrl.startsWith('data:application/pdf')) {
      const convertido = converterDataUrlPdfParaBlob(resultado.pdfDataUrl);
      if (convertido) {
        if (cacheKey && convertido.blob.size <= MAX_SINGLE_BLOB_BYTES) {
          void putCachedDocumentBlob(cacheKey, convertido.blob);
        }
        opcoes.onProgress?.(convertido.blob.size, convertido.blob.size);
        return convertido;
      }
    }
    return { url: resultado.pdfDataUrl };
  }

  // 2. Signed URL direta do Storage privado efêmero (upload direto do Connector, fora do bandwidth Vercel)
  if (resultado.signedUrl) {
    try {
      opcoes.onProgress?.(0, tamanho);
      const viaStorage = await baixarViaSignedUrl(
        resultado.signedUrl,
        'application/pdf',
        tamanho,
        opcoes.onProgress,
        opcoes.signal,
      );
      if (cacheKey && viaStorage.blob.size <= MAX_SINGLE_BLOB_BYTES) {
        void putCachedDocumentBlob(cacheKey, viaStorage.blob);
      }
      return viaStorage;
    } catch (err) {
      if (ehErroAbortado(err) || opcoes.signal?.aborted) {
        throw criarErroAbortado();
      }
      // Segue para rede local / staging / chunks em caso de falha ou expiração
    }
  }

  // 3. Caminho rápido na própria estação quando o link local é acessível sem Mixed Content
  if (resultado.localUrl && podeTentarServidorLocalDireto(resultado.localUrl)) {
    try {
      opcoes.onProgress?.(0, tamanho);
      const viaLan = await tentarBaixarDiretoRedeLocal(
        resultado.localUrl,
        tamanho,
        opcoes.onProgress,
        opcoes.signal,
      );
      if (cacheKey && viaLan.blob.size <= MAX_SINGLE_BLOB_BYTES) {
        void putCachedDocumentBlob(cacheKey, viaLan.blob);
      }
      return viaLan;
    } catch (err) {
      if (ehErroAbortado(err) || opcoes.signal?.aborted) {
        throw criarErroAbortado();
      }
      // Se não temos coordenadas para buscar via HTTPS e o ticket expirou, repassa LinkLocalExpiradoError
      if (
        err instanceof LinkLocalExpiradoError &&
        (!opcoes.connectorId || !opcoes.rootId || !opcoes.relativePath)
      ) {
        throw err;
      }
      // Qualquer bloqueio de rede/porta/Mixed Content cai automaticamente para staging/HTTPS abaixo
    }
  }

  // 4. Transferência universal via Storage staging (<= 48 MB) ou chunks HTTPS pelo Connector
  if (opcoes.connectorId && opcoes.rootId && opcoes.relativePath) {
    if (tamanho === 0 || tamanho <= MAX_SINGLE_BLOB_BYTES) {
      const stagedSignedUrl = await solicitarStagingSignedUrlViaHttps({
        connectorId: opcoes.connectorId,
        rootId: opcoes.rootId,
        relativePath: opcoes.relativePath,
        signal: opcoes.signal,
      });
      if (stagedSignedUrl) {
        try {
          const viaStaged = await baixarViaSignedUrl(
            stagedSignedUrl,
            'application/pdf',
            tamanho,
            opcoes.onProgress,
            opcoes.signal,
          );
          if (cacheKey && viaStaged.blob.size <= MAX_SINGLE_BLOB_BYTES) {
            void putCachedDocumentBlob(cacheKey, viaStaged.blob);
          }
          return viaStaged;
        } catch (err) {
          if (ehErroAbortado(err) || opcoes.signal?.aborted) {
            throw criarErroAbortado();
          }
        }
      }
    }

    const viaChunks = await baixarPdfEmBlocosViaHttps({
      connectorId: opcoes.connectorId,
      rootId: opcoes.rootId,
      relativePath: opcoes.relativePath,
      tamanhoEsperado: tamanho,
      onProgress: opcoes.onProgress,
      signal: opcoes.signal,
    });
    if (cacheKey && viaChunks.blob.size <= MAX_SINGLE_BLOB_BYTES) {
      void putCachedDocumentBlob(cacheKey, viaChunks.blob);
    }
    return viaChunks;
  }

  if (resultado.localUrl || resultado.signedUrl) {
    throw new Error(
      'Não foi possível acessar o PDF diretamente nesta estação. Selecione um Connector online para carregar via HTTPS.',
    );
  }

  return null;
}

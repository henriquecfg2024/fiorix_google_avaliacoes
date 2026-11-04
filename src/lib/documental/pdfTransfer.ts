'use client';

/**
 * Utilitário multi-navegador (Safari macOS/iPadOS/iOS, Chrome, Edge, Firefox)
 * para download, conversão em Blob e abertura segura de PDFs e matrículas .KEN
 * a partir de qualquer estação, Mac, tablet ou celular.
 */

export const TAMANHO_BLOCO_PDF_HTTPS = 2_097_152; // 2,0 MB bruto (~2,67 MB em base64, ágil em redes móveis e seguro abaixo de 4,5 MB)

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
): Promise<{ blob: Blob; url: string }> {
  const controller = new AbortController();
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
  for (;;) {
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

/**
 * Fallback universal via HTTPS (funciona em Safari, Mac, iPad, iPhone, Android e qualquer PC fora do servidor do Connector):
 * transfere o PDF ou arquivo original (.DOC, .DOCX, etc.) em blocos seguros de 2,0 MB pelo canal autenticado do Connector.
 */
export async function baixarPdfEmBlocosViaHttps(opcoes: {
  connectorId: string;
  rootId: string;
  relativePath: string;
  mimeType?: string;
  tamanhoEsperado?: number;
  onProgress?: (recebido: number, total: number) => void;
}): Promise<{ blob: Blob; url: string }> {
  const { connectorId, rootId, relativePath, onProgress } = opcoes;
  const mimeType = opcoes.mimeType || 'application/pdf';
  let total = opcoes.tamanhoEsperado || 0;
  let offset = 0;
  const partes: Uint8Array[] = [];
  onProgress?.(0, total);

  // Limite de segurança de 110 blocos (~220 MB)
  for (let blocoIdx = 0; blocoIdx < 110; blocoIdx++) {
    let chunkData: ChunkJobPayload | null = null;
    let ultimoErroBloco: Error | null = null;

    for (let tentativaBloco = 0; tentativaBloco < 3; tentativaBloco++) {
      if (tentativaBloco > 0) {
        await new Promise(r => setTimeout(r, 400 * tentativaBloco));
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
            length: TAMANHO_BLOCO_PDF_HTTPS,
          }),
        });
        const postBody = await postRes.json();
        if (!postRes.ok) {
          throw new Error(postBody.error || 'Falha ao solicitar bloco do arquivo ao Connector.');
        }

        if (postBody.status === 'complete' && postBody.result) {
          chunkData = postBody.result as ChunkJobPayload;
          break;
        }

        const deadline = Date.now() + 45000;
        let tent = 0;
        let conectorDesatualizado = false;
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, tent === 0 ? 160 : tent < 5 ? 300 : 480));
          tent++;
          const pollRes = await fetch('/api/gestao-documental?id=' + encodeURIComponent(postBody.id), {
            cache: 'no-store',
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
            if (!detalheErro && blocoIdx === 0) {
              conectorDesatualizado = true;
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
        if (conectorDesatualizado) break;
        ultimoErroBloco = new Error('Tempo limite excedido durante a transferência de um bloco do arquivo.');
      } catch (err) {
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

    if (typeof chunkData.totalSize === 'number' && chunkData.totalSize > 0) {
      total = chunkData.totalSize;
    }

    if (chunkData.chunkBase64.length > 0) {
      const bytes = decodificarBase64ParaBytes(chunkData.chunkBase64);
      partes.push(bytes);
      offset += chunkData.bytesRead ?? bytes.length;
      onProgress?.(offset, Math.max(total, offset));
    }

    if (chunkData.eof || (chunkData.bytesRead ?? 0) === 0 || (total > 0 && offset >= total)) {
      break;
    }
  }

  const blob = new Blob(partes as BlobPart[], { type: mimeType });
  return { blob, url: URL.createObjectURL(blob) };
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
}): Promise<void> {
  let cid = (opcoes.connectorId || '').trim();
  if (!cid) {
    const cRes = await fetch('/api/gestao-documental', { cache: 'no-store' });
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

  const { url } = await baixarPdfEmBlocosViaHttps({
    connectorId: cid,
    rootId: opcoes.rootId,
    relativePath: opcoes.relativePath,
    mimeType: mimePorExtensao(opcoes.fileName),
    tamanhoEsperado: opcoes.tamanhoEsperado,
    onProgress: opcoes.onProgress,
  });

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
 * Resolve qualquer resultado de PDF (data: base64, link local da rede interna ou blocos HTTPS)
 * em um `blob:` URL pronto para Safari, Chrome, Edge e Firefox em qualquer dispositivo.
 */
export async function resolverPdfParaNavegador(
  resultado: {
    pdfDataUrl?: string;
    localUrl?: string;
    size?: number;
  },
  opcoes: OpcoesDownloadPdf = {},
): Promise<{ url: string; blob?: Blob } | null> {
  // 1. Se já veio embutido como data:application/pdf;base64,... (ex.: PDFs até 2,4 MB), converte direto em Blob local
  if (resultado.pdfDataUrl) {
    if (resultado.pdfDataUrl.startsWith('data:application/pdf')) {
      const convertido = converterDataUrlPdfParaBlob(resultado.pdfDataUrl);
      if (convertido) {
        opcoes.onProgress?.(convertido.blob.size, convertido.blob.size);
        return convertido;
      }
    }
    return { url: resultado.pdfDataUrl };
  }

  const tamanho = opcoes.tamanhoEsperado ?? resultado.size ?? 0;

  // 2. Caminho rápido na própria estação quando o link local é acessível sem Mixed Content
  if (resultado.localUrl && podeTentarServidorLocalDireto(resultado.localUrl)) {
    try {
      opcoes.onProgress?.(0, tamanho);
      return await tentarBaixarDiretoRedeLocal(resultado.localUrl, tamanho, opcoes.onProgress);
    } catch (err) {
      // Se não temos coordenadas para buscar via HTTPS e o ticket expirou, repassa LinkLocalExpiradoError
      if (
        err instanceof LinkLocalExpiradoError &&
        (!opcoes.connectorId || !opcoes.rootId || !opcoes.relativePath)
      ) {
        throw err;
      }
      // Qualquer bloqueio de rede/porta/Mixed Content cai automaticamente para transferência HTTPS abaixo
    }
  }

  // 3. Transferência universal via HTTPS pelo Connector (Safari, Mac, iPad, celular e outras estações)
  if (opcoes.connectorId && opcoes.rootId && opcoes.relativePath) {
    return await baixarPdfEmBlocosViaHttps({
      connectorId: opcoes.connectorId,
      rootId: opcoes.rootId,
      relativePath: opcoes.relativePath,
      tamanhoEsperado: tamanho,
      onProgress: opcoes.onProgress,
    });
  }

  if (resultado.localUrl) {
    throw new Error(
      'Não foi possível acessar o PDF diretamente nesta estação. Selecione um Connector online para carregar via HTTPS.',
    );
  }

  return null;
}


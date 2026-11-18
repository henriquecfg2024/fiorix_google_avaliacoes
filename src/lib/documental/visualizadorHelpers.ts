/** Ajusta URL de PDF (blob:/https:) para recolher painel de miniaturas nativo e ajustar à largura. */
export function construirUrlIframePdf(rawUrl: string, termoDestaque?: string): string {
  if (!rawUrl || rawUrl.startsWith('data:')) return rawUrl;
  const base = rawUrl.split('#')[0];
  const tokens = termoDestaque ? extrairTokensDestaquePesquisa(termoDestaque) : [];
  const termoLimpo = tokens.join(' ').trim() || (termoDestaque || '').trim();
  const suffix = termoLimpo.length >= 2 ? `&search=${encodeURIComponent(termoLimpo)}` : '';
  return `${base}#navpanes=0&view=FitH${suffix}`;
}

/** Retorna o rótulo legível da sessão/origem do acervo para um arquivo ativo. */
export function obterRotuloSessaoAcervo(rootId?: string, relativePath?: string): string {
  switch ((rootId || '').toLowerCase()) {
    case 'livro2':
      return 'LV2';
    case 'titulos_visualiza':
      return 'TITULOS-VISUALIZA';
    case 'titulos_online':
      return 'Titulos_Online';
    case 'imagens': {
      const primeiroSeg = relativePath?.split(/[\\/]/).find(Boolean);
      return primeiroSeg || 'IMAGENS';
    }
    case 'vol1':
      return 'VOL1 (H:)';
    case 'deptos':
      return 'DEP (W:)';
    case 'processos':
      return 'Processos (H:)';
    case 'minutas':
      return 'Usucapião (W:)';
    case 'local':
      return 'Arquivo Local';
    default:
      return rootId ? rootId.toUpperCase() : 'LOCAL';
  }
}

export interface AvaliacaoAcessoExclusivoParams {
  navPermissionsEnabled: boolean;
  userRole?: string | null;
  allowedItemIds: string[];
}

/**
 * Determina se o Visualizador (/gestao-documental/visualizador) é a única tela
 * navegável liberada para o usuário em todo o FIORIX.
 */
export function isAcessoExclusivoVisualizador({
  navPermissionsEnabled,
  userRole,
  allowedItemIds,
}: AvaliacaoAcessoExclusivoParams): boolean {
  if (String(userRole || '').toUpperCase() === 'MASTER') return false;
  if (!navPermissionsEnabled) return false;

  const itensNavegaveis = allowedItemIds.filter(
    (id) => Boolean(id) && id !== 'validacao_autenticidade_documental',
  );

  return (
    itensNavegaveis.length === 0 ||
    (itensNavegaveis.length === 1 && itensNavegaveis[0] === 'visualizador_documental')
  );
}

/** Retorna até 2 iniciais maiúsculas para o avatar compacto do usuário. */
export function obterIniciaisUsuario(nome?: string | null): string {
  if (!nome) return 'U';
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'U';
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const REGEX_CNJ_PESQUISA =
  /\b(?:\d{7}-\d{2}(?:\.\d{4}(?:\.\d(?:\.\d{2}(?:\.\d{4})?)?)?)?|\d{7}\d{2}(?:19|20)\d{2}(?:\d\d{2}\d{4})?)\b/g;

function normalizarTextoVisualizador(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function unirSeparadoresMilhar(norm: string): string {
  return norm.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2');
}

function casaTermoUnicoVisualizador(
  term: string,
  normAlvo: string,
  normMilhares: string,
  limpoAlvo: string,
): boolean {
  if (/^[0-9.]+$/.test(term)) {
    const rawDigits = term.replace(/\./g, '');
    if (/^\d{2,8}$/.test(rawDigits)) {
      const semZeros = rawDigits.replace(/^0+/, '') || '0';
      if (rawDigits.length === 7 && !rawDigits.startsWith('0')) {
        return new RegExp(`(^|\\D)(?:0*${semZeros}(\\D|$)|${rawDigits}\\d{13}(\\D|$))`).test(normMilhares);
      }
      return new RegExp(`(^|\\D)0*${semZeros}(\\D|$)`).test(normMilhares);
    }
  }
  if (normAlvo.includes(term)) return true;
  const tLimpo = term.replace(/[.\-_/\s]/g, '');
  return tLimpo.length >= 2 && limpoAlvo.includes(tLimpo);
}

/** Verifica se um caminho/nome local casa com o termo digitado sem falsos positivos numéricos de substring. */
export function casaTermoPesquisaLocal(termoBruto: string, caminhoOuNome: string): boolean {
  const termos = normalizarTextoVisualizador(termoBruto).trim().split(/\s+/).filter(Boolean);
  if (termos.length === 0) return false;
  const normAlvo = normalizarTextoVisualizador(caminhoOuNome);
  const normMilhares = unirSeparadoresMilhar(normAlvo);
  const limpoAlvo = normAlvo.replace(/[.\-_/\s]/g, '');
  return termos.every((t) => casaTermoUnicoVisualizador(t, normAlvo, normMilhares, limpoAlvo));
}

function extrairNumerosQueryVisualizador(termoBruto: string): Set<number> {
  const nums = new Set<number>();
  const semProc = (termoBruto || '').replace(REGEX_CNJ_PESQUISA, ' ');
  const dotted = semProc.match(/\b\d{1,3}(?:\.\d{3})+\b/g) || [];
  for (const d of dotted) {
    const n = parseInt(d.replace(/\D+/g, ''), 10);
    if (Number.isFinite(n) && n > 0) nums.add(n);
  }
  const plain = semProc.replace(/\b\d{1,3}(?:\.\d{3})+\b/g, ' ').match(/\b\d{1,8}\b/g) || [];
  for (const p of plain) {
    const n = parseInt(p, 10);
    if (Number.isFinite(n) && n > 0) nums.add(n);
  }
  return nums;
}

/** Ordena resultados da pesquisa no Visualizador priorizando matrícula exata (LV2) e documentos/títulos do nº buscado. */
export function ordenarResultadosPesquisaVisualizador<
  T extends { rootId: string; relativePath: string; name: string },
>(termoBruto: string, files: T[]): T[] {
  if (files.length <= 1) return files;
  const queryNums = extrairNumerosQueryVisualizador(termoBruto);
  const queriouTranscricao = /transcri[çc][ãa]o|transcr/i.test(termoBruto || '');
  const centralCodes = ((termoBruto || '').match(/\b(?:ac|ph|in)[0-9]{5,12}[a-z0-9]?\b/gi) || []).map((c) =>
    c.toLowerCase(),
  );

  const calcularTier = (item: T): number => {
    const nome = item.name || '';
    const dotIdx = nome.lastIndexOf('.');
    const ext = dotIdx >= 0 ? nome.slice(dotIdx).toLowerCase() : '';
    const baseName = dotIdx >= 0 ? nome.slice(0, dotIdx) : nome;
    const isKenOrTif = ext === '.ken' || ext === '.tif' || ext === '.tiff';
    const rootLower = (item.rootId || '').toLowerCase();
    const relLower = (item.relativePath || '').toLowerCase();
    const isTitulo =
      rootLower === 'titulos_visualiza' ||
      rootLower === 'titulos_online' ||
      /(?:^|[\\/])(?:titulos-visualiza|titulos_online)(?:[\\/]|$)/i.test(relLower);
    const isLv2 = rootLower === 'livro2' || /(?:^|[\\/])lv2[\\/]/i.test(relLower);
    const isLv3 = /(?:^|[\\/])lv3[\\/]/i.test(relLower);
    const isLv1 = /(?:^|[\\/])lv1[\\/]/i.test(relLower);

    const imgNum = /^\d{1,8}$/.test(baseName) ? parseInt(baseName, 10) : NaN;
    const imgExata = !Number.isNaN(imgNum) && queryNums.has(imgNum);

    if (isKenOrTif && !isTitulo && imgExata) {
      if ((queriouTranscricao && isLv3) || (!queriouTranscricao && isLv2)) return 0;
      if (isLv2 || isLv3 || isLv1) return 1;
    }

    if (isTitulo) {
      if (imgExata) return 1;
      const pFolder = relLower.match(/(?:^|[\\/])0*([1-9]\d{1,7})(?:-([a-z]{2,3}[a-z0-9]{4,}))?(?:[\\/]|$)/i);
      if (pFolder) {
        const folderNum = parseInt(pFolder[1], 10);
        if (queryNums.has(folderNum) || (pFolder[2] && centralCodes.includes(pFolder[2].toLowerCase()))) {
          return 1;
        }
      }
      if (centralCodes.some((c) => relLower.includes(c))) return 1;
    }

    if (queryNums.size > 0) {
      const normNameMilhares = unirSeparadoresMilhar(normalizarTextoVisualizador(nome));
      for (const qn of queryNums) {
        if (new RegExp(`(^|\\D)0*${qn}(\\D|$)`).test(normNameMilhares)) {
          return 2;
        }
      }
    }

    if (isKenOrTif && !isTitulo && (isLv2 || isLv3 || isLv1)) {
      return 3;
    }

    return 4;
  };

  return files
    .map((item, idx) => ({ item, idx, tier: calcularTier(item) }))
    .sort((a, b) => a.tier - b.tier || a.idx - b.idx)
    .map((v) => v.item);
}

/** Identifica busca candidata a matrícula direta no Livro 2 (1..350000) para fallback resiliente por bloco. */
export function extrairAlvoDiretoMatriculaLv2(termoBruto: string): {
  num: number;
  pad8: string;
  bloco: string;
  fileName: string;
} | null {
  const trimmed = (termoBruto || '').trim();
  if (!trimmed) return null;
  if (new RegExp(REGEX_CNJ_PESQUISA.source).test(trimmed)) return null;
  if (/\b(?:protocolo|prenota[çc][ãa]o|t[íi]tulo|transcri[çc][ãa]o|transcr|setor|quadra|sql|iptu|ac\d{5,}|ph\d{5,}|in[a-z0-9]{5,})\b/i.test(trimmed)) {
    return null;
  }

  let rawNum = '';
  const mExplicit = trimmed.match(/^(?:matr[ií]cula|matr\.?|mat\.?)\s*(?:n[ºo°.]*\s*)?[:.\s]*([0-9][0-9.]*)$/i);
  if (mExplicit) {
    rawNum = mExplicit[1];
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(trimmed) || /^\d{1,8}$/.test(trimmed)) {
    rawNum = trimmed;
  } else {
    return null;
  }

  const digits = rawNum.replace(/\./g, '');
  // Ignora prefixos parciais de processo com zeros à esquerda < 8 dígitos (ex.: "00001")
  if (/^0+[1-9]\d*$/.test(digits) && digits.length < 8) return null;

  const num = parseInt(digits, 10);
  if (!Number.isFinite(num) || num < 1 || num > 350000) return null;

  const pad8 = String(num).padStart(8, '0');
  const bloco = String(Math.floor(num / 1000) * 1000).padStart(8, '0');
  return { num, pad8, bloco, fileName: `${pad8}.KEN` };
}

export type OcrWordTuple = [text: string, x: number, y: number, w: number, h: number];

export interface OcrHighlightBox {
  id: string;
  page: number;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResumoDestaqueDocumento {
  ocorrencias: OcrHighlightBox[];
  porPagina: Record<number, OcrHighlightBox[]>;
  paginasComOcorrencia: Array<{ page: number; count: number }>;
  total: number;
}

const ROTULOS_GENERICOS_DESTAQUE = new Set([
  'matricula',
  'matr',
  'mat',
  'protocolo',
  'prenotacao',
  'transcricao',
  'transcr',
  'titulo',
  'n',
  'no',
  'numero',
]);

/** Extrai tokens significativos para destaque na imagem/documento, removendo rótulos genéricos quando houver valor principal. */
export function extrairTokensDestaquePesquisa(termoBruto: string): string[] {
  const limpo = normalizarTextoVisualizador(termoBruto)
    .replace(/n[ºo°]\.?/gi, ' ')
    .replace(/[|]/g, ' ')
    .trim();
  if (!limpo) return [];
  const brutoTokens = limpo
    .split(/\s+/)
    .map((t) => t.replace(/^[.,;:()\[\]"']+|[,;:()\[\]"']+$/g, ''))
    .filter(Boolean);
  if (brutoTokens.length === 0) return [];
  const significativos = brutoTokens.filter((t) => !ROTULOS_GENERICOS_DESTAQUE.has(t.replace(/\.+$/, '')));
  return significativos.length > 0 ? significativos : brutoTokens;
}

function limparPontuacaoBordaOcr(normWord: string): string {
  return normWord.replace(/^[.,;:()\[\]"'\/\\\-]+|[.,;:()\[\]"'\/\\\-]+$/g, '');
}

function casaTokenOcrUnico(token: string, wordText: string): boolean {
  const normWord = normalizarTextoVisualizador(wordText);
  if (!normWord) return false;
  if (/^[0-9.]+$/.test(token)) {
    const rawDigits = token.replace(/\./g, '');
    if (/^\d{1,8}$/.test(rawDigits)) {
      const semZeros = rawDigits.replace(/^0+/, '') || '0';
      const normMilhares = unirSeparadoresMilhar(normWord);
      return new RegExp(`(^|\\D)0*${semZeros}(\\D|$)`).test(normMilhares);
    }
  }
  const limpoWord = limparPontuacaoBordaOcr(normWord);
  const limpoTok = limparPontuacaoBordaOcr(token);
  if (limpoWord === limpoTok) return true;
  return limpoTok.length >= 2 && normWord.includes(limpoTok);
}

function criarCaixaComMargem(
  id: string,
  page: number,
  text: string,
  rawX: number,
  rawY: number,
  rawW: number,
  rawH: number,
): OcrHighlightBox {
  const padX = 0.003;
  const padY = 0.002;
  const x = Math.max(0, rawX - padX);
  const y = Math.max(0, rawY - padY);
  const maxX = Math.min(1, rawX + rawW + padX);
  const maxY = Math.min(1, rawY + rawH + padY);
  return {
    id,
    page,
    text,
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    w: Number(Math.max(0.004, maxX - x).toFixed(4)),
    h: Number(Math.max(0.004, maxY - y).toFixed(4)),
  };
}

const CONECTORES_CURTOS_OCR = new Set([
  'de',
  'da',
  'do',
  'dos',
  'das',
  'e',
  'no',
  'na',
  'n',
  'n.',
  'no.',
  '-',
]);

function ehConectorCurtoOcr(wordText: string): boolean {
  const norm = normalizarTextoVisualizador(wordText).replace(/[.,;:()\[\]"']+$/g, '');
  return CONECTORES_CURTOS_OCR.has(norm);
}

/** Localiza caixas de destaque por página e contabiliza ocorrências a partir do índice OCR retornado pelo Connector. */
export function calcularDestaquesOcrDocumento(
  ocrPorPagina: Record<number, OcrWordTuple[]>,
  termoBruto: string,
): ResumoDestaqueDocumento {
  const tokens = extrairTokensDestaquePesquisa(termoBruto);
  const porPagina: Record<number, OcrHighlightBox[]> = {};
  const ocorrencias: OcrHighlightBox[] = [];
  const paginasComOcorrencia: Array<{ page: number; count: number }> = [];

  if (tokens.length === 0 || tokens.join('').length < 2) {
    return { ocorrencias, porPagina, paginasComOcorrencia, total: 0 };
  }

  const paginasOrdenadas = Object.keys(ocrPorPagina)
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  for (const pageNum of paginasOrdenadas) {
    const words = ocrPorPagina[pageNum] || [];
    if (words.length === 0) continue;

    const boxesPagina: OcrHighlightBox[] = [];
    if (tokens.length === 1) {
      const tok = tokens[0];
      for (let i = 0; i < words.length; i++) {
        const [txt, x, y, w, h] = words[i];
        if (!casaTokenOcrUnico(tok, txt)) continue;
        boxesPagina.push(criarCaixaComMargem(`p${pageNum}-i${i}`, pageNum, txt, x, y, w, h));
      }
    } else {
      const tokensSignificativos = tokens.filter((t) => !ehConectorCurtoOcr(t));
      const tokensFrase = tokens;
      for (let k = 0; k < words.length; k++) {
        if (!casaTokenOcrUnico(tokensFrase[0], words[k][0])) continue;
        let wi = k + 1;
        let ti = 1;
        const slice: OcrWordTuple[] = [words[k]];
        let matched = true;

        while (ti < tokensFrase.length) {
          if (wi >= words.length) {
            matched = false;
            break;
          }
          // Se o próximo token da busca for um conector curto e o OCR já vier com ou sem ele
          if (ehConectorCurtoOcr(tokensFrase[ti]) && !casaTokenOcrUnico(tokensFrase[ti], words[wi][0])) {
            ti++;
            continue;
          }
          if (casaTokenOcrUnico(tokensFrase[ti], words[wi][0])) {
            slice.push(words[wi]);
            wi++;
            ti++;
            continue;
          }
          // Permite até 1 palavra conectora intermediária no OCR (ex.: "JERONIMO [DE] MENDONCA")
          if (
            ehConectorCurtoOcr(words[wi][0]) &&
            wi + 1 < words.length &&
            casaTokenOcrUnico(tokensFrase[ti], words[wi + 1][0])
          ) {
            slice.push(words[wi], words[wi + 1]);
            wi += 2;
            ti++;
            continue;
          }
          matched = false;
          break;
        }

        if (!matched) continue;

        const mesmaLinha = slice.every((w) => Math.abs(w[2] - slice[0][2]) < 0.025);
        if (mesmaLinha) {
          const minX = Math.min(...slice.map((w) => w[1]));
          const minY = Math.min(...slice.map((w) => w[2]));
          const maxX = Math.max(...slice.map((w) => w[1] + w[3]));
          const maxY = Math.max(...slice.map((w) => w[2] + w[4]));
          const frase = slice.map((w) => w[0]).join(' ');
          boxesPagina.push(criarCaixaComMargem(`p${pageNum}-seq${k}`, pageNum, frase, minX, minY, maxX - minX, maxY - minY));
        } else {
          // Quando a frase quebra de linha no documento, cria um retângulo para cada palavra encontrada
          for (let offset = 0; offset < slice.length; offset++) {
            const [txt, x, y, w, h] = slice[offset];
            boxesPagina.push(criarCaixaComMargem(`p${pageNum}-seq${k}-w${offset}`, pageNum, txt, x, y, w, h));
          }
        }
        k = Math.max(k, wi - 1);
      }

      // Fallback para buscas Full-Text: se todos os tokens principais ocorrem na mesma página em posições distintas
      if (boxesPagina.length === 0) {
        const termosPagina = (tokensSignificativos.length > 0 ? tokensSignificativos : tokens).filter(
          (tok) => tok.length >= 3 || /\d/.test(tok),
        );
        if (termosPagina.length >= 2) {
          const hitsPorTermo = termosPagina.map((tok) => {
            const found: Array<{ idx: number; tuple: OcrWordTuple }> = [];
            for (let i = 0; i < words.length; i++) {
              if (casaTokenOcrUnico(tok, words[i][0])) {
                found.push({ idx: i, tuple: words[i] });
              }
            }
            return found;
          });
          if (hitsPorTermo.every((h) => h.length > 0)) {
            const seenIdx = new Set<number>();
            for (const grupo of hitsPorTermo) {
              for (const item of grupo) {
                if (seenIdx.has(item.idx)) continue;
                seenIdx.add(item.idx);
                const [txt, x, y, w, h] = item.tuple;
                boxesPagina.push(criarCaixaComMargem(`p${pageNum}-all${item.idx}`, pageNum, txt, x, y, w, h));
              }
            }
          }
        }
      }
    }

    if (boxesPagina.length > 0) {
      boxesPagina.sort((a, b) => a.y - b.y || a.x - b.x);
      porPagina[pageNum] = boxesPagina;
      ocorrencias.push(...boxesPagina);
      paginasComOcorrencia.push({ page: pageNum, count: boxesPagina.length });
    }
  }

  return {
    ocorrencias,
    porPagina,
    paginasComOcorrencia,
    total: ocorrencias.length,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function construirMapaNormalizadoTextoPlano(text: string): {
  normStr: string;
  normStartToOrig: number[];
  normEndToOrig: number[];
} {
  let normStr = '';
  const normStartToOrig: number[] = [];
  const normEndToOrig: number[] = [];
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i) ?? text.charCodeAt(i);
    const charLen = cp > 0xffff ? 2 : 1;
    const base = text
      .slice(i, i + charLen)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    for (const ch of base) {
      normStr += ch;
      normStartToOrig.push(i);
      normEndToOrig.push(i + charLen);
    }
    i += charLen;
  }
  return { normStr, normStartToOrig, normEndToOrig };
}

function buildPatternForHighlightToken(tok: string): { pattern: string; numeric: boolean } {
  if (/^[0-9.]+$/.test(tok)) {
    const rawDigits = tok.replace(/\./g, '');
    if (/^\d{1,8}$/.test(rawDigits)) {
      const semZeros = rawDigits.replace(/^0+/, '') || '0';
      const interleaved = semZeros.split('').map(escapeRegExp).join('\\.?');
      return { pattern: `0*${interleaved}`, numeric: true };
    }
  }
  return { pattern: escapeRegExp(limparPontuacaoBordaOcr(tok)), numeric: false };
}

function temFronteiraNumericaValida(normStr: string, start: number, end: number): boolean {
  if (start > 0) {
    const prev = normStr[start - 1];
    if (/\d/.test(prev)) return false;
    if (prev === '.' && start >= 2 && /\d/.test(normStr[start - 2])) return false;
  }
  if (end < normStr.length) {
    const next = normStr[end];
    if (/\d/.test(next)) return false;
    if (next === '.' && end + 1 < normStr.length && /\d/.test(normStr[end + 1])) return false;
  }
  return true;
}

function destacarTextoPlanoSeguro(text: string, tokens: string[]): { out: string; count: number } {
  if (!text) return { out: text, count: 0 };
  const specs = tokens.map(buildPatternForHighlightToken).filter((s) => Boolean(s.pattern));
  if (specs.length === 0) return { out: text, count: 0 };

  const temNumerico = specs.some((s) => s.numeric);
  const patternStr = specs.length === 1 ? specs[0].pattern : specs.map((s) => s.pattern).join('[\\s.,;:/\\-]+');
  const rx = new RegExp(patternStr, 'g');
  const { normStr, normStartToOrig, normEndToOrig } = construirMapaNormalizadoTextoPlano(text);

  const ranges: Array<[number, number]> = [];
  for (const m of normStr.matchAll(rx)) {
    const mIdx = m.index ?? -1;
    if (mIdx < 0 || !m[0]) continue;
    const mEnd = mIdx + m[0].length;
    if (temNumerico && specs.length === 1 && !temFronteiraNumericaValida(normStr, mIdx, mEnd)) {
      continue;
    }
    const origStart = normStartToOrig[mIdx];
    const origEnd = normEndToOrig[mEnd - 1];
    if (origStart === undefined || origEnd === undefined || origEnd <= origStart) continue;
    const last = ranges[ranges.length - 1];
    if (!last || origStart >= last[1]) {
      ranges.push([origStart, origEnd]);
    }
  }

  if (ranges.length === 0) return { out: text, count: 0 };

  let cursor = 0;
  let out = '';
  for (const [start, end] of ranges) {
    out += text.slice(cursor, start);
    out += `<mark class="fiorix-doc-highlight bg-amber-300/85 text-slate-950 px-0.5 rounded ring-1 ring-amber-500 font-semibold">${text.slice(start, end)}</mark>`;
    cursor = end;
  }
  out += text.slice(cursor);
  return { out, count: ranges.length };
}

/**
 * Destaca termos pesquisados apenas nos nós de texto de HTML já sanitizado, preservando todas as tags e entidades HTML.
 */
export function destacarTermoEmHtmlSanitizado(html: string, termoBruto: string): { html: string; total: number } {
  const tokens = extrairTokensDestaquePesquisa(termoBruto);
  if (!html || tokens.length === 0 || tokens.join('').length < 2) {
    return { html, total: 0 };
  }

  const partes = html.split(/(<[^>]+>)/g);
  let total = 0;
  const processadas = partes.map((parte, idx) => {
    if (!parte || idx % 2 === 1) return parte; // Mantém tags HTML intactas
    const segmentosEntidade = parte.split(/(&[a-zA-Z0-9#]+;)/g);
    return segmentosEntidade
      .map((seg, segIdx) => {
        if (!seg || segIdx % 2 === 1) return seg; // Mantém entidades HTML intactas
        const { out, count } = destacarTextoPlanoSeguro(seg, tokens);
        total += count;
        return out;
      })
      .join('');
  });

  return { html: processadas.join(''), total };
}

/** Ajusta URL de PDF (blob:/https:) para recolher painel de miniaturas nativo e ajustar à largura. */
export function construirUrlIframePdf(rawUrl: string): string {
  if (!rawUrl || rawUrl.startsWith('data:')) return rawUrl;
  const base = rawUrl.split('#')[0];
  return `${base}#navpanes=0&view=FitH`;
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

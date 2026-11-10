export interface ConfrontacoesExtraidas {
  ladoDireito: string;
  ladoEsquerdo: string;
  fundos: string;
}

export interface PlantaSetorInfo {
  setor: string;
  quadra: string;
  lote?: string;
  pastaSetor: string;
  arquivoKen: string;
  caminhoRelativo: string;
  caminhoCompleto: string;
  termoBusca: string;
}

/**
 * Limpa e padroniza a redação do confrontante conforme os padrões
 * registrais do 7º Registro de Imóveis de São Paulo.
 * Exemplo: "pelo lado direito com o nº 1405" -> "com o nº 1405"
 * Exemplo: "Pedro Silveira" -> "com Pedro Silveira"
 */
export function limparConfrontante(valor: string): string {
  if (!valor) return '';
  let limpo = valor
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove pontuações iniciais, aspas e traços
  limpo = limpo.replace(/^[\s\-–—:;."']+|[\s\-–—:;."']+$/g, '').trim();

  // Remove prefixos direcionais redundantes caso venham no texto capturado
  limpo = limpo.replace(/^(?:pelo\s+lado\s+direito|do\s+lado\s+direito|ao\s+lado\s+direito|lado\s+direito|pela\s+direita|à\s+direita|a\s+direita|direita)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^(?:pelo\s+lado\s+esquerdo|do\s+lado\s+esquerdo|ao\s+lado\s+esquerdo|lado\s+esquerdo|pela\s+esquerda|à\s+esquerda|a\s+esquerda|esquerda)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^(?:e\s+aos\s+fundos|aos\s+fundos|e\s+nos\s+fundos|nos\s+fundos|fundos|e\s+pelos\s+fundos|pelos\s+fundos|e\s+fundos)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^[:\s\-–—]+/, '').trim();

  // Remove cláusulas intermediárias de ponto de vista ("de quem da rua olha para o imóvel, confronta com...")
  limpo = limpo.replace(
    /^(?:de\s+quem\s+(?:da\s+rua|do\s+im[óo]vel|de\s+frente|de\s+dentro|da\s+via\s+p[úu]blica)\s+olha\s+(?:para\s+)?(?:o\s+im[óo]vel|a\s+rua|o\s+terreno|o\s+lote)[,\s]*)/i,
    '',
  ).trim();
  limpo = limpo.replace(
    /^(?:mede\s+[0-9.,]+\s*(?:m|metros|ms)?(?:\s+da\s+frente\s+aos\s+fundos)?[,\s]*(?:e\s+)?)/i,
    '',
  ).trim();
  limpo = limpo.replace(
    /^(?:confronta(?:ndo)?(?:\s+com|\s+como)?|confina(?:ndo)?(?:\s+com)?|divide(?:\s+com)?|limita(?:-se)?(?:\s+com)?|com\s+o\s+im[óo]vel|como\s+im[óo]vel|com|como|:)\s*/i,
    (m) => (/im[óo]vel/i.test(m) ? 'com o imóvel ' : ''),
  ).trim();

  // Remove menções subsequentes a outras direções que possam ter sido engolidas pela captura
  limpo = limpo.replace(
    /\s+(?:,\s*)?(?:[234]\.\s*(?:ao\s+lado|a\s+frente|aos\s+fundos)|pelo\s+lado|do\s+lado|ao\s+lado|lado|e\s+aos\s+fundos|aos\s+fundos|e\s+nos\s+fundos|nos\s+fundos|e\s+pelos\s+fundos|e\s+fundos|\bfundos\b|esquerdo|direito|à\s+esquerda|à\s+direita|processo\s+\d{7}-\d{2}|para\s+conferir\s+o\s+original).*$/i,
    '',
  ).trim();

  // Remove traços ou pontuações finais remanescentes
  limpo = limpo.replace(/[\s\-–—:;.,]+$/, '').trim();

  if (!limpo || /^de\s+quem\s+da\s+rua/i.test(limpo)) return '';

  // Padroniza com 'com ' se não iniciar com 'com '
  if (!/^com\b/i.test(limpo)) {
    limpo = `com ${limpo}`;
  }
  return limpo;
}

/**
 * Analisa e extrai automaticamente as confrontações perimetrais
 * (Lado Direito, Lado Esquerdo e Fundos) a partir do texto de
 * matrículas imobiliárias, transcrições do Livro 2, plantas municipais
 * ou laudos técnicos do processo de usucapião.
 */
export function extrairConfrontacoes(texto: string): ConfrontacoesExtraidas {
  if (!texto) return { ladoDireito: '', ladoEsquerdo: '', fundos: '' };

  const norm = texto
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ');

  let ladoDireito = '';
  let ladoEsquerdo = '';
  let fundos = '';

  const prefixoOlhar = `(?:de\\s+quem\\s+(?:da\\s+rua|do\\s+im[óo]vel|de\\s+frente|de\\s+dentro)\\s+olha\\s+(?:para\\s+)?(?:o\\s+im[óo]vel|a\\s+rua|o\\s+terreno)[,\\s]*)?`;
  const prefixoMedida = `(?:mede\\s+[0-9.,]+\\s*(?:m|metros|ms)?(?:\\s+da\\s+frente\\s+aos\\s+fundos)?[,\\s]*(?:e\\s+)?)?`;
  const prefixoVerbo = `(?:confronta(?:ndo)?(?:\\s+com|\\s+como)?|confina(?:ndo)?(?:\\s+com)?|divide(?:\\s+com)?|limita(?:-se)?(?:\\s+com)?|com|como|:)?`;

  // 1. Lado Direito
  const regexDir = new RegExp(
    `(?:pelo\\s+lado\\s+direito|do\\s+lado\\s+direito|ao\\s+lado\\s+direito|lado\\s+direito|pela\\s+direita|à\\s+direita|a\\s+direita|\\bdireito\\b)\\s*${prefixoOlhar}\\s*${prefixoMedida}\\s*${prefixoVerbo}\\s*([^;]{2,160}?)(?=(?:,\\s*(?:pelo\\s+lado|do\\s+lado|ao\\s+lado|pela\\s+esquerda|e\\s+aos|aos\\s+fundos|e\\s+pelos|e\\s+nos|lado\\s+esquerdo|esquerdo|à\\s+esquerda)|;\\s*|\\.(?:\\s+[A-Z0-9]|$)|\\s+[234]\\.\\s+|$))`,
    'i',
  );
  const matchDir = norm.match(regexDir);
  if (matchDir && matchDir[1]) {
    ladoDireito = limparConfrontante(matchDir[1]);
  }
  if (!ladoDireito) {
    const invDir = norm.match(/([^.;]{5,120}?)\s*\(\s*confrontante\s+(?:da\s+direita|do\s+lado\s+direito|lado\s+direito)\s*\)/i);
    if (invDir && invDir[1]) ladoDireito = limparConfrontante(invDir[1]);
  }

  // 2. Lado Esquerdo
  const regexEsq = new RegExp(
    `(?:pelo\\s+lado\\s+esquerdo|do\\s+lado\\s+esquerdo|ao\\s+lado\\s+esquerdo|lado\\s+esquerdo|pela\\s+esquerda|à\\s+esquerda|a\\s+esquerda|\\besquerdo\\b)\\s*${prefixoOlhar}\\s*${prefixoMedida}\\s*${prefixoVerbo}\\s*([^;]{2,160}?)(?=(?:,\\s*(?:pelo\\s+lado|do\\s+lado|ao\\s+lado|e\\s+aos|aos\\s+fundos|e\\s+pelos|e\\s+nos|e\\s+fundos|fundos)|;\\s*|\\s+e\\s+(?:aos\\s+|nos\\s+|pelos\\s+)?fundos|\\.(?:\\s+[A-Z0-9]|$)|\\s+[34]\\.\\s+|$))`,
    'i',
  );
  const matchEsq = norm.match(regexEsq);
  if (matchEsq && matchEsq[1]) {
    ladoEsquerdo = limparConfrontante(matchEsq[1]);
  }
  if (!ladoEsquerdo) {
    const invEsq = norm.match(/([^.;]{5,120}?)\s*\(\s*confrontante\s+(?:da\s+esquerda|do\s+lado\s+esquerdo|lado\s+esquerdo)\s*\)/i);
    if (invEsq && invEsq[1]) ladoEsquerdo = limparConfrontante(invEsq[1]);
  }

  // 3. Fundos
  const regexFundos = new RegExp(
    `(?:e\\s+aos\\s+fundos|aos\\s+fundos|e\\s+nos\\s+fundos|nos\\s+fundos|e\\s+pelos\\s+fundos|pelos\\s+fundos|e\\s+fundos|\\bfundos\\b(?=\\s*(?::|com\\b|confronta|confina|divide|mede)))\\s*${prefixoOlhar}\\s*${prefixoMedida}\\s*${prefixoVerbo}\\s*([^;.]{2,160}?)(?=(?:;\\s*|\\.(?:\\s|$)|$))`,
    'i',
  );
  const matchFundos = norm.match(regexFundos);
  if (matchFundos && matchFundos[1]) {
    fundos = limparConfrontante(matchFundos[1]);
  }
  if (!fundos) {
    const invFundos = norm.match(/([^.;]{5,120}?)\s*\(\s*confrontante\s+(?:dos\s+fundos|de\s+fundos|fundos)\s*\)/i);
    if (invFundos && invFundos[1]) fundos = limparConfrontante(invFundos[1]);
  }

  return { ladoDireito, ladoEsquerdo, fundos };
}

/**
 * Resolve o caminho da Planta Fiscal na pasta K:\IMAGENS\SETORES
 * a partir do SQL (ex.: "053.006.0049-0") ou da descrição do imóvel.
 */
export function resolverPlantaSetorQuadra(sql?: string, imovel?: string): PlantaSetorInfo | null {
  const textoSql = (sql || '').trim();
  const digitosSql = textoSql.replace(/[^\d]/g, '');
  let setor = '';
  let quadra = '';
  let lote = '';

  const mFormatado = textoSql.match(/(\d{3})\.(\d{3})(?:\.(\d{4}))?/);
  if (mFormatado && (mFormatado[1] !== '000' || mFormatado[2] !== '000')) {
    setor = mFormatado[1];
    quadra = mFormatado[2];
    lote = mFormatado[3] || '';
  } else if ((digitosSql.length === 10 || digitosSql.length === 11) && !/^0+$/.test(digitosSql)) {
    setor = digitosSql.slice(0, 3);
    quadra = digitosSql.slice(3, 6);
    lote = digitosSql.slice(6, 10);
  }

  if ((!setor || !quadra) && imovel) {
    const mSetorQuadra = imovel.match(/setor(?:\s+fiscal)?\s*[:nºo°.\s]*(\d{1,3})[\s,;/\-]+quadra(?:\s+fiscal)?\s*[:nºo°.\s]*(\d{1,3})/i);
    if (mSetorQuadra) {
      setor = mSetorQuadra[1].padStart(3, '0');
      quadra = mSetorQuadra[2].padStart(3, '0');
    }
    const mLoteQuadra = imovel.match(/lote\s*[:nºo°.\s]*(\d{1,4})\s+(?:da\s+)?quadra\s*[:nºo°.\s]*(\d{1,4})/i);
    if (mLoteQuadra && !lote) {
      lote = mLoteQuadra[1].padStart(4, '0');
      if (!quadra) quadra = mLoteQuadra[2].padStart(3, '0');
    }
  }

  if (!setor || !quadra || setor === '000') return null;
  const pastaSetor = `00${setor}000`;
  const arquivoKen = `00${setor}${quadra}.KEN`;
  return {
    setor,
    quadra,
    lote: lote || undefined,
    pastaSetor,
    arquivoKen,
    caminhoRelativo: `SETORES\\${pastaSetor}\\${arquivoKen}`,
    caminhoCompleto: `K:\\IMAGENS\\SETORES\\${pastaSetor}\\${arquivoKen}`,
    termoBusca: `00${setor}${quadra}`,
  };
}


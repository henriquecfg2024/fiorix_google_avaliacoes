export interface ConfrontacoesExtraidas {
  ladoDireito: string;
  ladoEsquerdo: string;
  fundos: string;
}

/**
 * Limpa e padroniza a redação do confrontante conforme os padrões
 * registrais do 7º Registro de Imóveis de São Paulo.
 * Exemplo: "pelo lado direito com o nº 1405" -> "com o nº 1405"
 * Exemplo: "Pedro Silveira" -> "com Pedro Silveira"
 */
export function limparConfrontante(valor: string): string {
  if (!valor) return '';
  let limpo = valor.trim();

  // Remove pontuações iniciais, aspas e traços
  limpo = limpo.replace(/^[\s\-–—:;."']+|[\s\-–—:;."']+$/g, '').trim();

  // Remove prefixos direcionais redundantes caso venham no texto capturado
  limpo = limpo.replace(/^(?:pelo\s+lado\s+direito|do\s+lado\s+direito|lado\s+direito|à\s+direita|a\s+direita|direita)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^(?:pelo\s+lado\s+esquerdo|do\s+lado\s+esquerdo|lado\s+esquerdo|à\s+esquerda|a\s+esquerda|esquerda)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^(?:e\s+aos\s+fundos|aos\s+fundos|e\s+nos\s+fundos|nos\s+fundos|fundos|e\s+pelos\s+fundos|pelos\s+fundos|e\s+fundos)\s*(?:com)?/i, '');
  limpo = limpo.replace(/^[:\s\-–—]+/, '').trim();

  // Remove menções subsequentes a outras direções que possam ter sido engolidas pela captura
  limpo = limpo.replace(/\s+(?:,\s*)?(?:pelo\s+lado|do\s+lado|lado|e\s+aos\s+fundos|aos\s+fundos|e\s+nos\s+fundos|nos\s+fundos|e\s+pelos\s+fundos|e\s+fundos|\bfundos\b|esquerdo|direito|à\s+esquerda|à\s+direita).*$/i, '').trim();

  // Remove traços ou pontuações finais remanescentes
  limpo = limpo.replace(/[\s\-–—:;.,]+$/, '').trim();

  if (!limpo) return '';

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

  let ladoDireito = '';
  let ladoEsquerdo = '';
  let fundos = '';

  // 1. Lado Direito
  const matchDir = texto.match(
    /(?:pelo\s+lado\s+direito|do\s+lado\s+direito|lado\s+direito|à\s+direita|a\s+direita|\bdireito\b)\s*(?:mede\s+[0-9.,]+[a-z]*[,\s]+confrontando\s+com|confronta(?:ndo)?(?:\s+com)?|confina(?:\s+com)?|com|:)?\s*([^\n\r;]{2,100}?)(?=(?:,\s*(?:pelo\s+lado|do\s+lado|e\s+aos|aos\s+fundos|e\s+pelos|e\s+nos|lado\s+esquerdo|esquerdo|à\s+esquerda)|;\s*|\n|\r|$))/i
  );
  if (matchDir) {
    ladoDireito = limparConfrontante(matchDir[1] || matchDir[0]);
  }

  // 2. Lado Esquerdo
  const matchEsq = texto.match(
    /(?:pelo\s+lado\s+esquerdo|do\s+lado\s+esquerdo|lado\s+esquerdo|à\s+esquerda|a\s+esquerda|\besquerdo\b)\s*(?:mede\s+[0-9.,]+[a-z]*[,\s]+confrontando\s+com|confronta(?:ndo)?(?:\s+com)?|confina(?:\s+com)?|com|:)?\s*([^\n\r;]{2,100}?)(?=(?:,\s*(?:pelo\s+lado|do\s+lado|e\s+aos|aos\s+fundos|e\s+pelos|e\s+nos|e\s+fundos|fundos)|;\s*|\s+e\s+(?:aos\s+|nos\s+|pelos\s+)?fundos|\n|\r|$))/i
  );
  if (matchEsq) {
    ladoEsquerdo = limparConfrontante(matchEsq[1] || matchEsq[0]);
  }

  // 3. Fundos
  const matchFundos = texto.match(
    /(?:e\s+aos\s+fundos|aos\s+fundos|e\s+nos\s+fundos|nos\s+fundos|e\s+pelos\s+fundos|pelos\s+fundos|e\s+fundos|\bfundos\b)\s*(?:mede\s+[0-9.,]+[a-z]*[,\s]+confrontando\s+com|confronta(?:ndo)?(?:\s+com)?|confina(?:\s+com)?|com|:)?\s*([^\n\r;]{2,100}?)(?=(?:;\s*|\.|\n|\r|$))/i
  );
  if (matchFundos) {
    fundos = limparConfrontante(matchFundos[1] || matchFundos[0]);
  }

  return { ladoDireito, ladoEsquerdo, fundos };
}

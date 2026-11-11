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
 * Identifica se um texto ou endereço corresponde a timbres institucionais
 * (ex.: 7º RI na Rua Augusta 356, Defensoria Pública na Av. Liberdade 32 ou Rua Boa Vista,
 * Fórum João Mendes, TJSP, Ministério Público ou Prefeitura), que nunca são o imóvel usucapiendo.
 */
export function ehEnderecoTimbreInstitucional(texto?: string | null): boolean {
  if (!texto) return false;
  const v = texto.replace(/\s+/g, ' ').trim();
  if (!v) return false;
  return (
    // 7º Oficial de Registro de Imóveis da Capital (Rua Augusta, 356)
    /rua\s+augusta[,\s]+(?:n[ºo°.]?\s*)?356\b/i.test(v) ||
    /\b(?:3218-0527|01304-000)\b/i.test(v) ||
    // Defensoria Pública do Estado de São Paulo (Unidade Cível Central - Av. Liberdade, 32 / Rua Boa Vista / Líbero Badaró)
    /\bav(?:enida|\.)?\s+(?:da\s+)?liberdade[,\s]+(?:n[ºo°.]?\s*)?32\b/i.test(v) ||
    /\b01502-000\b/i.test(v) ||
    /\bdefensoria\.sp\.def\.br\b/i.test(v) ||
    /\bunidade\s+c[íi]vel\s+central\s+da\s+capital\b/i.test(v) ||
    /\brua\s+boa\s+vista[,\s]+(?:n[ºo°.]?\s*)?(?:103|150|200)\b/i.test(v) ||
    /\brua\s+l[íi]bero\s+badar[óo][,\s]+(?:n[ºo°.]?\s*)?613\b/i.test(v) ||
    // Fórum João Mendes / TJSP / Ministério Público / Prefeitura
    /\b(?:pra[çc]a|f[óo]rum)\s+jo[ãa]o\s+mendes\b/i.test(v) ||
    /\bviaduto\s+dona\s+paulina\b/i.test(v) ||
    /\brua\s+conde\s+de\s+sarzedas\b/i.test(v) ||
    /\brua\s+riachuelo[,\s]+(?:n[ºo°.]?\s*)?115\b/i.test(v) ||
    /\bviaduto\s+do\s+ch[áa][,\s]+(?:n[ºo°.]?\s*)?15\b/i.test(v)
  );
}

/**
 * Higieniza a descrição do imóvel usucapiendo:
 * 1. Remove qualquer cabeçalho de Vara, Juízo, Foro, Comarca, Defensoria, MP, TJSP, URLs ou rodapés de processo.
 * 2. Descarta endereços que sejam timbres institucionais (ex.: Av. Liberdade, 32 da Defensoria ou Rua Augusta, 356 do 7º RI).
 */
export function sanitizarDescricaoImovel(imovel?: string | null): string {
  if (!imovel) return '';
  let limpo = imovel
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\s+/g, ' ')
    .trim();

  if (!limpo) return '';

  // Remove qualquer menção a Vara, Foro, Comarca, endereçamento ao Juízo, Defensoria, MP, TJSP, URLs ou rodapés
  limpo = limpo
    .replace(
      /\s*(?:\b\d+\s+)?(?:[_\-.\s]*[ªº°]\s*VARA\b|\b\d+\s*VARA\b|\b[_\-]{2,}\s*[ªº°]?\s*VARA\b|\bVARA\s+(?:DE\s+REGISTROS\s+P[ÚU]BLICOS|C[ÍI]VEL|DA\s+FAZENDA|DE\s+FAM[ÍI]LIA|DO\s+JUIZADO|FEDERAL|CRIMINAL|EMPRESARIAL|[ÚU]NICA|DISTRITAL))[\s\S]*$/i,
      '',
    )
    .replace(
      /\s*\b(?:EXCELENT[ÍI]SSIM[OA]|EXM[OA]\.?\s*SR|MERIT[ÍI]SSIM[OA]|MM\.?\s*JUIZ|DOUTOR[A]?\s+JUIZ|AO\s+JU[ÍI]ZO|JU[ÍI]ZO\s+DE\s+DIREITO|FORO\s+(?:CENTRAL|REGIONAL)|COMARCA\s+(?:DA\s+CAPITAL|DE\s+S[ÃA]O\s+PAULO)|UNIDADE\s+C[ÍI]VEL|DEFENSORIA\s+P[ÚU]BLICA|MINIST[ÉE]RIO\s+P[ÚU]BLICO|TRIBUNAL\s+DE\s+JUSTI[ÇC]A|PODER\s+JUDICI[ÁA]RIO)[\s\S]*$/i,
      '',
    )
    .replace(
      /\s*(?:https?:\/\/\S+|www\.\S+|\b\S+\.(?:def|jus|gov|org|adv|com)\.br\S*)[\s\S]*$/i,
      '',
    )
    .replace(
      /\s*\b(?:PROCESSO\s+(?:DIGITAL\s+|N[ºO°.]?\s*)?\d{7}-\d{2}|PARA\s+CONFERIR\s+O\s+ORIGINAL|ESTE\s+DOCUMENTO\s+[ÉE]\s+C[ÓO]PIA|ASSINADO\s+DIGITALMENTE)[\s\S]*$/i,
      '',
    )
    .replace(/[\s,;:\-–—/]+$/, '')
    .trim();

  // Segurança adicional: se ainda restar qualquer menção a "Vara de Registros" / "Vara Cível" / "Foro" / "Comarca"
  if (/\bvara\b/i.test(limpo)) {
    limpo = limpo
      .replace(/\s*(?:\b\d+\s*)?[_\-.\sªº°]*\bvara\b[\s\S]*$/i, '')
      .replace(/[\s,;:\-–—/]+$/, '')
      .trim();
  }

  if (!limpo) return '';

  // Se o endereço remanescente for um timbre institucional (ex.: Av. Liberdade, 32 ou Rua Augusta, 356), descarta
  if (ehEnderecoTimbreInstitucional(limpo) || ehEnderecoTimbreInstitucional(imovel)) {
    // Exceção apenas se o texto limpo não contiver o logradouro institucional e tiver endereço próprio válido
    const contemLogradouroInstitucional =
      /\b(?:rua\s+augusta|av(?:enida|\.)?\s+(?:da\s+)?liberdade|rua\s+boa\s+vista|rua\s+l[íi]bero\s+badar[óo]|pra[çc]a\s+jo[ãa]o\s+mendes|viaduto\s+dona\s+paulina|rua\s+conde\s+de\s+sarzedas|rua\s+riachuelo|viaduto\s+do\s+ch[áa])\b/i.test(
        limpo,
      );
    if (contemLogradouroInstitucional) return '';
  }

  // Se sobrou apenas o prefixo vazio ("Imóvel situado à", "Imóvel", etc.)
  if (
    /^(?:im[óo]vel(?:\s+usucapiendo)?(?:\s+situado|\s+localizado)?(?:\s+[àa]|\s+na|\s+no)?|situado\s+[àa]|localizado\s+na)$/i.test(
      limpo,
    )
  ) {
    return '';
  }

  return limpo;
}

/**
 * Higieniza o campo `rua_olhar_confrontacao` (Frente / Logradouro),
 * removendo cabeçalhos de Vara/Foro e descartando logradouros de timbres institucionais.
 */
export function sanitizarLogradouroConfrontacao(
  rua?: string | null,
  imovelOriginal?: string | null,
): string {
  if (!rua) return '';
  let limpo = sanitizarDescricaoImovel(rua);
  if (!limpo) return '';

  const ehRuaInstitucionalSemNumero =
    /^(?:rua\s+augusta|av(?:enida|\.)?\s+(?:da\s+)?liberdade|rua\s+boa\s+vista|rua\s+l[íi]bero\s+badar[óo]|pra[çc]a\s+jo[ãa]o\s+mendes|viaduto\s+dona\s+paulina|rua\s+conde\s+de\s+sarzedas|rua\s+riachuelo|viaduto\s+do\s+ch[áa])$/i.test(
      limpo.trim(),
    );

  if (ehRuaInstitucionalSemNumero) {
    const imovelSanitizado = sanitizarDescricaoImovel(imovelOriginal);
    if (!imovelSanitizado) return '';
  }

  return limpo;
}

/**
 * Procura no texto dos autos (petição inicial, certidão ou matrícula) a descrição real
 * do imóvel usucapiendo, ignorando timbres institucionais e cabeçalhos de Vara.
 */
export function extrairImovelDoTextoAutos(texto?: string | null): { imovel: string; rua: string } {
  if (!texto) return { imovel: '', rua: '' };
  const norm = texto
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ');

  const padroes = [
    /\b(?:im[óo]vel\s+(?:usucapiendo|objeto\s+da\s+presente|objeto\s+desta|em\s+quest[ãa]o|consistente)[^.;]{0,60}?(?:situado|localizado)\s+(?:na|no|[àa])\s+(?:Rua|Avenida|Av\.|Travessa|Alameda|Pra[çc]a|Viela|Estrada)\s+[^.;]{5,180})/gi,
    /\b(?:(?:im[óo]vel|terreno|pr[ée]dio|casa)\s+(?:situad[oa]|localizad[oa])\s+(?:na|no|[àa])\s+(?:Rua|Avenida|Av\.|Travessa|Alameda|Pra[çc]a|Viela|Estrada)\s+[^.;]{5,180})/gi,
    /\b(?:casa\s+que\s+recebeu\s+o\s+n[ºo°.]?\s*\d+\s+da\s+(?:Rua|Avenida|Av\.|Travessa|Alameda|Viela|Estrada)\s+[^.;,]{2,120}(?:,\s*com\s+a\s+[áa]rea\s+[^.;]{3,80})?)/gi,
  ];

  for (const regex of padroes) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(norm)) !== null) {
      const candidato = sanitizarDescricaoImovel(m[0]);
      if (candidato && candidato.length >= 12) {
        const ruaMatch = candidato.match(
          /\b((?:Rua|Avenida|Av\.|Travessa|Alameda|Pra[çc]a|Viela|Estrada)\s+[^,.;]+(?:\s*,\s*n[ºo°.]?\s*\d+[A-Za-z0-9\-]*)?)/i,
        );
        const rua = ruaMatch ? sanitizarLogradouroConfrontacao(ruaMatch[1], candidato) : '';
        return {
          imovel: /^im[óo]vel/i.test(candidato) ? candidato : `Imóvel: ${candidato}`,
          rua,
        };
      }
    }
  }

  return { imovel: '', rua: '' };
}

/**
 * Formata a descrição do imóvel a partir dos dados cadastrais oficiais do GeoSampa (Lote Cidadão / IPTU),
 * garantindo preenchimento limpo quando a petição continha apenas timbre institucional no cabeçalho.
 */
export function formatarDescricaoImovelGeoSampa(params: {
  logradouro?: string | null;
  numeroPorta?: string | null;
  complemento?: string | null;
  setor?: string | null;
  quadra?: string | null;
  lote?: string | null;
  areaTerreno?: number | null;
}): string {
  const logradouroRaw = (params.logradouro || '').trim();
  const portaRaw = (params.numeroPorta || '').trim();
  const compRaw = (params.complemento || '').trim();
  const setor = (params.setor || '').trim();
  const quadra = (params.quadra || '').trim();
  const lote = (params.lote || '').trim();

  if (!logradouroRaw && (!setor || !quadra)) return '';

  // Se logradouroRaw já contém ", nº ..." (ex.: vindo de confrontantesGeoSampa.frente), não duplica o número
  const jaTemNumero = /\bn[ºo°.]?\s*\d+/i.test(logradouroRaw) || /,\s*\d+/.test(logradouroRaw);
  const enderecoBase = logradouroRaw
    ? `${logradouroRaw}${portaRaw && !jaTemNumero ? `, nº ${portaRaw}` : ''}${compRaw ? ` (${compRaw})` : ''}`
    : '';

  const refCadastral =
    lote && quadra
      ? `Lote ${lote} da Quadra ${quadra}${setor ? `, Setor ${setor}` : ''}`
      : setor && quadra
      ? `Setor ${setor}, Quadra ${quadra}`
      : '';

  const areaTxt =
    typeof params.areaTerreno === 'number' && params.areaTerreno > 0
      ? ` (área de terreno: ${params.areaTerreno} m²)`
      : '';

  if (enderecoBase && refCadastral) {
    return `Imóvel situado à ${enderecoBase} (${refCadastral})${areaTxt}, São Paulo - SP`;
  }
  if (enderecoBase) {
    return `Imóvel situado à ${enderecoBase}${areaTxt}, São Paulo - SP`;
  }
  return `Imóvel localizado no ${refCadastral}${areaTxt}, São Paulo - SP`;
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


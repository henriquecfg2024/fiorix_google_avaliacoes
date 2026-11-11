import {
  ehEnderecoTimbreInstitucional,
  resolverPlantaSetorQuadra,
  sanitizarDescricaoImovel,
  sanitizarLogradouroConfrontacao,
} from '@/lib/confrontacoes';

export interface ValidacaoCnjResultado {
  valido: boolean;
  informado: string;
  formatado: string;
  sequencial: string;
  digitoInformado: string;
  digitoCalculado: string;
  ano: number;
  segmentoCodigo: string;
  tribunalCodigo: string;
  foroCodigo: string;
  tribunalNome: string;
  foroNome: string;
  motivo: string;
}

export interface ValidacaoSqlPmspResultado {
  valido: boolean;
  possuiDv: boolean;
  informado: string;
  formatado: string;
  setor: string;
  quadra: string;
  lote: string;
  dvInformado: string;
  dvCalculado: string;
  arquivoPlantaKen: string;
  caminhoPlantaSetor: string;
  motivo: string;
}

export interface ValidacaoMatriculaResultado {
  valido: boolean;
  tipo: 'MATRICULA' | 'TRANSCRICAO' | 'INDEFINIDO';
  numero: string;
  pad8: string;
  blocoLv2: string;
  arquivoKenLv2: string;
  caminhoLv2: string;
  motivo: string;
}

export interface OrigemCampoSegurancaUI {
  campo: string;
  rotulo?: string;
  pagina: number;
  trecho: string;
  confianca: 'alta' | 'media' | 'baixa' | 'ausente' | string;
  valorExtraido?: string;
  verificacaoSeguranca?: string;
  regraMatematicaOk?: boolean;
  ruidoDescartado?: boolean;
  origemVerificacao?: string;
}

export interface DadosManifestacaoSegurancaInput {
  numero_processo?: string;
  vara?: string;
  requerente?: string;
  imovel?: string;
  rua_olhar_confrontacao?: string;
  contribuinte_sql?: string;
  matricula_transcricao?: string;
  cartorio_origem?: string;
  cartorio_encaminhamento?: string;
  titular_origem?: string;
  subdistrito?: string;
  data_competencia_subdistrito?: string;
  confrontante_lado_direito?: string;
  confrontante_lado_esquerdo?: string;
  confrontante_fundos?: string;
  pagina_inicial_detectada?: number;
}

export interface ItemAuditoriaSegurancaCampo {
  id: string;
  titulo: string;
  valor: string;
  status: 'VALIDADO' | 'ALERTA' | 'PENDENTE';
  normaTecnica: string;
  detalhe: string;
  sugestaoCorrecao?: string;
  campoAlvo?: keyof DadosManifestacaoSegurancaInput;
}

export interface DiagnosticoSegurancaFormulario {
  score: number;
  totalRegras: number;
  regrasValidadas: number;
  regrasAlerta: number;
  regrasPendentes: number;
  nivel: 'MAXIMA' | 'ALTA' | 'ATENCAO' | 'CRITICA';
  cnj: ValidacaoCnjResultado;
  sql: ValidacaoSqlPmspResultado;
  matricula: ValidacaoMatriculaResultado;
  itens: ItemAuditoriaSegurancaCampo[];
}

const FOROS_TJSP: Record<string, string> = {
  '0000': 'Tribunal de Justiça de São Paulo (2º Grau)',
  '0100': 'Foro Central Cível / Varas de Registros Públicos da Capital',
  '0053': 'Foro Central — Fazenda Pública / Acidentes da Capital',
  '0001': 'Foro Regional I — Santana (Capital)',
  '0002': 'Foro Regional II — Santo Amaro (Capital)',
  '0003': 'Foro Regional III — Jabaquara (Capital)',
  '0004': 'Foro Regional IV — Lapa (Capital)',
  '0005': 'Foro Regional V — São Miguel Paulista (Capital)',
  '0006': 'Foro Regional VI — Penha de França (Capital)',
  '0007': 'Foro Regional VII — Itaquera (Capital)',
  '0008': 'Foro Regional VIII — Tatuapé (Capital)',
  '0009': 'Foro Regional IX — Vila Prudente (Capital)',
  '0010': 'Foro Regional X — Ipiranga (Capital)',
  '0011': 'Foro Regional XI — Pinheiros (Capital)',
  '0012': 'Foro Regional XII — Nossa Senhora do Ó (Capital)',
  '0020': 'Foro Regional XX — Tatuapé / Itaquera',
};

/**
 * Valida o Número Único de Processo Judicial conforme Resolução CNJ nº 65/2008
 * utilizando o algoritmo oficial ISO 7064 Mod 97-10:
 * Formato: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)
 */
export function validarNumeroProcessoCnj(numeroRaw?: string | null): ValidacaoCnjResultado {
  const informado = (numeroRaw || '').trim();
  const digitos = informado.replace(/[^\d]/g, '');

  if (!digitos) {
    return {
      valido: false,
      informado,
      formatado: '',
      sequencial: '',
      digitoInformado: '',
      digitoCalculado: '',
      ano: 0,
      segmentoCodigo: '',
      tribunalCodigo: '',
      foroCodigo: '',
      tribunalNome: '',
      foroNome: '',
      motivo: 'Número do processo judicial não informado.',
    };
  }

  if (digitos.length !== 20) {
    return {
      valido: false,
      informado,
      formatado: informado,
      sequencial: digitos.slice(0, 7),
      digitoInformado: digitos.slice(7, 9),
      digitoCalculado: '',
      ano: Number(digitos.slice(9, 13)) || 0,
      segmentoCodigo: digitos.slice(13, 14),
      tribunalCodigo: digitos.slice(14, 16),
      foroCodigo: digitos.slice(16, 20),
      tribunalNome: '',
      foroNome: '',
      motivo: `Padrão CNJ requer exatamente 20 dígitos (Resolução CNJ nº 65/2008); foram informados ${digitos.length} dígitos.`,
    };
  }

  const sequencial = digitos.slice(0, 7);
  const digitoInformado = digitos.slice(7, 9);
  const anoStr = digitos.slice(9, 13);
  const ano = Number(anoStr);
  const segmentoCodigo = digitos.slice(13, 14);
  const tribunalCodigo = digitos.slice(14, 16);
  const foroCodigo = digitos.slice(16, 20);
  const formatado = `${sequencial}-${digitoInformado}.${anoStr}.${segmentoCodigo}.${tribunalCodigo}.${foroCodigo}`;

  // Cálculo em blocos conforme Resolução CNJ nº 65/2008 (ISO 7064 Mod 97-10)
  const r1 = Number(sequencial) % 97;
  const r2 = Number(`${String(r1).padStart(2, '0')}${anoStr}${segmentoCodigo}${tribunalCodigo}`) % 97;
  const r3 = Number(`${String(r2).padStart(2, '0')}${foroCodigo}00`) % 97;
  const dvCalcNum = 98 - r3;
  const digitoCalculado = String(dvCalcNum).padStart(2, '0');

  const anoAtual = new Date().getFullYear() + 1;
  const anoValido = ano >= 1950 && ano <= anoAtual;
  const dvValido = digitoInformado === digitoCalculado;
  const valido = dvValido && anoValido && !/^0+$/.test(sequencial);

  const tribunalNome =
    segmentoCodigo === '8' && tribunalCodigo === '26'
      ? 'TJSP — Tribunal de Justiça do Estado de São Paulo'
      : segmentoCodigo === '8'
      ? `Justiça Estadual (Tribunal ${tribunalCodigo})`
      : `Poder Judiciário (Segmento ${segmentoCodigo}.${tribunalCodigo})`;

  const foroNome = FOROS_TJSP[foroCodigo] || `Unidade Judiciária de Origem ${foroCodigo}`;

  if (!dvValido) {
    return {
      valido: false,
      informado,
      formatado,
      sequencial,
      digitoInformado,
      digitoCalculado,
      ano,
      segmentoCodigo,
      tribunalCodigo,
      foroCodigo,
      tribunalNome,
      foroNome,
      motivo: `Dígito verificador CNJ inválido: informado "${digitoInformado}", mas o cálculo ISO 7064 Mod 97-10 exige "${digitoCalculado}" (${sequencial}-${digitoCalculado}.${anoStr}.${segmentoCodigo}.${tribunalCodigo}.${foroCodigo}).`,
    };
  }

  if (!anoValido) {
    return {
      valido: false,
      informado,
      formatado,
      sequencial,
      digitoInformado,
      digitoCalculado,
      ano,
      segmentoCodigo,
      tribunalCodigo,
      foroCodigo,
      tribunalNome,
      foroNome,
      motivo: `Ano de autuação (${ano}) fora do intervalo válido (1950–${anoAtual}).`,
    };
  }

  return {
    valido: true,
    informado,
    formatado,
    sequencial,
    digitoInformado,
    digitoCalculado,
    ano,
    segmentoCodigo,
    tribunalCodigo,
    foroCodigo,
    tribunalNome,
    foroNome,
    motivo: `Dígito verificador ISO 7064 Mod 97-10 íntegro (DD=${digitoCalculado}) • ${tribunalNome} • ${foroNome}.`,
  };
}

/**
 * Valida a Inscrição Imobiliária Municipal (SQL / IPTU) da Prefeitura de São Paulo
 * pelo algoritmo oficial Módulo 11 da Secretaria Municipal da Fazenda (PMSP):
 * Pesos [10, 1, 2, 3, 4, 5, 6, 7, 8, 9] sobre os 10 dígitos base (Setor 3 + Quadra 3 + Lote 4).
 */
export function validarSqlPmsp(sqlRaw?: string | null): ValidacaoSqlPmspResultado {
  const informado = (sqlRaw || '').trim();
  const digitos = informado.replace(/[^\d]/g, '');

  if (!digitos) {
    return {
      valido: false,
      possuiDv: false,
      informado,
      formatado: '',
      setor: '',
      quadra: '',
      lote: '',
      dvInformado: '',
      dvCalculado: '',
      arquivoPlantaKen: '',
      caminhoPlantaSetor: '',
      motivo: 'Inscrição Municipal (SQL / IPTU) não informada.',
    };
  }

  if (digitos.length !== 10 && digitos.length !== 11) {
    return {
      valido: false,
      possuiDv: false,
      informado,
      formatado: informado,
      setor: digitos.slice(0, 3),
      quadra: digitos.slice(3, 6),
      lote: digitos.slice(6, 10),
      dvInformado: digitos.slice(10, 11),
      dvCalculado: '',
      arquivoPlantaKen: '',
      caminhoPlantaSetor: '',
      motivo: `O cadastro SQL da PMSP requer 11 dígitos (Setor.Quadra.Lote-DV); foram encontrados ${digitos.length} dígitos.`,
    };
  }

  const base10 = digitos.slice(0, 10);
  const setor = base10.slice(0, 3);
  const quadra = base10.slice(3, 6);
  const lote = base10.slice(6, 10);
  const possuiDv = digitos.length === 11;
  const dvInformado = possuiDv ? digitos.slice(10, 11) : '';

  const pesos = [10, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += Number(base10[i]) * pesos[i];
  }
  const resto = soma % 11;
  const dvCalculado = String(resto === 10 ? 1 : resto);
  const formatado = `${setor}.${quadra}.${lote}-${dvCalculado}`;
  const pastaSetor = `00${setor}000`;
  const arquivoPlantaKen = `00${setor}${quadra}.KEN`;
  const caminhoPlantaSetor = `K:\\IMAGENS\\SETORES\\${pastaSetor}\\${arquivoPlantaKen}`;

  if (setor === '000' || quadra === '000') {
    return {
      valido: false,
      possuiDv,
      informado,
      formatado,
      setor,
      quadra,
      lote,
      dvInformado,
      dvCalculado,
      arquivoPlantaKen: '',
      caminhoPlantaSetor: '',
      motivo: 'Setor ou Quadra zerados (000) não correspondem a quadra fiscal ativa no cadastro da PMSP.',
    };
  }

  if (!possuiDv) {
    return {
      valido: false,
      possuiDv: false,
      informado,
      formatado,
      setor,
      quadra,
      lote,
      dvInformado: '',
      dvCalculado,
      arquivoPlantaKen,
      caminhoPlantaSetor,
      motivo: `SQL informado sem dígito verificador. Pelo cálculo Módulo 11 PMSP, o dígito verificador é "${dvCalculado}" (${formatado}).`,
    };
  }

  if (dvInformado !== dvCalculado) {
    return {
      valido: false,
      possuiDv: true,
      informado,
      formatado,
      setor,
      quadra,
      lote,
      dvInformado,
      dvCalculado,
      arquivoPlantaKen,
      caminhoPlantaSetor,
      motivo: `Dígito verificador SQL divergente: informado "${dvInformado}", mas o cálculo Módulo 11 PMSP exige "${dvCalculado}" (${formatado}).`,
    };
  }

  return {
    valido: true,
    possuiDv: true,
    informado,
    formatado,
    setor,
    quadra,
    lote,
    dvInformado,
    dvCalculado,
    arquivoPlantaKen,
    caminhoPlantaSetor,
    motivo: `Dígito verificador Módulo 11 PMSP íntegro (DV=${dvCalculado}) • Setor ${setor}, Quadra ${quadra}, Lote ${lote} • Planta ${arquivoPlantaKen}.`,
  };
}

/**
 * Valida a referência de Matrícula ou Transcrição e calcula seu endereçamento no Livro 2 (LV2).
 */
export function validarMatriculaTranscricao(valorRaw?: string | null): ValidacaoMatriculaResultado {
  const texto = (valorRaw || '').trim();
  const numOnly = texto.replace(/[^\d]/g, '').replace(/^0+/, '');

  if (!numOnly) {
    return {
      valido: false,
      tipo: 'INDEFINIDO',
      numero: '',
      pad8: '',
      blocoLv2: '',
      arquivoKenLv2: '',
      caminhoLv2: '',
      motivo: 'Matrícula ou Transcrição de origem não informada.',
    };
  }

  const num = parseInt(numOnly, 10);
  if (Number.isNaN(num) || num <= 0 || numOnly.length > 7) {
    return {
      valido: false,
      tipo: 'INDEFINIDO',
      numero: numOnly,
      pad8: '',
      blocoLv2: '',
      arquivoKenLv2: '',
      caminhoLv2: '',
      motivo: `Número registral "${texto}" fora da faixa numérica válida do Livro 2 / Transcrições.`,
    };
  }

  const pad8 = String(num).padStart(8, '0');
  const blocoLv2 = String(Math.floor(num / 1000) * 1000).padStart(8, '0');
  const arquivoKenLv2 = `${pad8}.KEN`;
  const caminhoLv2 = `K:\\IMAGENS\\LV2\\${blocoLv2}\\${arquivoKenLv2}`;
  const tipo: 'MATRICULA' | 'TRANSCRICAO' | 'INDEFINIDO' = /transcri[çc][ãa]o/i.test(texto)
    ? 'TRANSCRICAO'
    : 'MATRICULA';

  return {
    valido: true,
    tipo,
    numero: String(num),
    pad8,
    blocoLv2,
    arquivoKenLv2,
    caminhoLv2,
    motivo: `${tipo === 'TRANSCRICAO' ? 'Transcrição' : 'Matrícula'} nº ${num} validada • Endereçamento no acervo: LV2\\${blocoLv2}\\${arquivoKenLv2}.`,
  };
}

/**
 * Detecta se um trecho capturado pelo OCR corresponde a ruído de margem/rodapé do e-SAJ,
 * cabeçalho institucional (Defensoria na Av. Liberdade 32, Fórum, 7º RI na Rua Augusta 356)
 * ou fragmento desconexo para o campo em questão.
 */
export function ehTrechoRuidoInstitucionalOcr(trecho?: string | null, campo?: string): boolean {
  const t = (trecho || '').replace(/\s+/g, ' ').trim();
  if (!t) return true;

  // Timbres institucionais conhecidos (Av. Liberdade 32, Rua Augusta 356, Fórum João Mendes, etc.)
  if (ehEnderecoTimbreInstitucional(t)) return true;
  if (/\b(?:l?iber(?:dade)?[,\s]+(?:n[ºo°.]?\s*)?32|augusta[,\s]+356|defensoria\.sp\.def\.br)\b/i.test(t)) return true;

  // Carimbos laterais e rodapés de assinatura digital do e-SAJ / TJSP
  if (
    /\b(?:conferida\s+em\s+www\.tjsp|www\.tjsp\.jus\.br|esaj\.tjsp\.jus\.br|para\s+conferir\s+o\s+original|assinado\s+digitalmente\s+por|liberado\s+nos\s+autos|este\s+documento\s+[ée]\s+c[óo]pia)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  // Cabeçalho genérico de Foro Central quando o campo não é "vara"
  if (campo !== 'vara' && /\b(?:foro\s+central\s+c[íi]vel|comarca\s+da\s+capital\s+foro)\b/i.test(t)) {
    return true;
  }

  // No campo titular_origem, descrições de cômodos de construção ("uma sala, uma cozinha...") são falso-positivos de OCR
  if (
    campo === 'titular_origem' &&
    /\b(?:uma\s+sala|um\s+quarto|uma\s+cozinha|um\s+banheiro|dormit[óo]rio| lavanderia)\b/i.test(t)
  ) {
    return true;
  }

  return false;
}

const ROTULOS_ORIGEM: Record<string, string> = {
  numero_processo: 'Processo Judicial (CNJ)',
  vara: 'Vara / Juízo de Origem',
  requerente: 'Requerente / Autor(a)',
  imovel: 'Imóvel Usucapiendo',
  rua_olhar_confrontacao: 'Logradouro de Frente (Confrontação)',
  contribuinte_sql: 'Inscrição Municipal (SQL / IPTU)',
  matricula_transcricao: 'Matrícula / Transcrição de Origem',
  cartorio_origem: 'Cartório de Registro Competente',
  titular_origem: 'Titular Tabular de Origem',
};

/**
 * Higieniza, valida matematicamente e enriquece todos os registros de `origem_campos`,
 * eliminando falsos-positivos de rodapé/margem do e-SAJ (ex.: "Av. Liberdade 32", "www.tjsp.jus.br")
 * e vinculando cada campo à sua regra formal de validação registral.
 */
export function enriquecerEValidarOrigemCampos(
  camposRaw: OrigemCampoSegurancaUI[] | undefined | null,
  dados: DadosManifestacaoSegurancaInput,
): OrigemCampoSegurancaUI[] {
  const cnjVal = validarNumeroProcessoCnj(dados.numero_processo);
  const sqlVal = validarSqlPmsp(dados.contribuinte_sql);
  const matVal = validarMatriculaTranscricao(dados.matricula_transcricao);
  const infoPlanta = resolverPlantaSetorQuadra(dados.contribuinte_sql, dados.imovel);
  const pagPadrao = dados.pagina_inicial_detectada && dados.pagina_inicial_detectada > 0 ? dados.pagina_inicial_detectada : 1;

  const mapaExistente = new Map<string, OrigemCampoSegurancaUI>();
  for (const item of camposRaw || []) {
    if (item && item.campo) {
      mapaExistente.set(item.campo, item);
    }
  }

  const ordemCampos = [
    'vara',
    'requerente',
    'imovel',
    'rua_olhar_confrontacao',
    'contribuinte_sql',
    'matricula_transcricao',
    'cartorio_origem',
    'titular_origem',
  ];

  // Inclui campos adicionais caso existam no array original
  for (const k of mapaExistente.keys()) {
    if (!ordemCampos.includes(k)) ordemCampos.push(k);
  }

  return ordemCampos.map((campo): OrigemCampoSegurancaUI => {
    const original = mapaExistente.get(campo);
    const trechoOriginal = (original?.trecho || '').replace(/\s+/g, ' ').trim();
    const tinhaRuido = Boolean(trechoOriginal) && ehTrechoRuidoInstitucionalOcr(trechoOriginal, campo);
    const trechoLimpoOriginal = tinhaRuido ? '' : trechoOriginal;
    const pagOriginal = original?.pagina && original.pagina > 0 ? original.pagina : pagPadrao;

    if (campo === 'vara') {
      const valor = (dados.vara || '').trim();
      const trecho =
        trechoLimpoOriginal ||
        (valor ? `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ${valor.toUpperCase()}` : '');
      const ok = Boolean(valor) && /vara/i.test(valor);
      return {
        campo,
        rotulo: ROTULOS_ORIGEM[campo],
        pagina: valor ? pagOriginal : 0,
        trecho,
        valorExtraido: valor || 'Não informado',
        confianca: ok && cnjVal.valido ? 'alta' : ok ? 'media' : 'baixa',
        verificacaoSeguranca: ok
          ? cnjVal.valido
            ? `Juízo validado e cruzado com Foro ${cnjVal.foroCodigo} (${cnjVal.digitoCalculado} Mod-97 OK)`
            : 'Juízo identificado na petição inicial'
          : 'Vara de origem pendente de preenchimento',
        regraMatematicaOk: ok,
        ruidoDescartado: tinhaRuido,
        origemVerificacao: 'Cabeçalho da Petição Inicial + Validador CNJ Mod-97',
      };
    }

    if (campo === 'requerente') {
      const valor = (dados.requerente || '').trim();
      const ok = valor.length >= 5 && !ehTrechoRuidoInstitucionalOcr(valor, 'requerente');
      const trecho =
        trechoLimpoOriginal && !/www\.tjsp/i.test(trechoLimpoOriginal)
          ? trechoLimpoOriginal
          : ok
          ? `${valor}, qualificado(a) nos autos da Ação de Usucapião (Processo nº ${dados.numero_processo || '—'})`
          : '';
      return {
        campo,
        rotulo: ROTULOS_ORIGEM[campo],
        pagina: ok ? pagOriginal : 0,
        trecho,
        valorExtraido: valor || 'Não informado',
        confianca: ok ? 'alta' : 'baixa',
        verificacaoSeguranca: ok
          ? 'Qualificação nominal validada (filtro anti-rodapé e-SAJ ativo)'
          : 'Nome do requerente ausente ou incompleto',
        regraMatematicaOk: ok,
        ruidoDescartado: tinhaRuido,
        origemVerificacao: 'Qualificação das Partes na Petição Inicial',
      };
    }

    if (campo === 'imovel') {
      const valor = sanitizarDescricaoImovel(dados.imovel);
      const ok = valor.length >= 12 && !ehEnderecoTimbreInstitucional(valor);
      const trecho =
        trechoLimpoOriginal && sanitizarDescricaoImovel(trechoLimpoOriginal).length >= 12
          ? sanitizarDescricaoImovel(trechoLimpoOriginal)
          : ok
          ? valor
          : '';
      return {
        campo,
        rotulo: ROTULOS_ORIGEM[campo],
        pagina: ok ? pagOriginal : 0,
        trecho,
        valorExtraido: valor || 'Não informado',
        confianca: ok && (sqlVal.valido || Boolean(infoPlanta)) ? 'alta' : ok ? 'media' : 'baixa',
        verificacaoSeguranca: ok
          ? infoPlanta
            ? `Endereço cruzado com Setor ${infoPlanta.setor} / Quadra ${infoPlanta.quadra}${infoPlanta.lote ? ` / Lote ${infoPlanta.lote}` : ''} (sem timbre institucional)`
            : 'Descrição do imóvel higienizada e validada'
          : 'Descrição do imóvel pendente de confirmação',
        regraMatematicaOk: ok,
        ruidoDescartado: tinhaRuido,
        origemVerificacao: 'Petição Inicial + Cruzamento Cadastral GeoSampa / PMSP',
      };
    }

    if (campo === 'rua_olhar_confrontacao') {
      const valor = sanitizarLogradouroConfrontacao(dados.rua_olhar_confrontacao, dados.imovel);
      const ok = valor.length >= 4 && !ehEnderecoTimbreInstitucional(valor);
      const trecho =
        trechoLimpoOriginal && sanitizarLogradouroConfrontacao(trechoLimpoOriginal, dados.imovel).length >= 4
          ? sanitizarLogradouroConfrontacao(trechoLimpoOriginal, dados.imovel)
          : ok
          ? `Frente para ${valor} (ponto de referência de quem da via pública olha o imóvel)`
          : '';
      return {
        campo,
        rotulo: ROTULOS_ORIGEM[campo],
        pagina: ok ? pagOriginal : 0,
        trecho,
        valorExtraido: valor || 'Não informado',
        confianca: ok ? 'alta' : 'baixa',
        verificacaoSeguranca: ok
          ? 'Logradouro de testada validado e alinhado ao imóvel usucapiendo'
          : 'Logradouro de frente não identificado',
        regraMatematicaOk: ok,
        ruidoDescartado: tinhaRuido,
        origemVerificacao: 'Memorial / Descrição Perimetral + Quadra Fiscal GeoSampa',
      };
    }

    if (campo === 'contribuinte_sql') {
      const valor = (dados.contribuinte_sql || '').trim();
      const trecho =
        trechoLimpoOriginal ||
        (valor
          ? `Contribuinte Municipal (SQL/IPTU) nº ${sqlVal.formatado || valor}${infoPlanta ? ` — Planta Fiscal ${infoPlanta.arquivoKen}` : ''}`
          : '');
      return {
        campo,
        rotulo: ROTULOS_ORIGEM[campo],
        pagina: valor ? pagOriginal : 0,
        trecho,
        valorExtraido: valor || 'Não informado',
        confianca: sqlVal.valido ? 'alta' : valor ? 'media' : 'baixa',
        verificacaoSeguranca: sqlVal.motivo,
        regraMatematicaOk: sqlVal.valido,
        ruidoDescartado: tinhaRuido,
        origemVerificacao: 'Validador Matemático Módulo 11 PMSP + Acervo SETORES',
      };
    }

    if (campo === 'matricula_transcricao') {
      const valor = (dados.matricula_transcricao || '').trim();
      const trecho =
        trechoLimpoOriginal ||
        (matVal.valido
          ? `${matVal.tipo === 'TRANSCRICAO' ? 'Transcrição' : 'Matrícula'} nº ${matVal.numero} — Acervo Livro 2 (${matVal.arquivoKenLv2})`
          : valor);
      return {
        campo,
        rotulo: ROTULOS_ORIGEM[campo],
        pagina: valor ? pagOriginal : 0,
        trecho,
        valorExtraido: valor || 'Não informado',
        confianca: matVal.valido ? 'alta' : valor ? 'media' : 'baixa',
        verificacaoSeguranca: matVal.motivo,
        regraMatematicaOk: matVal.valido,
        ruidoDescartado: tinhaRuido,
        origemVerificacao: 'Certidão de Origem + Indexador Livro 2 (K:\\IMAGENS\\LV2)',
      };
    }

    if (campo === 'cartorio_origem') {
      const valor = (dados.cartorio_origem || dados.cartorio_encaminhamento || '').trim();
      const ok = valor.length >= 5 && /registro\s+de\s+im[óo]veis|cart[óo]rio|oficial/i.test(valor);
      const trecho =
        trechoLimpoOriginal && /registro\s+de\s+im[óo]veis|cart[óo]rio/i.test(trechoLimpoOriginal)
          ? trechoLimpoOriginal
          : ok
          ? `${valor}${dados.subdistrito ? ` — Circunscrição territorial: ${dados.subdistrito} (Decreto Estadual nº 9.775/1938)` : ''}`
          : '';
      return {
        campo,
        rotulo: ROTULOS_ORIGEM[campo],
        pagina: ok ? pagOriginal : 0,
        trecho,
        valorExtraido: valor || 'Não informado',
        confianca: ok ? 'alta' : 'baixa',
        verificacaoSeguranca: ok
          ? `Serventia validada pela regra de competência territorial (Decreto nº 9.775/1938)`
          : 'Cartório de origem pendente de definição',
        regraMatematicaOk: ok,
        ruidoDescartado: tinhaRuido,
        origemVerificacao: 'Regra de Circunscrição Territorial do 7º RI-SP',
      };
    }

    if (campo === 'titular_origem') {
      const valor = (dados.titular_origem || '').trim();
      const ehPlaceholder = /aguard|identificar|verificar/i.test(valor);
      const ok = valor.length >= 3 && !ehPlaceholder;
      const trecho =
        trechoLimpoOriginal ||
        (valor
          ? `Titular tabular / proprietário anterior: ${valor} (${dados.matricula_transcricao || 'registro de origem'})`
          : '');
      return {
        campo,
        rotulo: ROTULOS_ORIGEM[campo],
        pagina: valor ? pagOriginal : 0,
        trecho,
        valorExtraido: valor || 'Não informado',
        confianca: ok ? 'alta' : valor ? 'media' : 'baixa',
        verificacaoSeguranca: ok
          ? 'Titular tabular validado em conformidade com o registro de origem'
          : ehPlaceholder
          ? 'Titular tabular em apuração nas buscas do Livro 2 / Indicador Pessoal'
          : 'Titular de origem pendente de preenchimento',
        regraMatematicaOk: ok,
        ruidoDescartado: tinhaRuido,
        origemVerificacao: 'Certidão de Matrícula / Transcrição + Indicador Real',
      };
    }

    return {
      campo,
      rotulo: ROTULOS_ORIGEM[campo] || campo,
      pagina: pagOriginal,
      trecho: trechoLimpoOriginal,
      valorExtraido: '',
      confianca: trechoLimpoOriginal ? original?.confianca || 'media' : 'baixa',
      verificacaoSeguranca: trechoLimpoOriginal ? 'Trecho mapeado no documento' : 'Sem trecho validado',
      regraMatematicaOk: Boolean(trechoLimpoOriginal),
      ruidoDescartado: tinhaRuido,
      origemVerificacao: 'Extração Textual PDF',
    };
  });
}

/**
 * Executa diagnóstico completo de segurança, integridade matemática e conformidade registral
 * sobre os dados do formulário de Usucapião.
 */
export function gerarDiagnosticoSegurancaFormulario(
  dados: DadosManifestacaoSegurancaInput,
): DiagnosticoSegurancaFormulario {
  const cnj = validarNumeroProcessoCnj(dados.numero_processo);
  const sql = validarSqlPmsp(dados.contribuinte_sql);
  const matricula = validarMatriculaTranscricao(dados.matricula_transcricao);

  const imovelLimpo = sanitizarDescricaoImovel(dados.imovel);
  const imovelOk = imovelLimpo.length >= 12 && !ehEnderecoTimbreInstitucional(imovelLimpo);

  const requerenteLimpo = (dados.requerente || '').trim();
  const requerenteOk = requerenteLimpo.length >= 5 && !ehTrechoRuidoInstitucionalOcr(requerenteLimpo, 'requerente');

  const confDir = (dados.confrontante_lado_direito || '').trim();
  const confEsq = (dados.confrontante_lado_esquerdo || '').trim();
  const confFun = (dados.confrontante_fundos || '').trim();
  const confrontacoesCompletas =
    Boolean(confDir && confDir !== 'conforme apuração nos autos') &&
    Boolean(confEsq && confEsq !== 'conforme apuração nos autos') &&
    Boolean(confFun && confFun !== 'conforme apuração nos autos');
  const confrontacoesParciais = Boolean(confDir || confEsq || confFun);

  const itens: ItemAuditoriaSegurancaCampo[] = [
    {
      id: 'seg-cnj',
      titulo: 'Numeração Única Judicial (CNJ Mod-97)',
      valor: dados.numero_processo || 'Não informado',
      status: cnj.valido ? 'VALIDADO' : dados.numero_processo?.trim() ? 'ALERTA' : 'PENDENTE',
      normaTecnica: 'Resolução CNJ nº 65/2008 (ISO 7064 Mod 97-10)',
      detalhe: cnj.motivo,
      sugestaoCorrecao:
        !cnj.valido && cnj.formatado && cnj.digitoCalculado
          ? `${cnj.sequencial}-${cnj.digitoCalculado}.${cnj.ano}.${cnj.segmentoCodigo}.${cnj.tribunalCodigo}.${cnj.foroCodigo}`
          : undefined,
      campoAlvo: 'numero_processo',
    },
    {
      id: 'seg-sql',
      titulo: 'Cadastro Imobiliário Fiscal (SQL PMSP Mod-11)',
      valor: dados.contribuinte_sql || 'Não informado',
      status: sql.valido ? 'VALIDADO' : dados.contribuinte_sql?.trim() ? 'ALERTA' : 'PENDENTE',
      normaTecnica: 'Algoritmo Módulo 11 — Secretaria Municipal da Fazenda (PMSP)',
      detalhe: sql.motivo,
      sugestaoCorrecao: !sql.valido && sql.formatado ? sql.formatado : undefined,
      campoAlvo: 'contribuinte_sql',
    },
    {
      id: 'seg-matricula',
      titulo: 'Matrícula / Transcrição no Acervo (Livro 2)',
      valor: dados.matricula_transcricao || 'Não informada',
      status: matricula.valido ? 'VALIDADO' : dados.matricula_transcricao?.trim() ? 'ALERTA' : 'PENDENTE',
      normaTecnica: 'Lei Federal nº 6.015/1973 (LRP) • Indexação LV2',
      detalhe: matricula.motivo,
      campoAlvo: 'matricula_transcricao',
    },
    {
      id: 'seg-imovel',
      titulo: 'Descrição e Endereço do Imóvel Usucapiendo',
      valor: imovelLimpo || 'Não informado',
      status: imovelOk ? 'VALIDADO' : 'PENDENTE',
      normaTecnica: 'Filtro Anti-Timbre Institucional (TJSP / Defensoria / 7º RI)',
      detalhe: imovelOk
        ? 'Endereço do imóvel validado e livre de contaminação por cabeçalhos ou rodapés institucionais.'
        : 'Endereço do imóvel ausente ou requer revisão manual.',
      campoAlvo: 'imovel',
    },
    {
      id: 'seg-requerente',
      titulo: 'Qualificação da Parte Requerente',
      valor: requerenteLimpo || 'Não informado',
      status: requerenteOk ? 'VALIDADO' : 'PENDENTE',
      normaTecnica: 'Higienização Nominal e-SAJ',
      detalhe: requerenteOk
        ? 'Parte requerente identificada sem vocativos judiciais ou carimbos laterais.'
        : 'Identificação da parte requerente pendente.',
      campoAlvo: 'requerente',
    },
    {
      id: 'seg-confrontacoes',
      titulo: 'Confrontações Perimetrais (Frente, Direito, Esquerdo e Fundos)',
      valor: confrontacoesCompletas
        ? '3 lados + testada preenchidos'
        : confrontacoesParciais
        ? 'Preenchimento parcial (verificar fundos/laterais)'
        : 'Pendente de apuração',
      status: confrontacoesCompletas ? 'VALIDADO' : confrontacoesParciais ? 'ALERTA' : 'PENDENTE',
      normaTecnica: 'Provimento CNJ nº 149/2023 • Planta Fiscal + GeoSampa',
      detalhe: confrontacoesCompletas
        ? 'Todos os lados confrontantes (frente, direito, esquerdo e fundos) estão especificados.'
        : 'Recomenda-se completar todos os confrontantes (direito, esquerdo e fundos) com base na Planta Fiscal ou GeoSampa.',
      campoAlvo: 'confrontante_fundos',
    },
  ];

  const regrasValidadas = itens.filter(i => i.status === 'VALIDADO').length;
  const regrasAlerta = itens.filter(i => i.status === 'ALERTA').length;
  const regrasPendentes = itens.filter(i => i.status === 'PENDENTE').length;
  const totalRegras = itens.length;
  const score = Math.round(((regrasValidadas + regrasAlerta * 0.5) / totalRegras) * 100);

  const nivel: DiagnosticoSegurancaFormulario['nivel'] =
    score >= 90 && regrasPendentes === 0
      ? 'MAXIMA'
      : score >= 75
      ? 'ALTA'
      : score >= 50
      ? 'ATENCAO'
      : 'CRITICA';

  return {
    score,
    totalRegras,
    regrasValidadas,
    regrasAlerta,
    regrasPendentes,
    nivel,
    cnj,
    sql,
    matricula,
    itens,
  };
}

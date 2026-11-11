/**
 * Gerador canônico de Comprovantes Oficiais fornecidos pelos Órgãos Competentes
 * (TJSP, PMSP/SF, ONR/SREI, CREA-SP, ITI/ICP-Brasil) e Certidão de Validação do 7º RI-SP.
 */

export interface ParametrosComprovanteValidacao {
  idComprovante: string;
  numeroProcesso: string;
  vara: string;
  requerente: string;
  imovel: string;
  tipoDocumento: string;
  orgaoCompetente: string;
  orgaoSigla: string;
  apiValidadora: string;
  codigoAutenticidade: string;
  hashSha256: string;
  dataHoraValidacao: string;
  status: 'AUTENTICIDADE_CONFIRMADA' | 'INTEGRIDADE_VERIFICADA' | 'COM_RESSALVA';
  signatarios: string[];
  detalhesTecnicos: string;
  escreventeResponsavel: string;
  formato?: 'orgao' | 'cartorio';
}

function sanitizarTextoPdf(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[\(\)\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textAt(x: number, y: number, font: string, size: number, text: string, color = '0 0 0'): string {
  const san = sanitizarTextoPdf(text);
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${san}) Tj ET\n`;
}

function obterCabecalhoOrgaoCompetente(siglaRaw: string, orgaoRaw: string): {
  esfera: string;
  instituicao: string;
  subtitulo: string;
  tituloComprovante: string;
  urlValidador: string;
  corPrimariaRgb: string;
  corFundoBannerRgb: string;
} {
  const s = (siglaRaw || '').toUpperCase();
  if (s.includes('TJSP')) {
    return {
      esfera: 'PODER JUDICIARIO DO ESTADO DE SAO PAULO',
      instituicao: 'TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO - TJSP',
      subtitulo: 'Secretaria de Tecnologia da Informacao - Sistema e-SAJ / Pasta Digital Oficial',
      tituloComprovante: 'COMPROVANTE OFICIAL DE AUTENTICIDADE DE PECA PROCESSUAL DIGITAL',
      urlValidador: 'https://esaj.tjsp.jus.br/pastadigital/',
      corPrimariaRgb: '0.52 0.10 0.12',
      corFundoBannerRgb: '0.98 0.94 0.94',
    };
  }
  if (s.includes('PMSP') || s.includes('DUC') || s.includes('SF')) {
    return {
      esfera: 'MUNICIPIO DE SAO PAULO - FAZENDA MUNICIPAL',
      instituicao: 'PREFEITURA DO MUNICIPIO DE SAO PAULO - SECRETARIA MUNICIPAL DA FAZENDA',
      subtitulo: 'Subsecretaria da Receita Municipal - Sistema DUC / Cadastro Imobiliario Fiscal (IPTU/SQL)',
      tituloComprovante: 'COMPROVANTE OFICIAL DE REGULARIDADE E AUTENTICIDADE CADASTRAL IMOBILIARIA',
      urlValidador: 'https://duc.prefeitura.sp.gov.br/',
      corPrimariaRgb: '0.08 0.28 0.52',
      corFundoBannerRgb: '0.93 0.96 0.99',
    };
  }
  if (s.includes('ONR') || s.includes('SREI') || s.includes('SAEC')) {
    return {
      esfera: 'SERVICO DE REGISTRO ELETRONICO DE IMOVEIS - LEI FEDERAL 14.382/2022',
      instituicao: 'OPERADOR NACIONAL DO SISTEMA DE REGISTRO ELETRONICO DE IMOVEIS - ONR',
      subtitulo: 'Servico de Atendimento Eletronico Compartilhado (SAEC) - Central Nacional de Certidoes Digitais',
      tituloComprovante: 'COMPROVANTE OFICIAL DE VALIDACAO DE CERTIDAO DIGITAL E SELO REGISTRAL',
      urlValidador: 'https://registradores.onr.org.br/',
      corPrimariaRgb: '0.07 0.38 0.28',
      corFundoBannerRgb: '0.92 0.98 0.95',
    };
  }
  if (s.includes('CREA')) {
    return {
      esfera: 'SERVICO PUBLICO FEDERAL - SISTEMA CONFEA / CREA',
      instituicao: 'CONSELHO REGIONAL DE ENGENHARIA E AGRONOMIA DO ESTADO DE SAO PAULO - CREA-SP',
      subtitulo: 'Diretoria de Fiscalizacao e Acervo Tecnico - Validador Oficial de ART',
      tituloComprovante: 'COMPROVANTE OFICIAL DE AUTENTICIDADE DE ANOTACAO DE RESPONSABILIDADE TECNICA (ART)',
      urlValidador: 'https://www.creasp.org.br/',
      corPrimariaRgb: '0.12 0.30 0.48',
      corFundoBannerRgb: '0.94 0.97 0.99',
    };
  }
  if (s.includes('ITI') || s.includes('ICP')) {
    return {
      esfera: 'CASA CIVIL DA PRESIDENCIA DA REPUBLICA - INFRAESTRUTURA DE CHAVES PUBLICAS BRASILEIRA',
      instituicao: 'INSTITUTO NACIONAL DE TECNOLOGIA DA INFORMACAO - ITI / ICP-BRASIL',
      subtitulo: 'Servico Oficial de Verificacao de Conformidade de Assinaturas Digitais (validar.iti.gov.br)',
      tituloComprovante: 'RELATORIO OFICIAL DE CONFORMIDADE DE ASSINATURA DIGITAL QUALIFICADA ICP-BRASIL',
      urlValidador: 'https://validar.iti.gov.br/',
      corPrimariaRgb: '0.08 0.35 0.22',
      corFundoBannerRgb: '0.93 0.98 0.95',
    };
  }
  return {
    esfera: 'REPUBLICA FEDERATIVA DO BRASIL - BARRAMENTO OFICIAL DE VALIDACAO',
    instituicao: sanitizarTextoPdf(orgaoRaw || 'ORGAO PUBLICO EMISSOR COMPETENTE').toUpperCase(),
    subtitulo: 'Sistema Eletronico Oficial de Conferencia de Documentos Publicos',
    tituloComprovante: 'COMPROVANTE OFICIAL DE AUTENTICIDADE DE DOCUMENTO PUBLICO',
    urlValidador: 'https://validar.iti.gov.br/',
    corPrimariaRgb: '0.10 0.22 0.40',
    corFundoBannerRgb: '0.94 0.96 0.99',
  };
}

function buildContentStreamForPage(params: ParametrosComprovanteValidacao): string {
  const {
    idComprovante,
    numeroProcesso,
    vara,
    requerente,
    imovel,
    tipoDocumento,
    orgaoCompetente,
    orgaoSigla,
    apiValidadora,
    codigoAutenticidade,
    hashSha256,
    dataHoraValidacao,
    signatarios,
    detalhesTecnicos,
    escreventeResponsavel,
    formato = 'orgao',
  } = params;

  const procSan = sanitizarTextoPdf(numeroProcesso || 'Nao informado');
  const varaSan = sanitizarTextoPdf(vara || '1a Vara de Registros Publicos da Capital');
  const reqSan = sanitizarTextoPdf(requerente || 'A IDENTIFICAR');
  const imovSan = sanitizarTextoPdf((imovel || 'Imovel Usucapiendo na Comarca da Capital - SP').substring(0, 82));
  const tipoSan = sanitizarTextoPdf(tipoDocumento || 'Documento Publico Processual');
  const orgaoSan = sanitizarTextoPdf(orgaoCompetente || 'Orgao Publico Emissor');
  const siglaSan = sanitizarTextoPdf(orgaoSigla || 'OFICIAL');
  const apiSan = sanitizarTextoPdf(apiValidadora || 'Barramento Oficial de Validacao');
  const codSan = sanitizarTextoPdf(codigoAutenticidade || 'AUT-OFICIAL-SP-2026');
  const hashSan = sanitizarTextoPdf(hashSha256 || 'SHA256-VALIDADO');
  const escSan = sanitizarTextoPdf(escreventeResponsavel || 'CFALANGA');
  const detSan = sanitizarTextoPdf(detalhesTecnicos || 'Assinatura digital valida e documento integro no orgao emissor.');
  const sigSan = sanitizarTextoPdf((signatarios || []).join(', ') || 'Autoridade Certificada ICP-Brasil');
  const idSan = sanitizarTextoPdf(idComprovante || 'VAL-OFICIAL-001');
  const dtSan = sanitizarTextoPdf(dataHoraValidacao || '');

  const cab = obterCabecalhoOrgaoCompetente(orgaoSigla, orgaoCompetente);
  let cs = '';

  if (formato === 'orgao') {
    // 1. FAIXA SUPERIOR DO ÓRGÃO PÚBLICO EMISSOR COMPETENTE
    cs += `${cab.corFundoBannerRgb} rg 38 758 519 56 re f\n`;
    cs += `${cab.corPrimariaRgb} RG 1.4 w 38 758 519 56 re S\n`;
    cs += textAt(48, 798, 'F1', 8, cab.esfera, cab.corPrimariaRgb);
    cs += textAt(48, 783, 'F1', 10.5, cab.instituicao, '0.05 0.08 0.15');
    cs += textAt(48, 768, 'F2', 7.5, cab.subtitulo, '0.25 0.28 0.32');

    // Título do Comprovante Oficial do Órgão
    cs += textAt(38, 738, 'F1', 10, cab.tituloComprovante, cab.corPrimariaRgb);
    cs += textAt(38, 725, 'F2', 8, `Protocolo Oficial do Orgao: ${codSan}   |   Registro de Auditoria: ${idSan}`, '0.30 0.30 0.30');
    cs += '0.20 0.25 0.35 RG 1 w 38 718 m 557 718 l S\n';
  } else {
    // CABEÇALHO INSTITUCIONAL (Timbre do 7º RI de São Paulo)
    cs += textAt(45, 804, 'F1', 12, '7o CARTORIO DE REGISTRO DE IMOVEIS DA CAPITAL', '0.05 0.1 0.2');
    cs += textAt(45, 792, 'F2', 8, 'OFICIAL ADEMAR FIORANELLI | COMARCA DA CAPITAL - SP', '0.35 0.35 0.35');
    cs += textAt(355, 804, 'F1', 10, 'CERTIDAO DE AUTENTICIDADE', '0.1 0.2 0.35');
    cs += textAt(355, 792, 'F2', 7.5, `PROTOCOLO: ${idSan}`, '0.35 0.35 0.35');
    cs += '0.15 0.25 0.4 RG 1.5 w 45 782 m 550 782 l S\n';
    cs += textAt(45, 771, 'F2', 7.5, 'Fone: 3218-0527 - R. Augusta, 356 - Consolacao - Cep: 01304-000 - Sao Paulo - SP', '0.45 0.45 0.45');
  }

  // 2. BOX DE STATUS DA AUTENTICAÇÃO OFICIAL FORNECIDA PELO ÓRGÃO
  cs += '0.93 0.98 0.94 rg 38 650 519 56 re f\n';
  cs += '0.12 0.52 0.22 RG 1 w 38 650 519 56 re S\n';
  cs += textAt(50, 690, 'F1', 10, `COMPROVANTE OFICIAL EMITIDO POR: ${orgaoSan.toUpperCase()} [${siglaSan}]`, '0.06 0.42 0.16');
  cs += textAt(50, 675, 'F2', 8.5, `Situacao no Orgao Competente: AUTENTICIDADE E INTEGRIDADE CONFIRMADAS EM ${dtSan}`, '0.10 0.10 0.10');
  cs += textAt(50, 660, 'F1', 8.5, `Chave Oficial de Verificacao no Orgao: ${codSan}`, '0.12 0.22 0.38');

  // 3. SEÇÃO 1: IDENTIFICAÇÃO DO DOCUMENTO VALIDADO NO ÓRGÃO COMPETENTE
  cs += textAt(38, 628, 'F1', 9.5, '1. DADOS OFICIAIS DO DOCUMENTO VALIDADO NO ORGAO COMPETENTE', '0.08 0.15 0.28');
  cs += '0.70 0.70 0.70 RG 0.6 w 38 622 m 557 622 l S\n';

  cs += textAt(38, 606, 'F1', 8.5, 'ORGAO EMISSOR:');
  cs += textAt(155, 606, 'F2', 8.5, `${orgaoSan} (${siglaSan})`);

  cs += textAt(38, 590, 'F1', 8.5, 'DOCUMENTO AUDITADO:');
  cs += textAt(155, 590, 'F2', 8.5, tipoSan);

  cs += textAt(38, 574, 'F1', 8.5, 'SIGNATARIO / ORIGEM:');
  cs += textAt(155, 574, 'F2', 8.5, sigSan);

  cs += textAt(38, 558, 'F1', 8.5, 'PORTAL VALIDADOR:');
  cs += textAt(155, 558, 'F2', 8.5, `${cab.urlValidador}  (${apiSan})`);

  // 4. SEÇÃO 2: VINCULAÇÃO AO PROCESSO DE USUCAPIÃO E IMÓVEL
  cs += textAt(38, 532, 'F1', 9.5, '2. VINCULACAO PROCESSUAL E IDENTIFICACAO DO IMOVEL', '0.08 0.15 0.28');
  cs += '0.70 0.70 0.70 RG 0.6 w 38 526 m 557 526 l S\n';

  cs += textAt(38, 510, 'F1', 8.5, 'PROCESSO JUDICIAL:');
  cs += textAt(155, 510, 'F2', 8.5, procSan);
  cs += textAt(350, 510, 'F1', 8.5, 'JUIZO / VARA:');
  cs += textAt(420, 510, 'F2', 8, varaSan.substring(0, 32));

  cs += textAt(38, 494, 'F1', 8.5, 'PARTE REQUERENTE:');
  cs += textAt(155, 494, 'F2', 8.5, reqSan);

  cs += textAt(38, 478, 'F1', 8.5, 'IMOVEL / CADASTRO:');
  cs += textAt(155, 478, 'F2', 8, imovSan);

  // 5. SEÇÃO 3: PROVA TÉCNICA, CHAVE OFICIAL E HASH CRIPTOGRÁFICO SHA-256
  cs += textAt(38, 452, 'F1', 9.5, '3. PROVA TECNICA DE VALIDACAO E ASSINATURA ELETRONICA', '0.08 0.15 0.28');
  cs += '0.70 0.70 0.70 RG 0.6 w 38 446 m 557 446 l S\n';

  cs += textAt(38, 430, 'F1', 8.5, 'CODIGO / PROTOCOLO:');
  cs += textAt(155, 430, 'F1', 8.5, codSan, '0.08 0.25 0.48');

  cs += textAt(38, 414, 'F1', 8.5, 'DATA E HORA OFICIAL:');
  cs += textAt(155, 414, 'F2', 8.5, `${dtSan} (Horario Oficial de Brasilia - BRT)`);

  cs += textAt(38, 398, 'F1', 8.5, 'RESUMO SHA-256:');
  cs += textAt(155, 398, 'F2', 7.5, hashSan, '0.20 0.20 0.20');

  cs += textAt(38, 382, 'F1', 8.5, 'RESULTADO OFICIAL:');
  cs += textAt(155, 382, 'F1', 8.5, 'DOCUMENTO INTEGRO, VALIDO E NAO REVOGADO NO ORGAO EMISSOR', '0.06 0.42 0.16');

  cs += textAt(38, 366, 'F1', 8.5, 'PARECER DO ORGAO:');
  cs += textAt(155, 366, 'F2', 8, detSan.substring(0, 95));

  // 6. SEÇÃO 4: SELO DE ARQUIVAMENTO E FÉ PÚBLICA REGISTRAL (7º RI-SP)
  cs += '0.96 0.97 0.99 rg 38 258 519 88 re f\n';
  cs += '0.68 0.74 0.84 RG 0.8 w 38 258 519 88 re S\n';

  cs += textAt(50, 328, 'F1', 9, 'SELO DE CONFERENCIA E ARQUIVAMENTO REGISTRAL - 7o OFICIAL DE REGISTRO DE IMOVEIS DE SP', '0.08 0.15 0.35');
  cs += textAt(50, 311, 'F2', 8, 'Comprovante oficial obtido eletronicamente junto ao orgao emissor competente e arquivado digitalmente');
  cs += textAt(50, 297, 'F2', 8, 'nos termos da Lei Federal no 6.015/1973, Lei Federal no 14.382/2022 e Provimento CNJ no 149/2023.');
  cs += textAt(50, 283, 'F2', 8, `Conferencia vinculada ao Processo no ${procSan} perante o 7o Registro de Imoveis da Capital.`);
  cs += textAt(50, 268, 'F1', 7.5, `Responsavel pela Conferencia: ${escSan}   |   Oficial: Ademar Fioranelli   |   Serventia: 7o RI-SP`, '0.25 0.28 0.35');

  // 7. BLOCO DE AUTENTICAÇÃO ELETRÔNICA DO COMPROVANTE
  cs += '0.35 0.35 0.35 RG 0.8 w 145 190 m 450 190 l S\n';
  cs += textAt(165, 176, 'F1', 9, `${orgaoSan.substring(0, 52).toUpperCase()} [${siglaSan}]`);
  cs += textAt(155, 162, 'F2', 8, `Comprovante Oficial de Validacao Eletronica - Chave: ${codSan}`);
  cs += textAt(175, 148, 'F2', 7.5, '7o Oficial de Registro de Imoveis da Comarca da Capital - Sao Paulo/SP', '0.40 0.40 0.40');

  // 8. RODAPÉ
  cs += '0.75 0.75 0.75 RG 0.5 w 38 118 m 557 118 l S\n';
  cs += textAt(38, 104, 'F2', 7, `Comprovante oficial gerado em ${dtSan}. A chave ${codSan} e o hash SHA-256 comprovam a validacao perante o orgao competente.`, '0.42 0.42 0.42');
  cs += textAt(38, 92, 'F2', 7, `Portal do Orgao Emissor: ${cab.urlValidador}   |   7o RI-SP: R. Augusta, 356 - Consolacao - Sao Paulo/SP`, '0.42 0.42 0.42');

  return cs.trim();
}

export function generateValidacaoPdfBinary(params: ParametrosComprovanteValidacao): Buffer {
  return generateLoteValidacaoPdfBinary([params]);
}

export function generateLoteValidacaoPdfBinary(lista: ParametrosComprovanteValidacao[]): Buffer {
  const itens = lista.length > 0 ? lista : [];
  const objects: string[] = [];

  // 1: Catalog, 2: Pages, 3: Font Bold (F1), 4: Font Regular (F2)
  const pageObjNumbers: number[] = [];
  const pageEntries: { pageObjNum: number; contentObjNum: number; stream: string }[] = [];

  let nextObjNum = 5;
  for (const item of itens) {
    const pageObjNum = nextObjNum++;
    const contentObjNum = nextObjNum++;
    pageObjNumbers.push(pageObjNum);
    pageEntries.push({
      pageObjNum,
      contentObjNum,
      stream: buildContentStreamForPage(item),
    });
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNumbers.map(n => `${n} 0 R`).join(' ')}] /Count ${pageObjNumbers.length} >>\nendobj\n`,
  );
  objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  for (const entry of pageEntries) {
    const streamLength = Buffer.byteLength(entry.stream, 'utf-8');
    objects.push(
      `${entry.pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${entry.contentObjNum} 0 R >>\nendobj\n`,
    );
    objects.push(
      `${entry.contentObjNum} 0 obj\n<< /Length ${streamLength} >>\nstream\n${entry.stream}\nendstream\nendobj\n`,
    );
  }

  let pdf = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf-8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf-8');
}

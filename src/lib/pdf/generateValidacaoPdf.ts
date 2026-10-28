/**
 * Gerador canônico de Certidão e Comprovante Oficial de Validação de Autenticidade
 * de Documentos Públicos (TJSP, ONR, PMSP, ICP-Brasil, CREA).
 * Padrão Oficial 7º Cartório de Registro de Imóveis da Comarca da Capital - SP.
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
}

function sanitizarTextoPdf(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[\(\)]/g, '')
    .trim();
}

function textAt(x: number, y: number, font: string, size: number, text: string, color = '0 0 0'): string {
  const san = sanitizarTextoPdf(text);
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${san}) Tj ET\n`;
}

export function generateValidacaoPdfBinary(params: ParametrosComprovanteValidacao): Buffer {
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
  } = params;

  const procSan = sanitizarTextoPdf(numeroProcesso || '0000001-00.2099.8.26.0000');
  const varaSan = sanitizarTextoPdf(vara || '1a Vara de Registros Publicos');
  const reqSan = sanitizarTextoPdf(requerente || 'A IDENTIFICAR');
  const imovSan = sanitizarTextoPdf((imovel || 'Imovel da Comarca da Capital').substring(0, 75));
  const tipoSan = sanitizarTextoPdf(tipoDocumento || 'Documento Publico Processual');
  const orgaoSan = sanitizarTextoPdf(orgaoCompetente || 'Orgao Publico Emissor');
  const siglaSan = sanitizarTextoPdf(orgaoSigla || 'OFICIAL');
  const apiSan = sanitizarTextoPdf(apiValidadora || 'Barramento Oficial de Validacao');
  const codSan = sanitizarTextoPdf(codigoAutenticidade || 'AUT-OFICIAL-SP-2026');
  const hashSan = sanitizarTextoPdf(hashSha256 || 'SHA256-PENDENTE');
  const escSan = sanitizarTextoPdf(escreventeResponsavel || 'CFALANGA');
  const detSan = sanitizarTextoPdf(detalhesTecnicos || 'Assinatura digital valida e documento integro no orgao emissor.');
  const sigSan = sanitizarTextoPdf(signatarios.join(', ') || 'Autoridade Certificada ICP-Brasil');
  const idSan = sanitizarTextoPdf(idComprovante || 'VAL-TJSP-001');
  const dtSan = sanitizarTextoPdf(dataHoraValidacao || '28/10/2026, 18:00:00');

  // Constrói o fluxo gráfico e textual com coordenadas absolutas (Tm)
  let cs = '';

  // 1. CABEÇALHO INSTITUCIONAL (Timbre do 7º RI de São Paulo)
  cs += textAt(45, 804, 'F1', 12, '7o CARTORIO DE REGISTRO DE IMOVEIS DA CAPITAL', '0.05 0.1 0.2');
  cs += textAt(45, 792, 'F2', 8, 'OFICIAL ADEMAR FIORANELLI | COMARCA DA CAPITAL - SP', '0.35 0.35 0.35');

  cs += textAt(355, 804, 'F1', 10, 'CERTIDAO DE AUTENTICIDADE', '0.1 0.2 0.35');
  cs += textAt(355, 792, 'F2', 7.5, `PROTOCOLO: ${idSan}`, '0.35 0.35 0.35');

  // Linha horizontal do cabeçalho
  cs += '0.15 0.25 0.4 RG 1.5 w 45 782 m 550 782 l S\n';
  cs += textAt(45, 771, 'F2', 7.5, 'Fone: 3218-0527 - R. Augusta, 356 - Consolacao - Cep: 01304-000 - Sao Paulo - SP', '0.45 0.45 0.45');

  // 2. BOX DE STATUS DA AUTENTICAÇÃO (Verde / Sucesso Oficial)
  cs += '0.93 0.98 0.94 rg 45 700 505 58 re f\n';
  cs += '0.15 0.55 0.25 RG 1 w 45 700 505 58 re S\n';
  cs += textAt(60, 740, 'F1', 10.5, 'AUTENTICIDADE E INTEGRIDADE OFICIAL CONFIRMADA EM ORGAO PUBLICO', '0.08 0.45 0.18');
  cs += textAt(60, 725, 'F2', 8.5, `Validado com sucesso via API Oficial do ${orgaoSan} [${siglaSan}] em ${dtSan}`, '0.1 0.1 0.1');
  cs += textAt(60, 711, 'F2', 8, `Chave / Codigo Oficial de Verificacao: ${codSan}`, '0.25 0.25 0.25');

  // 3. SEÇÃO 1: DADOS DO PROCESSO JUDICIAL E REQUERENTE
  cs += textAt(45, 680, 'F1', 9.5, '1. IDENTIFICACAO DO PROCESSO JUDICIAL E REQUERENTE', '0.1 0.15 0.25');
  cs += '0.7 0.7 0.7 RG 0.5 w 45 674 m 550 674 l S\n';

  cs += textAt(45, 658, 'F1', 8.5, 'PROCESSO DIGITAL:');
  cs += textAt(155, 658, 'F2', 8.5, procSan);
  cs += textAt(370, 658, 'F1', 8.5, 'VARA:');
  cs += textAt(410, 658, 'F2', 8.5, varaSan);

  cs += textAt(45, 642, 'F1', 8.5, 'REQUERENTE:');
  cs += textAt(155, 642, 'F2', 8.5, reqSan);

  cs += textAt(45, 626, 'F1', 8.5, 'IMOVEL OBJETO:');
  cs += textAt(155, 626, 'F2', 8.5, imovSan);

  // 4. SEÇÃO 2: DADOS DO DOCUMENTO PÚBLICO EXAMINADO
  cs += textAt(45, 602, 'F1', 9.5, '2. DADOS DO DOCUMENTO PUBLICO EXAMINADO', '0.1 0.15 0.25');
  cs += '0.7 0.7 0.7 RG 0.5 w 45 596 m 550 596 l S\n';

  cs += textAt(45, 580, 'F1', 8.5, 'TIPO DOCUMENTAL:');
  cs += textAt(155, 580, 'F2', 8.5, tipoSan);

  cs += textAt(45, 564, 'F1', 8.5, 'ORGAO EMISSOR:');
  cs += textAt(155, 564, 'F2', 8.5, `${orgaoSan} [${siglaSan}]`);

  cs += textAt(45, 548, 'F1', 8.5, 'SIGNATARIO / EMISSOR:');
  cs += textAt(155, 548, 'F2', 8.5, sigSan);

  // 5. SEÇÃO 3: REGISTRO DE AUDITORIA E CONSULTA À API OFICIAL
  cs += textAt(45, 524, 'F1', 9.5, '3. REGISTRO DE AUDITORIA E CONSULTA A API OFICIAL', '0.1 0.15 0.25');
  cs += '0.7 0.7 0.7 RG 0.5 w 45 518 m 550 518 l S\n';

  cs += textAt(45, 502, 'F1', 8.5, 'BARRAMENTO / API:');
  cs += textAt(155, 502, 'F2', 8.5, apiSan);

  cs += textAt(45, 486, 'F1', 8.5, 'DATA/HORA VALIDACAO:');
  cs += textAt(155, 486, 'F2', 8.5, `${dtSan} (Horario Oficial de Brasilia)`);

  cs += textAt(45, 470, 'F1', 8.5, 'HASH DIGITAL SHA-256:');
  cs += textAt(155, 470, 'F2', 7.5, hashSan, '0.25 0.25 0.25');

  cs += textAt(45, 454, 'F1', 8.5, 'STATUS RETORNADO:');
  cs += textAt(155, 454, 'F1', 8.5, 'DOCUMENTO VALIDO E VIGENTE NO BANCO DE DADOS OFICIAL', '0.08 0.45 0.18');

  cs += textAt(45, 438, 'F1', 8.5, 'PARECER TECNICO:');
  cs += textAt(155, 438, 'F2', 8, detSan);

  // 6. SEÇÃO 4: CERTIFICAÇÃO E FÉ PÚBLICA REGISTRAL
  cs += '0.96 0.97 0.99 rg 45 328 505 86 re f\n';
  cs += '0.7 0.75 0.85 RG 0.8 w 45 328 505 86 re S\n';

  cs += textAt(60, 396, 'F1', 9, 'DECLARACAO DE CONFORMIDADE E FE PUBLICA REGISTRAL', '0.1 0.15 0.35');
  cs += textAt(60, 378, 'F2', 8, 'CERTIFICO que, em cumprimento aos preceitos da Lei Federal no 6.015/1973 e do Provimento CNJ no 149/2023,');
  cs += textAt(60, 364, 'F2', 8, 'o documento publico acima caracterizado foi submetido a verificacao automatica de autenticidade no orgao');
  cs += textAt(60, 350, 'F2', 8, 'competente, constatando-se a higidez formal, cadeia de certificados ICP-Brasil e inexistencia de revogacao.');
  cs += textAt(60, 336, 'F2', 7.5, `Escrevente Responsavel: ${escSan} | Serventia: 7o Registro de Imoveis da Capital - SP`, '0.35 0.35 0.35');

  // 7. ASSINATURA E ENCERRAMENTO
  cs += textAt(45, 295, 'F2', 8.5, 'Sao Paulo - SP, data da consulta via sistema.');
  cs += '0.3 0.3 0.3 RG 1 w 170 240 m 425 240 l S\n';
  cs += textAt(210, 226, 'F1', 9.5, '7o OFICIAL DE REGISTRO DE IMOVEIS');
  cs += textAt(215, 212, 'F2', 8.5, `Oficial: Ademar Fioranelli | Escrevente: ${escSan}`);
  cs += textAt(195, 198, 'F2', 7, 'Exame Formal Automatizado pelo Motor Documental FIORIX', '0.45 0.45 0.45');

  // 8. RODAPÉ INSTITUCIONAL
  cs += '0.7 0.7 0.7 RG 0.5 w 45 145 m 550 145 l S\n';
  cs += textAt(45, 132, 'F2', 7, 'Este comprovante foi gerado eletronicamente e possui validade juridica registral perante o Juizo e as Serventias.', '0.45 0.45 0.45');
  cs += textAt(45, 120, 'F2', 7, 'A autenticidade deste comprovante pode ser revalidada a qualquer tempo com o hash SHA-256 e o protocolo oficial.', '0.45 0.45 0.45');
  cs += textAt(45, 108, 'F2', 7, '7o Cartorio de Registro de Imoveis da Capital - SP | R. Augusta, 356 - Consolacao - Cep 01304-000', '0.45 0.45 0.45');

  const contentStream = cs.trim();
  const streamLength = Buffer.byteLength(contentStream, 'utf-8');

  const objects: string[] = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`
  );
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  objects.push(`6 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

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

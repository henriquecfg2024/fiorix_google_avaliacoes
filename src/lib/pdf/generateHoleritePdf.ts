/**
 * Gerador de PDF 1.4 canônico e válido sem dependências externas pesadas.
 * Gera documento PDF compatível com Chrome, Acrobat, Safari e Edge.
 */
export function generateHoleritePdfBinary(params: {
  competencia: string;
  nomeColaborador: string;
  cpfMascarado: string;
  cargo?: string;
  valorBruto: string;
  valorLiquido: string;
  descontos: string;
  hashSha256: string;
  ipMascarado: string;
  dataEmissao: string;
}): Buffer {
  const {
    competencia,
    nomeColaborador,
    cpfMascarado,
    cargo = "Escrevente",
    valorBruto,
    valorLiquido,
    descontos,
    hashSha256,
    ipMascarado,
    dataEmissao,
  } = params;

  // Stream de comandos PostScript / PDF para desenhar o holerite
  const contentStream = `
BT
/F1 16 Tf
50 780 Td
(7o REGISTRO DE IMOVEIS DE SAO PAULO) Tj
ET

BT
/F2 10 Tf
50 762 Td
(SISTEMA INTEGRADO FIORIX PESSOAS - RECIBO DE PAGAMENTO DE SALARIO) Tj
ET

BT
/F1 11 Tf
400 780 Td
(COMPETENCIA: ${competencia}) Tj
ET

% Linha divisória superior
0.2 0.2 0.3 RG
1 w
50 750 m 545 750 l S

% Dados do colaborador
BT
/F1 10 Tf
50 725 Td
(COLABORADOR:) Tj
/F2 10 Tf
140 725 Td
(${nomeColaborador}) Tj
ET

BT
/F1 10 Tf
360 725 Td
(CPF:) Tj
/F2 10 Tf
390 725 Td
(${cpfMascarado}) Tj
ET

BT
/F1 10 Tf
50 705 Td
(FUNCAO / CARGO:) Tj
/F2 10 Tf
140 705 Td
(${cargo}) Tj
ET

BT
/F1 10 Tf
360 705 Td
(EMISSAO:) Tj
/F2 10 Tf
420 705 Td
(${dataEmissao}) Tj
ET

% Tabela de Proventos e Descontos
0.2 0.2 0.3 RG
50 685 m 545 685 l S

BT
/F1 9 Tf
60 670 Td
(COD) Tj
110 670 Td
(DESCRICAO DOS VENCIMENTOS) Tj
350 670 Td
(REFERENCIA) Tj
450 670 Td
(VALOR (R$)) Tj
ET

50 660 m 545 660 l S

BT
/F2 9 Tf
60 640 Td
(001) Tj
110 640 Td
(Salario Base Mensal) Tj
350 640 Td
(30 dias) Tj
450 640 Td
(${valorBruto}) Tj
ET

BT
/F2 9 Tf
60 620 Td
(102) Tj
110 620 Td
(INSS / Previdencia Oficial) Tj
350 620 Td
(14.00%) Tj
450 620 Td
(- ${descontos}) Tj
ET

BT
/F2 9 Tf
60 600 Td
(205) Tj
110 600 Td
(IRRF - Imposto de Renda Retido) Tj
350 600 Td
(Faixa 4) Tj
450 600 Td
(- 0,00) Tj
ET

% Linha totalizadores
50 560 m 545 560 l S

BT
/F1 10 Tf
60 540 Td
(TOTAL BRUTO: ${valorBruto}) Tj
230 540 Td
(TOTAL DESCONTOS: ${descontos}) Tj
ET

% Destaque Valor Líquido
0.9 0.95 1 rg
50 490 495 35 re f

0.1 0.3 0.6 RG
1.5 w
50 490 495 35 re S

BT
/F1 12 Tf
70 503 Td
(VALOR LIQUIDO A RECEBER:  ${valorLiquido}) Tj
ET

% Declaração de Quitação Art. 464 CLT
BT
/F2 8 Tf
50 450 Td
(EM CONFORMIDADE COM O ART. 464 DA CLT, DECLARO TER RECEBIDO A QUANTIA LIQUIDA DISCRIMINADA NESTE RECIBO.) Tj
ET

% Assinaturas
50 380 m 260 380 l S
335 380 m 545 380 l S

BT
/F2 8 Tf
80 365 Td
(7o REGISTRO DE IMOVEIS DE SP) Tj
380 365 Td
(ASSINATURA DO EMPREGADO) Tj
ET

% Trilha de Segurança e LGPD
0.8 0.8 0.8 RG
0.5 w
50 300 m 545 300 l S

BT
/F1 8 Tf
50 285 Td
(SEGURANCA E PROVA DE INTEGRIDADE DIGITAL (LGPD & SHA-256):) Tj
ET

BT
/F2 7 Tf
50 270 Td
(Hash de Integridade do Arquivo (SHA-256): ${hashSha256}) Tj
ET

BT
/F2 7 Tf
50 255 Td
(Acesso auditado por IP: ${ipMascarado} | Registro gravado na trilha imutavel do FIORIX) Tj
ET

BT
/F2 7 Tf
50 240 Td
(DPO e Encarregado de Dados: dpo@7risp.com.br | Retencao conforme Politica Institucional de 5 anos.) Tj
ET
`.trim();

  const streamLength = Buffer.byteLength(contentStream, "utf-8");

  // Construção dos objetos PDF
  const objects: string[] = [];

  // Objeto 1: Catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // Objeto 2: Pages
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);

  // Objeto 3: Page (A4: 595 x 842 points)
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`
  );

  // Objeto 4: Font F1 (Helvetica-Bold)
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);

  // Objeto 5: Font F2 (Helvetica)
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  // Objeto 6: Contents Stream
  objects.push(`6 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

  // Montagem do PDF
  let pdf = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf-8"));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "utf-8");
}

/**
 * Gerador nativo de arquivos Word (.docx OOXML e .doc Word 97-2003/HTML)
 * para a Manifestação Oficial de Usucapião do 7º Oficial de Registro de Imóveis da Capital – SP.
 * Respeita integralmente todas as edições diretas feitas pelo usuário na tela híbrida.
 */
import type { MinutaModelo, Segmento } from '@/components/documental/FichaOficialView';
import type { InfoArquivamento } from '@/lib/pdf/generateManifestacaoPdf';
import {
  LOGO_7RI_MANIFESTACAO_DATA_URI,
  obterBytesLogo7riManifestacao,
} from '@/lib/documental/logo7riManifestacao';

function escaparXml(texto: string): string {
  return (texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escaparHtml(texto: string): string {
  return (texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarDataHoraBr(valor: string | Date): string {
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(d.getTime())) return String(valor || '');
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function nomeArquivoWordManifestacao(
  numeroProcesso: string | null | undefined,
  extensao: 'docx' | 'doc',
  versao?: number | null,
): string {
  const base = (numeroProcesso || 'sem-numero').replace(/[^\w.-]+/g, '_').slice(0, 60);
  const sufixo = versao ? `_v${versao}` : '_rascunho';
  return `Manifestacao_${base}${sufixo}.${extensao}`;
}

// ─── Construtor ZIP (PKZIP Store Method 0 com CRC-32) para .DOCX OOXML ──────

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function calcularCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface EntradaZip {
  nome: string;
  dados: Uint8Array;
}

function empacotarZip(entradas: EntradaZip[]): Uint8Array {
  const encoder = new TextEncoder();
  const registrosLocais: Uint8Array[] = [];
  const registrosCentrais: Uint8Array[] = [];
  let offsetAtual = 0;

  for (const entrada of entradas) {
    const nomeBytes = encoder.encode(entrada.nome);
    const dados = entrada.dados;
    const crc = calcularCrc32(dados);
    const tamanho = dados.length;

    // Local file header (30 bytes + nome + dados)
    const local = new Uint8Array(30 + nomeBytes.length + tamanho);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // assinatura PK\x03\x04
    lv.setUint16(4, 20, true); // versão necessária (2.0)
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // método 0 (Store)
    lv.setUint16(10, 0, true); // hora mod
    lv.setUint16(12, 0x5421, true); // data mod
    lv.setUint32(14, crc, true);
    lv.setUint32(18, tamanho, true);
    lv.setUint32(22, tamanho, true);
    lv.setUint16(26, nomeBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nomeBytes, 30);
    local.set(dados, 30 + nomeBytes.length);
    registrosLocais.push(local);

    // Central directory file header (46 bytes + nome)
    const central = new Uint8Array(46 + nomeBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // assinatura PK\x01\x02
    cv.setUint16(4, 20, true); // versão criadora
    cv.setUint16(6, 20, true); // versão necessária
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // método 0 (Store)
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, tamanho, true);
    cv.setUint32(24, tamanho, true);
    cv.setUint16(28, nomeBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offsetAtual, true);
    central.set(nomeBytes, 46);
    registrosCentrais.push(central);

    offsetAtual += local.length;
  }

  const tamanhoCentral = registrosCentrais.reduce((acc, b) => acc + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // assinatura PK\x05\x06
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entradas.length, true);
  ev.setUint16(10, entradas.length, true);
  ev.setUint32(12, tamanhoCentral, true);
  ev.setUint32(16, offsetAtual, true);
  ev.setUint16(20, 0, true);

  const totalBytes = offsetAtual + tamanhoCentral + eocd.length;
  const resultado = new Uint8Array(totalBytes);
  let pos = 0;
  for (const r of registrosLocais) {
    resultado.set(r, pos);
    pos += r.length;
  }
  for (const c of registrosCentrais) {
    resultado.set(c, pos);
    pos += c.length;
  }
  resultado.set(eocd, pos);
  return resultado;
}

// ─── Construção do XML WordprocessingML (.docx) ─────────────────────────────

function xmlRun(texto: string, opcoes: { bold?: boolean; underline?: boolean; italic?: boolean; sizeHalfPt?: number; color?: string } = {}): string {
  const rPr: string[] = [
    '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>',
  ];
  if (opcoes.bold) rPr.push('<w:b/><w:bCs/>');
  if (opcoes.italic) rPr.push('<w:i/><w:iCs/>');
  if (opcoes.underline) rPr.push('<w:u w:val="single"/>');
  if (opcoes.color) rPr.push(`<w:color w:val="${opcoes.color}"/>`);
  const sz = opcoes.sizeHalfPt ?? 22; // 11pt = 22 half-points
  rPr.push(`<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`);

  return `<w:r><w:rPr>${rPr.join('')}</w:rPr><w:t xml:space="preserve">${escaparXml(texto)}</w:t></w:r>`;
}

function xmlParagrafoSegmentos(
  segmentos: Segmento[],
  opcoes: {
    align?: 'left' | 'center' | 'right' | 'both';
    firstLineTwips?: number;
    leftTwips?: number;
    spaceAfterTwips?: number;
    spaceBeforeTwips?: number;
    boldAll?: boolean;
    sizeHalfPt?: number;
    borderBottom?: boolean;
    borderTop?: boolean;
  } = {},
): string {
  const pPr: string[] = [];
  if (opcoes.align) pPr.push(`<w:jc w:val="${opcoes.align}"/>`);
  if (opcoes.firstLineTwips || opcoes.leftTwips) {
    const attrs: string[] = [];
    if (opcoes.leftTwips) attrs.push(`w:left="${opcoes.leftTwips}"`);
    if (opcoes.firstLineTwips) attrs.push(`w:firstLine="${opcoes.firstLineTwips}"`);
    pPr.push(`<w:ind ${attrs.join(' ')}/>`);
  }
  const before = opcoes.spaceBeforeTwips ?? 0;
  const after = opcoes.spaceAfterTwips ?? 140;
  pPr.push(`<w:spacing w:before="${before}" w:after="${after}" w:line="300" w:lineRule="auto"/>`);

  if (opcoes.borderBottom || opcoes.borderTop) {
    const bdrs: string[] = [];
    if (opcoes.borderBottom) bdrs.push('<w:bottom w:val="single" w:sz="12" w:space="4" w:color="000000"/>');
    if (opcoes.borderTop) bdrs.push('<w:top w:val="single" w:sz="6" w:space="2" w:color="000000"/>');
    pPr.push(`<w:pBdr>${bdrs.join('')}</w:pBdr>`);
  }

  const runs = segmentos
    .map(seg =>
      xmlRun(seg.t, {
        bold: Boolean(opcoes.boldAll || seg.destaque),
        underline: Boolean(seg.destaque && !opcoes.boldAll),
        sizeHalfPt: opcoes.sizeHalfPt ?? 22,
      }),
    )
    .join('');

  return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${runs}</w:p>`;
}

export function gerarDocxBytesManifestacao(
  minuta: MinutaModelo,
  opcoes: { textoLivreCorpo?: string | null; infoArquivamento?: InfoArquivamento | null } = {},
): Uint8Array {
  const encoder = new TextEncoder();
  const paragrafosXml: string[] = [];

  // 1. Cabeçalho do Processo (o Logotipo Oficial 7º RI vai no cabeçalho de página word/header1.xml, repetindo em todas as páginas)
  const cab = minuta.cabecalho;
  paragrafosXml.push(
    `<w:p><w:pPr><w:spacing w:before="40" w:after="30"/></w:pPr>` +
      xmlRun(`${cab.processoRotulo} `, { bold: true, sizeHalfPt: 22 }) +
      xmlRun(cab.processoValor, { bold: true, sizeHalfPt: 22 }) +
      `</w:p>`,
  );
  paragrafosXml.push(
    xmlParagrafoSegmentos([{ t: cab.vara }], { boldAll: true, sizeHalfPt: 22, spaceAfterTwips: 30 }),
  );
  paragrafosXml.push(
    xmlParagrafoSegmentos([{ t: `${cab.interessadosRotulo} ${cab.interessadosValor}` }], {
      boldAll: true,
      sizeHalfPt: 22,
      spaceAfterTwips: 30,
    }),
  );
  paragrafosXml.push(
    `<w:p><w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr>` +
      xmlRun(cab.natureza, { bold: true, underline: true, sizeHalfPt: 22 }) +
      `</w:p>`,
  );

  // 3. Saudação
  paragrafosXml.push(
    xmlParagrafoSegmentos([{ t: minuta.saudacao }], {
      boldAll: true,
      sizeHalfPt: 22,
      spaceBeforeTwips: 60,
      spaceAfterTwips: 200,
    }),
  );

  // 4. Corpo da Manifestação (respeita textoLivreCorpo caso o usuário tenha editado no modo texto livre)
  const corpoLivre = opcoes.textoLivreCorpo?.trim() || (minuta as MinutaModelo & { corpoTextoLivre?: string }).corpoTextoLivre?.trim();
  if (corpoLivre) {
    const linhas = corpoLivre.split(/\r?\n/);
    for (const linha of linhas) {
      const limpa = linha.trim();
      if (!limpa) continue;
      const ehTopicoConfrontacao = /^[–\-•]/.test(limpa);
      paragrafosXml.push(
        xmlParagrafoSegmentos([{ t: limpa }], {
          align: ehTopicoConfrontacao ? 'left' : 'both',
          firstLineTwips: ehTopicoConfrontacao ? 0 : 709,
          leftTwips: ehTopicoConfrontacao ? 709 : 0,
          spaceAfterTwips: ehTopicoConfrontacao ? 60 : 160,
          sizeHalfPt: 22,
        }),
      );
    }
  } else {
    for (const p of minuta.paragrafosAntes) {
      paragrafosXml.push(
        xmlParagrafoSegmentos(p, { align: 'both', firstLineTwips: 709, spaceAfterTwips: 160, sizeHalfPt: 22 }),
      );
    }
    paragrafosXml.push(
      xmlParagrafoSegmentos([{ t: minuta.introConfrontacoes }], {
        align: 'both',
        firstLineTwips: 709,
        spaceAfterTwips: 80,
        sizeHalfPt: 22,
      }),
    );
    for (const c of minuta.confrontacoes) {
      paragrafosXml.push(
        xmlParagrafoSegmentos([{ t: `${c.rotulo} ${c.valor}${c.pontuacao}` }], {
          align: 'left',
          leftTwips: 709,
          spaceAfterTwips: 50,
          sizeHalfPt: 22,
        }),
      );
    }
    for (let i = 0; i < minuta.paragrafosDepois.length; i++) {
      paragrafosXml.push(
        xmlParagrafoSegmentos(minuta.paragrafosDepois[i], {
          align: 'both',
          firstLineTwips: 709,
          spaceBeforeTwips: i === 0 ? 100 : 0,
          spaceAfterTwips: 160,
          sizeHalfPt: 22,
        }),
      );
    }
  }

  // 5. Local e Data
  paragrafosXml.push(
    xmlParagrafoSegmentos([{ t: minuta.local }], {
      align: 'right',
      spaceBeforeTwips: 240,
      spaceAfterTwips: 360,
      sizeHalfPt: 22,
    }),
  );

  // 6. Assinatura do Oficial
  paragrafosXml.push(
    xmlParagrafoSegmentos([{ t: minuta.assinatura.titulo || 'O Oficial,' }], {
      align: 'center',
      spaceAfterTwips: 560,
      sizeHalfPt: 22,
    }),
  );
  paragrafosXml.push(
    xmlParagrafoSegmentos([{ t: '____________________________________________' }], {
      align: 'center',
      spaceAfterTwips: 20,
      sizeHalfPt: 20,
    }),
  );
  paragrafosXml.push(
    xmlParagrafoSegmentos([{ t: minuta.assinatura.nome }], {
      align: 'center',
      boldAll: true,
      spaceAfterTwips: 20,
      sizeHalfPt: 22,
    }),
  );
  paragrafosXml.push(
    `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr>` +
      xmlRun(minuta.assinatura.cargo, { sizeHalfPt: 18, color: '555555' }) +
      `</w:p>`,
  );

  // 7. Rodapé de arquivamento quando finalizado
  if (opcoes.infoArquivamento) {
    const info = opcoes.infoArquivamento;
    paragrafosXml.push(
      `<w:p><w:pPr><w:spacing w:before="280" w:after="20"/><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="999999"/></w:pBdr></w:pPr>` +
        xmlRun(
          `Manifestação arquivada no FIORIX em ${formatarDataHoraBr(info.finalizadoEm)}` +
            `${info.finalizadoPorNome ? ` por ${info.finalizadoPorNome}` : ''} — versão ${info.versao}`,
          { sizeHalfPt: 15, color: '666666' },
        ) +
        `</w:p>`,
    );
    if (info.hashSha256) {
      paragrafosXml.push(
        `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>` +
          xmlRun(`SHA-256: ${info.hashSha256}`, { sizeHalfPt: 14, color: '777777' }) +
          `</w:p>`,
      );
    }
  }

  // Dimensões do logotipo oficial em EMUs (16.4 cm x 3.49 cm — proporção 926x197)
  const logoCx = 5904000;
  const logoCy = 1256035;

  const header1Xml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
    `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
    `xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<w:p>` +
    `<w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr>` +
    `<w:r>` +
    `<w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${logoCx}" cy="${logoCy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="1" name="Logo7RI" descr="7º Oficial de Registro de Imóveis da Capital - SP"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic>` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic>` +
    `<pic:nvPicPr>` +
    `<pic:cNvPr id="1" name="logo-7ri-manifestacao.png" descr="7º Oficial de Registro de Imóveis da Capital - SP"/>` +
    `<pic:cNvPicPr/>` +
    `</pic:nvPicPr>` +
    `<pic:blipFill>` +
    `<a:blip r:embed="rIdLogo7ri"/>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</pic:blipFill>` +
    `<pic:spPr>` +
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${logoCx}" cy="${logoCy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `</pic:spPr>` +
    `</pic:pic>` +
    `</a:graphicData>` +
    `</a:graphic>` +
    `</wp:inline>` +
    `</w:drawing>` +
    `</w:r>` +
    `</w:p>` +
    `</w:hdr>`;

  const header1RelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rIdLogo7ri" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo-7ri-manifestacao.png"/>` +
    `</Relationships>`;

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<w:body>` +
    paragrafosXml.join('') +
    `<w:sectPr>` +
    `<w:headerReference w:type="default" r:id="rId2"/>` +
    `<w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="2400" w:right="1134" w:bottom="1134" w:left="1418" w:header="567" w:footer="709" w:gutter="0"/>` +
    `</w:sectPr>` +
    `</w:body>` +
    `</w:document>`;

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults>` +
    `<w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>` +
    `</w:docDefaults>` +
    `</w:styles>`;

  const settingsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:view w:val="print"/>` +
    `<w:zoom w:percent="100"/>` +
    `</w:settings>`;

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>` +
    `<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>` +
    `</Types>`;

  const rootRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const docRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>` +
    `</Relationships>`;

  return empacotarZip([
    { nome: '[Content_Types].xml', dados: encoder.encode(contentTypesXml) },
    { nome: '_rels/.rels', dados: encoder.encode(rootRelsXml) },
    { nome: 'word/_rels/document.xml.rels', dados: encoder.encode(docRelsXml) },
    { nome: 'word/_rels/header1.xml.rels', dados: encoder.encode(header1RelsXml) },
    { nome: 'word/styles.xml', dados: encoder.encode(stylesXml) },
    { nome: 'word/settings.xml', dados: encoder.encode(settingsXml) },
    { nome: 'word/header1.xml', dados: encoder.encode(header1Xml) },
    { nome: 'word/media/logo-7ri-manifestacao.png', dados: obterBytesLogo7riManifestacao() },
    { nome: 'word/document.xml', dados: encoder.encode(documentXml) },
  ]);
}

// ─── Construção do documento .DOC (Word 97-2003 / HTML paginado A4) ─────────

function htmlSegmentos(segmentos: Segmento[]): string {
  return segmentos
    .map(s => (s.destaque ? `<b><u>${escaparHtml(s.t)}</u></b>` : escaparHtml(s.t)))
    .join('');
}

export function gerarDocHtmlManifestacao(
  minuta: MinutaModelo,
  opcoes: { textoLivreCorpo?: string | null; infoArquivamento?: InfoArquivamento | null } = {},
): string {
  const corpoLivre = opcoes.textoLivreCorpo?.trim() || (minuta as MinutaModelo & { corpoTextoLivre?: string }).corpoTextoLivre?.trim();

  let corpoHtml = '';
  if (corpoLivre) {
    corpoHtml = corpoLivre
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(linha => {
        const ehTopico = /^[–\-•]/.test(linha);
        return ehTopico
          ? `<p class="confrontacao">${escaparHtml(linha)}</p>`
          : `<p class="paragrafo">${escaparHtml(linha)}</p>`;
      })
      .join('\n');
  } else {
    const antes = minuta.paragrafosAntes
      .map(p => `<p class="paragrafo">${htmlSegmentos(p)}</p>`)
      .join('\n');
    const confs = minuta.confrontacoes
      .map(c => `<p class="confrontacao">${escaparHtml(`${c.rotulo} ${c.valor}${c.pontuacao}`)}</p>`)
      .join('\n');
    const depois = minuta.paragrafosDepois
      .map(p => `<p class="paragrafo">${htmlSegmentos(p)}</p>`)
      .join('\n');
    corpoHtml = `${antes}\n<p class="paragrafo">${escaparHtml(minuta.introConfrontacoes)}</p>\n${confs}\n${depois}`;
  }

  const rodapeArquivamento = opcoes.infoArquivamento
    ? `<div style="margin-top:28pt;border-top:1px solid #999;padding-top:6pt;font-size:8pt;color:#555;">
         <div>Manifestação arquivada no FIORIX em ${escaparHtml(formatarDataHoraBr(opcoes.infoArquivamento.finalizadoEm))}${opcoes.infoArquivamento.finalizadoPorNome ? ` por ${escaparHtml(opcoes.infoArquivamento.finalizadoPorNome)}` : ''} — versão ${opcoes.infoArquivamento.versao}</div>
         ${opcoes.infoArquivamento.hashSha256 ? `<div>SHA-256: ${escaparHtml(opcoes.infoArquivamento.hashSha256)}</div>` : ''}
       </div>`
    : '';

  return (
    `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:w="urn:schemas-microsoft-com:office:word" ` +
    `xmlns="http://www.w3.org/TR/REC-html40">\n` +
    `<head>\n` +
    `<meta charset="utf-8">\n` +
    `<title>Manifestação ${escaparHtml(minuta.cabecalho.processoValor)}</title>\n` +
    `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->\n` +
    `<style>\n` +
    `@page Section1 { size: 21.0cm 29.7cm; margin: 2.0cm 2.0cm 2.0cm 2.5cm; mso-header-margin: 1.25cm; mso-footer-margin: 1.25cm; }\n` +
    `div.Section1 { page: Section1; font-family: Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.45; }\n` +
    `.timbre { text-align: center; margin-bottom: 14pt; }\n` +
    `.cabecalho p { margin: 0 0 2pt 0; font-size: 10.5pt; }\n` +
    `.saudacao { font-weight: bold; margin: 14pt 0 12pt 0; font-size: 11pt; }\n` +
    `.paragrafo { text-align: justify; text-indent: 1.25cm; margin: 0 0 10pt 0; font-size: 11pt; }\n` +
    `.confrontacao { margin: 0 0 3pt 1.25cm; font-size: 11pt; }\n` +
    `.local-data { text-align: right; margin-top: 18pt; margin-bottom: 24pt; font-size: 11pt; }\n` +
    `.assinatura { text-align: center; margin-top: 18pt; font-size: 11pt; }\n` +
    `</style>\n` +
    `</head>\n` +
    `<body>\n` +
    `<div class="Section1">\n` +
    `  <div class="timbre">\n` +
    `    <img src="${LOGO_7RI_MANIFESTACAO_DATA_URI}" width="620" height="132" alt="7º Oficial de Registro de Imóveis da Capital - SP" style="width:16.4cm;height:3.49cm;display:block;margin:0 auto;" />\n` +
    `  </div>\n` +
    `  <div class="cabecalho">\n` +
    `    <p><b>${escaparHtml(minuta.cabecalho.processoRotulo)} ${escaparHtml(minuta.cabecalho.processoValor)}</b></p>\n` +
    `    <p><b>${escaparHtml(minuta.cabecalho.vara)}</b></p>\n` +
    `    <p><b>${escaparHtml(minuta.cabecalho.interessadosRotulo)}</b> <b>${escaparHtml(minuta.cabecalho.interessadosValor)}</b></p>\n` +
    `    <p><b><u>${escaparHtml(minuta.cabecalho.natureza)}</u></b></p>\n` +
    `  </div>\n` +
    `  <p class="saudacao">${escaparHtml(minuta.saudacao)}</p>\n` +
    `  ${corpoHtml}\n` +
    `  <p class="local-data">${escaparHtml(minuta.local)}</p>\n` +
    `  <div class="assinatura">\n` +
    `    <p style="margin-bottom:28pt;">${escaparHtml(minuta.assinatura.titulo || 'O Oficial,')}</p>\n` +
    `    <p style="margin:0;">________________________________________</p>\n` +
    `    <p style="margin:2pt 0 0 0;font-weight:bold;">${escaparHtml(minuta.assinatura.nome)}</p>\n` +
    `    <p style="margin:0;font-size:9pt;color:#555555;">${escaparHtml(minuta.assinatura.cargo)}</p>\n` +
    `  </div>\n` +
    `  ${rodapeArquivamento}\n` +
    `</div>\n` +
    `</body>\n` +
    `</html>`
  );
}

// ─── Funções de Download no Navegador (.docx e .doc) ────────────────────────

function dispararDownloadBlob(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function baixarDocxManifestacao(
  minuta: MinutaModelo,
  infoArquivamento?: InfoArquivamento | null,
  numeroProcesso?: string | null,
): void {
  const bytes = gerarDocxBytesManifestacao(minuta, { infoArquivamento });
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  dispararDownloadBlob(
    blob,
    nomeArquivoWordManifestacao(numeroProcesso || minuta.cabecalho.processoValor, 'docx', infoArquivamento?.versao),
  );
}

export function baixarDocManifestacao(
  minuta: MinutaModelo,
  infoArquivamento?: InfoArquivamento | null,
  numeroProcesso?: string | null,
): void {
  const html = gerarDocHtmlManifestacao(minuta, { infoArquivamento });
  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  dispararDownloadBlob(
    blob,
    nomeArquivoWordManifestacao(numeroProcesso || minuta.cabecalho.processoValor, 'doc', infoArquivamento?.versao),
  );
}

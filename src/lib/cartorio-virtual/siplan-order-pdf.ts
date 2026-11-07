/**
 * Motor Determinístico de Geração de PDF — Espelho Fiel SIPLAN / WEBRI (Seção 7)
 *
 * Especificações validadas nos modelos oficiais do 7º RI-SP:
 * - Geometria exata: 595 x 842 pt (A4 retrato padrão SIPLAN).
 * - Cabeçalho oficial do 7º RI-SP embutido (PNG nativo 1042 x 242 px extraído do RTF oficial).
 * - Código de barras Code 39 vetorial (*<Protocolo/>*) renderizado diretamente em primitivas PDF.
 * - Três papéis cadastrais/fiscais preservados separadamente:
 *     1. Solicitante / Requerente (Nome, CPF/CNPJ, E-mail, Telefone)
 *     2. Apresentante RPS (Nome, CPF/CNPJ)
 *     3. Destinatário da Nota RPS (Nome, CPF/CNPJ)
 * - Aviso legal do Provimento CNJ nº 134/2022 (LGPD), Escrevente, Assinatura e Quadro de Valores.
 * - Paginação automática multi-item SEM reduzir o tamanho da fonte (mantém legibilidade integral).
 * - Página Operacional Interna (Ficha de Conferência, Contraditório e Grade de Buscas).
 * - Modo Duplex Inteligente: insere página espaçadora em branco no verso quando um pedido possui
 *   quantidade ímpar de páginas, garantindo que todo próximo pedido inicie na frente de nova folha.
 */

import { createHash } from "crypto";
import {
  degrees,
  Duplex,
  PDFDocument,
  PrintScaling,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { SIPLAN_7RI_HEADER_PNG_BASE64 } from "./assets/siplan-7ri-header-png";
import {
  ALTURA_PAGINA_SIPLAN_PT,
  CODE39_PATTERNS,
  formatarMoedaBrl,
  LARGURA_PAGINA_SIPLAN_PT,
  TAMANHO_FONTE_CORPO_FIXO_PT,
  TAMANHO_FONTE_ITEM_FIXO_PT,
  type AnotacaoImpressaoPedido,
} from "./siplan-constants";
import {
  obterPrenotacoesContraditorioDoPedido,
  type CorGrifoDocumento,
  type CorTextoDocumento,
  type MarcacaoVisualDocumentoPedido,
  type PedidoCertidaoDetalheDTO,
} from "./types";

export {
  ALTURA_PAGINA_SIPLAN_PT,
  CODE39_PATTERNS,
  formatarMoedaBrl,
  LARGURA_PAGINA_SIPLAN_PT,
  TAMANHO_FONTE_CORPO_FIXO_PT,
  TAMANHO_FONTE_ITEM_FIXO_PT,
  type AnotacaoImpressaoPedido,
};

const MAPA_EMOTICONS_PARA_WINANSI: Array<[RegExp, string]> = [
  [/✅|✔️|☑️/gu, "[OK] "],
  [/⚠️/gu, "[ATENÇÃO] "],
  [/🚨/gu, "[URGENTE] "],
  [/❌|✖️/gu, "[IMPEDIMENTO] "],
  [/📌|📍/gu, "[NOTA] "],
  [/🔍|🔎/gu, "[BUSCA] "],
  [/📄|📃|📋/gu, "[DOC] "],
  [/⏳|⏰/gu, "[AGUARDANDO] "],
  [/🔒/gu, "[BLOQUEIO] "],
  [/🔓/gu, "[LIBERADO] "],
  [/❗|❕/gu, "[!] "],
  [/😊|🙂|😀|😄/gu, ":) "],
  [/😉/gu, ";-) "],
  [/😕|😟|🙁|😞/gu, ":( "],
  [/🤔/gu, "[DÚVIDA] "],
  [/👍/gu, "[DE ACORDO] "],
  [/👎/gu, "[REVER] "],
  [/👏/gu, "[PARABÉNS] "],
  [/🙏/gu, "[OBRIGADO] "],
  [/👀/gu, "[REVISAR] "],
  [/🎯/gu, "[ALVO] "],
  [/⭐|🌟/gu, "[*] "],
  [/🔥/gu, "[PRIORIDADE] "],
  [/💡/gu, "[DICA] "],
  [/💬|✍️/gu, "[OBS] "],
  [/❤️|💙|💚/gu, "<3 "],
];

/**
 * Configura preferências nativas ISO 32000-1 (`ViewerPreferences`) no catálogo do PDF
 * para que o diálogo de impressão do navegador/sistema abra POR PADRÃO em Frente e Verso (`DuplexFlipLongEdge`).
 */
export function aplicarPreferenciasImpressaoDuplex(
  pdfDoc: PDFDocument,
  frenteEVersoPadrao = true
): void {
  const viewerPrefs = pdfDoc.catalog.getOrCreateViewerPreferences();
  viewerPrefs.setDuplex(
    frenteEVersoPadrao ? Duplex.DuplexFlipLongEdge : Duplex.Simplex
  );
  viewerPrefs.setPrintScaling(PrintScaling.None);
}

/**
 * Preserva integralmente acentuação da língua portuguesa compatível com WinAnsi (ISO-8859-1 / CP1252)
 * e converte emoticons/glifos fora do plano WinAnsi para equivalentes imprimíveis seguros sem perda semântica.
 */
export function sanitizarTextoWinAnsi(texto: string | null | undefined): string {
  if (!texto) return "";
  let convertido = String(texto);
  for (const [padrao, substituto] of MAPA_EMOTICONS_PARA_WINANSI) {
    convertido = convertido.replace(padrao, substituto);
  }
  return convertido
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/ {2,}/g, " ");
}

/**
 * Quebra texto longo em múltiplas linhas respeitando largura máxima em pontos,
 * sem truncar nomes extensos nem reduzir tamanho de fonte.
 */
export function quebrarTextoEmLinhas(
  texto: string,
  fonte: PDFFont,
  tamanhoFonte: number,
  larguraMaxPt: number
): string[] {
  const limpo = sanitizarTextoWinAnsi(texto).trim();
  if (!limpo) return ["—"];

  const palavras = limpo.split(/\s+/);
  const linhas: string[] = [];
  let linhaAtual = "";

  for (const palavra of palavras) {
    const candidata = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
    const larguraCandidata = fonte.widthOfTextAtSize(candidata, tamanhoFonte);
    if (larguraCandidata <= larguraMaxPt) {
      linhaAtual = candidata;
    } else if (!linhaAtual) {
      // Palavra individual maior que a coluna (ex: hash ou endereço contínuo): quebra por caractere
      let pedaco = "";
      for (const ch of palavra) {
        if (fonte.widthOfTextAtSize(pedaco + ch, tamanhoFonte) <= larguraMaxPt) {
          pedaco += ch;
        } else {
          if (pedaco) linhas.push(pedaco);
          pedaco = ch;
        }
      }
      linhaAtual = pedaco;
    } else {
      linhas.push(linhaAtual);
      linhaAtual = palavra;
    }
  }

  if (linhaAtual) linhas.push(linhaAtual);
  return linhas;
}

/**
 * Renderiza código de barras Code 39 vetorial (*VALOR*) diretamente na página PDF.
 */
export function desenharCodigoBarrasCode39(params: {
  page: PDFPage;
  valorProtocolo: string;
  xDireita: number;
  yTopo: number;
  alturaBarraPt?: number;
  moduloEstreitoPt?: number;
}): { larguraTotalPt: number; textoCodificado: string } {
  const {
    page,
    valorProtocolo,
    xDireita,
    yTopo,
    alturaBarraPt = 26,
    moduloEstreitoPt = 1.05,
  } = params;

  const limpo = String(valorProtocolo || "0")
    .toUpperCase()
    .replace(/[^0-9A-Z\-.\s$/+%]/g, "");
  const textoCodificado = `*${limpo || "0"}*`;
  const moduloLargoPt = moduloEstreitoPt * 2.4;
  const espacoEntreSimbolosPt = moduloEstreitoPt;

  let larguraTotalPt = 0;
  for (let idx = 0; idx < textoCodificado.length; idx++) {
    const padrao = CODE39_PATTERNS[textoCodificado[idx]] || CODE39_PATTERNS["0"];
    for (let i = 0; i < padrao.length; i++) {
      larguraTotalPt += padrao[i] === "w" ? moduloLargoPt : moduloEstreitoPt;
    }
    if (idx < textoCodificado.length - 1) {
      larguraTotalPt += espacoEntreSimbolosPt;
    }
  }

  let cursorX = xDireita - larguraTotalPt;
  const yBase = yTopo - alturaBarraPt;

  for (let idx = 0; idx < textoCodificado.length; idx++) {
    const padrao = CODE39_PATTERNS[textoCodificado[idx]] || CODE39_PATTERNS["0"];
    for (let i = 0; i < padrao.length; i++) {
      const larguraElem = padrao[i] === "w" ? moduloLargoPt : moduloEstreitoPt;
      const ehBarraPreta = i % 2 === 0;
      if (ehBarraPreta) {
        page.drawRectangle({
          x: cursorX,
          y: yBase,
          width: larguraElem,
          height: alturaBarraPt,
          color: rgb(0, 0, 0),
        });
      }
      cursorX += larguraElem;
    }
    if (idx < textoCodificado.length - 1) {
      cursorX += espacoEntreSimbolosPt;
    }
  }

  return { larguraTotalPt, textoCodificado };
}

export interface ResultadoPdfPedidoIndividual {
  pdfBytes: Uint8Array;
  numeroPaginas: number;
  sha256: string;
  usouContinuacaoItens: boolean;
  tamanhoFonteCorpoPt: number;
}

export interface MapaPaginaPedidoNoLote {
  pedidoId: string;
  numeroPedido: string;
  paginaInicialNoLote: number;
  paginaFinalConteudoNoLote: number;
  paginasConteudo: number;
  inseriuPaginaBrancoDuplex: boolean;
}

export interface OpcoesGeracaoLotePdfSiplan {
  pedidos: Array<{
    pedido: PedidoCertidaoDetalheDTO;
    pdfOriginalWebriBase64?: string | null;
    anotacoesSalvas?: AnotacaoImpressaoPedido[];
  }>;
  duplexFrenteNovaFolha: boolean;
  modoDados: "ORIGINAL_CONGELADO" | "ATUAL_RECONSTRUIDO";
  marcaReimpressao?: string | null;
}

export interface ResultadoPdfLoteSiplan {
  pdfBytes: Uint8Array;
  totalPaginas: number;
  paginasBrancoDuplex: number;
  sha256: string;
  mapaPaginasPorPedido: MapaPaginaPedidoNoLote[];
}

/**
 * Renderiza marca d'água vetorial "CONFERIDO" (verde esmeralda) ou "DEVOLVIDO" (vermelho rubi)
 * em moldura dupla na diagonal central da página (595 x 842 pt), com transparência calibrada.
 */
export function desenharMarcaDaguaConferidoDiagonal(params: {
  page: PDFPage;
  fontBold: PDFFont;
  tipo?: "CONFERIDO" | "DEVOLVIDO";
  conferidoPorNome?: string | null;
  conferidoEmBr?: string | null;
}): void {
  const {
    page,
    fontBold,
    tipo = "CONFERIDO",
    conferidoPorNome,
    conferidoEmBr,
  } = params;
  const isDevolvido = tipo === "DEVOLVIDO";
  const corBorda = isDevolvido ? rgb(0.75, 0.07, 0.24) : rgb(0.04, 0.54, 0.34);
  const corTexto = isDevolvido ? rgb(0.72, 0.06, 0.22) : rgb(0.03, 0.48, 0.29);

  const { width, height } = page.getSize();
  const cx = width / 2;
  const cy = height / 2;
  const anguloGraus = 34;
  const rad = (anguloGraus * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const larguraExt = 440;
  const alturaExt = 104;
  page.drawRectangle({
    x: cx - (larguraExt / 2) * cos + (alturaExt / 2) * sin,
    y: cy - (larguraExt / 2) * sin - (alturaExt / 2) * cos,
    width: larguraExt,
    height: alturaExt,
    rotate: degrees(anguloGraus),
    borderColor: corBorda,
    borderWidth: 2.4,
    borderOpacity: 0.19,
  });

  const larguraInt = larguraExt - 10;
  const alturaInt = alturaExt - 10;
  page.drawRectangle({
    x: cx - (larguraInt / 2) * cos + (alturaInt / 2) * sin,
    y: cy - (larguraInt / 2) * sin - (alturaInt / 2) * cos,
    width: larguraInt,
    height: alturaInt,
    rotate: degrees(anguloGraus),
    borderColor: corBorda,
    borderWidth: 0.95,
    borderOpacity: 0.16,
  });

  const textoPrincipal = isDevolvido ? "D E V O L V I D O" : "C O N F E R I D O";
  const tamPrincipal = 43;
  const wPrincipal = fontBold.widthOfTextAtSize(textoPrincipal, tamPrincipal);
  const uPrin = -wPrincipal / 2;
  const vPrin = -7;
  page.drawText(textoPrincipal, {
    x: cx + uPrin * cos - vPrin * sin,
    y: cy + uPrin * sin + vPrin * cos,
    size: tamPrincipal,
    font: fontBold,
    color: corTexto,
    opacity: 0.16,
    rotate: degrees(anguloGraus),
  });

  const subBruto = conferidoPorNome
    ? `7º RI-SP - ${conferidoPorNome.toUpperCase()}${conferidoEmBr ? ` - ${conferidoEmBr}` : ""}`
    : isDevolvido
      ? "7º REGISTRO DE IMOVEIS DE SAO PAULO - PEDIDO DEVOLVIDO"
      : "7º REGISTRO DE IMOVEIS DE SAO PAULO - CONFERENCIA DO ESCREVENTE";
  const subLimpo = sanitizarTextoWinAnsi(subBruto).slice(0, 68);
  const tamSub = 8.8;
  const wSub = fontBold.widthOfTextAtSize(subLimpo, tamSub);
  const uSub = -wSub / 2;
  const vSub = -28;
  page.drawText(subLimpo, {
    x: cx + uSub * cos - vSub * sin,
    y: cy + uSub * sin + vSub * cos,
    size: tamSub,
    font: fontBold,
    color: corTexto,
    opacity: 0.18,
    rotate: degrees(anguloGraus),
  });
}

function desenharCabecalhoOficial7RI(params: {
  page: PDFPage;
  headerImg: PDFImage;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  pedido: PedidoCertidaoDetalheDTO;
  subtituloPagina?: string;
  marcaReimpressao?: string | null;
}): number {
  const { page, headerImg, fontRegular, fontBold, pedido, subtituloPagina, marcaReimpressao } =
    params;
  const margemX = 34;
  const larguraUtil = LARGURA_PAGINA_SIPLAN_PT - margemX * 2;

  // Imagem institucional oficial do 7º RI-SP (proporção 1042x242)
  const imgLargura = 325;
  const imgAltura = Math.round((242 / 1042) * imgLargura); // ~75 pt
  const yTopo = ALTURA_PAGINA_SIPLAN_PT - 28;

  page.drawImage(headerImg, {
    x: margemX,
    y: yTopo - imgAltura,
    width: imgLargura,
    height: imgAltura,
  });

  // Código de Barras Code 39 à direita (sem texto *9901005* abaixo da barra)
  desenharCodigoBarrasCode39({
    page,
    valorProtocolo: pedido.numeroPedido,
    xDireita: LARGURA_PAGINA_SIPLAN_PT - margemX,
    yTopo: yTopo - 6,
    alturaBarraPt: 28,
    moduloEstreitoPt: 1.02,
  });

  if (pedido.protocoloExterno) {
    const tamOnr = 15;
    const txtOnr = sanitizarTextoWinAnsi(pedido.protocoloExterno);
    const wOnr = fontBold.widthOfTextAtSize(txtOnr, tamOnr);
    page.drawText(txtOnr, {
      x: LARGURA_PAGINA_SIPLAN_PT - margemX - wOnr,
      y: yTopo - 50,
      size: tamOnr,
      font: fontBold,
      color: rgb(0.12, 0.25, 0.45),
    });
  }

  if (marcaReimpressao) {
    const txtReimp = sanitizarTextoWinAnsi(marcaReimpressao);
    const wReimp = fontBold.widthOfTextAtSize(txtReimp, 7);
    page.drawText(txtReimp, {
      x: LARGURA_PAGINA_SIPLAN_PT - margemX - wReimp,
      y: yTopo - 67,
      size: 7,
      font: fontBold,
      color: rgb(0.55, 0.15, 0.15),
    });
  }

  const yDivisor = yTopo - imgAltura - 8;
  page.drawLine({
    start: { x: margemX, y: yDivisor },
    end: { x: margemX + larguraUtil, y: yDivisor },
    thickness: 1,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Faixa de Título do Pedido — Número do Pedido com o dobro do tamanho (21 pt na Pág. 1)
  if (!subtituloPagina) {
    const alturaFaixa = 28;
    page.drawRectangle({
      x: margemX,
      y: yDivisor - alturaFaixa - 3,
      width: larguraUtil,
      height: alturaFaixa,
      color: rgb(0.94, 0.95, 0.97),
      borderColor: rgb(0.75, 0.78, 0.82),
      borderWidth: 0.7,
    });

    const prefixo = sanitizarTextoWinAnsi("PEDIDO DE CERTIDÃO Nº ") || "PEDIDO DE CERTIDAO Nº ";
    const numStr = sanitizarTextoWinAnsi(pedido.numeroPedido);
    const tamPrefixo = 14;
    const tamNumero = 21; // Dobro do tamanho anterior (10.5 pt -> 21 pt)
    const wPref = fontBold.widthOfTextAtSize(prefixo, tamPrefixo);
    const wNum = fontBold.widthOfTextAtSize(numStr, tamNumero);
    const xInicio = margemX + (larguraUtil - (wPref + wNum)) / 2;

    page.drawText(prefixo, {
      x: xInicio,
      y: yDivisor - 22,
      size: tamPrefixo,
      font: fontBold,
      color: rgb(0.05, 0.05, 0.08),
    });
    page.drawText(numStr, {
      x: xInicio + wPref,
      y: yDivisor - 23,
      size: tamNumero,
      font: fontBold,
      color: rgb(0.03, 0.03, 0.06),
    });

    return yDivisor - 39;
  }

  const tituloPrincipal = `PEDIDO DE CERTIDAO Nº ${pedido.numeroPedido} — ${subtituloPagina}`;
  const tituloWin = sanitizarTextoWinAnsi(
    `PEDIDO DE CERTIDÃO Nº ${pedido.numeroPedido} - ${subtituloPagina}`
  );

  page.drawRectangle({
    x: margemX,
    y: yDivisor - 24,
    width: larguraUtil,
    height: 21,
    color: rgb(0.94, 0.95, 0.97),
    borderColor: rgb(0.75, 0.78, 0.82),
    borderWidth: 0.6,
  });

  const wTit = fontBold.widthOfTextAtSize(tituloWin || tituloPrincipal, 11.5);
  page.drawText(tituloWin || tituloPrincipal, {
    x: margemX + (larguraUtil - wTit) / 2,
    y: yDivisor - 17.5,
    size: 11.5,
    font: fontBold,
    color: rgb(0.05, 0.05, 0.08),
  });

  return yDivisor - 34;
}

/**
 * Renderiza um pedido individual no documento `pdfDoc` alvo, retornando quantas páginas foram adicionadas
 * e se houve abertura de página(s) de continuação de itens.
 */
async function adicionarPaginasPedidoAoDoc(params: {
  pdfDoc: PDFDocument;
  headerImg: PDFImage;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  pedido: PedidoCertidaoDetalheDTO;
  marcaReimpressao?: string | null;
  anotacoesSalvas?: AnotacaoImpressaoPedido[];
}): Promise<{ paginasAdicionadas: number; usouContinuacaoItens: boolean }> {
  const {
    pdfDoc,
    headerImg,
    fontRegular,
    fontBold,
    pedido,
    marcaReimpressao,
    anotacoesSalvas,
  } = params;
  const margemX = 34;
  const larguraUtil = LARGURA_PAGINA_SIPLAN_PT - margemX * 2; // 527 pt
  const indicePrimeiraPaginaNoDoc = pdfDoc.getPageCount();
  let paginasAdicionadas = 0;
  let usouContinuacaoItens = false;

  // ── PÁGINA 1: COMPROVANTE / ESPELHO DO PEDIDO DE CERTIDÃO SIPLAN ──
  let pageAtual = pdfDoc.addPage([LARGURA_PAGINA_SIPLAN_PT, ALTURA_PAGINA_SIPLAN_PT]);
  paginasAdicionadas++;

  let y = desenharCabecalhoOficial7RI({
    page: pageAtual,
    headerImg,
    fontRegular,
    fontBold,
    pedido,
    marcaReimpressao,
  });

  // Bloco 1: Datas, Origem e Forma de Entrega
  pageAtual.drawRectangle({
    x: margemX,
    y: y - 34,
    width: larguraUtil,
    height: 34,
    borderColor: rgb(0.72, 0.75, 0.8),
    borderWidth: 0.6,
  });

  const textoEntrada = sanitizarTextoWinAnsi(
    `Data de Entrada: ${pedido.dataPedidoBr}   Hora: ${pedido.horaPedidoBr}`
  );
  const textoPrevisao = sanitizarTextoWinAnsi(
    `Previsão de Entrega: ${pedido.prazoPrevistoBr || "Conforme prazo legal"}`
  );
  const textoCanal = sanitizarTextoWinAnsi(
    `Origem: ${pedido.origem} (${pedido.canalRecebimento})   Forma de Entrega: ${pedido.formaEntregaExibicao}`
  );

  pageAtual.drawText(textoEntrada, {
    x: margemX + 8,
    y: y - 13,
    size: TAMANHO_FONTE_CORPO_FIXO_PT,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.1),
  });
  pageAtual.drawText(textoPrevisao, {
    x: margemX + 275,
    y: y - 13,
    size: TAMANHO_FONTE_CORPO_FIXO_PT,
    font: fontBold,
    color: rgb(0.08, 0.08, 0.1),
  });
  pageAtual.drawText(textoCanal, {
    x: margemX + 8,
    y: y - 27,
    size: TAMANHO_FONTE_ITEM_FIXO_PT,
    font: fontRegular,
    color: rgb(0.18, 0.18, 0.22),
  });

  y -= 42;

  // Bloco 2: Dados do Solicitante / Requerente (sem truncar nomes extensos!)
  const reqDoc =
    pedido.requerente.documentoFormatado ||
    pedido.requerente.documentoMascarado ||
    "Não informado";
  const reqLinhasNome = quebrarTextoEmLinhas(
    `Solicitante: ${pedido.requerente.nome}`,
    fontBold,
    TAMANHO_FONTE_CORPO_FIXO_PT,
    larguraUtil - 195
  );
  const reqContato = `E-mail: ${pedido.requerente.email || "—"}   |   Fone: ${pedido.requerente.telefone || "—"}`;
  const reqLinhasContato = quebrarTextoEmLinhas(
    reqContato,
    fontRegular,
    TAMANHO_FONTE_ITEM_FIXO_PT,
    larguraUtil - 16
  );

  const alturaRequerente =
    12 + reqLinhasNome.length * 12 + reqLinhasContato.length * 11 + 6;

  pageAtual.drawRectangle({
    x: margemX,
    y: y - alturaRequerente,
    width: larguraUtil,
    height: alturaRequerente,
    borderColor: rgb(0.72, 0.75, 0.8),
    borderWidth: 0.6,
  });

  let yReq = y - 13;
  reqLinhasNome.forEach((linha, idx) => {
    pageAtual.drawText(linha, {
      x: margemX + 8,
      y: yReq,
      size: TAMANHO_FONTE_CORPO_FIXO_PT,
      font: fontBold,
      color: rgb(0.06, 0.06, 0.08),
    });
    if (idx === 0) {
      const docStr = sanitizarTextoWinAnsi(
        `${pedido.requerente.tipoDocumento === "CNPJ" ? "CNPJ" : "CPF/CNPJ"}: ${reqDoc}`
      );
      pageAtual.drawText(docStr, {
        x: margemX + larguraUtil - 180,
        y: yReq,
        size: TAMANHO_FONTE_CORPO_FIXO_PT,
        font: fontRegular,
        color: rgb(0.12, 0.12, 0.15),
      });
    }
    yReq -= 12;
  });

  reqLinhasContato.forEach((linha) => {
    pageAtual.drawText(linha, {
      x: margemX + 8,
      y: yReq,
      size: TAMANHO_FONTE_ITEM_FIXO_PT,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.24),
    });
    yReq -= 11;
  });

  y -= alturaRequerente + 10;

  // Cabeçalho da Tabela de Itens Solicitados (<Lista/>)
  const desenharCabecalhoTabelaItens = (pg: PDFPage, yTop: number): number => {
    pg.drawRectangle({
      x: margemX,
      y: yTop - 18,
      width: larguraUtil,
      height: 18,
      color: rgb(0.91, 0.93, 0.96),
      borderColor: rgb(0.68, 0.72, 0.78),
      borderWidth: 0.6,
    });
    pg.drawText("Item", { x: margemX + 6, y: yTop - 13, size: 8, font: fontBold });
    pg.drawText(sanitizarTextoWinAnsi("Espécie / Natureza da Certidão"), {
      x: margemX + 38,
      y: yTop - 13,
      size: 8,
      font: fontBold,
    });
    pg.drawText(sanitizarTextoWinAnsi("Identificação (Matrícula / Critério)"), {
      x: margemX + 235,
      y: yTop - 13,
      size: 8,
      font: fontBold,
    });
    pg.drawText("Entrega / Previsão", {
      x: margemX + 415,
      y: yTop - 13,
      size: 8,
      font: fontBold,
    });
    return yTop - 20;
  };

  y = desenharCabecalhoTabelaItens(pageAtual, y);

  // Espaço mínimo reservado para os blocos fixos de rodapé do recibo (RPS + Observações + CNJ 134/2022 + Assinatura + Valores)
  const ALTURA_BLOCOS_FINAIS_RECIBO_PT = 248;
  const Y_MINIMO_ITENS_COM_RODAPE = 36 + ALTURA_BLOCOS_FINAIS_RECIBO_PT;
  const Y_MINIMO_PAGINA_CONTINUACAO = 54;

  const itensParaRenderizar =
    pedido.itens.length > 0
      ? pedido.itens
      : [
        {
          id: "sintetico-vazio",
          sequenciaItem: 1,
          naturezaCodigo: null,
          naturezaDescricao: pedido.especieSolicitada,
          livroCodigo: 2,
          livroDescricao: "Livro 2 - Registro Geral",
          numeroMatricula: null,
          transcricaoOuLoteamento: null,
          enderecoPesquisa: null,
          meioEntregaCodigo: null,
          meioEntregaDescricao: pedido.formaEntregaExibicao,
          dataPrevisaoIso: pedido.prazoPrevistoIso,
          dataPrevisaoBr: pedido.prazoPrevistoBr,
          elegivelPiloto: false,
          motivoEncaminhamentoHumano: null,
          statusItem: "PENDENTE",
          acervoSnapshot: null,
        },
      ];

  for (let idx = 0; idx < itensParaRenderizar.length; idx++) {
    const item = itensParaRenderizar[idx];
    const identificacaoTexto = item.numeroMatricula
      ? `Matrícula nº ${item.numeroMatricula} (${item.livroDescricao || "Livro 2"})`
      : item.enderecoPesquisa
        ? `Endereço: ${item.enderecoPesquisa}`
        : item.transcricaoOuLoteamento
          ? `Transcrição/Loteamento: ${item.transcricaoOuLoteamento}`
          : `Critério: ${pedido.criterioSolicitacao}`;

    const linhasNat = quebrarTextoEmLinhas(
      item.naturezaDescricao,
      fontRegular,
      TAMANHO_FONTE_ITEM_FIXO_PT,
      190
    );
    const linhasIdent = quebrarTextoEmLinhas(
      identificacaoTexto,
      fontBold,
      TAMANHO_FONTE_ITEM_FIXO_PT,
      172
    );
    const maxLinhasItem = Math.max(linhasNat.length, linhasIdent.length);
    const alturaItemPt = maxLinhasItem * 11.5 + 7;

    // Se este item ultrapassar o limite seguro da página atual, abre Página de Continuação
    // mantendo EXATAMENTE o mesmo tamanho de fonte (jamais reduz fonte!).
    const ehUltimoItem = idx === itensParaRenderizar.length - 1;
    const limiteInferiorNecessario = ehUltimoItem
      ? Y_MINIMO_ITENS_COM_RODAPE
      : Y_MINIMO_PAGINA_CONTINUACAO;

    if (y - alturaItemPt < limiteInferiorNecessario) {
      usouContinuacaoItens = true;
      pageAtual.drawText(
        sanitizarTextoWinAnsi("(Continua na próxima página — fonte preservada)"),
        {
          x: margemX + larguraUtil - 205,
          y: 26,
          size: 7.5,
          font: fontRegular,
          color: rgb(0.35, 0.35, 0.4),
        }
      );

      pageAtual = pdfDoc.addPage([LARGURA_PAGINA_SIPLAN_PT, ALTURA_PAGINA_SIPLAN_PT]);
      paginasAdicionadas++;
      y = desenharCabecalhoOficial7RI({
        page: pageAtual,
        headerImg,
        fontRegular,
        fontBold,
        pedido,
        subtituloPagina: "CONTINUAÇÃO DOS ITENS",
        marcaReimpressao,
      });
      y = desenharCabecalhoTabelaItens(pageAtual, y);
    }

    pageAtual.drawRectangle({
      x: margemX,
      y: y - alturaItemPt,
      width: larguraUtil,
      height: alturaItemPt,
      borderColor: rgb(0.82, 0.84, 0.88),
      borderWidth: 0.45,
    });

    pageAtual.drawText(String(item.sequenciaItem).padStart(2, "0"), {
      x: margemX + 8,
      y: y - 12,
      size: TAMANHO_FONTE_ITEM_FIXO_PT,
      font: fontBold,
    });

    linhasNat.forEach((ln, lIdx) => {
      pageAtual.drawText(ln, {
        x: margemX + 38,
        y: y - 12 - lIdx * 11,
        size: TAMANHO_FONTE_ITEM_FIXO_PT,
        font: fontRegular,
      });
    });

    linhasIdent.forEach((ln, lIdx) => {
      pageAtual.drawText(ln, {
        x: margemX + 235,
        y: y - 12 - lIdx * 11,
        size: TAMANHO_FONTE_ITEM_FIXO_PT,
        font: fontBold,
      });
    });

    const entregaCurta = sanitizarTextoWinAnsi(
      `${item.meioEntregaCodigo || "M"} • ${item.dataPrevisaoBr || pedido.prazoPrevistoBr || "—"}`
    );
    pageAtual.drawText(entregaCurta, {
      x: margemX + 415,
      y: y - 12,
      size: 8,
      font: fontRegular,
    });

    y -= alturaItemPt;
  }

  // Caso após o último item não haja espaço suficiente para os blocos finais do recibo, abre nova página
  if (y < Y_MINIMO_ITENS_COM_RODAPE) {
    usouContinuacaoItens = true;
    pageAtual = pdfDoc.addPage([LARGURA_PAGINA_SIPLAN_PT, ALTURA_PAGINA_SIPLAN_PT]);
    paginasAdicionadas++;
    y = desenharCabecalhoOficial7RI({
      page: pageAtual,
      headerImg,
      fontRegular,
      fontBold,
      pedido,
      subtituloPagina: "DADOS FISCAIS RPS E ENCERRAMENTO",
      marcaReimpressao,
    });
  }

  y -= 10;

  // Bloco 3: Dados para Emissão de RPS / Nota Fiscal (Apresentante e Destinatário estritamente separados!)
  const apresNome = pedido.apresentante?.nome || pedido.requerente.nome;
  const apresDoc =
    pedido.apresentante?.documentoFormatado ||
    pedido.apresentante?.documentoMascarado ||
    reqDoc;
  const destNome = pedido.destinatarioNota?.nome || apresNome;
  const destDoc =
    pedido.destinatarioNota?.documentoFormatado ||
    pedido.destinatarioNota?.documentoMascarado ||
    apresDoc;

  const linhasApres = quebrarTextoEmLinhas(
    `Apresentante: ${apresNome} (${apresDoc})`,
    fontRegular,
    8.2,
    larguraUtil - 16
  );
  const linhasDest = quebrarTextoEmLinhas(
    `Destinatário da Nota (RPS): ${destNome} (${destDoc})`,
    fontRegular,
    8.2,
    larguraUtil - 16
  );
  const alturaRps = 18 + (linhasApres.length + linhasDest.length) * 10.5 + 6;

  pageAtual.drawRectangle({
    x: margemX,
    y: y - alturaRps,
    width: larguraUtil,
    height: alturaRps,
    borderColor: rgb(0.72, 0.75, 0.8),
    borderWidth: 0.6,
  });
  pageAtual.drawText(sanitizarTextoWinAnsi("DADOS PARA EMISSÃO DE RPS / NOTA FISCAL"), {
    x: margemX + 8,
    y: y - 12,
    size: 8,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.3),
  });

  let yRps = y - 24;
  linhasApres.forEach((ln) => {
    pageAtual.drawText(ln, { x: margemX + 8, y: yRps, size: 8.2, font: fontRegular });
    yRps -= 10.5;
  });
  linhasDest.forEach((ln) => {
    pageAtual.drawText(ln, { x: margemX + 8, y: yRps, size: 8.2, font: fontBold });
    yRps -= 10.5;
  });

  y -= alturaRps + 8;

  // Bloco 4: Observações e Prenotações em Contraditório (Provimento CNJ 134/2022 + WEBRI Contraditório)
  const prenotacoesContraditorio = obterPrenotacoesContraditorioDoPedido(pedido);
  const resumoPrenotacoesStr =
    prenotacoesContraditorio.length > 0
      ? ` | PRENOTAÇÃO EM CONTRADITÓRIO Nº ${prenotacoesContraditorio
        .map(
          (pr) =>
            `${pr.numeroPrenotacao} (${pr.tipoPrenotacaoDescricao || "PRENOTAÇÃO"} - ${pr.naturezaTitulo
            }${pr.livroContraditorio ? ` - ${pr.livroContraditorio}` : ""})`
        )
        .join("; ")}`
      : "";
  const textoObs = pedido.observacoesOrigem
    ? `Observações: ${pedido.observacoesOrigem}${resumoPrenotacoesStr}`
    : `Observações: Sem ressalvas adicionais no ato do protocolo.${resumoPrenotacoesStr}`;
  const linhasObs = quebrarTextoEmLinhas(textoObs, fontRegular, 8, larguraUtil - 16).slice(0, 3);
  const alturaObs = 8 + linhasObs.length * 10.5;

  pageAtual.drawRectangle({
    x: margemX,
    y: y - alturaObs,
    width: larguraUtil,
    height: alturaObs,
    borderColor: rgb(0.78, 0.8, 0.84),
    borderWidth: 0.5,
  });
  linhasObs.forEach((ln, idx) => {
    pageAtual.drawText(ln, {
      x: margemX + 8,
      y: y - 11 - idx * 10.5,
      size: 8,
      font: fontRegular,
    });
  });

  y -= alturaObs + 8;

  // Bloco 5: Aviso Legal Provimento CNJ nº 134/2022 (LGPD)
  const avisoLgpd =
    "AVISO DE PRIVACIDADE (Provimento CNJ nº 134/2022 e Lei nº 13.709/2018 - LGPD): Os dados pessoais coletados neste pedido destinam-se exclusivamente à prática dos atos registrais, emissão de certidões, controle fiscal (RPS) e cumprimento das normas da Corregedoria Geral da Justiça de São Paulo e do CNJ.";
  const linhasLgpd = quebrarTextoEmLinhas(avisoLgpd, fontRegular, 7.2, larguraUtil - 16);
  const alturaLgpd = 8 + linhasLgpd.length * 9.2;

  pageAtual.drawRectangle({
    x: margemX,
    y: y - alturaLgpd,
    width: larguraUtil,
    height: alturaLgpd,
    color: rgb(0.97, 0.97, 0.98),
    borderColor: rgb(0.8, 0.82, 0.86),
    borderWidth: 0.5,
  });
  linhasLgpd.forEach((ln, idx) => {
    pageAtual.drawText(ln, {
      x: margemX + 8,
      y: y - 10 - idx * 9.2,
      size: 7.2,
      font: fontRegular,
      color: rgb(0.25, 0.25, 0.3),
    });
  });

  y -= alturaLgpd + 10;

  // Bloco 6: Escrevente / Assinatura (esquerda) + Quadro de Valores Serviço / Despesa / Total Depósito (direita)
  const larguraAssinatura = 315;
  const larguraValores = larguraUtil - larguraAssinatura - 10;
  const alturaRodape = 64;
  const yRodapeBase = Math.max(34, y - alturaRodape);

  pageAtual.drawRectangle({
    x: margemX,
    y: yRodapeBase,
    width: larguraAssinatura,
    height: alturaRodape,
    borderColor: rgb(0.72, 0.75, 0.8),
    borderWidth: 0.6,
  });
  pageAtual.drawText(
    sanitizarTextoWinAnsi(`Escrevente / Recepção: ${pedido.escreventeRecepcao}`),
    {
      x: margemX + 8,
      y: yRodapeBase + alturaRodape - 14,
      size: 8.2,
      font: fontBold,
    }
  );
  pageAtual.drawLine({
    start: { x: margemX + 24, y: yRodapeBase + 18 },
    end: { x: margemX + larguraAssinatura - 24, y: yRodapeBase + 18 },
    thickness: 0.6,
    color: rgb(0.25, 0.25, 0.3),
  });
  pageAtual.drawText(sanitizarTextoWinAnsi("Assinatura do Apresentante / Solicitante"), {
    x: margemX + 76,
    y: yRodapeBase + 7,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.35),
  });

  const xVal = margemX + larguraAssinatura + 10;
  pageAtual.drawRectangle({
    x: xVal,
    y: yRodapeBase,
    width: larguraValores,
    height: alturaRodape,
    color: rgb(0.95, 0.96, 0.98),
    borderColor: rgb(0.65, 0.7, 0.76),
    borderWidth: 0.7,
  });

  const desenharLinhaValor = (rotulo: string, valorStr: string, yLinha: number, negrito: boolean) => {
    const f = negrito ? fontBold : fontRegular;
    const sz = negrito ? 9 : 8.3;
    pageAtual.drawText(sanitizarTextoWinAnsi(rotulo), { x: xVal + 8, y: yLinha, size: sz, font: f });
    const wV = f.widthOfTextAtSize(valorStr, sz);
    pageAtual.drawText(valorStr, {
      x: xVal + larguraValores - 8 - wV,
      y: yLinha,
      size: sz,
      font: f,
    });
  };

  desenharLinhaValor(
    "Valor Serviço:",
    formatarMoedaBrl(pedido.valores.valorServico),
    yRodapeBase + 46,
    false
  );
  desenharLinhaValor(
    "Despesas / Remessa:",
    formatarMoedaBrl(pedido.valores.valorDespesa),
    yRodapeBase + 30,
    false
  );
  pageAtual.drawLine({
    start: { x: xVal + 6, y: yRodapeBase + 22 },
    end: { x: xVal + larguraValores - 6, y: yRodapeBase + 22 },
    thickness: 0.6,
    color: rgb(0.55, 0.58, 0.64),
  });
  desenharLinhaValor(
    "Total Depósito:",
    formatarMoedaBrl(pedido.valores.totalDeposito),
    yRodapeBase + 8,
    true
  );

  // ── PÁGINA OPERACIONAL INTERNA (PÁGINA 2 DO MODELO SIPLAN: GRADE DE BUSCAS E CONTRADITÓRIO) ──
  const pageOperacional = pdfDoc.addPage([LARGURA_PAGINA_SIPLAN_PT, ALTURA_PAGINA_SIPLAN_PT]);
  paginasAdicionadas++;

  let yOp = desenharCabecalhoOficial7RI({
    page: pageOperacional,
    headerImg,
    fontRegular,
    fontBold,
    pedido,
    marcaReimpressao,
  });

  // Resumo técnico de conferência e acervo
  pageOperacional.drawRectangle({
    x: margemX,
    y: yOp - 48,
    width: larguraUtil,
    height: 48,
    borderColor: rgb(0.7, 0.74, 0.8),
    borderWidth: 0.6,
  });
  pageOperacional.drawText(
    sanitizarTextoWinAnsi(
      `Situação Operacional no FIORIX: ${pedido.estadoOperacionalLabel}   |   Prioridade: ${pedido.prioridade}`
    ),
    { x: margemX + 8, y: yOp - 15, size: 8.8, font: fontBold }
  );
  pageOperacional.drawText(
    sanitizarTextoWinAnsi(
      `Subtipo Confirmado: ${pedido.subtipoConfirmado || "Aguardando confirmação humana"}   |   Critério: ${pedido.criterioSolicitacao}`
    ),
    { x: margemX + 8, y: yOp - 29, size: 8.2, font: fontRegular }
  );
  pageOperacional.drawText(
    sanitizarTextoWinAnsi(
      `Hash Versão dos Dados-Fonte: ${pedido.versaoDadosFonteHash.slice(0, 28)}...`
    ),
    { x: margemX + 8, y: yOp - 42, size: 7.5, font: fontRegular, color: rgb(0.3, 0.3, 0.36) }
  );

  yOp -= 60;

  // Quadro do Contraditório (Prenotações em Tramitação / Ato em Processamento)
  const prenotacoes = obterPrenotacoesContraditorioDoPedido(pedido);
  const alturaContraditorio = Math.max(84, 34 + prenotacoes.length * 16);

  pageOperacional.drawRectangle({
    x: margemX,
    y: yOp - alturaContraditorio,
    width: larguraUtil,
    height: alturaContraditorio,
    borderColor: rgb(0.7, 0.74, 0.8),
    borderWidth: 0.6,
  });
  pageOperacional.drawRectangle({
    x: margemX,
    y: yOp - 18,
    width: larguraUtil,
    height: 18,
    color: rgb(0.92, 0.94, 0.97),
  });
  pageOperacional.drawText(
    sanitizarTextoWinAnsi(
      "RESULTADO DA CONSULTA AO CONTRADITÓRIO (tblWRIRecepcao / tblWRITitulos / tblWRICertidaoResultadoContraditorio)"
    ),
    { x: margemX + 8, y: yOp - 13, size: 7.8, font: fontBold }
  );

  if (prenotacoes.length === 0) {
    const statusContrad =
      pedido.ultimaConferencia?.contraditorioStatus === "NADA_CONSTA"
        ? "NADA CONSTA em tramitação para a(s) matrícula(s) conferida(s) nesta versão de dados."
        : "Consulta ao Contraditório pendente ou encaminhada à verificação manual da equipe.";
    pageOperacional.drawText(sanitizarTextoWinAnsi(statusContrad), {
      x: margemX + 8,
      y: yOp - 38,
      size: 8.5,
      font: fontRegular,
    });
  } else {
    let yP = yOp - 33;
    prenotacoes.slice(0, 12).forEach((p) => {
      const linhaPren = `Prenotação nº ${p.numeroPrenotacao} (${p.dataApresentacaoBr}) - ${p.tipoPrenotacaoDescricao ? `${p.tipoPrenotacaoDescricao} / ` : ""
        }${p.naturezaTitulo}${p.livroContraditorio ? ` - ${p.livroContraditorio}` : ""}${p.protocoloMagnetico ? ` - Prot. ${p.protocoloMagnetico}` : ""
        } [${p.emProcessamentoAtoNaMatricula ? "ATO EM PROCESSAMENTO - PAUSAR" : p.etapaAtual
        }]`;
      const truncSegura = quebrarTextoEmLinhas(linhaPren, fontRegular, 8, larguraUtil - 16)[0];
      pageOperacional.drawText(truncSegura, {
        x: margemX + 8,
        y: yP,
        size: 8,
        font: p.emProcessamentoAtoNaMatricula ? fontBold : fontRegular,
      });
      yP -= 15;
    });
  }

  yOp -= alturaContraditorio + 12;

  // Texto padrão sugerido de certificação de prenotação (se houver)
  if (pedido.ultimaConferencia?.textoCertidaoSugerido) {
    const linhasSug = quebrarTextoEmLinhas(
      pedido.ultimaConferencia.textoCertidaoSugerido,
      fontRegular,
      8,
      larguraUtil - 16
    );
    const altSug = 12 + linhasSug.length * 10.5;
    pageOperacional.drawRectangle({
      x: margemX,
      y: yOp - altSug,
      width: larguraUtil,
      height: altSug,
      color: rgb(0.97, 0.98, 0.95),
      borderColor: rgb(0.7, 0.78, 0.68),
      borderWidth: 0.6,
    });
    linhasSug.forEach((ln, i) => {
      pageOperacional.drawText(ln, {
        x: margemX + 8,
        y: yOp - 12 - i * 10.5,
        size: 8,
        font: fontRegular,
      });
    });
    yOp -= altSug + 12;
  }

  // Grade Operacional de Buscas / Anotações Salvas do Escrevente + Pauta Manual (fiel à Página 2 do SIPLAN)
  const alturaGrade = Math.max(140, yOp - 52);
  pageOperacional.drawRectangle({
    x: margemX,
    y: yOp - alturaGrade,
    width: larguraUtil,
    height: alturaGrade,
    borderColor: rgb(0.72, 0.75, 0.8),
    borderWidth: 0.6,
  });
  pageOperacional.drawRectangle({
    x: margemX,
    y: yOp - 18,
    width: larguraUtil,
    height: 18,
    color: rgb(0.92, 0.94, 0.97),
  });
  pageOperacional.drawText(
    sanitizarTextoWinAnsi(
      "CONTROLE INTERNO DE BUSCA, ANOTAÇÕES DO ESCREVENTE E CONFERÊNCIA HUMANA"
    ),
    { x: margemX + 8, y: yOp - 13, size: 8.2, font: fontBold }
  );

  let cursorYDentroGrade = yOp - 32;
  const limiteInferiorGrade = yOp - alturaGrade + 18;

  if (anotacoesSalvas && anotacoesSalvas.length > 0) {
    pageOperacional.drawText(
      sanitizarTextoWinAnsi(
        `ANOTAÇÕES SALVAS NO PEDIDO (${anotacoesSalvas.length} registro(s) permanentes no FIORIX):`
      ),
      {
        x: margemX + 8,
        y: cursorYDentroGrade,
        size: 7.8,
        font: fontBold,
        color: rgb(0.1, 0.25, 0.45),
      }
    );
    cursorYDentroGrade -= 13;

    for (const anot of anotacoesSalvas) {
      if (cursorYDentroGrade <= limiteInferiorGrade + 12) break;
      const cabecAnot = `[${anot.criadoEmBr} - ${anot.autorNome}${anot.versaoAtual ? ` - v${anot.versaoAtual}` : ""
        }] ${anot.titulo}:`;
      const linhasCabec = quebrarTextoEmLinhas(cabecAnot, fontBold, 7.8, larguraUtil - 18);
      for (const ln of linhasCabec) {
        if (cursorYDentroGrade <= limiteInferiorGrade) break;
        pageOperacional.drawText(ln, {
          x: margemX + 10,
          y: cursorYDentroGrade,
          size: 7.8,
          font: fontBold,
          color: rgb(0.12, 0.14, 0.18),
        });
        cursorYDentroGrade -= 10.5;
      }

      const linhasConteudo = quebrarTextoEmLinhas(
        anot.conteudoAtual,
        fontRegular,
        7.8,
        larguraUtil - 24
      );
      for (const ln of linhasConteudo) {
        if (cursorYDentroGrade <= limiteInferiorGrade) break;
        pageOperacional.drawText(ln, {
          x: margemX + 14,
          y: cursorYDentroGrade,
          size: 7.8,
          font: fontRegular,
          color: rgb(0.18, 0.2, 0.24),
        });
        cursorYDentroGrade -= 10.5;
      }
      cursorYDentroGrade -= 4;
    }
    cursorYDentroGrade -= 6;
  }

  // Linhas pautadas remanescentes para eventuais apontamentos físicos caso impressos pela equipe
  for (let linhaY = cursorYDentroGrade - 8; linhaY > limiteInferiorGrade; linhaY -= 22) {
    pageOperacional.drawLine({
      start: { x: margemX + 10, y: linhaY },
      end: { x: margemX + larguraUtil - 10, y: linhaY },
      thickness: 0.4,
      color: rgb(0.82, 0.84, 0.88),
    });
  }

  const paginasDestePedido = pdfDoc.getPages().slice(indicePrimeiraPaginaNoDoc);

  if (pedido.conferidoPeloEscrevente || pedido.devolvidoPeloEscrevente) {
    for (const pg of paginasDestePedido) {
      desenharMarcaDaguaConferidoDiagonal({
        page: pg,
        fontBold,
        tipo: pedido.conferidoPeloEscrevente ? "CONFERIDO" : "DEVOLVIDO",
        conferidoPorNome: pedido.conferidoPeloEscrevente
          ? pedido.conferidoPorNome
          : pedido.devolvidoPorNome,
        conferidoEmBr: pedido.conferidoPeloEscrevente
          ? pedido.conferidoEmBr
          : pedido.devolvidoEmBr,
      });
    }
  }

  if (pedido.marcacoesDocumento && pedido.marcacoesDocumento.length > 0) {
    desenharMarcacoesVisuaisNoPdf({
      paginasDestePedido,
      marcacoes: pedido.marcacoesDocumento,
      fontBold,
    });
  }

  return { paginasAdicionadas, usouContinuacaoItens };
}

const RGB_CORES_GRIFO: Record<CorGrifoDocumento, [number, number, number]> = {
  AMARELO: [0.99, 0.89, 0.18],
  VERDE: [0.29, 0.87, 0.5],
  AZUL: [0.22, 0.74, 0.97],
  ROSA: [0.96, 0.45, 0.71],
  LARANJA: [0.98, 0.57, 0.24],
  LILAS: [0.75, 0.52, 0.98],
};

const RGB_CORES_TEXTO: Record<CorTextoDocumento, [number, number, number]> = {
  PRETO: [0.06, 0.08, 0.12],
  AZUL_ESCURO: [0.05, 0.25, 0.62],
  VERMELHO: [0.74, 0.09, 0.14],
  VERDE_ESCURO: [0.04, 0.44, 0.26],
  ROXO: [0.42, 0.14, 0.66],
};

/**
 * Aplica os grifos coloridos (marca-texto) e textos adicionados pelo Escrevente
 * nas coordenadas exatas da folha SIPLAN 595 x 842 pt.
 */
function desenharMarcacoesVisuaisNoPdf(params: {
  paginasDestePedido: PDFPage[];
  marcacoes: MarcacaoVisualDocumentoPedido[];
  fontBold: PDFFont;
}): void {
  const { paginasDestePedido, marcacoes, fontBold } = params;
  if (paginasDestePedido.length === 0) return;

  for (const m of marcacoes) {
    const idxPag =
      m.pagina >= 2
        ? Math.min(paginasDestePedido.length - 1, m.pagina - 1)
        : 0;
    const page = paginasDestePedido[idxPag];
    if (!page) continue;

    const x = Math.max(8, Math.min(LARGURA_PAGINA_SIPLAN_PT - 20, Number(m.xPt) || 34));
    const yTopo = Math.max(8, Math.min(ALTURA_PAGINA_SIPLAN_PT - 14, Number(m.yTopoPt) || 60));
    const largura = Math.max(
      14,
      Math.min(LARGURA_PAGINA_SIPLAN_PT - x - 8, Number(m.larguraPt) || 120)
    );
    const altura = Math.max(
      10,
      Math.min(ALTURA_PAGINA_SIPLAN_PT - yTopo - 6, Number(m.alturaPt) || 16)
    );
    const yPdfBase = Math.max(8, ALTURA_PAGINA_SIPLAN_PT - yTopo - altura);

    if (m.tipo === "GRIFO") {
      const [r, g, b] = RGB_CORES_GRIFO[m.corGrifo || "AMARELO"] || RGB_CORES_GRIFO.AMARELO;
      page.drawRectangle({
        x,
        y: yPdfBase,
        width: largura,
        height: altura,
        color: rgb(r, g, b),
        opacity: 0.36,
      });
      continue;
    }

    if (m.tipo === "TEXTO" && m.texto && m.texto.trim()) {
      // Caso o Escrevente também tenha selecionado/grifado uma região ao inserir o texto
      if (m.corGrifo) {
        const [rg, gg, bg] = RGB_CORES_GRIFO[m.corGrifo] || RGB_CORES_GRIFO.AMARELO;
        page.drawRectangle({
          x,
          y: yPdfBase,
          width: largura,
          height: altura,
          color: rgb(rg, gg, bg),
          opacity: 0.24,
          borderColor: rgb(rg * 0.75, gg * 0.75, bg * 0.75),
          borderWidth: 0.6,
        });
      }

      const tamFonte = Math.max(7.5, Math.min(14, Number(m.tamanhoFontePt) || 9.5));
      const [rt, gt, bt] =
        RGB_CORES_TEXTO[m.corTexto || "AZUL_ESCURO"] || RGB_CORES_TEXTO.AZUL_ESCURO;
      const larguraMaxTexto = Math.max(110, Math.min(LARGURA_PAGINA_SIPLAN_PT - x - 14, Math.max(largura, 210)));

      const paragrafos = m.texto.split(/\r?\n/);
      const linhasFinais: string[] = [];
      for (const par of paragrafos) {
        if (!par.trim()) continue;
        linhasFinais.push(...quebrarTextoEmLinhas(par, fontBold, tamFonte, larguraMaxTexto - 8));
      }
      if (linhasFinais.length === 0) continue;

      const entrelinha = tamFonte + 2.4;
      const larguraMinDesejada = largura > 45 ? Math.min(larguraMaxTexto, largura) : 36;
      const larguraCaixaTexto = Math.min(
        larguraMaxTexto,
        Math.max(
          ...linhasFinais.map((ln) => fontBold.widthOfTextAtSize(ln, tamFonte) + 8),
          larguraMinDesejada
        )
      );
      const alturaCaixaTexto = Math.max(
        altura > 20 ? altura : 0,
        linhasFinais.length * entrelinha + 5
      );
      const yTopoTextoPdf = ALTURA_PAGINA_SIPLAN_PT - yTopo;
      const yCaixaBase = Math.max(8, yTopoTextoPdf - alturaCaixaTexto);

      page.drawRectangle({
        x,
        y: yCaixaBase,
        width: larguraCaixaTexto,
        height: alturaCaixaTexto,
        color: rgb(1, 1, 0.97),
        opacity: 0.9,
        borderColor: rgb(rt, gt, bt),
        borderWidth: 0.65,
      });

      linhasFinais.forEach((ln, idxLn) => {
        page.drawText(ln, {
          x: x + 4,
          y: yCaixaBase + alturaCaixaTexto - (idxLn + 1) * entrelinha + 1.5,
          size: tamFonte,
          font: fontBold,
          color: rgb(rt, gt, bt),
        });
      });
    }
  }
}

/**
 * Gera o PDF individual fiel ao modelo SIPLAN (595 x 842 pt) para um único pedido.
 */
export async function gerarPdfPedidoIndividualSiplan(
  pedido: PedidoCertidaoDetalheDTO,
  opcoes?: {
    marcaReimpressao?: string | null;
    anotacoesSalvas?: AnotacaoImpressaoPedido[];
    frenteEVersoPadrao?: boolean;
  }
): Promise<ResultadoPdfPedidoIndividual> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Pedido de Certidao nº ${pedido.numeroPedido} - 7º RI SP`);
  pdfDoc.setProducer("FIORIX Cartorio Virtual - Espelho Fiel SIPLAN");
  aplicarPreferenciasImpressaoDuplex(pdfDoc, opcoes?.frenteEVersoPadrao ?? true);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const headerBytes = Buffer.from(SIPLAN_7RI_HEADER_PNG_BASE64, "base64");
  const headerImg = await pdfDoc.embedPng(headerBytes);

  const info = await adicionarPaginasPedidoAoDoc({
    pdfDoc,
    headerImg,
    fontRegular,
    fontBold,
    pedido,
    marcaReimpressao: opcoes?.marcaReimpressao ?? null,
    anotacoesSalvas: opcoes?.anotacoesSalvas,
  });

  const pdfBytes = await pdfDoc.save();
  const sha256 = createHash("sha256").update(Buffer.from(pdfBytes)).digest("hex");

  return {
    pdfBytes,
    numeroPaginas: info.paginasAdicionadas,
    sha256,
    usouContinuacaoItens: info.usouContinuacaoItens,
    tamanhoFonteCorpoPt: TAMANHO_FONTE_CORPO_FIXO_PT,
  };
}

/**
 * Gera um lote completo de pedidos para a Central de Impressão:
 * - Preserva PDF original do WEBRI quando disponível em modo ORIGINAL_CONGELADO;
 * - Caso contrário, renderiza o espelho fiel 595 x 842 pt;
 * - Em modo Duplex (`duplexFrenteNovaFolha: true`), garante que sempre que um pedido tiver
 *   número ímpar de páginas (ex.: 3 páginas por continuação de itens) e houver próximo pedido,
 *   seja inserida uma página em branco 595 x 842 pt no verso para que o pedido seguinte
 *   comece fisicamente na FRENTE de uma nova folha!
 */
export async function gerarPdfLotePedidosSiplan(
  opcoes: OpcoesGeracaoLotePdfSiplan
): Promise<ResultadoPdfLoteSiplan> {
  const { pedidos, duplexFrenteNovaFolha, modoDados, marcaReimpressao } = opcoes;

  const loteDoc = await PDFDocument.create();
  loteDoc.setTitle(`Lote de Impressao de Pedidos de Certidao (${pedidos.length} pedidos)`);
  loteDoc.setProducer("FIORIX Cartorio Virtual - Central de Impressao");
  aplicarPreferenciasImpressaoDuplex(loteDoc, duplexFrenteNovaFolha !== false);

  const fontRegular = await loteDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await loteDoc.embedFont(StandardFonts.HelveticaBold);
  const headerBytes = Buffer.from(SIPLAN_7RI_HEADER_PNG_BASE64, "base64");
  const headerImg = await loteDoc.embedPng(headerBytes);

  let paginasBrancoDuplex = 0;
  const mapaPaginasPorPedido: MapaPaginaPedidoNoLote[] = [];

  for (let idx = 0; idx < pedidos.length; idx++) {
    const entrada = pedidos[idx];
    const paginaInicialNoLote = loteDoc.getPageCount() + 1;
    let paginasConteudo = 0;

    if (modoDados === "ORIGINAL_CONGELADO" && entrada.pdfOriginalWebriBase64) {
      const origBytes = Buffer.from(entrada.pdfOriginalWebriBase64, "base64");
      const origDoc = await PDFDocument.load(origBytes);
      const indices = origDoc.getPageIndices();
      const copiadas = await loteDoc.copyPages(origDoc, indices);
      for (const pg of copiadas) {
        if (
          entrada.pedido.conferidoPeloEscrevente ||
          entrada.pedido.devolvidoPeloEscrevente
        ) {
          desenharMarcaDaguaConferidoDiagonal({
            page: pg,
            fontBold,
            tipo: entrada.pedido.conferidoPeloEscrevente ? "CONFERIDO" : "DEVOLVIDO",
            conferidoPorNome: entrada.pedido.conferidoPeloEscrevente
              ? entrada.pedido.conferidoPorNome
              : entrada.pedido.devolvidoPorNome,
            conferidoEmBr: entrada.pedido.conferidoPeloEscrevente
              ? entrada.pedido.conferidoEmBr
              : entrada.pedido.devolvidoEmBr,
          });
        }
        loteDoc.addPage(pg);
        paginasConteudo++;
      }
    } else {
      const res = await adicionarPaginasPedidoAoDoc({
        pdfDoc: loteDoc,
        headerImg,
        fontRegular,
        fontBold,
        pedido: entrada.pedido,
        marcaReimpressao: marcaReimpressao ?? null,
        anotacoesSalvas: entrada.anotacoesSalvas,
      });
      paginasConteudo = res.paginasAdicionadas;
    }

    const paginaFinalConteudoNoLote = loteDoc.getPageCount();
    let inseriuPaginaBrancoDuplex = false;

    // Alinhamento físico de frente de folha no modo frente e verso (Seção 7):
    // se este pedido terminou em página ímpar e existe outro pedido após ele (ou para fechar a folha física),
    // insere o verso em branco 595 x 842 pt.
    const haProximoPedido = idx < pedidos.length - 1;
    if (duplexFrenteNovaFolha && paginasConteudo % 2 === 1 && haProximoPedido) {
      loteDoc.addPage([LARGURA_PAGINA_SIPLAN_PT, ALTURA_PAGINA_SIPLAN_PT]);
      paginasBrancoDuplex++;
      inseriuPaginaBrancoDuplex = true;
    }

    mapaPaginasPorPedido.push({
      pedidoId: entrada.pedido.id,
      numeroPedido: entrada.pedido.numeroPedido,
      paginaInicialNoLote,
      paginaFinalConteudoNoLote,
      paginasConteudo,
      inseriuPaginaBrancoDuplex,
    });
  }

  const pdfBytes = await loteDoc.save();
  const sha256 = createHash("sha256").update(Buffer.from(pdfBytes)).digest("hex");

  return {
    pdfBytes,
    totalPaginas: loteDoc.getPageCount(),
    paginasBrancoDuplex,
    sha256,
    mapaPaginasPorPedido,
  };
}


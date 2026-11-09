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
  formatarProtocoloPontoMilhar,
  gerarCodigoAcessoWebri,
  obterAtendentePedidoWebri,
  obterLinhasDadosDoPedidoWebri,
  obterObservacaoOriginalWebri,
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
 * Desenha um rótulo em negrito (ex: "Observações: ") seguido de texto regular com quebra automática
 * de linhas respeitando a largura máxima da página (1ª linha após o rótulo; demais linhas alinhadas à margem esquerda).
 */
function desenharRotuloETextoComQuebra(params: {
  page: PDFPage;
  rotulo: string;
  texto: string;
  x: number;
  yInicial: number;
  larguraMaxPt: number;
  fontBold: PDFFont;
  fontRegular: PDFFont;
  tamanhoFonte: number;
  alturaLinhaPt: number;
}): number {
  const {
    page,
    rotulo,
    texto,
    x,
    yInicial,
    larguraMaxPt,
    fontBold,
    fontRegular,
    tamanhoFonte,
    alturaLinhaPt,
  } = params;

  const rotuloWin = sanitizarTextoWinAnsi(rotulo);
  const wRotulo = fontBold.widthOfTextAtSize(rotuloWin, tamanhoFonte);
  let y = yInicial;

  page.drawText(rotuloWin, {
    x,
    y,
    size: tamanhoFonte,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  const paragrafos = String(texto || "—")
    .replace(/\r\n/g, "\n")
    .split("\n");

  let primeiraLinhaGlobal = true;

  for (const paragrafoBruto of paragrafos) {
    const paragrafo = sanitizarTextoWinAnsi(paragrafoBruto).trim();
    const palavras = (paragrafo || "—").split(/\s+/);
    let linhaAtual = "";
    let larguraDisponivel = primeiraLinhaGlobal
      ? Math.max(80, larguraMaxPt - wRotulo)
      : larguraMaxPt;

    for (const palavra of palavras) {
      const candidata = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
      if (fontRegular.widthOfTextAtSize(candidata, tamanhoFonte) <= larguraDisponivel) {
        linhaAtual = candidata;
      } else if (!linhaAtual) {
        let pedaco = "";
        for (const ch of palavra) {
          if (fontRegular.widthOfTextAtSize(pedaco + ch, tamanhoFonte) <= larguraDisponivel) {
            pedaco += ch;
          } else {
            if (pedaco) {
              page.drawText(pedaco, {
                x: primeiraLinhaGlobal ? x + wRotulo : x,
                y,
                size: tamanhoFonte,
                font: fontRegular,
                color: rgb(0, 0, 0),
              });
              y -= alturaLinhaPt;
              primeiraLinhaGlobal = false;
              larguraDisponivel = larguraMaxPt;
            }
            pedaco = ch;
          }
        }
        linhaAtual = pedaco;
      } else {
        page.drawText(linhaAtual, {
          x: primeiraLinhaGlobal ? x + wRotulo : x,
          y,
          size: tamanhoFonte,
          font: fontRegular,
          color: rgb(0, 0, 0),
        });
        y -= alturaLinhaPt;
        primeiraLinhaGlobal = false;
        larguraDisponivel = larguraMaxPt;
        linhaAtual = palavra;
      }
    }

    if (linhaAtual) {
      page.drawText(linhaAtual, {
        x: primeiraLinhaGlobal ? x + wRotulo : x,
        y,
        size: tamanhoFonte,
        font: fontRegular,
        color: rgb(0, 0, 0),
      });
      y -= alturaLinhaPt;
      primeiraLinhaGlobal = false;
    }
  }

  return y;
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

function desenharCabecalhoOficialWebriFrente(params: {
  page: PDFPage;
  headerImg: PDFImage;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  fontBoldItalic: PDFFont;
  pedido: PedidoCertidaoDetalheDTO;
  subtituloPagina?: string;
  marcaReimpressao?: string | null;
}): number {
  const {
    page,
    headerImg,
    fontBold,
    fontBoldItalic,
    pedido,
    subtituloPagina,
    marcaReimpressao,
  } = params;
  const margemX = 34;
  const larguraUtil = LARGURA_PAGINA_SIPLAN_PT - margemX * 2;

  // 1. Logotipo Oficial 7º RI-SP centralizado no topo (proporção 1042x242)
  const imgLargura = 355;
  const imgAltura = Math.round((242 / 1042) * imgLargura); // ~82 pt
  const yTopo = ALTURA_PAGINA_SIPLAN_PT - 24;
  const xImgCentro = (LARGURA_PAGINA_SIPLAN_PT - imgLargura) / 2;

  page.drawImage(headerImg, {
    x: xImgCentro,
    y: yTopo - imgAltura,
    width: imgLargura,
    height: imgAltura,
  });

  if (marcaReimpressao) {
    const txtReimp = sanitizarTextoWinAnsi(marcaReimpressao);
    const wReimp = fontBold.widthOfTextAtSize(txtReimp, 7);
    page.drawText(txtReimp, {
      x: LARGURA_PAGINA_SIPLAN_PT - margemX - wReimp,
      y: yTopo - 10,
      size: 7,
      font: fontBold,
      color: rgb(0.55, 0.15, 0.15),
    });
  }

  // 2. Código de Barras Code 39 + Protocolo ONR lado a lado centralizados abaixo do logotipo
  const yTopoBarra = yTopo - imgAltura - 4;
  const txtOnr = pedido.protocoloExterno
    ? sanitizarTextoWinAnsi(pedido.protocoloExterno)
    : "";
  const tamOnr = 15.5;
  const wOnr = txtOnr ? fontBold.widthOfTextAtSize(txtOnr, tamOnr) : 0;

  // Calcula largura da barra Code 39 para centralizar o conjunto (Barra + Protocolo ONR)
  const limpoCod = String(pedido.numeroPedido || "0")
    .toUpperCase()
    .replace(/[^0-9A-Z\-.\s$/+%]/g, "");
  const textoCodificado = `*${limpoCod || "0"}*`;
  const modEstreito = 1.08;
  const modLargo = modEstreito * 2.4;
  let wBarra = 0;
  for (let idx = 0; idx < textoCodificado.length; idx++) {
    const padrao = CODE39_PATTERNS[textoCodificado[idx]] || CODE39_PATTERNS["0"];
    for (let i = 0; i < padrao.length; i++) {
      wBarra += padrao[i] === "w" ? modLargo : modEstreito;
    }
    if (idx < textoCodificado.length - 1) wBarra += modEstreito;
  }

  const gapBarraOnr = txtOnr ? 10 : 0;
  const larguraConjunto = wBarra + gapBarraOnr + wOnr;
  const xInicioConjunto = (LARGURA_PAGINA_SIPLAN_PT - larguraConjunto) / 2;

  desenharCodigoBarrasCode39({
    page,
    valorProtocolo: pedido.numeroPedido,
    xDireita: xInicioConjunto + wBarra,
    yTopo: yTopoBarra,
    alturaBarraPt: 27,
    moduloEstreitoPt: modEstreito,
  });

  if (txtOnr) {
    page.drawText(txtOnr, {
      x: xInicioConjunto + wBarra + gapBarraOnr,
      y: yTopoBarra - 24,
      size: tamOnr,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
  }

  let yCursor = yTopoBarra - 44;

  // 3. PROTOCOLO Nº 1.321.013 (alinhado à esquerda)
  const protocoloFormatado = sanitizarTextoWinAnsi(
    formatarProtocoloPontoMilhar(pedido.numeroPedido)
  );
  const txtProtLabel = sanitizarTextoWinAnsi("PROTOCOLO Nº ") || "PROTOCOLO Nº ";
  const tamProtLabel = 14;
  const tamProtNum = 19;
  const wProtLabel = fontBold.widthOfTextAtSize(txtProtLabel, tamProtLabel);

  page.drawText(txtProtLabel, {
    x: margemX,
    y: yCursor,
    size: tamProtLabel,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  page.drawText(protocoloFormatado, {
    x: margemX + wProtLabel,
    y: yCursor - 0.5,
    size: tamProtNum,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  if (subtituloPagina) {
    const subWin = sanitizarTextoWinAnsi(`(${subtituloPagina})`);
    page.drawText(subWin, {
      x: margemX + wProtLabel + fontBold.widthOfTextAtSize(protocoloFormatado, tamProtNum) + 10,
      y: yCursor + 1,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.25),
    });
  }

  yCursor -= 18;

  // 4. Atendente: Anne (negrito, itálico e sublinhado)
  const atendenteStr = sanitizarTextoWinAnsi(
    `Atendente: ${obterAtendentePedidoWebri(pedido)}`
  );
  const tamAtend = 9;
  const wAtend = fontBoldItalic.widthOfTextAtSize(atendenteStr, tamAtend);
  page.drawText(atendenteStr, {
    x: margemX,
    y: yCursor,
    size: tamAtend,
    font: fontBoldItalic,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: margemX, y: yCursor - 1.5 },
    end: { x: margemX + wAtend, y: yCursor - 1.5 },
    thickness: 0.65,
    color: rgb(0, 0, 0),
  });

  yCursor -= 18;

  // 5. Realizado em: 28/09/2026, depósito: R$ 76,54, Retirar em: 05/10/2026
  const valorDepositoNum =
    pedido.valores.totalDeposito > 0
      ? pedido.valores.totalDeposito
      : pedido.valores.valorServico;
  const valorDepositoBrl = sanitizarTextoWinAnsi(formatarMoedaBrl(valorDepositoNum));
  const retirarEmBr = sanitizarTextoWinAnsi(
    pedido.prazoPrevistoBr ||
      pedido.itens[0]?.dataPrevisaoBr ||
      pedido.dataPedidoBr
  );

  const parte1 = sanitizarTextoWinAnsi(
    `Realizado em: ${pedido.dataPedidoBr}, depósito: `
  );
  const parte2 = `${valorDepositoBrl}, `;
  const parte3 = "Retirar em: ";
  const parte4 = retirarEmBr;

  let xR = margemX;
  page.drawText(parte1, {
    x: xR,
    y: yCursor,
    size: 8.2,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  xR += fontBold.widthOfTextAtSize(parte1, 8.2);

  page.drawText(parte2, {
    x: xR,
    y: yCursor - 0.5,
    size: 11.2,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  xR += fontBold.widthOfTextAtSize(parte2, 11.2);

  page.drawText(parte3, {
    x: xR,
    y: yCursor,
    size: 8.2,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  xR += fontBold.widthOfTextAtSize(parte3, 8.2);

  page.drawText(parte4, {
    x: xR,
    y: yCursor - 0.5,
    size: 13,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  return yCursor - 24;
}

/**
 * Renderiza um pedido individual no documento `pdfDoc` alvo (Espelho 100% Idêntico ao WEBRI: Frente + Verso),
 * retornando quantas páginas foram adicionadas e se houve abertura de página(s) de continuação de itens.
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
  } = params;
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  const margemX = 34;
  const larguraUtil = LARGURA_PAGINA_SIPLAN_PT - margemX * 2; // 527 pt
  const indicePrimeiraPaginaNoDoc = pdfDoc.getPageCount();
  let paginasAdicionadas = 0;
  let usouContinuacaoItens = false;

  const reqDocBruto =
    pedido.requerente.documentoFormatado ||
    pedido.requerente.documentoMascarado ||
    "Não informado";
  const reqDocDigitos = reqDocBruto.replace(/\D/g, "");
  const reqDocWebri = reqDocDigitos.length >= 11 ? reqDocDigitos : reqDocBruto;
  const foneWebri = (pedido.requerente.telefone || "").trim() || "Não informado";
  const emailWebri = (pedido.requerente.email || "").trim() || "Não informado";
  const protocoloFormatado = sanitizarTextoWinAnsi(
    formatarProtocoloPontoMilhar(pedido.numeroPedido)
  );
  const valorDepositoNum =
    pedido.valores.totalDeposito > 0
      ? pedido.valores.totalDeposito
      : pedido.valores.valorServico;
  const valorDepositoBrl = sanitizarTextoWinAnsi(formatarMoedaBrl(valorDepositoNum));
  const obsOriginalWebri = sanitizarTextoWinAnsi(
    obterObservacaoOriginalWebri(pedido) || "—"
  );
  const prenotacoesContraditorio = obterPrenotacoesContraditorioDoPedido(pedido);

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — FRENTE DO MODELO OFICIAL WEBRI (SEMPRE COM O LOGOTIPO)
  // ═══════════════════════════════════════════════════════════════════════════
  let pageAtual = pdfDoc.addPage([LARGURA_PAGINA_SIPLAN_PT, ALTURA_PAGINA_SIPLAN_PT]);
  paginasAdicionadas++;

  let y = desenharCabecalhoOficialWebriFrente({
    page: pageAtual,
    headerImg,
    fontRegular,
    fontBold,
    fontBoldItalic,
    pedido,
    marcaReimpressao,
  });

  // 6. REQUERENTE & CONTATO (com quebra de linhas automática dentro da margem)
  y = desenharRotuloETextoComQuebra({
    page: pageAtual,
    rotulo: "REQUERENTE: ",
    texto: `${pedido.requerente.nome} - CPF : ${reqDocWebri} - WhatsApp : ${foneWebri}`,
    x: margemX,
    yInicial: y,
    larguraMaxPt: larguraUtil,
    fontBold,
    fontRegular,
    tamanhoFonte: 9,
    alturaLinhaPt: 12,
  });

  y -= 4;
  y = desenharRotuloETextoComQuebra({
    page: pageAtual,
    rotulo: "CONTATO: ",
    texto: `${pedido.requerente.nome} - WhatsApp : ${foneWebri} - e-mail: ${emailWebri}`,
    x: margemX,
    yInicial: y,
    larguraMaxPt: larguraUtil,
    fontBold,
    fontRegular,
    tamanhoFonte: 9,
    alturaLinhaPt: 12,
  });

  y -= 10;

  // 7. DISCRIMINAÇÃO DOS SERVIÇOS SOLICITADOS: (centralizado, negrito, itálico e sublinhado)
  const txtDiscrim =
    sanitizarTextoWinAnsi("DISCRIMINAÇÃO DOS SERVIÇOS SOLICITADOS:") ||
    "DISCRIMINACAO DOS SERVICOS SOLICITADOS:";
  const tamDiscrim = 10.5;
  const wDiscrim = fontBoldItalic.widthOfTextAtSize(txtDiscrim, tamDiscrim);
  const xDiscrim = margemX + (larguraUtil - wDiscrim) / 2;
  pageAtual.drawText(txtDiscrim, {
    x: xDiscrim,
    y,
    size: tamDiscrim,
    font: fontBoldItalic,
    color: rgb(0, 0, 0),
  });
  pageAtual.drawLine({
    start: { x: xDiscrim, y: y - 1.5 },
    end: { x: xDiscrim + wDiscrim, y: y - 1.5 },
    thickness: 0.75,
    color: rgb(0, 0, 0),
  });

  y -= 22;

  // 8. DADOS DO PEDIDO: (sublinhado e negrito)
  const txtDadosPed = "DADOS DO PEDIDO:";
  const tamDadosPed = 9;
  const wDadosPed = fontBold.widthOfTextAtSize(txtDadosPed, tamDadosPed);
  pageAtual.drawText(txtDadosPed, {
    x: margemX,
    y,
    size: tamDadosPed,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  pageAtual.drawLine({
    start: { x: margemX, y: y - 1.5 },
    end: { x: margemX + wDadosPed, y: y - 1.5 },
    thickness: 0.65,
    color: rgb(0, 0, 0),
  });

  y -= 15;

  // Linhas de Itens (ex: "1.Incluido por meio Magnetico (M) - Matrícula livro n. 150053")
  const linhasItensWebri = obterLinhasDadosDoPedidoWebri(pedido);
  const Y_MINIMO_PARA_GRADE_FRENTE = 290;

  for (let idx = 0; idx < linhasItensWebri.length; idx++) {
    const itemW = linhasItensWebri[idx];
    const quebradasItem = quebrarTextoEmLinhas(
      itemW.textoCompletoPlano,
      fontBold,
      10,
      larguraUtil
    );
    const altNecessaria = quebradasItem.length * 13;

    if (y - altNecessaria < Y_MINIMO_PARA_GRADE_FRENTE && idx < linhasItensWebri.length - 1) {
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
      y = desenharCabecalhoOficialWebriFrente({
        page: pageAtual,
        headerImg,
        fontRegular,
        fontBold,
        fontBoldItalic,
        pedido,
        subtituloPagina: "CONTINUAÇÃO DOS ITENS",
        marcaReimpressao,
      });
    }

    for (const lnIt of quebradasItem) {
      pageAtual.drawText(lnIt, {
        x: margemX,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
      y -= 13;
    }
  }

  y -= 2;

  // Observação do WEBRI / ONR + Alerta FIORIX (somente na Frente, abaixo de DADOS DO PEDIDO, com quebra de linhas)
  y = desenharRotuloETextoComQuebra({
    page: pageAtual,
    rotulo: "Observações: ",
    texto: obsOriginalWebri,
    x: margemX,
    yInicial: y,
    larguraMaxPt: larguraUtil,
    fontBold,
    fontRegular,
    tamanhoFonte: 8.8,
    alturaLinhaPt: 11.5,
  });

  if (prenotacoesContraditorio.length > 0) {
    const numsPren = prenotacoesContraditorio
      .map((pr) => `nº ${pr.numeroPrenotacao}`)
      .join(", ");
    const txtAlertaFiorix = sanitizarTextoWinAnsi(
      `Alerta FIORIX (Prenotações relacionadas a esta matrícula): ${numsPren}`
    );
    const linhasAlerta = quebrarTextoEmLinhas(
      txtAlertaFiorix,
      fontBold,
      8.5,
      larguraUtil - 12
    );
    const maxWLinhaAlerta = Math.max(
      ...linhasAlerta.map((ln) => fontBold.widthOfTextAtSize(ln, 8.5))
    );
    const wAlerta = Math.min(larguraUtil, maxWLinhaAlerta + 12);
    const altCaixaAlerta = linhasAlerta.length * 11 + 4;

    pageAtual.drawRectangle({
      x: margemX,
      y: y - (linhasAlerta.length - 1) * 11 - 3,
      width: wAlerta,
      height: altCaixaAlerta,
      color: rgb(1, 0.98, 0.92),
      borderColor: rgb(0.7, 0.4, 0.08),
      borderWidth: 0.6,
    });
    for (const lnAlerta of linhasAlerta) {
      pageAtual.drawText(lnAlerta, {
        x: margemX + 5,
        y,
        size: 8.5,
        font: fontBold,
        color: rgb(0.32, 0.12, 0.02),
      });
      y -= 11;
    }
    y -= 5;
  }

  // 9. GRADE OFICIAL DE BUSCA E QUALIFICAÇÃO DO WEBRI (ancorada na metade inferior da Frente)
  const yTopoGrade = Math.min(y - 12, 438);
  const xMeioGrade = margemX + larguraUtil / 2;

  // Linha superior da grade
  pageAtual.drawLine({
    start: { x: margemX, y: yTopoGrade },
    end: { x: margemX + larguraUtil, y: yTopoGrade },
    thickness: 0.9,
    color: rgb(0, 0, 0),
  });

  // Linha 1: AQUISIÇÃO: | PROPRIETÁRIO:
  const yBaseL1 = yTopoGrade - 32;
  pageAtual.drawText(sanitizarTextoWinAnsi("AQUISIÇÃO:"), {
    x: margemX + 1,
    y: yTopoGrade - 9,
    size: 7.2,
    font: fontBold,
  });
  pageAtual.drawLine({
    start: { x: xMeioGrade, y: yTopoGrade },
    end: { x: xMeioGrade, y: yBaseL1 },
    thickness: 0.9,
    color: rgb(0, 0, 0),
  });
  pageAtual.drawText(sanitizarTextoWinAnsi("PROPRIETÁRIO:"), {
    x: xMeioGrade + 4,
    y: yTopoGrade - 9,
    size: 7.2,
    font: fontBold,
  });
  pageAtual.drawLine({
    start: { x: margemX, y: yBaseL1 },
    end: { x: margemX + larguraUtil, y: yBaseL1 },
    thickness: 1.3,
    color: rgb(0, 0, 0),
  });

  // Linhas 2 a 5: TRANSMISSÃO, HIPOTECA DEVEDOR, R.D, INSCR./LOTEAMENTO
  const rotulosLinhasGrade = [
    "TRANSMISSÃO:",
    "HIPOTECA DEVEDOR:",
    "R.D:",
    "INSCR./LOTEAMENTO:",
  ];
  let yCursorGrade = yBaseL1;
  for (const rot of rotulosLinhasGrade) {
    pageAtual.drawText(sanitizarTextoWinAnsi(rot), {
      x: margemX + 1,
      y: yCursorGrade - 9,
      size: 7.2,
      font: fontBold,
    });
    yCursorGrade -= 29;
    pageAtual.drawLine({
      start: { x: margemX, y: yCursorGrade },
      end: { x: margemX + larguraUtil, y: yCursorGrade },
      thickness: 0.85,
      color: rgb(0, 0, 0),
    });
  }

  // Linha 6: LAVRATURA | BUSCA / CONFERÊNCIA
  const yTopoLavratura = yCursorGrade;
  const yBaseLavratura = yTopoLavratura - 62;
  pageAtual.drawLine({
    start: { x: xMeioGrade, y: yTopoLavratura },
    end: { x: xMeioGrade, y: yBaseLavratura },
    thickness: 0.9,
    color: rgb(0, 0, 0),
  });
  pageAtual.drawText(
    "LAVRATURA: .................................................",
    {
      x: margemX + 1,
      y: yBaseLavratura + 22,
      size: 8.5,
      font: fontBold,
    }
  );
  pageAtual.drawText(
    sanitizarTextoWinAnsi("BUSCA / CONFERÊNCIA: ....................................."),
    {
      x: xMeioGrade + 4,
      y: yBaseLavratura + 22,
      size: 8.5,
      font: fontBold,
    }
  );
  pageAtual.drawLine({
    start: { x: margemX, y: yBaseLavratura },
    end: { x: margemX + larguraUtil, y: yBaseLavratura },
    thickness: 0.9,
    color: rgb(0, 0, 0),
  });

  // 10. Faixa Inferior de Asteriscos da Frente
  const yAsterisco1 = yBaseLavratura - 28;
  const linhaAsteriscos = "*".repeat(124);
  const wAst = fontBold.widthOfTextAtSize(linhaAsteriscos, 7.2);
  const xAst = margemX + (larguraUtil - wAst) / 2;

  pageAtual.drawText(linhaAsteriscos, {
    x: xAst,
    y: yAsterisco1,
    size: 7.2,
    font: fontBold,
  });

  const txtConfira =
    "CONFIRA O SEU PEDIDO e o numero do seu WhatsApp e ASSINE NO VERSO DESTA FOLHA";
  const txtConfiraWin =
    sanitizarTextoWinAnsi(
      "CONFIRA O SEU PEDIDO e o número do seu WhatsApp e ASSINE NO VERSO DESTA FOLHA"
    ) || txtConfira;
  const wConf = fontBold.widthOfTextAtSize(txtConfiraWin, 9.6);
  pageAtual.drawText(txtConfiraWin, {
    x: margemX + (larguraUtil - wConf) / 2,
    y: yAsterisco1 - 13,
    size: 9.6,
    font: fontBold,
  });

  pageAtual.drawText(linhaAsteriscos, {
    x: xAst,
    y: yAsterisco1 - 24,
    size: 7.2,
    font: fontBold,
  });

  pageAtual.drawLine({
    start: { x: margemX, y: yAsterisco1 - 36 },
    end: { x: margemX + larguraUtil, y: yAsterisco1 - 36 },
    thickness: 0.9,
    color: rgb(0, 0, 0),
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA 2 — VERSO DO MODELO OFICIAL WEBRI (RPS + LGPD + ASSINATURA)
  // ═══════════════════════════════════════════════════════════════════════════
  const pageVerso = pdfDoc.addPage([LARGURA_PAGINA_SIPLAN_PT, ALTURA_PAGINA_SIPLAN_PT]);
  paginasAdicionadas++;

  let yV = ALTURA_PAGINA_SIPLAN_PT - 28;

  // 1. Quadro Superior de Consulta de RPS
  const altTopoRps = 48;
  const altNotaRps = 13;
  const altTotalRps = altTopoRps + altNotaRps;
  const largColEsqRps = 230;

  pageVerso.drawRectangle({
    x: margemX,
    y: yV - altTotalRps,
    width: larguraUtil,
    height: altTotalRps,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.85,
  });
  pageVerso.drawLine({
    start: { x: margemX + largColEsqRps, y: yV },
    end: { x: margemX + largColEsqRps, y: yV - altTopoRps },
    thickness: 0.85,
    color: rgb(0, 0, 0),
  });
  pageVerso.drawLine({
    start: { x: margemX, y: yV - altTopoRps },
    end: { x: margemX + larguraUtil, y: yV - altTopoRps },
    thickness: 0.85,
    color: rgb(0, 0, 0),
  });

  const desenharCentroColEsq = (txt: string, yPos: number, f: PDFFont, sz: number) => {
    const limpo = sanitizarTextoWinAnsi(txt);
    const w = f.widthOfTextAtSize(limpo, sz);
    pageVerso.drawText(limpo, {
      x: margemX + (largColEsqRps - w) / 2,
      y: yPos,
      size: sz,
      font: f,
    });
  };

  desenharCentroColEsq("Consulta de RPS", yV - 11, fontBold, 8.2);
  desenharCentroColEsq("(Recibo Provisório de Serviços)", yV - 21, fontBold, 8.2);
  desenharCentroColEsq("https://nfe.prefeitura.sp.gov.br/rps.aspx", yV - 33, fontRegular, 7.8);
  desenharCentroColEsq("http://7risp.com.br/ri-consulta.aspx?mod=03", yV - 43, fontRegular, 7.8);

  const xColDirRps = margemX + largColEsqRps + 6;
  const numRpsExibicao = String(pedido.webriMeta?.numRps || pedido.numeroPedido);
  pageVerso.drawText(
    sanitizarTextoWinAnsi("CNPJ/CPF do Prestador de Serviços: 45.585.700/0001-23 / 154.901.578-87"),
    { x: xColDirRps, y: yV - 12, size: 7.8, font: fontBold }
  );
  const lblNumRps = sanitizarTextoWinAnsi("*Número do RPS: ");
  const wLblRps = fontBold.widthOfTextAtSize(lblNumRps, 8.2);
  pageVerso.drawText(lblNumRps, {
    x: xColDirRps,
    y: yV - 27,
    size: 8.2,
    font: fontBold,
  });
  pageVerso.drawText(sanitizarTextoWinAnsi(`Nº ${numRpsExibicao}`), {
    x: xColDirRps + wLblRps,
    y: yV - 27.5,
    size: 11,
    font: fontBold,
  });
  pageVerso.drawText(
    sanitizarTextoWinAnsi(`CNPJ/CPF do Tomador de Serviços: ${reqDocWebri}`),
    { x: xColDirRps, y: yV - 42, size: 7.8, font: fontBold }
  );

  pageVerso.drawText(
    sanitizarTextoWinAnsi(
      '*Este R.P.S será convertido em NF-e até o "décimo dia" subsequente a sua emissão, conforme Lei Municipal.'
    ),
    { x: margemX + 4, y: yV - altTotalRps + 3.5, size: 7.2, font: fontRegular }
  );

  yV -= altTotalRps + 18;

  // 2. Bloco Central de Protocolo, Horário, Acompanhamento e Código de Acesso
  const txtEntregue = sanitizarTextoWinAnsi(
    "Certidão somente será entregue mediante apresentação deste protocolo n ° "
  );
  const wEnt = fontRegular.widthOfTextAtSize(txtEntregue, 8.6);
  const wProtV = fontBold.widthOfTextAtSize(protocoloFormatado, 12.2);
  const xInicioEnt = margemX + (larguraUtil - (wEnt + wProtV)) / 2;
  pageVerso.drawText(txtEntregue, {
    x: xInicioEnt,
    y: yV,
    size: 8.6,
    font: fontRegular,
  });
  pageVerso.drawText(protocoloFormatado, {
    x: xInicioEnt + wEnt,
    y: yV - 0.5,
    size: 12.2,
    font: fontBold,
  });
  yV -= 13;

  const desenharLinhaCentralVerso = (txt: string, sz = 8.4) => {
    const limpo = sanitizarTextoWinAnsi(txt);
    const w = fontRegular.widthOfTextAtSize(limpo, sz);
    pageVerso.drawText(limpo, {
      x: margemX + (larguraUtil - w) / 2,
      y: yV,
      size: sz,
      font: fontRegular,
    });
    yV -= 12;
  };

  desenharLinhaCentralVerso("Horário de atendimento: 09h00 às 16h00");
  desenharLinhaCentralVerso("Acompanhe seu pedido: www.7risp.com.br/ri-consulta.aspx?mod=02");
  desenharLinhaCentralVerso(`Código de acesso: ${gerarCodigoAcessoWebri(pedido)}`);

  yV -= 4;

  // 3. Atendimento eletrônico, Agendamento e Fundamentação legal
  pageVerso.drawText(
    sanitizarTextoWinAnsi('Atendimento eletrônico: (11) 3218-0527 - opção "3"'),
    { x: margemX, y: yV, size: 8.4, font: fontRegular }
  );
  yV -= 12;
  pageVerso.drawText("Agendamento on-line: http://agendamento.7risp.com.br", {
    x: margemX,
    y: yV,
    size: 8.4,
    font: fontRegular,
  });
  yV -= 14;

  const lblFund = sanitizarTextoWinAnsi("Fundamentação legal: ");
  const wFund = fontBold.widthOfTextAtSize(lblFund, 8.4);
  pageVerso.drawText(lblFund, { x: margemX, y: yV, size: 8.4, font: fontBold });
  pageVerso.drawText(
    sanitizarTextoWinAnsi("Itens 144 e 144.1 do Cap. XIII das NSCGJ (Provimento CGJ nº 23/2020)."),
    { x: margemX + wFund, y: yV, size: 8.4, font: fontRegular }
  );
  yV -= 18;

  // 4. Detalhamento da motivação (Provimento CNJ nº 134/2022 / LGPD)
  pageVerso.drawText(sanitizarTextoWinAnsi("Detalhamento da motivação:"), {
    x: margemX,
    y: yV,
    size: 8.6,
    font: fontBold,
  });
  yV -= 12;

  const bulletsItalicos = [
    '- "Qualquer pessoa pode requerer certidão do registro sem informar ao oficial ou ao funcionário o motivo ou interesse do pedido." (art. 17 da Lei nº 6.015/73 - LRP)',
    "- Nos casos em que a certidão for requerida por pesquisa a indicadores pessoal ou real com a finalidade de localizar bens e direitos inscritos em nome de determinada pessoa física ou jurídica, bem como o inteiro teor de matrícula com a mesma finalidade e também para fins de instruir processos judiciais, administrativos, negócios jurídicos, dentre outros, a sua emissão depende de identificação do requerente e a indicação da finalidade (motivação), nos termos dos arts. 16 e 19 do Provimento CNJ nº 134/2022 e da Lei nº 13.709/2018 (LGPD).",
    "- Ressalvadas as hipóteses previstas no art. 4º da LGPD, o requerente declara, sob as penas da lei, que os dados constantes na certidão ora solicitada serão utilizados exclusivamente para a finalidade (motivação) abaixo indicada (art. 7º da LGPD):",
  ];

  for (const bTxt of bulletsItalicos) {
    const linhasB = quebrarTextoEmLinhas(bTxt, fontItalic, 7.8, larguraUtil - 14);
    for (const ln of linhasB) {
      pageVerso.drawText(ln, {
        x: margemX + 10,
        y: yV,
        size: 7.8,
        font: fontItalic,
      });
      yV -= 10;
    }
    yV -= 2;
  }

  yV -= 2;
  // Observações no Verso (somente a observação do banco do WEBRI, sem alerta FIORIX, com quebra de linhas)
  yV = desenharRotuloETextoComQuebra({
    page: pageVerso,
    rotulo: "Observações: ",
    texto: obsOriginalWebri,
    x: margemX,
    yInicial: yV,
    larguraMaxPt: larguraUtil,
    fontBold,
    fontRegular,
    tamanhoFonte: 8.4,
    alturaLinhaPt: 11,
  });
  yV -= 6;

  pageVerso.drawText(
    sanitizarTextoWinAnsi("A serventia poderá negar o atendimento do pedido quando:"),
    { x: margemX, y: yV, size: 8.2, font: fontRegular }
  );
  yV -= 12;

  const itensNegativa = [
    "a. Não houver identificação do requerente.",
    "b. Não for informada a finalidade (motivação) nas hipóteses em que é exigida.",
    "c. A finalidade for genérica, imprecisa ou incompatível com a legislação.",
    'd. For verificada tentativa de coleta massiva de dados ("data scraping"), devassamento indevido da vida privada ou formação de banco de dados paralelo.',
    "e. Houver indícios de uso abusivo, discriminatório ou ilícito das informações registrais.",
    "f. Houver restrição legal, judicial ou administrativa ao fornecimento da informação.",
    "g. A solicitação contrariar os princípios da finalidade, adequação, necessidade, segurança e prevenção previstos no art. 6º da LGPD:",
  ];

  for (const itemNeg of itensNegativa) {
    const linhasNeg = quebrarTextoEmLinhas(itemNeg, fontRegular, 7.8, larguraUtil - 14);
    for (const ln of linhasNeg) {
      pageVerso.drawText(ln, {
        x: margemX + 10,
        y: yV,
        size: 7.8,
        font: fontRegular,
      });
      yV -= 10.2;
    }
  }

  const subPrincipios = [
    "- Finalidade: realização do tratamento para propósitos legítimos, específicos, explícitos e informados ao titular, sem possibilidade de tratamento posterior de forma incompatível com essas finalidades;",
    "- Adequação: compatibilidade do tratamento com as finalidades informadas ao titular, de acordo com o contexto do tratamento;",
    "- Necessidade: limitação do tratamento ao mínimo necessário para a realização de suas finalidades, com abrangência dos dados pertinentes, proporcionais e não excessivos em relação às finalidades do tratamento de dados.",
  ];

  for (const subP of subPrincipios) {
    const linhasSub = quebrarTextoEmLinhas(subP, fontRegular, 7.8, larguraUtil - 28);
    for (const ln of linhasSub) {
      pageVerso.drawText(ln, {
        x: margemX + 24,
        y: yV,
        size: 7.8,
        font: fontRegular,
      });
      yV -= 10.2;
    }
  }

  // 5. Declaração NF-e, Assinatura do Requerente e Autenticação Mecânica no rodapé do Verso
  const querNfeTexto = pedido.webriMeta?.gerarNfe === false ? "(não)." : "(sim).";
  const declNfeStr = `Eu, ${pedido.requerente.nome} - WhatsApp: ${foneWebri} - e-mail: ${emailWebri}. Quer a NOTA FISCAL ELETRÔNICA: ${querNfeTexto}`;
  const linhasDecl = quebrarTextoEmLinhas(declNfeStr, fontBold, 8.8, larguraUtil);

  let yRodapeV = Math.min(yV - 14, 155);
  for (const ln of linhasDecl) {
    pageVerso.drawText(ln, {
      x: margemX,
      y: yRodapeV,
      size: 8.8,
      font: fontBold,
    });
    yRodapeV -= 12;
  }

  yRodapeV -= 18;
  pageVerso.drawText(
    "ASSINATURA DO REQUERENTE: ___________________________________________________________",
    {
      x: margemX,
      y: yRodapeV,
      size: 9,
      font: fontBold,
    }
  );

  yRodapeV -= 22;
  const txtAtencao = sanitizarTextoWinAnsi(
    'Atenção: antes de assinar confira: "nome", "telefone", "e-mail" e demais dados.'
  );
  const wAtencao = fontBold.widthOfTextAtSize(txtAtencao, 8.8);
  pageVerso.drawText(txtAtencao, {
    x: margemX + (larguraUtil - wAtencao) / 2,
    y: yRodapeV,
    size: 8.8,
    font: fontBold,
  });

  pageVerso.drawText(
    sanitizarTextoWinAnsi(`*** AUTENTICAÇÃO MECÂNICA: ${valorDepositoBrl} ***`),
    {
      x: margemX,
      y: 34,
      size: 7,
      font: fontBold,
    }
  );

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


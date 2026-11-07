/**
 * Constantes geométricas, tabela Code 39 e formatadores puros (isomórficos)
 * compartilhados entre o gerador vetorial de PDF (servidor) e o visor interativo 1:1 (cliente),
 * sem qualquer dependência de Node.js ou pdf-lib.
 */

export const LARGURA_PAGINA_SIPLAN_PT = 595;
export const ALTURA_PAGINA_SIPLAN_PT = 842;
export const TAMANHO_FONTE_CORPO_FIXO_PT = 9;
export const TAMANHO_FONTE_ITEM_FIXO_PT = 8.5;

/**
 * Tabela oficial ISO/IEC 16388 — Code 39 (9 elementos por símbolo: b=barra, s=espaço, n=estreito, w=largo)
 * Codificação de 9 caracteres onde índices pares (0,2,4,6,8) são barras pretas e ímpares (1,3,5,7) são espaços.
 */
export const CODE39_PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

export function formatarMoedaBrl(valor: number): string {
  const num = Number.isFinite(valor) ? valor : 0;
  const partes = num.toFixed(2).split(".");
  const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${inteiro},${partes[1]}`;
}

export interface AnotacaoImpressaoPedido {
  titulo: string;
  conteudoAtual: string;
  autorNome: string;
  criadoEmBr: string;
  versaoAtual?: number;
  tipoRegistro?: string;
}


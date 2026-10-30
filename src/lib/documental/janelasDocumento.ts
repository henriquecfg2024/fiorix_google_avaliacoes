'use client';

/**
 * Janelas destacadas de documentos (conferência em múltiplos monitores).
 *
 * A tela principal (Ficha / Manifestação) mantém os documentos já lidos em memória e os entrega,
 * via BroadcastChannel (mesma origem, mesmo navegador), às janelas abertas em
 * `/visualizador-documental`. Assim cada documento (matrícula .KEN, minuta .DOCX, PDF do processo)
 * pode ficar em um monitor diferente sem nova leitura no servidor local.
 *
 * Posicionamento por monitor usa a Window Management API (Chrome/Edge: `getScreenDetails`),
 * que pede permissão uma única vez. Sem ela, a janela abre normalmente e o usuário a arrasta.
 */

import type { DocumentTextResult } from '@/components/documental/DocumentPreviewModal';

export const CANAL_VISUALIZADOR = 'fiorix-visualizador-documental';
const CHAVE_PREFERENCIAS = 'fiorix_janelas_documento';

export interface DocumentoJanela {
  documento: DocumentTextResult;
  relativePath?: string;
  rootId?: string;
}

export type MensagemVisualizador =
  | { tipo: 'pedir'; id: string }
  | { tipo: 'documento'; id: string; payload: DocumentoJanela }
  | { tipo: 'indisponivel'; id: string };

export type TipoDocumentoJanela = 'pdf' | 'docx' | 'ken' | 'outro';

export interface MonitorDisponivel {
  indice: number;
  rotulo: string;
  principal: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PosicaoMonitorSalva {
  left: number;
  top: number;
  width: number;
  height: number;
  rotulo?: string;
  salvoEm: number;
}

export interface PreferenciasJanelas {
  /** Abrir documentos direto em janela separada (em vez do visualizador sobreposto) */
  sempreEmJanela: boolean;
  /** Sempre abrir no monitor da última vez */
  lembrarUltimoMonitor: boolean;
  /** Posição e dimensões da janela no último monitor utilizado */
  ultimoMonitor?: PosicaoMonitorSalva;
  /** Último monitor escolhido para cada tipo de documento */
  monitorPorTipo: Partial<Record<TipoDocumentoJanela, number>>;
}

const registro = new Map<string, DocumentoJanela>();
let canal: BroadcastChannel | null = null;

export function tipoDoDocumento(documento: DocumentTextResult): TipoDocumentoJanela {
  const ext = (documento.extension || '').toLowerCase();
  if (ext === '.ken' || ext === '.tif' || ext === '.tiff' || (documento.pages?.length ?? 0) > 0) return 'ken';
  if (ext === '.pdf' || documento.pdfDataUrl) return 'pdf';
  if (ext === '.docx' || ext === '.doc') return 'docx';
  return 'outro';
}

function idDoDocumento(item: DocumentoJanela): string {
  const base = item.relativePath ? `${item.rootId || ''}:${item.relativePath}` : `${item.documento.fileName}:${item.documento.size}`;
  return base.toLowerCase();
}

/** Nome estável da janela: reabrir o mesmo documento reaproveita a janela já aberta */
function nomeDaJanela(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return `fiorix-doc-${(h >>> 0).toString(36)}`;
}

/** Inicia (uma única vez) a ponte que responde às janelas destacadas */
export function iniciarPonteJanelas(): void {
  if (canal || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  canal = new BroadcastChannel(CANAL_VISUALIZADOR);
  canal.onmessage = (event: MessageEvent<MensagemVisualizador>) => {
    const msg = event.data;
    if (!msg || msg.tipo !== 'pedir') return;
    const payload = registro.get(msg.id);
    if (payload) canal?.postMessage({ tipo: 'documento', id: msg.id, payload } satisfies MensagemVisualizador);
  };
}

export function lerPreferenciasJanelas(): PreferenciasJanelas {
  try {
    const raw = window.localStorage.getItem(CHAVE_PREFERENCIAS);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PreferenciasJanelas>;
      return {
        sempreEmJanela: !!p.sempreEmJanela,
        lembrarUltimoMonitor: p.lembrarUltimoMonitor ?? true,
        ultimoMonitor: p.ultimoMonitor,
        monitorPorTipo: p.monitorPorTipo || {},
      };
    }
  } catch {
    /* preferências indisponíveis */
  }
  return { sempreEmJanela: false, lembrarUltimoMonitor: true, monitorPorTipo: {} };
}

export function gravarPreferenciasJanelas(pref: PreferenciasJanelas): void {
  try {
    window.localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(pref));
  } catch {
    /* ignora falha de persistência */
  }
}

/** Memoriza as coordenadas do monitor atual da janela */
export function memorizarMonitorAtual(pos: { left: number; top: number; width: number; height: number; rotulo?: string }): PreferenciasJanelas {
  const atual = lerPreferenciasJanelas();
  const novo: PreferenciasJanelas = {
    ...atual,
    lembrarUltimoMonitor: true,
    ultimoMonitor: {
      left: Math.round(pos.left),
      top: Math.round(pos.top),
      width: Math.max(600, Math.round(pos.width)),
      height: Math.max(500, Math.round(pos.height)),
      rotulo: pos.rotulo,
      salvoEm: Date.now(),
    },
  };
  gravarPreferenciasJanelas(novo);
  return novo;
}

/** Desfaz a memorização de monitor (volta a abrir ao lado da tela principal) */
export function desfazerMemorizacaoMonitor(): PreferenciasJanelas {
  const atual = lerPreferenciasJanelas();
  const novo: PreferenciasJanelas = {
    ...atual,
    lembrarUltimoMonitor: false,
    ultimoMonitor: undefined,
  };
  gravarPreferenciasJanelas(novo);
  return novo;
}

interface TelaDetalhada {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary?: boolean;
  label?: string;
}

type JanelaComTelas = Window & { getScreenDetails?: () => Promise<{ screens: TelaDetalhada[] }> };

export function suportaSelecaoDeMonitor(): boolean {
  return typeof window !== 'undefined' && typeof (window as JanelaComTelas).getScreenDetails === 'function';
}

/**
 * Lista os monitores conectados. Na primeira chamada o navegador pede permissão
 * ("Gerenciamento de janelas"). Retorna lista vazia se não houver suporte ou permissão.
 */
export async function listarMonitores(): Promise<MonitorDisponivel[]> {
  const w = window as JanelaComTelas;
  if (!w.getScreenDetails) return [];
  try {
    const detalhes = await w.getScreenDetails();
    const telas = [...detalhes.screens].sort((a, b) => a.availLeft - b.availLeft || a.availTop - b.availTop);
    return telas.map((s, i) => ({
      indice: i,
      rotulo: `Monitor ${i + 1}${s.isPrimary ? ' (principal)' : ''}`,
      principal: !!s.isPrimary,
      left: s.availLeft,
      top: s.availTop,
      width: s.availWidth,
      height: s.availHeight,
    }));
  } catch {
    return [];
  }
}

/**
 * Abre o documento em uma janela própria. Se `monitor` for informado, a janela ocupa a área útil
 * desse monitor; caso contrário abre ao lado da janela atual para o usuário arrastar.
 * Retorna `false` se o navegador bloquear o pop-up.
 */
export function abrirDocumentoEmJanela(item: DocumentoJanela, monitor?: MonitorDisponivel | null): boolean {
  iniciarPonteJanelas();
  const id = idDoDocumento(item);
  registro.set(id, item);

  const pref = lerPreferenciasJanelas();
  let left: number;
  let top: number;
  let width: number;
  let height: number;
  if (monitor) {
    ({ left, top, width, height } = monitor);
    // Memoriza este monitor para as próximas aberturas automáticas
    memorizarMonitorAtual({ left, top, width, height, rotulo: monitor.rotulo });
  } else if (pref.lembrarUltimoMonitor && pref.ultimoMonitor) {
    ({ left, top, width, height } = pref.ultimoMonitor);
  } else {
    width = Math.min(1100, Math.round(window.screen.availWidth * 0.6));
    height = Math.round(window.screen.availHeight * 0.9);
    left = Math.round(window.screenX + window.outerWidth - width / 2);
    top = Math.round(window.screenY + 20);
  }

  const recursos = `popup=yes,left=${left},top=${top},width=${width},height=${height}`;
  const url = `/visualizador-documental?id=${encodeURIComponent(id)}`;
  const janela = window.open(url, nomeDaJanela(id), recursos);
  if (!janela) return false;
  try {
    // Janela reaproveitada: reposiciona no monitor escolhido
    if (monitor) {
      janela.moveTo(left, top);
      janela.resizeTo(width, height);
    }
    janela.focus();
  } catch {
    /* alguns navegadores restringem mover/redimensionar */
  }
  return true;
}

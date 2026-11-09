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
    if (!payload) return;
    try {
      canal?.postMessage({ tipo: 'documento', id: msg.id, payload } satisfies MensagemVisualizador);
    } catch {
      // Fallback caso algum navegador não clone o Blob diretamente no BroadcastChannel
      const semBlob: DocumentoJanela = {
        ...payload,
        documento: { ...payload.documento, pdfBlob: undefined },
      };
      canal?.postMessage({ tipo: 'documento', id: msg.id, payload: semBlob } satisfies MensagemVisualizador);
    }
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
    const availW = window.screen?.availWidth || window.innerWidth || 1280;
    const availH = window.screen?.availHeight || window.innerHeight || 800;
    width = Math.max(640, Math.min(1100, Math.round(availW * 0.65)));
    height = Math.max(520, Math.round(availH * 0.9));
    left = Math.max(0, Math.round((window.screenX || 0) + Math.max(40, ((window.outerWidth || availW) - width) / 2)));
    top = Math.max(0, Math.round((window.screenY || 0) + 20));
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


export const CANAL_VISUALIZADOR_LV2 = 'fiorix-visualizador-lv2';

export interface MensagemVisualizadorLv2 {
  tipo: 'abrir_matricula_lv2';
  matricula: string;
  sessao?: string;
}

let janelaLv2AbertaRef: Window | null = null;

/** Constrói a URL oficial do Visualizador FIORIX apontando para a matrícula no Livro 2 (LV2). */
export function construirUrlVisualizadorMatriculaLv2(numeroMatricula: string | number): string {
  const limpo = String(numeroMatricula).replace(/\D+/g, '');
  return `/gestao-documental/visualizador?matricula=${encodeURIComponent(limpo)}&sessao=LV2&janela=1`;
}

/**
 * Abre a matrícula do Livro 2 (LV2) diretamente no Visualizador do FIORIX em janela separada / outro monitor,
 * permitindo ao escrevente conferir o Pedido lado a lado com a imagem .KEN da matrícula.
 */
export function abrirMatriculaLv2EmOutroMonitor(numeroMatricula: string | number): boolean {
  const limpo = String(numeroMatricula).replace(/\D+/g, '');
  if (!limpo || typeof window === 'undefined') return false;

  const url = construirUrlVisualizadorMatriculaLv2(limpo);

  // Se a janela destacada do Visualizador já estiver aberta em outro monitor, envia o comando instantâneo via BroadcastChannel
  if (janelaLv2AbertaRef && !janelaLv2AbertaRef.closed) {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(CANAL_VISUALIZADOR_LV2);
        bc.postMessage({
          tipo: 'abrir_matricula_lv2',
          matricula: limpo,
          sessao: 'LV2',
        } satisfies MensagemVisualizadorLv2);
        setTimeout(() => bc.close(), 500);
      } else {
        janelaLv2AbertaRef.location.href = url;
      }
      janelaLv2AbertaRef.focus();
      return true;
    } catch {
      /* caso a referência tenha sido perdida, reabre abaixo */
    }
  }

  const pref = lerPreferenciasJanelas();
  let left: number;
  let top: number;
  let width: number;
  let height: number;

  if (pref.lembrarUltimoMonitor && pref.ultimoMonitor) {
    ({ left, top, width, height } = pref.ultimoMonitor);
  } else {
    const availW = window.screen?.availWidth || window.innerWidth || 1440;
    const availH = window.screen?.availHeight || window.innerHeight || 900;
    width = Math.max(960, Math.min(1600, Math.round(availW * 0.85)));
    height = Math.max(720, Math.round(availH * 0.92));
    left = Math.max(0, Math.round((window.screenX || 0) + 40));
    top = Math.max(0, Math.round((window.screenY || 0) + 20));
  }

  const recursos = `popup=yes,left=${left},top=${top},width=${width},height=${height},resizable=yes,scrollbars=yes`;
  const janela = window.open(url, 'fiorix-visualizador-lv2', recursos);

  if (!janela) {
    const fallback = window.open(url, '_blank', 'noopener');
    return !!fallback;
  }

  janelaLv2AbertaRef = janela;

  // Também emite no BroadcastChannel caso a janela nomeada já estivesse aberta de outra aba
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(CANAL_VISUALIZADOR_LV2);
      bc.postMessage({
        tipo: 'abrir_matricula_lv2',
        matricula: limpo,
        sessao: 'LV2',
      } satisfies MensagemVisualizadorLv2);
      setTimeout(() => bc.close(), 800);
    }
  } catch {
    /* ignora */
  }

  try {
    janela.focus();
  } catch {
    /* ignora */
  }

  // Se o navegador suportar detecção de múltiplos monitores e ainda não houver monitor salvo, posiciona no monitor secundário
  if (!pref.ultimoMonitor && suportaSelecaoDeMonitor()) {
    void listarMonitores().then((monitores) => {
      if (monitores.length < 2 || janela.closed) return;
      const telaAtualX = window.screenX || 0;
      const outroMonitor =
        monitores.find((m) => telaAtualX < m.left || telaAtualX >= m.left + m.width) ||
        monitores.find((m) => !m.principal) ||
        monitores[1];
      if (!outroMonitor) return;
      try {
        janela.moveTo(outroMonitor.left, outroMonitor.top);
        janela.resizeTo(outroMonitor.width, outroMonitor.height);
        memorizarMonitorAtual({
          left: outroMonitor.left,
          top: outroMonitor.top,
          width: outroMonitor.width,
          height: outroMonitor.height,
          rotulo: outroMonitor.rotulo,
        });
      } catch {
        /* ignora restrições do navegador */
      }
    });
  }

  return true;
}

/** Constrói a URL oficial do sistema WEBRI (Siplan Control) para abrir a Prenotação na Recepção de Títulos. */
export function construirUrlWebriContraditorio(
  numeroPrenotacao: string | number,
  seqTitulo = 1
): string {
  const limpo = String(numeroPrenotacao).replace(/\D+/g, '');
  return `http://srvsql/Siplan%20Informatica%20Ltda/Siplan%20RI/frmRecepcao.aspx?PK_FlagRecepcao=1&PK_Recepcao=${encodeURIComponent(limpo)}&PK_SeqTitulo=${encodeURIComponent(String(seqTitulo))}`;
}

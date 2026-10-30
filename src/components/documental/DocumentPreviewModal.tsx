'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Minus,
  Square,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
  ArrowRight,
  Layers,
  Search,
  Settings,
  User,
  SlidersHorizontal,
  Maximize,
  Glasses,
  Ruler,
  Equal,
  Download,
  Scan,
  Edit3,
  Eye,
  Check,
  FileText,
  Copy,
  Info,
  RefreshCw,
  Star,
  HardDrive,
  FileX,
} from 'lucide-react';
import { formatCartorioPath } from './DocumentSearch';
import { JanelaSeparadaMenu } from './JanelaSeparadaMenu';
import {
  lerPreferenciasJanelas,
  memorizarMonitorAtual,
  desfazerMemorizacaoMonitor,
  type PreferenciasJanelas,
} from '@/lib/documental/janelasDocumento';
import { SESSOES_OFICIAIS, type SessaoOficial } from '@/lib/documental/sessoes';

export const SESSOES_OFICIAIS_K_IMAGENS = SESSOES_OFICIAIS;
export const SESSOES_SIPLAN = SESSOES_OFICIAIS;

export function gerarFichaSvg(
  numero: number,
  ficha: number,
  face: 'FRENTE' | 'VERSO',
  textoCorpo: string,
  sessao = 'LV2'
) {
  const pad8 = String(numero).padStart(8, '0');
  const bloco = String(Math.floor(numero / 1000) * 1000).padStart(8, '0');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1096" height="1501" viewBox="0 0 1096 1501" style="background:#ffffff;">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <rect x="40" y="40" width="1016" height="1421" fill="none" stroke="#222222" stroke-width="2"/>
  <text x="548" y="100" font-family="Times New Roman, serif" font-size="28" font-weight="bold" text-anchor="middle" fill="#000000">7º OFICIAL DE REGISTRO DE IMÓVEIS</text>
  <text x="548" y="135" font-family="Times New Roman, serif" font-size="18" text-anchor="middle" fill="#444444">COMARCA DA CAPITAL — SÃO PAULO / SP</text>
  <line x1="80" y1="160" x2="1016" y2="160" stroke="#000000" stroke-width="2"/>
  
  <rect x="80" y="180" width="280" height="42" fill="#0F3D6E"/>
  <text x="220" y="208" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#ffffff">${sessao === 'LV2' ? 'LIVRO Nº 2 — REGISTRO GERAL' : sessao}</text>
  
  <rect x="740" y="180" width="276" height="42" fill="#eff6ff" stroke="#0F3D6E" stroke-width="2"/>
  <text x="878" y="208" font-family="Courier New, monospace" font-size="18" font-weight="bold" text-anchor="middle" fill="#0F3D6E">DOCUMENTO: ${numero}</text>
  
  <rect x="80" y="240" width="936" height="30" fill="#f0f0f0"/>
  <text x="95" y="261" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#333333">FICHA ${ficha} — ${face}</text>
  
  <text x="80" y="315" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#000000">IMÓVEL / OBJETO:</text>
  <text x="250" y="315" font-family="Times New Roman, serif" font-size="15" fill="#111111">Matrícula nº ${numero} do 7º Oficial de Registro de Imóveis da Comarca da Capital de São Paulo.</text>
  <text x="80" y="345" font-family="Times New Roman, serif" font-size="15" fill="#111111">Localização oficial no acervo K:\\IMAGENS\\${sessao}: bloco ${bloco}, arquivo ${pad8}.KEN</text>
  
  <line x1="80" y1="375" x2="1016" y2="375" stroke="#cccccc" stroke-width="1.5"/>
  
  <text x="80" y="415" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#0F3D6E">REGISTROS E AVERBAÇÕES:</text>
  ${textoCorpo}
  
  <text x="548" y="1420" font-family="monospace" font-size="12" text-anchor="middle" fill="#888888">[7º Oficial de Registro de Imóveis de São Paulo • K:\\IMAGENS\\${sessao}\\${bloco}\\${pad8}.KEN]</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function SiplanLogo({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M18 4H9C6.8 4 5 5.8 5 8C5 10.2 6.8 12 9 12H15C17.2 12 19 13.8 19 16C19 18.2 17.2 20 15 20H6"
        stroke="#0F3D6E"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="18" cy="4" r="2.2" fill="#0F3D6E" />
      <circle cx="6" cy="20" r="2.2" fill="#0F3D6E" />
    </svg>
  );
}

export function getFichaRotulo(idx: number): { codigo: string; descricao: string } {
  const num = Math.floor(idx / 2) + 1;
  const lado = idx % 2 === 0 ? 'F' : 'V';
  return {
    codigo: `${num}.${lado}`,
    descricao: `Ficha ${num} (${lado === 'F' ? 'Frente' : 'Verso'})`,
  };
}

export interface DocumentTextResult {
  fileName: string;
  extension: string;
  html: string;
  text: string;
  size: number;
  pdfDataUrl?: string;
  localUrl?: string;
  localUrlExpiresAt?: string;
  pages?: string[];
  pageTexts?: string[];
  pageCount?: number;
  downloadUrl?: string;
  notFound?: boolean;
  searchedTerm?: string;
  searchedLocation?: string;
}

interface DocumentPreviewModalProps {
  documento: DocumentTextResult;
  relativePath?: string;
  rootId?: string;
  onClose: () => void;
  modo?: 'modal' | 'janela';
  userName?: string;
}

export function DocumentPreviewModal({
  documento,
  relativePath,
  rootId,
  onClose,
  modo = 'modal',
  userName = 'HENRIQUE CESAR FERREIRA GAMA',
}: DocumentPreviewModalProps) {
  const emJanela = modo === 'janela';
  const [mounted, setMounted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Determinação da Sessão Siplan padrão baseada na pasta / rootId
  const sessaoInicial = (() => {
    const r = (rootId || '').toLowerCase();
    if (r === 'livro2' || r === 'imagens') return 'LV2';
    if (r === 'processos') return 'PROCESSOS';
    if (r === 'minutas' || r === 'usucapiao') return 'USUCAPIAO_EXTRAJUD';
    return 'LV2';
  })();
  const [sessaoSelecionada, setSessaoSelecionada] = useState<string>(sessaoInicial);

  // Extração do número do documento (ex: "40001" de "00040001.KEN")
  const docNumeroInicial = (() => {
    const raw = (documento.fileName || '').replace(/\.[^/.]+$/, '');
    const numeros = raw.replace(/[^\d]/g, '');
    return numeros || '1';
  })();
  const [docNumero, setDocNumero] = useState(docNumeroInicial);

  // Documento e caminho oficiais ativos
  const [docAtivo, setDocAtivo] = useState<DocumentTextResult>(documento);
  const [caminhoAtivo, setCaminhoAtivo] = useState<string | undefined>(relativePath);

  // Estados de exibição Siplan Image
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(200.04);
  const [rotation, setRotation] = useState(0);
  const [modoNegativo, setModoNegativo] = useState(false);
  const [imprimirTodasCheck, setImprimirTodasCheck] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'miniaturas' | 'pesquisar' | 'metadados'>('miniaturas');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [termoPesquisaDoc, setTermoPesquisaDoc] = useState('');
  const [termoTopSearch, setTermoTopSearch] = useState('');
  const [inputPagina, setInputPagina] = useState('');
  const [isCarregandoDoc, setIsCarregandoDoc] = useState(false);
  const [tempoProcessamento, setTempoProcessamento] = useState('00:00.184');
  const [dimensoesImagem, setDimensoesImagem] = useState<{ width: number; height: number; dpiH: number; dpiV: number } | null>(null);

  // Pasta favorita de manifestações ativa
  const pastaFavoritaAtiva = (() => {
    const s = (sessaoSelecionada || '').toUpperCase();
    if (s === 'LV2' || s.includes('LV2') || s === 'LIVRO2') return 'livro2';
    if (s === 'PROCESSOS' || s.includes('PROCESSO')) return 'processos';
    if (s === 'USUCAPIAO_EXTRAJUD' || s.includes('USUCAPIAO') || s === 'MINUTAS') return 'usucapiao';
    return null;
  })();

  // Ajustes de Imagem
  const [modalAjustes, setModalAjustes] = useState(false);
  const [brilho, setBrilho] = useState(100);
  const [contraste, setContraste] = useState(100);
  const [nitidez, setNitidez] = useState(false);

  // Anotações e Configurações
  const [modalAnotacoes, setModalAnotacoes] = useState(false);
  const [anotacoesTexto, setAnotacoesTexto] = useState('');
  const [modalConfig, setModalConfig] = useState(false);
  const [mostrarRegua, setMostrarRegua] = useState(false);
  const [menuZoomAberto, setMenuZoomAberto] = useState(false);
  const [menuFichasAberto, setMenuFichasAberto] = useState(false);
  const [tamanhoMiniaturas, setTamanhoMiniaturas] = useState<'normal' | 'grande' | 'pequeno'>('normal');
  const [feedbackCopiado, setFeedbackCopiado] = useState('');

  // Busca textual de termos dentro da matrícula (ex: Hipoteca, Souvenir, etc.)
  interface ResultadoBuscaTermo {
    ficha: number;
    face: string;
    snippet: string;
    termoExato: string;
  }
  const [resultadosTermo, setResultadosTermo] = useState<ResultadoBuscaTermo[]>([]);
  const [pesquisaTermoExecutada, setPesquisaTermoExecutada] = useState(false);

  // Pan (arrastar a imagem com o mouse)
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const ext = (docAtivo.extension || '').toLowerCase();
  const isPdf = ext === '.pdf' || (!!docAtivo.pdfDataUrl && ext !== '.ken' && ext !== '.tif');
  const isDoc = ext === '.docx' || ext === '.doc';
  const isKenOrTif = !isPdf && !isDoc && (ext === '.ken' || ext === '.tif' || ext === '.tiff' || (!!docAtivo.pages && docAtivo.pages.length > 0));

  const pages = docAtivo.pages && docAtivo.pages.length > 0
    ? docAtivo.pages
    : docAtivo.pdfDataUrl
      ? [docAtivo.pdfDataUrl]
      : isDoc
        ? ['doc-view']
        : [];
  const totalPages = pages.length || docAtivo.pageCount || 1;

  const [prefJanelas, setPrefJanelas] = useState<PreferenciasJanelas | null>(null);

  useEffect(() => {
    setMounted(true);
    setPrefJanelas(lerPreferenciasJanelas());
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  const mudarPagina = useCallback((novaPagina: number) => {
    if (novaPagina < 1 || novaPagina > totalPages) return;
    setCurrentPage(novaPagina);
    setPanPosition({ x: 0, y: 0 });
  }, [totalPages]);

  // Carregamento do documento por número (busca real em K:\IMAGENS)
  // Carregamento do documento por número ou processo (busca real no acervo)
  const buscarDocumentoNumero = useCallback(async (numeroDigitado: string, sessao = sessaoSelecionada) => {
    const raw = (numeroDigitado || '').trim();
    if (!raw) return;

    const t0 = performance.now();
    setIsCarregandoDoc(true);
    try {
      const res = await fetch(`/api/documental/ken?doc=${encodeURIComponent(raw)}&sessao=${encodeURIComponent(sessao)}`);
      const elapsedMs = Math.round(performance.now() - t0);
      const seg = Math.floor(elapsedMs / 1000);
      const ms = elapsedMs % 1000;
      setTempoProcessamento(`00:${String(seg).padStart(2, '0')}.${String(ms).padStart(3, '0')}`);

      if (res.ok) {
        const data = await res.json();
        if (data.success && (data.pages?.length > 0 || data.pdfDataUrl || data.html || data.text)) {
          setDocAtivo({
            fileName: data.fileName,
            extension: data.extension || (data.pdfDataUrl ? '.pdf' : '.KEN'),
            html: data.html || '',
            text: data.text || '',
            pageTexts: data.pageTexts || [],
            size: data.size,
            pageCount: data.pageCount || data.pages?.length || 1,
            pages: data.pages || (data.pdfDataUrl ? [data.pdfDataUrl] : []),
            pdfDataUrl: data.pdfDataUrl,
            downloadUrl: data.downloadUrl,
            notFound: false,
          });
          setCaminhoAtivo(data.relativePath);
          setCurrentPage(1);
          setDocNumero(raw);
          setPanPosition({ x: 0, y: 0 });
          setIsCarregandoDoc(false);
          setResultadosTermo([]);
          setPesquisaTermoExecutada(false);
          return;
        }
      }
    } catch {
      // Fallback
    }

    // Se o documento não foi localizado na API (ex: Livro 2 nº 649036 inexistente)
    const elapsedMs = Math.round(performance.now() - t0);
    const seg = Math.floor(elapsedMs / 1000);
    const ms = elapsedMs % 1000;
    setTempoProcessamento(`00:${String(seg).padStart(2, '0')}.${String(ms).padStart(3, '0')}`);
    setIsCarregandoDoc(false);
    const s = (sessao || '').toUpperCase();
    const numOnly = raw.replace(/[^\d]/g, '');
    const num = parseInt(numOnly, 10);
    const pad8 = !Number.isNaN(num) && num > 0 ? String(num).padStart(8, '0') : raw;
    const bloco = !Number.isNaN(num) && num > 0 ? String(Math.floor(num / 1000) * 1000).padStart(8, '0') : '';

    let esperado = `${pad8}.KEN`;
    let localEsperado = `K:\\IMAGENS\\${sessao}\\${bloco ? bloco + '\\' : ''}${pad8}.KEN`;

    if (s.includes('PROCESSO')) {
      esperado = raw.toLowerCase().endsWith('.pdf') ? raw : `${raw}.pdf`;
      localEsperado = `H:\\PROCESSOS - ENVIADOS POR E-MAIL\\${esperado}`;
    } else if (s.includes('USUCAPIAO') || s.includes('MINUTA')) {
      esperado = raw.toLowerCase().endsWith('.doc') || raw.toLowerCase().endsWith('.docx') ? raw : `${raw}.doc`;
      localEsperado = `W:\\USUCAPIAO\\...\\${esperado}`;
    }

    setDocAtivo({
      fileName: esperado,
      extension: esperado.endsWith('.pdf') ? '.pdf' : esperado.endsWith('.doc') ? '.doc' : esperado.endsWith('.docx') ? '.docx' : '.KEN',
      html: '',
      text: '',
      pageTexts: [],
      size: 0,
      pageCount: 0,
      pages: [],
      notFound: true,
      searchedTerm: raw,
      searchedLocation: localEsperado,
    });
    setCaminhoAtivo(localEsperado);
    setCurrentPage(1);
    setDocNumero(raw);
    setPanPosition({ x: 0, y: 0 });
    setResultadosTermo([]);
    setPesquisaTermoExecutada(false);
  }, [sessaoSelecionada]);

  // Navegação entre documentos (ex: 40001 -> 40002 ou 40000)
  const navegarDocumento = useCallback(async (delta: number) => {
    const numAtual = parseInt(docNumero.replace(/[^\d]/g, ''), 10) || 1;
    const novoNum = Math.max(1, numAtual + delta);
    setDocNumero(String(novoNum));
    await buscarDocumentoNumero(String(novoNum));
  }, [docNumero, buscarDocumentoNumero]);

  // Carregamento automático na abertura
  useEffect(() => {
    const num = parseInt(docNumeroInicial, 10);
    if (!Number.isNaN(num) && num > 0) {
      buscarDocumentoNumero(String(num), sessaoInicial);
    }
  }, [docNumeroInicial, sessaoInicial, buscarDocumentoNumero]);

  const handleMudarSessao = useCallback((novaSessao: string) => {
    setSessaoSelecionada(novaSessao);
    const s = (novaSessao || '').toUpperCase();
    if (s.includes('PROCESSO')) {
      const docBusca = (docNumero && (docNumero.includes('-') || docNumero.length > 6))
        ? docNumero
        : '1162956-97.2024.8.26.0100';
      setDocNumero(docBusca);
      buscarDocumentoNumero(docBusca, novaSessao);
    } else if (s.includes('USUCAPIAO') || s.includes('MINUTA')) {
      const docBusca = (docNumero && docNumero !== '1') ? docNumero : '1162956';
      setDocNumero(docBusca);
      buscarDocumentoNumero(docBusca, novaSessao);
    } else {
      const num = parseInt(docNumero.replace(/[^\d]/g, ''), 10) || 1;
      setDocNumero(String(num));
      buscarDocumentoNumero(String(num), novaSessao);
    }
  }, [docNumero, buscarDocumentoNumero]);

  const ajustarZoom = (delta: number) => {
    setZoom(z => Math.max(25, Math.min(800, Number((z + delta).toFixed(2)))));
  };

  const definirZoomExato = (novoZoom: number) => {
    setZoom(novoZoom);
    setMenuZoomAberto(false);
  };

  const resetarZoom100 = () => {
    setZoom(100);
    setPanPosition({ x: 0, y: 0 });
    setMenuZoomAberto(false);
  };

  const ajustarLargura = () => {
    setZoom(175);
    setPanPosition({ x: 0, y: 0 });
    setMenuZoomAberto(false);
  };

  const ajustarPagina = () => {
    setZoom(100);
    setPanPosition({ x: 0, y: 0 });
    setMenuZoomAberto(false);
  };

  const resetarVisualizacao = () => {
    setZoom(100);
    setPanPosition({ x: 0, y: 0 });
    setRotation(0);
    setModoNegativo(false);
    setBrilho(100);
    setContraste(100);
    setNitidez(false);
    setMostrarRegua(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullScreen(false);
    }
  };

  const irParaPagina = (val: string) => {
    const p = parseInt(val.trim(), 10);
    if (!Number.isNaN(p) && p >= 1 && p <= totalPages) {
      mudarPagina(p);
      setInputPagina('');
      setMenuFichasAberto(false);
    }
  };

  const normalizarBusca = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const buscarNosTextos = useCallback((termo: string) => {
    const termoNorm = normalizarBusca(termo.trim());
    if (!termoNorm) return [];

    const achados: ResultadoBuscaTermo[] = [];

    // 1. Busca em pageTexts por ficha
    if (docAtivo.pageTexts && docAtivo.pageTexts.length > 0) {
      docAtivo.pageTexts.forEach((textoPagina, idx) => {
        const textoNorm = normalizarBusca(textoPagina);
        let startFrom = 0;
        let pos = textoNorm.indexOf(termoNorm, startFrom);
        while (pos !== -1 && achados.length < 25) {
          const inicio = Math.max(0, pos - 40);
          const fim = Math.min(textoPagina.length, pos + termo.length + 60);
          const snippet =
            (inicio > 0 ? '…' : '') +
            textoPagina.substring(inicio, fim).replace(/\n/g, ' ') +
            (fim < textoPagina.length ? '…' : '');
          achados.push({
            ficha: idx + 1,
            face: `Ficha ${idx + 1} (de ${docAtivo.pageTexts?.length || totalPages})`,
            snippet,
            termoExato: termo,
          });
          startFrom = pos + Math.max(1, termoNorm.length);
          pos = textoNorm.indexOf(termoNorm, startFrom);
        }
      });
    }

    // 2. Se não encontrou em pageTexts ou não tem pageTexts, busca em docAtivo.text
    if (achados.length === 0 && docAtivo.text) {
      const textoNorm = normalizarBusca(docAtivo.text);
      let startFrom = 0;
      let pos = textoNorm.indexOf(termoNorm, startFrom);
      while (pos !== -1 && achados.length < 25) {
        const inicio = Math.max(0, pos - 40);
        const fim = Math.min(docAtivo.text.length, pos + termo.length + 60);
        const snippet =
          (inicio > 0 ? '…' : '') +
          docAtivo.text.substring(inicio, fim).replace(/\n/g, ' ') +
          (fim < docAtivo.text.length ? '…' : '');
        achados.push({
          ficha: currentPage,
          face: `Ficha ${currentPage}`,
          snippet,
          termoExato: termo,
        });
        startFrom = pos + Math.max(1, termoNorm.length);
        pos = textoNorm.indexOf(termoNorm, startFrom);
      }
    }

    return achados;
  }, [docAtivo, currentPage, totalPages]);

  const executarBuscaTermo = useCallback((termoParam?: string) => {
    const termo = (termoParam !== undefined ? termoParam : termoPesquisaDoc).trim();
    if (!termo) {
      setResultadosTermo([]);
      setPesquisaTermoExecutada(false);
      return;
    }
    setTermoPesquisaDoc(termo);
    const achados = buscarNosTextos(termo);
    setResultadosTermo(achados);
    setPesquisaTermoExecutada(true);
    setSidebarTab('pesquisar');
    setSidebarOpen(true);
    if (achados.length > 0) {
      mudarPagina(achados[0].ficha);
    }
  }, [termoPesquisaDoc, buscarNosTextos, mudarPagina]);

  const handlePesquisarDocumentoOuTermo = useCallback((termoOuNum: string) => {
    const raw = (termoOuNum || '').trim();
    if (!raw) return;

    const s = (sessaoSelecionada || '').toUpperCase();
    const temDigito = /\d/.test(raw);
    const ehProcessoOuArquivo = s.includes('PROCESSO') || raw.includes('-') || raw.includes('.') || raw.toLowerCase().endsWith('.pdf') || raw.toLowerCase().endsWith('.ken');

    // Se estiver na sessão de processos, ou tiver dígitos ou formato de documento/processo:
    if (ehProcessoOuArquivo || temDigito) {
      setDocNumero(raw);
      buscarDocumentoNumero(raw);
    } else {
      // Se for um termo puramente textual (ex: "NUA", "hipoteca", "dejanira", "usufruto"):
      setTermoPesquisaDoc(raw);
      executarBuscaTermo(raw);
    }
  }, [sessaoSelecionada, buscarDocumentoNumero, executarBuscaTermo]);

  const executarTopSearch = () => {
    const termo = termoTopSearch.trim();
    if (!termo) return;
    handlePesquisarDocumentoOuTermo(termo);
  };

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em um input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (modalAnotacoes) { setModalAnotacoes(false); return; }
        if (modalAjustes) { setModalAjustes(false); return; }
        if (modalConfig) { setModalConfig(false); return; }
        if (menuZoomAberto) { setMenuZoomAberto(false); return; }
        if (!emJanela) onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (e.ctrlKey) {
          navegarDocumento(1);
        } else if (currentPage < totalPages) {
          mudarPagina(currentPage + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (e.ctrlKey) {
          navegarDocumento(-1);
        } else if (currentPage > 1) {
          mudarPagina(currentPage - 1);
        }
      } else if (e.key === 'Home') {
        mudarPagina(1);
      } else if (e.key === 'End') {
        mudarPagina(totalPages);
      } else if (e.key === '+' || e.key === '=') {
        ajustarZoom(25);
      } else if (e.key === '-') {
        ajustarZoom(-25);
      } else if (e.key === '0') {
        resetarZoom100();
      } else if (e.key === 'r' || e.key === 'R') {
        setRotation(r => (r + 90) % 360);
      } else if (e.key === 'i' || e.key === 'I') {
        setModoNegativo(n => !n);
      } else if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, emJanela, onClose, mudarPagina, navegarDocumento, modalAnotacoes, modalAjustes, modalConfig, menuZoomAberto]);

  // Pan do mouse
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialX: panPosition.x,
      initialY: panPosition.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPanPosition({
      x: panStartRef.current.initialX + dx,
      y: panStartRef.current.initialY + dy,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 15 : -15;
      ajustarZoom(delta);
    }
  };

  // Impressão Oficial com layout cartorário
  const handlePrint = (todas = imprimirTodasCheck) => {
    if (isKenOrTif && pages.length > 0) {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        window.print();
        return;
      }
      const imagesToPrint = todas ? pages : [pages[currentPage - 1]];

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${docAtivo.fileName}</title>
            <style>
              @page { size: auto; margin: 10mm; }
              body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: #fff; }
              .header { text-align: center; border-bottom: 2px solid #0F3D6E; margin-bottom: 12px; padding-bottom: 6px; }
              .header h2 { margin: 0; font-size: 13pt; color: #0F3D6E; }
              .header p { margin: 2px 0 0 0; font-size: 8.5pt; color: #555; }
              .page-container { text-align: center; page-break-after: always; margin-bottom: 20px; }
              .page-container:last-child { page-break-after: auto; }
              img { max-width: 100%; height: auto; max-height: 94vh; object-fit: contain; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>7º OFICIAL DE REGISTRO DE IMÓVEIS DE SÃO PAULO</h2>
              <p>Visualizador de Imagens • Livro 2 – Registro Geral (${docAtivo.fileName})</p>
            </div>
            ${imagesToPrint
              .map(
                (src, i) => `
                <div class="page-container">
                  <p style="font-size: 9pt; color: #666; margin: 0 0 6px 0;">Ficha ${i + 1} de ${imagesToPrint.length}</p>
                  <img src="${src}" alt="Ficha ${i + 1}" />
                </div>
              `
              )
              .join('')}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
      return;
    }

    if (isPdf && docAtivo.pdfDataUrl) {
      const win = window.open(docAtivo.pdfDataUrl, '_blank');
      win?.focus();
      return;
    }

    window.print();
  };

  // Download da ficha ou documento
  const handleDownload = (todas = false) => {
    if (isKenOrTif && pages.length > 0) {
      if (todas) {
        pages.forEach((src, idx) => {
          setTimeout(() => {
            const a = document.createElement('a');
            a.href = src;
            a.download = `${docAtivo.fileName.replace(/\.[^.]+$/, '')}_ficha_${idx + 1}.png`;
            a.click();
          }, idx * 250);
        });
      } else if (pages[currentPage - 1]) {
        const a = document.createElement('a');
        a.href = pages[currentPage - 1];
        a.download = `${docAtivo.fileName.replace(/\.[^.]+$/, '')}_ficha_${currentPage}.png`;
        a.click();
      }
    } else if (isPdf && docAtivo.pdfDataUrl) {
      const a = document.createElement('a');
      a.href = docAtivo.pdfDataUrl;
      a.download = docAtivo.fileName;
      a.click();
    }
  };

  const alternarMonitorPadrao = () => {
    if (prefJanelas?.lembrarUltimoMonitor && prefJanelas.ultimoMonitor) {
      const novo = desfazerMemorizacaoMonitor();
      setPrefJanelas(novo);
    } else {
      const pos = {
        left: window.screenX,
        top: window.screenY,
        width: window.outerWidth || window.innerWidth,
        height: window.outerHeight || window.innerHeight,
      };
      const novo = memorizarMonitorAtual(pos);
      setPrefJanelas(novo);
    }
  };

  const copiarTextoMatricula = () => {
    navigator.clipboard?.writeText?.(docAtivo.text || `Matrícula ${docNumero} - 7º RI SP`);
    setFeedbackCopiado('Copiado para a área de transferência!');
    setTimeout(() => setFeedbackCopiado(''), 2500);
  };

  if (!mounted) return null;

  // Filtro CSS para a imagem
  const filtroCss = [
    modoNegativo ? 'invert(1) contrast(1.3)' : '',
    `brightness(${brilho}%)`,
    `contrast(${contraste}%)`,
    nitidez ? 'contrast(135%) drop-shadow(0 0 0.5px rgba(0,0,0,0.8))' : '',
  ]
    .filter(Boolean)
    .join(' ') || 'none';

  return createPortal(
    <div
      role="dialog"
      aria-modal={emJanela ? undefined : true}
      className={
        emJanela
          ? 'fixed inset-0 z-[120] flex flex-col bg-[#F0F0F0] select-none font-sans text-gray-900'
          : 'fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-1 sm:p-2 md:p-3 backdrop-blur-xs select-none font-sans text-gray-900'
      }
    >
      {/* Janela Oficial Siplan Image */}
      <div
        className={`flex flex-col bg-[#F0F0F0] border border-[#B0B0B0] shadow-2xl overflow-hidden relative ${
          emJanela || isFullScreen
            ? 'fixed inset-0 w-screen h-screen rounded-none border-0'
            : 'w-full max-w-[1520px] h-[96vh] max-h-[980px] rounded-[3px]'
        }`}
      >
        {/* 1. BARRA DE TÍTULO NATIVA DO WINDOWS */}
        <div className="flex h-7 items-center justify-between bg-[#EAEAEA] border-b border-[#D8D8D8] px-2 text-xs select-none shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <SiplanLogo className="h-3.5 w-3.5" />
            <span className="text-[12px] font-normal text-gray-800 tracking-tight">Visualizador de Imagens</span>
            {docAtivo.fileName && (
              <span className="text-[11px] text-gray-500 font-mono hidden sm:inline">
                — {docAtivo.fileName}
              </span>
            )}
            {isCarregandoDoc && (
              <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 ml-2">
                <RefreshCw className="h-3 w-3 animate-spin text-amber-700" /> Carregando...
              </span>
            )}
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setIsFullScreen(false)}
              className="inline-flex h-7 w-10 items-center justify-center text-gray-600 hover:bg-[#DCDCDC] transition"
              title="Minimizar"
            >
              <Minus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex h-7 w-10 items-center justify-center text-gray-600 hover:bg-[#DCDCDC] transition"
              title={isFullScreen ? 'Restaurar' : 'Maximizar'}
            >
              <Square className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-10 items-center justify-center text-gray-600 hover:bg-[#E81123] hover:text-white transition"
              title="Fechar (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 2. BARRA DE AÇÕES SUPERIOR */}
        <div className="flex h-9 items-center justify-between bg-[#F4F4F4] border-b border-[#D0D0D0] px-2 text-xs select-none shrink-0 relative">
          {/* Grupo de Ações à Esquerda */}
          <div className="flex items-center gap-1">
            {/* Voltar chevron (Voltar para a tela anterior) */}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-[#E0E0E0] text-gray-700 cursor-pointer"
              title="Voltar para a tela anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Seta para esquerda (Documento Anterior) */}
            <button
              type="button"
              onClick={() => navegarDocumento(-1)}
              disabled={parseInt(docNumero, 10) <= 1}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0F3D6E] text-white hover:bg-[#174E8B] transition disabled:opacity-30 shadow-2xs cursor-pointer"
              title="Documento anterior (ex: matrícula anterior - Ctrl + ←)"
            >
              <ArrowLeft className="h-3 w-3 stroke-[2.5]" />
            </button>

            {/* Seta para direita (Próximo Documento) */}
            <button
              type="button"
              onClick={() => navegarDocumento(1)}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0F3D6E] text-white hover:bg-[#174E8B] transition shadow-2xs cursor-pointer"
              title="Próximo documento (ex: próxima matrícula - Ctrl + →)"
            >
              <ArrowRight className="h-3 w-3 stroke-[2.5]" />
            </button>

            <div className="mx-1 h-5 w-[1px] bg-[#D4D4D4]" />

            {/* Ícones de Ação em Bordô */}
            {/* 1. Lápis / Anotações */}
            <button
              type="button"
              onClick={() => setModalAnotacoes(v => !v)}
              className={`inline-flex h-6 w-6 items-center justify-center rounded transition ${
                modalAnotacoes ? 'bg-[#0F3D6E] text-white' : 'text-[#0F3D6E] hover:bg-[#EAEAEA]'
              }`}
              title="Anotações e Observações da Matrícula"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>

            {/* 2. Olho / Modo Visualização */}
            <button
              type="button"
              onClick={() => setModoNegativo(n => !n)}
              className={`inline-flex h-6 w-6 items-center justify-center rounded transition ${
                modoNegativo ? 'bg-[#0F3D6E] text-white' : 'text-[#0F3D6E] hover:bg-[#EAEAEA]'
              }`}
              title="Modo visualização (Inverter Cores / Negativo)"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            {/* 3. Impressora */}
            <button
              type="button"
              onClick={() => handlePrint(imprimirTodasCheck)}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-[#0F3D6E] hover:bg-[#EAEAEA]"
              title="Imprimir documento oficial"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>

            {/* 4. Sliders / Ajustes de Imagem */}
            <button
              type="button"
              onClick={() => setModalAjustes(v => !v)}
              className={`inline-flex h-6 w-6 items-center justify-center rounded transition ${
                modalAjustes ? 'bg-[#0F3D6E] text-white' : 'text-[#0F3D6E] hover:bg-[#EAEAEA]'
              }`}
              title="Ajustes de imagem (Brilho, Contraste, Nitidez)"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>

            {/* 5. Download */}
            <button
              type="button"
              onClick={() => handleDownload(false)}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-[#0F3D6E] hover:bg-[#EAEAEA]"
              title="Baixar ficha atual (PNG de alta resolução)"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            {/* 6. Scan / Tela Cheia */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`inline-flex h-6 w-6 items-center justify-center rounded transition ${
                isFullScreen ? 'bg-[#0F3D6E] text-white' : 'text-[#0F3D6E] hover:bg-[#EAEAEA]'
              }`}
              title="Alternar tela cheia (F11)"
            >
              <Scan className="h-3.5 w-3.5" />
            </button>

            {/* 8. Camadas / Alternar barra lateral */}
            <button
              type="button"
              onClick={() => setSidebarOpen(s => !s)}
              className={`inline-flex h-6 w-6 items-center justify-center rounded transition ${
                sidebarOpen ? 'bg-[#EAEAEA] text-[#0F3D6E]' : 'text-[#0F3D6E] hover:bg-[#EAEAEA]'
              }`}
              title={sidebarOpen ? 'Ocultar painel lateral' : 'Exibir painel lateral'}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>

            {/* 9. Fixar Monitor */}
            {emJanela && (
              <button
                type="button"
                onClick={alternarMonitorPadrao}
                className={`inline-flex h-6 px-1.5 items-center justify-center rounded text-[10px] font-semibold transition ${
                  prefJanelas?.lembrarUltimoMonitor && prefJanelas.ultimoMonitor
                    ? 'bg-[#0F3D6E] text-white'
                    : 'text-[#0F3D6E] hover:bg-[#EAEAEA]'
                }`}
                title={prefJanelas?.lembrarUltimoMonitor && prefJanelas.ultimoMonitor ? 'Monitor memorizado' : 'Memorizar este monitor'}
              >
                <span>{prefJanelas?.lembrarUltimoMonitor && prefJanelas.ultimoMonitor ? '★ Fixo' : '☆ Fixar'}</span>
              </button>
            )}

            <div className="mx-1 h-5 w-[1px] bg-[#D4D4D4]" />
          </div>

          {/* Grupo à Direita: Pesquisa superior + Configurações + Usuário */}
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <input
                type="text"
                value={termoTopSearch}
                onChange={e => setTermoTopSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && executarTopSearch()}
                placeholder="Pesquisar documentos..."
                style={{ backgroundColor: '#FFFFFF', color: '#111827' }}
                className="h-6 w-44 sm:w-56 border border-[#C0C0C0] bg-white px-2 text-[11px] font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0F3D6E] rounded-none"
              />
              <button
                type="button"
                onClick={executarTopSearch}
                className="inline-flex h-6 w-6 items-center justify-center bg-[#0F3D6E] text-white hover:bg-[#174E8B] transition rounded-none shadow-2xs cursor-pointer"
                title="Pesquisar documento pelo número"
              >
                <Search className="h-3 w-3" />
              </button>
            </div>

            {/* Engrenagem de Configurações */}
            <button
              type="button"
              onClick={() => setModalConfig(v => !v)}
              className={`inline-flex h-6 w-6 items-center justify-center rounded transition ${
                modalConfig ? 'bg-[#0F3D6E] text-white' : 'text-[#0F3D6E] hover:bg-[#EAEAEA]'
              }`}
              title="Configurações e Atalhos"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>

            {/* Usuário Logado */}
            <div className="flex items-center gap-1.5 text-gray-800">
              <User className="h-3.5 w-3.5 text-gray-600" />
              <span className="text-[11px] font-medium tracking-tight uppercase whitespace-nowrap hidden md:inline">
                {userName}
              </span>
            </div>
          </div>
        </div>

        {/* POPOVER DE AJUSTES DE IMAGEM */}
        {modalAjustes && (
          <div className="absolute top-16 left-28 z-[130] w-64 rounded bg-white p-3 shadow-xl border border-gray-300 text-xs text-gray-800 space-y-3">
            <div className="flex items-center justify-between border-b pb-1 font-bold text-[#0F3D6E]">
              <span className="flex items-center gap-1">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustes de Imagem
              </span>
              <button
                type="button"
                onClick={() => setModalAjustes(false)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span>Brilho</span>
                <span className="font-mono">{brilho}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="200"
                value={brilho}
                onChange={e => setBrilho(Number(e.target.value))}
                className="w-full accent-[#0F3D6E]"
              />
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span>Contraste</span>
                <span className="font-mono">{contraste}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="250"
                value={contraste}
                onChange={e => setContraste(Number(e.target.value))}
                className="w-full accent-[#0F3D6E]"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={nitidez}
                  onChange={e => setNitidez(e.target.checked)}
                  className="accent-[#0F3D6E]"
                />
                <span>Realce de Nitidez</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={modoNegativo}
                  onChange={e => setModoNegativo(e.target.checked)}
                  className="accent-[#0F3D6E]"
                />
                <span>Negativo</span>
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                setBrilho(100);
                setContraste(100);
                setNitidez(false);
                setModoNegativo(false);
              }}
              className="w-full py-1 text-[11px] font-semibold text-[#0F3D6E] border border-[#0F3D6E] rounded hover:bg-[#0F3D6E] hover:text-white transition"
            >
              Restaurar Padrão
            </button>
          </div>
        )}

        {/* POPOVER DE ANOTAÇÕES */}
        {modalAnotacoes && (
          <div className="absolute top-16 left-12 z-[130] w-80 rounded bg-white p-3 shadow-xl border border-gray-300 text-xs text-gray-800 space-y-2">
            <div className="flex items-center justify-between border-b pb-1 font-bold text-[#0F3D6E]">
              <span className="flex items-center gap-1">
                <Edit3 className="h-3.5 w-3.5" /> Anotações da Matrícula {docNumero}
              </span>
              <button
                type="button"
                onClick={() => setModalAnotacoes(false)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-gray-600">
              Insira notas ou confrontações para conferência do escrevente:
            </p>
            <textarea
              value={anotacoesTexto}
              onChange={e => setAnotacoesTexto(e.target.value)}
              placeholder="Digite aqui notas de conferência, confrontantes ou observações..."
              rows={4}
              className="w-full border border-gray-300 p-2 text-xs font-sans rounded focus:outline-none focus:border-[#0F3D6E]"
            />
            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={copiarTextoMatricula}
                className="text-[11px] font-semibold text-[#0F3D6E] hover:underline flex items-center gap-1"
              >
                <Copy className="h-3 w-3" /> Copiar Matrícula
              </button>
              <button
                type="button"
                onClick={() => setModalAnotacoes(false)}
                className="px-3 py-1 bg-[#0F3D6E] text-white rounded text-[11px] font-semibold hover:bg-[#174E8B]"
              >
                Salvar Nota
              </button>
            </div>
            {feedbackCopiado && (
              <p className="text-[10px] text-emerald-700 font-semibold">{feedbackCopiado}</p>
            )}
          </div>
        )}

        {/* POPOVER DE CONFIGURAÇÕES E ATALHOS */}
        {modalConfig && (
          <div className="absolute top-16 right-4 z-[130] w-72 rounded bg-white p-3.5 shadow-xl border border-gray-300 text-xs text-gray-800 space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5 font-bold text-[#0F3D6E]">
              <span className="flex items-center gap-1">
                <Settings className="h-3.5 w-3.5" /> Atalhos e Configurações
              </span>
              <button
                type="button"
                onClick={() => setModalConfig(false)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <p className="font-semibold text-gray-900">Atalhos de Teclado:</p>
              <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-gray-700">
                <span>Setas / PgUp / PgDn</span>
                <span className="text-gray-500">Mudar Ficha</span>
                <span>Ctrl + Setas</span>
                <span className="text-gray-500">Mudar Matrícula</span>
                <span>+ / −</span>
                <span className="text-gray-500">Aumentar/Diminuir Zoom</span>
                <span>0</span>
                <span className="text-gray-500">Zoom 100%</span>
                <span>R</span>
                <span className="text-gray-500">Girar 90°</span>
                <span>I</span>
                <span className="text-gray-500">Inverter Cores</span>
                <span>F11</span>
                <span className="text-gray-500">Tela Cheia</span>
              </div>
            </div>
            <div className="border-t pt-2 space-y-2">
              <button
                type="button"
                onClick={alternarMonitorPadrao}
                className="w-full text-left py-1 px-2 border rounded hover:bg-gray-100 flex items-center justify-between text-[11px]"
              >
                <span>Memorizar Monitor Atual</span>
                <span>{prefJanelas?.lembrarUltimoMonitor ? '✓ Ativo' : 'Inativo'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload(true)}
                className="w-full text-left py-1 px-2 border rounded hover:bg-gray-100 flex items-center justify-between text-[11px]"
              >
                <span>Baixar Todas as Fichas (.PNG)</span>
                <Download className="h-3 w-3 text-[#0F3D6E]" />
              </button>
            </div>
          </div>
        )}

        {/* 3. ÁREA DE TRABALHO: PAINEL LATERAL ESQUERDO + CANVAS CENTRAL */}
        <div className="flex flex-1 overflow-hidden bg-[#EAEAEA]">
          {/* PAINEL LATERAL ESQUERDO (Exibição condicional com sidebarOpen) */}
          {sidebarOpen && (
            <div className="w-[275px] shrink-0 border-r border-[#D0D0D0] bg-[#EAEAEA] flex flex-col p-1.5 space-y-1.5 overflow-hidden select-none">
              {/* CARD: VOLTAR PARA TELA ANTERIOR */}
              <button
                type="button"
                onClick={() => {
                  if (onClose) {
                    onClose();
                  } else if (typeof window !== 'undefined') {
                    if (window.opener && !window.opener.closed) {
                      window.close();
                    } else {
                      window.location.href = '/gestao-documental';
                    }
                  }
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded border border-[#CBD5E1] bg-white hover:bg-[#EFF6FF] hover:border-[#0F3D6E] text-gray-800 hover:text-[#0F3D6E] shadow-2xs transition group cursor-pointer"
                title="Voltar para a tela anterior (Gestão Documental / Manifestações)"
              >
                <div className="flex items-center gap-1.5 font-bold text-[10.5px]">
                  <ArrowLeft className="h-3.5 w-3.5 text-[#0F3D6E] transition-transform group-hover:-translate-x-0.5" />
                  <span className="tracking-tight uppercase">Voltar para tela anterior</span>
                </div>
                <span className="text-[9px] font-mono font-semibold text-gray-400 group-hover:text-[#0F3D6E]">
                  ↵ Sair
                </span>
              </button>

              {/* CARD 1: SESSÃO */}
              <div className="border border-[#B8B8B8] bg-[#F8F9FA] p-1.5 shadow-2xs rounded-xs">
                <div className="flex items-center justify-between mb-1 px-0.5">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-[#1E5A9A]" />
                    <span className="text-xs font-bold text-[#0B2545] tracking-wide">SESSÃO</span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-sans">Sem grupo</span>
                </div>
                <div className="relative">
                  <select
                    value={sessaoSelecionada}
                    onChange={e => handleMudarSessao(e.target.value)}
                    className="w-full appearance-none border border-[#7F9DB9] rounded-[2px] bg-white pl-2 pr-7 py-1 text-xs font-sans text-gray-900 focus:outline-none focus:border-[#1E5A9A] cursor-pointer shadow-2xs font-normal"
                  >
                    {SESSOES_SIPLAN.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-700 stroke-[2.5]" />
                </div>
              </div>

              {/* CARD 2: PASTAS FAVORITAS (ROTINA DE MANIFESTAÇÕES) */}
              <div className="border border-[#D0D0D0] bg-white p-1.5 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                    <span className="text-[10.5px] font-bold text-[#0F3D6E] uppercase tracking-wide">Pastas Favoritas</span>
                  </div>
                  <span className="text-[8.5px] font-bold text-[#0F3D6E] bg-[#0F3D6E]/10 border border-[#0F3D6E]/25 px-1 py-0.2 rounded tracking-wider uppercase">
                    Manifestações
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {/* 1. LIVRO 2 - MATRÍCULAS */}
                  <button
                    type="button"
                    onClick={() => handleMudarSessao('LV2')}
                    className={`flex flex-col items-center justify-center py-1 px-0.5 rounded border text-center transition cursor-pointer ${
                      pastaFavoritaAtiva === 'livro2'
                        ? 'border-2 border-[#0F3D6E] bg-[#EFF6FF] text-[#0F3D6E] font-bold shadow-xs'
                        : 'border-[#D0D0D0] bg-white text-gray-700 hover:border-[#0F3D6E] hover:bg-gray-50'
                    }`}
                    title="K:\IMAGENS\LV2 — Matrículas Digitalizadas (Livro 2)"
                  >
                    <div className="flex items-center gap-0.5 font-bold text-[9.5px]">
                      <HardDrive className="h-2.5 w-2.5 text-[#0F3D6E]" />
                      <span className="truncate">Livro 2</span>
                    </div>
                    <span className="font-mono text-[8px] text-gray-500">K:\LV2</span>
                  </button>

                  {/* 2. PROCESSOS */}
                  <button
                    type="button"
                    onClick={() => handleMudarSessao('PROCESSOS')}
                    className={`flex flex-col items-center justify-center py-1 px-0.5 rounded border text-center transition cursor-pointer ${
                      pastaFavoritaAtiva === 'processos'
                        ? 'border-2 border-[#0F3D6E] bg-[#EFF6FF] text-[#0F3D6E] font-bold shadow-xs'
                        : 'border-[#D0D0D0] bg-white text-gray-700 hover:border-[#0F3D6E] hover:bg-gray-50'
                    }`}
                    title="H:\PROCESSOS - ENVIADOS POR E-MAIL — PDFs das Varas"
                  >
                    <div className="flex items-center gap-0.5 font-bold text-[9.5px]">
                      <HardDrive className="h-2.5 w-2.5 text-[#0F3D6E]" />
                      <span className="truncate">Processos</span>
                    </div>
                    <span className="font-mono text-[8px] text-gray-500">H:\Varas</span>
                  </button>

                  {/* 3. USUCAPIÃO / MINUTAS */}
                  <button
                    type="button"
                    onClick={() => handleMudarSessao('USUCAPIAO_EXTRAJUD')}
                    className={`flex flex-col items-center justify-center py-1 px-0.5 rounded border text-center transition cursor-pointer ${
                      pastaFavoritaAtiva === 'usucapiao'
                        ? 'border-2 border-[#0F3D6E] bg-[#EFF6FF] text-[#0F3D6E] font-bold shadow-xs'
                        : 'border-[#D0D0D0] bg-white text-gray-700 hover:border-[#0F3D6E] hover:bg-gray-50'
                    }`}
                    title="W:\USUCAPIAO — Pastas dos escreventes (.DOCX)"
                  >
                    <div className="flex items-center gap-0.5 font-bold text-[9.5px]">
                      <HardDrive className="h-2.5 w-2.5 text-[#0F3D6E]" />
                      <span className="truncate">Usucapião</span>
                    </div>
                    <span className="font-mono text-[8px] text-gray-500">W:\Minutas</span>
                  </button>
                </div>
              </div>

              {/* CARD 3: PESQUISAR DOCUMENTO */}
              <div className="border border-[#D0D0D0] bg-white p-1.5 shadow-2xs">
                <div className="flex items-center gap-1 mb-1">
                  <Search className="h-3.5 w-3.5 text-[#0F3D6E]" />
                  <span className="text-[11px] font-bold text-[#0F3D6E] uppercase tracking-wide">Pesquisar documento</span>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={docNumero}
                    onChange={e => setDocNumero(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handlePesquisarDocumentoOuTermo(docNumero);
                      }
                    }}
                    placeholder="Ex: 1, 40001 ou termo (NUA...)"
                    className="flex-1 h-6 border border-[#C0C0C0] bg-white px-2 text-xs font-mono font-bold text-gray-900 focus:outline-none focus:border-[#0F3D6E] placeholder:text-gray-400 placeholder:font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => handlePesquisarDocumentoOuTermo(docNumero)}
                    className="h-6 px-2.5 bg-[#0F3D6E] hover:bg-[#174E8B] text-white transition shadow-2xs cursor-pointer flex items-center justify-center shrink-0"
                    title="Buscar número de documento ou localizar termo"
                  >
                    <Search className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* CARD 4: ABAS (MINIATURAS | PESQUISAR | METADADOS) */}
              <div className="flex-1 min-h-0 flex flex-col border border-[#D0D0D0] bg-white overflow-hidden shadow-2xs">
                {/* Abas com visual clássico Siplan */}
                <div className="flex items-center border-b border-[#D0D0D0] bg-[#F4F4F4] text-xs font-medium shrink-0">
                  <button
                    type="button"
                    onClick={() => setSidebarTab('miniaturas')}
                    className={`px-3 py-1 text-xs transition border-b-2 cursor-pointer ${
                      sidebarTab === 'miniaturas'
                        ? 'border-[#0F3D6E] font-bold text-[#0F3D6E] bg-white'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Miniaturas
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab('pesquisar')}
                    className={`px-3 py-1 text-xs transition border-b-2 cursor-pointer ${
                      sidebarTab === 'pesquisar'
                        ? 'border-[#0F3D6E] font-bold text-[#0F3D6E] bg-white'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Pesquisar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab('metadados')}
                    className={`px-3 py-1 text-xs transition border-b-2 cursor-pointer ${
                      sidebarTab === 'metadados'
                        ? 'border-[#0F3D6E] font-bold text-[#0F3D6E] bg-white'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Metadados
                  </button>
                </div>

                {/* Sub-barra de Ferramentas das Miniaturas */}
                <div className="flex items-center justify-between border-b border-[#D8D8D8] px-2 py-0.5 text-[11px] text-gray-700 bg-[#F9F9F9] shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePrint(imprimirTodasCheck)}
                      className="text-gray-700 hover:text-black p-0.5 cursor-pointer"
                      title="Imprimir"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    <label className="flex items-center gap-1 cursor-pointer select-none text-[10.5px]">
                      <input
                        type="checkbox"
                        checked={imprimirTodasCheck}
                        onChange={e => setImprimirTodasCheck(e.target.checked)}
                        className="h-3 w-3 accent-[#0F3D6E]"
                      />
                      <span>Imprimir todas</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTamanhoMiniaturas(t => (t === 'normal' ? 'grande' : t === 'grande' ? 'pequeno' : 'normal'))}
                    className="text-gray-700 hover:text-black cursor-pointer text-xs"
                    title={`Tamanho das miniaturas: ${tamanhoMiniaturas}. Clique para alternar.`}
                  >
                    <span>≡▾</span>
                  </button>
                </div>

                {/* Conteúdo da Aba Ativa */}
                {sidebarTab === 'miniaturas' ? (
                  docAtivo.notFound || pages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center bg-[#EAEAEA]">
                      <FileX className="h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-xs font-bold text-gray-700">0 Fichas</p>
                      <p className="text-[10px] text-gray-500 mt-1 max-w-[180px]">
                        Nenhum documento digitalizado localizado para o número {docNumero}.
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`flex-1 overflow-y-auto p-1.5 bg-[#EAEAEA] flex flex-row sm:flex-col gap-1.5 ${
                      tamanhoMiniaturas === 'pequeno'
                        ? 'gap-1'
                        : tamanhoMiniaturas === 'grande'
                        ? 'gap-2.5'
                        : ''
                    }`}
                  >
                    {pages.map((pageSrc, idx) => {
                      const isSelected = currentPage === idx + 1;
                      return (
                        <div
                          key={idx}
                          onClick={() => mudarPagina(idx + 1)}
                          className={`group relative cursor-pointer p-0.5 transition ${
                            isSelected
                              ? 'border-2 border-[#0F3D6E] bg-white shadow-md'
                              : 'border border-[#C0C0C0] bg-white hover:border-gray-400'
                          }`}
                        >
                          <div
                            className={`relative aspect-[3/4] w-full overflow-hidden bg-white flex items-center justify-center ${
                              tamanhoMiniaturas === 'pequeno' ? 'max-h-24' : tamanhoMiniaturas === 'grande' ? 'max-h-48' : 'max-h-36'
                            }`}
                          >
                            {isPdf ? (
                              <div className="flex flex-col items-center justify-center p-2 text-center h-full w-full">
                                <FileText className="h-9 w-9 text-[#0F3D6E] mb-1 shrink-0" />
                                <span className="text-[10px] font-bold text-gray-800 line-clamp-2 leading-tight px-1">
                                  {docAtivo.fileName}
                                </span>
                                <span className="text-[8.5px] font-mono text-gray-500 mt-0.5">PDF Oficial</span>
                              </div>
                            ) : isDoc ? (
                              <div className="flex flex-col items-center justify-center p-2 text-center h-full w-full">
                                <FileText className="h-9 w-9 text-blue-800 mb-1 shrink-0" />
                                <span className="text-[10px] font-bold text-gray-800 line-clamp-2 leading-tight px-1">
                                  {docAtivo.fileName}
                                </span>
                                <span className="text-[8px] font-mono text-blue-800 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded mt-0.5">
                                  Minuta Word (.DOC)
                                </span>
                              </div>
                            ) : (
                              <img
                                src={pageSrc}
                                alt={`Ficha ${idx + 1}`}
                                className={`h-full w-full object-contain ${
                                  modoNegativo ? 'filter invert contrast-125' : ''
                                }`}
                                loading="lazy"
                              />
                            )}
                            <div
                              className={`absolute bottom-0 right-0 px-1.5 py-0.2 text-[10px] font-bold font-mono ${
                                isSelected ? 'bg-[#0F3D6E] text-white' : 'bg-gray-700 text-white'
                              }`}
                            >
                              {idx + 1}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : sidebarTab === 'pesquisar' ? (
                  <div className="flex-1 p-2 space-y-2 text-xs flex flex-col overflow-hidden bg-white">
                    <label className="block text-[11px] font-bold text-gray-700">
                      Localizar termo na matrícula:
                    </label>
                    <div className="flex items-center gap-1">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={termoPesquisaDoc}
                          onChange={e => setTermoPesquisaDoc(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              executarBuscaTermo();
                            }
                          }}
                          placeholder="Ex: hipoteca, souvenir, NUA..."
                          className="w-full h-7 border border-[#C0C0C0] bg-white text-gray-900 font-bold px-2 pr-6 text-xs rounded focus:outline-none focus:border-[#0F3D6E] placeholder:text-gray-400"
                        />
                        {termoPesquisaDoc && (
                          <button
                            type="button"
                            onClick={() => {
                              setTermoPesquisaDoc('');
                              setResultadosTermo([]);
                              setPesquisaTermoExecutada(false);
                            }}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs font-bold p-0.5 cursor-pointer"
                            title="Limpar pesquisa"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => executarBuscaTermo()}
                        className="h-7 px-2.5 bg-[#0F3D6E] hover:bg-[#174E8B] text-white flex items-center justify-center rounded cursor-pointer shadow-xs font-semibold text-xs gap-1 shrink-0 transition"
                        title="Localizar termo na matrícula"
                      >
                        <Search className="h-3.5 w-3.5" />
                        <span className="text-[11px]">Buscar</span>
                      </button>
                    </div>

                    <div className="text-[10px] text-gray-500 flex items-center justify-between border-b border-gray-200 pb-1 font-mono">
                      <span>Ficha {currentPage} de {totalPages}</span>
                      <span>Sessão: {sessaoSelecionada}</span>
                    </div>

                    {/* Resultados da busca */}
                    {pesquisaTermoExecutada ? (
                      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className={resultadosTermo.length > 0 ? 'text-[#0F3D6E]' : 'text-amber-700'}>
                            {resultadosTermo.length > 0
                              ? `${resultadosTermo.length} ocorrência(s) encontrada(s):`
                              : `Nenhuma ocorrência de "${termoPesquisaDoc}"`}
                          </span>
                        </div>

                        {resultadosTermo.length > 0 ? (
                          resultadosTermo.map((res, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => mudarPagina(res.ficha)}
                              className={`w-full text-left p-2 rounded border transition text-xs cursor-pointer ${
                                currentPage === res.ficha
                                  ? 'border-2 border-[#0F3D6E] bg-[#EFF6FF] text-gray-900 shadow-sm'
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300 text-gray-800'
                              }`}
                              title={`Clique para ir à ${res.face}`}
                            >
                              <div className="flex items-center justify-between font-bold text-[#0F3D6E] text-[11px] mb-1">
                                <span>{res.face}</span>
                                <span className="text-[10px] font-mono bg-[#0F3D6E] hover:bg-[#174E8B] text-white px-2 py-0.5 rounded shadow-2xs">
                                  Ir à Ficha {res.ficha} →
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-700 leading-snug font-sans bg-white p-1.5 rounded border border-gray-200">
                                {res.snippet}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 rounded bg-gray-50 border border-gray-200 text-[11px] text-gray-600 space-y-1">
                            <p className="font-bold text-gray-800">Termo não localizado</p>
                            <p className="leading-relaxed">
                              Não encontramos &quot;{termoPesquisaDoc}&quot; no texto transcrito desta matrícula.
                              Experimente buscar palavras como <strong>NUA</strong>, <strong>hipoteca</strong>, <strong>souvenir</strong> ou <strong>dejanira</strong>.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                          Texto Transcrito da Matrícula:
                        </p>
                        <div className="border border-gray-200 p-2 bg-gray-50 text-[11px] font-mono text-gray-800 leading-relaxed max-h-72 overflow-y-auto rounded shadow-inner whitespace-pre-wrap select-text">
                          {docAtivo.text || 'Processando transcrição do acervo oficial...'}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 p-2 space-y-2 text-[11px] font-mono text-gray-700 overflow-y-auto bg-white">
                    <div className="border border-gray-200 p-2.5 bg-gray-50 rounded space-y-1 text-gray-800 shadow-2xs">
                      <div className="font-bold text-[#0F3D6E] flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#0F3D6E]" />
                        Acervo Digitalizado
                      </div>
                      <div>Serventia: 7º RI de São Paulo</div>
                      <div>Livro: Nº 2 – Registro Geral</div>
                      <div>Arquivo: <span className="text-gray-900 font-bold">{docAtivo.fileName}</span></div>
                      <div className="break-all text-gray-600">
                        Caminho: {formatCartorioPath(rootId || 'livro2', caminhoAtivo || '')}
                      </div>
                      <div>Sessão: <span className="text-[#0F3D6E] font-semibold">{sessaoSelecionada}</span></div>
                      <div>Total Fichas: {totalPages}</div>
                      <div>Formato: {ext ? ext.toUpperCase() : '.KEN'} (Wang/TIFF CCITT4)</div>
                      <div>DPI: 200 Horizontal / 200 Vertical</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PAINEL PRINCIPAL DE VISUALIZAÇÃO */}
          <div className="flex flex-1 flex-col overflow-hidden bg-[#E2E2E2] relative">
            {/* TOOLBAR SUPERIOR DO CANVAS */}
            <div className="flex h-7 items-center justify-between bg-[#F0F0F0] border-b border-[#D0D0D0] px-2 text-xs select-none shrink-0 relative">
              {/* Controles de Navegação de Ficha */}
              <div className="flex items-center gap-1">
                {/* 1. Primeira Ficha («) */}
                <button
                  type="button"
                  onClick={() => mudarPagina(1)}
                  disabled={currentPage <= 1}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] disabled:opacity-30 rounded cursor-pointer transition"
                  title="Primeira ficha («)"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </button>

                {/* 2. Ficha Anterior (‹) */}
                <button
                  type="button"
                  onClick={() => mudarPagina(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] disabled:opacity-30 rounded cursor-pointer transition"
                  title="Ficha anterior (‹)"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                {/* 3. Indicador de Ficha Atual [ 1/6 ] */}
                <button
                  type="button"
                  onClick={() => setMenuFichasAberto(v => !v)}
                  className="flex h-5 items-center justify-center border border-[#C0C0C0] bg-white px-2 font-mono text-[11px] font-bold text-gray-800 hover:border-[#0F3D6E] cursor-pointer"
                  title="Clique para escolher a ficha"
                >
                  {currentPage}/{totalPages}
                </button>

                {/* Menu dropdown de fichas */}
                {menuFichasAberto && (
                  <div className="absolute top-7 left-12 z-[140] w-36 rounded bg-white py-1 shadow-lg border border-gray-300 max-h-48 overflow-y-auto font-mono text-[11px]">
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          mudarPagina(i + 1);
                          setMenuFichasAberto(false);
                        }}
                        className={`w-full text-left px-3 py-1 transition ${
                          currentPage === i + 1 ? 'font-bold bg-[#0F3D6E] text-white' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Ficha {i + 1} {i % 2 === 0 ? '(Frente)' : '(Verso)'}
                      </button>
                    ))}
                  </div>
                )}

                {/* 4. Próxima Ficha (›) */}
                <button
                  type="button"
                  onClick={() => mudarPagina(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] disabled:opacity-30 rounded cursor-pointer transition"
                  title="Próxima ficha (›)"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>

                {/* 5. Última Ficha (») */}
                <button
                  type="button"
                  onClick={() => mudarPagina(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] disabled:opacity-30 rounded cursor-pointer transition"
                  title="Última ficha (»)"
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </button>

                {/* 6. Caixa de input em branco para pular direto para a ficha */}
                <input
                  type="text"
                  value={inputPagina}
                  onChange={e => setInputPagina(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      irParaPagina(inputPagina);
                    }
                  }}
                  placeholder={String(currentPage)}
                  className="h-5 w-8 border border-[#C0C0C0] bg-white px-1 text-center font-mono text-[11px] font-bold text-gray-800 focus:outline-none focus:border-[#0F3D6E]"
                  title="Digite o número da ficha e pressione Enter"
                />

                <div className="mx-1 h-4 w-[1px] bg-gray-300" />

                {/* 7. Girar 90° à esquerda (↺) */}
                <button
                  type="button"
                  onClick={() => setRotation(r => (r - 90 + 360) % 360)}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] rounded cursor-pointer transition"
                  title="Girar 90° à esquerda (↺)"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>

                {/* 8. Girar 90° à direita (↻) */}
                <button
                  type="button"
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] rounded cursor-pointer transition"
                  title="Girar 90° à direita (↻)"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>

                <div className="mx-1 h-4 w-[1px] bg-gray-300" />

                {/* 9. Zoom Out (-) */}
                <button
                  type="button"
                  onClick={() => ajustarZoom(-25)}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] rounded cursor-pointer transition"
                  title="Diminuir zoom (-)"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>

                {/* 10. Caixa de Zoom com menu interativo */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuZoomAberto(v => !v)}
                    className="flex h-5 items-center justify-center border border-[#C0C0C0] bg-white px-1.5 font-sans text-[11px] font-bold text-gray-800 hover:border-[#0F3D6E] cursor-pointer"
                    title="Clique para escolher o nível de zoom"
                  >
                    {zoom.toFixed(2).replace('.', ',')}%
                  </button>
                  {menuZoomAberto && (
                    <div className="absolute top-6 left-0 z-[140] w-32 rounded bg-white py-1 shadow-lg border border-gray-300 font-sans text-[11px]">
                      {[50, 75, 100, 150, 200, 250, 300, 400].map(z => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => definirZoomExato(z)}
                          className="w-full text-left px-2.5 py-1 text-gray-700 hover:bg-gray-100"
                        >
                          {z}%
                        </button>
                      ))}
                      <div className="border-t border-gray-200 my-1" />
                      <button
                        type="button"
                        onClick={ajustarPagina}
                        className="w-full text-left px-2.5 py-1 text-gray-700 hover:bg-gray-100"
                      >
                        Ajustar à Página
                      </button>
                      <button
                        type="button"
                        onClick={ajustarLargura}
                        className="w-full text-left px-2.5 py-1 text-gray-700 hover:bg-gray-100"
                      >
                        Ajustar à Largura
                      </button>
                    </div>
                  )}
                </div>

                {/* 11. Zoom In (+) */}
                <button
                  type="button"
                  onClick={() => ajustarZoom(25)}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] rounded cursor-pointer transition"
                  title="Aumentar zoom (+)"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Ferramentas Siplan à Direita */}
              <div className="flex items-center gap-1">
                {/* 12. Ajustar à Página Inteira [ ] */}
                <button
                  type="button"
                  onClick={ajustarPagina}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] rounded cursor-pointer transition"
                  title="Ajustar à página inteira"
                >
                  <Maximize className="h-3.5 w-3.5" />
                </button>

                {/* 13. Ajustar à Largura [+] */}
                <button
                  type="button"
                  onClick={ajustarLargura}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] rounded cursor-pointer transition"
                  title="Ajustar à largura"
                >
                  <span className="font-bold text-[12px] leading-none">[+]</span>
                </button>

                {/* 14. Destacar Janela / Outro Monitor */}
                {!emJanela && (
                  <JanelaSeparadaMenu
                    item={{ documento: docAtivo, relativePath: caminhoAtivo, rootId }}
                    onAberto={onClose}
                  />
                )}

                {/* 15. Óculos (Inverter / Modo Negativo) */}
                <button
                  type="button"
                  onClick={() => setModoNegativo(n => !n)}
                  className={`inline-flex h-5 w-5 items-center justify-center rounded transition cursor-pointer ${
                    modoNegativo ? 'bg-[#0F3D6E] text-white' : 'text-[#0F3D6E] hover:bg-[#E0E0E0]'
                  }`}
                  title="Inverter cores (Negativo)"
                >
                  <Glasses className="h-3.5 w-3.5" />
                </button>

                {/* 16. Régua de medição e alinhamento */}
                <button
                  type="button"
                  onClick={() => setMostrarRegua(r => !r)}
                  className={`inline-flex h-5 w-5 items-center justify-center rounded transition cursor-pointer ${
                    mostrarRegua ? 'bg-[#0F3D6E] text-white' : 'text-[#0F3D6E] hover:bg-[#E0E0E0]'
                  }`}
                  title="Régua de medição e alinhamento milimetrado"
                >
                  <Ruler className="h-3.5 w-3.5" />
                </button>

                {/* 17. Zoom 100% (=) */}
                <button
                  type="button"
                  onClick={resetarZoom100}
                  className="inline-flex h-5 w-5 items-center justify-center text-[#0F3D6E] hover:bg-[#E0E0E0] rounded cursor-pointer transition"
                  title="Zoom 100% (=)"
                >
                  <Equal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* CANVAS DO DOCUMENTO (Fundo Cinza Siplan com a Ficha Centralizada) */}
            <div
              ref={imageContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              className={`flex-1 overflow-auto flex justify-center p-4 sm:p-6 bg-[#E2E2E2] relative select-none ${
                isDoc || docAtivo.notFound ? 'items-start' : 'items-center'
              }`}
              style={{
                cursor: isPanning ? 'grabbing' : zoom > 100 ? 'grab' : 'default',
              }}
            >
              {/* Overlay de Régua / Grade Milimetrada */}
              {mostrarRegua && (
                <div
                  className="absolute inset-0 pointer-events-none z-20"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, rgba(128,0,0,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(128,0,0,0.15) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                >
                  <div className="absolute top-2 left-2 bg-white/90 border border-[#0F3D6E] px-2 py-0.5 text-[10px] font-mono text-[#0F3D6E] rounded shadow">
                    Régua Ativa: Grade 20px (Conferência de Margens)
                  </div>
                </div>
              )}

              {/* CASO 0: Mensagem Padrão de Documento Não Localizado */}
              {docAtivo.notFound ? (
                <div className="w-full max-w-2xl bg-white border border-[#D0D0D0] shadow-xl p-8 sm:p-12 my-6 text-gray-900 rounded select-text">
                  <div className="flex items-center gap-3 border-b border-[#0F3D6E]/20 pb-4 mb-6">
                    <div className="h-11 w-11 rounded-full bg-[#0F3D6E]/10 flex items-center justify-center shrink-0">
                      <FileX className="h-6 w-6 text-[#0F3D6E]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[#0F3D6E] uppercase tracking-wide">
                        Documento Não Localizado no Acervo
                      </h3>
                      <p className="text-xs text-gray-600 font-sans">
                        7º Oficial de Registro de Imóveis da Comarca da Capital — SP
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 text-xs font-sans text-gray-800">
                    <div className="bg-[#FFF8F8] border border-[#0F3D6E]/30 rounded p-4 space-y-2">
                      <div className="flex items-center justify-between border-b border-[#0F3D6E]/15 pb-2">
                        <span className="font-bold text-[#0F3D6E] text-sm">
                          {sessaoSelecionada === 'LV2' ? 'Livro 2 — Registro Geral' : `Sessão: ${sessaoSelecionada}`}
                        </span>
                        <span className="bg-[#0F3D6E] text-white font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                          Nº {docAtivo.searchedTerm || docNumero}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                        <div>
                          <span className="text-gray-500 font-mono">Arquivo Consultado:</span>
                          <p className="font-bold text-gray-900 font-mono break-all">{docAtivo.fileName}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 font-mono">Status da Pesquisa:</span>
                          <p className="font-bold text-rose-700">Arquivo inexistente ou não digitalizado</p>
                        </div>
                      </div>

                      <div className="pt-1 text-[11px]">
                        <span className="text-gray-500 font-mono">Caminho no Acervo:</span>
                        <p className="font-mono text-gray-700 bg-white p-1.5 rounded border border-gray-200 break-all text-[10.5px]">
                          {docAtivo.searchedLocation || caminhoAtivo || `K:\\IMAGENS\\${sessaoSelecionada}`}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded text-gray-700 leading-relaxed space-y-2">
                      <p className="font-semibold text-gray-900">
                        Orientações para o Escrevente:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-[11.5px] text-gray-600">
                        <li>Verifique se o número da matrícula ou processo foi digitado corretamente no campo de pesquisa.</li>
                        <li>Se o documento for anterior à digitalização do acervo, consulte o livro físico original ou o arquivo de microfilmes da serventia.</li>
                        <li>Caso o documento tenha sido gerado recentemente, verifique se a sincronização da pasta na rede interna do cartório foi concluída.</li>
                      </ul>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDocNumero('1');
                          buscarDocumentoNumero('1', sessaoSelecionada);
                        }}
                        className="px-3 py-1.5 bg-[#0F3D6E] hover:bg-[#174E8B] text-white rounded text-xs font-semibold shadow transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Abrir Matrícula 1 Oficial</span>
                      </button>

                      <span className="text-[10px] text-gray-500 font-mono">
                        Base: 7º RI de São Paulo • Sistema FIORIX
                      </span>
                    </div>
                  </div>
                </div>
              ) : isPdf && docAtivo.pdfDataUrl ? (
                /* CASO 1: Visualizador Interativo de Processo PDF */
                <div className="w-full h-full flex flex-col bg-white border border-gray-400 shadow-xl rounded overflow-hidden" style={{ minHeight: 'calc(100vh - 120px)' }}>
                  <object
                    data={docAtivo.pdfDataUrl}
                    type="application/pdf"
                    className="w-full flex-1 border-0 bg-white"
                    style={{ height: '100%', minHeight: 'calc(100vh - 120px)' }}
                  >
                    <iframe
                      src={docAtivo.pdfDataUrl}
                      className="w-full flex-1 border-0 bg-white"
                      style={{ height: '100%', minHeight: 'calc(100vh - 120px)' }}
                      title={docAtivo.fileName}
                    />
                  </object>
                </div>
              ) : isKenOrTif && pages.length > 0 ? (
                /* CASO 2: Matrícula Digitalizada (.KEN / TIFF / Imagens) */
                <div
                  className="transition-transform duration-75 ease-out relative"
                  style={{
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    filter: filtroCss,
                  }}
                >
                  <img
                    src={pages[currentPage - 1]}
                    alt={`Ficha ${currentPage}`}
                    onLoad={e => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && img.naturalHeight) {
                        setDimensoesImagem({
                          width: img.naturalWidth,
                          height: img.naturalHeight,
                          dpiH: 200,
                          dpiV: 200,
                        });
                      }
                    }}
                    className="bg-white shadow-xl border border-gray-400 max-w-full max-h-[82vh] object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>
              ) : isDoc ? (
                /* CASO 3: Minuta Word (.DOCX / .DOC) em Folha A4 */
                <div className="w-full max-w-4xl bg-white border border-gray-400 shadow-2xl p-8 sm:p-14 my-0 text-gray-950 font-serif text-[15px] leading-relaxed select-text">
                  <div className="text-center border-b-2 border-[#0F3D6E] pb-4 mb-6">
                    <h3 className="font-bold text-base tracking-wider uppercase text-[#0F3D6E]">
                      7º Oficial de Registro de Imóveis da Comarca da Capital
                    </h3>
                    <p className="font-sans text-xs text-gray-700 mt-1">
                      Setor de Usucapião Extrajudicial • Manifestação Oficial
                    </p>
                    <p className="font-mono text-[11px] text-gray-600 mt-0.5 break-all">
                      {docAtivo.fileName}
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <a
                        href={`/api/documental/ken?stream=1&path=${encodeURIComponent(caminhoAtivo || docAtivo.fileName)}&sessao=${encodeURIComponent(sessaoSelecionada)}`}
                        download={docAtivo.fileName}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#0F3D6E] hover:bg-[#174E8B] text-white rounded text-xs font-sans font-semibold shadow transition cursor-pointer"
                        title="Baixar arquivo Word original (.DOC)"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Baixar Arquivo Original (.DOC)</span>
                      </a>
                    </div>
                  </div>
                  <div
                    className="prose max-w-none text-justify whitespace-pre-wrap font-serif"
                    dangerouslySetInnerHTML={{
                      __html:
                        docAtivo.html ||
                        `<p>${docAtivo.text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
                    }}
                  />
                </div>
              ) : (
                /* CASO 4: Fallback Genérico */
                <div className="mx-auto max-w-3xl bg-white border border-gray-300 shadow-xl p-6 text-gray-800">
                  <pre className="font-mono text-xs whitespace-pre-wrap select-text">
                    {docAtivo.text || 'Sem texto detectável.'}
                  </pre>
                </div>
              )}
            </div>

            {/* 4. BARRA DE STATUS INFERIOR */}
            <div className="flex h-6 items-center justify-between bg-[#F0F0F0] border-t border-[#D0D0D0] px-2 text-[11px] text-gray-700 select-none shrink-0">
              {/* Esquerda: Logo Siplan + Especificações Técnicas Reais */}
              <div className="flex items-center gap-2 font-sans truncate mr-2">
                <SiplanLogo className="h-3 w-3 shrink-0" />
                <span className="text-gray-800 truncate">
                  {docAtivo.notFound ? (
                    `Documento nº ${docAtivo.searchedTerm || docNumero} NÃO LOCALIZADO | Acervo: ${caminhoAtivo || 'K:\\IMAGENS\\' + sessaoSelecionada} | Fichas: 0 de 0`
                  ) : isPdf ? (
                    `Processo Digital Oficial (.PDF) | Tamanho: ${(docAtivo.size / (1024 * 1024)).toFixed(2)} MB | Acervo: H:\\PROCESSOS - ENVIADOS POR E-MAIL`
                  ) : isDoc ? (
                    `Documento Word Original (${docAtivo.extension.toUpperCase()}) | Tamanho: ${(docAtivo.size / 1024).toFixed(1)} KB | Acervo: W:\\USUCAPIAO`
                  ) : dimensoesImagem ? (
                    `Tamanho: ${(dimensoesImagem.width / dimensoesImagem.dpiH).toFixed(2)} * ${(dimensoesImagem.height / dimensoesImagem.dpiV).toFixed(2)} (Polegadas) / ${dimensoesImagem.width} * ${dimensoesImagem.height} (Pixels) | DPI: ${dimensoesImagem.dpiH} H / ${dimensoesImagem.dpiV} V | ${ext ? ext.toUpperCase() : '.KEN'} | Ficha ${currentPage} de ${totalPages}`
                  ) : (
                    `Tamanho: ${(docAtivo.size / 1024).toFixed(1)} KB | DPI: 200 H / 200 V | ${ext ? ext.toUpperCase() : '.KEN'} | Ficha ${currentPage} de ${totalPages}`
                  )}
                </span>
              </div>

              {/* Direita: Tempo Real de Resposta e Indicador Dinâmico */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[11px] text-gray-700 font-semibold" title="Tempo real de processamento e busca na rede">
                  {tempoProcessamento}
                </span>
                <div
                  className="h-2.5 w-16 bg-[#E0E0E0] border border-[#CCCCCC] overflow-hidden"
                  title={isCarregandoDoc ? 'Carregando acervo...' : `Concluído em ${tempoProcessamento}`}
                >
                  <div
                    className={`h-full transition-all duration-300 ${
                      isCarregandoDoc
                        ? 'w-2/3 bg-amber-600 animate-pulse'
                        : docAtivo.notFound
                        ? 'w-full bg-rose-600/70'
                        : 'w-full bg-[#0F3D6E]'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Building2,
  FileText,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  ExternalLink,
  Printer,
  PanelLeft,
  PanelLeftClose,
  Contrast,
  Hand,
  CheckSquare,
  Square,
  Layers,
  FolderOpen,
  ArrowLeft,
  RefreshCw,
  Upload,
  Maximize2,
  Minimize2,
  Monitor,
  Check,
  Copy,
  Clock,
  HardDrive,
  FileSearch,
  Folder,
  ArrowUp,
  X,
} from 'lucide-react';
import { getFichaRotulo, DocumentTextResult } from './DocumentPreviewModal';
import { JanelaSeparadaMenu } from './JanelaSeparadaMenu';
import {
  lerPreferenciasJanelas,
  memorizarMonitorAtual,
  desfazerMemorizacaoMonitor,
  type PreferenciasJanelas,
} from '@/lib/documental/janelasDocumento';

interface MatchItem {
  name: string;
  relativePath: string;
  rootId: string;
  size?: number;
  modifiedAt?: string;
}

interface ConnectorItem {
  id: string;
  name: string;
  lastSeenAt: string | null;
}

function isConnectorOnline(c: ConnectorItem): boolean {
  if (!c.lastSeenAt) return false;
  return Date.now() - new Date(c.lastSeenAt).getTime() < 120000;
}

// Pastas oficiais do 7º RI liberadas no Connector (o caminho real é configurado no servidor do cartório)
type RaizId = 'imagens' | 'livro2' | 'processos' | 'minutas';
const RAIZES: { id: RaizId; rotulo: string; caminho: string; descricao: string; aliases: string[] }[] = [
  { id: 'imagens', rotulo: 'Acervo Geral (K:\\IMAGENS)', caminho: 'K:\\IMAGENS', descricao: 'Todas as sessões de imagens digitalizadas (LV2, LV3, LV7, etc.)', aliases: ['imagens'] },
  { id: 'livro2', rotulo: 'Livro 2 — Matrículas', caminho: 'K:\\IMAGENS\\LV2', descricao: 'Imagens .KEN / TIFF por bloco de 1.000', aliases: ['livro2'] },
  { id: 'processos', rotulo: 'Processos', caminho: 'H:\\PROCESSOS - ENVIADOS POR E-MAIL', descricao: 'PDFs recebidos das Varas', aliases: ['processos'] },
  { id: 'minutas', rotulo: 'Usucapião / Minutas', caminho: 'W:\\USUCAPIAO', descricao: 'Pastas dos escreventes (.DOCX)', aliases: ['minutas', 'usucapiao'] },
];
const getRaiz = (rootId: string) => RAIZES.find(r => r.aliases.includes(rootId));

interface DirectoryEntry {
  name: string;
  type: 'dir' | 'file';
  relativePath: string;
  size?: number;
  modifiedAt?: string;
}
interface DirectoryListing {
  rootId: string;
  relativePath: string;
  entries: DirectoryEntry[];
  total: number;
  truncated: boolean;
}
interface ResultadoBusca {
  termo: string;
  files: MatchItem[];
  ocultados: number;
  parcial: boolean;
}

const MAX_ITENS_RENDERIZADOS = 500;
const normalizarTexto = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const normalizarCaminho = (s: string) => s.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase();
const segmentosCaminho = (rel: string) => rel.split(/[\\/]/).filter(Boolean);

function formatarTamanho(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024)).toLocaleString('pt-BR')} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

class LinkPdfExpiradoError extends Error {}

export function VisualizadorDedicado() {
  // Conectores e Servidor
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [connectorId, setConnectorId] = useState('');

  // Explorador de pastas do cartório (pastaAtual = null → visão "Acervo" com as 3 pastas oficiais)
  const [pastaAtual, setPastaAtual] = useState<{ rootId: RaizId; relativePath: string } | null>(null);
  const [listagem, setListagem] = useState<DirectoryListing | null>(null);
  const [carregandoPasta, setCarregandoPasta] = useState(false);
  const [erroPasta, setErroPasta] = useState('');
  const listagemCacheRef = useRef(new Map<string, DirectoryListing>());
  const pedidoPastaRef = useRef(0);
  const pedidoDocRef = useRef(0);
  const [filtroPasta, setFiltroPasta] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState<ResultadoBusca | null>(null);

  // Documento atualmente carregado no visualizador
  const [documentoAtivo, setDocumentoAtivo] = useState<DocumentTextResult | null>(null);
  const [arquivoAtivo, setArquivoAtivo] = useState<MatchItem | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Controles de navegação e exibição Siplan Image
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [modoVisualizacao, setModoVisualizacao] = useState<'pagina' | 'todas'>('pagina');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'miniaturas' | 'arquivos' | 'metadados'>('arquivos');
  // Área central exibindo o Explorador de pastas (estilo Windows) em vez do documento
  const [exploradorAberto, setExploradorAberto] = useState(true);
  const [imprimirTodas, setImprimirTodas] = useState(true);
  const [modoNegativo, setModoNegativo] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pan (arrastar com o mouse)
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monitor e janelas
  const [prefJanelas, setPrefJanelas] = useState<PreferenciasJanelas | null>(null);

  useEffect(() => {
    setPrefJanelas(lerPreferenciasJanelas());

    // Carrega conectores
    fetch('/api/gestao-documental', { cache: 'no-store' })
      .then(async res => {
        if (!res.ok) return;
        const data = await res.json();
        const lista: ConnectorItem[] = data.connectors || [];
        const ordenados = [...lista].sort((a, b) => {
          const aOn = isConnectorOnline(a) ? 1 : 0;
          const bOn = isConnectorOnline(b) ? 1 : 0;
          return bOn - aOn;
        });
        setConnectors(ordenados);
        const online = ordenados.find(isConnectorOnline);
        if (online) setConnectorId(online.id);
        else if (ordenados[0]) setConnectorId(ordenados[0].id);
      })
      .catch(() => {});
  }, []);

  // PDFs baixados do Connector viram blob: em memória; libera o anterior ao trocar de documento/sair
  const pdfBlobUrlRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (pdfBlobUrlRef.current) URL.revokeObjectURL(pdfBlobUrlRef.current);
  }, []);

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

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const mudarPagina = (novaPagina: number) => {
    setCurrentPage(novaPagina);
    setPanPosition({ x: 0, y: 0 });
  };

  /** Cria o job no FIORIX e aguarda o Connector do cartório concluir. */
  async function executarJob<T>(payload: Record<string, unknown>, mensagemFalha: string, timeoutMs = 60000): Promise<T> {
    if (!connectorId) throw new Error('Nenhum Connector do cartório disponível. Verifique se o serviço está em execução.');
    const response = await fetch('/api/gestao-documental', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectorId, ...payload }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || mensagemFalha);
    if (body.status === 'complete' && body.result) return body.result as T;

    const deadline = Date.now() + timeoutMs;
    let tentativa = 0;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, tentativa === 0 ? 250 : 600));
      tentativa++;
      const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
      const state = await res.json();
      if (!res.ok) throw new Error(state.error || mensagemFalha);
      if (state.status === 'complete' && state.result) return state.result as T;
      if (state.status === 'failed') throw new Error(mensagemFalha);
    }
    throw new Error('Tempo limite excedido aguardando o Connector do cartório.');
  }

  // ---------- Explorador de pastas ----------
  async function abrirPasta(rootId: RaizId, relativePath: string, forcar = false) {
    setFiltroPasta('');
    setResultadosBusca(null);
    setErroPasta('');
    setPastaAtual({ rootId, relativePath });
    const chave = `${rootId}:${normalizarCaminho(relativePath)}`;
    const emCache = listagemCacheRef.current.get(chave);
    if (emCache && !forcar) {
      setListagem(emCache);
      return;
    }
    setListagem(null);
    setCarregandoPasta(true);
    const pedido = ++pedidoPastaRef.current;
    try {
      const resultado = await executarJob<DirectoryListing>(
        { type: 'list_directory', rootId, relativePath: relativePath || '.' },
        'Não foi possível abrir esta pasta: ela não está acessível no servidor do Connector.',
        30000,
      );
      listagemCacheRef.current.set(chave, resultado);
      if (pedido === pedidoPastaRef.current) setListagem(resultado);
    } catch (err: any) {
      if (pedido === pedidoPastaRef.current) setErroPasta(err?.message || 'Falha ao abrir a pasta.');
    } finally {
      if (pedido === pedidoPastaRef.current) setCarregandoPasta(false);
    }
  }

  function irParaAcervo() {
    pedidoPastaRef.current++;
    setPastaAtual(null);
    setListagem(null);
    setCarregandoPasta(false);
    setErroPasta('');
    setFiltroPasta('');
    setResultadosBusca(null);
  }

  function subirPasta() {
    if (!pastaAtual) return;
    const partes = segmentosCaminho(pastaAtual.relativePath);
    if (partes.length === 0) { irParaAcervo(); return; }
    abrirPasta(pastaAtual.rootId, partes.slice(0, -1).join('\\'));
  }

  /** O arquivo está na pasta atual (ou em subpastas dela)? */
  function estaNoEscopo(file: MatchItem): boolean {
    if (!pastaAtual) return true;
    if (getRaiz(file.rootId)?.id !== pastaAtual.rootId) return false;
    const prefixo = normalizarCaminho(pastaAtual.relativePath);
    return !prefixo || normalizarCaminho(file.relativePath).startsWith(prefixo + '/');
  }

  // Pesquisa no Connector (pasta atual + subpastas; na visão Acervo, em todas as pastas)
  async function executarPesquisa() {
    const termo = filtroPasta.trim();
    if (termo.length < 2) {
      setErroPasta('Digite ao menos 2 caracteres para pesquisar.');
      return;
    }
    setIsSearching(true);
    setErroPasta('');
    try {
      const resultado = await executarJob<{ files?: MatchItem[]; partial?: boolean }>(
        { type: 'search', query: termo },
        'Falha na busca pelo Connector local.',
        130000,
      );
      const todos = resultado.files || [];
      const noEscopo = todos.filter(estaNoEscopo);
      setResultadosBusca({ termo, files: noEscopo, ocultados: todos.length - noEscopo.length, parcial: !!resultado.partial });
    } catch (err: any) {
      setErroPasta(err?.message || 'Falha ao pesquisar arquivos.');
    } finally {
      setIsSearching(false);
    }
  }

  /** PDFs grandes chegam como link temporário do servidor de arquivos do Connector (rede interna). */
  async function baixarPdfDoConnector(resultado: DocumentTextResult): Promise<DocumentTextResult> {
    if (!resultado.localUrl || resultado.pdfDataUrl) return resultado;
    let resp: Response;
    try {
      resp = await fetch(resultado.localUrl, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    } catch {
      throw new Error(
        'Não foi possível baixar o PDF do FIORIX Connector na rede interna. Verifique se o Connector está em execução ' +
        'e se a porta do servidor de arquivos está liberada nesta estação.',
      );
    }
    if (resp.status === 404) throw new LinkPdfExpiradoError();
    if (!resp.ok) throw new Error(`O Connector recusou o download do PDF (HTTP ${resp.status}).`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    return { ...resultado, pdfDataUrl: url, localUrl: undefined };
  }

  // Abre e lê o arquivo pelo conector do cartório
  async function abrirDocumento(file: MatchItem, forceFresh = false) {
    const pedido = ++pedidoDocRef.current;
    setExploradorAberto(false);
    setArquivoAtivo(file);
    setIsLoadingDoc(true);
    setErrorMessage('');
    setPanPosition({ x: 0, y: 0 });
    setCurrentPage(1);

    try {
      // 1. Acesso direto ultrarrápido para imagens .KEN / TIFF do acervo local K:\IMAGENS
      const isKen = file.name.toLowerCase().endsWith('.ken') || file.name.toLowerCase().endsWith('.tif') || file.name.toLowerCase().endsWith('.tiff');
      if (isKen && !forceFresh) {
        try {
          const sessao = file.rootId === 'imagens' ? (file.relativePath.split(/[\\/]/)[0] || 'LV2') : 'LV2';
          const rel = file.rootId === 'imagens' ? file.relativePath.replace(/^[^\\/]+[\\/]/, '') : file.relativePath;
          const url = `/api/documental/ken?path=${encodeURIComponent(rel)}&sessao=${encodeURIComponent(sessao)}&doc=${encodeURIComponent(file.name)}`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.pages?.length > 0) {
              if (pedido !== pedidoDocRef.current) return;
              setDocumentoAtivo({
                fileName: data.fileName,
                extension: '.KEN',
                html: '',
                text: data.text,
                size: data.size,
                pageCount: data.pages.length,
                pages: data.pages,
              });
              setErrorMessage('');
              setIsLoadingDoc(false);
              return;
            }
          }
        } catch {
          // Continua para o connector caso a rota direta falhe
        }
      }

      const bruto = await executarJob<DocumentTextResult>(
        { type: 'read_document_text', rootId: file.rootId, relativePath: file.relativePath, ...(forceFresh ? { forceFresh: true } : {}) },
        'Falha ao renderizar documento no Connector.',
      );
      if (pedido !== pedidoDocRef.current) return;
      const pronto = await baixarPdfDoConnector(bruto);
      if (pedido !== pedidoDocRef.current) return;
      if (pdfBlobUrlRef.current && pdfBlobUrlRef.current !== pronto.pdfDataUrl) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
      if (pronto.pdfDataUrl?.startsWith('blob:')) pdfBlobUrlRef.current = pronto.pdfDataUrl;
      setDocumentoAtivo(pronto);
      setErrorMessage('');
    } catch (err: any) {
      if (pedido !== pedidoDocRef.current) return;
      // Link do servidor de arquivos expirou: pede um novo ao Connector uma única vez
      if (err instanceof LinkPdfExpiradoError && !forceFresh) {
        await abrirDocumento(file, true);
        return;
      }
      setErrorMessage(err instanceof LinkPdfExpiradoError ? 'O link do PDF expirou. Tente novamente.' : (err?.message || 'Erro ao carregar arquivo.'));
    } finally {
      if (pedido === pedidoDocRef.current) {
        setIsLoadingDoc(false);
      }
    }
  }

  // Permite abrir qualquer arquivo local (Upload / PC / Rede)
  function handleAbrirArquivoLocal(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const fakeMatch: MatchItem = {
      name: file.name,
      relativePath: file.name,
      rootId: 'local',
      size: file.size,
      modifiedAt: new Date(file.lastModified).toISOString(),
    };
    setExploradorAberto(false);
    setArquivoAtivo(fakeMatch);
    setIsLoadingDoc(true);
    setPanPosition({ x: 0, y: 0 });
    setCurrentPage(1);

    if (ext === '.pdf') {
      const url = URL.createObjectURL(file);
      setDocumentoAtivo({
        fileName: file.name,
        extension: ext,
        html: '',
        text: '',
        size: file.size,
        pdfDataUrl: url,
      });
      setIsLoadingDoc(false);
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        setDocumentoAtivo({
          fileName: file.name,
          extension: ext,
          html: '',
          text: '',
          size: file.size,
          pages: [src],
          pageCount: 1,
        });
        setIsLoadingDoc(false);
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const txt = ev.target?.result as string;
        setDocumentoAtivo({
          fileName: file.name,
          extension: ext,
          html: `<pre class="p-4 font-mono text-xs whitespace-pre-wrap">${txt}</pre>`,
          text: txt,
          size: file.size,
        });
        setIsLoadingDoc(false);
      };
      reader.readAsText(file);
    }
  }

  const ext = (documentoAtivo?.extension || '').toLowerCase();
  const isKenOrTif = ext === '.ken' || ext === '.tif' || ext === '.tiff' || (!!documentoAtivo?.pages && documentoAtivo.pages.length > 0);
  const isPdf = ext === '.pdf' || !!documentoAtivo?.pdfDataUrl;
  const isDoc = ext === '.docx' || ext === '.doc';

  const pages = documentoAtivo?.pages || [];
  const totalPages = pages.length || documentoAtivo?.pageCount || 1;

  // Impressão Oficial Siplan
  const handlePrint = (forcarTodas?: boolean) => {
    if (!documentoAtivo) return;
    if (isKenOrTif && pages.length > 0) {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      const todas = forcarTodas ?? (modoVisualizacao === 'todas' || imprimirTodas);
      const imagesToPrint = todas ? pages : [pages[currentPage - 1]];

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${documentoAtivo.fileName}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: sans-serif; background: #fff; }
              .header { text-align: center; border-bottom: 2px solid #333; margin-bottom: 20px; padding-bottom: 10px; }
              .header h2 { margin: 0; font-size: 14pt; }
              .header p { margin: 4px 0 0 0; font-size: 10pt; color: #555; }
              .page-container { text-align: center; margin-bottom: 30px; page-break-after: always; }
              .page-container:last-child { page-break-after: auto; }
              img { max-width: 100%; height: auto; }
              @media print {
                body { padding: 0; }
                .page-container { page-break-after: always; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>7º OFICIAL DE REGISTRO DE IMÓVEIS DE SÃO PAULO</h2>
              <p>Livro 2 – Registro Geral • Acervo Digital (${documentoAtivo.fileName})</p>
            </div>
            ${imagesToPrint.map((src, i) => {
              const rot = getFichaRotulo(todas ? i : currentPage - 1);
              return `
                <div class="page-container">
                  <p style="font-size: 11px; color: #666; margin-bottom: 6px;">${rot.descricao} [${rot.codigo}]</p>
                  <img src="${src}" alt="${rot.descricao}" />
                </div>
              `;
            }).join('')}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
      return;
    }

    if (isPdf && documentoAtivo.pdfDataUrl) {
      window.open(documentoAtivo.pdfDataUrl, '_blank')?.focus();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${documentoAtivo.fileName}</title>
          <style>
            body { font-family: serif; font-size: 13pt; line-height: 1.6; padding: 40px; color: #111; }
            .header { text-align: center; border-bottom: 2px solid #333; margin-bottom: 25px; padding-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>7º OFICIAL DE REGISTRO DE IMÓVEIS DE SÃO PAULO</h2>
            <p>Visualizador de Documentos • ${documentoAtivo.fileName}</p>
          </div>
          ${documentoAtivo.html || `<p>${documentoAtivo.text.replace(/\n/g, '<br/>')}</p>`}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleDownload = () => {
    if (!documentoAtivo) return;
    if (isKenOrTif && pages[currentPage - 1]) {
      const a = document.createElement('a');
      a.href = pages[currentPage - 1];
      a.download = `${documentoAtivo.fileName}_ficha_${currentPage}.png`;
      a.click();
    } else if (isPdf && documentoAtivo.pdfDataUrl) {
      const a = document.createElement('a');
      a.href = documentoAtivo.pdfDataUrl;
      a.download = documentoAtivo.fileName;
      a.click();
    }
  };

  /** Explorador de pastas em tela grande (área central), sincronizado com o painel lateral. */
  const renderExploradorPrincipal = () => {
    const raizAtual = pastaAtual ? getRaiz(pastaAtual.rootId) : undefined;
    const segmentos = pastaAtual ? segmentosCaminho(pastaAtual.relativePath) : [];
    const filtro = normalizarTexto(filtroPasta.trim());
    const entradas = (listagem?.entries || []).filter(e => !filtro || normalizarTexto(e.name).includes(filtro));
    const qtdPastas = (listagem?.entries || []).filter(e => e.type === 'dir').length;
    const qtdArquivos = (listagem?.entries.length || 0) - qtdPastas;

    const corExtensao = (nome: string) => {
      const n = nome.toLowerCase();
      if (n.endsWith('.ken') || n.endsWith('.tif') || n.endsWith('.tiff')) return 'bg-amber-900/80 text-amber-300 border-amber-600/50';
      if (n.endsWith('.pdf')) return 'bg-rose-900/80 text-rose-300 border-rose-600/50';
      return 'bg-sky-900/80 text-sky-300 border-sky-600/50';
    };

    const tileArquivo = (file: MatchItem, mostrarCaminho: boolean) => {
      const raizArquivo = getRaiz(file.rootId);
      return (
        <button
          key={`f:${file.rootId}:${file.relativePath}`}
          type="button"
          onClick={() => abrirDocumento(file)}
          title={`${raizArquivo ? raizArquivo.caminho + '\\' : ''}${file.relativePath}`}
          className="group flex flex-col items-center gap-1.5 rounded-xl border border-transparent p-2.5 text-center transition hover:border-cyan-500/40 hover:bg-slate-900/80"
        >
          <div className="relative">
            <FileText className="h-10 w-10 text-slate-400 group-hover:text-slate-200 transition" strokeWidth={1.25} />
            <span className={`absolute -bottom-1 -right-2 rounded border px-1 font-mono text-[8px] font-black uppercase ${corExtensao(file.name)}`}>
              {file.name.split('.').pop()}
            </span>
          </div>
          <span className="w-full break-all text-[11px] leading-tight text-slate-200 line-clamp-2">{file.name}</span>
          {mostrarCaminho ? (
            <span className="w-full truncate font-mono text-[9px] text-slate-500">{segmentosCaminho(file.relativePath).slice(0, -1).join('\\') || raizArquivo?.caminho}</span>
          ) : file.size !== undefined ? (
            <span className="font-mono text-[9px] text-slate-500">{formatarTamanho(file.size)}</span>
          ) : null}
        </button>
      );
    };

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-slate-950">
        {/* Barra de endereço estilo Windows Explorer */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#0B1020] px-3 py-2">
          <button
            type="button"
            onClick={subirPasta}
            disabled={!pastaAtual}
            title="Subir um nível"
            aria-label="Subir um nível"
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-600 transition disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => pastaAtual && abrirPasta(pastaAtual.rootId, pastaAtual.relativePath, true)}
            disabled={!pastaAtual || carregandoPasta}
            title="Atualizar pasta"
            aria-label="Atualizar pasta"
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-600 transition disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${carregandoPasta ? 'animate-spin' : ''}`} />
          </button>
          <nav
            aria-label="Endereço da pasta"
            className="flex-1 min-w-[220px] h-8 flex items-center gap-0.5 overflow-x-auto rounded-lg border border-white/10 bg-slate-950 px-2 font-mono text-[11px] whitespace-nowrap"
          >
            <button type="button" onClick={irParaAcervo} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-800 hover:text-white transition">
              <HardDrive className="h-3.5 w-3.5 text-amber-400" />
              Acervo
            </button>
            {raizAtual && pastaAtual && (
              <>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <button type="button" onClick={() => abrirPasta(pastaAtual.rootId, '')} className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-800 hover:text-white transition">
                  {raizAtual.caminho}
                </button>
              </>
            )}
            {pastaAtual && segmentos.map((seg, i) => (
              <React.Fragment key={`m-${i}-${seg}`}>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                <button
                  type="button"
                  onClick={() => abrirPasta(pastaAtual.rootId, segmentos.slice(0, i + 1).join('\\'))}
                  className={`rounded px-1.5 py-0.5 transition hover:bg-slate-800 hover:text-white ${i === segmentos.length - 1 ? 'text-amber-300 font-semibold' : 'text-slate-300'}`}
                >
                  {seg}
                </button>
              </React.Fragment>
            ))}
          </nav>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              id="explorador-principal-busca"
              type="text"
              value={filtroPasta}
              onChange={e => setFiltroPasta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && executarPesquisa()}
              placeholder={raizAtual ? `Pesquisar em ${segmentos[segmentos.length - 1] || raizAtual.caminho}` : 'Pesquisar no acervo'}
              aria-label="Filtrar ou pesquisar arquivos"
              className="w-full h-8 rounded-lg border border-white/15 bg-slate-900 pl-8 pr-8 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {isSearching ? (
              <RefreshCw className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-amber-400" />
            ) : filtroPasta ? (
              <button type="button" onClick={() => { setFiltroPasta(''); setResultadosBusca(null); }} aria-label="Limpar filtro" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {documentoAtivo && (
            <button
              type="button"
              onClick={() => setExploradorAberto(false)}
              className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-cyan-500/40 bg-cyan-950/60 px-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/60 transition"
              title="Voltar ao documento aberto"
            >
              <FileText className="h-3.5 w-3.5" />
              Voltar ao documento
            </button>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4">
          {erroPasta && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-200">
              <span className="flex-1">{erroPasta}</span>
              {pastaAtual && !resultadosBusca && !listagem && (
                <button type="button" onClick={() => abrirPasta(pastaAtual.rootId, pastaAtual.relativePath, true)} className="shrink-0 font-semibold text-rose-100 underline hover:text-white">
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          {resultadosBusca ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-200">{resultadosBusca.files.length} resultado(s) para “{resultadosBusca.termo}”</span>
                {resultadosBusca.ocultados > 0 && <span className="text-[11px] text-slate-500">{resultadosBusca.ocultados} em outras pastas ocultado(s)</span>}
                {resultadosBusca.parcial && <span className="text-[11px] text-amber-300/80">Pesquisa parcial — refine o termo</span>}
                <button type="button" onClick={() => setResultadosBusca(null)} className="text-[11px] font-semibold text-amber-400 hover:underline">
                  {pastaAtual ? 'Voltar à pasta' : 'Fechar resultados'}
                </button>
              </div>
              {resultadosBusca.files.length === 0 ? (
                <p className="py-16 text-center text-xs text-slate-500">Nenhum arquivo encontrado.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                  {resultadosBusca.files.map(f => tileArquivo(f, true))}
                </div>
              )}
            </div>
          ) : !pastaAtual ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Pastas do cartório</h3>
                <p className="text-[11px] text-slate-500">Clique em uma pasta para navegar e escolher onde deseja pesquisar.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {RAIZES.map(r => (
                  <button
                    key={`m-${r.id}`}
                    type="button"
                    onClick={() => abrirPasta(r.id, '')}
                    className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-950/40"
                  >
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <HardDrive className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100">{r.rotulo}</p>
                      <p className="font-mono text-[11px] text-slate-400 truncate">{r.caminho}</p>
                      <p className="text-[11px] text-slate-500 truncate">{r.descricao}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition group-hover:text-amber-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : carregandoPasta && !listagem ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-xs text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
              Abrindo pasta no Connector do cartório…
            </div>
          ) : listagem ? (
            entradas.length === 0 ? (
              <p className="py-16 text-center text-xs text-slate-500">
                {filtro ? 'Nenhum item com esse nome nesta pasta. Pressione Enter para pesquisar também nas subpastas.' : 'Pasta vazia.'}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                  {entradas.slice(0, MAX_ITENS_RENDERIZADOS).map(entrada =>
                    entrada.type === 'dir' ? (
                      <button
                        key={`md:${entrada.relativePath}`}
                        type="button"
                        onClick={() => abrirPasta(pastaAtual.rootId, entrada.relativePath)}
                        title={entrada.name}
                        className="group flex flex-col items-center gap-1.5 rounded-xl border border-transparent p-2.5 text-center transition hover:border-amber-500/40 hover:bg-slate-900/80"
                      >
                        <Folder className="h-11 w-11 text-amber-400 fill-amber-400/25 group-hover:fill-amber-400/40 transition" strokeWidth={1.25} />
                        <span className="w-full break-all text-[11px] leading-tight text-slate-200 line-clamp-2">{entrada.name}</span>
                      </button>
                    ) : (
                      tileArquivo(
                        { name: entrada.name, relativePath: entrada.relativePath, rootId: pastaAtual.rootId, size: entrada.size, modifiedAt: entrada.modifiedAt },
                        false,
                      )
                    ),
                  )}
                </div>
                {entradas.length > MAX_ITENS_RENDERIZADOS && (
                  <p className="pt-3 text-center text-[11px] text-slate-500">
                    Exibindo {MAX_ITENS_RENDERIZADOS} de {entradas.length.toLocaleString('pt-BR')} itens. Use a pesquisa para localizar.
                  </p>
                )}
              </>
            )
          ) : null}
        </div>

        {/* Barra de status */}
        <div className="border-t border-white/10 bg-[#0B1020] px-4 py-1.5 text-[11px] text-slate-500">
          {pastaAtual && listagem && !resultadosBusca
            ? <>
                {qtdPastas.toLocaleString('pt-BR')} pasta(s) • {qtdArquivos.toLocaleString('pt-BR')} arquivo(s)
                {listagem.truncated && ` • exibindo os primeiros ${listagem.entries.length.toLocaleString('pt-BR')} de ${listagem.total.toLocaleString('pt-BR')}`}
              </>
            : pastaAtual ? (raizAtual ? [raizAtual.caminho, ...segmentos].join('\\') : '') : `${RAIZES.length} pastas autorizadas no Connector`}
        </div>
      </div>
    );
  };

  // Com o Explorador ocupando a área central, o painel lateral repetiria as mesmas pastas: fica oculto
  const temDocumento = !!(documentoAtivo || isLoadingDoc || errorMessage);
  const exibindoExplorador = exploradorAberto || !temDocumento;

  return (
    <div className={`flex flex-col bg-[#070A12] text-white overflow-hidden ${isFullScreen ? 'fixed inset-0 z-50' : 'h-[calc(100vh-80px)] rounded-2xl border border-white/10 shadow-2xl'}`}>
      {/* 1. BARRA SUPERIOR SIPLAN & CONTROLES */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0B1020] px-4 py-2.5 shrink-0">
        {/* Identificação do Documento Aberto */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/80 text-cyan-400 shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm sm:text-base font-bold text-slate-100 font-mono tracking-tight" title={documentoAtivo?.fileName || 'Nenhum documento aberto'}>
                {documentoAtivo ? documentoAtivo.fileName : 'Visualizador de Documentos'}
              </h2>
              {documentoAtivo && (
                <span className="rounded border border-cyan-500/40 bg-cyan-950/60 px-2 py-0.5 font-mono text-[10px] font-black text-cyan-300 uppercase shrink-0">
                  {ext.replace('.', '') || 'KEN'}
                </span>
              )}
            </div>
            <p className="truncate text-xs font-mono text-slate-400 mt-0.5">
              {arquivoAtivo
                ? `${arquivoAtivo.rootId.toUpperCase()}:\\${arquivoAtivo.relativePath}`
                : 'Selecione uma pasta ou pesquise uma matrícula / processo'}
              {isKenOrTif && pages.length > 0 && ` • ${pages.length} ficha(s) digitalizada(s)`}
            </p>
          </div>
        </div>

        {/* Ações da Barra Superior */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Seletor do Conector */}
          <select
            value={connectorId}
            onChange={e => setConnectorId(e.target.value)}
            className="h-8 max-w-[190px] rounded-lg border border-white/15 bg-[#080D1A] px-2 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            title="Conector ativo"
          >
            {connectors.map(c => {
              const online = isConnectorOnline(c);
              return (
                <option key={c.id} value={c.id} className="bg-[#0B1020]">
                  {online ? '🟢' : '🔴'} {c.name}
                </option>
              );
            })}
          </select>

          {/* Botão de Abrir Arquivo Local */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleAbrirArquivoLocal}
            accept=".ken,.tif,.tiff,.pdf,.docx,.doc,.txt,image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/60 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 transition shadow-sm"
            title="Abrir arquivo do computador ou da rede local"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Abrir Arquivo</span>
          </button>

          {/* Outro Monitor (Janela Separada) */}
          {documentoAtivo && (
            <JanelaSeparadaMenu
              item={{
                documento: documentoAtivo,
                relativePath: arquivoAtivo?.relativePath,
                rootId: arquivoAtivo?.rootId,
              }}
            />
          )}

          {/* Nova Guia */}
          {documentoAtivo && (isPdf || isKenOrTif) && (
            <button
              type="button"
              onClick={() => {
                if (isPdf && documentoAtivo.pdfDataUrl) window.open(documentoAtivo.pdfDataUrl, '_blank');
                else if (pages[currentPage - 1]) window.open(pages[currentPage - 1], '_blank');
              }}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              title="Abrir imagem em nova guia"
            >
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden md:inline">Nova Guia</span>
            </button>
          )}

          {/* Baixar */}
          {documentoAtivo && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              title="Baixar cópia oficial"
            >
              <Download className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden md:inline">Baixar</span>
            </button>
          )}

          {/* Imprimir */}
          {documentoAtivo && (
            <button
              type="button"
              onClick={() => handlePrint()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              title="Imprimir visualização oficial"
            >
              <Printer className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          )}

          {/* Tela Cheia */}
          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition"
            title={isFullScreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 2. BARRA DE FERRAMENTAS DEDICADA */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0E1526] px-3 sm:px-4 py-2 text-xs shrink-0">
        {/* Esquerda: Alternar Barra Lateral e Sessão do Cartório */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(s => !s)}
            disabled={exibindoExplorador}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
              sidebarOpen && !exibindoExplorador
                ? 'border-cyan-500/50 bg-slate-800 text-cyan-300 shadow-sm'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
            }`}
            title={exibindoExplorador ? 'O painel lateral fica disponível ao abrir um documento' : 'Exibir ou recolher painel lateral'}
          >
            {sidebarOpen && !exibindoExplorador ? <PanelLeftClose className="h-3.5 w-3.5 text-cyan-400" /> : <PanelLeft className="h-3.5 w-3.5 text-slate-400" />}
            <span className="hidden sm:inline">Painel Lateral</span>
          </button>

          {temDocumento && (
          <button
            id="btn-alternar-explorador"
            type="button"
            onClick={() => setExploradorAberto(a => !a)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              exploradorAberto
                ? 'border-amber-500/50 bg-amber-950/60 text-amber-300 shadow-sm'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
            }`}
            title={exploradorAberto ? 'Voltar ao documento aberto' : 'Abrir o Explorador de pastas do cartório'}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Explorador</span>
          </button>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border border-slate-700/60 bg-slate-800/60 text-[11px] text-slate-300 font-mono">
            <span className="text-cyan-400 font-bold">SESSÃO:</span>
            <span className="text-slate-200">
              {arquivoAtivo?.rootId === 'livro2'
                ? 'LV2'
                : arquivoAtivo?.rootId === 'processos'
                ? 'H: (Processos da Vara)'
                : arquivoAtivo?.rootId === 'minutas'
                ? 'W: (Usucapião)'
                : 'LOCAL'}
            </span>
          </div>
        </div>

        {/* Centro: Controles de Navegação Siplan |<< < 1.F > >>| */}
        {isKenOrTif && pages.length > 0 && (
          <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-lg p-0.5 shadow-inner">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => mudarPagina(1)}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-25 hover:bg-slate-900 transition"
              title="Primeira Ficha (1.F)"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => mudarPagina(currentPage - 1)}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-25 hover:bg-slate-900 transition"
              title="Ficha anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Seletor Rápido de Ficha com Código Siplan */}
            <div className="flex items-center gap-1.5 px-2 py-0.5">
              <span className="rounded bg-[#8B1E1E] px-1.5 py-0.5 font-mono text-[11px] font-black text-white shadow-sm border border-red-500/40">
                {getFichaRotulo(currentPage - 1).codigo}
              </span>
              <select
                value={currentPage}
                onChange={e => mudarPagina(Number(e.target.value))}
                className="bg-transparent text-slate-100 font-mono text-xs font-semibold focus:outline-none cursor-pointer hover:text-cyan-300 transition"
                title="Selecionar ficha diretamente"
              >
                {pages.map((_, i) => (
                  <option key={i} value={i + 1} className="bg-slate-900 text-slate-200">
                    {getFichaRotulo(i).codigo} — {getFichaRotulo(i).descricao} ({i + 1}/{totalPages})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => mudarPagina(currentPage + 1)}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-25 hover:bg-slate-900 transition"
              title="Próxima Ficha"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => mudarPagina(totalPages)}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-25 hover:bg-slate-900 transition"
              title="Última Ficha"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Direita: Rotação, Zoom, Modo Negativo e Presets */}
        <div className="flex items-center gap-1.5">
          {/* Rotação */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setRotation(r => (r - 90 + 360) % 360)}
              className="p-1 text-slate-400 hover:text-amber-300 transition"
              title="Girar 90° para a esquerda (↺)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setRotation(r => (r + 90) % 360)}
              className="p-1 text-slate-400 hover:text-amber-300 transition"
              title="Girar 90° para a direita (↻)"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(30, z - 25))}
              className="p-1 text-slate-400 hover:text-white transition"
              title="Diminuir Zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <select
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="bg-transparent text-slate-200 font-mono text-[11px] font-bold focus:outline-none cursor-pointer px-1"
            >
              {[50, 75, 100, 125, 150, 175, 200, 250].map(v => (
                <option key={v} value={v} className="bg-slate-900 text-slate-200">
                  {v}%
                </option>
              ))}
              {![50, 75, 100, 125, 150, 175, 200, 250].includes(zoom) && (
                <option value={zoom} className="bg-slate-900 text-slate-200">{zoom}%</option>
              )}
            </select>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(300, z + 25))}
              className="p-1 text-slate-400 hover:text-white transition"
              title="Aumentar Zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Modo Negativo / Alto Contraste */}
          <button
            type="button"
            onClick={() => setModoNegativo(n => !n)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
              modoNegativo
                ? 'border-amber-500 bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
            title="Modo Negativo (Inversão de cores / Alto contraste) — ideal para carimbos apagados e assinaturas antigas"
          >
            <Contrast className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Negativo</span>
          </button>

          {/* Alternar Modo: Única vs Todas */}
          {isKenOrTif && pages.length > 1 && (
            <div className="hidden lg:flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setModoVisualizacao('pagina')}
                className={`rounded px-2 py-0.5 transition ${
                  modoVisualizacao === 'pagina'
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Única
              </button>
              <button
                type="button"
                onClick={() => setModoVisualizacao('todas')}
                className={`rounded px-2 py-0.5 transition ${
                  modoVisualizacao === 'todas'
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas ({totalPages})
              </button>
            </div>
          )}

          {/* Botão Reset / Ajustar */}
          {(zoom !== 100 || rotation !== 0 || panPosition.x !== 0 || panPosition.y !== 0) && (
            <button
              type="button"
              onClick={() => {
                setZoom(100);
                setRotation(0);
                setPanPosition({ x: 0, y: 0 });
              }}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-400 hover:text-white transition"
              title="Ajustar ao tamanho original"
            >
              Ajustar
            </button>
          )}
        </div>
      </div>

      {/* 3. CORPO CENTRAL: PAINEL LATERAL + CANVAS SIPLAN */}
      <div className="flex-1 flex overflow-hidden bg-slate-950/80">
        {/* PAINEL LATERAL COM 3 ABAS: Miniaturas | Arquivos | Metadados */}
        {sidebarOpen && !exibindoExplorador && (
          <div className="w-72 sm:w-80 border-r border-white/10 bg-[#0B1020]/95 flex flex-col shrink-0">
            {/* Abas do Painel */}
            <div className="p-2.5 border-b border-white/10 bg-[#080D1A]">
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setSidebarTab('miniaturas')}
                  className={`py-1 text-center rounded transition ${
                    sidebarTab === 'miniaturas'
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Miniaturas
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('arquivos')}
                  className={`py-1 text-center rounded transition ${
                    sidebarTab === 'arquivos'
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Explorador
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('metadados')}
                  className={`py-1 text-center rounded transition ${
                    sidebarTab === 'metadados'
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Metadados
                </button>
              </div>
            </div>

            {/* ABA 1: MINIATURAS DAS FICHAS (Padrão Siplan Image com badges 1.F, 1.V) */}
            {sidebarTab === 'miniaturas' && (
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
                {isKenOrTif && pages.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/40 px-2.5 py-1.5 text-xs text-slate-300">
                      <button
                        type="button"
                        onClick={() => setImprimirTodas(c => !c)}
                        className="flex items-center gap-1.5 text-[11px] hover:text-white transition"
                      >
                        {imprimirTodas ? <CheckSquare className="h-3.5 w-3.5 text-amber-400" /> : <Square className="h-3.5 w-3.5 text-slate-500" />}
                        <span>Imprimir todas as fichas</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrint(imprimirTodas)}
                        className="p-1 text-slate-400 hover:text-amber-300 transition"
                        title="Imprimir"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {pages.map((pageSrc, idx) => {
                        const ficha = getFichaRotulo(idx);
                        const isSelected = currentPage === idx + 1;
                        return (
                          <div
                            key={idx}
                            onClick={() => mudarPagina(idx + 1)}
                            className={`group relative cursor-pointer rounded-xl border p-2 transition-all ${
                              isSelected
                                ? 'border-amber-500 bg-amber-950/40 shadow-lg shadow-amber-950/50 ring-1 ring-amber-500/40'
                                : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80'
                            }`}
                          >
                            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-white shadow-inner flex items-center justify-center">
                              <img
                                src={pageSrc}
                                alt={ficha.descricao}
                                className={`h-full w-full object-contain ${modoNegativo ? 'filter invert contrast-125' : ''}`}
                                loading="lazy"
                              />
                              {/* Badge Bordô Siplan Image */}
                              <div className="absolute bottom-1 right-1 rounded bg-[#8B1E1E] px-1.5 py-0.5 font-mono text-[10px] font-black text-white shadow-md border border-white/20">
                                {ficha.codigo}
                              </div>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between text-xs">
                              <span className={`font-semibold ${isSelected ? 'text-amber-300' : 'text-slate-300 group-hover:text-white'}`}>
                                {ficha.descricao}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">Fl. {idx + 1}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 space-y-2">
                    <FileText className="h-8 w-8 mx-auto text-slate-600" />
                    <p>Miniaturas disponíveis para imagens digitalizadas (.KEN / TIFF).</p>
                    <p className="text-[11px] text-slate-500">Abra uma matrícula do Livro 2 para folhear as fichas.</p>
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: EXPLORADOR DE PASTAS E ARQUIVOS CARTORÁRIOS (estilo Windows Explorer) */}
            {sidebarTab === 'arquivos' && (() => {
              const raizAtual = pastaAtual ? getRaiz(pastaAtual.rootId) : undefined;
              const segmentos = pastaAtual ? segmentosCaminho(pastaAtual.relativePath) : [];
              const caminhoExibicao = raizAtual
                ? [raizAtual.caminho, ...segmentos].join('\\')
                : 'Todas as pastas do acervo';
              const filtro = normalizarTexto(filtroPasta.trim());
              const entradasFiltradas = (listagem?.entries || []).filter(e => !filtro || normalizarTexto(e.name).includes(filtro));
              const qtdPastas = (listagem?.entries || []).filter(e => e.type === 'dir').length;
              const qtdArquivos = (listagem?.entries.length || 0) - qtdPastas;

              const renderArquivo = (file: MatchItem, mostrarCaminho: boolean) => {
                const nomeLower = file.name.toLowerCase();
                const isK = nomeLower.endsWith('.ken') || nomeLower.endsWith('.tif') || nomeLower.endsWith('.tiff');
                const isP = nomeLower.endsWith('.pdf');
                const isSel = arquivoAtivo?.rootId === file.rootId && arquivoAtivo?.relativePath === file.relativePath;
                const raizArquivo = getRaiz(file.rootId);
                return (
                  <button
                    key={`${file.rootId}:${file.relativePath}`}
                    type="button"
                    onClick={() => abrirDocumento(file)}
                    title={`Abrir ${file.name}`}
                    className={`w-full text-left px-2 py-1.5 rounded-lg border text-xs transition ${
                      isSel
                        ? 'border-amber-500 bg-amber-950/40 text-white'
                        : 'border-transparent hover:bg-slate-900 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 w-9 text-center py-0.5 rounded font-mono text-[9px] font-black uppercase ${
                          isK
                            ? 'bg-amber-900 text-amber-300 border border-amber-600/50'
                            : isP
                            ? 'bg-rose-900 text-rose-300 border border-rose-600/50'
                            : 'bg-sky-900 text-sky-300 border border-sky-600/50'
                        }`}
                      >
                        {file.name.split('.').pop() || 'ARQ'}
                      </span>
                      <span className="font-medium truncate flex-1">{file.name}</span>
                      {file.size !== undefined && (
                        <span className="shrink-0 font-mono text-[10px] text-slate-500">{formatarTamanho(file.size)}</span>
                      )}
                    </div>
                    {mostrarCaminho && (
                      <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5 pl-11" title={file.relativePath}>
                        {raizArquivo ? `${raizArquivo.caminho}\\` : ''}{file.relativePath}
                      </p>
                    )}
                  </button>
                );
              };

              return (
                <div className="flex-1 min-h-0 flex flex-col">
                  {/* Barra de navegação + endereço */}
                  <div className="p-2.5 border-b border-white/10 space-y-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={subirPasta}
                        disabled={!pastaAtual}
                        title="Subir um nível"
                        aria-label="Subir um nível"
                        className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-600 transition disabled:opacity-40"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => pastaAtual && abrirPasta(pastaAtual.rootId, pastaAtual.relativePath, true)}
                        disabled={!pastaAtual || carregandoPasta}
                        title="Atualizar pasta"
                        aria-label="Atualizar pasta"
                        className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-600 transition disabled:opacity-40"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${carregandoPasta ? 'animate-spin' : ''}`} />
                      </button>
                      <nav
                        aria-label="Caminho da pasta"
                        className="flex-1 min-w-0 h-7 flex items-center gap-0.5 overflow-x-auto rounded-lg border border-white/10 bg-slate-950 px-1.5 font-mono text-[10px] whitespace-nowrap"
                      >
                        <button
                          type="button"
                          onClick={irParaAcervo}
                          className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                        >
                          <HardDrive className="h-3 w-3 text-amber-400" />
                          Acervo
                        </button>
                        {raizAtual && pastaAtual && (
                          <>
                            <ChevronRight className="h-3 w-3 shrink-0 text-slate-600" />
                            <button
                              type="button"
                              onClick={() => abrirPasta(pastaAtual.rootId, '')}
                              className="rounded px-1 py-0.5 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                            >
                              {raizAtual.caminho}
                            </button>
                          </>
                        )}
                        {pastaAtual && segmentos.map((seg, i) => (
                          <React.Fragment key={`${i}-${seg}`}>
                            <ChevronRight className="h-3 w-3 shrink-0 text-slate-600" />
                            <button
                              type="button"
                              onClick={() => abrirPasta(pastaAtual.rootId, segmentos.slice(0, i + 1).join('\\'))}
                              className={`rounded px-1 py-0.5 transition hover:bg-slate-800 hover:text-white ${
                                i === segmentos.length - 1 ? 'text-amber-300 font-semibold' : 'text-slate-300'
                              }`}
                            >
                              {seg}
                            </button>
                          </React.Fragment>
                        ))}
                      </nav>
                    </div>

                    {/* Filtro instantâneo da pasta / pesquisa nas subpastas */}
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                        <input
                          type="text"
                          value={filtroPasta}
                          onChange={e => setFiltroPasta(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && executarPesquisa()}
                          placeholder={pastaAtual ? 'Filtrar nesta pasta (Enter pesquisa)' : 'Pesquisar no acervo…'}
                          aria-label="Filtrar ou pesquisar arquivos"
                          className="w-full h-8 rounded-lg border border-white/15 bg-slate-900 pl-7 pr-7 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        {filtroPasta && (
                          <button
                            type="button"
                            onClick={() => { setFiltroPasta(''); setResultadosBusca(null); }}
                            aria-label="Limpar filtro"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={executarPesquisa}
                        disabled={isSearching || filtroPasta.trim().length < 2}
                        title={pastaAtual ? 'Pesquisar nesta pasta e em todas as subpastas' : 'Pesquisar em todas as pastas do acervo'}
                        className="px-2.5 h-8 rounded-lg border border-amber-500/40 bg-amber-700 hover:bg-amber-600 text-xs font-semibold text-white transition disabled:opacity-50"
                      >
                        {isSearching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Pesquisar'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate" title={caminhoExibicao}>
                      Pesquisa em: <span className="font-mono text-slate-400">{caminhoExibicao}</span>
                    </p>
                  </div>

                  {/* Conteúdo da pasta */}
                  <div className="flex-1 overflow-y-auto p-2">
                    {erroPasta && (
                      <div className="mb-2 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/40 p-2.5 text-[11px] text-rose-200">
                        <span className="flex-1">{erroPasta}</span>
                        {pastaAtual && !resultadosBusca && !listagem && (
                          <button
                            type="button"
                            onClick={() => abrirPasta(pastaAtual.rootId, pastaAtual.relativePath, true)}
                            className="shrink-0 font-semibold text-rose-100 underline hover:text-white"
                          >
                            Tentar novamente
                          </button>
                        )}
                      </div>
                    )}

                    {resultadosBusca ? (
                      /* Resultado da pesquisa (pasta atual + subpastas) */
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1 pb-1">
                          <span className="text-[11px] font-semibold text-slate-300">
                            {resultadosBusca.files.length} resultado(s) para “{resultadosBusca.termo}”
                          </span>
                          <button
                            type="button"
                            onClick={() => setResultadosBusca(null)}
                            className="text-[10px] font-semibold text-amber-400 hover:underline"
                          >
                            {pastaAtual ? 'Voltar à pasta' : 'Fechar'}
                          </button>
                        </div>
                        {resultadosBusca.parcial && (
                          <p className="px-1 text-[10px] text-amber-300/80">Pesquisa parcial (limite de tempo ou de arquivos). Refine o termo.</p>
                        )}
                        {resultadosBusca.ocultados > 0 && (
                          <p className="px-1 text-[10px] text-slate-500">
                            {resultadosBusca.ocultados} resultado(s) em outras pastas foram ocultados.
                          </p>
                        )}
                        {resultadosBusca.files.length === 0 ? (
                          <p className="px-1 py-6 text-center text-[11px] text-slate-500">Nenhum arquivo encontrado nesta pasta.</p>
                        ) : (
                          resultadosBusca.files.map(f => renderArquivo(f, true))
                        )}
                      </div>
                    ) : !pastaAtual ? (
                      /* Visão "Acervo": as pastas oficiais do cartório */
                      <div className="space-y-1.5">
                        <p className="px-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pastas do cartório</p>
                        {RAIZES.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => abrirPasta(r.id, '')}
                            className="group w-full flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-900/60 p-2.5 text-left transition hover:border-amber-500/40 hover:bg-slate-900"
                          >
                            <div className="h-8 w-8 shrink-0 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                              <HardDrive className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-100">{r.rotulo}</p>
                              <p className="font-mono text-[10px] text-slate-400 truncate">{r.caminho}</p>
                              <p className="text-[10px] text-slate-500 truncate">{r.descricao}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-amber-400" />
                          </button>
                        ))}
                      </div>
                    ) : carregandoPasta && !listagem ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-[11px] text-slate-400">
                        <RefreshCw className="h-5 w-5 animate-spin text-amber-400" />
                        Abrindo pasta no Connector…
                      </div>
                    ) : listagem ? (
                      <div className="space-y-0.5">
                        {entradasFiltradas.length === 0 && (
                          <p className="px-1 py-6 text-center text-[11px] text-slate-500">
                            {filtro ? 'Nenhum item com esse nome nesta pasta. Pressione Enter para pesquisar nas subpastas.' : 'Pasta vazia.'}
                          </p>
                        )}
                        {entradasFiltradas.slice(0, MAX_ITENS_RENDERIZADOS).map(entrada =>
                          entrada.type === 'dir' ? (
                            <button
                              key={`d:${entrada.relativePath}`}
                              type="button"
                              onClick={() => abrirPasta(pastaAtual.rootId, entrada.relativePath)}
                              title={`Abrir pasta ${entrada.name}`}
                              className="group w-full flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs text-slate-200 transition hover:bg-slate-900 hover:border-slate-700"
                            >
                              <Folder className="h-4 w-4 shrink-0 text-amber-400 fill-amber-400/20" />
                              <span className="truncate flex-1">{entrada.name}</span>
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600 group-hover:text-amber-400" />
                            </button>
                          ) : (
                            renderArquivo(
                              { name: entrada.name, relativePath: entrada.relativePath, rootId: pastaAtual.rootId, size: entrada.size, modifiedAt: entrada.modifiedAt },
                              false,
                            )
                          ),
                        )}
                        {entradasFiltradas.length > MAX_ITENS_RENDERIZADOS && (
                          <p className="px-1 pt-2 text-center text-[10px] text-slate-500">
                            Exibindo {MAX_ITENS_RENDERIZADOS} de {entradasFiltradas.length.toLocaleString('pt-BR')} itens. Use o filtro para localizar.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Barra de status */}
                  {pastaAtual && listagem && !resultadosBusca && (
                    <div className="border-t border-white/10 px-3 py-1.5 text-[10px] text-slate-500">
                      {qtdPastas.toLocaleString('pt-BR')} pasta(s) • {qtdArquivos.toLocaleString('pt-BR')} arquivo(s)
                      {listagem.truncated && ` • exibindo os primeiros ${listagem.entries.length.toLocaleString('pt-BR')} de ${listagem.total.toLocaleString('pt-BR')}`}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ABA 3: METADADOS TÉCNICOS DO SIPLAN */}
            {sidebarTab === 'metadados' && (
              <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3 font-mono">
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 space-y-2">
                  <p className="text-amber-400 font-bold text-[11px] uppercase tracking-wider">Identificação do Acervo</p>
                  <div className="space-y-1 text-slate-300 text-[11px]">
                    <div><span className="text-slate-500">Serventia:</span> 7º Oficial de Registro de Imóveis de SP</div>
                    <div><span className="text-slate-500">Livro:</span> Nº 2 – Registro Geral</div>
                    <div><span className="text-slate-500">Arquivo:</span> {documentoAtivo?.fileName || '-'}</div>
                    <div><span className="text-slate-500">Caminho:</span> {arquivoAtivo?.relativePath || '-'}</div>
                    <div><span className="text-slate-500">Origem:</span> {arquivoAtivo?.rootId.toUpperCase()}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 space-y-2">
                  <p className="text-amber-400 font-bold text-[11px] uppercase tracking-wider">Especificações Técnicas</p>
                  <div className="space-y-1 text-slate-300 text-[11px]">
                    <div><span className="text-slate-500">Resolução:</span> 151 DPI (Horizontal / Vertical)</div>
                    <div><span className="text-slate-500">Dimensões:</span> 1064 × 1417 Pixels</div>
                    <div><span className="text-slate-500">Tamanho:</span> 7,05 × 9,38 Polegadas</div>
                    <div><span className="text-slate-500">Total Fichas:</span> {totalPages} ({Math.ceil(totalPages / 2)} Fichas F/V)</div>
                    <div><span className="text-slate-500">Formato:</span> {ext.toUpperCase()} (Processamento Digital)</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CANVAS PRINCIPAL DE VISUALIZAÇÃO */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {exploradorAberto ? (
            renderExploradorPrincipal()
          ) : isLoadingDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 bg-slate-950">
              <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
              <p className="text-sm text-slate-300 font-semibold">Carregando documento pelo conector...</p>
              <p className="text-xs text-slate-500 font-mono">Processando acervo oficial do 7º RI</p>
            </div>
          ) : errorMessage && !documentoAtivo ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950">
              <div className="p-3 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-400">
                <FileSearch className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-200">Não foi possível carregar o documento</h3>
              <p className="text-xs text-slate-400 max-w-md">{errorMessage}</p>
              <button
                type="button"
                onClick={() => arquivoAtivo && abrirDocumento(arquivoAtivo)}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-slate-700 hover:text-white transition shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
                <span>Tentar Novamente</span>
              </button>
            </div>
          ) : isKenOrTif && pages.length > 0 ? (
            /* CASO 1: IMAGEM DIGITALIZADA .KEN / TIFF */
            <div className="flex-1 overflow-auto flex flex-col">
              {modoVisualizacao === 'pagina' ? (
                <div
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950 select-none relative"
                  style={{
                    cursor: isPanning ? 'grabbing' : zoom > 100 ? 'grab' : 'default',
                  }}
                >
                  {/* Dica flutuante para Arrastar */}
                  {zoom > 100 && (
                    <div className="absolute top-3 right-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 backdrop-blur px-2.5 py-1 text-[10px] text-slate-400 pointer-events-none">
                      <Hand className="h-3 w-3 text-cyan-400" />
                      <span>Clique e arraste para mover</span>
                    </div>
                  )}

                  {/* Imagem com Transformações */}
                  <div
                    className="transition-transform duration-100 ease-out"
                    style={{
                      transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoom / 100}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center',
                      filter: modoNegativo ? 'invert(1) contrast(1.3) brightness(1.1)' : 'none',
                    }}
                  >
                    <img
                      src={pages[currentPage - 1]}
                      alt={`Ficha ${getFichaRotulo(currentPage - 1).codigo}`}
                      className="rounded shadow-2xl border border-slate-700 bg-white max-w-full max-h-[82vh] object-contain pointer-events-none"
                      draggable={false}
                    />
                  </div>
                </div>
              ) : (
                /* Exibição Contínua de Todas as Fichas */
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 max-w-4xl mx-auto w-full">
                  {pages.map((pageSrc, idx) => {
                    const ficha = getFichaRotulo(idx);
                    return (
                      <div key={idx} className="flex flex-col items-center space-y-2 border-b border-slate-800/80 pb-8 last:border-b-0">
                        <img
                          src={pageSrc}
                          alt={ficha.descricao}
                          className={`rounded-lg shadow-2xl border border-slate-700 bg-white max-w-full object-contain ${
                            modoNegativo ? 'filter invert contrast-125' : ''
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : isPdf && documentoAtivo?.pdfDataUrl ? (
            /* CASO 2: VISUALIZADOR PDF INTERATIVO */
            <div className="w-full h-full flex flex-col bg-slate-900">
              <iframe
                src={documentoAtivo.pdfDataUrl}
                className="w-full flex-1 border-0 bg-white"
                title={documentoAtivo.fileName}
              />
            </div>
          ) : isDoc && documentoAtivo ? (
            /* CASO 3: MINUTA WORD (.DOCX / .DOC) EM FOLHA OFICIAL */
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950">
              <div className="mx-auto max-w-3xl rounded-xl border border-slate-300 bg-white text-slate-900 shadow-xl p-8 sm:p-12 min-h-full">
                <div className="text-center border-b border-slate-300 pb-4 mb-6">
                  <div className="flex items-center justify-center gap-2 text-slate-700 mb-1">
                    <Building2 className="h-4 w-4 text-slate-600" />
                    <h4 className="font-serif font-bold text-sm tracking-wider uppercase text-slate-800">
                      7º Oficial de Registro de Imóveis de São Paulo
                    </h4>
                  </div>
                  <p className="font-sans text-[11px] text-slate-500">
                    Visualização Local de Minuta • {documentoAtivo.fileName}
                  </p>
                </div>
                <div
                  className="font-serif text-[15px] sm:text-[16px] leading-relaxed text-slate-900 space-y-4 prose-p:text-justify prose-p:indent-8 prose-headings:font-sans prose-headings:text-slate-900"
                  dangerouslySetInnerHTML={{
                    __html: documentoAtivo.html || `<p>${documentoAtivo.text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
                  }}
                />
              </div>
            </div>
          ) : (
            /* NENHUM ARQUIVO ABERTO: exibe o Explorador de pastas */
            renderExploradorPrincipal()
          )}
        </div>
      </div>

      {/* 4. RODAPÉ TÉCNICO */}
      <div className="flex items-center justify-between border-t border-white/10 bg-[#0B1020] px-4 py-2 text-xs text-slate-400 shrink-0">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
          <span className="text-cyan-300 font-semibold">Tamanho: 7,05 × 9,38 (Pol) / 1064 × 1417 (Pixels)</span>
          <span className="text-slate-600">|</span>
          <span>DPI Resolução: 151 Horizontal / 151 Vertical</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-bold">Acervo Digital • 7º RI de São Paulo</span>
        </div>

        <div className="flex items-center gap-3">
          {isKenOrTif && pages.length > 0 && (
            <span className="font-mono text-[11px] text-cyan-300 font-semibold bg-slate-800/80 px-2 py-0.5 rounded border border-cyan-500/30">
              Ficha {getFichaRotulo(currentPage - 1).codigo} ({currentPage} de {totalPages})
            </span>
          )}
          <span className="font-mono text-[11px] hidden sm:inline text-slate-400">
            {documentoAtivo?.fileName || '7º RI SP'}
          </span>
        </div>
      </div>
    </div>
  );
}

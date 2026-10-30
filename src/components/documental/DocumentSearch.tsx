'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText,
  ShieldCheck,
  Loader2,
  Sparkles,
  AlertCircle,
  HardDrive,
  CheckCircle2,
  Zap,
  RotateCw,
  Search,
  SlidersHorizontal,
  Layers,
  Copy,
  Check,
  FileCode,
  ArrowLeft,
  History,
  X,
  Eye,
  ChevronDown,
  MoreVertical,
  MonitorUp,
} from 'lucide-react';
import {
  FichaOficialView,
  DadosManifestacao,
  criarDadosManifestacaoPadrao,
  lerFilaFichasOficial,
  CHAVE_FILA_FICHAS_OFICIAL,
  type PayloadFinalizacao,
} from './FichaOficialView';
import {
  carregarFilaConferencia,
  finalizarManifestacaoApi,
  importarFilaAntiga,
  obterManifestacaoApi,
  removerFichaConferencia,
  salvarFichaConferencia,
  type FichaEmConferencia,
} from '@/lib/documental/manifestacoesClient';
import { AssinaturasModal, AnaliseAssinaturaPdf } from './AssinaturasModal';
import { DocumentPreviewModal, DocumentTextResult } from './DocumentPreviewModal';
import {
  abrirDocumentoEmJanela,
  lerPreferenciasJanelas,
  listarMonitores,
  suportaSelecaoDeMonitor,
  tipoDoDocumento,
  type MonitorDisponivel,
} from '@/lib/documental/janelasDocumento';

interface Connector { id: string; name: string; lastSeenAt: string | null }
export function isConnectorOnline(c: Connector): boolean {
  if (!c.lastSeenAt) return false;
  const ts = new Date(c.lastSeenAt).getTime();
  return !Number.isNaN(ts) && Date.now() - ts < 120000;
}
interface Match {
  rootId: string;
  relativePath: string;
  name: string;
  size: number;
  modifiedAt: string;
  matricula?: string;
}
interface SearchState {
  id: string;
  status: string;
  expiresAt: string;
  result: {
    files: Match[];
    partial: boolean;
    unavailableRoots: string[];
    matriculaDetectada?: string;
    matriculas?: string[];
  } | null;
}

interface HistoricoNavegacao {
  query: string;
  job: SearchState | null;
  searchMode: 'simples' | 'cruzada';
  cruzadaParams?: {
    processo: string;
    matricula: string;
    contribuinte: string;
    requerente: string;
  };
  origemTitulo?: string;
  totalDocumentos?: number;
  timestamp: number;
}

export interface RootConfigDisplay {
  label: string;
  drive: string;
  fullName: string;
  pathDisplay: string;
  badgeClass: string;
  dotClass: string;
}

export function getRootInfo(rootId: string): RootConfigDisplay {
  const norm = (rootId || '').toLowerCase().trim();
  if (norm === 'minutas' || norm === 'usucapiao') {
    return {
      label: 'Minutas (W:)',
      drive: 'W:',
      fullName: 'Minutas de Usucapião (Escreventes)',
      pathDisplay: 'W:\\USUCAPIAO',
      badgeClass: 'bg-violet-950/70 text-violet-300 border-violet-500/40 shadow-violet-500/10 hover:bg-violet-900/60',
      dotClass: 'bg-violet-400',
    };
  }
  if (norm === 'processos' || norm === 'processos-email' || norm === 'email') {
    return {
      label: 'Processos (H:)',
      drive: 'H:',
      fullName: 'Processos da Vara (Enviados por E-mail)',
      pathDisplay: 'H:\\PROCESSOS - ENVIADOS POR E-MAIL',
      badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10 hover:bg-emerald-900/60',
      dotClass: 'bg-emerald-400',
    };
  }
  if (norm === 'imagens' || norm === 'acervo') {
    return {
      label: 'Imagens (K:)',
      drive: 'K:',
      fullName: 'Acervo Geral de Imagens (K:\\IMAGENS)',
      pathDisplay: 'K:\\IMAGENS',
      badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-500/40 shadow-amber-500/10 hover:bg-amber-900/60',
      dotClass: 'bg-amber-400',
    };
  }
  if (norm === 'livro2') {
    return {
      label: 'Livro 2 (K:)',
      drive: 'K:',
      fullName: 'Matrículas Digitalizadas do Livro 2 (Registro Geral)',
      pathDisplay: 'K:\\IMAGENS\\LV2',
      badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-500/40 shadow-amber-500/10 hover:bg-amber-900/60',
      dotClass: 'bg-amber-400',
    };
  }
  return {
    label: rootId || 'Local',
    drive: '',
    fullName: rootId,
    pathDisplay: rootId,
    badgeClass: 'bg-[#080D1A] text-cyan-300 border-white/15',
    dotClass: 'bg-cyan-400',
  };
}

export function formatCartorioPath(rootId: string, relativePath: string): string {
  const info = getRootInfo(rootId);
  const rel = (relativePath || '').replace(/^[\\/]+/, '');
  if (info.pathDisplay.endsWith('\\LV2') && rel.toLowerCase().startsWith('lv2\\')) {
    return `${info.pathDisplay}\\${rel.slice(4)}`;
  }
  return `${info.pathDisplay}\\${rel}`;
}

const CHAVE_FILA_VISIVEL = 'fiorix_fila_fichas_visivel';
const CHAVE_TEMPOS_BUSCA = 'fiorix_tempos_busca';

/** Registro de tempo de cada pesquisa (como no app original: "Última pesquisa: 0,9s · 8 resultado(s)") */
interface TempoBusca {
  termo: string;
  ms: number;
  quando: number;
  resultados: number;
  cache?: boolean;
}

function fmtDuracaoBusca(ms: number): string {
  if (ms < 10000) {
    return `${(ms / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}s`;
  }
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${s % 60}s`;
}

function fmtQuandoBusca(ts: number): string {
  return new Date(ts)
    .toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .replace(',', '');
}

/** Quantos PDFs baixados do Connector (até ~200 MB cada) ficam em memória para reabrir na hora */
const MAX_PDFS_LOCAIS_EM_MEMORIA = 4;

/** Link temporário do Connector expirou (15 min) ou o Connector foi reiniciado */
class LinkLocalExpiradoError extends Error {
  constructor() {
    super('O link temporário do documento expirou. Abra o documento novamente.');
  }
}

function fmtMB(bytes: number): string {
  return `${(bytes / 1048576).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
}

export function DocumentSearch() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connectorId, setConnectorId] = useState('');
  const [query, setQuery] = useState('');
  const [job, setJob] = useState<SearchState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historicoBuscas, setHistoricoBuscas] = useState<HistoricoNavegacao[]>([]);

  // Modo de Busca: Simples ou Cruzada
  const [searchMode, setSearchMode] = useState<'simples' | 'cruzada'>('simples');
  const [cruzadaProcesso, setCruzadaProcesso] = useState('');
  const [cruzadaMatricula, setCruzadaMatricula] = useState('');
  const [cruzadaContribuinte, setCruzadaContribuinte] = useState('');
  const [cruzadaRequerente, setCruzadaRequerente] = useState('');

  // Opções de Intervalo de Páginas do OCR
  const [ocrModoPagina, setOcrModoPagina] = useState<'padrao' | 'personalizado' | 'todas'>('padrao');
  const [ocrPaginaInicio, setOcrPaginaInicio] = useState(1);
  const [ocrPaginaFim, setOcrPaginaFim] = useState(15);
  const [mostrarOpcoesOcr, setMostrarOpcoesOcr] = useState(false);

  // Estados para Extração, Assinaturas e Leitura de DOCX
  const [processandoAcao, setProcessandoAcao] = useState<{
    id: string;
    tipo: 'extracao' | 'assinatura' | 'leitura';
    fileName: string;
  } | null>(null);
  const [fichaAberta, setFichaAberta] = useState<DadosManifestacao | null>(null);
  const [fichaAbertaFile, setFichaAbertaFile] = useState<Match | null>(null);
  // Remonta o formulário ao trocar de ficha (Novo Formulário / reabrir da fila)
  const [fichaSessao, setFichaSessao] = useState(0);

  // Fila "Fichas em Conferência com o Oficial": gravada no banco do FIORIX e compartilhada entre as máquinas
  const [fichasPendentes, setFichasPendentes] = useState<FichaEmConferencia[]>([]);
  const [filaCarregando, setFilaCarregando] = useState(true);
  const [filaErro, setFilaErro] = useState('');
  // Quando a ficha aberta é correção de uma manifestação arquivada (Histórico › Nova versão)
  const [fichaVersaoAnteriorId, setFichaVersaoAnteriorId] = useState<string | null>(null);
  // Card da fila oculto por padrão; o usuário pode exibi-lo (preferência persistida)
  const [filaVisivel, setFilaVisivel] = useState(false);

  async function recarregarFila() {
    try {
      setFichasPendentes(await carregarFilaConferencia());
      setFilaErro('');
    } catch (err) {
      setFilaErro(err instanceof Error ? err.message : 'Não foi possível carregar a fila de conferência.');
    } finally {
      setFilaCarregando(false);
    }
  }

  useEffect(() => {
    try {
      setFilaVisivel(window.localStorage.getItem(CHAVE_FILA_VISIVEL) === '1');
    } catch {
      /* localStorage indisponível: mantém oculto */
    }

    let ativo = true;
    (async () => {
      // Migração única: fichas que estavam apenas neste navegador vão para o banco
      const antigas = lerFilaFichasOficial();
      if (antigas.length > 0) {
        try {
          await importarFilaAntiga(antigas);
          window.localStorage.removeItem(CHAVE_FILA_FICHAS_OFICIAL);
        } catch {
          /* mantém a fila antiga no navegador para tentar novamente na próxima abertura */
        }
      }
      if (!ativo) return;
      await recarregarFila();

      // Histórico › "Nova versão": /gestao-documental?reabrir=<id>
      const url = new URL(window.location.href);
      const reabrir = url.searchParams.get('reabrir');
      if (reabrir) {
        url.searchParams.delete('reabrir');
        window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
        try {
          const m = await obterManifestacaoApi(reabrir);
          if (!ativo) return;
          const origem = m.arquivoOrigem;
          const arquivo: Match | null = origem
            ? { rootId: origem.rootId || 'processos', relativePath: origem.relativePath, name: origem.name, size: 0, modifiedAt: '' }
            : null;
          abrirFicha({ ...m.dados, id_ficha: `FICHA-${Date.now()}` }, arquivo, m.status === 'finalizada' ? m.id : null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Não foi possível reabrir a manifestação arquivada.');
        }
      }
    })();

    // Fila compartilhada: atualiza ao voltar para a aba e a cada minuto
    const aoFocar = () => { if (document.visibilityState === 'visible') void recarregarFila(); };
    document.addEventListener('visibilitychange', aoFocar);
    const intervalo = window.setInterval(aoFocar, 60000);
    return () => {
      ativo = false;
      document.removeEventListener('visibilitychange', aoFocar);
      window.clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alternarFilaVisivel() {
    setFilaVisivel(v => {
      const novo = !v;
      try {
        window.localStorage.setItem(CHAVE_FILA_VISIVEL, novo ? '1' : '0');
      } catch {
        /* ignora falha de persistência */
      }
      return novo;
    });
  }

  function abrirFicha(dados: DadosManifestacao, arquivo: Match | null, versaoAnteriorId: string | null = null) {
    setFichaAberta(dados);
    setFichaAbertaFile(arquivo);
    setFichaVersaoAnteriorId(versaoAnteriorId);
    setFichaSessao(s => s + 1);
  }

  function abrirNovoFormulario() {
    abrirFicha(criarDadosManifestacaoPadrao(), null);
  }

  async function salvarFichaNaFila(dados: DadosManifestacao) {
    // Erros sobem para o formulário, que exibe o aviso ao usuário
    await salvarFichaConferencia(dados, fichaAbertaFile);
    await recarregarFila();
  }

  async function finalizarFicha(payload: PayloadFinalizacao) {
    const arquivada = await finalizarManifestacaoApi(payload);
    // A ficha finalizada sai da fila de conferência
    void recarregarFila();
    return arquivada;
  }

  async function removerFichaDaFila(ficha: FichaEmConferencia) {
    if (!window.confirm(`Remover o processo ${ficha.numero_processo} da fila de conferência?\nA fila é compartilhada: ele sairá da lista em todas as máquinas.`)) return;
    try {
      await removerFichaConferencia(ficha.registroId);
    } catch (err) {
      setFilaErro(err instanceof Error ? err.message : 'Não foi possível remover a ficha da fila.');
    }
    await recarregarFila();
  }

  function reabrirFichaDaFila(ficha: FichaEmConferencia) {
    const arquivo: Match | null = ficha.arquivoOrigem
      ? { rootId: ficha.arquivoOrigem.rootId || 'processos', relativePath: ficha.arquivoOrigem.relativePath, name: ficha.arquivoOrigem.name, size: 0, modifiedAt: '' }
      : null;
    abrirFicha({ ...ficha.dados, id_ficha: ficha.id }, arquivo);
  }
  const [assinaturaAberta, setAssinaturaAberta] = useState<{ nome: string; analise: AnaliseAssinaturaPdf } | null>(null);
  const [documentoAberto, setDocumentoAberto] = useState<DocumentTextResult | null>(null);
  const [documentoAbertoFile, setDocumentoAbertoFile] = useState<Match | null>(null);

  // Feedback de cópia do caminho
  const [caminhoCopiado, setCaminhoCopiado] = useState<string | null>(null);

  // Menu suspenso de ações dos três pontinhos por linha
  const [menuAbertoKey, setMenuAbertoKey] = useState<string | null>(null);
  // Posição fixa na viewport: o menu é renderizado em portal para não ser cortado pelo overflow da tabela
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number; maxHeight: number } | null>(null);

  function alternarMenuAcoes(fileKey: string, botao: HTMLElement) {
    if (menuAbertoKey === fileKey) { setMenuAbertoKey(null); return; }
    const r = botao.getBoundingClientRect();
    const espacoAbaixo = window.innerHeight - r.bottom;
    const espacoAcima = r.top;
    const abrirParaCima = espacoAbaixo < 380 && espacoAcima > espacoAbaixo;
    setMenuPos({
      ...(abrirParaCima ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      right: Math.max(8, window.innerWidth - r.right),
      maxHeight: Math.max(160, (abrirParaCima ? espacoAcima : espacoAbaixo) - 14),
    });
    setMenuAbertoKey(fileKey);
  }

  useEffect(() => {
    if (!menuAbertoKey) return;
    const fechar = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-menu-acoes]')) setMenuAbertoKey(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbertoKey(null);
    };
    // Menu fixo não acompanha a rolagem da página/tabela: fecha (exceto rolagem dentro do próprio menu)
    const fecharAoRolar = (e: Event) => {
      const target = e.target;
      if (target instanceof Element && target.closest('[data-menu-acoes]')) return;
      setMenuAbertoKey(null);
    };
    const fecharAoRedimensionar = () => setMenuAbertoKey(null);
    window.addEventListener('mousedown', fechar);
    window.addEventListener('keydown', esc);
    window.addEventListener('scroll', fecharAoRolar, true);
    window.addEventListener('resize', fecharAoRedimensionar);
    return () => {
      window.removeEventListener('mousedown', fechar);
      window.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', fecharAoRolar, true);
      window.removeEventListener('resize', fecharAoRedimensionar);
    };
  }, [menuAbertoKey]);

  // Cronômetro de tempo decorrido e tempo restante estimado para ações pesadas
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [tempoEstimado, setTempoEstimado] = useState(12);
  // Progresso do download do PDF direto do Connector (rede interna)
  const [downloadPdf, setDownloadPdf] = useState<{ recebido: number; total: number } | null>(null);

  useEffect(() => {
    if (!processandoAcao) {
      setTempoDecorrido(0);
      return;
    }
    const inicio = Date.now();
    const interval = setInterval(() => {
      const segundos = Math.floor((Date.now() - inicio) / 1000);
      setTempoDecorrido(segundos);
    }, 500);

    return () => clearInterval(interval);
  }, [processandoAcao]);

  const tempoRestante = Math.max(0, tempoEstimado - tempoDecorrido);

  // Cronômetro para Busca Documental
  const [tempoBuscaDecorrido, setTempoBuscaDecorrido] = useState(0);
  const TEMPO_ESTIMADO_BUSCA = 8;

  useEffect(() => {
    if (!busy) {
      setTempoBuscaDecorrido(0);
      return;
    }
    const inicio = Date.now();
    const interval = setInterval(() => {
      const segundos = Math.floor((Date.now() - inicio) / 1000);
      setTempoBuscaDecorrido(segundos);
    }, 500);

    return () => clearInterval(interval);
  }, [busy]);

  const tempoBuscaRestante = Math.max(0, TEMPO_ESTIMADO_BUSCA - tempoBuscaDecorrido);

  function formatTempoMMSS(segundos: number): string {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Histórico de tempos de pesquisa (persistido localmente)
  const [temposBusca, setTemposBusca] = useState<TempoBusca[]>([]);
  const [mostrarTemposBusca, setMostrarTemposBusca] = useState(false);
  const [duracaoJobMs, setDuracaoJobMs] = useState<number | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAVE_TEMPOS_BUSCA);
      if (raw) setTemposBusca(JSON.parse(raw) as TempoBusca[]);
    } catch {
      /* histórico indisponível */
    }
  }, []);

  function registrarTempoBusca(item: TempoBusca) {
    setDuracaoJobMs(item.ms);
    setTemposBusca(prev => {
      const novo = [item, ...prev].slice(0, 10);
      try {
        window.localStorage.setItem(CHAVE_TEMPOS_BUSCA, JSON.stringify(novo));
      } catch {
        /* ignora falha de persistência */
      }
      return novo;
    });
  }

  // Cache em memória e armazenamento persistente para respostas instantâneas
  const searchCacheRef = useRef<Map<string, SearchState>>(new Map());
  const extrairCacheRef = useRef<Map<string, DadosManifestacao>>(new Map());
  const assinaturasCacheRef = useRef<Map<string, { nome: string; analise: AnaliseAssinaturaPdf }>>(new Map());
  const leituraCacheRef = useRef<Map<string, DocumentTextResult>>(new Map());
  // PDFs baixados do Connector ficam só em memória (blob:), limitados para não estourar a RAM
  const pdfsLocaisRef = useRef<{ fileKey: string; url: string }[]>([]);
  const [isCacheHit, setIsCacheHit] = useState(false);

  useEffect(() => () => {
    for (const p of pdfsLocaisRef.current) URL.revokeObjectURL(p.url);
    pdfsLocaisRef.current = [];
  }, []);

  function isExtracaoValida(data: DadosManifestacao | null | undefined): boolean {
    if (!data) return false;
    return !!(data.requerente || data.imovel || data.contribuinte_sql || data.matricula_transcricao || data.titular_origem);
  }

  function getCachedExtracao(fileKey: string): DadosManifestacao | null {
    if (extrairCacheRef.current.has(fileKey)) {
      const mem = extrairCacheRef.current.get(fileKey)!;
      if (isExtracaoValida(mem)) return mem;
      extrairCacheRef.current.delete(fileKey);
    }
    try {
      const sess = sessionStorage.getItem('fiorix_ext_' + fileKey);
      if (sess) {
        const parsed = JSON.parse(sess);
        if (isExtracaoValida(parsed)) {
          extrairCacheRef.current.set(fileKey, parsed);
          return parsed;
        } else {
          sessionStorage.removeItem('fiorix_ext_' + fileKey);
        }
      }
      const loc = localStorage.getItem('fiorix_ext_' + fileKey);
      if (loc) {
        const parsed = JSON.parse(loc);
        if (parsed.data && Date.now() - parsed.savedAt < 7 * 24 * 3600 * 1000) {
          if (isExtracaoValida(parsed.data)) {
            extrairCacheRef.current.set(fileKey, parsed.data);
            return parsed.data;
          } else {
            localStorage.removeItem('fiorix_ext_' + fileKey);
          }
        }
      }
    } catch {}
    return null;
  }

  function setCachedExtracao(fileKey: string, data: DadosManifestacao) {
    if (!isExtracaoValida(data)) return;
    extrairCacheRef.current.set(fileKey, data);
    try {
      sessionStorage.setItem('fiorix_ext_' + fileKey, JSON.stringify(data));
      localStorage.setItem('fiorix_ext_' + fileKey, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {}
  }

  function getCachedAssinatura(fileKey: string): { nome: string; analise: AnaliseAssinaturaPdf } | null {
    if (assinaturasCacheRef.current.has(fileKey)) {
      return assinaturasCacheRef.current.get(fileKey)!;
    }
    try {
      const sess = sessionStorage.getItem('fiorix_ass_' + fileKey);
      if (sess) {
        const parsed = JSON.parse(sess);
        assinaturasCacheRef.current.set(fileKey, parsed);
        return parsed;
      }
      const loc = localStorage.getItem('fiorix_ass_' + fileKey);
      if (loc) {
        const parsed = JSON.parse(loc);
        if (parsed.data && Date.now() - parsed.savedAt < 7 * 24 * 3600 * 1000) {
          assinaturasCacheRef.current.set(fileKey, parsed.data);
          return parsed.data;
        }
      }
    } catch {}
    return null;
  }

  function setCachedAssinatura(fileKey: string, data: { nome: string; analise: AnaliseAssinaturaPdf }) {
    assinaturasCacheRef.current.set(fileKey, data);
    try {
      sessionStorage.setItem('fiorix_ass_' + fileKey, JSON.stringify(data));
      localStorage.setItem('fiorix_ass_' + fileKey, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {}
  }

  function getCachedLeitura(fileKey: string): DocumentTextResult | null {
    const lower = fileKey.toLowerCase();
    const isKen = lower.endsWith('.ken') || lower.endsWith('.tif') || lower.endsWith('.tiff');
    const isPdf = lower.endsWith('.pdf');

    const isValid = (data: DocumentTextResult | null | undefined): boolean => {
      if (!data) return false;
      if (isKen && (!data.pages || data.pages.length === 0)) return false;
      if (isPdf && !data.pdfDataUrl) return false;
      return true;
    };

    if (leituraCacheRef.current.has(fileKey)) {
      const cached = leituraCacheRef.current.get(fileKey)!;
      if (isValid(cached)) return cached;
      leituraCacheRef.current.delete(fileKey);
    }
    try {
      const sess = sessionStorage.getItem('fiorix_doc_' + fileKey);
      if (sess) {
        const parsed = JSON.parse(sess);
        if (isValid(parsed)) {
          leituraCacheRef.current.set(fileKey, parsed);
          return parsed;
        } else {
          sessionStorage.removeItem('fiorix_doc_' + fileKey);
        }
      }
      const loc = localStorage.getItem('fiorix_doc_' + fileKey);
      if (loc) {
        const parsed = JSON.parse(loc);
        if (parsed.data && Date.now() - parsed.savedAt < 7 * 24 * 3600 * 1000 && isValid(parsed.data)) {
          leituraCacheRef.current.set(fileKey, parsed.data);
          return parsed.data;
        } else {
          localStorage.removeItem('fiorix_doc_' + fileKey);
        }
      }
    } catch {}
    return null;
  }

  function setCachedLeitura(fileKey: string, data: DocumentTextResult) {
    leituraCacheRef.current.set(fileKey, data);
    try {
      sessionStorage.setItem('fiorix_doc_' + fileKey, JSON.stringify(data));
      localStorage.setItem('fiorix_doc_' + fileKey, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {}
  }

  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const carregar = () => {
      fetch('/api/gestao-documental', { cache: 'no-store', signal: controller.signal })
        .then(async response => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          const raw: Connector[] = body.connectors || [];
          const ordenados = [...raw].sort((a, b) => {
            const aOn = isConnectorOnline(a) ? 1 : 0;
            const bOn = isConnectorOnline(b) ? 1 : 0;
            return bOn - aOn;
          });
          setConnectors(ordenados);
          setConnectorId(prev => {
            if (prev && ordenados.some(c => c.id === prev && isConnectorOnline(c))) return prev;
            const online = ordenados.find(isConnectorOnline);
            return online?.id || ordenados[0]?.id || '';
          });
        })
        .catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    };

    carregar();
    const intervalo = setInterval(carregar, 30000);
    return () => {
      controller.abort();
      clearInterval(intervalo);
      abort.current?.abort();
    };
  }, []);

  async function executeSearch(termoBusca: string, forceFresh = false) {
    const trimmed = termoBusca.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Informe um termo de busca com no mínimo 2 caracteres.');
      return;
    }

    abort.current?.abort();
    const inicioBusca = performance.now();
    setDuracaoJobMs(null);
    const cacheKey = `${connectorId}:${trimmed.toLowerCase()}`;
    if (!forceFresh && searchCacheRef.current.has(cacheKey)) {
      const cached = searchCacheRef.current.get(cacheKey)!;
      setJob(cached);
      setIsCacheHit(true);
      setError('');
      setBusy(false);
      registrarTempoBusca({
        termo: trimmed,
        ms: Math.round(performance.now() - inicioBusca),
        quando: Date.now(),
        resultados: cached.result?.files.length ?? 0,
        cache: true,
      });
      return;
    }

    setIsCacheHit(false);
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true); setError(''); setJob(null);
    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId, type: 'search', query: trimmed, forceFresh }), signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const deadline = Date.now() + 125000;
      while (!controller.signal.aborted && Date.now() < deadline) {
        await new Promise<void>(resolve => {
          const onAbort = () => { clearTimeout(timer); resolve(); };
          const timer = setTimeout(() => { controller.signal.removeEventListener('abort', onAbort); resolve(); }, 1200);
          controller.signal.addEventListener('abort', onAbort, { once: true });
        });
        if (controller.signal.aborted) return;
        const result = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store', signal: controller.signal });
        const state = await result.json();
        if (!result.ok) throw new Error(state.error);
        setJob(state);
        if (state.status === 'failed') throw new Error('Não foi possível pesquisar. Verifique o acesso do Connector às pastas.');
        if (state.status === 'complete') {
          searchCacheRef.current.set(cacheKey, state);
          registrarTempoBusca({
            termo: trimmed,
            ms: Math.round(performance.now() - inicioBusca),
            quando: Date.now(),
            resultados: state.result?.files?.length ?? 0,
          });
          return;
        }
      }
      if (!controller.signal.aborted) throw new Error('Pesquisa expirada. Verifique se o módulo documental está habilitado no Connector.');
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Falha na pesquisa.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  function salvarHistoricoAtual(origemTitulo?: string) {
    if (!query && !job) return;
    setHistoricoBuscas(prev => {
      if (prev.length > 0 && prev[prev.length - 1].query === query) {
        return prev;
      }
      return [
        ...prev,
        {
          query,
          job,
          searchMode,
          cruzadaParams: searchMode === 'cruzada' ? {
            processo: cruzadaProcesso,
            matricula: cruzadaMatricula,
            contribuinte: cruzadaContribuinte,
            requerente: cruzadaRequerente,
          } : undefined,
          origemTitulo: origemTitulo || `Processo / Termo "${query}"`,
          totalDocumentos: job?.result?.files?.length ?? 0,
          timestamp: Date.now(),
        }
      ];
    });
  }

  function handleSearchSimples(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    if (job?.status === 'complete' && job.result) {
      const topoQuery = historicoBuscas[historicoBuscas.length - 1]?.query;
      if (query && query !== trimmed && query !== topoQuery) {
        salvarHistoricoAtual(`Pesquisa "${query}"`);
      }
    }
    executeSearch(trimmed);
  }

  function handleSearchCruzada(event: FormEvent) {
    event.preventDefault();
    const termos = [
      cruzadaProcesso.trim(),
      cruzadaMatricula.trim(),
      cruzadaContribuinte.trim(),
      cruzadaRequerente.trim(),
    ].filter(Boolean);

    if (termos.length === 0) {
      setError('Preencha ao menos um dos campos da Busca Cruzada (Processo, Matrícula, SQL ou Requerente).');
      return;
    }
    // " | " separa os campos: o Connector trata cada um como critério próprio e une os resultados
    // (arquivos do processo + imagem da matrícula no Livro 2), em vez de exigir todos no mesmo arquivo.
    const combinedQuery = termos.join(' | ');
    if (job?.status === 'complete' && job.result && query && query !== combinedQuery) {
      salvarHistoricoAtual(`Busca "${query}"`);
    }
    setQuery(combinedQuery);
    executeSearch(combinedQuery);
  }

  function buscarMatriculaNoLivro2(termoMatricula: string, tituloOrigem?: string) {
    const numeros = termoMatricula.replace(/[^\d]/g, '');
    const queryBusca = numeros && numeros.length >= 2 ? numeros : termoMatricula.trim();
    if (!queryBusca || queryBusca.length < 2) return;

    if (query && query !== queryBusca) {
      salvarHistoricoAtual(tituloOrigem || (query ? `Processo / Termo "${query}"` : 'Pesquisa anterior'));
    }

    setQuery(queryBusca);
    setSearchMode('simples');
    executeSearch(queryBusca);
  }

  function voltarTelaAnterior() {
    if (historicoBuscas.length === 0) return;
    const novoHistorico = [...historicoBuscas];
    const anterior = novoHistorico.pop()!;
    setHistoricoBuscas(novoHistorico);

    setQuery(anterior.query);
    setSearchMode(anterior.searchMode);
    if (anterior.cruzadaParams) {
      setCruzadaProcesso(anterior.cruzadaParams.processo);
      setCruzadaMatricula(anterior.cruzadaParams.matricula);
      setCruzadaContribuinte(anterior.cruzadaParams.contribuinte);
      setCruzadaRequerente(anterior.cruzadaParams.requerente);
    }
    if (anterior.job) {
      setJob(anterior.job);
      setIsCacheHit(true);
      setError('');
      setBusy(false);
    } else {
      executeSearch(anterior.query);
    }
  }

  async function extrairPeticao(file: Match, forceFresh = false) {
    const fileKey = `${file.rootId}:${file.relativePath}`;
    if (!forceFresh) {
      const cached = getCachedExtracao(fileKey);
      if (cached) {
        abrirFicha(cached, file);
        return;
      }
    } else {
      extrairCacheRef.current.delete(fileKey);
      try {
        sessionStorage.removeItem('fiorix_ext_' + fileKey);
        localStorage.removeItem('fiorix_ext_' + fileKey);
      } catch {}
    }

    // Configuração de intervalo de páginas para OCR
    let pageStart: number | undefined = undefined;
    let pageEnd: number | undefined = undefined;
    if (ocrModoPagina === 'padrao') {
      pageStart = 1;
      pageEnd = 15;
    } else if (ocrModoPagina === 'personalizado') {
      pageStart = Math.max(1, ocrPaginaInicio);
      pageEnd = Math.max(pageStart, ocrPaginaFim);
    } // 'todas' deixa undefined para ler o arquivo inteiro

    setTempoEstimado(12);
    setProcessandoAcao({ id: fileKey, tipo: 'extracao', fileName: file.name });
    setError('');
    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId,
          type: 'extract_petition',
          rootId: file.rootId,
          relativePath: file.relativePath,
          pageStart,
          pageEnd,
          forceFresh,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);

      if (body.status === 'complete' && body.result) {
        setCachedExtracao(fileKey, body.result);
        abrirFicha(body.result, file);
        return;
      }

      const deadline = Date.now() + 60000;
      let tentativa = 0;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, tentativa === 0 ? 300 : 800));
        tentativa++;
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          setCachedExtracao(fileKey, state.result);
          abrirFicha(state.result, file);
          return;
        }
        if (state.status === 'failed') {
          throw new Error(state.error || 'Falha na extração no servidor local. Verifique se o arquivo é um documento legível (PDF, DOC ou DOCX).');
        }
      }
      throw new Error('Tempo limite excedido na extração da petição.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao extrair dados da petição.');
    } finally {
      setProcessandoAcao(null);
    }
  }

  async function analisarAssinaturas(file: Match, forceFresh = false) {
    const fileKey = `${file.rootId}:${file.relativePath}`;
    if (!forceFresh) {
      const cached = getCachedAssinatura(fileKey);
      if (cached) {
        setAssinaturaAberta(cached);
        return;
      }
    } else {
      assinaturasCacheRef.current.delete(fileKey);
      try {
        sessionStorage.removeItem('fiorix_ass_' + fileKey);
        localStorage.removeItem('fiorix_ass_' + fileKey);
      } catch {}
    }
    setTempoEstimado(8);
    setProcessandoAcao({ id: fileKey, tipo: 'assinatura', fileName: file.name });
    setError('');
    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId,
          type: 'analyze_signatures',
          rootId: file.rootId,
          relativePath: file.relativePath,
          forceFresh,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);

      if (body.status === 'complete' && body.result) {
        const item = { nome: file.name, analise: body.result };
        setCachedAssinatura(fileKey, item);
        setAssinaturaAberta(item);
        return;
      }

      const deadline = Date.now() + 60000;
      let tentativa = 0;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, tentativa === 0 ? 300 : 800));
        tentativa++;
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          const item = { nome: file.name, analise: state.result };
          setCachedAssinatura(fileKey, item);
          setAssinaturaAberta(item);
          return;
        }
        if (state.status === 'failed') {
          throw new Error('Falha na auditoria de assinaturas no servidor local.');
        }
      }
      throw new Error('Tempo limite excedido na análise de assinaturas.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao analisar assinaturas.');
    } finally {
      setProcessandoAcao(null);
    }
  }

  /** Mostra o documento no visualizador ou, se o usuário preferir, direto em janela separada (outro monitor) */
  async function exibirDocumento(resultado: DocumentTextResult, file: Match) {
    const pref = lerPreferenciasJanelas();
    if (pref.sempreEmJanela) {
      const indice = pref.monitorPorTipo[tipoDoDocumento(resultado)];
      let monitor: MonitorDisponivel | null = null;
      if (indice !== undefined && suportaSelecaoDeMonitor()) {
        const monitores = await listarMonitores();
        monitor = monitores.find(m => m.indice === indice) ?? null;
      }
      const item = { documento: resultado, relativePath: file.relativePath, rootId: file.rootId };
      if (abrirDocumentoEmJanela(item, monitor)) return;
      setError('O navegador bloqueou a janela separada. Permita pop-ups para este site para abrir os documentos em outro monitor.');
    }
    setDocumentoAberto(resultado);
    setDocumentoAbertoFile(file);
  }

  async function visualizarDocumento(file: Match, forceFresh = false) {
    const fileKey = `${file.rootId}:${file.relativePath}`;
    if (!forceFresh) {
      const cached = getCachedLeitura(fileKey);
      if (cached) {
        void exibirDocumento(cached, file);
        return;
      }
    } else {
      leituraCacheRef.current.delete(fileKey);
      try {
        sessionStorage.removeItem('fiorix_doc_' + fileKey);
        localStorage.removeItem('fiorix_doc_' + fileKey);
      } catch {}
    }
    setTempoEstimado(5);
    setProcessandoAcao({ id: fileKey, tipo: 'leitura', fileName: file.name });
    setError('');
    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId,
          type: 'read_document_text',
          rootId: file.rootId,
          relativePath: file.relativePath,
          forceFresh,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);

      if (body.status === 'complete' && body.result) {
        await abrirResultadoLeitura(fileKey, body.result, file);
        return;
      }

      const deadline = Date.now() + 60000;
      let tentativa = 0;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, tentativa === 0 ? 300 : 800));
        tentativa++;
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          await abrirResultadoLeitura(fileKey, state.result, file);
          return;
        }
        if (state.status === 'failed') {
          throw new Error('Falha ao processar a leitura do documento no servidor local.');
        }
      }
      throw new Error('Tempo limite excedido na leitura do documento.');
    } catch (err) {
      if (err instanceof LinkLocalExpiradoError && !forceFresh) {
        // Ticket expirado ou Connector reiniciado: pede um novo link uma única vez
        setDownloadPdf(null);
        await visualizarDocumento(file, true);
        return;
      }
      setError(err instanceof Error ? err.message : 'Falha ao ler o documento.');
    } finally {
      setDownloadPdf(null);
      setProcessandoAcao(null);
    }
  }

  async function abrirResultadoLeitura(fileKey: string, result: DocumentTextResult, file: Match) {
    if (result.localUrl && !result.pdfDataUrl) {
      const blobUrl = await baixarPdfLocal(result.localUrl, result.size || 0);
      const pronto: DocumentTextResult = { ...result, pdfDataUrl: blobUrl, localUrl: undefined };
      pdfsLocaisRef.current.push({ fileKey, url: blobUrl });
      while (pdfsLocaisRef.current.length > MAX_PDFS_LOCAIS_EM_MEMORIA) {
        const antigo = pdfsLocaisRef.current.shift()!;
        if (leituraCacheRef.current.get(antigo.fileKey)?.pdfDataUrl === antigo.url) {
          leituraCacheRef.current.delete(antigo.fileKey);
        }
        URL.revokeObjectURL(antigo.url);
      }
      // Só em memória: blob: não sobrevive a recarregar a página e o PDF não deve ir para o storage
      leituraCacheRef.current.set(fileKey, pronto);
      void exibirDocumento(pronto, file);
      return;
    }
    setCachedLeitura(fileKey, result);
    void exibirDocumento(result, file);
  }

  /** Baixa o PDF direto do servidor de arquivos do Connector (rede interna) com progresso. */
  async function baixarPdfLocal(url: string, tamanhoEsperado: number): Promise<string> {
    setDownloadPdf({ recebido: 0, total: tamanhoEsperado });
    let response: Response;
    try {
      response = await fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    } catch {
      throw new Error(
        'Não foi possível baixar o PDF do FIORIX Connector na rede interna. Verifique se o Connector está em execução, ' +
        'se a porta do servidor de arquivos está liberada no firewall e se o certificado HTTPS do Connector é confiável nesta estação.'
      );
    }
    if (response.status === 404) throw new LinkLocalExpiradoError();
    if (!response.ok) throw new Error(`O Connector recusou o download do PDF (HTTP ${response.status}).`);

    const total = Number(response.headers.get('Content-Length')) || tamanhoEsperado;
    const reader = response.body?.getReader();
    if (!reader) return URL.createObjectURL(await response.blob());
    const partes: Uint8Array[] = [];
    let recebido = 0;
    let ultimaAtualizacao = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      partes.push(value);
      recebido += value.length;
      const agora = performance.now();
      if (agora - ultimaAtualizacao > 150) {
        ultimaAtualizacao = agora;
        setDownloadPdf({ recebido, total });
      }
    }
    setDownloadPdf({ recebido, total: Math.max(total, recebido) });
    return URL.createObjectURL(new Blob(partes as BlobPart[], { type: 'application/pdf' }));
  }



  function copiarCaminho(file: Match) {
    const fullPath = formatCartorioPath(file.rootId, file.relativePath);
    navigator.clipboard.writeText(fullPath).then(() => {
      setCaminhoCopiado(file.relativePath);
      setTimeout(() => setCaminhoCopiado(null), 2500);
    });
  }

  return (
    <section className="space-y-6">
      {/* Estação: Formulário para Manifestação (Ficha do Oficial + Manifestação) */}
      {fichaAberta && (
        <FichaOficialView
          key={fichaSessao}
          dadosIniciais={fichaAberta}
          arquivoOrigem={fichaAbertaFile}
          connectorId={connectorId}
          onClose={() => {
            setFichaAberta(null);
            setFichaAbertaFile(null);
          }}
          onReextrair={fichaAbertaFile ? () => {
            const targetFile = fichaAbertaFile;
            setFichaAberta(null);
            setFichaAbertaFile(null);
            extrairPeticao(targetFile, true);
          } : undefined}
          onBuscarMatriculaNaLista={(matricula) => {
            salvarHistoricoAtual(`Ficha de Conferência / ${fichaAbertaFile?.name || 'Processo'}`);
            setSearchMode('cruzada');
            setCruzadaMatricula(matricula);
            setQuery(matricula);
            executeSearch(matricula);
            setFichaAberta(null);
            setFichaAbertaFile(null);
          }}
          onVisualizarDocumento={(file) => {
            visualizarDocumento(file);
          }}
          onSalvarNaFila={salvarFichaNaFila}
          onNovoFormulario={abrirNovoFormulario}
          onFinalizar={finalizarFicha}
          versaoAnteriorId={fichaVersaoAnteriorId}
        />
      )}

      <div className={fichaAberta ? 'hidden' : 'space-y-4'}>
      {/* Card Principal de Pesquisa (Padrão FIORIX) — barra compacta para dar destaque aos resultados */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-3 text-white shadow-sm backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="seletor-servidor-cartorio"
            value={connectorId}
            onChange={event => {
              setConnectorId(event.target.value);
              if (error.includes('sem sinal')) setError('');
            }}
            disabled={busy || !!processandoAcao}
            title="Servidor do cartório"
            aria-label="Servidor do cartório"
            className="h-9 max-w-[210px] rounded-lg border border-white/15 bg-[#080D1A] px-2.5 text-xs text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
          >
            {connectors.length === 0 ? (
              <option value="" disabled className="bg-[#0B1020] text-slate-400">
                Localizando servidores…
              </option>
            ) : (
              connectors.map(connector => {
                const online = isConnectorOnline(connector);
                return (
                  <option key={connector.id} value={connector.id} className="bg-[#0B1020] text-white">
                    {online ? '🟢' : '🔴'} {connector.name} {online ? '' : '(Sem sinal)'}
                  </option>
                );
              })
            )}
          </select>

          {/* Formulário: Busca Simples (na mesma linha) */}
          {searchMode === 'simples' ? (
            <form onSubmit={handleSearchSimples} className="flex min-w-[260px] flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  id="campo-pesquisa-simples"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  minLength={2}
                  maxLength={120}
                  placeholder="Processo, matrícula ou nome de arquivo (ex.: 1035968, Basilio, 123.456)"
                  aria-label="Pesquisar processo, matrícula ou nome de arquivo"
                  required
                  disabled={busy || !!processandoAcao}
                  className="block h-9 w-full rounded-lg border border-white/15 bg-[#080D1A] pl-9 pr-3 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 placeholder:text-white/35"
                />
              </div>
              {historicoBuscas.length > 0 && (
                <button
                  type="button"
                  onClick={voltarTelaAnterior}
                  title={`Voltar para tela anterior: ${historicoBuscas[historicoBuscas.length - 1].query}`}
                  aria-label="Voltar para tela anterior"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition active:scale-95"
                >
                  <ArrowLeft className="h-4 w-4 text-slate-300" />
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !connectorId || !!processandoAcao}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600 hover:bg-blue-500 px-4 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition active:scale-95"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span className="font-mono">{formatTempoMMSS(tempoBuscaDecorrido)}</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 text-white" />
                    <span>Pesquisar</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <p className="min-w-0 flex-1 truncate text-[11px] text-white/45" title="Cruza os termos especificados em nome de arquivo e diretórios para localizar expedientes conexos.">
              <Layers className="mr-1 inline h-3 w-3 text-amber-300" />
              Busca cruzada: cruza os termos em nomes de arquivo e diretórios.
            </p>
          )}

          {/* Abas: Busca Simples vs Busca Cruzada (Segmented Control discreto com cores distintas) */}
          <div className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-700/70 bg-[#080D1A] p-0.5" role="tablist" aria-label="Tipo de busca">
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'simples'}
              onClick={() => setSearchMode('simples')}
              title="Busca simples"
              className={`inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition ${
                searchMode === 'simples'
                  ? 'bg-slate-800 text-slate-100 border border-slate-600/70 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className={`h-3.5 w-3.5 ${searchMode === 'simples' ? 'text-sky-400' : 'text-slate-400'}`} />
              <span>Simples</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={searchMode === 'cruzada'}
              onClick={() => setSearchMode('cruzada')}
              title="Busca cruzada (multicritérios)"
              className={`inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium transition ${
                searchMode === 'cruzada'
                  ? 'bg-amber-950/70 text-amber-200 border border-amber-600/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className={`h-3.5 w-3.5 ${searchMode === 'cruzada' ? 'text-amber-400' : 'text-slate-400'}`} />
              <span>Cruzada</span>
            </button>
          </div>

          {/* Aviso de privacidade (antes um banner) */}
          <span
            className="inline-flex h-9 w-6 shrink-0 items-center justify-center text-slate-500 hover:text-slate-400 transition"
            title="Busca pontual e análise local via motor Rust/CLI e Mammoth integrado. Nenhum arquivo original deixa a rede interna do cartório."
            aria-label="Processamento local: nenhum arquivo original deixa a rede interna do cartório"
            role="img"
          >
            <HardDrive className="h-4 w-4" />
          </span>
        </div>

        {/* Formulário: Busca Cruzada Multi-Critérios */}
        {searchMode === 'cruzada' && (
          <form onSubmit={handleSearchCruzada} className="mt-2 flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
            <input
              value={cruzadaProcesso}
              onChange={event => setCruzadaProcesso(event.target.value)}
              placeholder="Processo / CNJ"
              aria-label="Processo Judicial / CNJ"
              title="Processo Judicial / CNJ (ex.: 1035968-12 ou 0000001)"
              disabled={busy || !!processandoAcao}
              className="h-9 min-w-[150px] flex-1 rounded-lg border border-white/15 bg-[#080D1A] px-3 text-xs text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 placeholder:text-white/35"
            />
            <input
              value={cruzadaMatricula}
              onChange={event => setCruzadaMatricula(event.target.value)}
              placeholder="Matrícula / Transcrição"
              aria-label="Matrícula ou Transcrição"
              title="Matrícula ou Transcrição (ex.: 123.456 ou 45.890)"
              disabled={busy || !!processandoAcao}
              className="h-9 min-w-[150px] flex-1 rounded-lg border border-white/15 bg-[#080D1A] px-3 text-xs text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 placeholder:text-white/35"
            />
            <input
              value={cruzadaContribuinte}
              onChange={event => setCruzadaContribuinte(event.target.value)}
              placeholder="Contribuinte (SQL / IPTU)"
              aria-label="Contribuinte (SQL / IPTU)"
              title="Contribuinte (SQL / IPTU) (ex.: 012.345.6789-1)"
              disabled={busy || !!processandoAcao}
              className="h-9 min-w-[150px] flex-1 rounded-lg border border-white/15 bg-[#080D1A] px-3 text-xs text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 placeholder:text-white/35"
            />
            <input
              value={cruzadaRequerente}
              onChange={event => setCruzadaRequerente(event.target.value)}
              placeholder="Requerente / Parte"
              aria-label="Requerente ou Parte"
              title="Requerente ou Parte (ex.: Basilio, Ficticia)"
              disabled={busy || !!processandoAcao}
              className="h-9 min-w-[150px] flex-1 rounded-lg border border-white/15 bg-[#080D1A] px-3 text-xs text-white focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 placeholder:text-white/35"
            />
            <div className="flex shrink-0 items-center gap-2">
              {historicoBuscas.length > 0 && (
                <button
                  type="button"
                  onClick={voltarTelaAnterior}
                  title={`Voltar para tela anterior: ${historicoBuscas[historicoBuscas.length - 1].query}`}
                  aria-label="Voltar para tela anterior"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition active:scale-95"
                >
                  <ArrowLeft className="h-4 w-4 text-slate-300" />
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !connectorId || !!processandoAcao}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-700 hover:bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition active:scale-95"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Pesquisando…</span>
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4 text-emerald-200" />
                    <span>Buscar</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Filtros e tempos de pesquisa (como no app original) */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-white/5 pt-2 text-[11px]">
          <button
            type="button"
            id="toggle-filtros-pesquisa"
            onClick={() => setMostrarOpcoesOcr(!mostrarOpcoesOcr)}
            aria-expanded={mostrarOpcoesOcr}
            className="inline-flex items-center gap-1 font-semibold text-white/65 hover:text-cyan-300 transition"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mostrarOpcoesOcr ? '' : '-rotate-90'}`} />
            <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
            <span>Filtros</span>
            <span className="font-normal text-white/40">
              · OCR {ocrModoPagina === 'padrao' ? 'págs 1 a 15' : ocrModoPagina === 'personalizado' ? `págs ${ocrPaginaInicio} a ${ocrPaginaFim}` : 'todas as páginas'}
            </span>
          </button>

          {busy ? (
            <span className="inline-flex items-center gap-1 text-white/55">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
              Pesquisando… <strong className="font-mono text-cyan-300">{formatTempoMMSS(tempoBuscaDecorrido)}</strong>
            </span>
          ) : temposBusca.length > 0 ? (
            <button
              type="button"
              id="toggle-tempos-pesquisa"
              onClick={() => setMostrarTemposBusca(v => !v)}
              aria-expanded={mostrarTemposBusca}
              className="inline-flex items-center gap-1 font-semibold text-white/65 hover:text-cyan-300 transition"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mostrarTemposBusca ? '' : '-rotate-90'}`} />
              <History className="h-3.5 w-3.5 text-cyan-400" />
              <span>
                Última pesquisa: <strong className="text-white/85">{fmtDuracaoBusca(temposBusca[0].ms)}</strong> · {temposBusca[0].resultados} resultado(s)
                {temposBusca[0].cache && <span className="font-normal text-cyan-400/70"> · cache</span>}
              </span>
            </button>
          ) : null}
        </div>

        {mostrarTemposBusca && !busy && temposBusca.length > 0 && (
          <ul id="historico-tempos-busca" className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 animate-in slide-in-from-top-1 duration-200">
            {temposBusca.map((t, i) => (
              <li key={`${t.quando}-${i}`}>
                <button
                  type="button"
                  onClick={() => { setSearchMode('simples'); setQuery(t.termo); executeSearch(t.termo); }}
                  title={`Repetir pesquisa "${t.termo}"`}
                  className="w-full rounded-lg border border-white/10 bg-[#080D1A] px-2.5 py-1.5 text-left text-[11px] transition hover:border-cyan-500/40"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-white/85">{t.termo || '(sem termo)'}</span>
                    <span className="shrink-0 font-mono font-bold text-cyan-300">{fmtDuracaoBusca(t.ms)}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-white/40">
                    <span>{fmtQuandoBusca(t.quando)}</span>
                    <span>{t.resultados} resultado(s)</span>
                    {t.cache && <span className="text-cyan-400/70">cache</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {mostrarOpcoesOcr && (
          <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-[#080D1A] px-3 py-2.5 animate-in slide-in-from-top-1 duration-200">
            <p className="text-[11px] leading-relaxed text-white/50">
              Busca recursiva em <strong className="text-white/75">W:\USUCAPIAO</strong> (minutas dos escreventes),{' '}
              <strong className="text-white/75">H:\PROCESSOS - ENVIADOS POR E-MAIL</strong> e{' '}
              <strong className="text-white/75">K:\IMAGENS\LV2</strong>. Processamento local: nenhum arquivo original deixa a rede do cartório.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="font-semibold text-white/70">OCR dos PDFs:</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="ocrModo"
                  value="padrao"
                  checked={ocrModoPagina === 'padrao'}
                  onChange={() => setOcrModoPagina('padrao')}
                  className="text-cyan-500 focus:ring-0"
                />
                <span>Primeiras 15 páginas (Rápido)</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="ocrModo"
                  value="personalizado"
                  checked={ocrModoPagina === 'personalizado'}
                  onChange={() => setOcrModoPagina('personalizado')}
                  className="text-cyan-500 focus:ring-0"
                />
                <span>Intervalo personalizado</span>
              </label>

              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="ocrModo"
                  value="todas"
                  checked={ocrModoPagina === 'todas'}
                  onChange={() => setOcrModoPagina('todas')}
                  className="text-cyan-500 focus:ring-0"
                />
                <span>Arquivo completo</span>
              </label>

              {ocrModoPagina === 'personalizado' && (
                <div className="inline-flex items-center gap-2 pl-3 border-l border-white/15">
                  <span className="text-white/50">De pág:</span>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={ocrPaginaInicio}
                    onChange={e => setOcrPaginaInicio(parseInt(e.target.value) || 1)}
                    className="w-16 rounded-lg border border-white/20 bg-[#0B1020] px-2 py-1 text-center font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                  <span className="text-white/50">até:</span>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={ocrPaginaFim}
                    onChange={e => setOcrPaginaFim(parseInt(e.target.value) || 1)}
                    className="w-16 rounded-lg border border-white/20 bg-[#0B1020] px-2 py-1 text-center font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FILA DE FICHAS EM CONFERÊNCIA COM O OFICIAL */}
      <div id="fila-fichas-oficial" className={`rounded-2xl border border-[#E2E8F0] bg-[#F5F2ED] text-[#1E293B] shadow-sm transition-all ${filaVisivel ? 'p-4' : 'px-4 py-2'}`}>
        <div className={`flex flex-wrap items-center justify-between gap-2 ${filaVisivel ? 'mb-2.5' : ''}`}>
          <button
            type="button"
            id="toggle-fila-fichas-oficial"
            onClick={alternarFilaVisivel}
            aria-expanded={filaVisivel}
            aria-controls="fila-fichas-oficial-conteudo"
            title={filaVisivel ? 'Ocultar formulários em conferência' : 'Mostrar formulários em conferência'}
            className="group flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B]"
          >
            <ChevronDown className={`h-4 w-4 shrink-0 text-[#64748B] transition-transform ${filaVisivel ? '' : '-rotate-90'}`} />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              ⏳ FORMULÁRIOS EM CONFERÊNCIA COM O OFICIAL ({fichasPendentes.length})
            </h3>
            {filaVisivel ? (
              <span className="text-[10px] text-gray-500">(Formulários físicos impressos aguardando retorno de Dr. Ademar Fioranelli — fila compartilhada entre as máquinas do setor)</span>
            ) : (
              <span className="text-[10px] font-semibold text-[#64748B] group-hover:text-[#1E293B]">Mostrar</span>
            )}
          </button>
          {filaVisivel && (
            <button
              type="button"
              onClick={() => { setFilaCarregando(true); void recarregarFila(); }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-[#475569] hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B]"
              title="Atualizar a fila (inclui formulários salvos em outras máquinas)"
            >
              <RotateCw className={`h-3 w-3 ${filaCarregando ? 'animate-spin' : ''}`} aria-hidden="true" />
              Atualizar
            </button>
          )}
        </div>
        {filaVisivel && (
        <div id="fila-fichas-oficial-conteudo">
        {filaErro && (
          <p role="alert" className="mb-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800">{filaErro}</p>
        )}
        {filaCarregando && fichasPendentes.length === 0 ? (
          <p className="py-1 text-xs italic text-gray-500">Carregando a fila de conferência…</p>
        ) : fichasPendentes.length === 0 ? (
          <p className="py-1 text-xs italic text-gray-500">Nenhum formulário aguardando conferência do Oficial no momento.</p>
        ) : (
          <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
            {fichasPendentes.map(ficha => (
              <div
                key={ficha.registroId}
                role="button"
                tabIndex={0}
                onClick={() => reabrirFichaDaFila(ficha)}
                onKeyDown={e => { if (e.key === 'Enter') reabrirFichaDaFila(ficha); }}
                title="Reabrir formulário para revisão e geração da manifestação oficial"
                className="group flex cursor-pointer items-start justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-[#94A3B8] hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded border border-[#CBD5E1] bg-[#F8F7F4] px-1.5 py-0.5 font-mono text-xs font-bold">{ficha.numero_processo}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">{ficha.subdistrito}</span>
                  </div>
                  <div className="mt-1 truncate text-xs font-semibold text-gray-800" title={ficha.requerente}>{ficha.requerente}</div>
                  <div className="mt-0.5 truncate text-[10px] text-gray-500" title={ficha.imovel}>
                    Tr/Mat: {ficha.matricula_transcricao} • {ficha.data_criacao}
                  </div>
                  {(ficha.atualizadoPorNome || ficha.criadoPorNome) && (
                    <div className="mt-0.5 truncate text-[10px] font-semibold text-gray-600">
                      Salvo por {ficha.atualizadoPorNome || ficha.criadoPorNome}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); void removerFichaDaFila(ficha); }}
                  className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-[#F8F4F0] hover:text-[#44403C]"
                  title="Remover formulário da fila de pendentes"
                  aria-label="Remover formulário da fila"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        </div>
        )}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-[#0B1020]/95 p-4 text-xs text-rose-200 shadow-sm backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            <div>
              <p className="font-semibold">{error}</p>
              {error.includes('sem sinal') && (
                <p className="mt-0.5 text-[11px] text-rose-300/80">
                  O servidor selecionado não respondeu nos últimos 2 minutos. Certifique-se de selecionar o conector que está ativo (🟢 <strong>Connector 7º RI SP - Produção</strong>).
                </p>
              )}
            </div>
          </div>
          {error.includes('sem sinal') && connectors.some(isConnectorOnline) && (
            <button
              type="button"
              onClick={() => {
                const online = connectors.find(isConnectorOnline);
                if (online) {
                  setConnectorId(online.id);
                  setError('');
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 shadow-sm"
            >
              <span>Alternar para conector online (🟢)</span>
            </button>
          )}
        </div>
      )}

      <div aria-live="polite" className="space-y-4">
        {/* Barra de Progresso da Busca */}
        {busy && (
          <div className="rounded-[24px] border border-cyan-500/30 bg-[#0B1020]/95 p-5 sm:p-6 text-white shadow-sm backdrop-blur-xl transition">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-cyan-200">
                    Pesquisando documentos nos discos autorizados do servidor local…
                  </h4>
                  <p className="text-[11px] font-mono text-white/50">
                    Termo: <strong className="text-white font-semibold">"{query}"</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#080D1A] px-3.5 py-2 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 text-[11px]">Tempo decorrido:</span>
                  <strong className="text-cyan-300 font-semibold">{formatTempoMMSS(tempoBuscaDecorrido)}</strong>
                </div>
                <span className="text-white/20">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 text-[11px]">Tempo restante estimado:</span>
                  <strong className={tempoBuscaRestante > 0 ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {tempoBuscaRestante > 0 ? `~${formatTempoMMSS(tempoBuscaRestante)}` : 'Finalizando…'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(95, Math.max(8, Math.round((tempoBuscaDecorrido / TEMPO_ESTIMADO_BUSCA) * 100)))}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Card de Progresso de Extração / Assinaturas / Leitura */}
        {processandoAcao && (
          <div className="rounded-[24px] border border-cyan-500/30 bg-[#0B1020]/95 p-5 sm:p-6 text-white shadow-sm backdrop-blur-xl transition">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-cyan-200">
                    {processandoAcao.tipo === 'extracao'
                      ? 'Extraindo Formulário do Oficial via CLI Rust local…'
                      : processandoAcao.tipo === 'assinatura'
                      ? 'Auditando assinaturas eletrônicas PAdES via CLI Rust…'
                      : downloadPdf
                      ? 'Baixando PDF direto do Connector (rede interna)…'
                      : 'Carregando minuta / documento via Mammoth…'}
                  </h4>
                  <p className="text-[11px] font-mono text-white/50 truncate max-w-md">
                    {processandoAcao.fileName}
                    {downloadPdf && (
                      <span className="ml-2 text-cyan-300">
                        {fmtMB(downloadPdf.recebido)} de {fmtMB(downloadPdf.total)}
                        {downloadPdf.total > 0 && ` (${Math.min(100, Math.round((downloadPdf.recebido / downloadPdf.total) * 100))}%)`}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-[#080D1A] px-3.5 py-2 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 text-[11px]">Tempo decorrido:</span>
                  <strong className="text-cyan-300 font-semibold">{formatTempoMMSS(tempoDecorrido)}</strong>
                </div>
                <span className="text-white/20">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 text-[11px]">Tempo restante estimado:</span>
                  <strong className={tempoRestante > 0 ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {tempoRestante > 0 ? `~${formatTempoMMSS(tempoRestante)}` : 'Finalizando…'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300 ease-out"
                style={{
                  width: downloadPdf && downloadPdf.total > 0
                    ? `${Math.min(100, Math.max(3, Math.round((downloadPdf.recebido / downloadPdf.total) * 100)))}%`
                    : `${Math.min(95, Math.max(8, Math.round((tempoDecorrido / tempoEstimado) * 100)))}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Tabela de Resultados */}
        {job?.status === 'complete' && job.result && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between text-xs text-white/70 gap-2">
              <div className="flex items-center gap-2">
                <span>
                  <strong className="text-white">{job.result.files.length}</strong> documento(s) localizado(s)
                  {duracaoJobMs !== null && <> em <strong className="text-cyan-300">{fmtDuracaoBusca(duracaoJobMs)}</strong></>}
                  {job.result.partial && ' (resultado parcial devido a limite de pesquisa)'}.
                </span>
                {isCacheHit && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-950/90 border border-cyan-500/50 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
                    ⚡ Resposta instantânea (Cache em memória)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isCacheHit && (
                  <button
                    type="button"
                    onClick={() => executeSearch(query, true)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold transition"
                  >
                    Buscar novamente no disco
                  </button>
                )}
                {job.result.unavailableRoots.length > 0 && (
                  <span className="text-amber-400">Pastas sem acesso: {job.result.unavailableRoots.join(', ')}</span>
                )}
              </div>
            </div>

            {/* Destaque da Matrícula Vinculada aos Autos (Padrão FIORIX) */}
            {(() => {
              const matriculaProcesso =
                job.result.matriculaDetectada ||
                job.result.files.find(f => f.matricula)?.matricula ||
                job.result.files
                  .map(f => getCachedExtracao(`${f.rootId}:${f.relativePath}`)?.matricula_transcricao)
                  .find(Boolean);

              const arquivoOrigemMatricula =
                job.result.files.find(f => f.matricula)?.name ||
                job.result.files.find(f => getCachedExtracao(`${f.rootId}:${f.relativePath}`)?.matricula_transcricao)?.name;

              if (!matriculaProcesso) return null;

              // Se a consulta atual já for a própria matrícula ou os arquivos encontrados já forem imagens do Livro 2 (.KEN / .TIF),
              // não exibir o card repetido para localizar no Livro 2 (evita excesso e redundância)
              const queryDigits = query.replace(/\D/g, '');
              const matDigits = matriculaProcesso.replace(/\D/g, '');
              const apenasImagensMatricula =
                job.result.files.length > 0 &&
                job.result.files.every(f => {
                  const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
                  return ext === '.ken' || ext === '.tif' || ext === '.tiff';
                });

              if (apenasImagensMatricula || (queryDigits && matDigits && (queryDigits === matDigits || matDigits.endsWith(queryDigits) || queryDigits.endsWith(matDigits)))) {
                return null;
              }

              const arquivoKenLocalizado = job.result.files.find(f => {
                const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
                if (ext !== '.ken' && ext !== '.tif' && ext !== '.tiff') return false;
                const fNum = f.name.replace(/[^\d]/g, '');
                const mNum = matriculaProcesso.replace(/[^\d]/g, '');
                return fNum.endsWith(mNum) || mNum.endsWith(fNum);
              });

              return (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0B1020]/90 px-4 py-3 shadow-sm backdrop-blur-xl">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight">
                          {matriculaProcesso}
                        </h3>
                        <span className="text-[11px] text-white/40">Livro 2</span>
                      </div>
                      {arquivoOrigemMatricula && (
                        <p className="truncate text-[11px] text-white/45" title={arquivoOrigemMatricula}>
                          Identificada em {arquivoOrigemMatricula}
                        </p>
                      )}
                    </div>
                  </div>

                  {arquivoKenLocalizado ? (
                    <button
                      type="button"
                      onClick={() => visualizarDocumento(arquivoKenLocalizado)}
                      title={`Visualizar imagem digitalizada da matrícula ${matriculaProcesso} (${arquivoKenLocalizado.name})`}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 transition active:scale-95"
                    >
                      <Eye className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Ver matrícula</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => buscarMatriculaNoLivro2(matriculaProcesso)}
                      title="Buscar imagem digitalizada da matrícula em K:\IMAGENS\LV2"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 transition active:scale-95"
                    >
                      <Search className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Localizar no Livro 2</span>
                    </button>
                  )}
                </div>
              );
            })()}

            {job.result.files.length === 0 ? (
              <div className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-8 sm:p-12 text-center text-white/60 shadow-sm backdrop-blur-xl">
                <FileText className="mx-auto h-12 w-12 text-white/30" />
                <h4 className="mt-3 text-base font-bold text-white">Nenhum documento localizado</h4>
                <p className="mt-1 text-xs text-white/50 max-w-md mx-auto">
                  Não encontramos arquivos para os termos pesquisados. Verifique se o termo está correto ou tente a Busca Cruzada.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[24px] border border-white/20 bg-[#0B1020]/90 text-white shadow-sm backdrop-blur-xl">
                <table className="w-full text-left text-xs sm:text-sm border-collapse table-fixed">
                  <thead className="bg-[#080D1A] text-white/70 font-semibold border-b border-white/10 text-[11px] sm:text-xs">
                    <tr>
                      <th className="p-3.5 sm:p-4 min-w-[320px]">Arquivo / Caminho</th>
                      <th className="p-3.5 sm:p-4 w-36 whitespace-nowrap">Pasta</th>
                      <th className="p-3.5 sm:p-4 w-24 whitespace-nowrap">Tamanho</th>
                      <th className="p-3.5 sm:p-4 w-28 whitespace-nowrap">Modificado</th>
                      <th className="sticky right-0 bg-[#080D1A] p-3 w-20 min-w-[80px] max-w-[80px] text-right whitespace-nowrap z-20 border-l border-white/10 shadow-[-12px_0_16px_-4px_rgba(0,0,0,0.6)]">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {job.result.files.map(file => {
                      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                      const isPdf = ext === '.pdf';
                      const isDocx = ext === '.docx' || ext === '.doc' || ext === '.rtf' || ext === '.txt';
                      const isKenOrTif = ext === '.ken' || ext === '.tif' || ext === '.tiff';
                      // Petição em PDF (CLI Rust) ou Word (mammoth/word-extractor no Connector)
                      const podeFormulario = isPdf || ext === '.docx' || ext === '.doc';
                      const fileKey = `${file.rootId}:${file.relativePath}`;
                      const emProcessamento = processandoAcao?.id === fileKey;
                      const jaExtraido = !!getCachedExtracao(fileKey);
                      const jaAuditado = !!getCachedAssinatura(fileKey);
                      const jaLido = !!getCachedLeitura(fileKey);
                      const pathFoiCopiado = caminhoCopiado === file.relativePath;

                      return (
                        <tr key={fileKey} className="group hover:bg-white/[0.04] transition">
                          <td className="p-3.5 sm:p-4 font-medium text-white overflow-hidden">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <FileText
                                className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 ${
                                  isPdf ? 'text-rose-400' : isDocx ? 'text-sky-400' : isKenOrTif ? 'text-amber-400' : 'text-slate-400'
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => visualizarDocumento(file)}
                                  className="truncate max-w-full block font-semibold text-white hover:text-cyan-300 transition text-left group/fn"
                                  title={`Visualizar ${file.name} para conferência visual direta`}
                                >
                                  <span className="hover:underline">{file.name}</span>
                                  <Eye className="inline ml-1.5 h-3 w-3 text-white/40 group-hover/fn:text-cyan-400 opacity-60 group-hover/fn:opacity-100 shrink-0 transition" />
                                </button>
                                <span
                                  className="truncate max-w-full block font-mono text-[11px] text-white/50 mt-0.5"
                                  title={formatCartorioPath(file.rootId, file.relativePath)}
                                >
                                  {formatCartorioPath(file.rootId, file.relativePath)}
                                </span>

                                {(() => {
                                  // Arquivos de imagem de matrícula (.KEN / .TIF) já são o documento final do Livro 2
                                  if (isKenOrTif) return null;

                                  const fileMatricula =
                                    file.matricula ||
                                    getCachedExtracao(fileKey)?.matricula_transcricao ||
                                    (file.name.match(/(?:matr[ií]cula|transcri[çc][ãa]o)\s*(?:n[ºo°]?)?\s*([0-9.\-]+)/i)?.[0]);

                                  if (!fileMatricula) return null;

                                  return (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                      <span
                                        className="inline-flex items-center gap-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 shadow-sm"
                                        title={`Matrícula identificada neste documento: ${fileMatricula}`}
                                      >
                                        <FileText className="h-3 w-3 text-cyan-400 shrink-0" />
                                        <span>{fileMatricula}</span>
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 sm:p-4 whitespace-nowrap">
                            {(() => {
                              const rootInfo = getRootInfo(file.rootId);
                              return (
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition shadow-sm ${rootInfo.badgeClass}`}
                                  title={`${rootInfo.fullName} • ${rootInfo.pathDisplay}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${rootInfo.dotClass}`} />
                                  <span>{rootInfo.label}</span>
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-3.5 sm:p-4 text-white/70 text-xs sm:text-sm whitespace-nowrap">
                            {Math.ceil(file.size / 1024)} KB
                          </td>
                          <td className="p-3.5 sm:p-4 text-white/70 text-xs sm:text-sm whitespace-nowrap">
                            {new Date(file.modifiedAt).toLocaleDateString('pt-BR')}
                          </td>

                          {/* Coluna de Ações: Botão Direto de Visualizar + Três Pontinhos */}
                          <td className="sticky right-0 bg-[#0B1020] group-hover:bg-[#0E1528] p-3 text-right whitespace-nowrap z-10 border-l border-white/10 shadow-[-12px_0_16px_-4px_rgba(0,0,0,0.6)] w-20 min-w-[80px] max-w-[80px]">
                            <div className="flex items-center justify-end gap-1.5" data-menu-acoes>
                              {/* Botão de Visualização Rápida */}
                              <button
                                type="button"
                                disabled={!!processandoAcao}
                                onClick={() => visualizarDocumento(file)}
                                title={
                                  emProcessamento && processandoAcao?.tipo === 'leitura'
                                    ? `Carregando documento… ${formatTempoMMSS(tempoDecorrido)}`
                                    : `Visualizar ${file.name}`
                                }
                                aria-label={`Visualizar ${file.name}`}
                                className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition disabled:opacity-50 ${
                                  jaLido
                                    ? 'border-cyan-500/50 bg-cyan-950/70 text-cyan-300 hover:bg-cyan-900/80 shadow-sm'
                                    : 'border-slate-700/80 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                                }`}
                              >
                                {emProcessamento && processandoAcao?.tipo === 'leitura' ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>

                              {/* Botão de Três Pontinhos */}
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={e => alternarMenuAcoes(fileKey, e.currentTarget)}
                                  title="Outras ações para este arquivo"
                                  aria-label="Mais opções"
                                  aria-expanded={menuAbertoKey === fileKey}
                                  className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition ${
                                    menuAbertoKey === fileKey
                                      ? 'border-cyan-500 bg-cyan-950 text-cyan-200 shadow'
                                      : 'border-slate-700/80 bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-100'
                                  }`}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>

                                {menuAbertoKey === fileKey && menuPos && createPortal(
                                  <div
                                    role="menu"
                                    data-menu-acoes
                                    style={{ position: 'fixed', top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right, maxHeight: menuPos.maxHeight }}
                                    className="z-[300] w-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-1.5 text-xs text-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                                  >
                                    <div className="px-2.5 py-1 border-b border-slate-800 mb-1 text-left">
                                      <p className="font-mono text-[10px] text-slate-400 truncate max-w-[250px]" title={file.name}>
                                        {file.name}
                                      </p>
                                    </div>

                                    {/* Formulário de Manifestação em destaque no topo */}
                                    {podeFormulario && (
                                      <>
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => {
                                            setMenuAbertoKey(null);
                                            extrairPeticao(file);
                                          }}
                                          className="flex w-full items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-left transition hover:bg-amber-500/20 hover:text-white"
                                        >
                                          <Zap className="h-4 w-4 text-amber-400 shrink-0 fill-amber-400/20" />
                                          <div className="flex-1">
                                            <span className="font-semibold text-amber-100">
                                              {jaExtraido ? 'Abrir Formulário de Manifestação' : 'Preencher Formulário de Manifestação'}
                                            </span>
                                            <span className="block text-[10px] text-amber-200/60 font-normal">
                                              {jaExtraido ? 'Já preenchido • abre o formulário salvo' : 'Extrai os dados da petição e abre o formulário'}
                                            </span>
                                          </div>
                                        </button>
                                        {jaExtraido && (
                                          <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                              setMenuAbertoKey(null);
                                              extrairPeticao(file, true);
                                            }}
                                            className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                                          >
                                            <RotateCw className="h-4 w-4 text-amber-400/70 shrink-0" />
                                            <div className="flex-1">
                                              <span>Reprocessar formulário</span>
                                              <span className="block text-[10px] text-slate-500 font-normal">Descarta o preenchimento salvo e relê o arquivo</span>
                                            </div>
                                          </button>
                                        )}
                                        <div className="my-1 border-t border-slate-800" />
                                      </>
                                    )}

                                    {/* 1. Visualizar */}
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setMenuAbertoKey(null);
                                        visualizarDocumento(file);
                                      }}
                                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                                    >
                                      <Eye className="h-4 w-4 text-cyan-400 shrink-0" />
                                      <div className="flex-1">
                                        <span className="font-medium">Visualizar documento</span>
                                        {jaLido && <span className="block text-[10px] text-emerald-400 font-normal">Pronto em cache</span>}
                                      </div>
                                    </button>

                                    {/* 2. Recarregar do Disco */}
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setMenuAbertoKey(null);
                                        visualizarDocumento(file, true);
                                      }}
                                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                                    >
                                      <RotateCw className="h-4 w-4 text-slate-400 shrink-0" />
                                      <div className="flex-1">
                                        <span>Recarregar do disco</span>
                                        <span className="block text-[10px] text-slate-500 font-normal">Descartar cache e reler do servidor</span>
                                      </div>
                                    </button>

                                    {/* 3. Abrir em outro monitor / janela separada */}
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={async () => {
                                        setMenuAbertoKey(null);
                                        const cached = getCachedLeitura(fileKey);
                                        if (cached) {
                                          abrirDocumentoEmJanela({ documento: cached, relativePath: file.relativePath, rootId: file.rootId });
                                        } else {
                                          await visualizarDocumento(file);
                                        }
                                      }}
                                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                                    >
                                      <MonitorUp className="h-4 w-4 text-cyan-300 shrink-0" />
                                      <div className="flex-1">
                                        <span>Abrir em outro monitor</span>
                                        <span className="block text-[10px] text-slate-500 font-normal">Janela própria para conferência lado a lado</span>
                                      </div>
                                    </button>

                                    {/* Ações Específicas para Processos / PDFs */}
                                    {isPdf && (
                                      <>
                                        <div className="my-1 border-t border-slate-800" />

                                        {/* Auditar Assinaturas Eletrônicas PAdES */}
                                        <button
                                          type="button"
                                          role="menuitem"
                                          onClick={() => {
                                            setMenuAbertoKey(null);
                                            analisarAssinaturas(file, jaAuditado);
                                          }}
                                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                                        >
                                          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                                          <div className="flex-1">
                                            <span className="font-medium">{jaAuditado ? 'Re-auditar Assinaturas' : 'Auditar Assinaturas (PAdES)'}</span>
                                            <span className="block text-[10px] text-slate-500 font-normal">
                                              {jaAuditado ? 'Auditoria em cache • clique para reprocessar' : 'PAdES / ICP-Brasil / ITI'}
                                            </span>
                                          </div>
                                        </button>
                                      </>
                                    )}

                                    <div className="my-1 border-t border-slate-800" />

                                    {/* Copiar Caminho */}
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        copiarCaminho(file);
                                        setTimeout(() => setMenuAbertoKey(null), 800);
                                      }}
                                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-800 hover:text-white"
                                    >
                                      {pathFoiCopiado ? (
                                        <>
                                          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                                          <span className="font-semibold text-emerald-300">Caminho copiado!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-4 w-4 text-slate-400 shrink-0" />
                                          <span>Copiar caminho no cartório</span>
                                        </>
                                      )}
                                    </button>
                                  </div>,
                                  document.body,
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Modal Auditoria de Assinaturas */}
      {assinaturaAberta && (
        <AssinaturasModal
          nomeArquivo={assinaturaAberta.nome}
          analise={assinaturaAberta.analise}
          onClose={() => setAssinaturaAberta(null)}
        />
      )}

      {/* Modal Visualizador de DOCX / Minuta */}
      {documentoAberto && (
        <DocumentPreviewModal
          documento={documentoAberto}
          relativePath={documentoAbertoFile?.relativePath}
          rootId={documentoAbertoFile?.rootId}
          onClose={() => {
            setDocumentoAberto(null);
            setDocumentoAbertoFile(null);
          }}
        />
      )}
    </section>
  );
}

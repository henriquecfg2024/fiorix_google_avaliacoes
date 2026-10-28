'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { FichaOficialView, DadosManifestacao } from './FichaOficialView';
import { AssinaturasModal, AnaliseAssinaturaPdf } from './AssinaturasModal';
import { DocumentPreviewModal, DocumentTextResult } from './DocumentPreviewModal';

interface Connector { id: string; name: string; lastSeenAt: string | null }
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
  const [assinaturaAberta, setAssinaturaAberta] = useState<{ nome: string; analise: AnaliseAssinaturaPdf } | null>(null);
  const [documentoAberto, setDocumentoAberto] = useState<DocumentTextResult | null>(null);
  const [documentoAbertoFile, setDocumentoAbertoFile] = useState<Match | null>(null);

  // Feedback de cópia do caminho
  const [caminhoCopiado, setCaminhoCopiado] = useState<string | null>(null);

  // Cronômetro de tempo decorrido e tempo restante estimado para ações pesadas
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [tempoEstimado, setTempoEstimado] = useState(12);

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

  // Cache em memória e armazenamento persistente para respostas instantâneas
  const searchCacheRef = useRef<Map<string, SearchState>>(new Map());
  const extrairCacheRef = useRef<Map<string, DadosManifestacao>>(new Map());
  const assinaturasCacheRef = useRef<Map<string, { nome: string; analise: AnaliseAssinaturaPdf }>>(new Map());
  const leituraCacheRef = useRef<Map<string, DocumentTextResult>>(new Map());
  const [isCacheHit, setIsCacheHit] = useState(false);

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
    if (leituraCacheRef.current.has(fileKey)) {
      return leituraCacheRef.current.get(fileKey)!;
    }
    try {
      const sess = sessionStorage.getItem('fiorix_doc_' + fileKey);
      if (sess) {
        const parsed = JSON.parse(sess);
        leituraCacheRef.current.set(fileKey, parsed);
        return parsed;
      }
      const loc = localStorage.getItem('fiorix_doc_' + fileKey);
      if (loc) {
        const parsed = JSON.parse(loc);
        if (parsed.data && Date.now() - parsed.savedAt < 7 * 24 * 3600 * 1000) {
          leituraCacheRef.current.set(fileKey, parsed.data);
          return parsed.data;
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
    fetch('/api/gestao-documental', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setConnectors(body.connectors);
        setConnectorId(body.connectors[0]?.id || '');
      }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => { controller.abort(); abort.current?.abort(); };
  }, []);

  async function executeSearch(termoBusca: string, forceFresh = false) {
    const trimmed = termoBusca.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Informe um termo de busca com no mínimo 2 caracteres.');
      return;
    }

    abort.current?.abort();
    const cacheKey = `${connectorId}:${trimmed.toLowerCase()}`;
    if (!forceFresh && searchCacheRef.current.has(cacheKey)) {
      const cached = searchCacheRef.current.get(cacheKey)!;
      setJob(cached);
      setIsCacheHit(true);
      setError('');
      setBusy(false);
      return;
    }

    setIsCacheHit(false);
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true); setError(''); setJob(null);
    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId, type: 'search', query: trimmed }), signal: controller.signal,
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
    const combinedQuery = termos.join(' ');
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

  function voltarParaIndiceHistorico(index: number) {
    if (index < 0 || index >= historicoBuscas.length) return;
    const alvo = historicoBuscas[index];
    const novoHistorico = historicoBuscas.slice(0, index);
    setHistoricoBuscas(novoHistorico);

    setQuery(alvo.query);
    setSearchMode(alvo.searchMode);
    if (alvo.cruzadaParams) {
      setCruzadaProcesso(alvo.cruzadaParams.processo);
      setCruzadaMatricula(alvo.cruzadaParams.matricula);
      setCruzadaContribuinte(alvo.cruzadaParams.contribuinte);
      setCruzadaRequerente(alvo.cruzadaParams.requerente);
    }
    if (alvo.job) {
      setJob(alvo.job);
      setIsCacheHit(true);
      setError('');
      setBusy(false);
    } else {
      executeSearch(alvo.query);
    }
  }

  function limparHistoricoNavegacao() {
    setHistoricoBuscas([]);
  }

  async function extrairPeticao(file: Match, forceFresh = false) {
    const fileKey = `${file.rootId}:${file.relativePath}`;
    if (!forceFresh) {
      const cached = getCachedExtracao(fileKey);
      if (cached) {
        setFichaAberta(cached);
        setFichaAbertaFile(file);
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
        setFichaAberta(body.result);
        setFichaAbertaFile(file);
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
          setFichaAberta(state.result);
          setFichaAbertaFile(file);
          return;
        }
        if (state.status === 'failed') {
          throw new Error('Falha na extração no servidor local. Verifique se o arquivo é um PDF legível.');
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

  async function visualizarDocumento(file: Match, forceFresh = false) {
    const fileKey = `${file.rootId}:${file.relativePath}`;
    if (!forceFresh) {
      const cached = getCachedLeitura(fileKey);
      if (cached) {
        setDocumentoAberto(cached);
        setDocumentoAbertoFile(file);
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
        setCachedLeitura(fileKey, body.result);
        setDocumentoAberto(body.result);
        setDocumentoAbertoFile(file);
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
          setCachedLeitura(fileKey, state.result);
          setDocumentoAberto(state.result);
          setDocumentoAbertoFile(file);
          return;
        }
        if (state.status === 'failed') {
          throw new Error('Falha ao processar a leitura do documento no servidor local.');
        }
      }
      throw new Error('Tempo limite excedido na leitura do documento.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler o documento.');
    } finally {
      setProcessandoAcao(null);
    }
  }

  function copiarCaminho(file: Match) {
    const textToCopy = `[${file.rootId}] ${file.relativePath}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCaminhoCopiado(file.relativePath);
      setTimeout(() => setCaminhoCopiado(null), 2500);
    });
  }

  return (
    <section className="space-y-6">
      {/* Card Principal de Pesquisa */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-xl backdrop-blur">
        {/* Cabeçalho do Card: Seletor de Conector + Abas de Tipo de Busca */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-5">
          <label className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-slate-300">
            <span className="text-slate-400">Servidor do cartório:</span>
            <select
              value={connectorId}
              onChange={event => setConnectorId(event.target.value)}
              disabled={busy || !!processandoAcao}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs sm:text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              {connectors.map(connector => (
                <option key={connector.id} value={connector.id}>
                  {connector.name}
                </option>
              ))}
            </select>
          </label>

          {/* Abas: Busca Simples vs Busca Cruzada */}
          <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setSearchMode('simples')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                searchMode === 'simples'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>Busca Simples</span>
            </button>
            <button
              type="button"
              onClick={() => setSearchMode('cruzada')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                searchMode === 'cruzada'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-amber-300" />
              <span>Busca Cruzada (Multi-Critérios)</span>
            </button>
          </div>
        </div>

        {/* Formulário: Busca Simples */}
        {searchMode === 'simples' && (
          <form onSubmit={handleSearchSimples} className="space-y-4">
            <div className="flex flex-wrap items-end gap-3.5">
              <label className="flex-1 space-y-1.5 text-xs sm:text-sm font-semibold text-slate-300 min-w-[280px]">
                Pesquisar processo, matrícula ou nome de arquivo
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  minLength={2}
                  maxLength={120}
                  placeholder="Ex.: 1035968, Basilio, Usucapião ou 123.456"
                  required
                  disabled={busy || !!processandoAcao}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 sm:p-3 text-xs sm:text-sm text-slate-200 focus:border-cyan-500 focus:outline-none placeholder:text-slate-500"
                />
              </label>

              <div className="flex items-center gap-2">
                {historicoBuscas.length > 0 && (
                  <button
                    type="button"
                    onClick={voltarTelaAnterior}
                    title={`Voltar para tela anterior: ${historicoBuscas[historicoBuscas.length - 1].query}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white transition shadow-sm active:scale-95"
                  >
                    <ArrowLeft className="h-4 w-4 text-cyan-400" />
                    <span>Voltar</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busy || !connectorId || !!processandoAcao}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span className="font-mono">
                        Pesquisando {formatTempoMMSS(tempoBuscaDecorrido)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      <span>Pesquisar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Formulário: Busca Cruzada Multi-Critérios */}
        {searchMode === 'cruzada' && (
          <form onSubmit={handleSearchCruzada} className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <label className="space-y-1.5 text-xs font-semibold text-slate-300">
                <span>Processo Judicial / CNJ</span>
                <input
                  value={cruzadaProcesso}
                  onChange={event => setCruzadaProcesso(event.target.value)}
                  placeholder="Ex.: 1035968-12 ou 0000001"
                  disabled={busy || !!processandoAcao}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none placeholder:text-slate-600"
                />
              </label>

              <label className="space-y-1.5 text-xs font-semibold text-slate-300">
                <span>Matrícula ou Transcrição</span>
                <input
                  value={cruzadaMatricula}
                  onChange={event => setCruzadaMatricula(event.target.value)}
                  placeholder="Ex.: 123.456 ou 45.890"
                  disabled={busy || !!processandoAcao}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none placeholder:text-slate-600"
                />
              </label>

              <label className="space-y-1.5 text-xs font-semibold text-slate-300">
                <span>Contribuinte (SQL / IPTU)</span>
                <input
                  value={cruzadaContribuinte}
                  onChange={event => setCruzadaContribuinte(event.target.value)}
                  placeholder="Ex.: 012.345.6789-1"
                  disabled={busy || !!processandoAcao}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none placeholder:text-slate-600"
                />
              </label>

              <label className="space-y-1.5 text-xs font-semibold text-slate-300">
                <span>Requerente ou Parte</span>
                <input
                  value={cruzadaRequerente}
                  onChange={event => setCruzadaRequerente(event.target.value)}
                  placeholder="Ex.: Basilio, Ficticia, etc."
                  disabled={busy || !!processandoAcao}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none placeholder:text-slate-600"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-slate-400">
                💡 <strong className="text-cyan-300">Busca Cruzada:</strong> cruza os termos especificados em nome de arquivo e diretórios para localizar expedientes conexos.
              </p>
              <div className="flex items-center gap-2">
                {historicoBuscas.length > 0 && (
                  <button
                    type="button"
                    onClick={voltarTelaAnterior}
                    title={`Voltar para tela anterior: ${historicoBuscas[historicoBuscas.length - 1].query}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white transition shadow-sm active:scale-95"
                  >
                    <ArrowLeft className="h-4 w-4 text-cyan-400" />
                    <span>Voltar</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busy || !connectorId || !!processandoAcao}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-6 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Pesquisando…</span>
                    </>
                  ) : (
                    <>
                      <Layers className="h-4 w-4 text-amber-300" />
                      <span>Executar Busca Cruzada</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Barra de Opções de Extração / OCR (Intervalo de Páginas) */}
        <div className="mt-4 pt-4 border-t border-slate-800/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMostrarOpcoesOcr(!mostrarOpcoesOcr)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-cyan-300 transition"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-400" />
              <span>Intervalo de Páginas do OCR para PDFs</span>
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-cyan-300 border border-slate-700">
                {ocrModoPagina === 'padrao'
                  ? 'Págs 1 a 15 (Recomendado)'
                  : ocrModoPagina === 'personalizado'
                  ? `Págs ${ocrPaginaInicio} a ${ocrPaginaFim}`
                  : 'Todas as páginas'}
              </span>
            </button>
          </div>

          {mostrarOpcoesOcr && (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 animate-in slide-in-from-top-1 duration-200">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="font-semibold text-slate-300">Modo de Leitura:</span>
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
                  <div className="inline-flex items-center gap-2 pl-3 border-l border-slate-800">
                    <span className="text-slate-400">De pág:</span>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={ocrPaginaInicio}
                      onChange={e => setOcrPaginaInicio(parseInt(e.target.value) || 1)}
                      className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center font-mono text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-slate-400">até:</span>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={ocrPaginaFim}
                      onChange={e => setOcrPaginaFim(parseInt(e.target.value) || 1)}
                      className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-center font-mono text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
        <HardDrive className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400 shrink-0" />
        <span>
          Busca pontual e análise local via motor Rust/CLI e Mammoth integrado. Nenhum arquivo original deixa a rede interna do cartório.
        </span>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-200">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div aria-live="polite" className="space-y-4">
        {/* Barra de Progresso da Busca */}
        {busy && (
          <div className="rounded-xl border border-cyan-500/50 bg-slate-900/95 p-4 shadow-xl backdrop-blur transition">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950/90 border border-cyan-500/40">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-cyan-200">
                    Pesquisando documentos nos discos autorizados do servidor local…
                  </h4>
                  <p className="text-[11px] font-mono text-slate-400">
                    Termo: <strong className="text-slate-200 font-semibold">"{query}"</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">Tempo decorrido:</span>
                  <strong className="text-cyan-300 font-semibold">{formatTempoMMSS(tempoBuscaDecorrido)}</strong>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">Tempo restante estimado:</span>
                  <strong className={tempoBuscaRestante > 0 ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {tempoBuscaRestante > 0 ? `~${formatTempoMMSS(tempoBuscaRestante)}` : 'Finalizando…'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
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
          <div className="rounded-xl border border-cyan-500/50 bg-slate-900/95 p-4 shadow-xl backdrop-blur transition">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-950/90 border border-cyan-500/40">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-cyan-200">
                    {processandoAcao.tipo === 'extracao'
                      ? 'Extraindo Ficha do Oficial via CLI Rust local…'
                      : processandoAcao.tipo === 'assinatura'
                      ? 'Auditando assinaturas eletrônicas PAdES via CLI Rust…'
                      : 'Carregando minuta / documento via Mammoth…'}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-400 truncate max-w-md">
                    {processandoAcao.fileName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">Tempo decorrido:</span>
                  <strong className="text-cyan-300 font-semibold">{formatTempoMMSS(tempoDecorrido)}</strong>
                </div>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">Tempo restante estimado:</span>
                  <strong className={tempoRestante > 0 ? 'text-amber-300 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {tempoRestante > 0 ? `~${formatTempoMMSS(tempoRestante)}` : 'Finalizando…'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(95, Math.max(8, Math.round((tempoDecorrido / tempoEstimado) * 100)))}%`
                }}
              />
            </div>
          </div>
        )}

        {/* Tabela de Resultados */}
        {job?.status === 'complete' && job.result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
              <div className="flex items-center gap-2">
                <span>
                  <strong>{job.result.files.length}</strong> documento(s) localizado(s)
                  {job.result.partial && ' (resultado parcial devido a limite de pesquisa)'}.
                </span>
                {isCacheHit && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-950/90 border border-cyan-500/50 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
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

            {/* Card: Voltar para Tela Anterior */}
            {historicoBuscas.length > 0 && (() => {
              const telaAnterior = historicoBuscas[historicoBuscas.length - 1];
              const totalDocs = telaAnterior.totalDocumentos ?? telaAnterior.job?.result?.files?.length ?? 0;

              return (
                <div className="rounded-xl border border-cyan-500/60 bg-gradient-to-r from-cyan-950/90 via-slate-900/95 to-slate-950/95 p-4 shadow-xl backdrop-blur transition-all duration-200 hover:border-cyan-400">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-400/40 shrink-0 shadow-inner">
                        <ArrowLeft className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 border border-cyan-500/40">
                            <History className="h-3 w-3" />
                            Tela Anterior
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Origem:{' '}
                            <strong className="text-slate-200 font-mono">
                              {telaAnterior.origemTitulo || `"${telaAnterior.query}"`}
                            </strong>
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                            Voltar para tela anterior ({telaAnterior.query})
                          </h3>
                          <span className="text-xs text-cyan-300/80 font-mono">
                            ({totalDocs} documento{totalDocs !== 1 ? 's' : ''} nos autos)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={voltarTelaAnterior}
                        title={`Retornar imediatamente à pesquisa anterior (${telaAnterior.query})`}
                        className="inline-flex items-center gap-2 rounded-lg border border-cyan-400 bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-lg transition active:scale-95"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Voltar para tela anterior</span>
                      </button>

                      {historicoBuscas.length > 1 && (
                        <button
                          type="button"
                          onClick={limparHistoricoNavegacao}
                          title="Limpar histórico de navegação"
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Trilha de Navegação (se houver mais de 1 nível de histórico) */}
                  {historicoBuscas.length > 1 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="text-slate-500 font-semibold">Trilha de navegação:</span>
                      {historicoBuscas.map((item, idx) => (
                        <span key={item.timestamp + '-' + idx} className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => voltarParaIndiceHistorico(idx)}
                            className="text-cyan-400 hover:text-cyan-300 hover:underline font-mono"
                            title={`Ir diretamente para "${item.query}"`}
                          >
                            {item.query}
                          </button>
                          <span className="text-slate-600">→</span>
                        </span>
                      ))}
                      <span className="text-white font-mono font-semibold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/60">
                        {query} (atual)
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Destaque da Matrícula Vinculada aos Autos */}
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

              return (
                <div className="rounded-xl border border-sky-500/60 bg-gradient-to-r from-sky-950/90 via-slate-900/95 to-slate-950/95 p-4 shadow-xl backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/40 shrink-0 shadow-inner">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300 border border-sky-500/40">
                            Matrícula do Processo Identificada
                          </span>
                          {arquivoOrigemMatricula && (
                            <span className="text-[11px] text-slate-400">
                              Origem: <strong className="text-slate-200">{arquivoOrigemMatricula}</strong>
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                            {matriculaProcesso}
                          </h3>
                          <span className="text-xs text-sky-300/80 font-mono">
                            (Livro 2 – Registro Geral)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => buscarMatriculaNoLivro2(matriculaProcesso)}
                        title="Buscar imagem digitalizada da matrícula em K:\IMAGENS\LV2"
                        className="inline-flex items-center gap-2 rounded-lg border border-sky-400 bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-lg transition"
                      >
                        <Search className="h-4 w-4" />
                        <span>Localizar Imagem no Livro 2 (K:\IMAGENS\LV2)</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="bg-slate-950/90 text-slate-300 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 sm:p-4 min-w-[200px]">Arquivo / Caminho</th>
                    <th className="p-3.5 sm:p-4 w-28 whitespace-nowrap">Pasta</th>
                    <th className="p-3.5 sm:p-4 w-20 whitespace-nowrap">Tamanho</th>
                    <th className="p-3.5 sm:p-4 w-28 whitespace-nowrap">Modificado</th>
                    <th className="sticky right-0 bg-slate-950 p-3.5 sm:p-4 w-[320px] min-w-[320px] max-w-[320px] text-right whitespace-nowrap z-20 border-l border-slate-800 shadow-[-12px_0_16px_-4px_rgba(0,0,0,0.6)]">
                      Ações Documentais
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {job.result.files.map(file => {
                    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                    const isPdf = ext === '.pdf';
                    const isDocx = ext === '.docx' || ext === '.doc' || ext === '.rtf' || ext === '.txt';
                    const isKenOrTif = ext === '.ken' || ext === '.tif' || ext === '.tiff';
                    const fileKey = `${file.rootId}:${file.relativePath}`;
                    const emProcessamento = processandoAcao?.id === fileKey;
                    const jaExtraido = !!getCachedExtracao(fileKey);
                    const jaAuditado = !!getCachedAssinatura(fileKey);
                    const jaLido = !!getCachedLeitura(fileKey);
                    const pathFoiCopiado = caminhoCopiado === file.relativePath;

                    return (
                      <tr key={fileKey} className="group hover:bg-slate-800/40 transition">
                        <td className="p-3.5 sm:p-4 font-medium text-slate-100">
                          <div className="flex items-start gap-2.5">
                            <FileText
                              className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 ${
                                isPdf ? 'text-rose-400' : isDocx ? 'text-sky-400' : isKenOrTif ? 'text-amber-400' : 'text-slate-400'
                              }`}
                            />
                            <div className="min-w-0 max-w-xs sm:max-w-md lg:max-w-lg">
                              <span className="truncate block font-semibold text-slate-100 text-xs sm:text-sm" title={file.name}>
                                {file.name}
                              </span>
                              <span className="truncate block font-mono text-[11px] text-slate-400 mt-0.5" title={file.relativePath}>
                                {file.relativePath}
                              </span>

                              {(() => {
                                const fileMatricula =
                                  file.matricula ||
                                  getCachedExtracao(fileKey)?.matricula_transcricao ||
                                  (file.name.match(/(?:matr[ií]cula|transcri[çc][ãa]o)\s*(?:n[ºo°]?)?\s*([0-9.\-]+)/i)?.[0]);

                                if (!fileMatricula) return null;

                                return (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded bg-sky-950/90 border border-sky-600/70 px-2 py-0.5 text-[11px] font-semibold text-sky-200 shadow-sm">
                                      <FileText className="h-3 w-3 text-sky-400 shrink-0" />
                                      <span>{fileMatricula}</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => buscarMatriculaNoLivro2(fileMatricula)}
                                      className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium underline transition"
                                      title="Pesquisar imagem desta matrícula em K:\IMAGENS\LV2"
                                    >
                                      <Search className="h-3 w-3 text-cyan-400" />
                                      <span>Localizar no Livro 2 (K:)</span>
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 sm:p-4 whitespace-nowrap">
                          <span className="rounded bg-slate-800 px-2.5 py-1 font-mono text-[11px] sm:text-xs text-cyan-300 border border-slate-700/60">
                            {file.rootId}
                          </span>
                        </td>
                        <td className="p-3.5 sm:p-4 text-slate-300 text-xs sm:text-sm whitespace-nowrap">
                          {Math.ceil(file.size / 1024)} KB
                        </td>
                        <td className="p-3.5 sm:p-4 text-slate-300 text-xs sm:text-sm whitespace-nowrap">
                          {new Date(file.modifiedAt).toLocaleDateString('pt-BR')}
                        </td>

                        {/* Coluna de Ações com Alinhamento Estrito em 2 Slots de Largura Fixa */}
                        <td className="sticky right-0 bg-slate-900 group-hover:bg-slate-800 p-3.5 sm:p-4 text-right whitespace-nowrap z-10 border-l border-slate-800/80 shadow-[-12px_0_16px_-4px_rgba(0,0,0,0.6)] w-[320px] min-w-[320px] max-w-[320px]">
                          <div className="flex items-center justify-end gap-2">
                            {isPdf ? (
                              <>
                                {/* Slot 1: Extração de Ficha (Largura fixa exata: 145px, altura: h-8) */}
                                <div className="w-[145px] shrink-0 flex items-center justify-end">
                                  {jaExtraido ? (
                                    <div className="w-full h-8 flex items-stretch rounded-lg border border-cyan-500/80 bg-cyan-950 overflow-hidden shadow-sm">
                                      <button
                                        type="button"
                                        disabled={!!processandoAcao}
                                        onClick={() => extrairPeticao(file)}
                                        title="Ver Ficha do Oficial pronta em cache (0ms)"
                                        className="flex-1 inline-flex items-center justify-center gap-1 px-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900 transition disabled:opacity-50"
                                      >
                                        <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300/30 shrink-0" />
                                        <span>Ver Ficha</span>
                                        <span className="rounded bg-cyan-900 px-1 text-[9px] font-bold text-cyan-300">0ms</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!!processandoAcao}
                                        onClick={() => extrairPeticao(file, true)}
                                        title="Re-extrair dados do PDF (descartar cache e ler novamente)"
                                        className="w-7 border-l border-cyan-700/60 flex items-center justify-center text-cyan-400 hover:bg-cyan-900 hover:text-amber-300 transition disabled:opacity-50"
                                      >
                                        <RotateCw className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={!!processandoAcao}
                                      onClick={() => extrairPeticao(file)}
                                      title="Extrair dados estruturados e gerar Ficha de Conferência do Oficial"
                                      className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-800/60 bg-cyan-950/60 px-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/80 transition disabled:opacity-50"
                                    >
                                      {emProcessamento && processandoAcao?.tipo === 'extracao' ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400 shrink-0" />
                                          <span className="font-mono text-xs">{formatTempoMMSS(tempoDecorrido)}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                          <span>Extrair Ficha</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>

                                {/* Slot 2: Assinaturas (Largura fixa exata: 155px, altura: h-8) */}
                                <div className="w-[155px] shrink-0 flex items-center justify-end">
                                  {jaAuditado ? (
                                    <div className="w-full h-8 flex items-stretch rounded-lg border border-emerald-600/80 bg-emerald-950 overflow-hidden shadow-sm">
                                      <button
                                        type="button"
                                        disabled={!!processandoAcao}
                                        onClick={() => analisarAssinaturas(file)}
                                        title="Auditoria de assinaturas pronta em cache (0ms)"
                                        className="flex-1 inline-flex items-center justify-center gap-1 px-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900 transition disabled:opacity-50"
                                      >
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                                        <span>Assinaturas</span>
                                        <span className="rounded bg-emerald-900 px-1 text-[9px] font-bold text-emerald-300">0ms</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!!processandoAcao}
                                        onClick={() => analisarAssinaturas(file, true)}
                                        title="Re-auditar assinaturas eletrônicas no servidor (descartar cache)"
                                        className="w-7 border-l border-emerald-700/60 flex items-center justify-center text-emerald-400 hover:bg-emerald-900 hover:text-amber-300 transition disabled:opacity-50"
                                      >
                                        <RotateCw className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={!!processandoAcao}
                                      onClick={() => analisarAssinaturas(file)}
                                      title="Verificar assinaturas eletrônicas PAdES/ICP-Brasil"
                                      className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
                                    >
                                      {emProcessamento && processandoAcao?.tipo === 'assinatura' ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400 shrink-0" />
                                          <span className="font-mono text-xs">{formatTempoMMSS(tempoDecorrido)}</span>
                                        </>
                                      ) : (
                                        <>
                                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                          <span>Assinaturas</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </>
                            ) : isDocx ? (
                              <>
                                {/* Slot 1: Leitura do DOCX / Minuta (Largura fixa: 145px, altura: h-8) */}
                                <div className="w-[145px] shrink-0 flex items-center justify-end">
                                  {jaLido ? (
                                    <div className="w-full h-8 flex items-stretch rounded-lg border border-sky-500/80 bg-sky-950 overflow-hidden shadow-sm">
                                      <button
                                        type="button"
                                        disabled={!!processandoAcao}
                                        onClick={() => visualizarDocumento(file)}
                                        title="Visualizar minuta .docx pronta em cache (0ms)"
                                        className="flex-1 inline-flex items-center justify-center gap-1 px-2 text-xs font-semibold text-sky-200 hover:bg-sky-900 transition disabled:opacity-50"
                                      >
                                        <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300/30 shrink-0" />
                                        <span>Ver Minuta</span>
                                        <span className="rounded bg-sky-900 px-1 text-[9px] font-bold text-sky-300">0ms</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!!processandoAcao}
                                        onClick={() => visualizarDocumento(file, true)}
                                        title="Re-ler documento do disco no servidor (descartar cache)"
                                        className="w-7 border-l border-sky-700/60 flex items-center justify-center text-sky-400 hover:bg-sky-900 hover:text-amber-300 transition disabled:opacity-50"
                                      >
                                        <RotateCw className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={!!processandoAcao}
                                      onClick={() => visualizarDocumento(file)}
                                      title="Ler e visualizar o conteúdo da minuta .docx no navegador"
                                      className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-600/80 bg-sky-950/80 px-2.5 text-xs font-semibold text-sky-200 hover:bg-sky-900 shadow-sm transition disabled:opacity-50"
                                    >
                                      {emProcessamento && processandoAcao?.tipo === 'leitura' ? (
                                        <>
                                          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400 shrink-0" />
                                          <span className="font-mono text-xs">{formatTempoMMSS(tempoDecorrido)}</span>
                                        </>
                                      ) : (
                                        <>
                                          <FileText className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                                          <span>Ler Minuta</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>

                                {/* Slot 2: Copiar Caminho do Arquivo (Largura fixa: 155px, altura: h-8) */}
                                <div className="w-[155px] shrink-0 flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={() => copiarCaminho(file)}
                                    title="Copiar caminho relativo do arquivo no cartório"
                                    className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition"
                                  >
                                    {pathFoiCopiado ? (
                                      <>
                                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                        <span className="text-emerald-400 font-semibold">Copiado!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span>Copiar Caminho</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </>
                            ) : isKenOrTif ? (
                              <>
                                {/* Slot 1: Ver Matrícula (.KEN / TIFF) */}
                                <div className="w-[145px] shrink-0 flex items-center justify-end">
                                  <button
                                    type="button"
                                    disabled={!!processandoAcao}
                                    onClick={() => visualizarDocumento(file)}
                                    title="Visualizar informações da matrícula digitalizada (.KEN / TIFF)"
                                    className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/80 bg-amber-950/80 px-2 text-xs font-semibold text-amber-200 hover:bg-amber-900 shadow-sm transition disabled:opacity-50"
                                  >
                                    <FileText className="h-3.5 w-3.5 text-amber-400" />
                                    <span>Ver Matrícula</span>
                                  </button>
                                </div>

                                {/* Slot 2: Copiar Caminho */}
                                <div className="w-[155px] shrink-0 flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={() => copiarCaminho(file)}
                                    title="Copiar caminho relativo do arquivo da matrícula"
                                    className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 text-xs text-slate-300 hover:bg-slate-700 transition"
                                  >
                                    {pathFoiCopiado ? (
                                      <span className="text-emerald-400 font-semibold">Copiado!</span>
                                    ) : (
                                      <>
                                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                                        <span>Copiar Caminho</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="w-[145px] shrink-0 flex items-center justify-end">
                                  <span className="text-[11px] text-slate-500 italic">Arquivo genérico</span>
                                </div>
                                <div className="w-[155px] shrink-0 flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={() => copiarCaminho(file)}
                                    className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 text-xs text-slate-300 hover:bg-slate-700 transition"
                                  >
                                    {pathFoiCopiado ? (
                                      <span className="text-emerald-400 font-semibold">Copiado!</span>
                                    ) : (
                                      <>
                                        <Copy className="h-3.5 w-3.5 text-slate-400" />
                                        <span>Copiar Caminho</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Ficha de Conferência / Manifestação */}
      {fichaAberta && (
        <FichaOficialView
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
        />
      )}

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

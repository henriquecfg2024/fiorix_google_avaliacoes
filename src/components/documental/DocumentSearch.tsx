'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { FileText, ShieldCheck, Loader2, Sparkles, AlertCircle, HardDrive, CheckCircle2, Zap, RotateCw } from 'lucide-react';
import { FichaOficialView, DadosManifestacao } from './FichaOficialView';
import { AssinaturasModal, AnaliseAssinaturaPdf } from './AssinaturasModal';

interface Connector { id: string; name: string; lastSeenAt: string | null }
interface Match { rootId: string; relativePath: string; name: string; size: number; modifiedAt: string }
interface SearchState { id: string; status: string; expiresAt: string; result: { files: Match[]; partial: boolean; unavailableRoots: string[] } | null }

export function DocumentSearch() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connectorId, setConnectorId] = useState('');
  const [query, setQuery] = useState('');
  const [job, setJob] = useState<SearchState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Estados para Extração e Assinaturas
  const [processandoAcao, setProcessandoAcao] = useState<{ id: string; tipo: 'extracao' | 'assinatura'; fileName: string } | null>(null);
  const [fichaAberta, setFichaAberta] = useState<DadosManifestacao | null>(null);
  const [fichaAbertaFile, setFichaAbertaFile] = useState<Match | null>(null);
  const [assinaturaAberta, setAssinaturaAberta] = useState<{ nome: string; analise: AnaliseAssinaturaPdf } | null>(null);

  // Cronômetro de tempo decorrido e tempo restante estimado
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
  const [isCacheHit, setIsCacheHit] = useState(false);

  function isExtracaoValida(data: DadosManifestacao | null | undefined): boolean {
    if (!data) return false;
    // Se nenhum campo essencial foi preenchido, é um resultado de stub vazio anterior
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

  async function search(event?: FormEvent, forceFresh = false) {
    if (event) event.preventDefault();
    abort.current?.abort();

    const cacheKey = `${connectorId}:${query.trim().toLowerCase()}`;
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
        body: JSON.stringify({ connectorId, type: 'search', query }), signal: controller.signal,
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
          forceFresh,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);

      // Resposta imediata se o servidor já possuir em cache no banco
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

      // Resposta imediata se o servidor já possuir em cache no banco
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

  return (
    <section className="space-y-6">
      <form onSubmit={search} className="flex flex-wrap items-end gap-3.5 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-lg">
        <label className="space-y-1.5 text-xs sm:text-sm font-semibold text-slate-300">
          Servidor do cartório
          <select
            value={connectorId}
            onChange={event => setConnectorId(event.target.value)}
            disabled={busy || !!processandoAcao}
            className="block w-56 sm:w-64 rounded-lg border border-slate-700 bg-slate-950 p-2.5 sm:p-3 text-xs sm:text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
          >
            {connectors.map(connector => (
              <option key={connector.id} value={connector.id}>
                {connector.name}
              </option>
            ))}
          </select>
        </label>

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

        <button
          disabled={busy || !connectorId || !!processandoAcao}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span className="font-mono">
                Pesquisando {formatTempoMMSS(tempoBuscaDecorrido)}
                <span className="text-[11px] sm:text-xs opacity-80 ml-1 font-normal">
                  (restam {tempoBuscaRestante > 0 ? `~${formatTempoMMSS(tempoBuscaRestante)}` : '...'})
                </span>
              </span>
            </>
          ) : (
            'Pesquisar'
          )}
        </button>
      </form>

      <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
        <HardDrive className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400 shrink-0" />
        <span>
          Busca pontual e análise local via motor Rust/CLI integrado. Nenhum arquivo original deixa a rede interna do cartório.
        </span>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-200">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div aria-live="polite" className="space-y-4">
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

              {/* Contadores da Busca */}
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

            {/* Barra de Progresso da Busca */}
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

        {/* Card de Progresso com Contadores de Tempo Decorrido e Tempo Restante */}
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
                      : 'Auditando assinaturas eletrônicas PAdES via CLI Rust…'}
                  </h4>
                  <p className="text-[11px] font-mono text-slate-400 truncate max-w-md">
                    {processandoAcao.fileName}
                  </p>
                </div>
              </div>

              {/* Contadores em destaque */}
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

            {/* Barra de Progresso Animada */}
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
                    onClick={() => search(undefined, true)}
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

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="bg-slate-950/90 text-slate-300 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 sm:p-4 min-w-[200px]">Arquivo / Caminho</th>
                    <th className="p-3.5 sm:p-4 w-28 whitespace-nowrap">Pasta</th>
                    <th className="p-3.5 sm:p-4 w-20 whitespace-nowrap">Tamanho</th>
                    <th className="p-3.5 sm:p-4 w-28 whitespace-nowrap">Modificado</th>
                    <th className="sticky right-0 bg-slate-950 p-3.5 sm:p-4 min-w-[260px] text-right whitespace-nowrap z-20 border-l border-slate-800 shadow-[-12px_0_16px_-4px_rgba(0,0,0,0.6)]">
                      Ações Documentais
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {job.result.files.map(file => {
                    const isPdf = file.name.toLowerCase().endsWith('.pdf');
                    const fileKey = `${file.rootId}:${file.relativePath}`;
                    const emProcessamento = processandoAcao?.id === fileKey;
                    const jaExtraido = !!getCachedExtracao(fileKey);
                    const jaAuditado = !!getCachedAssinatura(fileKey);

                    return (
                      <tr key={fileKey} className="group hover:bg-slate-800/40 transition">
                        <td className="p-3.5 sm:p-4 font-medium text-slate-100">
                          <div className="flex items-start gap-2.5">
                            <FileText className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5 ${isPdf ? 'text-rose-400' : 'text-slate-400'}`} />
                            <div className="min-w-0 max-w-xs sm:max-w-md lg:max-w-lg">
                              <span className="truncate block font-semibold text-slate-100 text-xs sm:text-sm" title={file.name}>
                                {file.name}
                              </span>
                              <span className="truncate block font-mono text-[11px] text-slate-400 mt-0.5" title={file.relativePath}>
                                {file.relativePath}
                              </span>
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
                        <td className="sticky right-0 bg-slate-900 group-hover:bg-slate-800 p-3.5 sm:p-4 text-right whitespace-nowrap z-10 border-l border-slate-800/80 shadow-[-12px_0_16px_-4px_rgba(0,0,0,0.6)] space-x-2">
                          {isPdf ? (
                            <>
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={!!processandoAcao}
                                  onClick={() => extrairPeticao(file)}
                                  title={jaExtraido ? "Ficha em cache pronta para visualização instantânea (0ms)" : "Extrair dados estruturados e gerar Ficha de Conferência do Oficial"}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-semibold transition disabled:opacity-50 ${
                                    jaExtraido
                                      ? 'border-cyan-500/80 bg-cyan-950 text-cyan-200 hover:bg-cyan-900 shadow-sm'
                                      : 'border-cyan-800/60 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/80'
                                  }`}
                                >
                                  {emProcessamento && processandoAcao?.tipo === 'extracao' ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                                      <span className="font-mono text-xs">
                                        {formatTempoMMSS(tempoDecorrido)}
                                        <span className="text-[10px] text-cyan-400/80 ml-1">
                                          (restam {tempoRestante > 0 ? `~${formatTempoMMSS(tempoRestante)}` : '...'})
                                        </span>
                                      </span>
                                    </>
                                  ) : jaExtraido ? (
                                    <>
                                      <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300/30" />
                                      <span>Ver Ficha</span>
                                      <span className="rounded bg-cyan-900/80 px-1 py-0.2 text-[9px] font-bold text-cyan-200">
                                        0ms
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                                      <span>Extrair Ficha</span>
                                    </>
                                  )}
                                </button>
                                {jaExtraido && (
                                  <button
                                    type="button"
                                    disabled={!!processandoAcao}
                                    onClick={() => extrairPeticao(file, true)}
                                    title="Re-extrair dados do PDF no servidor do cartório (descartar cache e ler novamente)"
                                    className="rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-400 hover:text-amber-300 hover:border-amber-500/60 hover:bg-slate-800 transition disabled:opacity-50"
                                  >
                                    <RotateCw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={!!processandoAcao}
                                  onClick={() => analisarAssinaturas(file)}
                                  title={jaAuditado ? "Auditoria em cache pronta para visualização instantânea (0ms)" : "Verificar assinaturas eletrônicas PAdES/ICP-Brasil"}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs sm:text-sm font-semibold transition disabled:opacity-50 ${
                                    jaAuditado
                                      ? 'border-emerald-600/80 bg-emerald-950 text-emerald-200 hover:bg-emerald-900 shadow-sm'
                                      : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                                  }`}
                                >
                                  {emProcessamento && processandoAcao?.tipo === 'assinatura' ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                                      <span className="font-mono text-xs">
                                        {formatTempoMMSS(tempoDecorrido)}
                                        <span className="text-[10px] text-emerald-400/80 ml-1">
                                          (restam {tempoRestante > 0 ? `~${formatTempoMMSS(tempoRestante)}` : '...'})
                                        </span>
                                      </span>
                                    </>
                                  ) : jaAuditado ? (
                                    <>
                                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                                      <span>Ver Assinaturas</span>
                                      <span className="rounded bg-emerald-900/80 px-1 py-0.2 text-[9px] font-bold text-emerald-200">
                                        0ms
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                                      <span>Assinaturas</span>
                                    </>
                                  )}
                                </button>
                                {jaAuditado && (
                                  <button
                                    type="button"
                                    disabled={!!processandoAcao}
                                    onClick={() => analisarAssinaturas(file, true)}
                                    title="Re-auditar assinaturas eletrônicas no servidor do cartório (descartar cache)"
                                    className="rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-400 hover:text-amber-300 hover:border-amber-500/60 hover:bg-slate-800 transition disabled:opacity-50"
                                  >
                                    <RotateCw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic pr-2">
                              Ações para PDF
                            </span>
                          )}
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
    </section>
  );
}


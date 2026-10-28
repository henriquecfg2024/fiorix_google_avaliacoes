'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { FileText, ShieldCheck, Loader2, Sparkles, AlertCircle, HardDrive, CheckCircle2 } from 'lucide-react';
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
  const [processandoAcao, setProcessandoAcao] = useState<{ id: string; tipo: 'extracao' | 'assinatura' } | null>(null);
  const [fichaAberta, setFichaAberta] = useState<DadosManifestacao | null>(null);
  const [assinaturaAberta, setAssinaturaAberta] = useState<{ nome: string; analise: AnaliseAssinaturaPdf } | null>(null);

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

  async function search(event: FormEvent) {
    event.preventDefault();
    abort.current?.abort();
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
          const timer = setTimeout(() => { controller.signal.removeEventListener('abort', onAbort); resolve(); }, 2000);
          controller.signal.addEventListener('abort', onAbort, { once: true });
        });
        if (controller.signal.aborted) return;
        const result = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store', signal: controller.signal });
        const state = await result.json();
        if (!result.ok) throw new Error(state.error);
        setJob(state);
        if (state.status === 'failed') throw new Error('Não foi possível pesquisar. Verifique o acesso do Connector às pastas.');
        if (state.status === 'complete') return;
      }
      if (!controller.signal.aborted) throw new Error('Pesquisa expirada. Verifique se o módulo documental está habilitado no Connector.');
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Falha na pesquisa.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  async function extrairPeticao(file: Match) {
    const fileKey = `${file.rootId}:${file.relativePath}`;
    setProcessandoAcao({ id: fileKey, tipo: 'extracao' });
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
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);

      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          setFichaAberta(state.result);
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

  async function analisarAssinaturas(file: Match) {
    const fileKey = `${file.rootId}:${file.relativePath}`;
    setProcessandoAcao({ id: fileKey, tipo: 'assinatura' });
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
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);

      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          setAssinaturaAberta({ nome: file.name, analise: state.result });
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
      <form onSubmit={search} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
        <label className="space-y-1.5 text-xs font-semibold text-slate-300">
          Servidor do cartório
          <select
            value={connectorId}
            onChange={event => setConnectorId(event.target.value)}
            disabled={busy || !!processandoAcao}
            className="block w-56 rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          >
            {connectors.map(connector => (
              <option key={connector.id} value={connector.id}>
                {connector.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex-1 space-y-1.5 text-xs font-semibold text-slate-300">
          Pesquisar processo, matrícula ou nome de arquivo
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            minLength={2}
            maxLength={120}
            placeholder="Ex.: 1035968, Basilio, Usucapião ou 123.456"
            required
            disabled={busy || !!processandoAcao}
            className="block w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
          />
        </label>

        <button
          disabled={busy || !connectorId || !!processandoAcao}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Pesquisando…
            </>
          ) : (
            'Pesquisar'
          )}
        </button>
      </form>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <HardDrive className="h-4 w-4 text-cyan-400" />
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

      <div aria-live="polite">
        {busy && <p className="text-xs text-slate-300">Aguardando a busca nos discos autorizados do servidor local…</p>}

        {job?.status === 'complete' && job.result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-300">
              <span>
                <strong>{job.result.files.length}</strong> documento(s) localizado(s)
                {job.result.partial && ' (resultado parcial devido a limite de pesquisa)'}.
              </span>
              {job.result.unavailableRoots.length > 0 && (
                <span className="text-amber-400">Pastas sem acesso: {job.result.unavailableRoots.join(', ')}</span>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400">
                  <tr>
                    <th className="p-3">Arquivo</th>
                    <th className="p-3">Pasta Autorizada</th>
                    <th className="p-3">Caminho Relativo</th>
                    <th className="p-3">Tamanho</th>
                    <th className="p-3">Modificado</th>
                    <th className="p-3 text-right">Ações Documentais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {job.result.files.map(file => {
                    const isPdf = file.name.toLowerCase().endsWith('.pdf');
                    const fileKey = `${file.rootId}:${file.relativePath}`;
                    const emProcessamento = processandoAcao?.id === fileKey;

                    return (
                      <tr key={fileKey} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-medium text-slate-200 flex items-center gap-2">
                          <FileText className={`h-4 w-4 ${isPdf ? 'text-rose-400' : 'text-slate-400'}`} />
                          <span className="truncate max-w-xs">{file.name}</span>
                        </td>
                        <td className="p-3 text-slate-400">
                          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-cyan-300 border border-slate-700/60">
                            {file.rootId}
                          </span>
                        </td>
                        <td className="break-all p-3 text-slate-400 font-mono text-[11px] max-w-sm">
                          {file.relativePath}
                        </td>
                        <td className="p-3 text-slate-400">
                          {Math.ceil(file.size / 1024)} KB
                        </td>
                        <td className="p-3 text-slate-400">
                          {new Date(file.modifiedAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {isPdf && (
                            <>
                              <button
                                type="button"
                                disabled={!!processandoAcao}
                                onClick={() => extrairPeticao(file)}
                                title="Extrair dados estruturados e gerar Ficha de Conferência do Oficial"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-800/60 bg-cyan-950/60 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-900/80 disabled:opacity-50 transition"
                              >
                                {emProcessamento && processandoAcao?.tipo === 'extracao' ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3 w-3 text-cyan-400" />
                                )}
                                Extrair Ficha
                              </button>

                              <button
                                type="button"
                                disabled={!!processandoAcao}
                                onClick={() => analisarAssinaturas(file)}
                                title="Verificar assinaturas eletrônicas PAdES/ICP-Brasil"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50 transition"
                              >
                                {emProcessamento && processandoAcao?.tipo === 'assinatura' ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                                )}
                                Assinaturas
                              </button>
                            </>
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
          onClose={() => setFichaAberta(null)}
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


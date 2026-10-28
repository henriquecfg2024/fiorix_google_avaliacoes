'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

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
        body: JSON.stringify({ connectorId, query }), signal: controller.signal,
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

  return <section className="space-y-5">
    <form onSubmit={search} className="flex flex-wrap gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
      <label className="space-y-2 text-sm">Servidor do cartório
        <select value={connectorId} onChange={event => setConnectorId(event.target.value)} disabled={busy}
          className="block rounded-md border border-slate-700 bg-slate-950 p-2">
          {connectors.map(connector => <option key={connector.id} value={connector.id}>{connector.name}</option>)}
        </select>
      </label>
      <label className="flex-1 space-y-2 text-sm">Nome do arquivo ou pasta
        <input value={query} onChange={event => setQuery(event.target.value)} minLength={2} maxLength={120}
          placeholder="Ex.: número do processo, matrícula ou nome" required disabled={busy}
          className="block w-full rounded-md border border-slate-700 bg-slate-950 p-2" />
      </label>
      <button disabled={busy || !connectorId} className="self-end rounded-md bg-blue-600 px-5 py-2 disabled:opacity-50">
        {busy ? 'Pesquisando…' : 'Pesquisar'}
      </button>
    </form>
    <p className="text-sm text-slate-400">Pesquisa por nome e pasta. Os arquivos permanecem na rede do cartório. Nesta etapa, abertura, pesquisa no conteúdo e manifestações continuam no aplicativo desktop.</p>
    {error && <p role="alert" className="rounded-lg border border-amber-700 p-4 text-amber-200">{error}</p>}
    <div aria-live="polite">
      {busy && <p className="text-slate-300">Aguardando a pesquisa no servidor local…</p>}
      {job?.status === 'complete' && job.result && <>
        <p className="mb-3 text-sm text-slate-300">{job.result.files.length} arquivo(s) localizado(s).
          {job.result.partial && ' Resultado parcial: houve limite de pesquisa ou pastas indisponíveis.'}
          {job.result.unavailableRoots.length > 0 && ' Pastas sem acesso: ' + job.result.unavailableRoots.join(', ')}</p>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900"><tr><th className="p-3">Arquivo</th><th className="p-3">Pasta autorizada</th><th className="p-3">Localização</th><th className="p-3">Tamanho</th><th className="p-3">Modificado em</th></tr></thead>
            <tbody>{job.result.files.map(file => <tr key={file.rootId + ':' + file.relativePath} className="border-t border-slate-800">
              <td className="p-3">{file.name}</td><td className="p-3">{file.rootId}</td><td className="break-all p-3">{file.relativePath}</td>
              <td className="p-3">{Math.ceil(file.size / 1024)} KB</td><td className="p-3">{new Date(file.modifiedAt).toLocaleDateString('pt-BR')}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
  </section>;
}

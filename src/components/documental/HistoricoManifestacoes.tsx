'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FilePlus2,
  Loader2,
  RotateCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  X,
} from 'lucide-react';
import { ESCREVENTES_USUCAPIAO, type MinutaModelo, type Segmento } from './FichaOficialView';
import {
  formatarDataHora,
  listarHistorico,
  obterManifestacaoApi,
  type ManifestacaoApi,
  type ManifestacaoCompletaApi,
} from '@/lib/documental/manifestacoesClient';

const POR_PAGINA = 25;

interface Filtros {
  busca: string;
  escrevente: string;
  de: string;
  ate: string;
}
const FILTROS_VAZIOS: Filtros = { busca: '', escrevente: '', de: '', ate: '' };

const campo =
  'w-full rounded-lg border border-white/15 bg-[#080D1A] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/30';
const rotulo = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400';
const botaoAcao =
  'inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50';

async function sha256Hex(texto: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function baixarPdf(m: ManifestacaoCompletaApi) {
  if (!m.minuta || !m.hashSha256 || !m.finalizadoEm) throw new Error('Esta manifestação não possui texto arquivado.');
  const { baixarPdfManifestacao } = await import('@/lib/pdf/generateManifestacaoPdf');
  baixarPdfManifestacao(
    m.minuta,
    { id: m.id, versao: m.versao, finalizadoEm: m.finalizadoEm, finalizadoPorNome: m.finalizadoPorNome, hashSha256: m.hashSha256 },
    m.numeroProcesso,
  );
}

export function HistoricoManifestacoes() {
  const [rascunho, setRascunho] = useState<Filtros>(FILTROS_VAZIOS);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [pagina, setPagina] = useState(0);
  const [itens, setItens] = useState<ManifestacaoApi[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [acaoEmCurso, setAcaoEmCurso] = useState<string | null>(null);
  const [aberta, setAberta] = useState<ManifestacaoCompletaApi | null>(null);
  const cacheRef = useRef(new Map<string, ManifestacaoCompletaApi>());

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await listarHistorico({ ...filtros, limite: POR_PAGINA, deslocamento: pagina * POR_PAGINA });
      setItens(r.itens);
      setTotal(r.total);
      setErro('');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar o histórico.');
    } finally {
      setCarregando(false);
    }
  }, [filtros, pagina]);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(''), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function completa(id: string): Promise<ManifestacaoCompletaApi> {
    const emCache = cacheRef.current.get(id);
    if (emCache) return emCache;
    const m = await obterManifestacaoApi(id);
    cacheRef.current.set(id, m); // registros finalizados são imutáveis: cache seguro
    return m;
  }

  async function executar(chave: string, fn: () => Promise<void>) {
    setAcaoEmCurso(chave);
    try { await fn(); }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha na operação.'); }
    finally { setAcaoEmCurso(null); }
  }

  const visualizar = (id: string) => executar(`ver:${id}`, async () => setAberta(await completa(id)));
  const baixar = (id: string) => executar(`pdf:${id}`, async () => baixarPdf(await completa(id)));
  const copiar = (id: string) => executar(`copiar:${id}`, async () => {
    const m = await completa(id);
    await navigator.clipboard.writeText(m.textoFinal || '');
    setAviso('Texto da manifestação copiado.');
  });

  function pesquisar(e: FormEvent) {
    e.preventDefault();
    setPagina(0);
    setFiltros({ ...rascunho });
  }

  function limpar() {
    setRascunho(FILTROS_VAZIOS);
    setPagina(0);
    setFiltros(FILTROS_VAZIOS);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <section className="space-y-4" aria-labelledby="historico-titulo">
      {/* Filtros */}
      <form
        onSubmit={pesquisar}
        className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-4 text-white shadow-sm backdrop-blur-xl"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            <h2 id="historico-titulo" className="text-sm font-bold tracking-wide">Manifestações arquivadas</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
              {total} registro(s)
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Registros finalizados são imutáveis. Correções geram uma nova versão.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-5">
            <label htmlFor="hist-busca" className={rotulo}>Processo, requerente, Tr/Mat, contribuinte ou imóvel</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                id="hist-busca"
                type="search"
                value={rascunho.busca}
                onChange={e => setRascunho(r => ({ ...r, busca: e.target.value }))}
                placeholder="Ex.: 1012345-67.2024 ou nome do requerente"
                maxLength={120}
                className={`${campo} pl-8`}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="hist-escrevente" className={rotulo}>Escrevente</label>
            <select
              id="hist-escrevente"
              value={rascunho.escrevente}
              onChange={e => setRascunho(r => ({ ...r, escrevente: e.target.value }))}
              className={campo}
            >
              <option value="">Todos</option>
              {ESCREVENTES_USUCAPIAO.map(nome => <option key={nome} value={nome}>{nome}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="hist-de" className={rotulo}>Finalizada de</label>
            <input id="hist-de" type="date" value={rascunho.de} onChange={e => setRascunho(r => ({ ...r, de: e.target.value }))} className={`${campo} [color-scheme:dark]`} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="hist-ate" className={rotulo}>até</label>
            <input id="hist-ate" type="date" value={rascunho.ate} onChange={e => setRascunho(r => ({ ...r, ate: e.target.value }))} className={`${campo} [color-scheme:dark]`} />
          </div>
          <div className="flex items-end gap-2 md:col-span-1">
            <button
              id="hist-pesquisar"
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              title="Pesquisar"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="md:sr-only xl:not-sr-only">Filtrar</span>
            </button>
          </div>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={limpar} className={botaoAcao}>
            <X className="h-3 w-3" aria-hidden="true" /> Limpar filtros
          </button>
          <button type="button" onClick={() => void carregar()} className={botaoAcao}>
            <RotateCw className={`h-3 w-3 ${carregando ? 'animate-spin' : ''}`} aria-hidden="true" /> Atualizar
          </button>
        </div>
      </form>

      {erro && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-2.5 text-xs font-semibold text-rose-200">
          <span>{erro}</span>
          <button type="button" onClick={() => setErro('')} aria-label="Fechar aviso" className="text-rose-300 hover:text-white"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
      {aviso && (
        <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-2 text-xs font-semibold text-emerald-200">{aviso}</div>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1020]/90 shadow-sm backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs text-slate-200">
            <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-bold">Processo</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Requerente</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Tr/Mat</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Escrevente</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Finalizada em</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Por</th>
                <th scope="col" className="px-3 py-2.5 font-bold">Versão</th>
                <th scope="col" className="px-4 py-2.5 text-right font-bold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando && itens.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Carregando histórico…</td></tr>
              ) : itens.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Nenhuma manifestação arquivada{filtros.busca || filtros.escrevente || filtros.de || filtros.ate ? ' para os filtros informados' : ' até o momento'}.
                    <span className="mt-1 block text-[11px] text-slate-500">Na Etapa 2 do Formulário, use “Finalizar Manifestação” para arquivar.</span>
                  </td>
                </tr>
              ) : (
                itens.map(m => (
                  <tr key={m.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 font-mono text-[12px] font-bold text-white">{m.numeroProcesso || '—'}</td>
                    <td className="max-w-[240px] truncate px-3 py-2.5" title={m.requerente || ''}>{m.requerente || '—'}</td>
                    <td className="px-3 py-2.5 font-mono">{m.matricula || '—'}</td>
                    <td className="px-3 py-2.5">{m.escrevente || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">{formatarDataHora(m.finalizadoEm)}</td>
                    <td className="max-w-[160px] truncate px-3 py-2.5" title={m.finalizadoPorNome || ''}>{m.finalizadoPorNome || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${m.versao > 1 ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'}`}>
                        v{m.versao}{m.versao > 1 ? ' (correção)' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => visualizar(m.id)} disabled={acaoEmCurso !== null} className={botaoAcao} title="Visualizar a manifestação arquivada">
                          {acaoEmCurso === `ver:${m.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />} Ver
                        </button>
                        <button type="button" onClick={() => baixar(m.id)} disabled={acaoEmCurso !== null} className={botaoAcao} title="Baixar PDF">
                          {acaoEmCurso === `pdf:${m.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
                        </button>
                        <button type="button" onClick={() => copiar(m.id)} disabled={acaoEmCurso !== null} className={botaoAcao} title="Copiar o texto">
                          {acaoEmCurso === `copiar:${m.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
                        </button>
                        <Link href={`/gestao-documental?reabrir=${m.id}`} className={botaoAcao} title="Abrir para correção (gera nova versão; a atual permanece arquivada)">
                          <FilePlus2 className="h-3 w-3" /> Nova versão
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > POR_PAGINA && (
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-2 text-[11px] text-slate-400">
            <span>Página {pagina + 1} de {totalPaginas}</span>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0 || carregando} className={botaoAcao}>
                <ChevronLeft className="h-3 w-3" /> Anterior
              </button>
              <button type="button" onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina + 1 >= totalPaginas || carregando} className={botaoAcao}>
                Próxima <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {aberta && (
        <VisualizacaoArquivada
          manifestacao={aberta}
          onFechar={() => setAberta(null)}
          onBaixar={() => executar(`pdf:${aberta.id}`, () => baixarPdf(aberta))}
          onCopiar={() => copiar(aberta.id)}
          baixando={acaoEmCurso === `pdf:${aberta.id}`}
        />
      )}
    </section>
  );
}

function Trechos({ segmentos }: { segmentos: Segmento[] }) {
  return (
    <>
      {segmentos.map((s, i) => (s.destaque ? <strong key={i} className="font-bold underline">{s.t}</strong> : <span key={i}>{s.t}</span>))}
    </>
  );
}

function FolhaMinuta({ m }: { m: MinutaModelo }) {
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white px-[18mm] py-[14mm] font-serif text-[13px] leading-relaxed text-black shadow-lg">
      <div className="border-b-2 border-black pb-2 text-center">
        <div className="text-[11px] font-bold tracking-[0.3em]">{m.timbre.linha1}</div>
        <div className="text-xl font-bold">{m.timbre.numero} • {m.timbre.ordinal}</div>
        <div className="text-[11px] font-bold tracking-[0.2em]">{m.timbre.linha3}</div>
        <div className="mt-1 text-[10px]">{m.timbre.endereco}</div>
      </div>
      <div className="mt-5 space-y-0.5 font-bold">
        <p>{m.cabecalho.processoRotulo} {m.cabecalho.processoValor}</p>
        <p>{m.cabecalho.vara}</p>
        <p>{m.cabecalho.interessadosRotulo} {m.cabecalho.interessadosValor}</p>
        <p>{m.cabecalho.natureza}</p>
      </div>
      <p className="mt-5 font-bold">{m.saudacao}</p>
      {m.paragrafosAntes.map((p, i) => <p key={`a${i}`} className="mt-3 indent-12 text-justify"><Trechos segmentos={p} /></p>)}
      <p className="mt-3 indent-12 text-justify">{m.introConfrontacoes}</p>
      <div className="mt-1 space-y-0.5 pl-12">
        {m.confrontacoes.map(c => <p key={c.campo}>{c.rotulo} <strong>{c.valor}</strong>{c.pontuacao}</p>)}
      </div>
      {m.paragrafosDepois.map((p, i) => <p key={`d${i}`} className="mt-3 indent-12 text-justify"><Trechos segmentos={p} /></p>)}
      <p className="mt-6 text-right">{m.local}</p>
      <div className="mt-12 text-center">
        <div className="mx-auto w-64 border-t border-black" />
        <p className="font-bold">{m.assinatura.nome}</p>
        <p className="text-[12px]">{m.assinatura.cargo}</p>
      </div>
    </div>
  );
}

function VisualizacaoArquivada({
  manifestacao: m,
  onFechar,
  onBaixar,
  onCopiar,
  baixando,
}: {
  manifestacao: ManifestacaoCompletaApi;
  onFechar: () => void;
  onBaixar: () => void;
  onCopiar: () => void;
  baixando: boolean;
}) {
  const [integridade, setIntegridade] = useState<'verificando' | 'ok' | 'divergente' | 'indisponivel'>('verificando');
  const [copiado, setCopiado] = useState(false);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const onFecharRef = useRef(onFechar);
  onFecharRef.current = onFechar;

  useEffect(() => {
    fecharRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFecharRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Confere no navegador se o texto arquivado corresponde ao SHA-256 gravado na finalização
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!m.textoFinal || !m.hashSha256) { if (ativo) setIntegridade('indisponivel'); return; }
      const h = await sha256Hex(m.textoFinal).catch(() => null);
      if (!ativo) return;
      setIntegridade(h === null ? 'indisponivel' : h === m.hashSha256 ? 'ok' : 'divergente');
    })();
    return () => { ativo = false; };
  }, [m.textoFinal, m.hashSha256]);

  return (
    <div className="fixed inset-0 z-[130] flex items-stretch justify-center bg-black/70 p-2 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-labelledby="arquivada-titulo">
      <div className="absolute inset-0" aria-hidden="true" onClick={onFechar} />
      <div className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0B1020] text-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div className="min-w-0">
            <h3 id="arquivada-titulo" className="truncate text-sm font-bold">
              Manifestação arquivada — <span className="font-mono">{m.numeroProcesso || 'sem número'}</span>
              <span className="ml-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">v{m.versao}</span>
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Finalizada em {formatarDataHora(m.finalizadoEm)}{m.finalizadoPorNome ? ` por ${m.finalizadoPorNome}` : ''}
              {m.escrevente ? ` • Escrevente: ${m.escrevente}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { onCopiar(); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} className={botaoAcao}>
              {copiado ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />} {copiado ? 'Copiado' : 'Copiar texto'}
            </button>
            <button type="button" onClick={onBaixar} disabled={baixando} className={botaoAcao}>
              {baixando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Baixar PDF
            </button>
            <Link href={`/gestao-documental?reabrir=${m.id}`} className={botaoAcao}>
              <FilePlus2 className="h-3 w-3" /> Nova versão
            </Link>
            <button ref={fecharRef} type="button" onClick={onFechar} className={botaoAcao} aria-label="Fechar">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#1E293B]/40 p-4 md:p-6">
          {m.minuta ? (
            <FolhaMinuta m={m.minuta} />
          ) : (
            <pre className="mx-auto max-w-[210mm] whitespace-pre-wrap bg-white p-8 font-serif text-[13px] text-black">{m.textoFinal}</pre>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-5 py-2.5 text-[11px]">
          {integridade === 'ok' && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Integridade conferida: o texto corresponde ao registrado na finalização.
            </span>
          )}
          {integridade === 'divergente' && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-rose-300">
              <ShieldAlert className="h-3.5 w-3.5" /> Atenção: o texto não corresponde ao SHA-256 registrado. Comunique a TI.
            </span>
          )}
          {integridade === 'verificando' && <span className="text-slate-400"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Conferindo integridade…</span>}
          {integridade === 'indisponivel' && <span className="text-slate-400">Conferência de integridade indisponível neste navegador.</span>}
          {m.hashSha256 && <span className="ml-auto break-all font-mono text-[10px] text-slate-500">SHA-256: {m.hashSha256}</span>}
        </div>
      </div>
    </div>
  );
}

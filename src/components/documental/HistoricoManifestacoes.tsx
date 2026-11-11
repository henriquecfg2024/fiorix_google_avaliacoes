'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Search,
  Loader2,
  RotateCw,
  Calendar,
  ArrowUpDown,
  FileText,
  CheckCircle2,
  Archive,
  ShieldCheck,
  Eye,
  Sparkles,
  Clock,
  Filter,
} from 'lucide-react';
import {
  listarLogsGestaoDocumentalApi,
  formatarDataHora,
  type LogGestaoDocumentalApi,
} from '@/lib/documental/manifestacoesClient';

const CATEGORIAS_LOG: Array<{ valor: string; rotulo: string }> = [
  { valor: 'TODOS', rotulo: 'Todos os logs da Gestão Documental' },
  { valor: 'PESQUISA', rotulo: 'Pesquisas no Acervo' },
  { valor: 'EXTRACAO_PETICAO', rotulo: 'Extrações OCR / IA de Petição' },
  { valor: 'LEITURA_ACERVO', rotulo: 'Visualizações de Documentos / Imagens (.KEN / PDF)' },
  { valor: 'RASCUNHO_CONFERENCIA', rotulo: 'Rascunhos e Edições em Conferência' },
  { valor: 'CONFERENCIA_OFICIAL', rotulo: 'Conferência Oficial (Conferido / Reaberto)' },
  { valor: 'ARQUIVAMENTO', rotulo: 'Finalizações e Arquivamentos (Etapa 2)' },
  { valor: 'VALIDACAO_ASSINATURA', rotulo: 'Validações de Assinatura ICP-Brasil' },
];

function estiloCategoria(cat: LogGestaoDocumentalApi['categoria']) {
  switch (cat) {
    case 'ARQUIVAMENTO':
      return {
        badge: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
        icone: <Archive className="h-3.5 w-3.5 text-emerald-400 shrink-0" />,
        rotulo: 'Arquivamento',
      };
    case 'CONFERENCIA_OFICIAL':
      return {
        badge: 'border-blue-500/30 bg-blue-500/15 text-blue-300',
        icone: <CheckCircle2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />,
        rotulo: 'Conferência Oficial',
      };
    case 'RASCUNHO_CONFERENCIA':
      return {
        badge: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
        icone: <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
        rotulo: 'Rascunho / Fila',
      };
    case 'EXTRACAO_PETICAO':
      return {
        badge: 'border-purple-500/30 bg-purple-500/15 text-purple-300',
        icone: <Sparkles className="h-3.5 w-3.5 text-purple-400 shrink-0" />,
        rotulo: 'Extração OCR / IA',
      };
    case 'LEITURA_ACERVO':
      return {
        badge: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
        icone: <Eye className="h-3.5 w-3.5 text-cyan-400 shrink-0" />,
        rotulo: 'Visualização',
      };
    case 'VALIDACAO_ASSINATURA':
      return {
        badge: 'border-teal-500/30 bg-teal-500/15 text-teal-300',
        icone: <ShieldCheck className="h-3.5 w-3.5 text-teal-400 shrink-0" />,
        rotulo: 'Assinatura ICP-Brasil',
      };
    case 'PESQUISA':
    default:
      return {
        badge: 'border-slate-500/30 bg-slate-500/15 text-slate-300',
        icone: <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />,
        rotulo: 'Pesquisa no Acervo',
      };
  }
}

export function HistoricoManifestacoes() {
  const [itens, setItens] = useState<LogGestaoDocumentalApi[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('TODOS');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [ordem, setOrdem] = useState<'desc' | 'asc'>('desc');

  const carregar = useCallback(
    async (override?: Partial<{ busca: string; tipo: string; de: string; ate: string; ordem: 'desc' | 'asc' }>) => {
      setCarregando(true);
      setErro('');
      try {
        const res = await listarLogsGestaoDocumentalApi({
          busca: override?.busca !== undefined ? override.busca : busca,
          tipo: override?.tipo !== undefined ? override.tipo : tipo,
          de: override?.de !== undefined ? override.de : de,
          ate: override?.ate !== undefined ? override.ate : ate,
          ordem: override?.ordem !== undefined ? override.ordem : ordem,
          limite: 300,
        });
        setItens(res.itens);
        setTotal(res.total);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível carregar os logs da Gestão Documental.');
      } finally {
        setCarregando(false);
      }
    },
    [busca, tipo, de, ate, ordem],
  );

  useEffect(() => {
    void carregar();
  }, [carregando ? undefined : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const limparFiltros = () => {
    setBusca('');
    setTipo('TODOS');
    setDe('');
    setAte('');
    setOrdem('desc');
    void carregar({ busca: '', tipo: 'TODOS', de: '', ate: '', ordem: 'desc' });
  };

  const alternarOrdemData = () => {
    const novaOrdem = ordem === 'desc' ? 'asc' : 'desc';
    setOrdem(novaOrdem);
    void carregar({ ordem: novaOrdem });
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={e => {
          e.preventDefault();
          void carregar();
        }}
        className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-xl backdrop-blur-xl space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            <h2 className="text-base font-semibold text-white">
              Logs da Gestão Documental
            </h2>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
              SOMENTE GESTÃO DOCUMENTAL
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-xs text-slate-300">
              {total} log(s)
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Histórico cronológico exclusivo das operações realizadas no módulo de Gestão Documental, filtrado por ordem de data.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="md:col-span-4 space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Processo, Matrícula, Requerente, Usuário ou Ação
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Ex.: 1162956-97.2024, Matrícula 76018, Conferido..."
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </label>

          <label className="md:col-span-3 space-y-1">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Filter className="h-3 w-3 text-cyan-400" />
              <span>Tipo de Log (Gestão Documental)</span>
            </span>
            <select
              value={tipo}
              onChange={e => {
                const novo = e.target.value;
                setTipo(novo);
                void carregar({ tipo: novo });
              }}
              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
            >
              {CATEGORIAS_LOG.map(op => (
                <option key={op.valor} value={op.valor}>
                  {op.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2 space-y-1">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Calendar className="h-3 w-3 text-cyan-400" />
              <span>Data Inicial (De)</span>
            </span>
            <input
              type="date"
              value={de}
              onChange={e => {
                const v = e.target.value;
                setDe(v);
                void carregar({ de: v });
              }}
              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-2.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
            />
          </label>

          <label className="md:col-span-2 space-y-1">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <Calendar className="h-3 w-3 text-cyan-400" />
              <span>Data Final (Até)</span>
            </span>
            <input
              type="date"
              value={ate}
              onChange={e => {
                const v = e.target.value;
                setAte(v);
                void carregar({ ate: v });
              }}
              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-2.5 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
            />
          </label>

          <div className="md:col-span-1 flex items-end">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Filtrar</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={alternarOrdemData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition cursor-pointer"
              title="Alternar ordenação cronológica por data"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>
                Ordem por Data: {ordem === 'desc' ? 'Mais recentes primeiro (↓)' : 'Mais antigos primeiro (↑)'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {(busca || tipo !== 'TODOS' || de || ate || ordem !== 'desc') && (
              <button
                type="button"
                onClick={limparFiltros}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 cursor-pointer"
              >
                ✕ Limpar filtros
              </button>
            )}
            <button
              type="button"
              onClick={() => void carregar()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10 cursor-pointer"
            >
              <RotateCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </form>

      {erro && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          {erro}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1020]/90 shadow-xl">
        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
            <span>Carregando logs da Gestão Documental por ordem de data…</span>
          </div>
        ) : itens.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Nenhum log da Gestão Documental encontrado para o período ou filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-4 py-3">Tipo / Evento</th>
                  <th className="px-4 py-3">Processo / Matrícula</th>
                  <th className="px-4 py-3">Descrição do Log</th>
                  <th className="px-4 py-3">Responsável / Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {itens.map(item => {
                  const est = estiloCategoria(item.categoria);
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-mono text-[11px] text-cyan-300 whitespace-nowrap">
                        {formatarDataHora(item.dataHora)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                          {item.modulo}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${est.badge}`}
                        >
                          {est.icone}
                          <span>{item.acao}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-white">
                          {item.processo || '—'}
                        </div>
                        {item.matricula ? (
                          <div className="font-mono text-[11px] text-slate-400">
                            {item.matricula}
                          </div>
                        ) : null}
                        {item.requerente ? (
                          <div className="truncate max-w-[220px] text-[11px] text-slate-400" title={item.requerente}>
                            {item.requerente}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-200 max-w-xl">
                        {item.descricao}
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                        {item.usuarioNome || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

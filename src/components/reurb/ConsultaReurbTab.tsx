'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckSquare, Search, Square, Trash2 } from 'lucide-react';
import type {
  ReurbConsultaFiltros,
  ReurbDataReferencia,
  ReurbModalidade,
  ReurbRegularizacaoResumo,
  ReurbSituacaoValidacao,
} from '@/lib/reurb/types';
import {
  buildAnosDisponiveis,
  formatarDataBr,
  labelModalidade,
  labelStatusImportacaoOnr,
  MESES_NOMES,
} from './reurb-ui-helpers';

interface ConsultaResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  itens: ReurbRegularizacaoResumo[];
}

interface ConsultaReurbTabProps {
  filtros: ReurbConsultaFiltros;
  selectedIds: string[];
  refreshKey: number;
  onUpdateFiltros: (patch: Partial<ReurbConsultaFiltros>) => void;
  onToggleSelect: (id: string) => void;
  onSelectMany: (ids: string[], checked: boolean) => void;
  onClearSelection: () => void;
  onOpenDetalhe: (id: string) => void;
  onIrParaExportacoes: () => void;
}

export function ConsultaReurbTab({
  filtros,
  selectedIds,
  refreshKey,
  onUpdateFiltros,
  onToggleSelect,
  onSelectMany,
  onClearSelection,
  onOpenDetalhe,
  onIrParaExportacoes,
}: ConsultaReurbTabProps) {
  const [resData, setResData] = useState<ConsultaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buscaLocal, setBuscaLocal] = useState(filtros.busca || '');

  useEffect(() => {
    setBuscaLocal(filtros.busca || '');
  }, [filtros.busca]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (filtros.dataDe) qs.set('dataDe', filtros.dataDe);
    if (filtros.dataAte) qs.set('dataAte', filtros.dataAte);
    if (filtros.ano) qs.set('ano', String(filtros.ano));
    else qs.set('ano', 'todos');
    if (filtros.mes === 'todos') qs.set('mes', 'todos');
    else if (filtros.mes) qs.set('mes', String(filtros.mes));
    if (filtros.tipoData) qs.set('tipoData', filtros.tipoData);
    if (filtros.busca) qs.set('busca', filtros.busca);
    if (filtros.modalidade && filtros.modalidade !== 'TODAS') qs.set('modalidade', filtros.modalidade);
    if (filtros.situacao && filtros.situacao !== 'TODAS') qs.set('situacao', filtros.situacao);
    qs.set('page', String(filtros.page || 1));
    qs.set('pageSize', String(filtros.pageSize || 20));

    fetch(`/api/reurb/processos?${qs.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || 'Erro ao consultar processos REURB.');
        return body as ConsultaResponse;
      })
      .then((payload) => {
        if (!cancelled) setResData(payload);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao listar regularizações.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filtros, refreshKey]);

  const anos = buildAnosDisponiveis(filtros.ano || new Date().getFullYear());
  const selectedSet = new Set(selectedIds);
  const pageIds = resData?.itens.map((i) => i.id) || [];
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));

  return (
    <div className="space-y-5">
      {/* Barra de Filtros */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Ano</label>
            <select
              value={filtros.ano ? String(filtros.ano) : 'todos'}
              onChange={(e) =>
                onUpdateFiltros({
                  ano: e.target.value === 'todos' ? null : Number(e.target.value),
                  dataDe: null,
                  dataAte: null,
                  page: 1,
                })
              }
              className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
            >
              <option value="todos">Todos os anos</option>
              {anos.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Mês</label>
            <select
              value={filtros.mes === 'todos' || !filtros.mes ? 'todos' : String(filtros.mes)}
              onChange={(e) =>
                onUpdateFiltros({
                  mes: e.target.value === 'todos' ? 'todos' : Number(e.target.value),
                  dataDe: null,
                  dataAte: null,
                  page: 1,
                })
              }
              className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
            >
              <option value="todos">Ano inteiro / Todos</option>
              {MESES_NOMES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Data de referência</label>
            <select
              value={filtros.tipoData || 'registro'}
              onChange={(e) =>
                onUpdateFiltros({
                  tipoData: e.target.value as ReurbDataReferencia,
                  page: 1,
                })
              }
              className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
            >
              <option value="registro">Registro da regularização</option>
              <option value="prenotacao">Data da prenotação</option>
              <option value="abertura_derivada">Abertura das derivadas</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Modalidade</label>
            <select
              value={filtros.modalidade || 'TODAS'}
              onChange={(e) =>
                onUpdateFiltros({
                  modalidade: e.target.value as 'TODAS' | ReurbModalidade,
                  page: 1,
                })
              }
              className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
            >
              <option value="TODAS">Todas</option>
              <option value="REURB_S">REURB-S (Social)</option>
              <option value="REURB_E">REURB-E (Específico)</option>
              <option value="ART_69">Art. 69 (Anterior Lei 6.766)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Situação de validação</label>
            <select
              value={filtros.situacao || 'TODAS'}
              onChange={(e) =>
                onUpdateFiltros({
                  situacao: e.target.value as 'TODAS' | ReurbSituacaoValidacao,
                  page: 1,
                })
              }
              className="w-full rounded-xl border border-white/15 bg-[#070A12] px-3 py-2 text-xs text-white"
            >
              <option value="TODAS">Todas</option>
              <option value="APTO">Apto para Ofício Eletrônico</option>
              <option value="PENDENTE">Com pendências</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Busca (matriz, derivada, protocolo ou nome)
            </label>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={buscaLocal}
                  onChange={(e) => setBuscaLocal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onUpdateFiltros({ busca: buscaLocal.trim() || null, page: 1 });
                    }
                  }}
                  placeholder="Ex.: 572013, 955016, Jardim..."
                  className="w-full rounded-xl border border-white/15 bg-[#070A12] pl-8 pr-2.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => onUpdateFiltros({ busca: buscaLocal.trim() || null, page: 1 })}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
              >
                Filtrar
              </button>
            </div>
          </div>
        </div>

        {/* Intervalo personalizado opcional */}
        <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-white/5">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Data inicial (opcional)</label>
            <input
              type="date"
              value={filtros.dataDe || ''}
              onChange={(e) =>
                onUpdateFiltros({
                  dataDe: e.target.value || null,
                  page: 1,
                })
              }
              className="rounded-xl border border-white/15 bg-[#070A12] px-3 py-1.5 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Data final (opcional)</label>
            <input
              type="date"
              value={filtros.dataAte || ''}
              onChange={(e) =>
                onUpdateFiltros({
                  dataAte: e.target.value || null,
                  page: 1,
                })
              }
              className="rounded-xl border border-white/15 bg-[#070A12] px-3 py-1.5 text-xs text-white"
            />
          </div>
          {(filtros.dataDe || filtros.dataAte || filtros.busca || filtros.modalidade !== 'TODAS' || filtros.situacao !== 'TODAS') && (
            <button
              type="button"
              onClick={() => {
                setBuscaLocal('');
                onUpdateFiltros({
                  dataDe: null,
                  dataAte: null,
                  busca: null,
                  modalidade: 'TODAS',
                  situacao: 'TODAS',
                  tipoData: 'registro',
                  page: 1,
                });
              }}
              className="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Barra persistente de seleção */}
      <div className="rounded-xl border border-emerald-500/25 bg-[#0D1322] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-300">
          <strong className="text-emerald-300">{selectedIds.length}</strong> regularização(ões) selecionada(s) para exportação em lote (mantida entre páginas e filtros).
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={onClearSelection}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar seleção
            </button>
          )}
          <button
            type="button"
            onClick={onIrParaExportacoes}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Levar para Exportações
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Tabela paginada */}
      <div className="rounded-2xl border border-white/10 bg-[#0D1322] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs text-slate-300">
          <span>
            {loading
              ? 'Consultando regularizações...'
              : `${resData?.total ?? 0} processo(s) encontrado(s)`}
          </span>
          <button
            type="button"
            onClick={() => onSelectMany(pageIds, !allPageSelected)}
            className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:underline"
          >
            {allPageSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {allPageSelected ? 'Desmarcar página' : 'Selecionar página'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-10">Lote</th>
                <th className="px-4 py-3">Matrícula / Protocolo</th>
                <th className="px-4 py-3">Empreendimento / Modalidade</th>
                <th className="px-4 py-3">Registro / Prenotação</th>
                <th className="px-4 py-3">Derivadas</th>
                <th className="px-4 py-3">Validação Ofício Eletrônico</th>
                <th className="px-4 py-3">Status no Ofício Eletrônico</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {!loading && (resData?.itens.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Nenhum processo encontrado para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                resData?.itens.map((reg) => {
                  const checked = selectedSet.has(reg.id);
                  const derivadasOutroMes = reg.derivadasNoPeriodo?.filter((d) => d.deOutroMes) || [];
                  return (
                    <tr key={reg.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleSelect(reg.id)}
                          aria-label={`Selecionar matrícula ${reg.matricula}`}
                          className="h-4 w-4 rounded border-white/25 bg-[#070A12] accent-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{reg.matricula}</div>
                        <div className="text-[11px] text-slate-400">Prot. {reg.protocolo}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">
                          {reg.empreendimento || 'Não informado'}
                        </div>
                        <div className="text-[11px] text-slate-400">{labelModalidade(reg.modalidade)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-200">Reg. {formatarDataBr(reg.dataRegistro)}</div>
                        <div className="text-[11px] text-slate-400">
                          Pren. {formatarDataBr(reg.dataPrenotacao)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{reg.qtdDerivadasLista} no JSON</div>
                        {typeof reg.qtdDerivadasAbertasNoPeriodo === 'number' && (
                          <div className="text-[11px] text-cyan-300 font-medium">
                            {reg.qtdDerivadasAbertasNoPeriodo} aberta(s) no período
                            {derivadasOutroMes.length > 0 ? ' (matriz de outro mês)' : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {reg.situacaoValidacao === 'APTO' ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                            Apto
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                            Pendente ({reg.qtdBloqueios})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-300">
                        {labelStatusImportacaoOnr(reg.statusImportacaoOnr)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenDetalhe(reg.id)}
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {resData && resData.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <span>
              Página {resData.page} de {resData.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={resData.page <= 1}
                onClick={() => onUpdateFiltros({ page: Math.max(1, resData.page - 1) })}
                className="rounded-lg border border-white/15 px-3 py-1 disabled:opacity-40 hover:bg-white/10"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={resData.page >= resData.totalPages}
                onClick={() =>
                  onUpdateFiltros({ page: Math.min(resData.totalPages, resData.page + 1) })
                }
                className="rounded-lg border border-white/15 px-3 py-1 disabled:opacity-40 hover:bg-white/10"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

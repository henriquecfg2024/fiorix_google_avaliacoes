'use client';

import React, { useState, useMemo } from 'react';
import { Search, Eye, Database, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import type { IncrementalModuleStatus, IncrementalModuleKey, BatchHistoryItem } from '@/lib/health/types';

interface Props {
  modules?: IncrementalModuleStatus[];
  recentBatches?: Record<string, BatchHistoryItem[]>;
}

interface ProcedureDefinition {
  id: IncrementalModuleKey;
  category: 'protocolos' | 'produtividade' | 'metas' | 'operacional';
  modulo: string;
  procedureSql: string;
  syncMode: string;
  targetTable: string;
  description: string;
}

const PROCEDURES_LIST: ProcedureDefinition[] = [
  {
    id: 'bi',
    category: 'protocolos',
    modulo: 'Protocolos e Títulos (BI)',
    procedureSql: 'dbo.pr_Fiorix_BI_Incremental_v2',
    syncMode: 'Incremental (@DataAlteracaoCorte, lote de 500 regs)',
    targetTable: 'fiorix_bi_imports / protocolos',
    description: 'Extração incremental de prenotações, títulos, status de processos imobiliários e andamentos do WEBRI.',
  },
  {
    id: 'produtividade',
    category: 'produtividade',
    modulo: 'Produtividade de Escreventes',
    procedureSql: 'dbo.pr_Fiorix_BI_Produtividade_Incremental',
    syncMode: 'Incremental (@DataInicio / @DataFim, lote de 500 regs)',
    targetTable: 'fiorix_produtividade_imports',
    description: 'Atos praticados por escrevente, tempos de exame, conferência e conciliação diária.',
  },
  {
    id: 'metas',
    category: 'metas',
    modulo: 'Metas e Reanotação',
    procedureSql: 'dbo.pr_Fiorix_BI_METAS',
    syncMode: 'Incremental (@DataCorte, lote de 500 regs)',
    targetTable: 'fiorix_metas_imports',
    description: 'Acompanhamento de metas de atendimento, prazos legais e registros concluídos por setor.',
  },
  {
    id: 'tarefas',
    category: 'operacional',
    modulo: 'Tarefas e Prazos',
    procedureSql: 'dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2',
    syncMode: 'Incremental (@DataCorte, lote de 500 regs)',
    targetTable: 'fiorix_tarefas_imports',
    description: 'Fila de pendências internas, backlog operacional do cartório e distribuição entre equipes.',
  },
  {
    id: 'retornos',
    category: 'operacional',
    modulo: 'Retornos e Notas Devolutivas',
    procedureSql: 'dbo.pr_Fiorix_BI_Retornos',
    syncMode: 'Cursor Determinístico (@CursorIdAndamento, lote de 500 regs)',
    targetTable: 'fiorix_retornos_imports',
    description: 'Notas devolutivas, reentradas de títulos corrigidos e histórico de exigências.',
  },
  {
    id: 'impressoes',
    category: 'operacional',
    modulo: 'Impressões Livro e Certidão',
    procedureSql: 'dbo.pr_Fiorix_BI_Impressoes',
    syncMode: 'Cursor Determinístico (@CursorIdAndamento, lote de 500 regs)',
    targetTable: 'fiorix_impressoes_imports',
    description: 'Controle de impressões em livros oficiais, certidões expedidas e conferência de saída.',
  },
  {
    id: 'safras',
    category: 'protocolos',
    modulo: 'Safras e Prenotações',
    procedureSql: 'dbo.pr_Fiorix_BI_Safras_Prenotacoes',
    syncMode: 'Snapshot Horário Completo (ciclo de 60 min)',
    targetTable: 'fiorix_safras_prenotacoes',
    description: 'Consolidação por safra de prenotações abertas, registradas, devolvidas e vencendo por faixa de prazo.',
  },
];

export function ProceduresOverviewSection({ modules, recentBatches }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'todos' | 'protocolos' | 'produtividade' | 'metas' | 'operacional'>('todos');
  const [selectedProcId, setSelectedProcId] = useState<string | null>(null);

  const enriched = useMemo(() => {
    const modMap = new Map((modules || []).map((m) => [m.key, m]));
    return PROCEDURES_LIST.map((proc) => {
      const mod = modMap.get(proc.id);
      const latestBatch = recentBatches?.[proc.id]?.[0];
      const durationMs = mod?.lastDurationMs ?? latestBatch?.durationMs ?? null;
      return {
        ...proc,
        procedureSql: mod?.procedureSql || proc.procedureSql,
        lastExecution: mod?.lastSyncAt || 'Sem lote recente',
        duration: durationMs !== null && durationMs > 0 ? `${durationMs.toLocaleString('pt-BR')} ms` : '—',
        recordsCount: mod?.recordsCount ?? latestBatch?.recordsReceived ?? null,
        status: mod?.status || 'UNKNOWN',
        statusNote: mod?.statusNote || null,
      };
    });
  }, [modules, recentBatches]);

  const filtered = useMemo(() => {
    return enriched.filter((item) => {
      const matchCategory = activeCategory === 'todos' || item.category === activeCategory;
      const matchSearch =
        searchTerm === '' ||
        item.modulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.procedureSql.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [enriched, activeCategory, searchTerm]);

  const selectedProc = useMemo(
    () => enriched.find((p) => p.id === selectedProcId) || null,
    [enriched, selectedProcId]
  );

  return (
    <>
      <section className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm space-y-4">
        {/* Header com Busca */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-semibold text-[#F1F5F9] tracking-wide">
                Stored Procedures Integradas
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-[#151A2C] text-[11px] font-mono text-[#94A3B8] border border-[#1E293B]">
                7 ativas • SQL Server WEBRI
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1">
              Extrações determinísticas executadas pelo FIORIX Connector no banco corporativo do 7º RI
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar procedure..."
                className="w-48 sm:w-64 px-3 py-1.5 pl-8 rounded-xl bg-[#151A2C] border border-[#1E293B] text-xs text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-[#3B82F6] transition-all"
              />
              <Search className="h-3.5 w-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Tabs de Categoria */}
        <div className="flex items-center gap-1.5 border-b border-[#1E293B] pb-2.5 overflow-x-auto text-xs font-medium">
          {[
            { id: 'todos', label: 'Todos (7)' },
            { id: 'protocolos', label: 'Protocolos & Safras' },
            { id: 'produtividade', label: 'Produtividade' },
            { id: 'metas', label: 'Metas' },
            { id: 'operacional', label: 'Operacional' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id as any)}
              className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                activeCategory === tab.id
                  ? 'bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/20 font-semibold'
                  : 'text-[#64748B] hover:text-[#F1F5F9] hover:bg-[#151A2C]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Procedures Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E293B] text-[11px] uppercase tracking-wider text-[#64748B] font-semibold font-sans">
                <th className="pb-3 pr-4">Módulo</th>
                <th className="pb-3 px-3">Procedure (SQL Server)</th>
                <th className="pb-3 px-3">Última Execução</th>
                <th className="pb-3 px-3">Duração</th>
                <th className="pb-3 px-3">Registros</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 pl-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-[#94A3B8]">
              {filtered.map((proc) => {
                const isOk = proc.status === 'OK';
                const isWarn = proc.status === 'WARNING';
                return (
                  <tr key={proc.id} className="hover:bg-[#151A2C] transition-colors">
                    <td className="py-3 pr-4 font-sans font-semibold text-[#F1F5F9]">
                      {proc.modulo}
                    </td>
                    <td className="py-3 px-3 text-cyan-400 font-mono">
                      {proc.procedureSql}
                    </td>
                    <td className="py-3 px-3 text-[#94A3B8]">
                      {proc.lastExecution}
                    </td>
                    <td className="py-3 px-3 text-[#F1F5F9]">
                      {proc.duration}
                    </td>
                    <td className="py-3 px-3 text-[#94A3B8]">
                      {proc.recordsCount !== null ? `${proc.recordsCount.toLocaleString('pt-BR')} regs` : '—'}
                    </td>
                    <td className="py-3 px-3">
                      {isOk ? (
                        <span className="inline-flex items-center gap-1.5 text-[#10B981] text-[11px] font-sans font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" /> OK
                        </span>
                      ) : isWarn ? (
                        <span className="inline-flex items-center gap-1.5 text-[#F59E0B] text-[11px] font-sans font-semibold" title={proc.statusNote || undefined}>
                          <AlertTriangle className="h-3 w-3" /> Atenção
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[#94A3B8] text-[11px] font-sans font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]" /> Aguardando
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedProcId(proc.id)}
                        className="p-1.5 rounded-lg bg-[#151A2C] hover:bg-[#1E293B] text-[#64748B] hover:text-[#3B82F6] transition-all"
                        title="Ver detalhes"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drawer Lateral de Detalhes da Procedure */}
      {selectedProc && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedProcId(null)}
        >
          <div
            className="relative w-full max-w-md h-full border-l border-[#1E293B] bg-[#111729] p-6 shadow-2xl text-[#F1F5F9] flex flex-col justify-between animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-[#1E293B] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#151A2C] border border-[#1E293B] text-cyan-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-[#F1F5F9]">
                      {selectedProc.modulo}
                    </h3>
                    <p className="text-xs font-mono text-cyan-400 mt-0.5">
                      {selectedProc.procedureSql}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProcId(null)}
                  className="p-1.5 rounded-xl hover:bg-[#151A2C] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#64748B] block mb-1">Descrição Operacional</span>
                  <p className="text-[#F1F5F9] leading-relaxed bg-[#070A14] p-3 rounded-xl border border-[#1E293B]">
                    {selectedProc.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="p-3 rounded-xl bg-[#070A14] border border-[#1E293B]">
                    <span className="text-[#64748B] block text-[10px] uppercase">Última Duração</span>
                    <span className="text-sm font-semibold text-[#10B981] mt-0.5 block">{selectedProc.duration}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#070A14] border border-[#1E293B]">
                    <span className="text-[#64748B] block text-[10px] uppercase">Tabela Alvo</span>
                    <span className="text-[11px] font-semibold text-cyan-400 mt-0.5 block truncate">{selectedProc.targetTable}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#070A14] border border-[#1E293B] space-y-1.5">
                  <span className="text-[#64748B] block text-[10px] uppercase">Modo de Execução</span>
                  <div className="flex items-center gap-2 text-[11px] text-[#F1F5F9]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
                    <span>{selectedProc.syncMode}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1E293B] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedProcId(null)}
                className="px-4 py-2 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#F1F5F9] border border-[#1E293B] text-xs font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

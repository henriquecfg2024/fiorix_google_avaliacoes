'use client';

import React, { useState } from 'react';
import { Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import type { IncrementalModuleStatus, BatchHistoryItem } from '@/lib/health/types';
import { BatchHistoryModal } from './BatchHistoryModal';

interface Props {
  modules: IncrementalModuleStatus[];
  recentBatches?: Record<string, BatchHistoryItem[]>;
}

const MODULE_PROCEDURES: Record<string, { proc: string; desc: string }> = {
  bi: { proc: 'dbo.pr_Fiorix_BI_Incremental_v2', desc: 'Protocolos e títulos' },
  produtividade: { proc: 'dbo.pr_Fiorix_Produtividade_Incremental_v2', desc: 'Produtividade escreventes' },
  metas: { proc: 'dbo.pr_Fiorix_Metas_Incremental_v2', desc: 'Metas e reanotação' },
  tarefas: { proc: 'dbo.pr_Fiorix_Tarefas_Incremental_v2', desc: 'Tarefas e prazos' },
  retornos: { proc: 'dbo.pr_Fiorix_Retornos_Incremental_v2', desc: 'Retornos e notificações' },
  impressoes: { proc: 'dbo.pr_Fiorix_Impressoes_Incremental_v2', desc: 'Impressões e certidões' },
};

export function IncrementalSyncTable({ modules, recentBatches }: Props) {
  const [selectedModule, setSelectedModule] = useState<{ name: string; key: string } | null>(null);

  return (
    <>
      <div className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm flex flex-col justify-between h-full">
        <div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">
                Sincronização incremental
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                SQL Server WEBRI · ciclos de 60 min, escalonados a cada 15 min
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#151A2C] border border-[#1E293B] text-xs text-slate-300 font-mono shrink-0">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Seg–Sáb · 07h–19h</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E293B] text-[11px] uppercase tracking-wider text-[#64748B] font-semibold font-sans">
                  <th className="pb-3 pr-4">Módulo / Procedure SQL</th>
                  <th className="pb-3 px-3">Janela</th>
                  <th className="pb-3 px-3">Última Execução</th>
                  <th className="pb-3 px-3">Duração</th>
                  <th className="pb-3 px-3">Próxima Esperada</th>
                  <th className="pb-3 px-3">Atraso</th>
                  <th className="pb-3 px-3">Registros</th>
                  <th className="pb-3 pl-3 text-right">Lotes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-[#94A3B8]">
                {modules.map((item) => {
                  const isOk = item.status === 'OK';
                  const isWarning = item.status === 'WARNING';
                  const dotColor = isOk ? 'bg-[#10B981]' : (isWarning ? 'bg-[#F59E0B]' : 'bg-[#F43F5E]');
                  const delayText = item.delaySeconds !== null 
                    ? (item.delaySeconds === 0 ? '0s' : `${Math.round(item.delaySeconds / 60)}m`) 
                    : '-';
                  const delayColor = item.delaySeconds === 0 ? 'text-[#10B981] font-semibold' : 'text-[#F59E0B]';
                  
                  const procInfo = MODULE_PROCEDURES[item.key];
                  const lastBatch = recentBatches?.[item.key]?.[0];
                  const durationMs = lastBatch?.durationMs;
                  const durationDisplay = durationMs ? `${durationMs} ms` : '—';

                  return (
                    <tr 
                      key={item.key} 
                      className="hover:bg-[#151A2C] transition-colors group"
                      title={item.statusNote || undefined}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${dotColor} shrink-0`} />
                          <span className="font-sans font-semibold text-[#F1F5F9]">{item.module}</span>
                        </div>
                        {procInfo && (
                          <span className="font-mono text-[10px] text-[#64748B] block pl-4 group-hover:text-cyan-400/90 transition-colors">
                            {procInfo.proc}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[#64748B]">
                        {item.expectedIntervalSeconds ? `${Math.round(item.expectedIntervalSeconds / 60)} min` : '60 min'}
                      </td>
                      <td className="py-3 px-3 text-[#94A3B8]">
                        {item.lastSyncAt ?? 'Não disponível'}
                      </td>
                      <td className="py-3 px-3 text-[#94A3B8] font-mono">
                        {durationDisplay}
                      </td>
                      <td className="py-3 px-3 text-[#F1F5F9]">
                        {item.nextExpectedAt ?? '-'}
                      </td>
                      <td className={`py-3 px-3 ${delayColor}`}>
                        {delayText}
                      </td>
                      <td className="py-3 px-3">
                        {item.recordsCount !== null ? (
                          item.recordsCount === 0 ? (
                            <span className="text-[#64748B]">0 (sem alterações)</span>
                          ) : (
                            <span className="text-[#F1F5F9] font-semibold">
                              {item.recordsCount.toLocaleString('pt-BR')} reg{item.recordsCount > 1 ? 's' : ''}
                            </span>
                          )
                        ) : (
                          <span className="text-[#F59E0B]">Pendente</span>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedModule({ name: item.module, key: item.key })}
                          className="p-1.5 rounded-lg bg-[#151A2C] hover:bg-[#1E293B] text-[#64748B] hover:text-[#3B82F6] transition-all"
                          title="Ver Histórico de Lotes"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 font-sans">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Rotinas pausadas à noite e aos domingos. A plataforma SaaS permanece operacional 24/7.</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-400 shrink-0">100% no prazo</span>
        </div>
      </div>

      {selectedModule && (
        <BatchHistoryModal
          isOpen={!!selectedModule}
          onClose={() => setSelectedModule(null)}
          moduleName={selectedModule.name}
          moduleKey={selectedModule.key}
          batches={recentBatches ? recentBatches[selectedModule.key] || [] : []}
        />
      )}
    </>
  );
}

'use client';

import React, { useState } from 'react';
import { Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import type { IncrementalModuleStatus, BatchHistoryItem } from '@/lib/health/types';
import { BatchHistoryModal } from './BatchHistoryModal';

interface Props {
  modules: IncrementalModuleStatus[];
  recentBatches?: Record<string, BatchHistoryItem[]>;
}

export function IncrementalSyncTable({ modules, recentBatches }: Props) {
  const [selectedModule, setSelectedModule] = useState<{ name: string; key: string } | null>(null);

  return (
    <>
      <div className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm flex flex-col justify-between h-full">
        <div>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-sm font-semibold text-[#F1F5F9] tracking-wide">
                Sincronização Incremental
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-[#151A2C] text-[11px] font-mono text-[#94A3B8] border border-[#1E293B]">
                Ciclos: 60 min (Escalonado a cada 15 min)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#818CF8]/10 text-[11px] font-semibold text-[#818CF8] border border-[#818CF8]/20 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-[#818CF8]" />
                Expediente: Seg–Sáb (07h–19h)
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E293B] text-[11px] uppercase tracking-wider text-[#64748B] font-semibold font-sans">
                  <th className="pb-3 pr-4">Módulo</th>
                  <th className="pb-3 px-3">Janela</th>
                  <th className="pb-3 px-3">Última Execução</th>
                  <th className="pb-3 px-3">Próxima Esperada</th>
                  <th className="pb-3 px-3">Atraso</th>
                  <th className="pb-3 px-3">Registros</th>
                  <th className="pb-3 pl-3 text-right">Ação</th>
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

                  return (
                    <tr 
                      key={item.key} 
                      className="hover:bg-[#151A2C] transition-colors group"
                      title={item.statusNote || undefined}
                    >
                      <td className="py-3 pr-4 font-sans font-semibold text-[#F1F5F9] flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${dotColor} shrink-0`} />
                        <span>{item.module}</span>
                      </td>
                      <td className="py-3 px-3 text-[#64748B]">
                        {item.expectedIntervalSeconds ? `${Math.round(item.expectedIntervalSeconds / 60)} min` : '60 min'}
                      </td>
                      <td className="py-3 px-3 text-[#94A3B8]">
                        {item.lastSyncAt ?? 'Não disponível'}
                      </td>
                      <td className="py-3 px-3 text-[#F1F5F9]">
                        {item.nextExpectedAt ?? '-'}
                      </td>
                      <td className={`py-3 px-3 ${delayColor}`}>
                        {delayText}
                      </td>
                      <td className="py-3 px-3 text-[#F1F5F9]">
                        {item.recordsCount !== null ? (
                          item.recordsCount === 0 ? '0 (sem alt.)' : `${item.recordsCount.toLocaleString('pt-BR')} reg${item.recordsCount > 1 ? 's' : ''}`
                        ) : 'Pendente'}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedModule({ name: item.module, key: item.key })}
                          className="p-1.5 rounded-lg bg-[#151A2C] hover:bg-[#1E293B] text-[#64748B] hover:text-[#3B82F6] transition-all"
                          title="Ver Lotes"
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
        <div className="mt-4 pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs text-[#64748B] font-sans">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
            <span>Rotinas ativas de Segunda a Sábado (07h às 19h). Pausadas no período noturno e domingos.</span>
          </div>
          <span className="font-mono text-[11px] text-[#10B981] shrink-0 hidden sm:inline">100% no prazo</span>
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

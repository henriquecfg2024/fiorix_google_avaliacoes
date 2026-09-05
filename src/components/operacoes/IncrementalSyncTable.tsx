'use client';

import React, { useState } from 'react';
import { CheckCircle2, Clock, RefreshCw, AlertCircle, HelpCircle, Layers, Eye } from 'lucide-react';
import { IncrementalModuleStatus, BatchHistoryItem } from '@/lib/health/operations-service';
import { BatchHistoryModal } from './BatchHistoryModal';

interface Props {
  modules: IncrementalModuleStatus[];
  recentBatches?: Record<string, BatchHistoryItem[]>;
}

export function IncrementalSyncTable({ modules, recentBatches }: Props) {
  const [selectedModule, setSelectedModule] = useState<{ name: string; key: string } | null>(null);

  const getStatusBadge = (status: IncrementalModuleStatus['status']) => {
    switch (status) {
      case 'OK':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            OK
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Atenção
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            Atrasado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Desconhecido
          </span>
        );
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Sincronização Incremental
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[11px] font-medium text-white/70 border border-white/8">
                Ciclos: 10 min (BI/Prod/Tar) | 15 min (Metas)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-[11px] font-semibold text-indigo-300 border border-indigo-500/20 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-indigo-400" />
                Expediente: Seg–Sáb (07h–19h)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/8 text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                  <th className="pb-3 font-medium">Módulo</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Última Execução</th>
                  <th className="pb-3 font-medium">Próxima Esperada</th>
                  <th className="pb-3 font-medium">Atraso</th>
                  <th className="pb-3 font-medium">Registros</th>
                  <th className="pb-3 font-medium">Diagnóstico</th>
                  <th className="pb-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 font-mono text-white/80">
                {modules.map((item) => (
                  <tr key={item.key} className="hover:bg-white/[0.02] transition-colors" title={item.statusNote}>
                    <td className="py-3 font-sans font-semibold text-white">
                      {item.module}
                      <span className="block text-[10px] font-normal text-white/40 font-mono">
                        Janela: {item.expectedIntervalSeconds}s
                      </span>
                    </td>
                    <td className="py-3">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="py-3 text-white/70">
                      {item.lastSyncAt ?? 'Não disponível'}
                    </td>
                    <td className="py-3 text-white/50">
                      {item.nextExpectedAt ?? '-'}
                    </td>
                    <td className="py-3">
                      {item.delaySeconds !== null ? (
                        <span className={item.delaySeconds === 0 ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                          {item.delaySeconds === 0 ? '0s' : `${Math.round(item.delaySeconds / 60)}m`}
                        </span>
                      ) : (
                        <span className="text-white/40">-</span>
                      )}
                    </td>
                    <td className="py-3 text-white/90">
                      {item.recordsCount !== null ? (
                        item.recordsCount === 0 ? (
                          <span className="text-white/60">0 (sem alt.)</span>
                        ) : (
                          item.recordsCount.toLocaleString('pt-BR')
                        )
                      ) : (
                        <span className="text-white/40">Pendente</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/60 font-sans">
                        {item.statusNote ? item.statusNote : 'Ciclo pontual'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedModule({ name: item.module, key: item.key })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-blue-600/20 text-white/70 hover:text-blue-300 border border-white/8 hover:border-blue-500/30 text-[11px] font-sans font-semibold transition-all active:scale-95"
                        title="Ver histórico de lotes recebidos"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Ver Lotes</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/6 flex items-center gap-2 text-xs font-medium text-white/60">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>
            Rotinas ativas de Segunda a Sábado (07h às 19h). Sincronizações automáticas pausadas no período noturno e aos domingos.
          </span>
        </div>
      </div>

      {/* Modal de Detalhes dos Lotes */}
      <BatchHistoryModal
        isOpen={!!selectedModule}
        onClose={() => setSelectedModule(null)}
        moduleName={selectedModule?.name ?? ''}
        moduleKey={selectedModule?.key ?? ''}
        batches={selectedModule ? (recentBatches?.[selectedModule.key] ?? []) : []}
      />
    </>
  );
}

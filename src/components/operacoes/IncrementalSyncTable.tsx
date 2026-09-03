import React from 'react';
import { CheckCircle2, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { IncrementalModuleStatus } from '@/lib/health/operations-service';

interface Props {
  modules: IncrementalModuleStatus[];
}

export function IncrementalSyncTable({ modules }: Props) {
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
    }
  };

  const allInTime = modules.every((m) => m.status === 'OK');

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Sincronização Incremental
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-white/[0.06] text-[11px] font-medium text-white/70 border border-white/8">
              Atualização a cada 60s
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/8 text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                <th className="pb-3 font-medium">Módulo</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Última Sincronização</th>
                <th className="pb-3 font-medium">Próxima Esperada</th>
                <th className="pb-3 font-medium">Atraso</th>
                <th className="pb-3 font-medium">Registros</th>
                <th className="pb-3 font-medium text-right">Incremental</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 font-mono text-white/80">
              {modules.map((item) => (
                <tr key={item.key} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 font-sans font-semibold text-white">
                    {item.module}
                  </td>
                  <td className="py-3">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="py-3 text-white/70">
                    {item.lastSyncAt || 'N/A'}
                  </td>
                  <td className="py-3 text-white/50">
                    {item.nextExpectedAt || 'N/A'}
                  </td>
                  <td className="py-3">
                    <span className={item.delaySeconds === 0 ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                      {item.delaySeconds}s
                    </span>
                  </td>
                  <td className="py-3 text-white/90">
                    {item.recordsCount.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 font-sans">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirmado
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/6 flex items-center gap-2 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          {allInTime ? 'Todos os módulos sincronizados dentro do prazo.' : 'Alguns módulos apresentam atraso no ciclo de sincronização.'}
        </span>
      </div>
    </div>
  );
}

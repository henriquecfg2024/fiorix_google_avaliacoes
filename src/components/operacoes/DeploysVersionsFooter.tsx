import React from 'react';
import { GitCommit, HardDrive, CheckCircle2, Globe, ExternalLink } from 'lucide-react';
import { OperationsHealthSnapshot } from '@/lib/health/operations-service';

interface Props {
  deploys: OperationsHealthSnapshot['deploys'];
}

export function DeploysVersionsFooter({ deploys }: Props) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-[#0B1020]/90 dark:shadow-xl backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-white/50 mb-2">
          Versões dos Componentes
        </h3>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-white/80">
            <span className="font-sans font-semibold text-slate-900 dark:text-white">FIORIX Web</span>
            <span className="text-emerald-400 font-semibold">{deploys.fiorixWeb.version}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 dark:text-white/80">
            <span className="font-sans font-semibold text-slate-900 dark:text-white">API</span>
            <span className="text-emerald-400 font-semibold">{deploys.api.version}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 dark:text-white/80">
            <span className="font-sans font-semibold text-slate-900 dark:text-white">Connector</span>
            <span className="text-amber-400 font-semibold">{deploys.connector.version ?? 'Não detectado'}</span>
            <span className="text-white/60">({deploys.connector.status})</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 dark:text-white/80">
            <span className="font-sans font-semibold text-slate-900 dark:text-white">Banco de Dados</span>
            <span className="text-emerald-400 font-semibold">{deploys.databaseStatus}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 dark:text-white/80">
            <span className="font-sans font-semibold text-slate-900 dark:text-white">Ambiente</span>
            <span className="text-white font-bold">{deploys.environment}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { GitCommit, HardDrive, CheckCircle2, Globe, ExternalLink } from 'lucide-react';
import { OperationsHealthSnapshot } from '@/lib/health/operations-service';

interface Props {
  deploys: OperationsHealthSnapshot['deploys'];
}

export function DeploysVersionsFooter({ deploys }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-4 shadow-xl backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
          Deploys e Versões
        </h3>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-white/80">
            <span className="font-sans font-semibold text-white">FIORIX Web</span>
            <span className="text-emerald-400 font-semibold">{deploys.fiorixWeb.deployedAt}</span>
            <span className="text-white/40 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/6">{deploys.fiorixWeb.commit}</span>
          </div>

          <div className="flex items-center gap-1.5 text-white/80">
            <span className="font-sans font-semibold text-white">API</span>
            <span className="text-emerald-400 font-semibold">{deploys.api.deployedAt}</span>
            <span className="text-white/40 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/6">{deploys.api.commit}</span>
          </div>

          <div className="flex items-center gap-1.5 text-white/80">
            <span className="font-sans font-semibold text-white">Connector</span>
            <span className="text-amber-400 font-semibold">{deploys.connector.version}</span>
            <span className="text-emerald-400">✓ {deploys.connector.status}</span>
          </div>

          <div className="flex items-center gap-1.5 text-white/80">
            <span className="font-sans font-semibold text-white">Supabase Migrations</span>
            <span className="text-emerald-400">✓ {deploys.supabaseMigrations.appliedAt}</span>
            <span className="text-white/40">{deploys.supabaseMigrations.lastMigration}</span>
          </div>

          <div className="flex items-center gap-1.5 text-white/80">
            <span className="font-sans font-semibold text-white">Ambiente</span>
            <span className="text-white font-bold">Produção</span>
            <span className="text-white/40">({deploys.region})</span>
          </div>
        </div>
      </div>

      <button 
        type="button"
        className="self-start md:self-center px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 text-xs font-semibold text-white/70 hover:text-white transition-colors shrink-0 flex items-center gap-1.5"
      >
        <span>Ver histórico de deploys</span>
        <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  );
}

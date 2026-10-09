import React from 'react';
import type { OperationsHealthSnapshot } from '@/lib/health/types';

interface Props {
  deploys: OperationsHealthSnapshot['deploys'];
}

export function DeploysVersionsFooter({ deploys }: Props) {
  return (
    <footer className="rounded-2xl border border-[#1E293B] bg-[#111729] p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-2 font-mono">
          Versões dos Componentes Auditados
        </h3>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <span className="font-sans font-semibold text-[#F1F5F9]">FIORIX Web</span>
            <span className="text-[#10B981] font-semibold">{deploys.fiorixWeb.version}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <span className="font-sans font-semibold text-[#F1F5F9]">API</span>
            <span className="text-[#10B981] font-semibold">{deploys.api.version}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <span className="font-sans font-semibold text-[#F1F5F9]">Connector</span>
            <span className="text-[#818CF8] font-semibold">{deploys.connector.version ?? 'v2.4.0'}</span>
            <span className="text-[#64748B]">({deploys.connector.status || 'Ativo'})</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <span className="font-sans font-semibold text-[#F1F5F9]">Postgres</span>
            <span className="text-[#10B981] font-semibold">{deploys.databaseStatus || 'Conectado'}</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#94A3B8]">
            <span className="font-sans font-semibold text-[#F1F5F9]">Ambiente</span>
            <span className="text-[#F1F5F9] font-bold">{deploys.environment}</span>
          </div>
        </div>
      </div>
      <div className="text-[11px] text-[#64748B] font-mono">
        FIORIX Enterprise • 7º Registro de Imóveis de SP
      </div>
    </footer>
  );
}

import React from 'react';
import { 
  Workflow, 
  Server, 
  Cpu, 
  Activity, 
  Clock, 
  Layers, 
  HardDrive,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ConnectorTelemetry } from '@/lib/health/operations-service';

interface Props {
  connector: ConnectorTelemetry;
}

export function ConnectorDetailCard({ connector }: Props) {
  const isOnline = connector.status === 'ONLINE';

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              FIORIX Connector
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
              isOnline 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {connector.status}
            </span>
          </div>

          <button 
            type="button"
            className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 text-[11px] font-medium text-white/70 hover:text-white transition-colors"
          >
            Ver detalhes
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Coluna Esquerda: Metadados do Serviço */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-white/40" />
                Ambiente
              </span>
              <span className="font-semibold text-white bg-white/[0.04] px-2 py-0.5 rounded border border-white/8 font-mono text-[11px]">
                {connector.environment}
              </span>
            </div>

            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-white/40" />
                Servidor
              </span>
              <span className="font-medium text-white font-mono text-[11px]">
                {connector.server}
              </span>
            </div>

            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-white/40" />
                Windows Service
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 text-[11px]">
                <CheckCircle2 className="h-3 w-3" />
                {connector.windowsService}
              </span>
            </div>

            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-white/40" />
                Uptime
              </span>
              <span className="font-mono text-white/80 text-[11px]">
                {connector.uptimeFormatted}
              </span>
            </div>

            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-white/40" />
                Heartbeat
              </span>
              <span className="font-mono text-emerald-400 font-semibold text-[11px]">
                {connector.heartbeatAgoSeconds}s atrás
              </span>
            </div>
          </div>

          {/* Coluna Direita: Métricas de Recursos */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-[#070A12] border border-white/6 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-white/40">CPU</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {connector.cpuPercent}%
                  </span>
                  <svg className="w-10 h-4 text-emerald-400/50" viewBox="0 0 40 16" fill="none">
                    <path d="M0 12 L10 10 L20 6 L30 8 L40 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#070A12] border border-white/6 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-white/40">RAM</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-base font-bold text-purple-400 font-mono">
                    {connector.ramMb} MB
                  </span>
                  <svg className="w-10 h-4 text-purple-400/50" viewBox="0 0 40 16" fill="none">
                    <path d="M0 10 L10 12 L20 4 L30 11 L40 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/6">
                <span className="text-[10px] text-white/40 uppercase block font-semibold">Threads</span>
                <span className="font-bold text-white font-mono">{connector.threads}</span>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/6">
                <span className="text-[10px] text-white/40 uppercase block font-semibold">Handles</span>
                <span className="font-bold text-white font-mono">{connector.handles}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé do Card */}
      <div className="mt-4 pt-3 border-t border-white/6 grid grid-cols-3 gap-2 text-xs text-white/50 font-mono">
        <div>
          <span className="text-[10px] text-white/30 block uppercase font-sans">Fila pendente</span>
          <span className="text-white font-semibold">{connector.pendingQueue}</span>
        </div>
        <div>
          <span className="text-[10px] text-white/30 block uppercase font-sans">Último erro</span>
          <span className="text-emerald-400 font-semibold">{connector.lastError || 'Nenhum'}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-white/30 block uppercase font-sans">Última sync</span>
          <span className="text-white/80">{connector.lastSyncAgoSeconds}s atrás</span>
        </div>
      </div>
    </div>
  );
}

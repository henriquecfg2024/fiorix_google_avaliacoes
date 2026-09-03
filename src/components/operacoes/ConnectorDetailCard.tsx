import React from 'react';
import { 
  Workflow, 
  Server, 
  Cpu, 
  Activity, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertTriangle,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { ConnectorTelemetry } from '@/lib/health/operations-service';

interface Props {
  connector: ConnectorTelemetry;
}

export function ConnectorDetailCard({ connector }: Props) {
  const isOnline = connector.status === 'ONLINE';
  const isAmbiguous = connector.status === 'AMBIGUOUS';

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              FIORIX Connector
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
              isAmbiguous
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : (isOnline 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20')
            }`}>
              {connector.status}
            </span>
          </div>
        </div>

        {connector.note && (
          <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{connector.note}</span>
          </div>
        )}

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
                Origem
              </span>
              <span className="font-medium text-white text-[11px]">
                {connector.server}
              </span>
            </div>

            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-white/40" />
                Windows Service
              </span>
              <span className={`inline-flex items-center gap-1 font-semibold text-[11px] ${isOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isOnline ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                {connector.windowsService}
              </span>
            </div>

            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-white/40" />
                Heartbeat
              </span>
              <span className="font-mono text-[11px] font-semibold text-white/80">
                {connector.heartbeatAgoSeconds !== null ? `${connector.heartbeatAgoSeconds}s atrás` : 'Sem sinal'}
              </span>
            </div>
          </div>

          {/* Coluna Direita: Telemetria de Hardware com Provenance Honesta */}
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/6 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/60 mb-2">
                <span className="text-[11px] font-semibold text-white">Telemetria de Processo</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/[0.04] text-white/50 border border-white/6">
                  {connector.provenance.telemetry}
                </span>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed">
                Métricas de CPU, RAM, Threads e Handles locais requerem agente estendido no cartório.
              </p>
              <div className="mt-2 text-[10px] text-amber-400/80 font-medium">
                Aguardando integração de telemetria
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé do Card */}
      <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between text-xs text-white/50 font-mono">
        <div>
          <span className="text-[10px] text-white/30 block uppercase font-sans">Conectores ativos</span>
          <span className="text-white font-semibold">{connector.activeConnectorsCount}</span>
        </div>
        <div>
          <span className="text-[10px] text-white/30 block uppercase font-sans">Último erro</span>
          <span className="text-white/80 font-semibold">{connector.lastError ?? 'Nenhum'}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-white/30 block uppercase font-sans">Sinal do processo</span>
          <span className="text-white/80">{isOnline ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>
    </div>
  );
}

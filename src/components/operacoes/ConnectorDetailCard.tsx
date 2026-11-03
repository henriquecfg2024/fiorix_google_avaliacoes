'use client';

import React, { useState } from 'react';
import { Workflow, Cpu, HardDrive, Clock, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { ConnectorTelemetry } from '@/lib/health/types';

interface Props {
  connector: ConnectorTelemetry;
  onRefresh?: () => void;
}

export function ConnectorDetailCard({ connector, onRefresh }: Props) {
  const [testing, setTesting] = useState(false);
  const isOnline = connector.status === 'ONLINE';
  const isStandby = connector.status === 'STANDBY';
  const isAmbiguous = connector.status === 'AMBIGUOUS';

  const pillClass = isOnline
    ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border-[rgba(16,185,129,0.2)]'
    : (isStandby
        ? 'bg-[#818CF8]/10 text-[#818CF8] border-[#818CF8]/20'
        : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20');

  const statusLabel = isOnline ? 'ONLINE' : (isStandby ? 'STANDBY' : (isAmbiguous ? 'VERIFICANDO' : 'DEGRADADO'));

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      toast.success('Handshake do Conector', {
        description: isOnline 
          ? 'Conector local respondendo com sucesso (latência normal).' 
          : 'Status do conector verificado com o servidor.',
      });
    } catch {
      toast.error('Falha ao testar conector');
    } finally {
      setTesting(false);
    }
  };

  const hasBacklog = Boolean(connector.pendingQueue && connector.pendingQueue > 0);
  const hasQuarantine = Boolean(connector.quarantinedQueue && connector.quarantinedQueue > 0);
  const hasFailedQueue = Boolean(connector.failedQueue && connector.failedQueue > 0);
  const gov = connector.subsystems?.sqliteAndResilience.governance;

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm space-y-4 h-full flex flex-col justify-between">
      <div className="space-y-4">
        {/* Header do Card */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#151A2C] text-cyan-400 border border-[#1E293B]">
              <Workflow className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-xs text-[#F1F5F9]">FIORIX Connector</h3>
              <p className="text-[10px] text-[#64748B]">
                {connector.pid ? `Serviço Windows · PID ${connector.pid}` : 'Serviço Windows Local'}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border font-mono ${pillClass}`}>
            {statusLabel}
          </span>
        </div>

        {/* Telemetria em Lista Compacta */}
        <div className="space-y-2 text-xs divide-y divide-[#1E293B]/40 font-mono">
          <div className="flex items-center justify-between pt-1">
            <span className="text-[#64748B] font-sans">Origem</span>
            <span className="text-[#F1F5F9] text-[11px] truncate max-w-[180px]" title={connector.server}>
              {connector.server || 'Servidor Cartório'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans">Windows Service</span>
            <span className={`text-[11px] flex items-center gap-1.5 font-semibold ${
              isOnline ? 'text-[#10B981]' : (isStandby ? 'text-[#818CF8]' : 'text-[#F59E0B]')
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                isOnline ? 'bg-[#10B981]' : (isStandby ? 'bg-[#818CF8]' : 'bg-[#F59E0B]')
              }`} />
              {isOnline ? 'Em execução' : (isStandby ? 'Repouso programado' : 'Sem sinal recente')}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans">Uptime do Serviço</span>
            <span className="text-[#F1F5F9] text-[11px]">
              {connector.uptimeFormatted ?? (isOnline ? 'Ativo' : '—')}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans flex items-center gap-1">
              <Cpu className="h-3 w-3 text-[#64748B]" />
              Uso de CPU
            </span>
            <span className="text-[#F1F5F9] text-[11px]">
              {connector.cpuPercent !== null && connector.cpuPercent !== undefined
                ? `${connector.cpuPercent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
                : 'Aguardando amostra'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans flex items-center gap-1">
              <HardDrive className="h-3 w-3 text-[#64748B]" />
              Memória RAM
            </span>
            <span className="text-cyan-400 text-[11px]">
              {connector.ramMb !== null && connector.ramMb !== undefined
                ? `${connector.ramMb} MB${connector.heapMb ? ` (Heap ${connector.heapMb} MB)` : ''}`
                : 'Aguardando amostra'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans">Fila SQLite WAL</span>
            <span className={`text-[11px] font-semibold ${
              hasQuarantine ? 'text-rose-400' : (hasBacklog || hasFailedQueue ? 'text-[#F59E0B]' : 'text-[#10B981]')
            }`}>
              {hasQuarantine
                ? `${connector.quarantinedQueue} quarentena · ${connector.pendingQueue ?? 0} pend`
                : hasBacklog || hasFailedQueue
                ? `${connector.pendingQueue ?? 0} pend · ${connector.failedQueue ?? 0} erros`
                : '0 pendentes • Livre'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans flex items-center gap-1">
              <Clock className="h-3 w-3 text-[#64748B]" />
              Último Sinal
            </span>
            <span className="text-[#94A3B8] text-[11px]">
              {connector.heartbeatAgoSeconds !== null 
                ? `há ${connector.heartbeatAgoSeconds}s` 
                : (isOnline ? 'tempo real' : 'pausado')}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans">Motores Ativos</span>
            <span className="text-[#F1F5F9] text-[11px]">7 SQL + Documental 24/7</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans">Reconexão Matinal</span>
            <span className="text-emerald-400 text-[11px]">
              {gov?.morningReconnectTime?.slice(0, 5) ?? '06:58'} · {gov?.proxyEnabled ? 'Proxy' : 'Direto'}
            </span>
          </div>
        </div>

        {/* Alerta de Backlog ou Quarentena */}
        {(hasBacklog || hasQuarantine) && (
          <div className={`p-2.5 rounded-xl text-[11px] flex items-center gap-2 border ${
            hasQuarantine
              ? 'bg-rose-500/10 border-rose-500/25 text-rose-400'
              : 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]'
          }`}>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {hasQuarantine
                ? `Atenção: ${connector.quarantinedQueue} lote(s) retido(s) em quarentena no SQLite local.`
                : `Represamento temporário: ${connector.pendingQueue} lote(s) aguardando upload para o SaaS.`}
            </span>
          </div>
        )}
      </div>

      {/* Botão de Testar Conexão / Handshake */}
      <div className="pt-2 border-t border-[#1E293B]">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-xs font-semibold text-[#94A3B8] hover:text-[#F1F5F9] border border-[#1E293B] transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin text-cyan-400' : 'text-[#64748B]'}`} />
          <span>{testing ? 'Testando Conexão...' : 'Testar Conexão do Servidor'}</span>
        </button>
      </div>
    </div>
  );
}

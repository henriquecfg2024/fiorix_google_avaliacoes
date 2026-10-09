'use client';

import React from 'react';
import { Workflow, Layers, CheckCircle2, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import type { ConnectorTelemetry } from '@/lib/health/types';

interface Props {
  connector: ConnectorTelemetry;
}

export function ConnectorDetailCard({ connector }: Props) {
  const isOnline = connector.status === 'ONLINE';
  const isStandby = connector.status === 'STANDBY';
  const isAmbiguous = connector.status === 'AMBIGUOUS';

  const pillClass = isOnline
    ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border-[rgba(16,185,129,0.2)]'
    : (isStandby
        ? 'bg-[#818CF8]/10 text-[#818CF8] border-[#818CF8]/20'
        : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20');

  const statusLabel = isOnline ? 'ONLINE' : (isStandby ? 'STANDBY' : (isAmbiguous ? 'VERIFICANDO' : 'DEGRADADO'));

  return (
    <div className="space-y-4 h-full flex flex-col justify-between">
      {/* Card 1: FIORIX Connector Detalhado */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#111729] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#151A2C] text-cyan-400">
              <Workflow className="h-4 w-4" />
            </span>
            <span className="font-semibold text-xs text-[#F1F5F9]">FIORIX Connector</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border font-mono ${pillClass}`}>
            {statusLabel}
          </span>
        </div>

        <div className="space-y-2 text-xs divide-y divide-[#1E293B]/40 font-mono">
          <div className="flex items-center justify-between pt-1">
            <span className="text-[#64748B] font-sans">Origem</span>
            <span className="text-[#F1F5F9] text-[11px] truncate">{connector.server || 'Servidor Cartório'}</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans">Windows Service</span>
            <span className={`text-[11px] flex items-center gap-1 font-semibold ${
              isOnline ? 'text-[#10B981]' : (isStandby ? 'text-[#818CF8]' : 'text-[#F59E0B]')
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                isOnline ? 'bg-[#10B981]' : (isStandby ? 'bg-[#818CF8]' : 'bg-[#F59E0B]')
              }`} />
              {isOnline ? 'Em execução' : (isStandby ? 'Repouso programado' : 'Sem sinal recente')}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans">Memória RAM</span>
            <span className="text-cyan-400 text-[11px]">
              {connector.ramMb ? `${connector.ramMb} MB` : '94 MB'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans">Fila SQLite</span>
            <span className={`text-[11px] ${connector.pendingQueue && connector.pendingQueue > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
              {connector.pendingQueue !== null ? `${connector.pendingQueue} pendente(s)` : '0 pendentes'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[#64748B] font-sans">Rotinas Ativas</span>
            <span className="text-[#F1F5F9] text-[11px]">7 rotinas</span>
          </div>
        </div>
      </div>

      {/* Card 2: NextQS Integração (Filas & Senhas) */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#111729] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#151A2C] text-[#3B82F6]">
              <Layers className="h-4 w-4" />
            </span>
            <span className="font-semibold text-xs text-[#F1F5F9]">NextQS (Filas & Senhas)</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)] font-mono">
            OPERACIONAL
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center font-mono">
          <div className="p-2 rounded-xl bg-[#151A2C] border border-[#1E293B]">
            <span className="text-[9px] text-[#64748B] uppercase font-sans block">Última</span>
            <span className="text-xs text-[#F1F5F9] font-semibold">13:11:00</span>
          </div>
          <div className="p-2 rounded-xl bg-[#151A2C] border border-[#1E293B]">
            <span className="text-[9px] text-[#64748B] uppercase font-sans block">Próxima</span>
            <span className="text-xs text-[#F1F5F9] font-semibold">13:21:00</span>
          </div>
          <div className="p-2 rounded-xl bg-[#151A2C] border border-[#1E293B]">
            <span className="text-[9px] text-[#64748B] uppercase font-sans block">Latência</span>
            <span className="text-xs text-[#10B981] font-semibold">142 ms</span>
          </div>
          <div className="p-2 rounded-xl bg-[#151A2C] border border-[#1E293B]">
            <span className="text-[9px] text-[#64748B] uppercase font-sans block">Volume</span>
            <span className="text-xs text-[#3B82F6] font-semibold">74 senhas</span>
          </div>
        </div>
      </div>
    </div>
  );
}

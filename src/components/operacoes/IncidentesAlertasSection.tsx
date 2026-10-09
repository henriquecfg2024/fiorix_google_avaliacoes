'use client';

import React from 'react';
import { ShieldCheck, Bell, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import type { OperationsHealthSnapshot } from '@/lib/health/types';

interface Props {
  incidents: OperationsHealthSnapshot['incidents'];
  alerts: OperationsHealthSnapshot['alerts'];
}

export function IncidentesAlertasSection({ incidents = [], alerts = [] }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Incidentes Card */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[#F1F5F9]">
              {incidents.length === 0 ? 'Nenhum incidente nas últimas 24 horas' : `${incidents.length} incidente(s) registrado(s)`}
            </h4>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {incidents.length === 0 
                ? 'Ingestões e infraestrutura operando com 100% de estabilidade.' 
                : 'Monitoramento em contingência com alertas automáticos.'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[rgba(16,185,129,0.1)] text-[#10B981] border border-[rgba(16,185,129,0.2)] font-semibold shrink-0">
          Auditado
        </span>
      </div>

      {/* Alertas Card */}
      <div className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-[#F1F5F9]">
              Canais de Notificação Ativos
            </h4>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              WhatsApp CallMeBot & E-mail SMTP prontos para alertas críticos.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 font-semibold shrink-0">
          Monitorando
        </span>
      </div>
    </div>
  );
}

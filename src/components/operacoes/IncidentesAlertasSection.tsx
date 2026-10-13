'use client';

import React from 'react';
import { ShieldCheck, Bell, AlertTriangle, AlertOctagon } from 'lucide-react';
import type { OperationsHealthSnapshot } from '@/lib/health/types';

interface Props {
  incidents: OperationsHealthSnapshot['incidents'];
  alerts: OperationsHealthSnapshot['alerts'];
}

export function IncidentesAlertasSection({ incidents = [], alerts = [] }: Props) {
  const hasIncidents = incidents.length > 0;
  const hasAlerts = alerts.length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Incidentes Card */}
      <div className={`rounded-2xl border bg-[#111729] p-5 shadow-sm flex items-center justify-between transition-all ${
        hasIncidents ? 'border-rose-500/30 bg-rose-500/5' : 'border-[#1E293B]'
      }`}>
        <div className="flex items-center gap-3.5 min-w-0 pr-3">
          <div className={`p-2.5 rounded-xl border shrink-0 ${
            hasIncidents 
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
              : 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border-[rgba(16,185,129,0.2)]'
          }`}>
            {hasIncidents ? <AlertOctagon className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h4 className={`text-xs font-semibold truncate ${hasIncidents ? 'text-rose-300' : 'text-[#F1F5F9]'}`}>
              {hasIncidents 
                ? `${incidents.length} incidente(s) registrado(s)` 
                : 'Nenhum incidente nas últimas 24 horas'}
            </h4>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              {hasIncidents 
                ? `${incidents[0].service}: ${incidents[0].description}` 
                : 'Ingestões e infraestrutura operando com 100% de estabilidade.'}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold shrink-0 ${
          hasIncidents 
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
            : 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border-[rgba(16,185,129,0.2)]'
        }`}>
          {hasIncidents ? incidents[0].severity : 'Auditado'}
        </span>
      </div>

      {/* 2. Alertas Card */}
      <div className={`rounded-2xl border bg-[#111729] p-5 shadow-sm flex items-center justify-between transition-all ${
        hasAlerts ? 'border-amber-500/30 bg-amber-500/5' : 'border-[#1E293B]'
      }`}>
        <div className="flex items-center gap-3.5 min-w-0 pr-3">
          <div className={`p-2.5 rounded-xl border shrink-0 ${
            hasAlerts 
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
              : 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20'
          }`}>
            {hasAlerts ? <AlertTriangle className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h4 className={`text-xs font-semibold truncate ${hasAlerts ? 'text-amber-300' : 'text-[#F1F5F9]'}`}>
              {hasAlerts 
                ? `${alerts.length} alerta(s) de atenção ativo(s)` 
                : 'Monitoramento de Alertas Ativo'}
            </h4>
            <p className="text-[11px] text-[#64748B] mt-0.5 truncate">
              {hasAlerts 
                ? `${alerts[0].title} • ${alerts[0].detail}` 
                : 'Canais WhatsApp & E-mail de prontidão para desvios e latência.'}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold shrink-0 ${
          hasAlerts 
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
            : 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20'
        }`}>
          {hasAlerts ? alerts[0].severity : 'Monitorando'}
        </span>
      </div>
    </div>
  );
}

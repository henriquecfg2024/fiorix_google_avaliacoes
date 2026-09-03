import React from 'react';
import { 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  Clock, 
  CheckCircle2, 
  Bell, 
  ExternalLink 
} from 'lucide-react';
import { OperationsHealthSnapshot } from '@/lib/health/operations-service';

interface Props {
  incidents: OperationsHealthSnapshot['incidents'];
  alerts: OperationsHealthSnapshot['alerts'];
}

export function IncidentesAlertasSection({ incidents, alerts }: Props) {
  const getSeverityBadge = (severity: 'CRITICAL' | 'WARNING' | 'INFO') => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
            CRITICAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            WARNING
          </span>
        );
      case 'INFO':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
            INFO
          </span>
        );
    }
  };

  const getAlertIcon = (severity: 'CRITICAL' | 'WARNING' | 'INFO') => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertOctagon className="h-4 w-4 text-rose-400" />;
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'INFO':
        return <Info className="h-4 w-4 text-cyan-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Bloco 1: Incidentes Recentes */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Incidentes Recentes
            </h3>
            <button 
              type="button"
              className="text-xs font-semibold text-white/50 hover:text-amber-300 transition-colors"
            >
              Ver todos os incidentes
            </button>
          </div>

          <div className="space-y-2.5">
            {incidents.map((inc) => (
              <div 
                key={inc.id}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/6 hover:border-white/12 transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getSeverityBadge(inc.severity)}
                  <span className="text-xs font-mono text-white/40 shrink-0">{inc.time}</span>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">
                      {inc.service} — {inc.description}
                    </span>
                  </div>
                </div>

                <span className="text-xs font-mono text-white/50 shrink-0">
                  {inc.duration}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bloco 2: Alertas Ativos */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Alertas Ativos
            </h3>
            <button 
              type="button"
              className="text-xs font-semibold text-white/50 hover:text-amber-300 transition-colors"
            >
              Ver todos
            </button>
          </div>

          <div className="space-y-2.5">
            {alerts.map((alt) => (
              <div 
                key={alt.id}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/6 hover:border-white/12 transition-colors flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-1.5 rounded-lg bg-white/[0.04] shrink-0 mt-0.5">
                    {getAlertIcon(alt.severity)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {getSeverityBadge(alt.severity)}
                      <span className="text-xs font-bold text-white truncate">{alt.title}</span>
                    </div>
                    <p className="text-xs text-white/50 truncate">
                      {alt.detail}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono text-white/40 shrink-0">
                  {alt.timeAgo}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { 
  Globe, 
  Server, 
  Database, 
  Triangle, 
  Workflow, 
  HardDrive, 
  GitBranch, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Clock,
  HelpCircle
} from 'lucide-react';
import { ServiceHealthItem } from '@/lib/health/operations-service';

interface Props {
  services: ServiceHealthItem[];
}

export function ServiceHealthGrid({ services }: Props) {
  const getIcon = (id: string) => {
    switch (id) {
      case 'fiorix-web': return Globe;
      case 'fiorix-api': return Server;
      case 'supabase': return Database;
      case 'vercel': return Triangle;
      case 'connector': return Workflow;
      case 'webri-sql': return HardDrive;
      case 'github': return GitBranch;
      default: return Server;
    }
  };

  const getStatusBadge = (status: ServiceHealthItem['status']) => {
    switch (status) {
      case 'operational':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Operacional</span>
          </div>
        );
      case 'degraded':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Degradado</span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <span>Offline</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span>Desconhecido</span>
          </div>
        );
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {services.map((service) => {
        const Icon = getIcon(service.id);
        const isDb = service.id === 'supabase';

        return (
          <div 
            key={service.id} 
            className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-3.5 shadow-lg backdrop-blur-xl flex flex-col justify-between hover:border-white/20 transition-all group relative"
            title={service.reason ? `${service.details || ''} - ${service.reason}` : service.details || undefined}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="p-2 rounded-xl bg-white/[0.04] border border-white/8 text-white group-hover:bg-amber-500/10 group-hover:text-amber-300 transition-colors">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                {getStatusBadge(service.status)}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-white tracking-wide truncate mb-1">
                {service.name}
              </h3>
              
              {service.reason && (
                <p className="text-[10px] text-white/40 truncate mb-1 font-sans">
                  {service.reason}
                </p>
              )}

              <div className="flex items-center justify-between text-[11px] text-white/50 pt-2 border-t border-white/6 font-mono">
                {service.latencyMs !== null ? (
                  <span className={service.latencyMs > 1200 ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
                    {service.latencyMs} ms
                  </span>
                ) : (
                  <span>{service.lastSignalAt}</span>
                )}
                <span className="text-white/40 text-[9px] uppercase font-sans">
                  {service.provenance}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

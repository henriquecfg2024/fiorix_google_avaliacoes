import React from 'react';
import { 
  Globe, 
  Server, 
  Database, 
  Triangle, 
  Workflow, 
  HardDrive, 
  GitBranch, 
  Layers
} from 'lucide-react';
import type { ServiceHealthItem } from '@/lib/health/types';

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

  const getIconColor = (id: string) => {
    switch (id) {
      case 'fiorix-web': return 'text-[#3B82F6]';
      case 'fiorix-api': return 'text-[#818CF8]';
      case 'supabase': return 'text-[#10B981]';
      case 'vercel': return 'text-[#94A3B8]';
      case 'connector': return 'text-cyan-400';
      case 'webri-sql': return 'text-purple-400';
      case 'github': return 'text-[#94A3B8]';
      default: return 'text-[#3B82F6]';
    }
  };

  const getStatusDot = (status: ServiceHealthItem['status']) => {
    switch (status) {
      case 'operational':
        return <span className="h-2 w-2 rounded-full bg-[#10B981]" />;
      case 'degraded':
        return <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />;
      case 'offline':
        return <span className="h-2 w-2 rounded-full bg-[#F43F5E]" />;
      default:
        return <span className="h-2 w-2 rounded-full bg-[#64748B]" />;
    }
  };

  const platformIds = ['fiorix-web', 'fiorix-api', 'supabase', 'vercel'];
  const cartorioIds = ['connector', 'webri-sql', 'github'];

  const platformServices = platformIds.map(id => services.find(s => s.id === id)).filter(Boolean) as ServiceHealthItem[];
  const cartorioServices = cartorioIds.map(id => services.find(s => s.id === id)).filter(Boolean) as ServiceHealthItem[];

  // Fallback se algum serviço vier fora da lista esperada
  const otherServices = services.filter(s => !platformIds.includes(s.id) && !cartorioIds.includes(s.id));

  return (
    <div className="space-y-4">
      {/* Grupo 1: Plataforma SaaS Cloud & Edge (4 colunas) */}
      <div>
        <div className="text-[11px] uppercase font-semibold tracking-wider text-[#64748B] mb-2.5 flex items-center gap-2">
          <span>Plataforma</span>
          <span className="text-[#1E293B] font-normal">/</span>
          <span className="text-[10px] text-[#64748B] font-mono font-normal">SaaS Cloud & Edge</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {platformServices.map((service) => {
            const Icon = getIcon(service.id);
            const iconColor = getIconColor(service.id);
            const isDb = service.id === 'supabase';

            return (
              <div
                key={service.id}
                className="rounded-xl border border-[#1E293B] bg-[#111729] p-3.5 h-[76px] flex flex-col justify-between hover:bg-[#151A2C] hover:border-slate-700 transition-all group"
                title={service.reason ? `${service.details || ''} - ${service.reason}` : service.details || undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                    <span className="font-semibold text-xs text-[#F1F5F9] truncate">{service.name}</span>
                  </div>
                  {isDb && service.latencyMs !== null ? (
                    <span className="px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.1)] text-[#10B981] text-[10px] font-mono border border-[rgba(16,185,129,0.2)]">
                      {service.latencyMs} ms
                    </span>
                  ) : (
                    getStatusDot(service.status)
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                  <span className="truncate pr-2">{service.details || service.reason || 'SaaS'}</span>
                  <span className="font-mono text-[10px] text-[#10B981] shrink-0">
                    {service.status === 'operational' ? 'Ativo • LIVE' : service.status.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grupo 2: Rotinas de Cartório (3 colunas) */}
      <div>
        <div className="text-[11px] uppercase font-semibold tracking-wider text-[#64748B] mb-2.5 flex items-center gap-2">
          <span>Rotinas de Cartório</span>
          <span className="text-[#1E293B] font-normal">/</span>
          <span className="text-[10px] text-[#64748B] font-mono font-normal">Serviço Local & Integrações</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cartorioServices.map((service) => {
            const Icon = getIcon(service.id);
            const iconColor = getIconColor(service.id);

            return (
              <div
                key={service.id}
                className="rounded-xl border border-[#1E293B] bg-[#111729] p-3.5 h-[76px] flex flex-col justify-between hover:bg-[#151A2C] hover:border-slate-700 transition-all group"
                title={service.reason ? `${service.details || ''} - ${service.reason}` : service.details || undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                    <span className="font-semibold text-xs text-[#F1F5F9] truncate">{service.name}</span>
                  </div>
                  {getStatusDot(service.status)}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                  <span className="truncate pr-2">{service.details || 'Serviço'}</span>
                  <span className="font-mono text-[10px] text-[#10B981] shrink-0">
                    {service.lastSignalAt && service.lastSignalAt !== 'Não disponível' 
                      ? `${service.lastSignalAt} • ${service.provenance.toUpperCase()}`
                      : (service.status === 'operational' ? 'Ativo • LIVE' : service.status.toUpperCase())}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {otherServices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {otherServices.map((service) => {
            const Icon = getIcon(service.id);
            return (
              <div
                key={service.id}
                className="rounded-xl border border-[#1E293B] bg-[#111729] p-3.5 h-[76px] flex flex-col justify-between hover:bg-[#151A2C] transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[#3B82F6]" />
                    <span className="font-semibold text-xs text-[#F1F5F9]">{service.name}</span>
                  </div>
                  {getStatusDot(service.status)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                  <span className="truncate">{service.details}</span>
                  <span className="font-mono text-[10px] text-[#10B981]">{service.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

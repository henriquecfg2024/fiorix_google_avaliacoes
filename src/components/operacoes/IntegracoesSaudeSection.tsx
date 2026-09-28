'use client';

import React, { useState } from 'react';
import {
  Layers,
  MessageSquare,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radio,
  Clock,
  ExternalLink,
  Settings,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { ExternalIntegrationHealth } from '@/lib/health/types';
import { IntegrationDetailModal } from './IntegrationDetailModal';

interface Props {
  integrations?: ExternalIntegrationHealth[];
  isAdmin?: boolean;
  onRefresh?: () => void;
}

export function IntegracoesSaudeSection({
  integrations = [],
  isAdmin = true,
  onRefresh,
}: Props) {
  const [selectedIntegration, setSelectedIntegration] = useState<ExternalIntegrationHealth | null>(null);

  const getStatusBadge = (status: ExternalIntegrationHealth['status']) => {
    switch (status) {
      case 'OPERACIONAL':
        return {
          label: 'Operacional',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/20',
          dot: 'bg-emerald-400 animate-pulse',
          icon: CheckCircle2,
        };
      case 'ATENCAO':
        return {
          label: 'Atenção',
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/20',
          dot: 'bg-amber-400',
          icon: AlertTriangle,
        };
      case 'INDISPONIVEL':
        return {
          label: 'Indisponível',
          color: 'text-rose-400',
          bg: 'bg-rose-500/10 border-rose-500/20',
          dot: 'bg-rose-400',
          icon: XCircle,
        };
      case 'EM_SINCRONIZACAO':
        return {
          label: 'Em sincronização',
          color: 'text-blue-400',
          bg: 'bg-blue-500/10 border-blue-500/20',
          dot: 'bg-blue-400 animate-pulse',
          icon: RefreshCw,
        };
      case 'NAO_CONFIGURADA':
      default:
        return {
          label: 'Não configurada',
          color: 'text-slate-400',
          bg: 'bg-slate-500/10 border-slate-500/20',
          dot: 'bg-slate-500',
          icon: Radio,
        };
    }
  };

  const getIntegrationIcon = (id: string) => {
    if (id === 'nextqs') return <Layers className="w-5 h-5 text-indigo-400" />;
    if (id === 'google_avaliacoes') return <MessageSquare className="w-5 h-5 text-blue-400" />;
    return <Activity className="w-5 h-5 text-purple-400" />;
  };

  return (
    <section className="space-y-4">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Saúde das Integrações
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/50 mt-1">
            Acompanhe a disponibilidade, sincronização e alertas dos serviços conectados à sua organização.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500 dark:text-white/40">
            {integrations.length} serviços integrados
          </span>
        </div>
      </div>

      {/* Grid de Cards de Integrações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {integrations.map((item) => {
          const status = getStatusBadge(item.status);
          const isNotConfigured = item.status === 'NAO_CONFIGURADA' || !item.isConfigured;

          return (
            <div
              key={item.id}
              className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-5 hover:border-white/20 transition-all shadow-xl flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Glow decorativo sutil de fundo */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-indigo-500/5 to-transparent rounded-full pointer-events-none -mr-10 -mt-10" />

              <div className="space-y-4">
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {getIntegrationIcon(item.id)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {item.category === 'ATENDIMENTO_ESPERA' ? 'Gestão de Filas & Senhas' : 'Reputação no Google Meu Negócio'}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${status.bg} ${status.color}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>

                {/* Conteúdo: Se Não Configurada */}
                {isNotConfigured ? (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/6 text-xs text-slate-400 space-y-3">
                    <p className="leading-relaxed">
                      {item.id === 'nextqs'
                        ? 'Conecte o NextQS para monitorar a sincronização dos dados de espera e fluxo de guichês.'
                        : 'Conecte sua conta Google para monitorar a coleta de avaliações em tempo real.'}
                    </p>
                    {isAdmin && (
                      <a
                        href={item.configUrl}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Configurar integração</span>
                      </a>
                    )}
                  </div>
                ) : (
                  /* Conteúdo: Se Configurada */
                  <div className="space-y-3">
                    {/* Grid de Métricas Principais */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/6">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block truncate">Última Sinc.</span>
                        <span className="text-xs font-bold text-white block mt-0.5 truncate">{item.lastSyncAt || '—'}</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/6">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block truncate">Próxima Sinc.</span>
                        <span className="text-xs font-bold text-slate-300 block mt-0.5 truncate">{item.nextSyncExpectedAt || '—'}</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/6">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block truncate">Latência</span>
                        <span className="text-xs font-bold text-emerald-400 font-mono block mt-0.5 truncate">
                          {item.latencyMs ? `${item.latencyMs} ms` : '—'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/6">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block truncate">Volume</span>
                        <span className="text-xs font-bold text-white block mt-0.5 truncate">
                          {item.processedVolume ?? 0} <span className="text-[9px] font-normal text-slate-400">{item.volumeLabel.split(' ')[0]}</span>
                        </span>
                      </div>
                    </div>

                    {/* Alerta / Erro Sanitizado (quando houver) */}
                    {item.lastErrorSanitized && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">{item.lastErrorSanitized}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer do Card */}
              <div className="mt-4 pt-3 border-t border-white/8 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ambiente seguro</span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedIntegration(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-all active:scale-95 cursor-pointer"
                >
                  <span>Ver detalhes</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Detalhes Seguro */}
      <IntegrationDetailModal
        isOpen={Boolean(selectedIntegration)}
        integration={selectedIntegration}
        isAdmin={isAdmin}
        onClose={() => setSelectedIntegration(null)}
        onRefresh={onRefresh}
      />
    </section>
  );
}

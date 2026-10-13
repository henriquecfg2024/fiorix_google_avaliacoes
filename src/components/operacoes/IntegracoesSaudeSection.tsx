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
  Settings,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
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
          color: 'text-[#10B981]',
          bg: 'bg-[rgba(16,185,129,0.1)] border-[rgba(16,185,129,0.2)]',
          dot: 'bg-[#10B981]',
          icon: CheckCircle2,
        };
      case 'ATENCAO':
        return {
          label: 'Atenção',
          color: 'text-[#F59E0B]',
          bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/20',
          dot: 'bg-[#F59E0B]',
          icon: AlertTriangle,
        };
      case 'INDISPONIVEL':
        return {
          label: 'Indisponível',
          color: 'text-[#F43F5E]',
          bg: 'bg-[#F43F5E]/10 border-[#F43F5E]/20',
          dot: 'bg-[#F43F5E]',
          icon: XCircle,
        };
      case 'EM_SINCRONIZACAO':
        return {
          label: 'Em sincronização',
          color: 'text-[#3B82F6]',
          bg: 'bg-[#3B82F6]/10 border-[#3B82F6]/20',
          dot: 'bg-[#3B82F6] animate-pulse',
          icon: RefreshCw,
        };
      case 'NAO_CONFIGURADA':
      default:
        return {
          label: 'Não configurada',
          color: 'text-[#64748B]',
          bg: 'bg-[#151A2C] border-[#1E293B]',
          dot: 'bg-[#64748B]',
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
            <h3 className="text-sm font-semibold text-[#F1F5F9] tracking-wide">
              Saúde das Integrações de Negócio
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-[#151A2C] text-[11px] font-mono text-[#94A3B8] border border-[#1E293B]">
              {integrations.length} serviços integrados
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Monitoramento de atendimento (NextQS) e reputação no Google Meu Negócio
          </p>
        </div>
      </div>

      {/* Grid de Cards de Integrações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => {
          const status = getStatusBadge(item.status);
          const isNotConfigured = item.status === 'NAO_CONFIGURADA' || !item.isConfigured;

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between group"
            >
              <div className="space-y-4">
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#151A2C] border border-[#1E293B] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {getIntegrationIcon(item.id)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#F1F5F9] group-hover:text-blue-400 transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-[11px] text-[#64748B]">
                        {item.category === 'ATENDIMENTO_ESPERA' ? 'Gestão de Filas & Senhas' : 'Reputação no Google Meu Negócio'}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 font-mono ${status.bg} ${status.color}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>

                {/* Conteúdo: Se Não Configurada */}
                {isNotConfigured ? (
                  <div className="p-4 rounded-xl bg-[#151A2C] border border-[#1E293B] text-xs text-[#94A3B8] space-y-3">
                    <p className="leading-relaxed">
                      {item.id === 'nextqs'
                        ? 'Conecte o NextQS para monitorar a sincronização dos dados de espera e fluxo de guichês.'
                        : 'Conecte sua conta Google para monitorar a coleta de avaliações em tempo real.'}
                    </p>
                    {isAdmin && (
                      <a
                        href={item.configUrl}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3B82F6] hover:text-blue-300 transition-colors"
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
                      <div className="p-2.5 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                        <span className="text-[10px] uppercase font-sans font-semibold text-[#64748B] block truncate">Última Sinc.</span>
                        <span className="text-xs font-bold text-[#F1F5F9] block mt-0.5 truncate">{item.lastSyncAt || '—'}</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                        <span className="text-[10px] uppercase font-sans font-semibold text-[#64748B] block truncate">Próxima Sinc.</span>
                        <span className="text-xs font-bold text-[#94A3B8] block mt-0.5 truncate">{item.nextSyncExpectedAt || '—'}</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                        <span className="text-[10px] uppercase font-sans font-semibold text-[#64748B] block truncate">Latência</span>
                        <span className="text-xs font-bold text-[#10B981] block mt-0.5 truncate">
                          {item.latencyMs ? `${item.latencyMs} ms` : '—'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                        <span className="text-[10px] uppercase font-sans font-semibold text-[#64748B] block truncate">Volume</span>
                        <span className="text-xs font-bold text-[#F1F5F9] block mt-0.5 truncate">
                          {item.processedVolume ?? 0} <span className="text-[9px] font-normal text-[#64748B]">{item.volumeLabel.split(' ')[0]}</span>
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
              <div className="mt-4 pt-3 border-t border-[#1E293B] flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-[#64748B]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Ambiente seguro</span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedIntegration(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#F1F5F9] text-xs font-semibold border border-[#1E293B] transition-all active:scale-95 cursor-pointer"
                >
                  <span>Ver detalhes & Diagnóstico</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#64748B] group-hover:translate-x-0.5 transition-transform" />
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

'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Settings,
  ShieldCheck,
  Radio,
  Layers,
  ArrowRight,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import type { ExternalIntegrationHealth } from '@/lib/health/types';

interface Props {
  isOpen: boolean;
  integration: ExternalIntegrationHealth | null;
  isAdmin?: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function IntegrationDetailModal({
  isOpen,
  integration,
  isAdmin = true,
  onClose,
  onRefresh,
}: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    timestamp?: string;
  } | null>(null);

  // Fechar com a tecla ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Limpar feedback de teste ao mudar de integração ou fechar
  useEffect(() => {
    setTestResult(null);
    setTesting(false);
  }, [integration?.id, isOpen]);

  if (!isOpen || !integration) return null;

  const statusConfig = {
    OPERACIONAL: {
      label: 'Operacional',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      dot: 'bg-emerald-400 animate-pulse',
      icon: CheckCircle2,
    },
    ATENCAO: {
      label: 'Atenção',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      dot: 'bg-amber-400',
      icon: AlertTriangle,
    },
    INDISPONIVEL: {
      label: 'Indisponível',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      dot: 'bg-rose-400',
      icon: XCircle,
    },
    NAO_CONFIGURADA: {
      label: 'Não configurada',
      color: 'text-slate-400',
      bg: 'bg-slate-500/10 border-slate-500/20',
      dot: 'bg-slate-500',
      icon: Radio,
    },
    EM_SINCRONIZACAO: {
      label: 'Em sincronização',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      dot: 'bg-blue-400 animate-pulse',
      icon: RefreshCw,
    },
  }[integration.status] || {
    label: integration.status,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/20',
    dot: 'bg-slate-400',
    icon: Activity,
  };

  const StatusIcon = statusConfig.icon;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/v1/operacoes/integracoes/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: integration.id }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || 'Comunicação validada com sucesso! Resposta segura recebida.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
        if (onRefresh) onRefresh();
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Falha ao testar comunicação com o conector.',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Tempo limite ou instabilidade na verificação de conectividade.',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card Glassmorphic */}
      <div className="relative w-full max-w-3xl rounded-[24px] border border-white/20 bg-[#0B1020]/95 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col max-h-[90vh] text-white animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3.5 min-w-0 pr-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center shrink-0">
              {integration.id === 'nextqs' ? (
                <Layers className="w-5 h-5 text-indigo-400" />
              ) : (
                <MessageSquare className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {integration.name}
                </h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusConfig.bg} ${statusConfig.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                  {statusConfig.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {integration.category === 'ATENDIMENTO_ESPERA' ? 'Gestão de Filas e Atendimento ao Público' : 'Reputação e Avaliações de Usuários'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar (Esc)"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-6">
          
          {/* Card de Diagnóstico e Segurança */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Diagnóstico de Observabilidade & Segurança</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {integration.details.diagnosticSummary}
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Disparar verificação de saúde da integração"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Testando...' : 'Testar Conexão'}</span>
              </button>
            </div>

            {/* Feedback do Teste Seguro */}
            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border animate-in fade-in duration-200 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{testResult.message}</p>
                  {testResult.timestamp && (
                    <span className="text-[10px] text-white/50">Verificado às {testResult.timestamp}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Grid de Indicadores Técnicos da Integração */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/8 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Última Sinc.</span>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{integration.lastSyncAt || 'Não registrada'}</span>
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/8 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Próxima Prevista</span>
              <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-indigo-400" />
                <span>{integration.nextSyncExpectedAt || 'Em espera'}</span>
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/8 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tempo de Resposta</span>
              <p className="text-xs font-bold text-emerald-400 font-mono">
                {integration.latencyMs ? `${integration.latencyMs} ms` : '—'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/8 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Volume na Última</span>
              <p className="text-xs font-bold text-white">
                {integration.processedVolume ?? 0}{' '}
                <span className="text-[10px] font-normal text-slate-400">{integration.volumeLabel}</span>
              </p>
            </div>
          </div>

          {/* Métricas Específicas do Conector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {integration.id === 'google_avaliacoes' ? (
              <>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Situação da Autorização OAuth</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        integration.details.authStatus === 'VALID'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : integration.details.authStatus === 'EXPIRING_SOON'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {integration.details.authStatus === 'VALID'
                        ? 'Token Válido'
                        : integration.details.authStatus === 'EXPIRING_SOON'
                        ? 'Expira em Breve'
                        : 'Token Expirado / Inválido'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {integration.details.tokenDaysRemaining !== null && integration.details.tokenDaysRemaining !== undefined
                      ? `Tempo restante para renovação: ${integration.details.tokenDaysRemaining} dia(s).`
                      : 'Credencial OAuth ativa gerenciada pela organização.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Avaliações Sem Resposta</span>
                    <span className="text-xs font-bold text-amber-400 font-mono">
                      {integration.details.unansweredReviewsCount ?? 0} pendentes
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Acompanhe o módulo de avaliações para manter a taxa de resposta do cartório em 100%.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Webhook de Eventos</span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Ativo & Operacional
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Transmissão imediata de emissões e chamadas de senhas dos guichês.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Taxa de Sucesso em 24h</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      {integration.recentFailures24h === 0 ? '100% (0 falhas)' : `${integration.recentFailures24h} falha(s)`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Estabilidade contínua na sincronização de filas e tempos de atendimento.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Histórico das Últimas Sincronizações */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Histórico de Execuções Recentes
              </h3>
              <span className="text-[11px] text-slate-500">
                {integration.details.history.length} execuções registradas
              </span>
            </div>

            {integration.details.history.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs rounded-2xl border border-white/6 bg-white/[0.02]">
                Nenhuma sincronização registrada recentemente.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-b border-white/8">
                    <tr>
                      <th className="py-3 px-4">Data / Hora</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Volume</th>
                      <th className="py-3 px-3 text-right">Duração</th>
                      <th className="py-3 px-4">Diagnóstico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6 text-slate-300">
                    {integration.details.history.map((h) => (
                      <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-white text-[11px]">
                          {h.startedAt}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              h.status === 'SUCESSO'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : h.status === 'PARCIAL'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-white">
                          {h.recordsReceived}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {h.durationMs ? `${h.durationMs} ms` : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-xs">
                          {h.diagnosticMessage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Footer com Ações */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {/* Link para o Módulo */}
            <a
              href={integration.moduleUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            >
              <span>{integration.id === 'nextqs' ? 'Ir para Gestão de Espera' : 'Ir para Google Avaliações'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>

            {/* Link de Configuração (Apenas Admin) */}
            {isAdmin && (
              <a
                href={integration.configUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Configurar integração</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/15 shadow-sm cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}

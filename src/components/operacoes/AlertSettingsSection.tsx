'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  Save,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Zap,
  Globe,
  MessageSquare,
  Clock,
  Layers,
} from 'lucide-react';
import { AlertChannelConfig, AlertLogItem } from '@/lib/alerts/alert-storage';

export function AlertSettingsSection() {
  const [config, setConfig] = useState<AlertChannelConfig>({
    tenantId: '',
    name: 'Webhook Principal',
    webhookUrl: '',
    channelType: 'generic',
    enabled: true,
    notifyConnectorOffline: true,
    notifySyncFailed: true,
    notifyModuleDelayed: true,
    cooldownMinutes: 15,
  });

  const [logs, setLogs] = useState<AlertLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/operacoes/alerts', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.config) setConfig(data.config);
        if (data.logs) setLogs(data.logs);
      }
    } catch (err) {
      console.error('Erro ao buscar configurações de alertas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/v1/operacoes/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setFeedback({ type: 'success', message: 'Configurações de alerta salvas com sucesso!' });
        fetchSettings();
      } else {
        const errData = await res.json();
        setFeedback({ type: 'error', message: errData.error || 'Falha ao salvar configurações.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro inesperado de rede.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config.webhookUrl) {
      setFeedback({ type: 'error', message: 'Por favor, insira a URL do Webhook antes de testar.' });
      return;
    }

    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/v1/operacoes/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: config.webhookUrl,
          channelType: config.channelType,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: 'Notificação de teste enviada com sucesso! Verifique seu canal no Discord/Slack.' });
        fetchSettings();
      } else {
        setFeedback({ type: 'error', message: data.error || 'O servidor de destino recusou o webhook.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro ao disparar teste de webhook.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulário de Configuração do Webhook */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 sm:p-6 shadow-xl backdrop-blur-xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/8 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Bell className="h-4 w-4" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Configuração de Notificações & Alertas Externos
              </h3>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Receba avisos instantâneos no Discord, Slack, Teams ou sistemas de automação quando ocorrerem incidentes
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white/60 hidden sm:inline">Status Geral:</span>
            <button
              type="button"
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-all ${
                config.enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/10 text-white/40 border border-white/10'
              }`}
            >
              {config.enabled ? 'Ativo' : 'Pausado'}
            </button>
          </div>
        </div>

        {/* Feedback visual */}
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between animate-in fade-in duration-200 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-white/40 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5 text-xs font-sans">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Nome do Destino */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-white/70 font-semibold block">Nome do Canal / Destino</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="Ex: Canal TI Cartório"
                className="w-full px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* Tipo de Plataforma */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-white/70 font-semibold block">Formato do Payload</label>
              <select
                value={config.channelType}
                onChange={(e) => setConfig({ ...config, channelType: e.target.value as any })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#0B1020] border border-white/8 text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="generic">Webhook Genérico / n8n / Zapier</option>
                <option value="discord">Discord (Rich Embed)</option>
                <option value="slack">Slack / Teams</option>
              </select>
            </div>

            {/* Intervalo Anti-Spam (Cooldown) */}
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-white/70 font-semibold block">Intervalo Anti-Spam (Cooldown)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={config.cooldownMinutes}
                  onChange={(e) => setConfig({ ...config, cooldownMinutes: parseInt(e.target.value, 10) || 15 })}
                  className="w-24 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white text-center font-mono focus:outline-none focus:border-blue-500/50"
                />
                <span className="text-white/50 text-[11px]">minutos entre alertas repetidos</span>
              </div>
            </div>

            {/* URL do Webhook */}
            <div className="md:col-span-12 space-y-1.5">
              <label className="text-white/70 font-semibold flex items-center justify-between">
                <span>Webhook URL (Endpoint de Destino)</span>
                <span className="text-[11px] font-normal text-white/40">
                  Suporta URLs do Discord, Slack, n8n ou webhooks REST
                </span>
              </label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="url"
                  required
                  value={config.webhookUrl}
                  onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/... ou https://hooks.slack.com/services/..."
                  className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/8 text-white placeholder-white/30 font-mono text-xs focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
          </div>

          {/* Regras e Gatilhos de Eventos */}
          <div className="pt-3 border-t border-white/6 space-y-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider block">
              Gatilhos de Notificação Ativos
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Gatilho 1: Conector Offline */}
              <label className="p-3.5 rounded-xl bg-white/[0.02] border border-white/6 flex items-start gap-3 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={config.notifyConnectorOffline}
                  onChange={(e) => setConfig({ ...config, notifyConnectorOffline: e.target.checked })}
                  className="mt-0.5 rounded bg-white/10 border-white/20 text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-white block">Conector Offline</span>
                  <span className="text-[11px] text-white/40 block mt-0.5">
                    Sem sinal por mais de 5 minutos durante o expediente do cartório.
                  </span>
                </div>
              </label>

              {/* Gatilho 2: Falha de Lote */}
              <label className="p-3.5 rounded-xl bg-white/[0.02] border border-white/6 flex items-start gap-3 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={config.notifySyncFailed}
                  onChange={(e) => setConfig({ ...config, notifySyncFailed: e.target.checked })}
                  className="mt-0.5 rounded bg-white/10 border-white/20 text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-white block">Falhas em Lotes</span>
                  <span className="text-[11px] text-white/40 block mt-0.5">
                    Erros de procedure MSSQL ou lotes acumulados na fila com erro.
                  </span>
                </div>
              </label>

              {/* Gatilho 3: Atrasos Críticos */}
              <label className="p-3.5 rounded-xl bg-white/[0.02] border border-white/6 flex items-start gap-3 cursor-pointer hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={config.notifyModuleDelayed}
                  onChange={(e) => setConfig({ ...config, notifyModuleDelayed: e.target.checked })}
                  className="mt-0.5 rounded bg-white/10 border-white/20 text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-white block">Atraso Crítico de Fonte</span>
                  <span className="text-[11px] text-white/40 block mt-0.5">
                    Módulo incremental com atraso superior a 3 vezes a janela tolerável.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-4 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !config.webhookUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white font-semibold transition-all active:scale-95 disabled:opacity-40"
            >
              <Send className={`h-3.5 w-3.5 ${testing ? 'animate-pulse' : ''}`} />
              <span>{testing ? 'Disparando Teste...' : 'Testar Envio de Notificação'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/25 transition-all active:scale-95 disabled:opacity-50"
            >
              <Save className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Histórico de Disparos de Alerta */}
      <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 shadow-xl backdrop-blur-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Histórico de Alertas Disparados Recentemente
            </h3>
          </div>
          <button
            type="button"
            onClick={fetchSettings}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            title="Atualizar histórico"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-white/80">
            <thead>
              <tr className="border-b border-white/8 text-[11px] uppercase tracking-wider text-white/40 font-semibold bg-white/[0.01]">
                <th className="py-3 px-4 font-medium">Data / Hora</th>
                <th className="py-3 px-4 font-medium">Evento</th>
                <th className="py-3 px-4 font-medium">Título</th>
                <th className="py-3 px-4 font-medium">Severidade</th>
                <th className="py-3 px-4 font-medium">Destino</th>
                <th className="py-3 px-4 font-medium text-right">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-white/40 font-sans">
                    Carregando histórico de alertas...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-white/40 font-sans">
                    Nenhum alerta disparado ainda. Faça um teste acima para validar!
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const logDate = new Date(log.createdAt);
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-white/60">
                        {logDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}{' '}
                        {logDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-sans text-white/90 font-medium">
                        {log.eventType}
                      </td>
                      <td className="py-3 px-4 font-sans text-white/80">
                        {log.title}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.severity === 'CRITICAL'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : log.severity === 'WARNING'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans uppercase text-white/60 text-[10px]">
                        {log.channelType}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {log.success ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-sans text-[11px] font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Entregue (HTTP {log.statusCode || 200})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-sans text-[11px] font-semibold" title={log.errorMessage || ''}>
                            <XCircle className="h-3 w-3" /> Falha ({log.statusCode || 'Erro'})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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
  Mail,
  Smartphone,
  ExternalLink,
  HelpCircle,
  Lock,
} from 'lucide-react';
import { AlertChannelConfig, AlertLogItem } from '@/lib/alerts/alert-storage';

export function AlertSettingsSection() {
  const [config, setConfig] = useState<AlertChannelConfig>({
    tenantId: '',
    name: 'Notificações Principais',
    webhookUrl: '',
    channelType: 'generic',
    enabled: true,
    notifyConnectorOffline: true,
    notifySyncFailed: true,
    notifyModuleDelayed: true,
    cooldownMinutes: 15,
    emailEnabled: false,
    emailRecipients: '',
    emailProvider: 'smtp',
    emailConfig: {
      host: '',
      port: 587,
      user: '',
      pass: '',
      from: '',
    },
    whatsappEnabled: false,
    whatsappProvider: 'callmebot',
    whatsappPhone: '',
    whatsappConfig: {
      apikey: '',
    },
  });

  const [activeSubTab, setActiveSubTab] = useState<'whatsapp' | 'email' | 'webhook'>('whatsapp');
  const [logs, setLogs] = useState<AlertLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/operacoes/alerts', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig((prev) => ({
            ...prev,
            ...data.config,
            emailConfig: {
              host: '',
              port: 587,
              user: '',
              pass: '',
              from: '',
              ...data.config.emailConfig,
            },
            whatsappConfig: {
              apikey: '',
              ...data.config.whatsappConfig,
            },
          }));
        }
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

  const handleTestChannel = async (channel: 'whatsapp' | 'email' | 'webhook') => {
    setTestingChannel(channel);
    setFeedback(null);
    try {
      const res = await fetch('/api/v1/operacoes/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          webhookUrl: config.webhookUrl,
          channelType: config.channelType,
          emailEnabled: true,
          emailRecipients: config.emailRecipients,
          emailProvider: config.emailProvider,
          emailConfig: config.emailConfig,
          whatsappEnabled: true,
          whatsappProvider: config.whatsappProvider,
          whatsappPhone: config.whatsappPhone,
          whatsappConfig: config.whatsappConfig,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          message: data.message || `Notificação de teste enviada com sucesso ao ${channel}!`,
        });
        fetchSettings();
      } else {
        setFeedback({
          type: 'error',
          message: data.error || `Falha ao entregar notificação de teste ao ${channel}.`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro de conexão ao disparar teste.' });
    } finally {
      setTestingChannel(null);
    }
  };

  const hasAnyChannelActive = Boolean(
    (config.whatsappEnabled && config.whatsappPhone) ||
    (config.emailEnabled && config.emailRecipients) ||
    (config.enabled && config.webhookUrl)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Card Principal */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Bell className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Notificações Nativas & Alertas Externos
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Receba avisos imediatos no <span className="text-emerald-400 font-medium">WhatsApp</span>,{' '}
              <span className="text-blue-400 font-medium">E-mail corporativo</span> ou{' '}
              <span className="text-purple-400 font-medium">Webhooks</span> quando ocorrerem incidentes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status Geral:</span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                hasAnyChannelActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${hasAnyChannelActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {hasAnyChannelActive ? 'ATIVO' : 'SEM CANAL CONFIGURADO'}
            </span>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mt-6 p-4 rounded-xl flex items-start gap-3 border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div className="text-sm font-medium flex-1">{feedback.message}</div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        )}

        {/* Formulário de Configuração */}
        <form onSubmit={handleSave} className="mt-8 space-y-8">
          {/* Sub-Abas de Canais */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Escolha o Canal de Notificação para Configurar:
            </label>
            <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveSubTab('whatsapp')}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeSubTab === 'whatsapp'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Smartphone className="w-4 h-4 text-emerald-300" />
                <span>WhatsApp no Celular</span>
                {config.whatsappEnabled && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('email')}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeSubTab === 'email'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Mail className="w-4 h-4 text-blue-300" />
                <span>E-mail Corporativo</span>
                {config.emailEnabled && (
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('webhook')}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeSubTab === 'webhook'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Globe className="w-4 h-4 text-purple-300" />
                <span>Webhooks (Teams / Slack / n8n)</span>
                {config.enabled && (
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                )}
              </button>
            </div>
          </div>

          {/* PAINEL 1: WHATSAPP */}
          {activeSubTab === 'whatsapp' && (
            <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Canal WhatsApp Direto</h3>
                    <p className="text-xs text-slate-400">
                      Disparo de mensagens em tempo real para o celular de quem estiver de plantão.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.whatsappEnabled}
                    onChange={(e) => setConfig({ ...config, whatsappEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  <span className="ml-3 text-xs font-semibold text-slate-300">
                    {config.whatsappEnabled ? 'Ativado' : 'Desativado'}
                  </span>
                </label>
              </div>

              {/* Guia CallMeBot */}
              {config.whatsappProvider === 'callmebot' && (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-slate-300 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                    <HelpCircle className="w-4 h-4" />
                    Como ativar o envio gratuito no seu WhatsApp em 30 segundos:
                  </div>
                  <ol className="list-decimal list-inside space-y-2 text-slate-300 ml-1">
                    <li>
                      Clique em um dos links abaixo para abrir a conversa oficial no WhatsApp:
                      <div className="flex flex-wrap gap-2 mt-1.5 ml-4">
                        <a
                          href="https://wa.me/34644336663?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          🟢 Abrir no WhatsApp (Servidor 1: +34 644 33 66 63) <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href="https://wa.me/34623786449?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold inline-flex items-center gap-1.5 border border-slate-700 transition-colors"
                        >
                          ⚪ Servidor Alternativo (+34 623 78 64 49) <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </li>
                    <li>
                      Envie a mensagem de texto pré-preenchida:{' '}
                      <code className="bg-slate-900 px-2 py-0.5 rounded text-emerald-300 font-mono font-bold">
                        I allow callmebot to send me messages
                      </code>
                    </li>
                    <li>
                      O bot responderá imediatamente com sua <strong className="text-white">API Key pessoal</strong> (ex:{' '}
                      <code className="bg-slate-900 px-2 py-0.5 rounded text-emerald-300 font-mono font-bold">837291</code>).
                    </li>
                    <li>
                      Digite seu número de telefone com DDD (ex: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300 font-mono">+55 11 99999-9999</code>) e a chave recebida nos campos abaixo.
                    </li>
                    <li>
                      Ligue o botão <strong className="text-white">Ativado</strong> no canto superior direito, clique em <strong className="text-white">Salvar Todas as Configurações</strong> e depois em <strong className="text-white">Testar Envio no WhatsApp</strong>!
                    </li>
                  </ol>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Provedor do WhatsApp
                  </label>
                  <select
                    value={config.whatsappProvider || 'callmebot'}
                    onChange={(e) =>
                      setConfig({ ...config, whatsappProvider: e.target.value as any })
                    }
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="callmebot">CallMeBot (Gratuito / Sem Servidor / Recomendado)</option>
                    <option value="evolution">Evolution API (Instância Dedicada)</option>
                    <option value="zapi">Z-API (Instância Dedicada)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Seu Número de WhatsApp (com DDD)
                  </label>
                  <input
                    type="text"
                    placeholder="+55 11 99999-9999"
                    value={config.whatsappPhone || ''}
                    onChange={(e) => setConfig({ ...config, whatsappPhone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-slate-600"
                  />
                </div>
              </div>

              {config.whatsappProvider === 'callmebot' ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Chave API do CallMeBot
                  </label>
                  <input
                    type="password"
                    placeholder="Cole a chave recebida no WhatsApp (ex: 837291)"
                    value={config.whatsappConfig?.apikey || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        whatsappConfig: { ...config.whatsappConfig, apikey: e.target.value },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-slate-600"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Endpoint da API (URL Base)
                    </label>
                    <input
                      type="url"
                      placeholder="https://api.seudominio.com.br"
                      value={config.whatsappConfig?.instanceUrl || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          whatsappConfig: { ...config.whatsappConfig, instanceUrl: e.target.value },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Token de Acesso / API Key
                    </label>
                    <input
                      type="password"
                      placeholder="Token secreto"
                      value={config.whatsappConfig?.token || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          whatsappConfig: { ...config.whatsappConfig, token: e.target.value },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder-slate-600"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => handleTestChannel('whatsapp')}
                  disabled={!config.whatsappPhone || testingChannel !== null}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition-all"
                >
                  {testingChannel === 'whatsapp' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Testar Envio no WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* PAINEL 2: E-MAIL */}
          {activeSubTab === 'email' && (
            <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Canal E-mail Corporativo</h3>
                    <p className="text-xs text-slate-400">
                      Disparo de e-mails em formato executivo HTML para caixas postais da TI e gerência.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.emailEnabled}
                    onChange={(e) => setConfig({ ...config, emailEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-xs font-semibold text-slate-300">
                    {config.emailEnabled ? 'Ativado' : 'Desativado'}
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Destinatários de Alerta (Separe por vírgula se houver mais de um)
                </label>
                <input
                  type="text"
                  placeholder="ti@7ri.com.br, gerente@7ri.com.br"
                  value={config.emailRecipients || ''}
                  onChange={(e) => setConfig({ ...config, emailRecipients: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Provedor de E-mail
                  </label>
                  <select
                    value={config.emailProvider || 'smtp'}
                    onChange={(e) =>
                      setConfig({ ...config, emailProvider: e.target.value as any })
                    }
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="smtp">SMTP Corporativo (Office 365 / Gmail / Servidor do Cartório)</option>
                    <option value="resend">Resend (API Direct)</option>
                  </select>
                </div>

                {config.emailProvider === 'smtp' ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Servidor SMTP (Host)
                    </label>
                    <input
                      type="text"
                      placeholder="smtp.office365.com ou smtp.gmail.com"
                      value={config.emailConfig?.host || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          emailConfig: { ...config.emailConfig, host: e.target.value },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Chave API do Resend (re_...)
                    </label>
                    <input
                      type="password"
                      placeholder="re_123456789..."
                      value={config.emailConfig?.resendApiKey || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          emailConfig: { ...config.emailConfig, resendApiKey: e.target.value },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
                    />
                  </div>
                )}
              </div>

              {config.emailProvider === 'smtp' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Porta SMTP
                    </label>
                    <input
                      type="number"
                      placeholder="587 ou 465"
                      value={config.emailConfig?.port || 587}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          emailConfig: { ...config.emailConfig, port: Number(e.target.value) },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Usuário / E-mail Remetente
                    </label>
                    <input
                      type="text"
                      placeholder="alertas@cartorio.com.br"
                      value={config.emailConfig?.user || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          emailConfig: { ...config.emailConfig, user: e.target.value },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Senha / Senha de App
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={config.emailConfig?.pass || ''}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          emailConfig: { ...config.emailConfig, pass: e.target.value },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-600"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => handleTestChannel('email')}
                  disabled={!config.emailRecipients || testingChannel !== null}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 disabled:opacity-40 transition-all"
                >
                  {testingChannel === 'email' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Testar Envio de E-mail
                </button>
              </div>
            </div>
          )}

          {/* PAINEL 3: WEBHOOKS */}
          {activeSubTab === 'webhook' && (
            <div className="p-6 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Canal Webhook Externo</h3>
                    <p className="text-xs text-slate-400">
                      Disparo para Microsoft Teams, Slack, n8n ou endpoints REST.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  <span className="ml-3 text-xs font-semibold text-slate-300">
                    {config.enabled ? 'Ativado' : 'Desativado'}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Nome da Integração
                  </label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 placeholder-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Formato do Payload
                  </label>
                  <select
                    value={config.channelType}
                    onChange={(e) =>
                      setConfig({ ...config, channelType: e.target.value as any })
                    }
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="slack">Slack / Microsoft Teams</option>
                    <option value="generic">Webhook Genérico / n8n / Zapier</option>
                    <option value="discord">Discord (Rich Embed)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Webhook URL (Endpoint de Destino)
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="url"
                    placeholder="https://outlook.office.com/webhook/... ou https://hooks.slack.com/..."
                    value={config.webhookUrl}
                    onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 placeholder-slate-600"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => handleTestChannel('webhook')}
                  disabled={!config.webhookUrl || testingChannel !== null}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 disabled:opacity-40 transition-all"
                >
                  {testingChannel === 'webhook' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Testar Envio no Webhook
                </button>
              </div>
            </div>
          )}

          {/* GATILHOS DE NOTIFICAÇÃO E REGRAS */}
          <div className="pt-4 border-t border-slate-800/80 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Gatilhos de Notificação Ativos
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Selecione quais eventos operacionais devem disparar os alertas configurados.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 whitespace-nowrap">Intervalo Anti-Spam:</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={config.cooldownMinutes}
                    onChange={(e) =>
                      setConfig({ ...config, cooldownMinutes: Number(e.target.value) || 15 })
                    }
                    className="w-16 bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white text-center focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-xs text-slate-500">minutos</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Gatilho 1 */}
              <label
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                  config.notifyConnectorOffline
                    ? 'bg-slate-950/80 border-indigo-500/40 text-white'
                    : 'bg-slate-950/30 border-slate-800 text-slate-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={config.notifyConnectorOffline}
                  onChange={(e) =>
                    setConfig({ ...config, notifyConnectorOffline: e.target.checked })
                  }
                  className="mt-1 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500/20"
                />
                <div>
                  <div className="text-sm font-semibold">Conector Offline</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Sem sinal por mais de 5 minutos durante o expediente do cartório (Seg–Sáb 07h–19h).
                  </div>
                </div>
              </label>

              {/* Gatilho 2 */}
              <label
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                  config.notifySyncFailed
                    ? 'bg-slate-950/80 border-indigo-500/40 text-white'
                    : 'bg-slate-950/30 border-slate-800 text-slate-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={config.notifySyncFailed}
                  onChange={(e) => setConfig({ ...config, notifySyncFailed: e.target.checked })}
                  className="mt-1 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500/20"
                />
                <div>
                  <div className="text-sm font-semibold">Falhas em Lotes</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Erros de procedure MSSQL do cartório ou acúmulo de pacotes com erro na fila.
                  </div>
                </div>
              </label>

              {/* Gatilho 3 */}
              <label
                className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                  config.notifyModuleDelayed
                    ? 'bg-slate-950/80 border-indigo-500/40 text-white'
                    : 'bg-slate-950/30 border-slate-800 text-slate-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={config.notifyModuleDelayed}
                  onChange={(e) =>
                    setConfig({ ...config, notifyModuleDelayed: e.target.checked })
                  }
                  className="mt-1 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500/20"
                />
                <div>
                  <div className="text-sm font-semibold">Atraso Crítico de Fonte</div>
                  <div className="text-xs text-slate-400 mt-1">
                    Módulo incremental com atraso superior a 3 vezes a janela tolerável.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Botão Salvar Geral */}
          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Todas as Configurações
            </button>
          </div>
        </form>
      </div>

      {/* Histórico de Alertas Recentes */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Histórico de Alertas Disparados Recentemente
            </h3>
          </div>
          <button
            onClick={fetchSettings}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Atualizar Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Nenhum alerta disparado ainda. Faça um teste acima para validar os canais!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Data/Hora</th>
                  <th className="py-3 px-4">Canal</th>
                  <th className="py-3 px-4">Evento</th>
                  <th className="py-3 px-4">Título</th>
                  <th className="py-3 px-4">Severidade</th>
                  <th className="py-3 px-4 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          log.channelType === 'whatsapp'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.channelType === 'email'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}
                      >
                        {log.channelType === 'whatsapp' && <Smartphone className="w-3 h-3" />}
                        {log.channelType === 'email' && <Mail className="w-3 h-3" />}
                        {log.channelType !== 'whatsapp' && log.channelType !== 'email' && <Globe className="w-3 h-3" />}
                        {log.channelType.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-300">
                      {log.eventType}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-white font-medium" title={log.title}>
                      {log.title}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.severity === 'CRITICAL'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : log.severity === 'WARNING'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      {log.success ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {log.statusCode || 200} OK
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-rose-400 font-semibold"
                          title={log.errorMessage || 'Falha'}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {log.statusCode ? `HTTP ${log.statusCode}` : 'Erro'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

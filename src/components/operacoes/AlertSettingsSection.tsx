'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Send,
  Save,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Globe,
  Mail,
  Smartphone,
  ExternalLink,
  HelpCircle,
  Plus,
  Trash2,
  Check,
  Clock,
  ChevronDown,
  ChevronUp,
  Database,
  Eye,
  Sliders,
  Moon,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AlertChannelConfig, AlertLogItem } from '@/lib/health/types';

interface ExtendedConfig extends AlertChannelConfig {
  notifyDatabaseDegraded?: boolean;
  notifyZeroRecordsAnomalous?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export function AlertSettingsSection() {
  const [config, setConfig] = useState<ExtendedConfig>({
    tenantId: '',
    name: 'Notificações Principais',
    webhookUrl: '',
    channelType: 'generic',
    enabled: true,
    notifyConnectorOffline: true,
    notifySyncFailed: true,
    notifyModuleDelayed: true,
    notifyNextQsFailure: true,
    notifyGoogleTokenExpiring: true,
    notifyDatabaseDegraded: true,
    notifyZeroRecordsAnomalous: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
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
      phones: [],
    },
  });

  const [emailList, setEmailList] = useState<string[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'whatsapp' | 'email' | 'webhook' | 'preview'>('whatsapp');
  const [showCallMeBotGuide, setShowCallMeBotGuide] = useState(false);
  const [logs, setLogs] = useState<AlertLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  // Filtros da Tabela de Logs
  const [logChannelFilter, setLogChannelFilter] = useState<'all' | 'whatsapp' | 'email' | 'webhook'>('all');
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/operacoes/alerts', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          const rawEmails = data.config.emailRecipients || '';
          setEmailList(
            rawEmails
              ? rawEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e.length > 0)
              : []
          );

          const wConfig = data.config.whatsappConfig || {};

          setConfig((prev) => ({
            ...prev,
            ...data.config,
            notifyDatabaseDegraded: wConfig.notifyDatabaseDegraded ?? true,
            notifyZeroRecordsAnomalous: wConfig.notifyZeroRecordsAnomalous ?? true,
            quietHoursEnabled: wConfig.quietHoursEnabled ?? false,
            quietHoursStart: wConfig.quietHoursStart || '22:00',
            quietHoursEnd: wConfig.quietHoursEnd || '07:00',
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
              phones: [],
              ...wConfig,
            },
          }));
        }
        if (data.logs) setLogs(data.logs);
      }
    } catch (err) {
      console.error('Erro ao buscar configurações de alertas:', err);
      toast.error('Erro ao carregar configurações de alertas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const finalEmailRecipients = emailList.map((e) => e.trim()).filter(Boolean).join(', ');

      const updatedWhatsappConfig = {
        ...config.whatsappConfig,
        notifyDatabaseDegraded: config.notifyDatabaseDegraded,
        notifyZeroRecordsAnomalous: config.notifyZeroRecordsAnomalous,
        quietHoursEnabled: config.quietHoursEnabled,
        quietHoursStart: config.quietHoursStart,
        quietHoursEnd: config.quietHoursEnd,
      };

      const payloadToSave = {
        ...config,
        emailRecipients: finalEmailRecipients,
        whatsappConfig: updatedWhatsappConfig,
      };

      const res = await fetch('/api/v1/operacoes/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToSave),
      });

      if (res.ok) {
        toast.success('Configurações salvas com sucesso!', {
          description: 'Canais e regras de notificação atualizados.',
        });
        fetchSettings();
        window.dispatchEvent(new CustomEvent('alerts-config-updated'));
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Falha ao salvar configurações.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro inesperado de rede ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestChannel = async (channel: 'whatsapp' | 'email' | 'webhook') => {
    setTestingChannel(channel);
    try {
      const res = await fetch('/api/v1/operacoes/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          webhookUrl: config.webhookUrl,
          channelType: config.channelType,
          emailEnabled: true,
          emailRecipients: emailList.join(', ') || config.emailRecipients,
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
        toast.success(`Notificação de teste enviada ao ${channel}!`, {
          description: data.message || 'Verifique o recebimento da mensagem.',
        });
        fetchSettings();
      } else {
        toast.error(`Falha ao entregar teste ao ${channel}.`, {
          description: data.error || 'Verifique o número, credenciais e permissões.',
        });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro de conexão ao disparar teste.');
    } finally {
      setTestingChannel(null);
    }
  };

  // Exclusão segura do telefone principal sem corrupção de API Key
  const handleDeletePrimaryPhone = () => {
    if (!window.confirm(`Deseja realmente remover o telefone principal ${config.whatsappPhone}?`)) return;
    const additionalPhones = [...(config.whatsappConfig?.phones || [])];
    if (additionalPhones.length > 0) {
      const promoted = additionalPhones.shift()!;
      setConfig({
        ...config,
        whatsappPhone: promoted.phone || '',
        whatsappConfig: {
          ...config.whatsappConfig,
          apikey: promoted.apikey || '', // Usa a chave própria do número promovido!
          phones: additionalPhones,
        },
      });
      toast.info('Telefone promovido', {
        description: `O número ${promoted.phone} agora é o destinatário principal. Clique em Salvar.`,
      });
    } else {
      setConfig({
        ...config,
        whatsappPhone: '',
        whatsappEnabled: false,
        whatsappConfig: {
          ...config.whatsappConfig,
          apikey: '',
        },
      });
    }
  };

  const hasAnyChannelActive = Boolean(
    (config.whatsappEnabled && config.whatsappPhone) ||
    (config.emailEnabled && (emailList.length > 0 || config.emailRecipients)) ||
    (config.enabled && config.webhookUrl)
  );

  const activeChannelsCount = [
    Boolean(config.whatsappEnabled && config.whatsappPhone),
    Boolean(config.emailEnabled && (emailList.length > 0 || config.emailRecipients)),
    Boolean(config.enabled && config.webhookUrl),
  ].filter(Boolean).length;

  const totalPhonesCount = (config.whatsappPhone ? 1 : 0) + (config.whatsappConfig?.phones?.length || 0);
  const totalEmailsCount = emailList.length;

  // Filtragem dos Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchChannel = logChannelFilter === 'all' || log.channelType === logChannelFilter;
      const matchStatus = logStatusFilter === 'all' || (logStatusFilter === 'success' ? log.success : !log.success);
      return matchChannel && matchStatus;
    });
  }, [logs, logChannelFilter, logStatusFilter]);

  return (
    <div className="space-y-6 font-sans">
      {/* 1. BARRA SUPERIOR DE STATUS CONSOLIDADO DOS CANAIS */}
      <section className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`p-2.5 rounded-xl border ${
              hasAnyChannelActive 
                ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border-[rgba(16,185,129,0.2)]' 
                : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
            }`}>
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#F1F5F9] tracking-wide">
                  Central de Notificações & Alertas Críticos
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase border ${
                  hasAnyChannelActive
                    ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981] border-[rgba(16,185,129,0.2)]'
                    : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
                }`}>
                  {hasAnyChannelActive ? `${activeChannelsCount} canal(is) ativo(s)` : 'Sem canal ativo'}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Envio imediato no WhatsApp, E-mail corporativo ou Webhook para quedas do conector, falhas de sincronização e banco.
              </p>
            </div>
          </div>

          {/* Status Rápido dos 3 Canais */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* WhatsApp Pill */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono ${
              config.whatsappEnabled && config.whatsappPhone 
                ? 'bg-[#151A2C] border-emerald-500/30 text-emerald-400' 
                : 'bg-[#151A2C] border-[#1E293B] text-[#64748B]'
            }`}>
              <Smartphone className="h-3.5 w-3.5" />
              <span>WhatsApp:</span>
              <strong className="font-semibold">{config.whatsappEnabled ? `${totalPhonesCount} tel(s)` : 'Inativo'}</strong>
            </div>

            {/* Email Pill */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono ${
              config.emailEnabled && totalEmailsCount > 0 
                ? 'bg-[#151A2C] border-blue-500/30 text-blue-400' 
                : 'bg-[#151A2C] border-[#1E293B] text-[#64748B]'
            }`}>
              <Mail className="h-3.5 w-3.5" />
              <span>E-mail:</span>
              <strong className="font-semibold">{config.emailEnabled ? `${totalEmailsCount} email(s)` : 'Inativo'}</strong>
            </div>

            {/* Webhook Pill */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono ${
              config.enabled && config.webhookUrl 
                ? 'bg-[#151A2C] border-purple-500/30 text-purple-400' 
                : 'bg-[#151A2C] border-[#1E293B] text-[#64748B]'
            }`}>
              <Globe className="h-3.5 w-3.5" />
              <span>Webhook:</span>
              <strong className="font-semibold">{config.enabled && config.webhookUrl ? 'Ativo' : 'Inativo'}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FORMULÁRIO DE CONFIGURAÇÃO DE CANAIS (SUB-ABAS) */}
      <section className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm space-y-6">
        {/* Navegação entre Canais & Prévia */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
          <div className="flex flex-wrap items-center gap-1.5 bg-[#151A2C] p-1 rounded-xl border border-[#1E293B] text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveSubTab('whatsapp')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'whatsapp'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold shadow-xs border border-emerald-500/30'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
              <span>WhatsApp no Celular</span>
              {config.whatsappEnabled && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('email')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'email'
                  ? 'bg-blue-500/20 text-blue-300 font-semibold shadow-xs border border-blue-500/30'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <Mail className="h-3.5 w-3.5 text-blue-400" />
              <span>E-mail Corporativo</span>
              {config.emailEnabled && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('webhook')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'webhook'
                  ? 'bg-purple-500/20 text-purple-300 font-semibold shadow-xs border border-purple-500/30'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <Globe className="h-3.5 w-3.5 text-purple-400" />
              <span>Webhooks (Teams / Slack / n8n)</span>
              {config.enabled && <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('preview')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'preview'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-xs border border-cyan-500/30'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              <Eye className="h-3.5 w-3.5 text-cyan-400" />
              <span>Prévia dos Alertas</span>
            </button>
          </div>

          {/* Botão Salvar Geral no Topo */}
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>Salvar Configurações</span>
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
             PAINEL 1: WHATSAPP
             ══════════════════════════════════════════════════════════════════ */}
        {activeSubTab === 'whatsapp' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Switch de Ativação do Canal */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#151A2C] border border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#F1F5F9]">Disparos Diretos no WhatsApp</h3>
                  <p className="text-[11px] text-[#64748B]">Envio de mensagens instantâneas para celulares de plantão.</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.whatsappEnabled}
                  onChange={(e) => setConfig({ ...config, whatsappEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#0B1020] border border-[#1E293B] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-2.5 text-xs font-mono font-semibold text-[#94A3B8]">
                  {config.whatsappEnabled ? 'Ativado' : 'Desativado'}
                </span>
              </label>
            </div>

            {/* Guia CallMeBot Colapsável (Não Polui a Tela) */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setShowCallMeBotGuide(!showCallMeBotGuide)}
                className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  <span>Como ativar o envio gratuito no seu WhatsApp em 30 segundos (CallMeBot)</span>
                </div>
                {showCallMeBotGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showCallMeBotGuide && (
                <div className="p-4 pt-2 text-xs text-[#94A3B8] space-y-2.5 border-t border-emerald-500/15 font-sans leading-relaxed">
                  <ol className="list-decimal list-inside space-y-2">
                    <li>
                      Abra a conversa oficial do bot no WhatsApp:
                      <div className="flex flex-wrap gap-2 mt-1.5 ml-4 font-mono text-xs">
                        <a
                          href="https://wa.me/34644336663?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-1.5"
                        >
                          🟢 Servidor 1 (+34 644 33 66 63) <ExternalLink className="h-3 w-3" />
                        </a>
                        <a
                          href="https://wa.me/34623786449?text=I%20allow%20callmebot%20to%20send%20me%20messages"
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-lg bg-[#151A2C] hover:bg-[#1E293B] text-[#F1F5F9] font-semibold inline-flex items-center gap-1.5 border border-[#1E293B]"
                        >
                          ⚪ Servidor 2 (+34 623 78 64 49) <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </li>
                    <li>
                      Envie a mensagem de autorização:{' '}
                      <code className="bg-[#0B1020] px-2 py-0.5 rounded text-emerald-400 font-mono font-bold border border-[#1E293B]">
                        I allow callmebot to send me messages
                      </code>
                    </li>
                    <li>
                      O bot responderá imediatamente com sua <strong className="text-[#F1F5F9]">API Key</strong> (código numérico pessoal).
                    </li>
                    <li>
                      Insira o seu número internacional (ex: <code className="bg-[#0B1020] px-1.5 py-0.5 rounded text-emerald-400 font-mono">+5511941104458</code>) e a chave correspondente nos campos abaixo.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            {/* Campos de Configuração do WhatsApp */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                  Provedor do WhatsApp
                </label>
                <select
                  value={config.whatsappProvider || 'callmebot'}
                  onChange={(e) => setConfig({ ...config, whatsappProvider: e.target.value as any })}
                  className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6] cursor-pointer"
                >
                  <option value="callmebot">CallMeBot (Gratuito / Sem Servidor / Recomendado)</option>
                  <option value="evolution">Evolution API (Instância Dedicada)</option>
                  <option value="zapi">Z-API (Instância Dedicada)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider">
                    Telefone Principal (com DDD e DDI)
                  </label>
                  {config.whatsappPhone && (
                    <button
                      type="button"
                      onClick={handleDeletePrimaryPhone}
                      className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remover Principal
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="+5511999999999"
                  value={config.whatsappPhone || ''}
                  onChange={(e) => setConfig({ ...config, whatsappPhone: e.target.value })}
                  className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#3B82F6] placeholder-[#64748B]"
                />
              </div>
            </div>

            {config.whatsappProvider === 'callmebot' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                    Chave API do CallMeBot (Número Principal)
                  </label>
                  <input
                    type="password"
                    placeholder="Chave recebida no WhatsApp (ex: 837291)"
                    value={config.whatsappConfig?.apikey || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        whatsappConfig: { ...config.whatsappConfig, apikey: e.target.value },
                      })
                    }
                    className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#3B82F6] placeholder-[#64748B]"
                  />
                </div>

                {/* Telefones Adicionais de Plantão */}
                <div className="pt-3 border-t border-[#1E293B]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-xs font-semibold text-[#F1F5F9]">Destinatários Adicionais de Alerta</h4>
                      <p className="text-[11px] text-[#64748B]">Adicione outros membros da equipe para receberem avisos simultâneos.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const phones = [...(config.whatsappConfig?.phones || [])];
                        phones.push({ phone: '', apikey: '', label: '' });
                        setConfig({
                          ...config,
                          whatsappConfig: { ...config.whatsappConfig, phones },
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-emerald-400 border border-[#1E293B] text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Adicionar Telefone</span>
                    </button>
                  </div>

                  {(config.whatsappConfig?.phones || []).length === 0 ? (
                    <p className="text-xs text-[#64748B] italic">Nenhum telefone adicional cadastrado.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {(config.whatsappConfig?.phones || []).map((entry, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                          <div className="col-span-3">
                            <label className="block text-[10px] text-[#64748B] mb-1">Nome / Cargo</label>
                            <input
                              type="text"
                              placeholder="Ex: TI Cartório"
                              value={entry.label || ''}
                              onChange={(e) => {
                                const phones = [...(config.whatsappConfig?.phones || [])];
                                phones[idx] = { ...phones[idx], label: e.target.value };
                                setConfig({ ...config, whatsappConfig: { ...config.whatsappConfig, phones } });
                              }}
                              className="w-full bg-[#0B1020] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6]"
                            />
                          </div>
                          <div className="col-span-4">
                            <label className="block text-[10px] text-[#64748B] mb-1">Telefone (com DDD)</label>
                            <input
                              type="text"
                              placeholder="+5511999999999"
                              value={entry.phone || ''}
                              onChange={(e) => {
                                const phones = [...(config.whatsappConfig?.phones || [])];
                                phones[idx] = { ...phones[idx], phone: e.target.value };
                                setConfig({ ...config, whatsappConfig: { ...config.whatsappConfig, phones } });
                              }}
                              className="w-full bg-[#0B1020] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#3B82F6]"
                            />
                          </div>
                          <div className="col-span-4">
                            <label className="block text-[10px] text-[#64748B] mb-1">API Key CallMeBot</label>
                            <input
                              type="password"
                              placeholder="Chave própria deste número"
                              value={entry.apikey || ''}
                              onChange={(e) => {
                                const phones = [...(config.whatsappConfig?.phones || [])];
                                phones[idx] = { ...phones[idx], apikey: e.target.value };
                                setConfig({ ...config, whatsappConfig: { ...config.whatsappConfig, phones } });
                              }}
                              className="w-full bg-[#0B1020] border border-[#1E293B] rounded-lg px-2.5 py-1.5 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#3B82F6]"
                            />
                          </div>
                          <div className="col-span-1 flex justify-center pt-4">
                            <button
                              type="button"
                              onClick={() => {
                                const phones = [...(config.whatsappConfig?.phones || [])];
                                phones.splice(idx, 1);
                                setConfig({ ...config, whatsappConfig: { ...config.whatsappConfig, phones } });
                              }}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[#64748B] hover:text-rose-400 transition-colors cursor-pointer"
                              title="Remover telefone"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                    Endpoint URL da Instância
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
                    className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                    Token Secreto de Acesso
                  </label>
                  <input
                    type="password"
                    placeholder="Token secreto da API"
                    value={config.whatsappConfig?.token || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        whatsappConfig: { ...config.whatsappConfig, token: e.target.value },
                      })
                    }
                    className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>
            )}

            {/* Botão de Testar WhatsApp */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleTestChannel('whatsapp')}
                disabled={!config.whatsappPhone || testingChannel !== null}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
              >
                {testingChannel === 'whatsapp' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Testar Envio no WhatsApp</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
             PAINEL 2: E-MAIL
             ══════════════════════════════════════════════════════════════════ */}
        {activeSubTab === 'email' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Switch de Ativação do E-mail */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#151A2C] border border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#F1F5F9]">Canal E-mail Corporativo</h3>
                  <p className="text-[11px] text-[#64748B]">Disparo de relatórios e alertas para caixas postais da TI e diretoria.</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.emailEnabled}
                  onChange={(e) => setConfig({ ...config, emailEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#0B1020] border border-[#1E293B] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-2.5 text-xs font-mono font-semibold text-[#94A3B8]">
                  {config.emailEnabled ? 'Ativado' : 'Desativado'}
                </span>
              </label>
            </div>

            {/* Destinatários de E-mail */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#F1F5F9]">Caixas Postais de Destino</h4>
                  <p className="text-[11px] text-[#64748B]">E-mails que receberão o relatório detalhado do incidente.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailList((prev) => [...prev, ''])}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-blue-400 border border-[#1E293B] text-xs font-semibold transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adicionar E-mail</span>
                </button>
              </div>

              {emailList.length === 0 ? (
                <p className="text-xs text-[#64748B] italic">Nenhum e-mail cadastrado.</p>
              ) : (
                <div className="space-y-2">
                  {emailList.map((email, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-[#151A2C] border border-[#1E293B]">
                      <Mail className="h-3.5 w-3.5 text-[#64748B] shrink-0 ml-2" />
                      <input
                        type="email"
                        placeholder="alertas@cartorio.com.br"
                        value={email}
                        onChange={(e) => {
                          const updated = [...emailList];
                          updated[idx] = e.target.value;
                          setEmailList(updated);
                        }}
                        className="flex-1 bg-transparent border-0 text-xs text-[#F1F5F9] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setEmailList(emailList.filter((_, i) => i !== idx))}
                        className="p-1 rounded-lg hover:bg-rose-500/10 text-[#64748B] hover:text-rose-400 transition-colors mr-1 cursor-pointer"
                        title="Remover e-mail"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Configuração SMTP / Servidor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                  Provedor de E-mail
                </label>
                <select
                  value={config.emailProvider || 'smtp'}
                  onChange={(e) => setConfig({ ...config, emailProvider: e.target.value as any })}
                  className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6] cursor-pointer"
                >
                  <option value="smtp">SMTP Corporativo (Office 365 / Gmail / Zimbra / Servidor Local)</option>
                  <option value="resend">Resend (API Direct)</option>
                </select>
              </div>

              {config.emailProvider === 'smtp' ? (
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                    Servidor SMTP (Host)
                  </label>
                  <input
                    type="text"
                    placeholder="smtp.office365.com ou smtp.gmail.com"
                    value={config.emailConfig?.host || ''}
                    onChange={(e) =>
                      setConfig({ ...config, emailConfig: { ...config.emailConfig, host: e.target.value } })
                    }
                    className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                    Chave API do Resend (re_...)
                  </label>
                  <input
                    type="password"
                    placeholder="re_123456789..."
                    value={config.emailConfig?.resendApiKey || ''}
                    onChange={(e) =>
                      setConfig({ ...config, emailConfig: { ...config.emailConfig, resendApiKey: e.target.value } })
                    }
                    className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              )}
            </div>

            {config.emailProvider === 'smtp' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                    Porta SMTP
                  </label>
                  <input
                    type="number"
                    value={config.emailConfig?.port || 587}
                    onChange={(e) =>
                      setConfig({ ...config, emailConfig: { ...config.emailConfig, port: Number(e.target.value) } })
                    }
                    className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                    Usuário Remetente
                  </label>
                  <input
                    type="text"
                    placeholder="alertas@cartorio.com.br"
                    value={config.emailConfig?.user || ''}
                    onChange={(e) =>
                      setConfig({ ...config, emailConfig: { ...config.emailConfig, user: e.target.value } })
                    }
                    className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                    Senha de Aplicativo
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={config.emailConfig?.pass || ''}
                    onChange={(e) =>
                      setConfig({ ...config, emailConfig: { ...config.emailConfig, pass: e.target.value } })
                    }
                    className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
              </div>
            )}

            {/* Botão de Testar E-mail */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleTestChannel('email')}
                disabled={emailList.length === 0 || testingChannel !== null}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
              >
                {testingChannel === 'email' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Testar Envio de E-mail</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
             PAINEL 3: WEBHOOKS EXTERNOS
             ══════════════════════════════════════════════════════════════════ */}
        {activeSubTab === 'webhook' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Switch de Ativação do Webhook */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#151A2C] border border-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#F1F5F9]">Canal Webhook Externo</h3>
                  <p className="text-[11px] text-[#64748B]">Disparo HTTP para Microsoft Teams, Slack, Discord ou n8n.</p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#0B1020] border border-[#1E293B] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                <span className="ml-2.5 text-xs font-mono font-semibold text-[#94A3B8]">
                  {config.enabled ? 'Ativado' : 'Desativado'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                  Nome da Integração
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6]"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                  Formato do Payload
                </label>
                <select
                  value={config.channelType}
                  onChange={(e) => setConfig({ ...config, channelType: e.target.value as any })}
                  className="w-full bg-[#151A2C] border border-[#1E293B] rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#3B82F6] cursor-pointer"
                >
                  <option value="slack">Slack / Microsoft Teams</option>
                  <option value="generic">Webhook Genérico / n8n / Zapier</option>
                  <option value="discord">Discord (Rich Embed)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-semibold text-[#64748B] tracking-wider mb-1.5">
                Webhook URL (Endpoint REST)
              </label>
              <div className="relative">
                <Globe className="h-4 w-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  placeholder="https://outlook.office.com/webhook/... ou https://hooks.slack.com/..."
                  value={config.webhookUrl}
                  onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#151A2C] border border-[#1E293B] text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
            </div>

            {/* Botão de Testar Webhook */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => handleTestChannel('webhook')}
                disabled={!config.webhookUrl || testingChannel !== null}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
              >
                {testingChannel === 'webhook' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>Testar Envio no Webhook</span>
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
             PAINEL 4: PRÉVIA DOS ALERTAS (VISUAL MOCKUP)
             ══════════════════════════════════════════════════════════════════ */}
        {activeSubTab === 'preview' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div>
              <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
                Prévia em Tempo Real dos Modelos de Alerta
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Veja exatamente como as notificações são formatadas ao serem entregues no celular e no e-mail.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mockup WhatsApp */}
              <div className="p-4 rounded-xl bg-[#070A14] border border-[#1E293B] space-y-3 font-mono">
                <div className="flex items-center justify-between text-xs text-[#94A3B8] border-b border-[#1E293B] pb-2 font-sans">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Smartphone className="h-4 w-4" />
                    <span>Template WhatsApp (CallMeBot)</span>
                  </div>
                  <span className="text-[10px] text-[#64748B]">Balão de Notificação</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#005c4b]/30 border border-[#005c4b]/50 text-[#F1F5F9] text-xs space-y-2 leading-relaxed">
                  <p className="font-bold text-emerald-300">
                    🚨 *[FIORIX Operações]* Conector Local Offline no Cartório
                  </p>
                  <p className="text-white/90">
                    O conector local está sem enviar batimentos há 5 minutos durante o horário de expediente.
                  </p>
                  <div className="text-[11px] text-white/70 space-y-0.5 pt-1 border-t border-white/10">
                    <p>• *Tempo sem sinal*: 5 min</p>
                    <p>• *Servidor*: Servidor do Cartório (Windows Service)</p>
                    <p>• *Ambiente*: Produção 7º RI</p>
                  </div>
                  <p className="text-[11px] text-cyan-300 underline pt-1 block">
                    *Painel*: https://fiorix.app/sistema/operacoes
                  </p>
                </div>
              </div>

              {/* Mockup E-mail Corporativo */}
              <div className="p-4 rounded-xl bg-[#070A14] border border-[#1E293B] space-y-3">
                <div className="flex items-center justify-between text-xs text-[#94A3B8] border-b border-[#1E293B] pb-2">
                  <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                    <Mail className="h-4 w-4" />
                    <span>Template E-mail HTML</span>
                  </div>
                  <span className="text-[10px] text-[#64748B]">Layout Executivo</span>
                </div>

                <div className="p-4 rounded-xl bg-[#111729] border border-[#1E293B] space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-[#1E293B] pb-2">
                    <span className="font-bold text-[#F1F5F9]">FIORIX Central de Operações</span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase font-mono">
                      CRÍTICO
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#F1F5F9]">Falha na Sincronização de Lote</h4>
                    <p className="text-[#94A3B8] text-[11px] mt-1">
                      Ocorreu uma falha no processamento de lote incremental do módulo <strong>Protocolos e Títulos</strong>.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#151A2C] border border-[#1E293B] text-[11px] font-mono text-[#64748B] space-y-1">
                    <p>Timestamp: 13/10/2026 15:45:01 (Horário de Brasília)</p>
                    <p>Tenant: 7º Registro de Imóveis de SP</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
             3. GATILHOS DE NOTIFICAÇÃO (6 GATILHOS CRÍTICOS)
             ══════════════════════════════════════════════════════════════════ */}
        <div className="pt-6 border-t border-[#1E293B] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#3B82F6]" />
                <span>Gatilhos de Notificação Operacionais</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Defina os eventos de infraestrutura e dados que disparam os alertas configurados.
              </p>
            </div>

            {/* Intervalo Anti-Spam (Cooldown) */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#64748B] font-sans">Intervalo Anti-Spam:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={config.cooldownMinutes}
                  onChange={(e) => setConfig({ ...config, cooldownMinutes: Number(e.target.value) || 15 })}
                  className="w-16 bg-[#151A2C] border border-[#1E293B] rounded-lg px-2 py-1 text-xs text-[#F1F5F9] text-center focus:outline-none focus:border-[#3B82F6]"
                />
                <span className="text-[#64748B]">min</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Gatilho 1: Conector Offline */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              config.notifyConnectorOffline
                ? 'bg-[#151A2C] border-blue-500/40 text-[#F1F5F9]'
                : 'bg-[#151A2C]/40 border-[#1E293B] text-[#64748B]'
            }`}>
              <input
                type="checkbox"
                checked={config.notifyConnectorOffline}
                onChange={(e) => setConfig({ ...config, notifyConnectorOffline: e.target.checked })}
                className="mt-1 rounded border-[#1E293B] text-[#3B82F6] focus:ring-0 cursor-pointer"
              />
              <div>
                <div className="text-xs font-semibold">Conector Local Offline</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Sem batimentos há mais de 5 minutos durante o expediente (Seg–Sáb 07h–19h).
                </div>
              </div>
            </label>

            {/* Gatilho 2: Falhas em Lotes */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              config.notifySyncFailed
                ? 'bg-[#151A2C] border-blue-500/40 text-[#F1F5F9]'
                : 'bg-[#151A2C]/40 border-[#1E293B] text-[#64748B]'
            }`}>
              <input
                type="checkbox"
                checked={config.notifySyncFailed}
                onChange={(e) => setConfig({ ...config, notifySyncFailed: e.target.checked })}
                className="mt-1 rounded border-[#1E293B] text-[#3B82F6] focus:ring-0 cursor-pointer"
              />
              <div>
                <div className="text-xs font-semibold">Falhas em Lotes Incremenais</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Erros de procedure SQL Server WEBRI ou falhas de parse de chunks.
                </div>
              </div>
            </label>

            {/* Gatilho 3: Atraso Crítico */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              config.notifyModuleDelayed
                ? 'bg-[#151A2C] border-blue-500/40 text-[#F1F5F9]'
                : 'bg-[#151A2C]/40 border-[#1E293B] text-[#64748B]'
            }`}>
              <input
                type="checkbox"
                checked={config.notifyModuleDelayed}
                onChange={(e) => setConfig({ ...config, notifyModuleDelayed: e.target.checked })}
                className="mt-1 rounded border-[#1E293B] text-[#3B82F6] focus:ring-0 cursor-pointer"
              />
              <div>
                <div className="text-xs font-semibold">Atraso Crítico de Rotina</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Módulo de cartório com atraso superior a 3 vezes a janela tolerável.
                </div>
              </div>
            </label>

            {/* Gatilho 4: Instabilidade do PostgreSQL / Supabase */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              config.notifyDatabaseDegraded
                ? 'bg-[#151A2C] border-blue-500/40 text-[#F1F5F9]'
                : 'bg-[#151A2C]/40 border-[#1E293B] text-[#64748B]'
            }`}>
              <input
                type="checkbox"
                checked={config.notifyDatabaseDegraded}
                onChange={(e) => setConfig({ ...config, notifyDatabaseDegraded: e.target.checked })}
                className="mt-1 rounded border-[#1E293B] text-[#3B82F6] focus:ring-0 cursor-pointer"
              />
              <div>
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Instabilidade PostgreSQL</span>
                </div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Queda de conexão do banco principal ou latência elevada (&gt; 4.000 ms).
                </div>
              </div>
            </label>

            {/* Gatilho 5: Silêncio de Dados / Volume Zero Anômalo */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              config.notifyZeroRecordsAnomalous
                ? 'bg-[#151A2C] border-blue-500/40 text-[#F1F5F9]'
                : 'bg-[#151A2C]/40 border-[#1E293B] text-[#64748B]'
            }`}>
              <input
                type="checkbox"
                checked={config.notifyZeroRecordsAnomalous}
                onChange={(e) => setConfig({ ...config, notifyZeroRecordsAnomalous: e.target.checked })}
                className="mt-1 rounded border-[#1E293B] text-[#3B82F6] focus:ring-0 cursor-pointer"
              />
              <div>
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Silêncio de Dados (Volume Zero)</span>
                </div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Alerta se 2 ciclos consecutivos trouxerem 0 registros no horário nobre (10h às 17h).
                </div>
              </div>
            </label>

            {/* Gatilho 6: Falhas de Integrações Externas (NextQS & Google) */}
            <label className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
              config.notifyNextQsFailure || config.notifyGoogleTokenExpiring
                ? 'bg-[#151A2C] border-blue-500/40 text-[#F1F5F9]'
                : 'bg-[#151A2C]/40 border-[#1E293B] text-[#64748B]'
            }`}>
              <input
                type="checkbox"
                checked={config.notifyNextQsFailure && config.notifyGoogleTokenExpiring}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    notifyNextQsFailure: e.target.checked,
                    notifyGoogleTokenExpiring: e.target.checked,
                  })
                }
                className="mt-1 rounded border-[#1E293B] text-[#3B82F6] focus:ring-0 cursor-pointer"
              />
              <div>
                <div className="text-xs font-semibold">NextQS & Google Avaliações</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Sincronização de senhas interrompida ou token Google revogado / expirando.
                </div>
              </div>
            </label>
          </div>

          {/* Regra Adicional: Horário de Repouso Noturno (Quiet Hours) */}
          <div className="p-3.5 rounded-xl bg-[#151A2C] border border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Moon className="h-4 w-4 text-[#818CF8]" />
              <div>
                <h4 className="text-xs font-semibold text-[#F1F5F9]">Modo Não Perturbe / Repouso Noturno</h4>
                <p className="text-[11px] text-[#64748B]">Silencia alertas não-críticos de rotinas fora do horário comercial do cartório.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.quietHoursEnabled}
                  onChange={(e) => setConfig({ ...config, quietHoursEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[#0B1020] border border-[#1E293B] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>

              {config.quietHoursEnabled && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#94A3B8]">
                  <input
                    type="time"
                    value={config.quietHoursStart || '22:00'}
                    onChange={(e) => setConfig({ ...config, quietHoursStart: e.target.value })}
                    className="bg-[#0B1020] border border-[#1E293B] rounded-lg px-2 py-1 text-xs text-[#F1F5F9]"
                  />
                  <span>até</span>
                  <input
                    type="time"
                    value={config.quietHoursEnd || '07:00'}
                    onChange={(e) => setConfig({ ...config, quietHoursEnd: e.target.value })}
                    className="bg-[#0B1020] border border-[#1E293B] rounded-lg px-2 py-1 text-xs text-[#F1F5F9]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botão de Salvar no Rodapé */}
        <div className="flex justify-end pt-4 border-t border-[#1E293B]">
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Salvar Todas as Configurações de Alerta</span>
          </button>
        </div>
      </section>

      {/* 4. HISTÓRICO DE ALERTAS DISPARADOS RECENTEMENTE */}
      <section className="rounded-2xl border border-[#1E293B] bg-[#111729] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1E293B]">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#3B82F6]" />
            <h3 className="text-xs font-bold text-[#F1F5F9] uppercase tracking-wider">
              Histórico de Alertas Disparados Recentemente
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Filtro por Canal */}
            <select
              value={logChannelFilter}
              onChange={(e) => setLogChannelFilter(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl bg-[#151A2C] border border-[#1E293B] text-xs text-[#94A3B8] focus:outline-none cursor-pointer"
            >
              <option value="all">Todos os Canais</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-mail</option>
              <option value="webhook">Webhook</option>
            </select>

            {/* Filtro por Status */}
            <select
              value={logStatusFilter}
              onChange={(e) => setLogStatusFilter(e.target.value as any)}
              className="px-2.5 py-1 rounded-xl bg-[#151A2C] border border-[#1E293B] text-xs text-[#94A3B8] focus:outline-none cursor-pointer"
            >
              <option value="all">Todos os Resultados</option>
              <option value="success">Apenas Sucesso</option>
              <option value="error">Apenas Falhas</option>
            </select>

            <button
              type="button"
              onClick={fetchSettings}
              disabled={loading}
              className="p-1.5 rounded-xl bg-[#151A2C] hover:bg-[#1E293B] text-[#94A3B8] hover:text-[#F1F5F9] border border-[#1E293B] transition-colors cursor-pointer"
              title="Atualizar Logs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#64748B] font-sans">
            Nenhum alerta disparado com os filtros selecionados. Realize um teste acima para validar os canais!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E293B] text-[11px] uppercase tracking-wider text-[#64748B] font-semibold font-sans bg-[#151A2C]/30">
                  <th className="py-3 px-4">Data/Hora (SP)</th>
                  <th className="py-3 px-4">Canal</th>
                  <th className="py-3 px-4">Evento</th>
                  <th className="py-3 px-4">Título do Alerta</th>
                  <th className="py-3 px-4">Severidade</th>
                  <th className="py-3 px-4 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60 text-[#94A3B8]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#151A2C] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-[#F1F5F9]">
                      {new Date(log.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZone: 'America/Sao_Paulo',
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-sans">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                        log.channelType === 'whatsapp'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : log.channelType === 'email'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {log.channelType === 'whatsapp' && <Smartphone className="h-3 w-3" />}
                        {log.channelType === 'email' && <Mail className="h-3 w-3" />}
                        {log.channelType !== 'whatsapp' && log.channelType !== 'email' && <Globe className="h-3 w-3" />}
                        {log.channelType.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-[#94A3B8]">
                      {log.eventType}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-[#F1F5F9] font-medium" title={log.title}>
                      {log.title}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        log.severity === 'CRITICAL'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : log.severity === 'WARNING'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      }`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      {log.success ? (
                        <span className="inline-flex items-center gap-1 text-[#10B981] font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {log.statusCode || 200} OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-semibold" title={log.errorMessage || 'Falha'}>
                          <XCircle className="h-3.5 w-3.5" />
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
      </section>
    </div>
  );
}

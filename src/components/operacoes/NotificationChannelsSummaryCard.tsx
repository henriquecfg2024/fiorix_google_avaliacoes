'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Mail,
  Globe,
  CheckCircle2,
  XCircle,
  Bell,
  ShieldCheck,
  Loader2,
  Trash2,
} from 'lucide-react';

interface PhoneEntry {
  phone: string;
  label?: string;
}

interface ChannelSummary {
  whatsappEnabled: boolean;
  whatsappPhone: string;
  whatsappProvider: string;
  whatsappPhones: PhoneEntry[]; // all phones (primary + additional)
  emailEnabled: boolean;
  emailRecipients: string;
  webhookEnabled: boolean;
  webhookUrl: string;
  cooldownMinutes: number;
  notifyConnectorOffline: boolean;
  notifySyncFailed: boolean;
  notifyModuleDelayed: boolean;
  notifyNextQsFailure: boolean;
  notifyGoogleTokenExpiring: boolean;
}

export function NotificationChannelsSummaryCard() {
  const [data, setData] = useState<ChannelSummary | null>(null);
  const [rawConfig, setRawConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/operacoes/alerts', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.config) {
          setRawConfig(json.config);
          const primaryPhone = json.config.whatsappPhone || '';
          const additionalPhones: PhoneEntry[] = Array.isArray(json.config.whatsappConfig?.phones)
            ? json.config.whatsappConfig.phones
                .filter((p: any) => p.phone && p.phone.length >= 8)
                .map((p: any) => ({ phone: p.phone, label: p.label || '' }))
            : [];
          const allPhones: PhoneEntry[] = [];
          if (primaryPhone && primaryPhone.length >= 8) {
            allPhones.push({ phone: primaryPhone, label: 'Principal' });
          }
          allPhones.push(...additionalPhones);

          setData({
            whatsappEnabled: Boolean(json.config.whatsappEnabled),
            whatsappPhone: primaryPhone,
            whatsappProvider: json.config.whatsappProvider || 'callmebot',
            whatsappPhones: allPhones,
            emailEnabled: Boolean(json.config.emailEnabled),
            emailRecipients: json.config.emailRecipients || '',
            webhookEnabled: Boolean(json.config.enabled) && Boolean(json.config.webhookUrl),
            webhookUrl: json.config.webhookUrl || '',
            cooldownMinutes: Number(json.config.cooldownMinutes || 15),
            notifyConnectorOffline: Boolean(json.config.notifyConnectorOffline),
            notifySyncFailed: Boolean(json.config.notifySyncFailed),
            notifyModuleDelayed: Boolean(json.config.notifyModuleDelayed),
            notifyNextQsFailure: Boolean(json.config.notifyNextQsFailure),
            notifyGoogleTokenExpiring: Boolean(json.config.notifyGoogleTokenExpiring),
          });
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();

    const handleUpdate = () => {
      loadConfig();
    };
    window.addEventListener('alerts-config-updated', handleUpdate);
    return () => window.removeEventListener('alerts-config-updated', handleUpdate);
  }, [loadConfig]);

  const handleDeletePhone = async (phoneToDelete: string) => {
    if (!rawConfig) return;
    if (!window.confirm(`Deseja realmente excluir o telefone ${phoneToDelete} das notificações de alerta?`)) {
      return;
    }

    setDeletingKey(`phone-${phoneToDelete}`);
    try {
      const isPrimary = rawConfig.whatsappPhone === phoneToDelete;
      const additionalPhones: any[] = Array.isArray(rawConfig.whatsappConfig?.phones)
        ? [...rawConfig.whatsappConfig.phones]
        : [];

      let newPrimaryPhone = rawConfig.whatsappPhone;
      let newApikey = rawConfig.whatsappConfig?.apikey;
      let newAdditionalPhones = additionalPhones;

      if (isPrimary) {
        if (additionalPhones.length > 0) {
          const promoted = additionalPhones.shift();
          newPrimaryPhone = promoted.phone;
          newApikey = promoted.apikey || newApikey;
          newAdditionalPhones = additionalPhones;
        } else {
          newPrimaryPhone = '';
        }
      } else {
        newAdditionalPhones = additionalPhones.filter((p: any) => p.phone !== phoneToDelete);
      }

      const payload = {
        ...rawConfig,
        whatsappPhone: newPrimaryPhone,
        whatsappEnabled: Boolean(newPrimaryPhone),
        whatsappConfig: {
          ...rawConfig.whatsappConfig,
          apikey: newApikey,
          phones: newAdditionalPhones,
        },
      };

      const res = await fetch('/api/v1/operacoes/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await loadConfig();
        window.dispatchEvent(new CustomEvent('alerts-config-updated'));
      } else {
        alert('Erro ao excluir telefone. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao excluir telefone:', err);
      alert('Erro de conexão ao excluir telefone.');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteEmail = async (emailToDelete: string) => {
    if (!rawConfig) return;
    if (!window.confirm(`Deseja realmente excluir o e-mail ${emailToDelete} das notificações de alerta?`)) {
      return;
    }

    setDeletingKey(`email-${emailToDelete}`);
    try {
      const currentEmails = (rawConfig.emailRecipients || '')
        .split(',')
        .map((e: string) => e.trim())
        .filter((e: string) => e.length > 0);

      const remainingEmails = currentEmails.filter(
        (e: string) => e.toLowerCase() !== emailToDelete.toLowerCase()
      );

      const payload = {
        ...rawConfig,
        emailRecipients: remainingEmails.join(', '),
        emailEnabled: remainingEmails.length > 0 ? Boolean(rawConfig.emailEnabled) : false,
      };

      const res = await fetch('/api/v1/operacoes/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await loadConfig();
        window.dispatchEvent(new CustomEvent('alerts-config-updated'));
      } else {
        alert('Erro ao excluir e-mail. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao excluir e-mail:', err);
      alert('Erro de conexão ao excluir e-mail.');
    } finally {
      setDeletingKey(null);
    }
  };

  const maskPhone = (phone: string) => {
    if (!phone) return '—';
    if (phone.length > 9) {
      return phone.slice(0, 5) + '•••' + phone.slice(-4);
    }
    return phone;
  };

  const maskSingleEmail = (email: string) => {
    const trimmed = email.trim();
    const atIdx = trimmed.indexOf('@');
    if (atIdx > 2) {
      return trimmed.slice(0, 2) + '•••' + trimmed.slice(atIdx);
    }
    return trimmed;
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] dark:bg-white/[0.015] p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/10">
            <Bell className="h-4.5 w-4.5 text-violet-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white/90">Canais de Notificação</h3>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 text-white/30 animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] dark:bg-white/[0.015] p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/10">
            <Bell className="h-4.5 w-4.5 text-violet-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-white/90">Canais de Notificação</h3>
        </div>
        <p className="text-xs text-white/40">Nenhuma configuração de alerta encontrada. Configure na aba &quot;Configuração de Alertas&quot;.</p>
      </div>
    );
  }

  const activeChannels = [
    data.whatsappEnabled,
    data.emailEnabled,
    data.webhookEnabled,
  ].filter(Boolean).length;

  const activeTriggers = [
    data.notifyConnectorOffline,
    data.notifySyncFailed,
    data.notifyModuleDelayed,
    data.notifyNextQsFailure,
    data.notifyGoogleTokenExpiring,
  ].filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] dark:bg-white/[0.015] p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-500/10">
            <Bell className="h-4.5 w-4.5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white/90">Canais de Notificação Ativos</h3>
            <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">
              {activeChannels} {activeChannels === 1 ? 'canal ativo' : 'canais ativos'} · {activeTriggers} {activeTriggers === 1 ? 'gatilho' : 'gatilhos'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            {activeChannels > 0 ? 'Protegido' : 'Sem Canais'}
          </span>
        </div>
      </div>

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* WhatsApp */}
        <div className={`rounded-xl border p-4 transition-all ${
          data.whatsappEnabled
            ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
            : 'border-white/[0.04] bg-white/[0.01] opacity-50'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                data.whatsappEnabled ? 'bg-emerald-500/15' : 'bg-white/[0.04]'
              }`}>
                <Smartphone className={`h-3.5 w-3.5 ${data.whatsappEnabled ? 'text-emerald-400' : 'text-white/30'}`} />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-white/80">WhatsApp</span>
            </div>
            {data.whatsappEnabled ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Ativo</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <XCircle className="h-3 w-3 text-white/25" />
                <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Inativo</span>
              </span>
            )}
          </div>
          {data.whatsappEnabled ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">
                  {data.whatsappPhones.length === 1 ? '1 Telefone' : `${data.whatsappPhones.length} Telefones`}
                </span>
              </div>
              {data.whatsappPhones.length === 0 ? (
                <p className="text-[10px] text-white/30 italic">Nenhum telefone ativo</p>
              ) : (
                data.whatsappPhones.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 group/phone">
                    <p className="text-xs font-mono text-emerald-300/90 bg-emerald-500/[0.08] px-2 py-1 rounded-md flex-1">
                      {maskPhone(entry.phone)}
                    </p>
                    {entry.label && (
                      <span className="text-[10px] text-white/30 shrink-0">{entry.label}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeletePhone(entry.phone)}
                      disabled={deletingKey !== null}
                      className="p-1 rounded-md text-white/30 hover:text-rose-400 hover:bg-rose-500/15 transition-all shrink-0"
                      title={`Excluir telefone ${entry.phone}`}
                    >
                      {deletingKey === `phone-${entry.phone}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))
              )}
              <p className="text-[10px] text-white/30 mt-1">
                via {data.whatsappProvider === 'callmebot' ? 'CallMeBot' : data.whatsappProvider}
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-white/30">Não configurado</p>
          )}
        </div>

        {/* E-mail */}
        <div className={`rounded-xl border p-4 transition-all ${
          data.emailEnabled
            ? 'border-blue-500/20 bg-blue-500/[0.04]'
            : 'border-white/[0.04] bg-white/[0.01] opacity-50'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                data.emailEnabled ? 'bg-blue-500/15' : 'bg-white/[0.04]'
              }`}>
                <Mail className={`h-3.5 w-3.5 ${data.emailEnabled ? 'text-blue-400' : 'text-white/30'}`} />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-white/80">E-mail</span>
            </div>
            {data.emailEnabled ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25">
                <CheckCircle2 className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Ativo</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <XCircle className="h-3 w-3 text-white/25" />
                <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Inativo</span>
              </span>
            )}
          </div>
          {(() => {
            const emailList = (data.emailRecipients || '')
              .split(',')
              .map((e: string) => e.trim())
              .filter((e: string) => e.length > 0);

            if (!data.emailEnabled) {
              return <p className="text-[10px] text-white/30">Não configurado</p>;
            }

            if (emailList.length === 0) {
              return <p className="text-[10px] text-white/30 italic">Nenhum e-mail ativo</p>;
            }

            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">
                    {emailList.length === 1 ? '1 Destinatário' : `${emailList.length} Destinatários`}
                  </span>
                </div>
                {emailList.map((email: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5 group/email">
                    <p className="text-xs font-mono text-blue-300/90 bg-blue-500/[0.08] px-2 py-1 rounded-md flex-1 truncate" title={email}>
                      {maskSingleEmail(email)}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDeleteEmail(email)}
                      disabled={deletingKey !== null}
                      className="p-1 rounded-md text-white/30 hover:text-rose-400 hover:bg-rose-500/15 transition-all shrink-0"
                      title={`Excluir e-mail ${email}`}
                    >
                      {deletingKey === `email-${email}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Webhook */}
        <div className={`rounded-xl border p-4 transition-all ${
          data.webhookEnabled
            ? 'border-amber-500/20 bg-amber-500/[0.04]'
            : 'border-white/[0.04] bg-white/[0.01] opacity-50'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${
                data.webhookEnabled ? 'bg-amber-500/15' : 'bg-white/[0.04]'
              }`}>
                <Globe className={`h-3.5 w-3.5 ${data.webhookEnabled ? 'text-amber-400' : 'text-white/30'}`} />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-white/80">Webhook</span>
            </div>
            {data.webhookEnabled ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25">
                <CheckCircle2 className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Ativo</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <XCircle className="h-3 w-3 text-white/25" />
                <span className="text-[10px] font-bold text-white/25 uppercase tracking-wider">Inativo</span>
              </span>
            )}
          </div>
          {data.webhookEnabled ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Endpoint</span>
              </div>
              <p className="text-xs font-mono text-amber-300/90 bg-amber-500/[0.08] px-2 py-1 rounded-md truncate" title={data.webhookUrl}>
                {data.webhookUrl.replace(/^https?:\/\//, '').slice(0, 30)}...
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-white/30">Não configurado</p>
          )}
        </div>
      </div>

      {/* Footer: Triggers summary */}
      <div className="mt-4 pt-3 border-t border-white/[0.04] flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {data.notifyConnectorOffline && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/15 text-[10px] text-red-400 font-medium">
              Connector Offline
            </span>
          )}
          {data.notifySyncFailed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/15 text-[10px] text-orange-400 font-medium">
              Falhas em Lotes
            </span>
          )}
          {data.notifyModuleDelayed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/15 text-[10px] text-amber-400 font-medium">
              Atraso Crítico
            </span>
          )}
          {data.notifyNextQsFailure && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/15 text-[10px] text-purple-400 font-medium">
              Falha NextJS
            </span>
          )}
          {data.notifyGoogleTokenExpiring && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/15 text-[10px] text-cyan-400 font-medium">
              Token Google
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/30 shrink-0 ml-2">
          Cooldown: {data.cooldownMinutes}min
        </span>
      </div>
    </div>
  );
}

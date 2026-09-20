'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Volume2,
  Lock,
  MessageSquare,
  Users,
  Smartphone,
  Check,
  Loader2,
  Send,
  AlertCircle,
} from 'lucide-react';
import {
  getNotificationSettings,
  updateNotificationSettings,
} from '@/app/actions/mensagens';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getExistingPushSubscription,
} from '@/lib/pwa/push-client';
import { toast } from 'sonner';

export function NotificacoesConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [isPushActiveOnDevice, setIsPushActiveOnDevice] = useState(false);

  const [settings, setSettings] = useState({
    directMessages: true,
    groupMessages: true,
    sound: true,
    previewContent: false,
    browserNotifications: true,
  });

  useEffect(() => {
    // Carrega preferências do servidor
    getNotificationSettings()
      .then((res) => {
        if (res.success && res.settings) {
          setSettings({
            directMessages: res.settings.directMessages,
            groupMessages: res.settings.groupMessages,
            sound: res.settings.sound,
            previewContent: res.settings.previewContent,
            browserNotifications: res.settings.browserNotifications,
          });
        }
      })
      .finally(() => setLoading(false));

    // Verifica se este dispositivo já tem subscription ativa
    getExistingPushSubscription().then((sub) => {
      setIsPushActiveOnDevice(!!sub);
    });
  }, []);

  const handleToggle = async (key: keyof typeof settings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    setSaving(true);
    try {
      await updateNotificationSettings(updated);
      toast.success('Preferência de notificação salva.');
    } catch {
      toast.error('Erro ao salvar preferência.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDevicePush = async () => {
    setSaving(true);
    try {
      if (isPushActiveOnDevice) {
        const res = await unsubscribeFromPushNotifications();
        if (res.success) {
          setIsPushActiveOnDevice(false);
          toast.success('Web Push desativado neste dispositivo.');
        } else {
          toast.error(res.error || 'Erro ao desativar notificações.');
        }
      } else {
        const res = await subscribeToPushNotifications();
        if (res.success) {
          setIsPushActiveOnDevice(true);
          toast.success('Web Push ativado com sucesso neste dispositivo!');
        } else {
          toast.error(res.error || 'Não foi possível ativar as notificações.');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Notificação de teste enviada para ${data.sent} dispositivo(s).`);
      } else {
        toast.error(data.error || 'Falha ao enviar notificação de teste.');
      }
    } catch {
      toast.error('Erro de conexão ao enviar notificação de teste.');
    } finally {
      setTestingPush(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 flex justify-center text-slate-400 text-xs">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Ativação do Web Push no Navegador */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/20 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">
              Notificações Web Push & PWA no Dispositivo
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {isPushActiveOnDevice
                ? 'Este dispositivo está autorizado e pronto para receber notificações de mensagens em segundo plano.'
                : 'Ative para receber alertas de mensagens corporativas mesmo com o FIORIX em segundo plano ou fechado.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isPushActiveOnDevice && (
            <button
              onClick={handleTestPush}
              disabled={testingPush}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition inline-flex items-center gap-1.5"
            >
              {testingPush ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Testar</span>
            </button>
          )}

          <button
            onClick={handleToggleDevicePush}
            disabled={saving}
            className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-sm transition inline-flex items-center gap-1.5 ${
              isPushActiveOnDevice
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {isPushActiveOnDevice ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Ativado (Clique para Desativar)</span>
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5" />
                <span>Ativar Notificações</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Grid de Opções de Privacidade */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Mensagens Diretas */}
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <div>
              <p className="text-xs font-semibold text-white">Mensagens Diretas (1-para-1)</p>
              <p className="text-[11px] text-slate-400">Alertas de colegas da sua organização</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.directMessages}
            onChange={() => handleToggle('directMessages')}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer"
          />
        </div>

        {/* Grupos */}
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-amber-400" />
            <div>
              <p className="text-xs font-semibold text-white">Mensagens em Grupos</p>
              <p className="text-[11px] text-slate-400">Notificações de conversas coletivas</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.groupMessages}
            onChange={() => handleToggle('groupMessages')}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer"
          />
        </div>

        {/* Efeitos Sonoros */}
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <div>
              <p className="text-xs font-semibold text-white">Som de Notificação</p>
              <p className="text-[11px] text-slate-400">Emitir alerta sonoro ao receber mensagem</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={() => handleToggle('sound')}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer"
          />
        </div>

        {/* Notificações no Navegador */}
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-purple-400" />
            <div>
              <p className="text-xs font-semibold text-white">Notificações no Navegador</p>
              <p className="text-[11px] text-slate-400">Toasts e Web Push corporativo</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.browserNotifications}
            onChange={() => handleToggle('browserNotifications')}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer"
          />
        </div>
      </div>

      {/* Seção Especial: Prévia da Mensagem (LGPD / Privacidade de Tela de Bloqueio) */}
      <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/50 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold text-white">
                Prévia do Conteúdo da Mensagem nas Notificações
              </h4>
              <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                PRIVACIDADE & LGPD
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Quando desativado (recomendado), as notificações na tela de bloqueio do celular ou monitor exibirão apenas:
              <br />
              <span className="font-mono text-slate-300 bg-black/30 px-1.5 py-0.5 rounded text-[11px] inline-block mt-1">
                &ldquo;FIORIX: Você recebeu uma nova mensagem.&rdquo;
              </span>
              <br />
              O nome do remetente e o teor da mensagem só serão exibidos após desbloqueio e acesso ao sistema.
            </p>
          </div>
        </div>

        <input
          type="checkbox"
          checked={settings.previewContent}
          onChange={() => handleToggle('previewContent')}
          className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-white/20 cursor-pointer shrink-0 mt-1"
        />
      </div>
    </div>
  );
}

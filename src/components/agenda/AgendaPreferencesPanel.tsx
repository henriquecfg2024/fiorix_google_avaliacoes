'use client';

import { useState } from 'react';
import { Bell, Mail, Play, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  REMINDER_OFFSET_PRESETS,
  type AgendaCalendarView,
  type AgendaEmailOutboxDTO,
  type AgendaReminderChannel,
  type AgendaUserPreferenceDTO,
} from '@/lib/agenda/types';

interface AgendaPreferencesPanelProps {
  preferences: AgendaUserPreferenceDTO;
  emailOutbox: AgendaEmailOutboxDTO[];
  isReadOnly: boolean;
  isDark?: boolean;
  onUpdated: (next: AgendaUserPreferenceDTO) => void;
  onRunWorkerSandbox?: () => Promise<void>;
}

export function AgendaPreferencesPanel({
  preferences,
  emailOutbox,
  isReadOnly,
  isDark = false,
  onUpdated,
  onRunWorkerSandbox,
}: AgendaPreferencesPanelProps) {
  const [form, setForm] = useState<AgendaUserPreferenceDTO>(preferences);
  const [saving, setSaving] = useState(false);
  const [runningWorker, setRunningWorker] = useState(false);

  async function handleSave() {
    if (saving || isReadOnly) return;
    setSaving(true);
    try {
      const res = await fetch('/api/agenda/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultView: form.defaultView,
          weekStartsOn: form.weekStartsOn,
          defaultChannel: form.defaultChannel,
          defaultOffsetMinutes: form.defaultOffsetMinutes,
          quietHoursStart: form.quietHoursStart || null,
          quietHoursEnd: form.quietHoursEnd || null,
          showCompleted: form.showCompleted,
          webPushEnabled: form.webPushEnabled,
          calendarCompactFormat: form.calendarCompactFormat,
          themeMode: form.themeMode,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || 'Falha ao salvar preferências.');
        return;
      }
      onUpdated(body.preferences);
      toast.success('Preferências da Agenda Inteligente atualizadas.');
    } catch {
      toast.error('Erro de rede ao salvar preferências.');
    } finally {
      setSaving(false);
    }
  }

  const cardSurface = isDark
    ? 'bg-[#0D1322] border-white/10 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900 shadow-xs';
  const inputSurface = isDark
    ? 'border-white/15 bg-[#070A12] text-white'
    : 'border-slate-300 bg-white text-slate-900';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className={`rounded-3xl border p-5 space-y-4 ${cardSurface}`}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Preferências Individuais & Lembretes</h2>
            <p className="text-xs text-slate-500">
              A saudação inteligente após cada login permanece obrigatória para todos os perfis.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-bold mb-1">Visualização padrão</label>
            <select
              value={form.defaultView}
              disabled={isReadOnly}
              onChange={(e) =>
                setForm({ ...form, defaultView: e.target.value as AgendaCalendarView })
              }
              className={`w-full rounded-xl border px-3 py-2 ${inputSurface}`}
            >
              <option value="DIARIO">Diário</option>
              <option value="SEMANAL">Semanal</option>
              <option value="MENSAL">Mensal</option>
              <option value="SEMESTRAL">Semestral</option>
              <option value="ANUAL">Anual</option>
              <option value="LISTA">Lista</option>
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1">Primeiro dia da semana</label>
            <select
              value={form.weekStartsOn}
              disabled={isReadOnly}
              onChange={(e) =>
                setForm({ ...form, weekStartsOn: Number(e.target.value) as 0 | 1 })
              }
              className={`w-full rounded-xl border px-3 py-2 ${inputSurface}`}
            >
              <option value={0}>Domingo</option>
              <option value={1}>Segunda-feira</option>
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1">Canal padrão de lembretes</label>
            <select
              value={form.defaultChannel}
              disabled={isReadOnly}
              onChange={(e) =>
                setForm({ ...form, defaultChannel: e.target.value as AgendaReminderChannel })
              }
              className={`w-full rounded-xl border px-3 py-2 ${inputSurface}`}
            >
              <option value="EMAIL">E-mail</option>
              <option value="POPUP">Pop-up interno FIORIX</option>
              <option value="PUSH">Web Push (quando autorizado)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1">Antecedência padrão</label>
            <select
              value={form.defaultOffsetMinutes}
              disabled={isReadOnly}
              onChange={(e) =>
                setForm({ ...form, defaultOffsetMinutes: Number(e.target.value) })
              }
              className={`w-full rounded-xl border px-3 py-2 ${inputSurface}`}
            >
              {REMINDER_OFFSET_PRESETS.map((p) => (
                <option key={p.minutes} value={p.minutes}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold mb-1">Horário silencioso (início)</label>
            <input
              type="time"
              value={form.quietHoursStart || ''}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, quietHoursStart: e.target.value || null })}
              className={`w-full rounded-xl border px-3 py-2 ${inputSurface}`}
            />
          </div>

          <div>
            <label className="block font-bold mb-1">Horário silencioso (fim)</label>
            <input
              type="time"
              value={form.quietHoursEnd || ''}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, quietHoursEnd: e.target.value || null })}
              className={`w-full rounded-xl border px-3 py-2 ${inputSurface}`}
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={form.showCompleted}
                disabled={isReadOnly}
                onChange={(e) => setForm({ ...form, showCompleted: e.target.checked })}
                className="h-4 w-4 accent-[#43239D]"
              />
              Exibir compromissos concluídos
            </label>
            <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={form.webPushEnabled}
                disabled={isReadOnly}
                onChange={(e) => setForm({ ...form, webPushEnabled: e.target.checked })}
                className="h-4 w-4 accent-[#43239D]"
              />
              Habilitar Web Push complementar
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
          {onRunWorkerSandbox && (
            <button
              type="button"
              disabled={runningWorker}
              onClick={async () => {
                setRunningWorker(true);
                try {
                  await onRunWorkerSandbox();
                } finally {
                  setRunningWorker(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100"
            >
              <Play className="h-3.5 w-3.5" />
              {runningWorker ? 'Processando...' : 'Processar fila de lembretes (Sandbox)'}
            </button>
          )}
          {!isReadOnly && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#43239D] px-4 py-2 text-xs font-bold text-white hover:bg-[#5B21B6]"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Salvando...' : 'Salvar preferências'}
            </button>
          )}
        </div>
      </div>

      {/* Caixa de Saída Simulada de E-mails (Sandbox local sem envio real) */}
      <div className={`rounded-3xl border p-5 space-y-3 ${cardSurface}`}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Lembretes por E-mail (Auditoria & Sandbox)</h2>
            <p className="text-xs text-slate-500">
              Em homologação local, os envios são simulados em sandbox sem disparar e-mails reais.
            </p>
          </div>
        </div>

        {emailOutbox.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
            Nenhum e-mail processado ainda. Crie um compromisso com lembrete imediato e clique em &ldquo;Processar fila de lembretes (Sandbox)&rdquo;.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {emailOutbox.map((mail) => (
              <div
                key={mail.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1 text-slate-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="truncate">{mail.subject}</strong>
                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                    {mail.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">Para: {mail.recipientEmail}</div>
                <div className="text-[11px] text-slate-600 line-clamp-2">{mail.bodyText}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

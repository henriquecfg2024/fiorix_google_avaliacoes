'use client';

import { useState } from 'react';
import { Bell, Mail, Play, Plus, Save, Send, Tag } from 'lucide-react';
import { toast } from 'sonner';
import {
  REMINDER_OFFSET_PRESETS,
  type AgendaCalendarView,
  type AgendaCategoryDTO,
  type AgendaEmailOutboxDTO,
  type AgendaReminderChannel,
  type AgendaUserPreferenceDTO,
} from '@/lib/agenda/types';
import { AgendaCategoryIcon } from './agenda-icons';

interface AgendaPreferencesPanelProps {
  preferences: AgendaUserPreferenceDTO;
  emailOutbox: AgendaEmailOutboxDTO[];
  categories?: AgendaCategoryDTO[];
  canManageCategories?: boolean;
  isReadOnly: boolean;
  isDark?: boolean;
  onUpdated: (next: AgendaUserPreferenceDTO) => void;
  onCategoryCreated?: () => void;
  onRunWorkerSandbox?: () => Promise<void>;
}

const PRESET_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#DC2626',
  '#EA580C',
  '#16A34A',
  '#047857',
  '#DB2777',
  '#475569',
];

const PRESET_ICONS = [
  { key: 'Briefcase', label: 'Administrativo' },
  { key: 'Users', label: 'Reuniões' },
  { key: 'Cpu', label: 'Tecnologia' },
  { key: 'Scale', label: 'Jurídico' },
  { key: 'ShieldAlert', label: 'Segurança' },
  { key: 'Wallet', label: 'Financeiro' },
  { key: 'Tag', label: 'Etiqueta' },
];

export function AgendaPreferencesPanel({
  preferences,
  emailOutbox,
  categories = [],
  canManageCategories = false,
  isReadOnly,
  isDark = false,
  onUpdated,
  onCategoryCreated,
  onRunWorkerSandbox,
}: AgendaPreferencesPanelProps) {
  const [form, setForm] = useState<AgendaUserPreferenceDTO>(preferences);
  const [saving, setSaving] = useState(false);
  const [runningWorker, setRunningWorker] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);

  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#2563EB');
  const [catIcon, setCatIcon] = useState('Tag');
  const [catScope, setCatScope] = useState<'PESSOAL' | 'INSTITUCIONAL'>('PESSOAL');
  const [creatingCat, setCreatingCat] = useState(false);

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

  async function handleCreateCategory() {
    if (creatingCat || isReadOnly) return;
    const clean = catName.trim();
    if (clean.length < 2) {
      toast.error('Informe um nome com ao menos 2 caracteres.');
      return;
    }
    setCreatingCat(true);
    try {
      const res = await fetch('/api/agenda/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clean,
          color: catColor,
          icon: catIcon,
          scope: canManageCategories ? catScope : 'PESSOAL',
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || 'Não foi possível criar a categoria.');
        return;
      }
      toast.success(`Categoria "${clean}" adicionada.`);
      setCatName('');
      onCategoryCreated?.();
      window.dispatchEvent(new Event('fiorix:agenda-updated'));
    } catch {
      toast.error('Erro de rede ao criar categoria.');
    } finally {
      setCreatingCat(false);
    }
  }

  async function handleTestEmail() {
    if (testingEmail || isReadOnly) return;
    setTestingEmail(true);
    try {
      const res = await fetch('/api/agenda/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TEST_EMAIL' }),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        toast.error(
          body?.errorMessage || body?.error || 'Não foi possível enviar o e-mail de teste.'
        );
        return;
      }
      toast.success(`E-mail de teste enviado para ${body.recipientEmail}.`);
    } catch {
      toast.error('Erro de comunicação ao testar envio de e-mail.');
    } finally {
      setTestingEmail(false);
    }
  }

  const cardSurface = isDark
    ? 'bg-[#0D1322] border-white/10 text-slate-100 [color-scheme:dark]'
    : 'bg-white border-slate-200 text-slate-900 shadow-xs [color-scheme:light]';
  const inputSurface = isDark
    ? 'border-white/15 bg-[#070A12] text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none [color-scheme:dark]'
    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-[#43239D] focus:ring-2 focus:ring-violet-500/20 focus:outline-none [color-scheme:light]';
  const checkboxPill = isDark
    ? 'border-white/15 bg-white/5 text-slate-200'
    : 'border-slate-200 bg-slate-50/90 text-slate-800 hover:bg-slate-100/80';

  return (
    <div className="space-y-5">
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

            <div className="sm:col-span-2 flex flex-wrap gap-2.5 pt-1">
              <label className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold cursor-pointer transition ${checkboxPill}`}>
                <input
                  type="checkbox"
                  checked={form.showCompleted}
                  disabled={isReadOnly}
                  onChange={(e) => setForm({ ...form, showCompleted: e.target.checked })}
                  className={`h-4 w-4 accent-[#43239D] ${isDark ? '[color-scheme:dark]' : '[color-scheme:light]'}`}
                />
                Exibir compromissos concluídos
              </label>
              <label className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold cursor-pointer transition ${checkboxPill}`}>
                <input
                  type="checkbox"
                  checked={form.webPushEnabled}
                  disabled={isReadOnly}
                  onChange={(e) => setForm({ ...form, webPushEnabled: e.target.checked })}
                  className={`h-4 w-4 accent-[#43239D] ${isDark ? '[color-scheme:dark]' : '[color-scheme:light]'}`}
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
                {runningWorker ? 'Processando...' : 'Processar fila de lembretes (Dev)'}
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

        {/* Histórico de Lembretes por E-mail */}
        <div className={`rounded-3xl border p-5 space-y-3 ${cardSurface}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold">Histórico de Lembretes por E-mail</h2>
                <p className="text-xs text-slate-500">
                  Auditoria dos lembretes de e-mail processados para sua conta.
                </p>
              </div>
            </div>
            {!isReadOnly && (
              <button
                type="button"
                disabled={testingEmail}
                onClick={() => void handleTestEmail()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition"
              >
                <Send className="h-3.5 w-3.5" />
                {testingEmail ? 'Enviando...' : 'Testar envio de e-mail'}
              </button>
            )}
          </div>

          <div
            className={`rounded-2xl border px-3 py-2 text-[11px] ${
              isDark
                ? 'border-sky-400/20 bg-sky-500/10 text-sky-200'
                : 'border-sky-200 bg-sky-50 text-sky-900'
            }`}
          >
            O envio utiliza automaticamente o <strong>E-mail Corporativo</strong> configurado na
            Central de Operações (SMTP / Resend), enviando cada lembrete apenas ao e-mail do usuário
            dono ou participante do compromisso.
          </div>

          {emailOutbox.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
              Nenhum lembrete por e-mail processado ainda. Os disparos registrados aparecerão aqui com status e horário.
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

      {/* Categorias da Agenda */}
      <div className={`rounded-3xl border p-5 space-y-4 ${cardSurface}`}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <Tag className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Categorias da Agenda</h2>
            <p className="text-xs text-slate-500">
              Cores e ícones utilizados no calendário, filtros e cartões de contagem regressiva.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800"
            >
              <span
                className="h-5 w-5 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: cat.color }}
              >
                <AgendaCategoryIcon iconName={cat.icon} className="h-3 w-3" />
              </span>
              {cat.name}
              {cat.scope === 'PESSOAL' && (
                <span className="text-[10px] text-slate-500">(Pessoal)</span>
              )}
            </span>
          ))}
        </div>

        {!isReadOnly && (
          <div className="pt-3 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end text-xs">
            <div className="sm:col-span-4">
              <label className="block font-bold mb-1">Nova categoria</label>
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Ex.: Corregedoria, Certidões..."
                className={`w-full rounded-xl border px-3 py-2 ${inputSurface}`}
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block font-bold mb-1">Ícone</label>
              <select
                value={catIcon}
                onChange={(e) => setCatIcon(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2 ${inputSurface}`}
              >
                {PRESET_ICONS.map((ic) => (
                  <option key={ic.key} value={ic.key}>
                    {ic.label}
                  </option>
                ))}
              </select>
            </div>
            {canManageCategories && (
              <div className="sm:col-span-2">
                <label className="block font-bold mb-1">Escopo</label>
                <select
                  value={catScope}
                  onChange={(e) =>
                    setCatScope(e.target.value as 'PESSOAL' | 'INSTITUCIONAL')
                  }
                  className={`w-full rounded-xl border px-3 py-2 ${inputSurface}`}
                >
                  <option value="PESSOAL">Pessoal</option>
                  <option value="INSTITUCIONAL">Institucional</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-3 flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.slice(0, 5).map((col) => (
                  <button
                    key={col}
                    type="button"
                    aria-label={`Selecionar cor ${col}`}
                    onClick={() => setCatColor(col)}
                    className={`h-6 w-6 rounded-full border-2 transition ${
                      catColor === col ? 'border-slate-900 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
              <button
                type="button"
                disabled={creatingCat}
                onClick={() => void handleCreateCategory()}
                className="inline-flex items-center gap-1 rounded-xl bg-[#43239D] px-3 py-2 text-xs font-bold text-white hover:bg-[#5B21B6] shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                {creatingCat ? 'Criando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

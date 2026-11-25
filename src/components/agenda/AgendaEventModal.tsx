'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Plus,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  REMINDER_OFFSET_PRESETS,
  type AgendaCategoryDTO,
  type AgendaOccurrenceView,
  type AgendaPriority,
  type AgendaRecurrenceEditScope,
  type AgendaRecurrenceRule,
  type AgendaRecurrenceType,
  type AgendaReminderChannel,
  type AgendaVisibility,
} from '@/lib/agenda/types';
import {
  PRIORITY_LABEL,
  RECURRENCE_LABEL,
  VISIBILITY_LABEL,
} from './agenda-icons';

interface AgendaEventModalProps {
  open: boolean;
  initialDate: string;
  editingOccurrence: AgendaOccurrenceView | null;
  categories: AgendaCategoryDTO[];
  permissions: {
    canCreateOwn: boolean;
    canAssignOrCreateSetorial: boolean;
    canCreateInstitucional: boolean;
    isReadOnly: boolean;
  };
  onClose: () => void;
  onSaved: () => void;
}

const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function AgendaEventModal({
  open,
  initialDate,
  editingOccurrence,
  categories,
  permissions,
  onClose,
  onSaved,
}: AgendaEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [localStartDate, setLocalStartDate] = useState(initialDate);
  const [localStartTime, setLocalStartTime] = useState('09:00');
  const [localEndDate, setLocalEndDate] = useState(initialDate);
  const [localEndTime, setLocalEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<AgendaPriority>('NORMAL');
  const [visibility, setVisibility] = useState<AgendaVisibility>('INDIVIDUAL');
  const [isConfidential, setIsConfidential] = useState(false);
  const [department, setDepartment] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<AgendaRecurrenceType>('UNICO');
  const [interval, setInterval] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthDay, setMonthDay] = useState<number | ''>('');
  const [businessDayRule, setBusinessDayRule] = useState<'NONE' | 'FIRST_BUSINESS_DAY' | 'LAST_BUSINESS_DAY'>('NONE');
  const [monthEndPolicy, setMonthEndPolicy] = useState<'ULTIMO_DIA' | 'IGNORAR_MES'>('ULTIMO_DIA');
  const [endDate, setEndDate] = useState('');
  const [maxOccurrences, setMaxOccurrences] = useState<number | ''>('');
  const [customUnit, setCustomUnit] = useState<'DIAS' | 'SEMANAS' | 'MESES' | 'ANOS'>('DIAS');
  const [reminders, setReminders] = useState<
    Array<{ channel: AgendaReminderChannel; offsetMinutes: number }>
  >([
    { channel: 'EMAIL', offsetMinutes: 1440 },
    { channel: 'POPUP', offsetMinutes: 30 },
  ]);
  const [editScope, setEditScope] = useState<AgendaRecurrenceEditScope>('SINGLE');
  const [participantInput, setParticipantInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<AgendaOccurrenceView[]>([]);

  useEffect(() => {
    if (!open) return;
    setConflicts([]);
    if (editingOccurrence) {
      setTitle(editingOccurrence.title);
      setDescription(editingOccurrence.description || '');
      setCategoryId(editingOccurrence.categoryId || categories[0]?.id || '');
      setLocalStartDate(editingOccurrence.localStartDate);
      setLocalStartTime(editingOccurrence.localStartTime || '09:00');
      setLocalEndDate(editingOccurrence.localEndDate);
      setLocalEndTime(editingOccurrence.localEndTime || '10:00');
      setAllDay(editingOccurrence.allDay);
      setLocation(editingOccurrence.location || '');
      setMeetingLink(editingOccurrence.meetingLink || '');
      setNotes(editingOccurrence.notes || '');
      setPriority(editingOccurrence.priority);
      setVisibility(editingOccurrence.visibility);
      setIsConfidential(editingOccurrence.isConfidential);
      setDepartment(editingOccurrence.department || '');
      setRecurrenceType(editingOccurrence.recurrenceType);
      setReminders(
        editingOccurrence.reminders.length > 0
          ? editingOccurrence.reminders.map((r) => ({
              channel: r.channel,
              offsetMinutes: r.offsetMinutes,
            }))
          : [{ channel: 'POPUP', offsetMinutes: 30 }]
      );
      setParticipantInput(
        editingOccurrence.participants
          .filter((p) => p.userId !== editingOccurrence.ownerUserId)
          .map((p) => p.userEmail || p.userId)
          .join(', ')
      );
      setEditScope('SINGLE');
    } else {
      setTitle('');
      setDescription('');
      setCategoryId(categories[0]?.id || '');
      setLocalStartDate(initialDate);
      setLocalStartTime('09:00');
      setLocalEndDate(initialDate);
      setLocalEndTime('10:00');
      setAllDay(false);
      setLocation('');
      setMeetingLink('');
      setNotes('');
      setPriority('NORMAL');
      setVisibility('INDIVIDUAL');
      setIsConfidential(false);
      setDepartment('');
      setRecurrenceType('UNICO');
      setInterval(1);
      setWeekdays([]);
      setMonthDay('');
      setBusinessDayRule('NONE');
      setMonthEndPolicy('ULTIMO_DIA');
      setEndDate('');
      setMaxOccurrences('');
      setReminders([
        { channel: 'EMAIL', offsetMinutes: 1440 },
        { channel: 'POPUP', offsetMinutes: 30 },
      ]);
      setParticipantInput('');
    }
  }, [open, editingOccurrence, initialDate, categories]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isEditing = Boolean(editingOccurrence);
  const canSubmit = !permissions.isReadOnly && (!editingOccurrence || editingOccurrence.canEdit);

  function buildRecurrenceRule(): AgendaRecurrenceRule | null {
    if (recurrenceType === 'UNICO') return null;
    return {
      frequency: recurrenceType,
      interval: Math.max(1, interval),
      weekdays: weekdays.length > 0 ? weekdays : undefined,
      monthDay: typeof monthDay === 'number' ? monthDay : null,
      businessDayRule,
      monthEndPolicy,
      endDate: endDate || null,
      maxOccurrences: typeof maxOccurrences === 'number' ? maxOccurrences : null,
      unlimited: !endDate && !maxOccurrences,
      customUnit: recurrenceType === 'PERSONALIZADO' ? customUnit : undefined,
    };
  }

  function parseParticipants() {
    return participantInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) =>
        entry.includes('@')
          ? { userId: entry, userName: entry.split('@')[0], userEmail: entry }
          : { userId: entry, userName: entry }
      );
  }

  async function handleSave(asDuplicate = false) {
    if (saving || permissions.isReadOnly) return;
    if (title.trim().length < 2) {
      toast.error('Informe um título com pelo menos 2 caracteres.');
      return;
    }
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === categoryId);
      const payload = {
        title: asDuplicate ? `${title.trim()} (Cópia)` : title.trim(),
        description: description.trim() || null,
        categoryId: categoryId || null,
        color: cat?.color || null,
        icon: cat?.icon || null,
        localStartDate,
        localStartTime,
        localEndDate,
        localEndTime,
        allDay,
        location: location.trim() || null,
        meetingLink: meetingLink.trim() || null,
        notes: notes.trim() || null,
        priority,
        visibility,
        isConfidential,
        department: department.trim() || null,
        recurrenceType,
        recurrenceRule: buildRecurrenceRule(),
        participantIds: parseParticipants(),
        reminders,
      };

      const isCreate = !editingOccurrence || asDuplicate;
      const url = isCreate
        ? '/api/agenda/events'
        : `/api/agenda/events/${encodeURIComponent(editingOccurrence.eventId)}`;
      const method = isCreate ? 'POST' : 'PATCH';
      const reqBody = isCreate
        ? payload
        : {
            ...payload,
            scope: editScope,
            occurrenceDate: editingOccurrence?.occurrenceDate,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || 'Não foi possível salvar o compromisso.');
        return;
      }
      if (Array.isArray(body?.conflicts) && body.conflicts.length > 0) {
        setConflicts(body.conflicts);
        toast.warning(
          `Compromisso salvo com ${body.conflicts.length} conflito(s) de horário detectado(s).`
        );
      } else {
        toast.success(
          asDuplicate
            ? 'Compromisso duplicado com sucesso.'
            : isEditing
              ? 'Compromisso atualizado com sucesso.'
              : 'Compromisso criado na Agenda Inteligente.'
        );
      }
      window.dispatchEvent(new Event('fiorix:agenda-updated'));
      onSaved();
      onClose();
    } catch {
      toast.error('Erro de comunicação ao salvar compromisso.');
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickAction(action: 'CONCLUIR' | 'CANCELAR') {
    if (!editingOccurrence || saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/agenda/events/${encodeURIComponent(editingOccurrence.eventId)}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            scope: editingOccurrence.isRecurringInstance ? editScope : 'ALL',
            occurrenceDate: editingOccurrence.occurrenceDate,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || 'Não foi possível atualizar o status.');
        return;
      }
      toast.success(
        action === 'CONCLUIR' ? 'Compromisso marcado como concluído.' : 'Compromisso cancelado.'
      );
      window.dispatchEvent(new Event('fiorix:agenda-updated'));
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao alterar status do compromisso.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingOccurrence || saving) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/agenda/events/${encodeURIComponent(editingOccurrence.eventId)}`,
        { method: 'DELETE' }
      );
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || 'Exclusão não autorizada.');
        return;
      }
      toast.success('Compromisso excluído.');
      window.dispatchEvent(new Event('fiorix:agenda-updated'));
      onSaved();
      onClose();
    } catch {
      toast.error('Erro ao excluir compromisso.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/55 backdrop-blur-xs p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Detalhes do compromisso' : 'Novo compromisso'}
    >
      <div className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-3xl bg-white text-slate-900 shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">
              {isEditing ? 'Editar / Detalhes do Compromisso' : 'Novo Compromisso'}
            </h2>
            <p className="text-xs text-slate-500">
              Fuso horário: America/Sao_Paulo · Validação de conflitos e lembretes automáticos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {conflicts.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Aviso de conflito de horário:</strong> este compromisso sobrepõe{' '}
              {conflicts.map((c) => `"${c.title}" (${c.localStartTime})`).join(', ')}.
            </div>
          </div>
        )}

        {editingOccurrence?.isRecurringInstance && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-xs space-y-1.5">
            <div className="font-bold text-violet-900">
              Escopo de alteração em compromisso recorrente ({editingOccurrence.occurrenceDate}):
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['SINGLE', 'Somente esta ocorrência'],
                  ['THIS_AND_FOLLOWING', 'Esta e as seguintes'],
                  ['ALL', 'Toda a série'],
                ] as Array<[AgendaRecurrenceEditScope, string]>
              ).map(([s, label]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEditScope(s)}
                  className={`rounded-lg px-2.5 py-1 font-semibold border ${
                    editScope === s
                      ? 'bg-[#43239D] text-white border-[#43239D]'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canSubmit}
              placeholder="Ex.: Reunião semanal de Gestão de Prazos"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-violet-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!canSubmit}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Prioridade</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as AgendaPriority)}
              disabled={!canSubmit}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 bg-white"
            >
              {(['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'] as AgendaPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                disabled={!canSubmit}
                className="h-4 w-4 accent-[#43239D]"
              />
              Evento de dia inteiro
            </label>
            <label className="inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
                disabled={!canSubmit}
                className="h-4 w-4 accent-[#43239D]"
              />
              Confidencial (minimiza dados em e-mails)
            </label>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Data inicial *</label>
            <input
              type="date"
              value={localStartDate}
              onChange={(e) => {
                setLocalStartDate(e.target.value);
                if (localEndDate < e.target.value) setLocalEndDate(e.target.value);
              }}
              disabled={!canSubmit}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>

          {!allDay && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Horário inicial</label>
              <input
                type="time"
                value={localStartTime}
                onChange={(e) => setLocalStartTime(e.target.value)}
                disabled={!canSubmit}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Data final *</label>
            <input
              type="date"
              value={localEndDate}
              onChange={(e) => setLocalEndDate(e.target.value)}
              disabled={!canSubmit}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>

          {!allDay && (
            <div>
              <label className="block font-bold text-slate-700 mb-1">Horário final</label>
              <input
                type="time"
                value={localEndTime}
                onChange={(e) => setLocalEndTime(e.target.value)}
                disabled={!canSubmit}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 mb-1">Visibilidade</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as AgendaVisibility)}
              disabled={!canSubmit}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 bg-white"
            >
              <option value="INDIVIDUAL">{VISIBILITY_LABEL.INDIVIDUAL}</option>
              <option value="COMPARTILHADO">{VISIBILITY_LABEL.COMPARTILHADO}</option>
              {permissions.canAssignOrCreateSetorial && (
                <option value="SETORIAL">{VISIBILITY_LABEL.SETORIAL}</option>
              )}
              {permissions.canCreateInstitucional && (
                <option value="INSTITUCIONAL">{VISIBILITY_LABEL.INSTITUCIONAL}</option>
              )}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Departamento / Setor</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={!canSubmit}
              placeholder="Ex.: TI, Registro, RH"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Local</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={!canSubmit}
              placeholder="Sala de reuniões / Presencial"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Link de reunião</label>
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              disabled={!canSubmit}
              placeholder="https://meet.google.com/..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">
              Participantes (e-mails ou IDs separados por vírgula)
            </label>
            <input
              type="text"
              value={participantInput}
              onChange={(e) => setParticipantInput(e.target.value)}
              disabled={!canSubmit}
              placeholder="ex: maria@7risp.com.br, joao@7risp.com.br"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Descrição</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canSubmit}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Observações</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canSubmit}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>

          {/* Recorrência Inteligente */}
          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Recorrência</label>
                <select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value as AgendaRecurrenceType)}
                  disabled={!canSubmit}
                  className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900"
                >
                  {(Object.keys(RECURRENCE_LABEL) as AgendaRecurrenceType[]).map((key) => (
                    <option key={key} value={key}>
                      {RECURRENCE_LABEL[key]}
                    </option>
                  ))}
                </select>
              </div>

              {recurrenceType !== 'UNICO' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Intervalo</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={interval}
                      onChange={(e) => setInterval(Math.max(1, Number(e.target.value)))}
                      disabled={!canSubmit}
                      className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Encerra em</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={!canSubmit}
                      className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900"
                    />
                  </div>
                </>
              )}
            </div>

            {recurrenceType !== 'UNICO' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {recurrenceType === 'PERSONALIZADO' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Unidade</label>
                    <select
                      value={customUnit}
                      onChange={(e) =>
                        setCustomUnit(e.target.value as 'DIAS' | 'SEMANAS' | 'MESES' | 'ANOS')
                      }
                      className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900"
                    >
                      <option value="DIAS">Dias</option>
                      <option value="SEMANAS">Semanas</option>
                      <option value="MESES">Meses</option>
                      <option value="ANOS">Anos</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Regra de dia útil</label>
                  <select
                    value={businessDayRule}
                    onChange={(e) =>
                      setBusinessDayRule(
                        e.target.value as 'NONE' | 'FIRST_BUSINESS_DAY' | 'LAST_BUSINESS_DAY'
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900"
                  >
                    <option value="NONE">Data fixa</option>
                    <option value="FIRST_BUSINESS_DAY">1º dia útil do mês</option>
                    <option value="LAST_BUSINESS_DAY">Último dia útil do mês</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Dia inexistente (ex.: 31)
                  </label>
                  <select
                    value={monthEndPolicy}
                    onChange={(e) =>
                      setMonthEndPolicy(e.target.value as 'ULTIMO_DIA' | 'IGNORAR_MES')
                    }
                    className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900"
                  >
                    <option value="ULTIMO_DIA">Usar último dia do mês</option>
                    <option value="IGNORAR_MES">Ignorar o mês</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Máx. ocorrências</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    placeholder="Sem limite"
                    value={maxOccurrences}
                    onChange={(e) =>
                      setMaxOccurrences(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900"
                  />
                </div>
              </div>
            )}

            {(recurrenceType === 'SEMANAL' ||
              recurrenceType === 'QUINZENAL' ||
              (recurrenceType === 'PERSONALIZADO' && customUnit === 'SEMANAS')) && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-600 mr-1">Dias da semana:</span>
                {WEEKDAY_NAMES.map((label, wd) => {
                  const active = weekdays.includes(wd);
                  return (
                    <button
                      key={wd}
                      type="button"
                      onClick={() =>
                        setWeekdays((prev) =>
                          prev.includes(wd) ? prev.filter((x) => x !== wd) : [...prev, wd]
                        )
                      }
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold border ${
                        active
                          ? 'bg-[#43239D] text-white border-[#43239D]'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lembretes múltiplos */}
          <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Lembretes programados</span>
              {canSubmit && (
                <button
                  type="button"
                  onClick={() =>
                    setReminders((prev) => [
                      ...prev,
                      { channel: 'POPUP', offsetMinutes: 15 },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar lembrete
                </button>
              )}
            </div>
            <div className="space-y-2">
              {reminders.map((rem, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <select
                    value={rem.channel}
                    disabled={!canSubmit}
                    onChange={(e) =>
                      setReminders((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? { ...item, channel: e.target.value as AgendaReminderChannel }
                            : item
                        )
                      )
                    }
                    className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-slate-900"
                  >
                    <option value="EMAIL">E-mail</option>
                    <option value="POPUP">Pop-up FIORIX</option>
                    <option value="PUSH">Web Push</option>
                  </select>
                  <select
                    value={rem.offsetMinutes}
                    disabled={!canSubmit}
                    onChange={(e) =>
                      setReminders((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, offsetMinutes: Number(e.target.value) } : item
                        )
                      )
                    }
                    className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-slate-900 flex-1"
                  >
                    {REMINDER_OFFSET_PRESETS.map((preset) => (
                      <option key={preset.minutes} value={preset.minutes}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  {canSubmit && (
                    <button
                      type="button"
                      onClick={() =>
                        setReminders((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Remover lembrete"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé de ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            {editingOccurrence?.canConclude &&
              editingOccurrence.effectiveStatus !== 'CONCLUIDO' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleQuickAction('CONCLUIR')}
                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Concluir
                </button>
              )}
            {editingOccurrence?.canEdit &&
              editingOccurrence.effectiveStatus !== 'CANCELADO' && (
                <>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleQuickAction('CANCELAR')}
                    className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSave(true)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicar
                  </button>
                </>
              )}
            {editingOccurrence?.canDelete && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
            {canSubmit && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave(false)}
                className="rounded-xl bg-[#43239D] px-5 py-2 text-xs font-bold text-white hover:bg-[#5B21B6] disabled:opacity-50"
              >
                {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar compromisso'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

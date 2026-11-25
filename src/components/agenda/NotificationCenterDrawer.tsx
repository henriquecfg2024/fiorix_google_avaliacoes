'use client';

import { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Clock,
  Mail,
  X,
} from 'lucide-react';
import type { AgendaEmailOutboxDTO, AgendaNotificationJobDTO } from '@/lib/agenda/types';
import { formatLocalDateBr } from '@/lib/agenda/timezone';
import { AgendaCategoryIcon } from './agenda-icons';

type NotificationTab = 'NAO_LIDAS' | 'LIDAS' | 'FUTUROS' | 'ADIADOS' | 'HISTORICO' | 'EMAILS';

interface NotificationCenterDrawerProps {
  open: boolean;
  onClose: () => void;
  unread: AgendaNotificationJobDTO[];
  read: AgendaNotificationJobDTO[];
  upcoming: AgendaNotificationJobDTO[];
  snoozed: AgendaNotificationJobDTO[];
  history: AgendaNotificationJobDTO[];
  emailOutbox: AgendaEmailOutboxDTO[];
  onMarkRead: (jobId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onOpenEvent: (eventId: string) => void;
}

export function NotificationCenterDrawer({
  open,
  onClose,
  unread,
  read,
  upcoming,
  snoozed,
  history,
  emailOutbox,
  onMarkRead,
  onMarkAllRead,
  onOpenEvent,
}: NotificationCenterDrawerProps) {
  const [tab, setTab] = useState<NotificationTab>('NAO_LIDAS');

  if (!open) return null;

  const listByTab: Record<Exclude<NotificationTab, 'EMAILS'>, AgendaNotificationJobDTO[]> = {
    NAO_LIDAS: unread,
    LIDAS: read,
    FUTUROS: upcoming,
    ADIADOS: snoozed,
    HISTORICO: history,
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex justify-end bg-slate-950/35 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Central de Notificações da Agenda"
    >
      <button
        type="button"
        aria-label="Fechar central de notificações"
        onClick={onClose}
        className="flex-1 cursor-default"
      />
      <div className="w-full max-w-md bg-white text-slate-900 h-full shadow-2xl border-l border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-950">Central de Notificações</h2>
              <p className="text-[11px] text-slate-500">
                {unread.length} não lida(s) · {snoozed.length} adiada(s) · {upcoming.length} futura(s)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['NAO_LIDAS', `Não lidas (${unread.length})`],
                ['LIDAS', 'Lidas'],
                ['FUTUROS', 'Futuros'],
                ['ADIADOS', 'Adiados'],
                ['HISTORICO', 'Histórico'],
                ['EMAILS', `E-mails (${emailOutbox.length})`],
              ] as Array<[NotificationTab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  tab === key
                    ? 'bg-violet-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {unread.length > 0 && (
            <button
              type="button"
              onClick={() => void onMarkAllRead()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como lidas
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {tab === 'EMAILS' ? (
            emailOutbox.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                Nenhum e-mail de lembrete disparado ainda nesta sessão.
              </div>
            ) : (
              emailOutbox.map((mail) => (
                <div
                  key={mail.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-900">
                      <Mail className="h-3.5 w-3.5 text-violet-600" />
                      {mail.recipientEmail}
                    </span>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                      {mail.status}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800">{mail.subject}</div>
                  <p className="text-[11px] text-slate-600 whitespace-pre-line line-clamp-4">
                    {mail.bodyText}
                  </p>
                </div>
              ))
            )
          ) : listByTab[tab].length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              Nenhuma notificação nesta aba.
            </div>
          ) : (
            listByTab[tab].map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-7 w-7 rounded-lg text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: job.eventColor || '#4F46E5' }}
                    >
                      <AgendaCategoryIcon iconName={job.eventCategoryIcon} className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{job.eventTitle}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatLocalDateBr(job.eventLocalDate)} · {job.eventLocalTime} · {job.channel}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    {job.status}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenEvent(job.eventId);
                      onClose();
                    }}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Visualizar
                  </button>
                  {!job.readAt && (
                    <button
                      type="button"
                      onClick={() => void onMarkRead(job.id)}
                      className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-500"
                    >
                      Marcar lida
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

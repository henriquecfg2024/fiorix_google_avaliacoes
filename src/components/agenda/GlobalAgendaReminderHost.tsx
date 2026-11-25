'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, CheckCircle2, Clock, Eye, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AgendaNotificationJobDTO, AgendaWelcomeResponse } from '@/lib/agenda/types';
import { formatCountdownLabel, formatLocalDateBr } from '@/lib/agenda/timezone';
import { AgendaCategoryIcon, PRIORITY_LABEL } from './agenda-icons';
import { WelcomeLoginModal } from './WelcomeLoginModal';

const WELCOME_CHANNEL_NAME = 'fiorix_login_welcome_sync';

function getWelcomeStorageKey(loginKey: string): string {
  return `fiorix:welcome_ack:${loginKey}`;
}

function hasUserTypingInForm(): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((active as HTMLElement).isContentEditable) return true;
  return Boolean(active.closest('form'));
}

/**
 * Coordenador global montado no DashboardLayout:
 * 1. Exibe Boas-Vindas Inteligentes 1 única vez por login explícito (dedupe entre abas e re-renders).
 * 2. Exibe fila sequencial de lembretes POPUP vencidos após o fechamento das boas-vindas,
 *    sem sobrepor modais nem interromper preenchimento de formulários.
 */
export function GlobalAgendaReminderHost() {
  const router = useRouter();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeLoading, setWelcomeLoading] = useState(false);
  const [welcomeData, setWelcomeData] = useState<AgendaWelcomeResponse | null>(null);

  const [popupQueue, setPopupQueue] = useState<AgendaNotificationJobDTO[]>([]);
  const [acting, setActing] = useState(false);
  const checkedLoginRef = useRef<string | null>(null);
  const nextWakeTimerRef = useRef<number | null>(null);

  const fetchNotificationsQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/agenda/notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const body = (await res.json()) as {
        duePopups?: AgendaNotificationJobDTO[];
        upcoming?: AgendaNotificationJobDTO[];
        snoozed?: AgendaNotificationJobDTO[];
      };
      const due = Array.isArray(body.duePopups) ? body.duePopups : [];
      setPopupQueue(due);

      // Agenda um único wakeup exato para o próximo lembrete futuro/adiado (zero polling contínuo)
      if (nextWakeTimerRef.current) {
        window.clearTimeout(nextWakeTimerRef.current);
        nextWakeTimerRef.current = null;
      }
      const candidates = [
        ...(body.upcoming || []).map((j) => new Date(j.scheduledFor).getTime()),
        ...(body.snoozed || [])
          .filter((j) => j.snoozedUntil)
          .map((j) => new Date(j.snoozedUntil!).getTime()),
      ].filter((ts) => ts > Date.now());

      if (candidates.length > 0) {
        const nextTs = Math.min(...candidates);
        const delayMs = Math.min(Math.max(nextTs - Date.now() + 500, 5_000), 3_600_000);
        nextWakeTimerRef.current = window.setTimeout(() => {
          void fetchNotificationsQueue();
        }, delayMs);
      }
    } catch {
      // Silencioso em indisponibilidade de rede
    }
  }, []);

  const loadWelcomeOnSession = useCallback(async (forceRetry = false) => {
    setWelcomeLoading(true);
    try {
      const res = await fetch('/api/agenda/welcome', { cache: 'no-store' });
      if (!res.ok) {
        setWelcomeLoading(false);
        return;
      }
      const payload = (await res.json()) as AgendaWelcomeResponse;
      if (!payload.enabled) {
        setWelcomeLoading(false);
        return;
      }

      const storageKey = getWelcomeStorageKey(payload.loginKey);
      const alreadyAck =
        !forceRetry &&
        typeof window !== 'undefined' &&
        window.localStorage.getItem(storageKey) === '1';

      if (alreadyAck) {
        setWelcomeLoading(false);
        if (payload.canAccessAgenda) {
          void fetchNotificationsQueue();
        }
        return;
      }

      if (!forceRetry && checkedLoginRef.current === payload.loginKey) {
        setWelcomeLoading(false);
        return;
      }
      checkedLoginRef.current = payload.loginKey;
      setWelcomeData(payload);
      setWelcomeOpen(true);
    } catch {
      // Não bloqueia acesso ao sistema em caso de erro de rede
    } finally {
      setWelcomeLoading(false);
    }
  }, [fetchNotificationsQueue]);

  useEffect(() => {
    void loadWelcomeOnSession(false);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(WELCOME_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (
          event?.data?.type === 'WELCOME_CLOSED' &&
          welcomeData?.loginKey === event.data.loginKey
        ) {
          setWelcomeOpen(false);
        }
      };
    }

    const handleRefreshEvent = () => {
      void fetchNotificationsQueue();
    };
    window.addEventListener('fiorix:agenda-updated', handleRefreshEvent);

    return () => {
      bc?.close();
      window.removeEventListener('fiorix:agenda-updated', handleRefreshEvent);
      if (nextWakeTimerRef.current) {
        window.clearTimeout(nextWakeTimerRef.current);
      }
    };
  }, [loadWelcomeOnSession, fetchNotificationsQueue, welcomeData?.loginKey]);

  function acknowledgeAndCloseWelcome() {
    if (welcomeData?.loginKey && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(getWelcomeStorageKey(welcomeData.loginKey), '1');
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel(WELCOME_CHANNEL_NAME);
          bc.postMessage({ type: 'WELCOME_CLOSED', loginKey: welcomeData.loginKey });
          bc.close();
        }
      } catch {
        // Ignora bloqueios de storage
      }
    }
    setWelcomeOpen(false);
    if (welcomeData?.canAccessAgenda) {
      void fetchNotificationsQueue();
    }
  }

  async function actOnCurrentReminder(
    action: 'MARK_READ' | 'SNOOZE' | 'DISMISS' | 'CONCLUDE_EVENT',
    snoozeMinutes?: 5 | 15 | 30 | 60
  ) {
    const current = popupQueue[0];
    if (!current || acting) return;
    setActing(true);
    try {
      const res = await fetch('/api/agenda/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          jobId: current.id,
          snoozeMinutes,
        }),
      });
      if (res.ok) {
        setPopupQueue((prev) => prev.slice(1));
        if (action === 'SNOOZE') {
          toast.info(`Lembrete adiado por ${snoozeMinutes} minutos.`);
        } else if (action === 'CONCLUDE_EVENT') {
          toast.success('Compromisso concluído.');
          window.dispatchEvent(new Event('fiorix:agenda-updated'));
        }
      }
    } catch {
      toast.error('Erro ao atualizar lembrete.');
    } finally {
      setActing(false);
    }
  }

  const currentReminder = !welcomeOpen && popupQueue.length > 0 ? popupQueue[0]! : null;
  const userInForm = currentReminder ? hasUserTypingInForm() : false;

  return (
    <>
      <WelcomeLoginModal
        open={welcomeOpen}
        loading={welcomeLoading}
        data={welcomeData}
        onClose={acknowledgeAndCloseWelcome}
        onRetry={() => void loadWelcomeOnSession(true)}
        onOpenAgenda={(quickFilter) => {
          acknowledgeAndCloseWelcome();
          router.push(quickFilter === 'atrasados' ? '/agenda?quickFilter=atrasados' : '/agenda');
        }}
      />

      {/* Pop-up global de lembretes: nunca sobrepõe Boas-Vindas nem rouba foco de formulários */}
      {currentReminder && (
        <div
          className={`fixed bottom-5 right-5 z-[70] w-full max-w-sm rounded-2xl border border-violet-200 bg-white text-slate-900 shadow-2xl p-4 space-y-3 transition-all ${
            userInForm ? 'opacity-95' : 'animate-in slide-in-from-bottom-4 duration-200'
          }`}
          role="alertdialog"
          aria-label={`Lembrete: ${currentReminder.eventTitle}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="h-9 w-9 rounded-xl text-white flex items-center justify-center shrink-0"
                style={{ backgroundColor: currentReminder.eventColor || '#4F46E5' }}
              >
                <AgendaCategoryIcon iconName={currentReminder.eventCategoryIcon} className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  <BellRing className="h-3 w-3" />
                  Lembrete ({popupQueue.length > 1 ? `1 de ${popupQueue.length}` : 'Agenda'})
                </div>
                <h3 className="text-sm font-extrabold text-slate-950 truncate">
                  {currentReminder.eventTitle}
                </h3>
              </div>
            </div>
            <button
              type="button"
              disabled={acting}
              onClick={() => void actOnCurrentReminder('DISMISS')}
              aria-label="Fechar lembrete"
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-semibold">{currentReminder.eventCategoryName}</span>
              <span className="rounded-full bg-violet-100 text-violet-800 px-2 py-0.5 text-[10px] font-bold">
                {PRIORITY_LABEL[currentReminder.eventPriority]}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>
                {formatLocalDateBr(currentReminder.eventLocalDate)} ·{' '}
                {currentReminder.eventAllDay ? 'Dia inteiro' : currentReminder.eventLocalTime}
              </span>
              <span className="ml-auto font-bold text-violet-700">
                {formatCountdownLabel({
                  startAt: currentReminder.eventStartAt,
                  endAt: currentReminder.eventStartAt,
                  localStartDate: currentReminder.eventLocalDate,
                  allDay: currentReminder.eventAllDay,
                  effectiveStatus: 'AGENDADO',
                  timezone: 'America/Sao_Paulo',
                })}
              </span>
            </div>
            {currentReminder.eventDescription && (
              <p className="text-[11px] text-slate-500 line-clamp-2 pt-0.5">
                {currentReminder.eventDescription}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-500 mr-1">Adiar:</span>
            {([5, 15, 30, 60] as const).map((mins) => (
              <button
                key={mins}
                type="button"
                disabled={acting}
                onClick={() => void actOnCurrentReminder('SNOOZE', mins)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                {mins === 60 ? '1h' : `${mins}m`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                void actOnCurrentReminder('MARK_READ');
                router.push(`/agenda?event=${encodeURIComponent(currentReminder.eventId)}`);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-3.5 w-3.5" />
              Visualizar
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={acting}
                onClick={() => void actOnCurrentReminder('CONCLUDE_EVENT')}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Concluir
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => void actOnCurrentReminder('MARK_READ')}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500"
              >
                Lido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

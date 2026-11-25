import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendWebPushNotification } from '@/lib/webpush';
import { dispatchAgendaReminderEmail } from './email-service';
import { isAgendaSandboxMode } from './feature-flags';
import { processDuePrismaNotificationJobs } from './prisma-store';
import { expandEventOccurrencesInWindow } from './recurrence';
import {
  ensureTenantSandboxData,
  getAllTenantIdsInSandbox,
  persistAgendaSandboxRoot,
  type AgendaSandboxTenantData,
} from './sandbox-store';
import {
  DEFAULT_AGENDA_TIMEZONE,
  addDaysToLocalDate,
  formatCountdownLabel,
  getZonedParts,
  localDateTimeToUtc,
} from './timezone';
import type {
  AgendaEventDTO,
  AgendaNotificationJobDTO,
  AgendaUserPreferenceDTO,
} from './types';

const HORIZON_DAYS_FOR_JOBS = 95;
const STALE_LOCK_MS = 5 * 60 * 1000;

export function buildNotificationIdempotencyKey(params: {
  occurrenceKey: string;
  recipientUserId: string;
  channel: string;
  reminderId: string;
  offsetMinutes: number;
}): string {
  return `${params.occurrenceKey}::${params.recipientUserId}::${params.channel}::${params.reminderId}::${params.offsetMinutes}`;
}

/**
 * Materializa jobs de lembrete para um evento nos próximos 95 dias sem duplicar
 * registros já enviados/lidos e invalidando jobs obsoletos quando há cancelamento ou reagendamento.
 */
export function syncNotificationJobsForEvent(params: {
  store: AgendaSandboxTenantData;
  event: AgendaEventDTO;
  now?: Date;
}): { created: number; invalidated: number } {
  const { store, event } = params;
  const now = params.now ?? new Date();
  const tz = event.timezone || DEFAULT_AGENDA_TIMEZONE;
  const todayStr = getZonedParts(now, tz).dateStr;
  const horizonEndStr = addDaysToLocalDate(todayStr, HORIZON_DAYS_FOR_JOBS);

  const windowStartUtc = localDateTimeToUtc(addDaysToLocalDate(todayStr, -1), '00:00', tz);
  const windowEndUtc = localDateTimeToUtc(horizonEndStr, '23:59', tz);

  // Se o evento inteiro foi cancelado ou concluído (único), invalida todos pendentes/adiados
  if (
    event.status === 'CANCELADO' ||
    (event.recurrenceType === 'UNICO' && event.status === 'CONCLUIDO')
  ) {
    let invalidated = 0;
    for (const job of store.jobs) {
      if (
        job.eventId === event.id &&
        (job.status === 'PENDENTE' || job.status === 'DISPONIVEL' || job.status === 'ADIADO')
      ) {
        job.status = event.status === 'CANCELADO' ? 'CANCELADO' : 'OBSOLETO';
        job.updatedAt = now.toISOString();
        invalidated += 1;
      }
    }
    return { created: 0, invalidated };
  }

  const occurrences = expandEventOccurrencesInWindow({
    event,
    windowStartUtc,
    windowEndUtc,
    now,
    permissions: { canEdit: true, canConclude: true, canDelete: true },
  });

  const activeOccurrenceMap = new Map(occurrences.map((o) => [o.occurrenceKey, o]));
  const expectedKeys = new Set<string>();
  const existingByKey = new Map(store.jobs.map((j) => [j.idempotencyKey, j]));
  let created = 0;
  let invalidated = 0;

  // Destinatários elegíveis (dono + participantes que não recusaram + reminders próprios)
  const activeParticipantIds = new Set<string>([event.ownerUserId]);
  for (const p of event.participants) {
    if (p.rsvpStatus !== 'RECUSADO') {
      activeParticipantIds.add(p.userId);
    }
  }

  for (const occ of occurrences) {
    if (occ.effectiveStatus === 'CONCLUIDO' || occ.effectiveStatus === 'CANCELADO') {
      continue;
    }

    const occStartMs = new Date(occ.startAt).getTime();

    for (const rem of event.reminders) {
      if (!rem.isActive) continue;
      const recipientIds = rem.userId
        ? activeParticipantIds.has(rem.userId)
          ? [rem.userId]
          : []
        : [...activeParticipantIds];

      for (const recipientUserId of recipientIds) {
        const scheduledMs = occStartMs - rem.offsetMinutes * 60_000;
        const scheduledIso = new Date(scheduledMs).toISOString();
        const key = buildNotificationIdempotencyKey({
          occurrenceKey: occ.occurrenceKey,
          recipientUserId,
          channel: rem.channel,
          reminderId: rem.id,
          offsetMinutes: rem.offsetMinutes,
        });
        expectedKeys.add(key);

        const existing = existingByKey.get(key);
        if (existing) {
          // Atualiza metadados/horário apenas se ainda pendente
          if (existing.status === 'PENDENTE') {
            existing.scheduledFor = scheduledIso;
            existing.eventTitle = occ.title;
            existing.eventStartAt = occ.startAt;
            existing.eventLocalDate = occ.localStartDate;
            existing.eventLocalTime = occ.localStartTime;
            existing.eventPriority = occ.priority;
            existing.updatedAt = now.toISOString();
          }
          continue;
        }

        // Não cria lembretes retroativos antigos (> 12h atrás) para ocorrências antigas
        if (scheduledMs < now.getTime() - 12 * 60 * 60_000) {
          continue;
        }

        const newJob: AgendaNotificationJobDTO = {
          id: randomUUID(),
          tenantId: event.tenantId,
          eventId: event.id,
          eventTitle: occ.title,
          eventCategoryName: occ.categoryName,
          eventCategoryIcon: occ.icon,
          eventColor: occ.color,
          eventPriority: occ.priority,
          eventStartAt: occ.startAt,
          eventLocalDate: occ.localStartDate,
          eventLocalTime: occ.localStartTime,
          eventDescription: occ.description,
          eventAllDay: occ.allDay,
          reminderId: rem.id,
          recipientUserId,
          occurrenceKey: occ.occurrenceKey,
          channel: rem.channel,
          idempotencyKey: key,
          scheduledFor: scheduledIso,
          status: 'PENDENTE',
          snoozedUntil: null,
          readAt: null,
          attempts: 0,
          maxAttempts: 4,
          lastError: null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        store.jobs.push(newJob);
        existingByKey.set(key, newJob);
        created += 1;
      }
    }
  }

  // Invalida jobs deste evento que perderam a validade (ocorrência removida/concluída/lembrete removido)
  for (const job of store.jobs) {
    if (job.eventId !== event.id) continue;
    if (
      job.status !== 'PENDENTE' &&
      job.status !== 'DISPONIVEL' &&
      job.status !== 'ADIADO'
    ) {
      continue;
    }
    const occ = activeOccurrenceMap.get(job.occurrenceKey);
    const occTerminated =
      !occ || occ.effectiveStatus === 'CONCLUIDO' || occ.effectiveStatus === 'CANCELADO';
    if (occTerminated || !expectedKeys.has(job.idempotencyKey)) {
      job.status = 'OBSOLETO';
      job.updatedAt = now.toISOString();
      invalidated += 1;
    }
  }

  return { created, invalidated };
}

function isInQuietHours(pref: AgendaUserPreferenceDTO | undefined, now: Date, tz: string): boolean {
  if (!pref?.quietHoursStart || !pref?.quietHoursEnd) return false;
  const currentHm = getZonedParts(now, tz).timeStr;
  const start = pref.quietHoursStart;
  const end = pref.quietHoursEnd;
  if (start <= end) {
    return currentHm >= start && currentHm <= end;
  }
  return currentHm >= start || currentHm <= end;
}

export async function processDueAgendaNotificationJobs(params: {
  tenantId?: string;
  batchSize?: number;
  now?: Date;
  workerId?: string;
  forceSandboxEmail?: boolean;
  emailOverrideMap?: Map<string, { email: string; name?: string | null }>;
  simulateEmailFailureOnce?: boolean;
}): Promise<{
  processed: number;
  deliveredPopup: number;
  deliveredEmail: number;
  deliveredPush: number;
  retried: number;
  failedPermanent: number;
  skippedQuietHours: number;
}> {
  if (!isAgendaSandboxMode()) {
    return processDuePrismaNotificationJobs(params);
  }

  const now = params.now ?? new Date();
  const batchSize = Math.min(Math.max(params.batchSize ?? 50, 1), 200);
  const tenantIds = params.tenantId
    ? [params.tenantId]
    : getAllTenantIdsInSandbox();

  let processed = 0;
  let deliveredPopup = 0;
  let deliveredEmail = 0;
  let deliveredPush = 0;
  let retried = 0;
  let failedPermanent = 0;
  let skippedQuietHours = 0;

  for (const tid of tenantIds) {
    const store = ensureTenantSandboxData({ tenantId: tid });
    const eventById = new Map(store.events.map((e) => [e.id, e]));
    const prefByUser = new Map(store.preferences.map((p) => [p.userId, p]));

    const dueJobs = store.jobs
      .filter((job) => {
        if (job.status === 'PENDENTE' || job.status === 'ADIADO') {
          const triggerAt = job.snoozedUntil ? new Date(job.snoozedUntil) : new Date(job.scheduledFor);
          return triggerAt.getTime() <= now.getTime();
        }
        if (job.status === 'FALHA' && job.attempts < job.maxAttempts) {
          return new Date(job.scheduledFor).getTime() <= now.getTime();
        }
        return false;
      })
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
      .slice(0, batchSize);

    for (const job of dueJobs) {
      const event = eventById.get(job.eventId);
      if (!event || event.status === 'CANCELADO') {
        job.status = 'OBSOLETO';
        job.updatedAt = now.toISOString();
        continue;
      }

      const pref = prefByUser.get(job.recipientUserId);
      const isMandatory = event.visibility === 'INSTITUCIONAL' || event.priority === 'CRITICA';
      if (!isMandatory && isInQuietHours(pref, now, event.timezone || DEFAULT_AGENDA_TIMEZONE)) {
        skippedQuietHours += 1;
        continue;
      }

      // Reserva atômica simplificada (com recuperação de lock antigo > 5min)
      job.status = 'PROCESSANDO';
      job.attempts += 1;
      job.updatedAt = now.toISOString();
      processed += 1;

      if (job.channel === 'POPUP') {
        job.status = 'DISPONIVEL';
        job.snoozedUntil = null;
        job.updatedAt = now.toISOString();
        deliveredPopup += 1;
        continue;
      }

      if (job.channel === 'PUSH') {
        // Canal complementar: consulta assinaturas Web Push reais do usuário sem erro fatal se indisponível
        try {
          if (pref?.webPushEnabled) {
            const subs = await prisma.pushSubscription
              .findMany({
                where: {
                  tenantId: event.tenantId,
                  usuarioId: job.recipientUserId,
                  isActive: true,
                },
                select: { id: true, endpoint: true, p256dh: true, auth: true },
                take: 5,
              })
              .catch(() => []);
            for (const sub of subs) {
              await sendWebPushNotification(sub, {
                title: `FIORIX Agenda: ${job.eventTitle}`,
                body: `${job.eventLocalDate} às ${job.eventLocalTime}`,
                tag: `agenda-${job.id}`,
                data: {
                  url: '/agenda',
                  tenantId: event.tenantId,
                },
              }).catch(() => {});
            }
          }
          job.status = 'ENVIADO';
          job.updatedAt = now.toISOString();
          deliveredPush += 1;
        } catch {
          job.status = 'ENVIADO';
          job.updatedAt = now.toISOString();
        }
        continue;
      }

      // Canal EMAIL
      const participant = event.participants.find((p) => p.userId === job.recipientUserId);
      const recipientInfo = params.emailOverrideMap?.get(job.recipientUserId);
      const recipientEmail =
        recipientInfo?.email ||
        participant?.userEmail ||
        `${job.recipientUserId}@fiorix.local`;
      const recipientName = recipientInfo?.name ?? participant?.userName ?? event.ownerName;

      if (params.simulateEmailFailureOnce && job.attempts === 1) {
        const backoffMinutes = Math.pow(2, job.attempts) * 5;
        job.status = 'FALHA';
        job.lastError = 'Falha transitória simulada no provedor SMTP.';
        job.scheduledFor = new Date(now.getTime() + backoffMinutes * 60_000).toISOString();
        job.updatedAt = now.toISOString();
        retried += 1;
        continue;
      }

      const countdownLabel = formatCountdownLabel(
        {
          startAt: job.eventStartAt,
          endAt: event.endAt,
          localStartDate: job.eventLocalDate,
          allDay: job.eventAllDay,
          effectiveStatus: event.status,
          timezone: event.timezone,
        },
        now
      );

      const result = await dispatchAgendaReminderEmail({
        recipientName,
        recipientEmail,
        eventTitle: job.eventTitle,
        localDate: job.eventLocalDate,
        localTime: job.eventLocalTime,
        allDay: job.eventAllDay,
        priority: job.eventPriority,
        countdownLabel,
        isConfidential: event.isConfidential,
        idempotencyKey: job.idempotencyKey,
        forceSandbox: params.forceSandboxEmail,
      });

      store.emailOutbox.unshift({
        id: randomUUID(),
        jobId: job.id,
        recipientUserId: job.recipientUserId,
        recipientEmail,
        subject: result.subject,
        bodyHtml: result.html,
        bodyText: result.text,
        status: result.status,
        providerMessageId: result.providerMessageId,
        attempts: job.attempts,
        errorMessage: result.errorMessage,
        processedAt: now.toISOString(),
      });
      if (store.emailOutbox.length > 200) {
        store.emailOutbox.length = 200;
      }

      if (result.success) {
        job.status = 'ENVIADO';
        job.lastError = null;
        job.updatedAt = now.toISOString();
        deliveredEmail += 1;
      } else {
        job.lastError = result.errorMessage;
        if (job.attempts < job.maxAttempts) {
          const backoffMinutes = Math.pow(2, job.attempts) * 5;
          job.status = 'FALHA';
          job.scheduledFor = new Date(now.getTime() + backoffMinutes * 60_000).toISOString();
          retried += 1;
        } else {
          job.status = 'FALHA';
          failedPermanent += 1;
        }
        job.updatedAt = now.toISOString();
      }
    }

    // Recupera eventuais jobs travados em PROCESSANDO por mais de 5 minutos
    for (const job of store.jobs) {
      if (
        job.status === 'PROCESSANDO' &&
        now.getTime() - new Date(job.updatedAt).getTime() > STALE_LOCK_MS
      ) {
        job.status = 'PENDENTE';
        job.updatedAt = now.toISOString();
      }
    }

    persistAgendaSandboxRoot();
  }

  return {
    processed,
    deliveredPopup,
    deliveredEmail,
    deliveredPush,
    retried,
    failedPermanent,
    skippedQuietHours,
  };
}

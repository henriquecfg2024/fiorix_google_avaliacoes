import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendWebPushNotification } from '@/lib/webpush';
import { dispatchAgendaReminderEmail } from './email-service';
import type { AgendaAccessContext } from './permissions';
import { expandEventOccurrencesInWindow } from './recurrence';
import {
  DEFAULT_AGENDA_TIMEZONE,
  addDaysToLocalDate,
  formatCountdownLabel,
  getZonedParts,
  localDateTimeToUtc,
} from './timezone';
import {
  DEFAULT_AGENDA_CATEGORIES,
  type AgendaAuditLogDTO,
  type AgendaCalendarView,
  type AgendaCategoryDTO,
  type AgendaCategoryScope,
  type AgendaEmailOutboxDTO,
  type AgendaEventDTO,
  type AgendaNotificationJobDTO,
  type AgendaOccurrenceStatusDTO,
  type AgendaPriority,
  type AgendaRecurrenceExceptionDTO,
  type AgendaRecurrenceRule,
  type AgendaRecurrenceType,
  type AgendaReminderChannel,
  type AgendaRsvpStatus,
  type AgendaStatus,
  type AgendaThemeMode,
  type AgendaUserPreferenceDTO,
  type AgendaVisibility,
} from './types';

const HORIZON_DAYS_FOR_JOBS = 95;
const STALE_LOCK_MS = 5 * 60 * 1000;

export const EVENT_INCLUDE = {
  category: { select: { name: true } },
  participants: true,
  recurrenceExceps: true,
  occurrenceStatuses: true,
  reminders: true,
} as const;

type PrismaEventRow = Prisma.AgendaEventGetPayload<{ include: typeof EVENT_INCLUDE }>;
type PrismaCategoryRow = Prisma.AgendaCategoryGetPayload<Record<string, never>>;
type PrismaJobRow = Prisma.AgendaNotificationJobGetPayload<Record<string, never>>;
type PrismaDeliveryRow = Prisma.AgendaNotificationDeliveryGetPayload<{
  include: { job: { select: { payloadJson: true } } };
}>;
type PrismaPreferenceRow = Prisma.AgendaUserPreferenceGetPayload<Record<string, never>>;
type PrismaAuditLogRow = Prisma.AgendaAuditLogGetPayload<Record<string, never>>;

interface JobPayloadSnapshot {
  eventTitle?: string;
  eventCategoryName?: string;
  eventCategoryIcon?: string;
  eventColor?: string;
  eventPriority?: AgendaPriority;
  eventStartAt?: string;
  eventLocalDate?: string;
  eventLocalTime?: string;
  eventDescription?: string | null;
  eventAllDay?: boolean;
  emailSubject?: string;
}

function buildPrismaIdempotencyKey(params: {
  occurrenceKey: string;
  recipientUserId: string;
  channel: string;
  reminderId: string;
  offsetMinutes: number;
}): string {
  return `${params.occurrenceKey}::${params.recipientUserId}::${params.channel}::${params.reminderId}::${params.offsetMinutes}`;
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseJsonObject<T>(value: Prisma.JsonValue | null | undefined): T | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as unknown as T;
}

function parseAttachments(
  value: Prisma.JsonValue | null | undefined
): AgendaEventDTO['attachments'] {
  if (!Array.isArray(value)) return [];
  return value as unknown as AgendaEventDTO['attachments'];
}

export function mapPrismaCategoryToDTO(row: PrismaCategoryRow): AgendaCategoryDTO {
  return {
    id: row.id,
    tenantId: row.tenantId,
    slug: row.slug,
    name: row.name,
    color: row.color,
    icon: row.icon,
    scope: (row.scope as AgendaCategoryScope) || 'INSTITUCIONAL',
    ownerUserId: row.ownerUserId,
    isSystem: row.isSystem,
    isActive: row.isActive,
  };
}

export function mapPrismaEventToDTO(row: PrismaEventRow): AgendaEventDTO {
  const retention =
    row.retentionClass === 'PESSOAL' ||
    row.retentionClass === 'GOVERNANCA_5_ANOS' ||
    row.retentionClass === 'OPERACIONAL'
      ? row.retentionClass
      : 'OPERACIONAL';

  return {
    id: row.id,
    tenantId: row.tenantId,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? 'Outros',
    title: row.title,
    description: row.description,
    color: row.color,
    icon: row.icon,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    allDay: row.allDay,
    timezone: row.timezone,
    localStartDate: row.localStartDate,
    localStartTime: row.localStartTime,
    localEndDate: row.localEndDate,
    localEndTime: row.localEndTime,
    location: row.location,
    meetingLink: row.meetingLink,
    notes: row.notes,
    priority: row.priority as AgendaPriority,
    status: row.status as AgendaStatus,
    visibility: row.visibility as AgendaVisibility,
    isConfidential: row.isConfidential,
    ownerUserId: row.ownerUserId,
    ownerName: row.ownerName,
    department: row.department,
    recurrenceType: row.recurrenceType as AgendaRecurrenceType,
    recurrenceRule: parseJsonObject<AgendaRecurrenceRule>(row.recurrenceRule),
    rruleText: row.rruleText,
    attachments: parseAttachments(row.attachmentsJson),
    participants: row.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      userName: p.userName,
      userEmail: p.userEmail,
      rsvpStatus: p.rsvpStatus as AgendaRsvpStatus,
      canEdit: p.canEdit,
      respondedAt: p.respondedAt ? p.respondedAt.toISOString() : null,
    })),
    reminders: row.reminders.map((r) => ({
      id: r.id,
      userId: r.userId,
      channel: r.channel as AgendaReminderChannel,
      offsetMinutes: r.offsetMinutes,
      isMandatory: r.isMandatory,
      isActive: r.isActive,
    })),
    exceptions: row.recurrenceExceps.map((ex) => ({
      id: ex.id,
      eventId: ex.eventId,
      occurrenceDate: ex.occurrenceDate,
      scope: ex.scope === 'THIS_AND_FOLLOWING' ? 'THIS_AND_FOLLOWING' : 'SINGLE',
      action: ex.action === 'CANCELLED' ? 'CANCELLED' : 'MODIFIED',
      overrideStart: ex.overrideStart ? ex.overrideStart.toISOString() : null,
      overrideEnd: ex.overrideEnd ? ex.overrideEnd.toISOString() : null,
      overrideTitle: ex.overrideTitle,
      overrideNotes: ex.overrideNotes,
    })),
    occurrenceStatuses: row.occurrenceStatuses.map((st) => ({
      eventId: st.eventId,
      occurrenceDate: st.occurrenceDate,
      status: st.status as AgendaStatus,
      completedBy: st.completedBy,
      completedAt: st.completedAt ? st.completedAt.toISOString() : null,
    })),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    retentionClass: retention,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapPrismaJobToDTO(row: PrismaJobRow): AgendaNotificationJobDTO {
  const payload = parseJsonObject<JobPayloadSnapshot>(row.payloadJson) ?? {};
  const fallbackDate = row.occurrenceKey.split('::')[1] || row.scheduledFor.toISOString().slice(0, 10);

  return {
    id: row.id,
    tenantId: row.tenantId,
    eventId: row.eventId,
    eventTitle: payload.eventTitle || 'Compromisso FIORIX',
    eventCategoryName: payload.eventCategoryName || 'Agenda',
    eventCategoryIcon: payload.eventCategoryIcon || 'Calendar',
    eventColor: payload.eventColor || '#2563EB',
    eventPriority: payload.eventPriority || 'NORMAL',
    eventStartAt: payload.eventStartAt || row.scheduledFor.toISOString(),
    eventLocalDate: payload.eventLocalDate || fallbackDate,
    eventLocalTime: payload.eventLocalTime || '09:00',
    eventDescription: payload.eventDescription ?? null,
    eventAllDay: Boolean(payload.eventAllDay),
    reminderId: row.reminderId,
    recipientUserId: row.recipientUserId,
    occurrenceKey: row.occurrenceKey,
    channel: row.channel as AgendaReminderChannel,
    idempotencyKey: row.idempotencyKey,
    scheduledFor: row.scheduledFor.toISOString(),
    status: row.status as AgendaNotificationJobDTO['status'],
    snoozedUntil: row.snoozedUntil ? row.snoozedUntil.toISOString() : null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapPrismaPreferenceToDTO(row: PrismaPreferenceRow): AgendaUserPreferenceDTO {
  const preferredCategories = Array.isArray(row.preferredCategories)
    ? row.preferredCategories.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    tenantId: row.tenantId,
    userId: row.userId,
    defaultView: (row.defaultView as AgendaCalendarView) || 'MENSAL',
    weekStartsOn: row.weekStartsOn === 1 ? 1 : 0,
    preferredCategories,
    defaultChannel: (row.defaultChannel as AgendaReminderChannel) || 'EMAIL',
    defaultOffsetMinutes: row.defaultOffsetMinutes,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    showCompleted: row.showCompleted,
    webPushEnabled: row.webPushEnabled,
    calendarCompactFormat: row.calendarCompactFormat,
    themeMode: row.themeMode === 'dark' ? 'dark' : 'light',
  };
}

export function mapPrismaAuditLogToDTO(row: PrismaAuditLogRow): AgendaAuditLogDTO {
  return {
    id: row.id,
    tenantId: row.tenantId,
    eventId: row.eventId,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    sha256: row.sha256,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapDeliveryToOutboxDTO(row: PrismaDeliveryRow): AgendaEmailOutboxDTO {
  const payload = parseJsonObject<JobPayloadSnapshot>(row.job?.payloadJson) ?? {};
  const title = payload.eventTitle || 'Compromisso FIORIX';
  const subject = payload.emailSubject || `FIORIX | Lembrete de compromisso — ${title}`;
  const validStatus =
    row.status === 'ACEITA_PROVEDOR' ||
    row.status === 'ENTREGUE_CONFIRMADA' ||
    row.status === 'FALHA' ||
    row.status === 'SANDBOX_SIMULADA'
      ? row.status
      : 'PROCESSADA';

  return {
    id: row.id,
    jobId: row.jobId,
    recipientUserId: row.recipientUserId,
    recipientEmail: row.recipientEmail || '',
    subject,
    bodyHtml: '',
    bodyText: `Lembrete processado para ${payload.eventLocalDate || ''} ${payload.eventLocalTime || ''}`.trim(),
    status: validStatus,
    providerMessageId: row.providerMessageId,
    attempts: row.attempts,
    errorMessage: row.errorMessage,
    processedAt: row.processedAt.toISOString(),
  };
}

export async function ensurePrismaTenantCategories(
  tenantId: string,
  actorUserId: string = 'system'
): Promise<AgendaCategoryDTO[]> {
  const existingSystemCount = await prisma.agendaCategory.count({
    where: { tenantId, isSystem: true },
  });

  if (existingSystemCount === 0) {
    await prisma.agendaCategory.createMany({
      data: DEFAULT_AGENDA_CATEGORIES.map((c) => ({
        tenantId,
        slug: c.slug,
        name: c.name,
        color: c.color,
        icon: c.icon,
        scope: c.scope,
        ownerUserId: null,
        isSystem: true,
        isActive: true,
        createdBy: actorUserId,
      })),
      skipDuplicates: true,
    });
  }

  const rows = await prisma.agendaCategory.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
  return rows.map(mapPrismaCategoryToDTO);
}

export async function upsertPrismaCategory(
  ctx: AgendaAccessContext,
  input: {
    id?: string;
    name: string;
    color: string;
    icon: string;
    scope?: AgendaCategoryScope;
  }
): Promise<AgendaCategoryDTO> {
  const scope: AgendaCategoryScope = input.scope ?? 'PESSOAL';
  const cleanName = input.name.trim();

  if (input.id) {
    const existing = await prisma.agendaCategory.findFirst({
      where: { id: input.id, tenantId: ctx.user.tenantId },
    });
    if (!existing) {
      throw new Error('CATEGORY_NOT_FOUND');
    }
    if (existing.scope === 'PESSOAL' && existing.ownerUserId !== ctx.user.id) {
      throw new Error('CATEGORY_FORBIDDEN');
    }
    const updated = await prisma.agendaCategory.update({
      where: { id: existing.id },
      data: {
        name: cleanName,
        color: input.color,
        icon: input.icon,
      },
    });
    return mapPrismaCategoryToDTO(updated);
  }

  const slug = cleanName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const created = await prisma.agendaCategory.create({
    data: {
      tenantId: ctx.user.tenantId,
      slug: `${slug || 'categoria'}-${Date.now().toString(36)}`,
      name: cleanName,
      color: input.color,
      icon: input.icon,
      scope,
      ownerUserId: scope === 'PESSOAL' ? ctx.user.id : null,
      isSystem: false,
      isActive: true,
      createdBy: ctx.user.id,
    },
  });
  return mapPrismaCategoryToDTO(created);
}

export async function listPrismaTenantEvents(tenantId: string): Promise<AgendaEventDTO[]> {
  const rows = await prisma.agendaEvent.findMany({
    where: { tenantId },
    include: EVENT_INCLUDE,
    orderBy: { startAt: 'asc' },
    take: 1000,
  });
  return rows.map(mapPrismaEventToDTO);
}

export async function getPrismaEventById(
  tenantId: string,
  eventId: string
): Promise<AgendaEventDTO | null> {
  const row = await prisma.agendaEvent.findFirst({
    where: { id: eventId, tenantId },
    include: EVENT_INCLUDE,
  });
  return row ? mapPrismaEventToDTO(row) : null;
}

export async function createPrismaEvent(event: AgendaEventDTO): Promise<AgendaEventDTO> {
  const created = await prisma.agendaEvent.create({
    data: {
      id: event.id,
      tenantId: event.tenantId,
      categoryId: event.categoryId,
      title: event.title,
      description: event.description,
      color: event.color,
      icon: event.icon,
      startAt: new Date(event.startAt),
      endAt: new Date(event.endAt),
      allDay: event.allDay,
      timezone: event.timezone,
      localStartDate: event.localStartDate,
      localStartTime: event.localStartTime,
      localEndDate: event.localEndDate,
      localEndTime: event.localEndTime,
      location: event.location,
      meetingLink: event.meetingLink,
      notes: event.notes,
      priority: event.priority,
      status: event.status,
      visibility: event.visibility,
      isConfidential: event.isConfidential,
      ownerUserId: event.ownerUserId,
      ownerName: event.ownerName,
      department: event.department,
      recurrenceType: event.recurrenceType,
      recurrenceRule: event.recurrenceRule ? toJsonInput(event.recurrenceRule) : Prisma.DbNull,
      rruleText: event.rruleText,
      attachmentsJson: event.attachments.length > 0 ? toJsonInput(event.attachments) : Prisma.DbNull,
      completedAt: event.completedAt ? new Date(event.completedAt) : null,
      cancelledAt: event.cancelledAt ? new Date(event.cancelledAt) : null,
      retentionClass: event.retentionClass,
      createdBy: event.createdBy,
      participants: {
        create: event.participants.map((p) => ({
          id: p.id,
          tenantId: event.tenantId,
          userId: p.userId,
          userName: p.userName,
          userEmail: p.userEmail,
          rsvpStatus: p.rsvpStatus,
          canEdit: p.canEdit,
          respondedAt: p.respondedAt ? new Date(p.respondedAt) : null,
        })),
      },
      reminders: {
        create: event.reminders.map((r) => ({
          id: r.id,
          tenantId: event.tenantId,
          userId: r.userId,
          channel: r.channel,
          offsetMinutes: r.offsetMinutes,
          isMandatory: r.isMandatory,
          isActive: r.isActive,
        })),
      },
    },
    include: EVENT_INCLUDE,
  });

  return mapPrismaEventToDTO(created);
}

export async function upsertPrismaSingleException(
  tenantId: string,
  eventId: string,
  actorUserId: string,
  ex: AgendaRecurrenceExceptionDTO,
  now: Date
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.agendaRecurrenceException.upsert({
      where: {
        eventId_occurrenceDate: {
          eventId,
          occurrenceDate: ex.occurrenceDate,
        },
      },
      create: {
        id: ex.id,
        tenantId,
        eventId,
        occurrenceDate: ex.occurrenceDate,
        scope: ex.scope,
        action: ex.action,
        overrideStart: ex.overrideStart ? new Date(ex.overrideStart) : null,
        overrideEnd: ex.overrideEnd ? new Date(ex.overrideEnd) : null,
        overrideTitle: ex.overrideTitle,
        overrideNotes: ex.overrideNotes,
        createdBy: actorUserId,
      },
      update: {
        scope: ex.scope,
        action: ex.action,
        overrideStart: ex.overrideStart ? new Date(ex.overrideStart) : null,
        overrideEnd: ex.overrideEnd ? new Date(ex.overrideEnd) : null,
        overrideTitle: ex.overrideTitle,
        overrideNotes: ex.overrideNotes,
      },
    });
    await tx.agendaEvent.updateMany({
      where: { id: eventId, tenantId },
      data: { updatedAt: now },
    });
  });
}

export async function updatePrismaEventAll(
  event: AgendaEventDTO,
  opts: { replaceReminders?: boolean; replaceParticipants?: boolean } = {}
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.agendaEvent.updateMany({
      where: { id: event.id, tenantId: event.tenantId },
      data: {
        categoryId: event.categoryId,
        title: event.title,
        description: event.description,
        color: event.color,
        icon: event.icon,
        startAt: new Date(event.startAt),
        endAt: new Date(event.endAt),
        allDay: event.allDay,
        timezone: event.timezone,
        localStartDate: event.localStartDate,
        localStartTime: event.localStartTime,
        localEndDate: event.localEndDate,
        localEndTime: event.localEndTime,
        location: event.location,
        meetingLink: event.meetingLink,
        notes: event.notes,
        priority: event.priority,
        status: event.status,
        visibility: event.visibility,
        isConfidential: event.isConfidential,
        department: event.department,
        recurrenceType: event.recurrenceType,
        recurrenceRule: event.recurrenceRule ? toJsonInput(event.recurrenceRule) : Prisma.DbNull,
        rruleText: event.rruleText,
        completedAt: event.completedAt ? new Date(event.completedAt) : null,
        cancelledAt: event.cancelledAt ? new Date(event.cancelledAt) : null,
        updatedAt: new Date(event.updatedAt),
      },
    });

    if (opts.replaceReminders) {
      await tx.agendaReminder.deleteMany({
        where: { tenantId: event.tenantId, eventId: event.id },
      });
      if (event.reminders.length > 0) {
        await tx.agendaReminder.createMany({
          data: event.reminders.map((r) => ({
            id: r.id,
            tenantId: event.tenantId,
            eventId: event.id,
            userId: r.userId,
            channel: r.channel,
            offsetMinutes: r.offsetMinutes,
            isMandatory: r.isMandatory,
            isActive: r.isActive,
          })),
          skipDuplicates: true,
        });
      }
    }

    if (opts.replaceParticipants) {
      await tx.agendaParticipant.deleteMany({
        where: { tenantId: event.tenantId, eventId: event.id },
      });
      if (event.participants.length > 0) {
        await tx.agendaParticipant.createMany({
          data: event.participants.map((p) => ({
            id: p.id,
            tenantId: event.tenantId,
            eventId: event.id,
            userId: p.userId,
            userName: p.userName,
            userEmail: p.userEmail,
            rsvpStatus: p.rsvpStatus,
            canEdit: p.canEdit,
            respondedAt: p.respondedAt ? new Date(p.respondedAt) : null,
          })),
          skipDuplicates: true,
        });
      }
    }
  });
}

export async function updatePrismaParticipantRsvp(
  tenantId: string,
  participantId: string,
  rsvpStatus: AgendaRsvpStatus,
  respondedAt: Date
): Promise<void> {
  await prisma.agendaParticipant.updateMany({
    where: { id: participantId, tenantId },
    data: { rsvpStatus, respondedAt },
  });
}

export async function upsertPrismaOccurrenceStatus(
  tenantId: string,
  eventId: string,
  occStatus: AgendaOccurrenceStatusDTO
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.agendaOccurrenceStatus.upsert({
      where: {
        eventId_occurrenceDate: {
          eventId,
          occurrenceDate: occStatus.occurrenceDate,
        },
      },
      create: {
        tenantId,
        eventId,
        occurrenceDate: occStatus.occurrenceDate,
        status: occStatus.status,
        completedBy: occStatus.completedBy,
        completedAt: occStatus.completedAt ? new Date(occStatus.completedAt) : null,
      },
      update: {
        status: occStatus.status,
        completedBy: occStatus.completedBy,
        completedAt: occStatus.completedAt ? new Date(occStatus.completedAt) : null,
      },
    });
    await tx.agendaEvent.updateMany({
      where: { id: eventId, tenantId },
      data: { updatedAt: new Date() },
    });
  });
}

export async function updatePrismaEventStatusFields(
  tenantId: string,
  eventId: string,
  data: {
    status: AgendaStatus;
    completedAt?: Date | null;
    cancelledAt?: Date | null;
    updatedAt: Date;
  }
): Promise<void> {
  await prisma.agendaEvent.updateMany({
    where: { id: eventId, tenantId },
    data: {
      status: data.status,
      ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
      ...(data.cancelledAt !== undefined ? { cancelledAt: data.cancelledAt } : {}),
      updatedAt: data.updatedAt,
    },
  });
}

export async function deletePrismaEvent(tenantId: string, eventId: string): Promise<void> {
  await prisma.agendaEvent.deleteMany({
    where: { id: eventId, tenantId },
  });
}

export async function getOrCreatePrismaUserPreferences(
  tenantId: string,
  userId: string
): Promise<AgendaUserPreferenceDTO> {
  const existing = await prisma.agendaUserPreference.findUnique({
    where: {
      tenantId_userId: { tenantId, userId },
    },
  });
  if (existing) {
    return mapPrismaPreferenceToDTO(existing);
  }

  const created = await prisma.agendaUserPreference.upsert({
    where: {
      tenantId_userId: { tenantId, userId },
    },
    create: {
      tenantId,
      userId,
      defaultView: 'MENSAL',
      weekStartsOn: 0,
      preferredCategories: toJsonInput([]),
      defaultChannel: 'EMAIL',
      defaultOffsetMinutes: 30,
      quietHoursStart: null,
      quietHoursEnd: null,
      showCompleted: true,
      webPushEnabled: false,
      calendarCompactFormat: false,
      themeMode: 'light',
    },
    update: {},
  });
  return mapPrismaPreferenceToDTO(created);
}

export async function updatePrismaUserPreferences(
  tenantId: string,
  userId: string,
  patch: Partial<{
    defaultView: AgendaCalendarView;
    weekStartsOn: 0 | 1;
    preferredCategories: string[];
    defaultChannel: AgendaReminderChannel;
    defaultOffsetMinutes: number;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    showCompleted: boolean;
    webPushEnabled: boolean;
    calendarCompactFormat: boolean;
    themeMode: AgendaThemeMode;
  }>
): Promise<AgendaUserPreferenceDTO> {
  const safeOffset =
    typeof patch.defaultOffsetMinutes === 'number'
      ? Math.max(0, Math.min(patch.defaultOffsetMinutes, 525_600))
      : undefined;

  const updated = await prisma.agendaUserPreference.upsert({
    where: {
      tenantId_userId: { tenantId, userId },
    },
    create: {
      tenantId,
      userId,
      defaultView: patch.defaultView ?? 'MENSAL',
      weekStartsOn: patch.weekStartsOn === 1 ? 1 : 0,
      preferredCategories: toJsonInput(patch.preferredCategories ?? []),
      defaultChannel: patch.defaultChannel ?? 'EMAIL',
      defaultOffsetMinutes: safeOffset ?? 30,
      quietHoursStart: patch.quietHoursStart ?? null,
      quietHoursEnd: patch.quietHoursEnd ?? null,
      showCompleted: patch.showCompleted ?? true,
      webPushEnabled: patch.webPushEnabled ?? false,
      calendarCompactFormat: patch.calendarCompactFormat ?? false,
      themeMode: patch.themeMode === 'dark' ? 'dark' : 'light',
    },
    update: {
      ...(patch.defaultView ? { defaultView: patch.defaultView } : {}),
      ...(patch.weekStartsOn === 0 || patch.weekStartsOn === 1
        ? { weekStartsOn: patch.weekStartsOn }
        : {}),
      ...(Array.isArray(patch.preferredCategories)
        ? { preferredCategories: toJsonInput(patch.preferredCategories) }
        : {}),
      ...(patch.defaultChannel ? { defaultChannel: patch.defaultChannel } : {}),
      ...(safeOffset !== undefined ? { defaultOffsetMinutes: safeOffset } : {}),
      ...(patch.quietHoursStart !== undefined ? { quietHoursStart: patch.quietHoursStart } : {}),
      ...(patch.quietHoursEnd !== undefined ? { quietHoursEnd: patch.quietHoursEnd } : {}),
      ...(typeof patch.showCompleted === 'boolean'
        ? { showCompleted: patch.showCompleted }
        : {}),
      ...(typeof patch.webPushEnabled === 'boolean'
        ? { webPushEnabled: patch.webPushEnabled }
        : {}),
      ...(typeof patch.calendarCompactFormat === 'boolean'
        ? { calendarCompactFormat: patch.calendarCompactFormat }
        : {}),
      ...(patch.themeMode === 'light' || patch.themeMode === 'dark'
        ? { themeMode: patch.themeMode }
        : {}),
    },
  });

  return mapPrismaPreferenceToDTO(updated);
}

export async function appendPrismaAuditLog(
  entry: Omit<AgendaAuditLogDTO, 'id' | 'sha256' | 'createdAt'> & {
    metadata?: Record<string, unknown>;
  }
): Promise<AgendaAuditLogDTO> {
  const createdAt = new Date();
  const payloadStr = JSON.stringify({
    tenantId: entry.tenantId,
    eventId: entry.eventId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: entry.summary,
    createdAt: createdAt.toISOString(),
  });
  const sha256 = createHash('sha256').update(payloadStr).digest('hex');

  const row = await prisma.agendaAuditLog.create({
    data: {
      tenantId: entry.tenantId,
      eventId: entry.eventId,
      actorUserId: entry.actorUserId,
      actorName: entry.actorName,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      metadata: entry.metadata ? toJsonInput(entry.metadata) : Prisma.DbNull,
      sha256,
      createdAt,
    },
  });

  return mapPrismaAuditLogToDTO(row);
}

export async function listPrismaAuditLogs(
  tenantId: string,
  userId: string,
  roleUpper: string
): Promise<AgendaAuditLogDTO[]> {
  const canSeeAll = roleUpper === 'MASTER' || roleUpper === 'ADMIN';
  const rows = await prisma.agendaAuditLog.findMany({
    where: {
      tenantId,
      ...(canSeeAll ? {} : { actorUserId: userId }),
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  return rows.map(mapPrismaAuditLogToDTO);
}

export async function syncPrismaNotificationJobsForEvent(params: {
  event: AgendaEventDTO;
  now?: Date;
}): Promise<{ created: number; invalidated: number }> {
  const { event } = params;
  const now = params.now ?? new Date();
  const tz = event.timezone || DEFAULT_AGENDA_TIMEZONE;
  const todayStr = getZonedParts(now, tz).dateStr;
  const horizonEndStr = addDaysToLocalDate(todayStr, HORIZON_DAYS_FOR_JOBS);

  const windowStartUtc = localDateTimeToUtc(addDaysToLocalDate(todayStr, -1), '00:00', tz);
  const windowEndUtc = localDateTimeToUtc(horizonEndStr, '23:59', tz);

  if (
    event.status === 'CANCELADO' ||
    (event.recurrenceType === 'UNICO' && event.status === 'CONCLUIDO')
  ) {
    const res = await prisma.agendaNotificationJob.updateMany({
      where: {
        tenantId: event.tenantId,
        eventId: event.id,
        status: { in: ['PENDENTE', 'DISPONIVEL', 'ADIADO'] },
      },
      data: {
        status: event.status === 'CANCELADO' ? 'CANCELADO' : 'OBSOLETO',
        updatedAt: now,
      },
    });
    return { created: 0, invalidated: res.count };
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

  const existingJobs = await prisma.agendaNotificationJob.findMany({
    where: { tenantId: event.tenantId, eventId: event.id },
  });
  const existingByKey = new Map(existingJobs.map((j) => [j.idempotencyKey, j]));

  const activeParticipantIds = new Set<string>([event.ownerUserId]);
  for (const p of event.participants) {
    if (p.rsvpStatus !== 'RECUSADO') {
      activeParticipantIds.add(p.userId);
    }
  }

  const toCreate: Prisma.AgendaNotificationJobCreateManyInput[] = [];
  const toUpdatePending: Array<{
    id: string;
    scheduledFor: Date;
    payloadJson: Prisma.InputJsonValue;
  }> = [];

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
        const scheduledDate = new Date(scheduledMs);
        const key = buildPrismaIdempotencyKey({
          occurrenceKey: occ.occurrenceKey,
          recipientUserId,
          channel: rem.channel,
          reminderId: rem.id,
          offsetMinutes: rem.offsetMinutes,
        });
        expectedKeys.add(key);

        const payloadSnapshot: JobPayloadSnapshot = {
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
        };

        const existing = existingByKey.get(key);
        if (existing) {
          if (existing.status === 'PENDENTE') {
            toUpdatePending.push({
              id: existing.id,
              scheduledFor: scheduledDate,
              payloadJson: toJsonInput(payloadSnapshot),
            });
          }
          continue;
        }

        if (scheduledMs < now.getTime() - 12 * 60 * 60_000) {
          continue;
        }

        toCreate.push({
          id: randomUUID(),
          tenantId: event.tenantId,
          eventId: event.id,
          reminderId: rem.id,
          recipientUserId,
          occurrenceKey: occ.occurrenceKey,
          channel: rem.channel,
          idempotencyKey: key,
          scheduledFor: scheduledDate,
          status: 'PENDENTE',
          attempts: 0,
          maxAttempts: 4,
          payloadJson: toJsonInput(payloadSnapshot),
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.agendaNotificationJob.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  for (const item of toUpdatePending) {
    await prisma.agendaNotificationJob.update({
      where: { id: item.id },
      data: {
        scheduledFor: item.scheduledFor,
        payloadJson: item.payloadJson,
        updatedAt: now,
      },
    });
  }

  const obsoleteIds: string[] = [];
  for (const job of existingJobs) {
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
      obsoleteIds.push(job.id);
    }
  }

  if (obsoleteIds.length > 0) {
    await prisma.agendaNotificationJob.updateMany({
      where: { id: { in: obsoleteIds }, tenantId: event.tenantId },
      data: { status: 'OBSOLETO', updatedAt: now },
    });
  }

  return { created: toCreate.length, invalidated: obsoleteIds.length };
}

export async function countPrismaScheduledJobsForUser(
  tenantId: string,
  userId: string
): Promise<number> {
  return prisma.agendaNotificationJob.count({
    where: {
      tenantId,
      recipientUserId: userId,
      status: { in: ['PENDENTE', 'DISPONIVEL', 'ADIADO'] },
    },
  });
}

export async function listPrismaNotificationsForUser(
  tenantId: string,
  userId: string,
  now: Date = new Date()
) {
  await prisma.agendaNotificationJob.updateMany({
    where: {
      tenantId,
      recipientUserId: userId,
      channel: 'POPUP',
      OR: [
        { status: 'PENDENTE', scheduledFor: { lte: now } },
        { status: 'ADIADO', snoozedUntil: { lte: now } },
      ],
    },
    data: {
      status: 'DISPONIVEL',
      snoozedUntil: null,
      updatedAt: now,
    },
  });

  const [jobRows, deliveryRows] = await Promise.all([
    prisma.agendaNotificationJob.findMany({
      where: { tenantId, recipientUserId: userId },
      orderBy: { scheduledFor: 'asc' },
      take: 150,
    }),
    prisma.agendaNotificationDelivery.findMany({
      where: { tenantId, recipientUserId: userId, channel: 'EMAIL' },
      include: { job: { select: { payloadJson: true } } },
      orderBy: { processedAt: 'desc' },
      take: 40,
    }),
  ]);

  const userJobs = jobRows.map(mapPrismaJobToDTO);
  const duePopups = userJobs
    .filter((j) => j.channel === 'POPUP' && j.status === 'DISPONIVEL')
    .sort((a, b) => new Date(a.eventStartAt).getTime() - new Date(b.eventStartAt).getTime());

  const unread = userJobs.filter(
    (j) => j.status === 'DISPONIVEL' || (j.status === 'ENVIADO' && !j.readAt)
  );
  const read = userJobs.filter((j) => j.status === 'LIDO' || Boolean(j.readAt));
  const upcoming = userJobs.filter((j) => j.status === 'PENDENTE');
  const snoozed = userJobs.filter((j) => j.status === 'ADIADO');

  return {
    duePopups,
    unreadCount: unread.length,
    unread,
    read,
    upcoming,
    snoozed,
    history: userJobs.slice(0, 80),
    emailOutbox: deliveryRows.map(mapDeliveryToOutboxDTO),
  };
}

export async function actOnPrismaNotification(params: {
  tenantId: string;
  userId: string;
  input: {
    action: 'MARK_READ' | 'MARK_ALL_READ' | 'SNOOZE' | 'DISMISS' | 'CONCLUDE_EVENT';
    jobId?: string;
    snoozeMinutes?: 5 | 15 | 30 | 60;
  };
  now?: Date;
  onConcludeEvent?: (eventId: string, occurrenceDate: string) => Promise<void>;
}) {
  const now = params.now ?? new Date();
  const { tenantId, userId, input } = params;

  if (input.action === 'MARK_ALL_READ') {
    await prisma.agendaNotificationJob.updateMany({
      where: {
        tenantId,
        recipientUserId: userId,
        OR: [
          { status: 'DISPONIVEL' },
          { status: 'ENVIADO', readAt: null },
        ],
      },
      data: {
        status: 'LIDO',
        readAt: now,
        updatedAt: now,
      },
    });
    return { ok: true };
  }

  if (!input.jobId) {
    throw new Error('NOTIFICATION_NOT_FOUND');
  }

  const jobRow = await prisma.agendaNotificationJob.findFirst({
    where: {
      id: input.jobId,
      tenantId,
      recipientUserId: userId,
    },
  });
  if (!jobRow) {
    throw new Error('NOTIFICATION_NOT_FOUND');
  }

  if (input.action === 'MARK_READ' || input.action === 'DISMISS') {
    const updated = await prisma.agendaNotificationJob.update({
      where: { id: jobRow.id },
      data: {
        status: 'LIDO',
        readAt: now,
        updatedAt: now,
      },
    });
    return { ok: true, job: mapPrismaJobToDTO(updated) };
  }

  if (input.action === 'SNOOZE') {
    const mins = input.snoozeMinutes ?? 15;
    const updated = await prisma.agendaNotificationJob.update({
      where: { id: jobRow.id },
      data: {
        status: 'ADIADO',
        snoozedUntil: new Date(now.getTime() + mins * 60_000),
        updatedAt: now,
      },
    });
    return { ok: true, job: mapPrismaJobToDTO(updated) };
  }

  if (input.action === 'CONCLUDE_EVENT') {
    const mapped = mapPrismaJobToDTO(jobRow);
    const [, occDate] = mapped.occurrenceKey.split('::');
    if (params.onConcludeEvent) {
      await params.onConcludeEvent(mapped.eventId, occDate || mapped.eventLocalDate);
    }
    const updated = await prisma.agendaNotificationJob.update({
      where: { id: jobRow.id },
      data: {
        status: 'LIDO',
        readAt: now,
        updatedAt: now,
      },
    });
    return { ok: true, job: mapPrismaJobToDTO(updated) };
  }

  return { ok: true };
}

function isInQuietHours(
  pref: AgendaUserPreferenceDTO | undefined,
  now: Date,
  tz: string
): boolean {
  if (!pref?.quietHoursStart || !pref?.quietHoursEnd) return false;
  const currentHm = getZonedParts(now, tz).timeStr;
  const start = pref.quietHoursStart;
  const end = pref.quietHoursEnd;
  if (start <= end) {
    return currentHm >= start && currentHm <= end;
  }
  return currentHm >= start || currentHm <= end;
}

export async function processDuePrismaNotificationJobs(params: {
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
  const now = params.now ?? new Date();
  const batchSize = Math.min(Math.max(params.batchSize ?? 50, 1), 200);
  const workerId = params.workerId || `worker-${process.pid}`;
  const staleCutoff = new Date(now.getTime() - STALE_LOCK_MS);

  // Recupera eventuais locks antigos travados em PROCESSANDO (> 5 minutos)
  await prisma.agendaNotificationJob.updateMany({
    where: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      status: 'PROCESSANDO',
      lockedAt: { lt: staleCutoff },
    },
    data: {
      status: 'PENDENTE',
      lockedAt: null,
      lockedBy: null,
      updatedAt: now,
    },
  });

  const dueCandidates = await prisma.agendaNotificationJob.findMany({
    where: {
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      OR: [
        { status: 'PENDENTE', scheduledFor: { lte: now } },
        { status: 'ADIADO', snoozedUntil: { lte: now } },
        { status: 'FALHA', scheduledFor: { lte: now } },
      ],
    },
    orderBy: { scheduledFor: 'asc' },
    take: batchSize,
  });

  let processed = 0;
  let deliveredPopup = 0;
  let deliveredEmail = 0;
  let deliveredPush = 0;
  let retried = 0;
  let failedPermanent = 0;
  let skippedQuietHours = 0;

  const eventCache = new Map<string, AgendaEventDTO | null>();
  const prefCache = new Map<string, AgendaUserPreferenceDTO>();
  const userCache = new Map<string, { email: string; name: string | null } | null>();

  for (const rawJob of dueCandidates) {
    if (rawJob.status === 'FALHA' && rawJob.attempts >= rawJob.maxAttempts) {
      continue;
    }

    let event = eventCache.get(rawJob.eventId);
    if (event === undefined) {
      event = await getPrismaEventById(rawJob.tenantId, rawJob.eventId);
      eventCache.set(rawJob.eventId, event);
    }

    if (!event || event.status === 'CANCELADO') {
      await prisma.agendaNotificationJob.updateMany({
        where: { id: rawJob.id, tenantId: rawJob.tenantId },
        data: { status: 'OBSOLETO', updatedAt: now },
      });
      continue;
    }

    const prefKey = `${rawJob.tenantId}:${rawJob.recipientUserId}`;
    let pref = prefCache.get(prefKey);
    if (!pref) {
      pref = await getOrCreatePrismaUserPreferences(rawJob.tenantId, rawJob.recipientUserId);
      prefCache.set(prefKey, pref);
    }

    const isMandatory = event.visibility === 'INSTITUCIONAL' || event.priority === 'CRITICA';
    if (!isMandatory && isInQuietHours(pref, now, event.timezone || DEFAULT_AGENDA_TIMEZONE)) {
      skippedQuietHours += 1;
      continue;
    }

    // Reserva atômica do job
    const claim = await prisma.agendaNotificationJob.updateMany({
      where: {
        id: rawJob.id,
        tenantId: rawJob.tenantId,
        status: rawJob.status,
      },
      data: {
        status: 'PROCESSANDO',
        lockedAt: now,
        lockedBy: workerId,
        attempts: { increment: 1 },
        updatedAt: now,
      },
    });
    if (claim.count === 0) {
      continue;
    }

    const attemptNumber = rawJob.attempts + 1;
    const job = mapPrismaJobToDTO(rawJob);
    processed += 1;

    if (job.channel === 'POPUP') {
      await prisma.agendaNotificationJob.update({
        where: { id: job.id },
        data: {
          status: 'DISPONIVEL',
          snoozedUntil: null,
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        },
      });
      deliveredPopup += 1;
      continue;
    }

    if (job.channel === 'PUSH') {
      try {
        if (pref.webPushEnabled) {
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
      } finally {
        await prisma.agendaNotificationJob.update({
          where: { id: job.id },
          data: {
            status: 'ENVIADO',
            lockedAt: null,
            lockedBy: null,
            updatedAt: now,
          },
        });
        deliveredPush += 1;
      }
      continue;
    }

    // Canal EMAIL
    const participant = event.participants.find((p) => p.userId === job.recipientUserId);
    let userRow = userCache.get(job.recipientUserId);
    if (userRow === undefined) {
      userRow = await prisma.user
        .findUnique({
          where: { id: job.recipientUserId },
          select: { email: true, name: true },
        })
        .catch(() => null);
      userCache.set(job.recipientUserId, userRow);
    }

    const recipientOverride = params.emailOverrideMap?.get(job.recipientUserId);
    const recipientEmail =
      recipientOverride?.email || participant?.userEmail || userRow?.email || '';
    const recipientName =
      recipientOverride?.name ?? participant?.userName ?? userRow?.name ?? event.ownerName;

    if (!recipientEmail) {
      await prisma.agendaNotificationJob.update({
        where: { id: job.id },
        data: {
          status: 'FALHA',
          attempts: rawJob.maxAttempts,
          lastError: 'Destinatário sem e-mail cadastrado.',
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        },
      });
      failedPermanent += 1;
      continue;
    }

    if (params.simulateEmailFailureOnce && attemptNumber === 1) {
      const backoffMinutes = Math.pow(2, attemptNumber) * 5;
      await prisma.agendaNotificationJob.update({
        where: { id: job.id },
        data: {
          status: 'FALHA',
          lastError: 'Falha transitória simulada no provedor SMTP.',
          scheduledFor: new Date(now.getTime() + backoffMinutes * 60_000),
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        },
      });
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

    await prisma.agendaNotificationDelivery.create({
      data: {
        tenantId: event.tenantId,
        jobId: job.id,
        recipientUserId: job.recipientUserId,
        recipientEmail,
        channel: 'EMAIL',
        status: result.status,
        providerMessageId: result.providerMessageId,
        attempts: attemptNumber,
        errorMessage: result.errorMessage,
        processedAt: now,
      },
    });

    if (result.success) {
      await prisma.agendaNotificationJob.update({
        where: { id: job.id },
        data: {
          status: 'ENVIADO',
          lastError: null,
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        },
      });
      deliveredEmail += 1;
    } else if (attemptNumber < rawJob.maxAttempts) {
      const backoffMinutes = Math.pow(2, attemptNumber) * 5;
      await prisma.agendaNotificationJob.update({
        where: { id: job.id },
        data: {
          status: 'FALHA',
          lastError: result.errorMessage,
          scheduledFor: new Date(now.getTime() + backoffMinutes * 60_000),
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        },
      });
      retried += 1;
    } else {
      await prisma.agendaNotificationJob.update({
        where: { id: job.id },
        data: {
          status: 'FALHA',
          lastError: result.errorMessage,
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        },
      });
      failedPermanent += 1;
    }
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

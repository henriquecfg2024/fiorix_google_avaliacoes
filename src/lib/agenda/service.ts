import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import {
  isNavPermissionsFeatureEnabled,
  isRouteAllowedForUser,
} from '@/lib/nav-permissions/service';
import {
  isAgendaEnabled,
  isAgendaSandboxMode,
  isLoginWelcomeEnabled,
} from './feature-flags';
import { syncNotificationJobsForEvent } from './notification-worker';
import {
  AgendaAccessError,
  canUserConcludeEvent,
  canUserCreateVisibility,
  canUserDeleteEvent,
  canUserEditEvent,
  canUserViewEvent,
  type AgendaAccessContext,
} from './permissions';
import {
  actOnPrismaNotification,
  appendPrismaAuditLog,
  countPrismaScheduledJobsForUser,
  createPrismaEvent,
  deletePrismaEvent,
  ensurePrismaTenantCategories,
  getOrCreatePrismaUserPreferences,
  getPrismaEventById,
  listPrismaAuditLogs,
  listPrismaNotificationsForUser,
  listPrismaTenantEvents,
  syncPrismaNotificationJobsForEvent,
  updatePrismaEventAll,
  updatePrismaEventStatusFields,
  updatePrismaParticipantRsvp,
  updatePrismaUserPreferences,
  upsertPrismaCategory,
  upsertPrismaOccurrenceStatus,
  upsertPrismaSingleException,
} from './prisma-store';
import {
  detectScheduleConflicts,
  expandEventOccurrencesInWindow,
  toRruleString,
} from './recurrence';
import {
  appendSandboxAuditLog,
  ensureTenantSandboxData,
  persistAgendaSandboxRoot,
  type AgendaSandboxTenantData,
} from './sandbox-store';
import {
  DEFAULT_AGENDA_TIMEZONE,
  addDaysToLocalDate,
  buildGreetingByTime,
  formatPortugueseLongDate,
  getLocalDayUtcBounds,
  getZonedParts,
  localDateTimeToUtc,
} from './timezone';
import type {
  AgendaAuditLogDTO,
  AgendaCalendarView,
  AgendaCategoryDTO,
  AgendaDashboardIndicators,
  AgendaEventDTO,
  AgendaOccurrenceView,
  AgendaPriority,
  AgendaRecurrenceEditScope,
  AgendaRecurrenceRule,
  AgendaRecurrenceType,
  AgendaReminderChannel,
  AgendaRsvpStatus,
  AgendaStatus,
  AgendaUserPreferenceDTO,
  AgendaVisibility,
  AgendaWelcomeResponse,
  AgendaWelcomeScenario,
} from './types';

function getStore(ctx: Pick<AgendaAccessContext, 'user'>): AgendaSandboxTenantData {
  return ensureTenantSandboxData({
    tenantId: ctx.user.tenantId,
    userId: ctx.user.id,
    userName: ctx.user.name,
    userEmail: ctx.user.email,
    department: ctx.user.departamento ?? null,
  });
}

function getAllVisibleOccurrencesFromEvents(params: {
  events: AgendaEventDTO[];
  ctx: AgendaAccessContext;
  windowStartUtc: Date;
  windowEndUtc: Date;
  now?: Date;
}): AgendaOccurrenceView[] {
  const now = params.now ?? new Date();
  const visibleEvents = params.events.filter((ev) =>
    canUserViewEvent(ev, params.ctx.user)
  );
  const all: AgendaOccurrenceView[] = [];
  for (const ev of visibleEvents) {
    const expanded = expandEventOccurrencesInWindow({
      event: ev,
      windowStartUtc: params.windowStartUtc,
      windowEndUtc: params.windowEndUtc,
      now,
      permissions: {
        canEdit: canUserEditEvent(ev, params.ctx),
        canConclude: canUserConcludeEvent(ev, params.ctx),
        canDelete: canUserDeleteEvent(ev, params.ctx),
      },
    });
    all.push(...expanded);
  }
  all.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return all;
}

export interface AgendaQueryFilter {
  windowStartDate?: string;
  windowEndDate?: string;
  categoryId?: string;
  ownerUserId?: string;
  department?: string;
  priority?: AgendaPriority;
  status?: AgendaStatus | 'ATRASADO';
  recurrenceType?: AgendaRecurrenceType;
  visibility?: AgendaVisibility;
  scopeTab?: 'todos' | 'proprios' | 'compartilhados' | 'institucionais';
  search?: string;
  showCompleted?: boolean;
  quickFilter?:
    | 'hoje'
    | 'amanha'
    | 'proximos7'
    | 'proximos30'
    | 'pendentes'
    | 'atrasados'
    | 'concluidos_mes'
    | 'historico';
}

function applyOccurrenceFilters(
  occurrences: AgendaOccurrenceView[],
  filter: AgendaQueryFilter,
  userId: string,
  todayStr: string
): AgendaOccurrenceView[] {
  return occurrences.filter((occ) => {
    if (filter.showCompleted === false && occ.effectiveStatus === 'CONCLUIDO') {
      return false;
    }
    if (filter.categoryId && occ.categoryId !== filter.categoryId) return false;
    if (filter.ownerUserId && occ.ownerUserId !== filter.ownerUserId) return false;
    if (
      filter.department &&
      (occ.department || '').trim().toLowerCase() !== filter.department.trim().toLowerCase()
    ) {
      return false;
    }
    if (filter.priority && occ.priority !== filter.priority) return false;
    if (filter.status && occ.effectiveStatus !== filter.status) return false;
    if (filter.recurrenceType && occ.recurrenceType !== filter.recurrenceType) return false;
    if (filter.visibility && occ.visibility !== filter.visibility) return false;

    if (filter.scopeTab === 'proprios' && occ.ownerUserId !== userId) return false;
    if (filter.scopeTab === 'compartilhados') {
      const isShared =
        occ.visibility === 'COMPARTILHADO' ||
        occ.visibility === 'SETORIAL' ||
        occ.participants.length > 1;
      if (!isShared) return false;
    }
    if (filter.scopeTab === 'institucionais' && occ.visibility !== 'INSTITUCIONAL') {
      return false;
    }

    if (filter.quickFilter) {
      const tomorrowStr = addDaysToLocalDate(todayStr, 1);
      const next7Str = addDaysToLocalDate(todayStr, 7);
      const next30Str = addDaysToLocalDate(todayStr, 30);
      const monthPrefix = todayStr.slice(0, 7);

      if (filter.quickFilter === 'hoje') {
        if (occ.localStartDate > todayStr || occ.localEndDate < todayStr) return false;
      } else if (filter.quickFilter === 'amanha') {
        if (occ.localStartDate > tomorrowStr || occ.localEndDate < tomorrowStr) return false;
      } else if (filter.quickFilter === 'proximos7') {
        if (occ.localStartDate < todayStr || occ.localStartDate > next7Str) return false;
      } else if (filter.quickFilter === 'proximos30') {
        if (occ.localStartDate < todayStr || occ.localStartDate > next30Str) return false;
      } else if (filter.quickFilter === 'pendentes') {
        if (occ.effectiveStatus === 'CONCLUIDO' || occ.effectiveStatus === 'CANCELADO') {
          return false;
        }
      } else if (filter.quickFilter === 'atrasados') {
        if (!occ.isOverdue) return false;
      } else if (filter.quickFilter === 'concluidos_mes') {
        if (
          occ.effectiveStatus !== 'CONCLUIDO' ||
          !occ.localStartDate.startsWith(monthPrefix)
        ) {
          return false;
        }
      } else if (filter.quickFilter === 'historico') {
        if (
          occ.effectiveStatus !== 'CONCLUIDO' &&
          occ.effectiveStatus !== 'CANCELADO' &&
          occ.localEndDate >= todayStr
        ) {
          return false;
        }
      }
    }

    if (filter.search) {
      const q = filter.search.trim().toLowerCase();
      if (q) {
        const hay = `${occ.title} ${occ.description || ''} ${occ.categoryName} ${occ.location || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
    }

    return true;
  });
}

function assembleAgendaDashboard(params: {
  ctx: AgendaAccessContext;
  filter: AgendaQueryFilter;
  now: Date;
  allEvents: AgendaEventDTO[];
  allCategories: AgendaCategoryDTO[];
  preferences: AgendaUserPreferenceDTO;
  scheduledRemindersCount: number;
  auditLogs: AgendaAuditLogDTO[];
}) {
  const { ctx, filter, now, allEvents, allCategories, preferences, scheduledRemindersCount, auditLogs } =
    params;
  const tz = DEFAULT_AGENDA_TIMEZONE;
  const todayStr = getZonedParts(now, tz).dateStr;
  const tomorrowStr = addDaysToLocalDate(todayStr, 1);
  const next7Str = addDaysToLocalDate(todayStr, 7);
  const next30Str = addDaysToLocalDate(todayStr, 30);
  const monthPrefix = todayStr.slice(0, 7);

  const startWindowDate =
    filter.windowStartDate && filter.windowStartDate < `${todayStr.slice(0, 4)}-01-01`
      ? filter.windowStartDate
      : addDaysToLocalDate(todayStr, -45);
  const endWindowDate =
    filter.windowEndDate && filter.windowEndDate > addDaysToLocalDate(todayStr, 90)
      ? filter.windowEndDate
      : addDaysToLocalDate(todayStr, 365);

  const windowStartUtc = localDateTimeToUtc(startWindowDate, '00:00', tz);
  const windowEndUtc = localDateTimeToUtc(endWindowDate, '23:59', tz);

  const allOccurrences = getAllVisibleOccurrencesFromEvents({
    events: allEvents,
    ctx,
    windowStartUtc,
    windowEndUtc,
    now,
  });

  const activeNonCancelled = allOccurrences.filter(
    (occ) => occ.effectiveStatus !== 'CANCELADO'
  );

  const visibleEvents = allEvents.filter((e) => canUserViewEvent(e, ctx.user));
  const recurrenceSummary = {
    diarias: visibleEvents.filter((e) => e.recurrenceType === 'DIARIO').length,
    semanaisQuinzenais: visibleEvents.filter(
      (e) => e.recurrenceType === 'SEMANAL' || e.recurrenceType === 'QUINZENAL'
    ).length,
    mensais: visibleEvents.filter(
      (e) =>
        e.recurrenceType === 'MENSAL' ||
        e.recurrenceType === 'BIMESTRAL' ||
        e.recurrenceType === 'TRIMESTRAL'
    ).length,
    semestrais: visibleEvents.filter((e) => e.recurrenceType === 'SEMESTRAL').length,
    anuais: visibleEvents.filter((e) => e.recurrenceType === 'ANUAL').length,
    personalizadas: visibleEvents.filter((e) => e.recurrenceType === 'PERSONALIZADO').length,
  };

  const indicators: AgendaDashboardIndicators = {
    hoje: activeNonCancelled.filter(
      (o) => o.localStartDate <= todayStr && o.localEndDate >= todayStr
    ).length,
    amanha: activeNonCancelled.filter(
      (o) => o.localStartDate <= tomorrowStr && o.localEndDate >= tomorrowStr
    ).length,
    proximos7Dias: activeNonCancelled.filter(
      (o) => o.localStartDate >= todayStr && o.localStartDate <= next7Str
    ).length,
    proximos30Dias: activeNonCancelled.filter(
      (o) => o.localStartDate >= todayStr && o.localStartDate <= next30Str
    ).length,
    pendentes: activeNonCancelled.filter((o) => o.effectiveStatus !== 'CONCLUIDO').length,
    atrasados: activeNonCancelled.filter((o) => o.isOverdue).length,
    concluidosMes: activeNonCancelled.filter(
      (o) => o.effectiveStatus === 'CONCLUIDO' && o.localStartDate.startsWith(monthPrefix)
    ).length,
    lembretesProgramados: scheduledRemindersCount,
    recurrenceSummary,
  };

  const filtered = applyOccurrenceFilters(allOccurrences, filter, ctx.user.id, todayStr);
  const rangedFiltered = filtered.filter((occ) => {
    if (filter.windowStartDate && occ.localEndDate < filter.windowStartDate) return false;
    if (filter.windowEndDate && occ.localStartDate > filter.windowEndDate) return false;
    return true;
  });

  const upcoming = activeNonCancelled
    .filter(
      (occ) =>
        occ.effectiveStatus !== 'CONCLUIDO' &&
        (occ.localEndDate >= todayStr || occ.isOverdue)
    )
    .slice(0, 12);

  const categories = allCategories.filter(
    (c) => c.isActive && (c.scope === 'INSTITUCIONAL' || c.ownerUserId === ctx.user.id)
  );

  const scopedAuditLogs = auditLogs
    .filter(
      (log) =>
        log.actorUserId === ctx.user.id ||
        ctx.roleUpper === 'MASTER' ||
        ctx.roleUpper === 'ADMIN'
    )
    .slice(0, 40);

  return {
    indicators,
    occurrences: rangedFiltered,
    upcoming,
    categories,
    preferences,
    auditLogs: scopedAuditLogs,
  };
}

export async function getAgendaDashboardData(
  ctx: AgendaAccessContext,
  filter: AgendaQueryFilter = {},
  now: Date = new Date()
): Promise<{
  indicators: AgendaDashboardIndicators;
  occurrences: AgendaOccurrenceView[];
  upcoming: AgendaOccurrenceView[];
  categories: AgendaCategoryDTO[];
  preferences: AgendaUserPreferenceDTO;
  auditLogs: AgendaAuditLogDTO[];
}> {
  if (isAgendaSandboxMode()) {
    const store = getStore(ctx);
    const scheduledRemindersCount = store.jobs.filter(
      (j) =>
        j.recipientUserId === ctx.user.id &&
        (j.status === 'PENDENTE' || j.status === 'DISPONIVEL' || j.status === 'ADIADO')
    ).length;

    return assembleAgendaDashboard({
      ctx,
      filter,
      now,
      allEvents: store.events,
      allCategories: store.categories,
      preferences: getOrCreateUserPreferences(store, ctx.user.tenantId, ctx.user.id),
      scheduledRemindersCount,
      auditLogs: store.auditLogs,
    });
  }

  const [allCategories, allEvents, preferences, scheduledRemindersCount, auditLogs] =
    await Promise.all([
      ensurePrismaTenantCategories(ctx.user.tenantId, ctx.user.id),
      listPrismaTenantEvents(ctx.user.tenantId),
      getOrCreatePrismaUserPreferences(ctx.user.tenantId, ctx.user.id),
      countPrismaScheduledJobsForUser(ctx.user.tenantId, ctx.user.id),
      listPrismaAuditLogs(ctx.user.tenantId, ctx.user.id, ctx.roleUpper),
    ]);

  return assembleAgendaDashboard({
    ctx,
    filter,
    now,
    allEvents,
    allCategories,
    preferences,
    scheduledRemindersCount,
    auditLogs,
  });
}

export interface CreateAgendaEventInput {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  color?: string | null;
  icon?: string | null;
  localStartDate: string; // YYYY-MM-DD
  localStartTime?: string; // HH:mm
  localEndDate?: string; // YYYY-MM-DD
  localEndTime?: string; // HH:mm
  allDay?: boolean;
  timezone?: string;
  location?: string | null;
  meetingLink?: string | null;
  notes?: string | null;
  priority?: AgendaPriority;
  visibility?: AgendaVisibility;
  isConfidential?: boolean;
  ownerUserId?: string;
  ownerName?: string | null;
  department?: string | null;
  recurrenceType?: AgendaRecurrenceType;
  recurrenceRule?: AgendaRecurrenceRule | null;
  participantIds?: Array<{
    userId: string;
    userName?: string | null;
    userEmail?: string | null;
    canEdit?: boolean;
  }>;
  reminders?: Array<{
    channel: AgendaReminderChannel;
    offsetMinutes: number;
    isMandatory?: boolean;
  }>;
}

export async function createAgendaEvent(
  ctx: AgendaAccessContext,
  input: CreateAgendaEventInput,
  now: Date = new Date()
): Promise<{ event: AgendaEventDTO; conflicts: AgendaOccurrenceView[] }> {
  const visibility: AgendaVisibility = input.visibility ?? 'INDIVIDUAL';
  if (!canUserCreateVisibility(visibility, ctx)) {
    throw new AgendaAccessError(
      `Perfil ${ctx.roleUpper} não tem permissão para criar compromisso com visibilidade ${visibility}.`,
      403
    );
  }

  const title = input.title.trim();
  if (title.length < 2 || title.length > 180) {
    throw new AgendaAccessError('Título do compromisso deve ter entre 2 e 180 caracteres.', 400);
  }

  const tz = input.timezone || DEFAULT_AGENDA_TIMEZONE;
  const allDay = Boolean(input.allDay);
  const localStartDate = input.localStartDate.slice(0, 10);
  const localEndDate = (input.localEndDate || localStartDate).slice(0, 10);
  const localStartTime = allDay ? '00:00' : (input.localStartTime || '09:00').slice(0, 5);
  const localEndTime = allDay ? '23:59' : (input.localEndTime || '10:00').slice(0, 5);

  const startAt = localDateTimeToUtc(localStartDate, localStartTime, tz);
  const endAt = localDateTimeToUtc(localEndDate, localEndTime, tz);
  if (endAt.getTime() < startAt.getTime()) {
    throw new AgendaAccessError(
      'Data/horário final não pode ser anterior ao início do compromisso.',
      400
    );
  }

  const sandboxMode = isAgendaSandboxMode();
  const sandboxStore = sandboxMode ? getStore(ctx) : null;

  const [allCategories, existingEvents] = sandboxStore
    ? [sandboxStore.categories, sandboxStore.events]
    : await Promise.all([
        ensurePrismaTenantCategories(ctx.user.tenantId, ctx.user.id),
        listPrismaTenantEvents(ctx.user.tenantId),
      ]);

  const category =
    allCategories.find((c) => c.id === input.categoryId) ??
    allCategories.find((c) => c.slug === 'outros') ??
    allCategories[0];

  const targetOwnerId =
    input.ownerUserId && ctx.canAssignOrCreateSetorial ? input.ownerUserId : ctx.user.id;
  const targetOwnerName =
    targetOwnerId === ctx.user.id
      ? ctx.user.name || ctx.user.email || 'Colaborador'
      : input.ownerName || 'Colaborador atribuído';

  const recurrenceType: AgendaRecurrenceType = input.recurrenceType ?? 'UNICO';
  const recurrenceRule: AgendaRecurrenceRule | null =
    recurrenceType === 'UNICO'
      ? null
      : input.recurrenceRule ?? {
          frequency: recurrenceType,
          interval: 1,
          monthEndPolicy: 'ULTIMO_DIA',
          businessDayRule: 'NONE',
        };

  const eventId = randomUUID();
  const participants = [
    {
      id: randomUUID(),
      userId: targetOwnerId,
      userName: targetOwnerName,
      userEmail: targetOwnerId === ctx.user.id ? ctx.user.email ?? null : null,
      rsvpStatus: 'CONFIRMADO' as AgendaRsvpStatus,
      canEdit: true,
      respondedAt: now.toISOString(),
    },
    ...(input.participantIds || [])
      .filter((p) => p.userId !== targetOwnerId)
      .map((p) => ({
        id: randomUUID(),
        userId: p.userId,
        userName: p.userName || null,
        userEmail: p.userEmail || null,
        rsvpStatus: 'PENDENTE' as AgendaRsvpStatus,
        canEdit: Boolean(p.canEdit),
        respondedAt: null,
      })),
  ];

  const reminders = (input.reminders || []).map((r) => ({
    id: randomUUID(),
    userId: targetOwnerId,
    channel: r.channel,
    offsetMinutes: Math.max(0, Math.min(r.offsetMinutes, 525_600)),
    isMandatory: Boolean(r.isMandatory) && visibility === 'INSTITUCIONAL',
    isActive: true,
  }));

  const authorizedSameDay = getAllVisibleOccurrencesFromEvents({
    events: existingEvents,
    ctx,
    windowStartUtc: startAt,
    windowEndUtc: endAt,
    now,
  });
  const conflicts = detectScheduleConflicts({
    candidateStartAt: startAt,
    candidateEndAt: endAt,
    authorizedOccurrences: authorizedSameDay,
  });

  const newEvent: AgendaEventDTO = {
    id: eventId,
    tenantId: ctx.user.tenantId,
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? 'Outros',
    title,
    description: input.description?.trim() || null,
    color: input.color || category?.color || '#2563EB',
    icon: input.icon || category?.icon || 'Calendar',
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    allDay,
    timezone: tz,
    localStartDate,
    localStartTime,
    localEndDate,
    localEndTime,
    location: input.location?.trim() || null,
    meetingLink: input.meetingLink?.trim() || null,
    notes: input.notes?.trim() || null,
    priority: input.priority ?? 'NORMAL',
    status: 'AGENDADO',
    visibility,
    isConfidential: Boolean(input.isConfidential),
    ownerUserId: targetOwnerId,
    ownerName: targetOwnerName,
    department: input.department?.trim() || ctx.user.departamento || null,
    recurrenceType,
    recurrenceRule,
    rruleText: toRruleString(recurrenceType, recurrenceRule),
    attachments: [],
    participants,
    reminders,
    exceptions: [],
    occurrenceStatuses: [],
    completedAt: null,
    cancelledAt: null,
    retentionClass:
      visibility === 'INDIVIDUAL'
        ? 'PESSOAL'
        : visibility === 'INSTITUCIONAL'
          ? 'GOVERNANCA_5_ANOS'
          : 'OPERACIONAL',
    createdBy: ctx.user.id,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const auditSummary =
    newEvent.isConfidential || newEvent.visibility === 'INDIVIDUAL'
      ? `Compromisso privado/reservado criado (${newEvent.localStartDate})`
      : `Compromisso "${newEvent.title}" criado para ${newEvent.localStartDate}`;

  if (sandboxStore) {
    sandboxStore.events.push(newEvent);
    syncNotificationJobsForEvent({ store: sandboxStore, event: newEvent, now });

    appendSandboxAuditLog(sandboxStore, {
      tenantId: ctx.user.tenantId,
      eventId: newEvent.id,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name || ctx.user.email || null,
      action: 'CRIACAO_COMPROMISSO',
      entityType: 'AGENDA_EVENT',
      entityId: newEvent.id,
      summary: auditSummary,
    });

    persistAgendaSandboxRoot();
    return { event: newEvent, conflicts };
  }

  const created = await createPrismaEvent(newEvent);
  await syncPrismaNotificationJobsForEvent({ event: created, now });
  await appendPrismaAuditLog({
    tenantId: ctx.user.tenantId,
    eventId: created.id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name || ctx.user.email || null,
    action: 'CRIACAO_COMPROMISSO',
    entityType: 'AGENDA_EVENT',
    entityId: created.id,
    summary: auditSummary,
  });

  return { event: created, conflicts };
}

export async function getAgendaEventById(
  ctx: AgendaAccessContext,
  eventId: string
): Promise<AgendaEventDTO> {
  const found = isAgendaSandboxMode()
    ? getStore(ctx).events.find((e) => e.id === eventId && e.tenantId === ctx.user.tenantId) ?? null
    : await getPrismaEventById(ctx.user.tenantId, eventId);

  if (!found || !canUserViewEvent(found, ctx.user)) {
    throw new AgendaAccessError('Compromisso não encontrado ou acesso não autorizado.', 404);
  }
  return found;
}

export interface UpdateAgendaEventInput {
  scope?: AgendaRecurrenceEditScope;
  occurrenceDate?: string; // obrigatório para SINGLE ou THIS_AND_FOLLOWING em série recorrente
  title?: string;
  description?: string | null;
  categoryId?: string | null;
  color?: string | null;
  icon?: string | null;
  localStartDate?: string;
  localStartTime?: string;
  localEndDate?: string;
  localEndTime?: string;
  allDay?: boolean;
  location?: string | null;
  meetingLink?: string | null;
  notes?: string | null;
  priority?: AgendaPriority;
  visibility?: AgendaVisibility;
  isConfidential?: boolean;
  department?: string | null;
  recurrenceType?: AgendaRecurrenceType;
  recurrenceRule?: AgendaRecurrenceRule | null;
  reminders?: Array<{
    channel: AgendaReminderChannel;
    offsetMinutes: number;
    isMandatory?: boolean;
  }>;
  participantIds?: Array<{
    userId: string;
    userName?: string | null;
    userEmail?: string | null;
    canEdit?: boolean;
  }>;
}

export async function updateAgendaEvent(
  ctx: AgendaAccessContext,
  eventId: string,
  input: UpdateAgendaEventInput,
  now: Date = new Date()
): Promise<{ event: AgendaEventDTO; createdSplitEvent?: AgendaEventDTO }> {
  const sandboxMode = isAgendaSandboxMode();
  const sandboxStore = sandboxMode ? getStore(ctx) : null;
  const existing = await getAgendaEventById(ctx, eventId);

  if (!canUserEditEvent(existing, ctx)) {
    throw new AgendaAccessError('Sem permissão para editar este compromisso.', 403);
  }

  const scope: AgendaRecurrenceEditScope =
    existing.recurrenceType === 'UNICO' ? 'ALL' : input.scope ?? 'ALL';

  if (scope === 'SINGLE' && input.occurrenceDate) {
    const occDate = input.occurrenceDate.slice(0, 10);
    const nextStartDate = (input.localStartDate || occDate).slice(0, 10);
    const nextEndDate = (input.localEndDate || nextStartDate).slice(0, 10);
    const nextStartTime = (input.localStartTime || existing.localStartTime).slice(0, 5);
    const nextEndTime = (input.localEndTime || existing.localEndTime).slice(0, 5);

    const overrideStart = localDateTimeToUtc(nextStartDate, nextStartTime, existing.timezone);
    const overrideEnd = localDateTimeToUtc(nextEndDate, nextEndTime, existing.timezone);
    if (overrideEnd.getTime() < overrideStart.getTime()) {
      throw new AgendaAccessError('Horário final inválido para ocorrência.', 400);
    }

    const idx = existing.exceptions.findIndex((ex) => ex.occurrenceDate === occDate);
    const nextEx = {
      id: idx >= 0 ? existing.exceptions[idx]!.id : randomUUID(),
      eventId: existing.id,
      occurrenceDate: occDate,
      scope: 'SINGLE' as const,
      action: 'MODIFIED' as const,
      overrideStart: overrideStart.toISOString(),
      overrideEnd: overrideEnd.toISOString(),
      overrideTitle: input.title?.trim() || existing.title,
      overrideNotes: input.notes !== undefined ? input.notes : existing.notes,
    };
    if (idx >= 0) existing.exceptions[idx] = nextEx;
    else existing.exceptions.push(nextEx);

    existing.updatedAt = now.toISOString();
    const auditEntry = {
      tenantId: ctx.user.tenantId,
      eventId: existing.id,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name || ctx.user.email || null,
      action: 'EDICAO_OCORRENCIA',
      entityType: 'AGENDA_RECURRENCE_EXCEPTION',
      entityId: nextEx.id,
      summary: `Ocorrência ${occDate} editada sem alterar o restante da série`,
    };

    if (sandboxStore) {
      syncNotificationJobsForEvent({ store: sandboxStore, event: existing, now });
      appendSandboxAuditLog(sandboxStore, auditEntry);
      persistAgendaSandboxRoot();
    } else {
      await upsertPrismaSingleException(
        ctx.user.tenantId,
        existing.id,
        ctx.user.id,
        nextEx,
        now
      );
      await syncPrismaNotificationJobsForEvent({ event: existing, now });
      await appendPrismaAuditLog(auditEntry);
    }
    return { event: existing };
  }

  if (scope === 'THIS_AND_FOLLOWING' && input.occurrenceDate) {
    const occDate = input.occurrenceDate.slice(0, 10);
    const prevCutoff = addDaysToLocalDate(occDate, -1);

    if (existing.recurrenceRule) {
      existing.recurrenceRule = {
        ...existing.recurrenceRule,
        unlimited: false,
        endDate: prevCutoff,
      };
    } else {
      existing.recurrenceRule = {
        frequency: existing.recurrenceType,
        interval: 1,
        endDate: prevCutoff,
      };
    }
    existing.rruleText = toRruleString(existing.recurrenceType, existing.recurrenceRule);
    existing.updatedAt = now.toISOString();

    if (sandboxStore) {
      syncNotificationJobsForEvent({ store: sandboxStore, event: existing, now });
    } else {
      await updatePrismaEventAll(existing, {});
      await syncPrismaNotificationJobsForEvent({ event: existing, now });
    }

    const split = await createAgendaEvent(
      ctx,
      {
        title: input.title ?? existing.title,
        description: input.description !== undefined ? input.description : existing.description,
        categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
        color: input.color ?? existing.color,
        icon: input.icon ?? existing.icon,
        localStartDate: input.localStartDate || occDate,
        localStartTime: input.localStartTime || existing.localStartTime,
        localEndDate: input.localEndDate || input.localStartDate || occDate,
        localEndTime: input.localEndTime || existing.localEndTime,
        allDay: input.allDay ?? existing.allDay,
        timezone: existing.timezone,
        location: input.location !== undefined ? input.location : existing.location,
        meetingLink: input.meetingLink !== undefined ? input.meetingLink : existing.meetingLink,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        priority: input.priority ?? existing.priority,
        visibility: input.visibility ?? existing.visibility,
        isConfidential: input.isConfidential ?? existing.isConfidential,
        department: input.department !== undefined ? input.department : existing.department,
        recurrenceType: input.recurrenceType ?? existing.recurrenceType,
        recurrenceRule:
          input.recurrenceRule !== undefined ? input.recurrenceRule : existing.recurrenceRule,
        reminders: (input.reminders ?? existing.reminders).map((r) => ({
          channel: r.channel,
          offsetMinutes: r.offsetMinutes,
          isMandatory: r.isMandatory,
        })),
      },
      now
    );

    if (sandboxStore) {
      persistAgendaSandboxRoot();
    }
    return { event: existing, createdSplitEvent: split.event };
  }

  if (input.visibility && input.visibility !== existing.visibility) {
    if (!canUserCreateVisibility(input.visibility, ctx)) {
      throw new AgendaAccessError('Sem permissão para alterar visibilidade.', 403);
    }
    existing.visibility = input.visibility;
  }
  if (input.title !== undefined) {
    const cleanTitle = input.title.trim();
    if (cleanTitle.length < 2) {
      throw new AgendaAccessError('Título inválido.', 400);
    }
    existing.title = cleanTitle;
  }
  if (input.description !== undefined) existing.description = input.description?.trim() || null;
  if (input.categoryId !== undefined) {
    const categories = sandboxStore
      ? sandboxStore.categories
      : await ensurePrismaTenantCategories(ctx.user.tenantId, ctx.user.id);
    const cat = categories.find((c) => c.id === input.categoryId);
    if (cat) {
      existing.categoryId = cat.id;
      existing.categoryName = cat.name;
      existing.color = input.color || cat.color;
      existing.icon = input.icon || cat.icon;
    }
  }
  if (input.color) existing.color = input.color;
  if (input.icon) existing.icon = input.icon;
  if (input.location !== undefined) existing.location = input.location?.trim() || null;
  if (input.meetingLink !== undefined) existing.meetingLink = input.meetingLink?.trim() || null;
  if (input.notes !== undefined) existing.notes = input.notes?.trim() || null;
  if (input.priority) existing.priority = input.priority;
  if (input.isConfidential !== undefined) existing.isConfidential = input.isConfidential;
  if (input.department !== undefined) existing.department = input.department?.trim() || null;

  const allDay = input.allDay !== undefined ? input.allDay : existing.allDay;
  const nextStartDate = (input.localStartDate || existing.localStartDate).slice(0, 10);
  const nextEndDate = (input.localEndDate || nextStartDate).slice(0, 10);
  const nextStartTime = allDay ? '00:00' : (input.localStartTime || existing.localStartTime).slice(0, 5);
  const nextEndTime = allDay ? '23:59' : (input.localEndTime || existing.localEndTime).slice(0, 5);

  const startAt = localDateTimeToUtc(nextStartDate, nextStartTime, existing.timezone);
  const endAt = localDateTimeToUtc(nextEndDate, nextEndTime, existing.timezone);
  if (endAt.getTime() < startAt.getTime()) {
    throw new AgendaAccessError('Horário final inválido.', 400);
  }

  existing.allDay = allDay;
  existing.localStartDate = nextStartDate;
  existing.localEndDate = nextEndDate;
  existing.localStartTime = nextStartTime;
  existing.localEndTime = nextEndTime;
  existing.startAt = startAt.toISOString();
  existing.endAt = endAt.toISOString();

  if (input.recurrenceType !== undefined) {
    existing.recurrenceType = input.recurrenceType;
    existing.recurrenceRule =
      input.recurrenceType === 'UNICO' ? null : input.recurrenceRule ?? existing.recurrenceRule;
    existing.rruleText = toRruleString(existing.recurrenceType, existing.recurrenceRule);
  } else if (input.recurrenceRule !== undefined) {
    existing.recurrenceRule = input.recurrenceRule;
    existing.rruleText = toRruleString(existing.recurrenceType, existing.recurrenceRule);
  }

  if (input.reminders !== undefined) {
    existing.reminders = input.reminders.map((r) => ({
      id: randomUUID(),
      userId: existing.ownerUserId,
      channel: r.channel,
      offsetMinutes: Math.max(0, Math.min(r.offsetMinutes, 525_600)),
      isMandatory: Boolean(r.isMandatory) && existing.visibility === 'INSTITUCIONAL',
      isActive: true,
    }));
  }

  if (input.participantIds !== undefined) {
    const existingOwnerPart = existing.participants.find((p) => p.userId === existing.ownerUserId);
    existing.participants = [
      existingOwnerPart ?? {
        id: randomUUID(),
        userId: existing.ownerUserId,
        userName: existing.ownerName,
        userEmail: null,
        rsvpStatus: 'CONFIRMADO',
        canEdit: true,
        respondedAt: now.toISOString(),
      },
      ...input.participantIds
        .filter((p) => p.userId !== existing.ownerUserId)
        .map((p) => ({
          id: randomUUID(),
          userId: p.userId,
          userName: p.userName || null,
          userEmail: p.userEmail || null,
          rsvpStatus: 'PENDENTE' as AgendaRsvpStatus,
          canEdit: Boolean(p.canEdit),
          respondedAt: null,
        })),
    ];
  }

  existing.updatedAt = now.toISOString();
  const auditEntry = {
    tenantId: ctx.user.tenantId,
    eventId: existing.id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name || ctx.user.email || null,
    action: 'EDICAO_COMPROMISSO',
    entityType: 'AGENDA_EVENT',
    entityId: existing.id,
    summary:
      existing.isConfidential || existing.visibility === 'INDIVIDUAL'
        ? `Compromisso privado atualizado`
        : `Compromisso "${existing.title}" atualizado`,
  };

  if (sandboxStore) {
    syncNotificationJobsForEvent({ store: sandboxStore, event: existing, now });
    appendSandboxAuditLog(sandboxStore, auditEntry);
    persistAgendaSandboxRoot();
  } else {
    await updatePrismaEventAll(existing, {
      replaceReminders: input.reminders !== undefined,
      replaceParticipants: input.participantIds !== undefined,
    });
    await syncPrismaNotificationJobsForEvent({ event: existing, now });
    await appendPrismaAuditLog(auditEntry);
  }

  return { event: existing };
}

export async function changeAgendaOccurrenceStatus(
  ctx: AgendaAccessContext,
  eventId: string,
  params: {
    action: 'CONCLUIR' | 'CANCELAR' | 'REAGENDAR' | 'RSVP';
    scope?: AgendaRecurrenceEditScope;
    occurrenceDate?: string;
    rsvpStatus?: AgendaRsvpStatus;
    newLocalStartDate?: string;
    newLocalStartTime?: string;
    newLocalEndDate?: string;
    newLocalEndTime?: string;
  },
  now: Date = new Date()
): Promise<AgendaEventDTO> {
  const sandboxMode = isAgendaSandboxMode();
  const sandboxStore = sandboxMode ? getStore(ctx) : null;
  const existing = await getAgendaEventById(ctx, eventId);

  if (params.action === 'RSVP') {
    if (ctx.isReadOnly) {
      throw new AgendaAccessError('Perfil somente leitura não pode confirmar participação.', 403);
    }
    const part = existing.participants.find((p) => p.userId === ctx.user.id);
    if (!part) {
      throw new AgendaAccessError('Usuário não é participante deste compromisso.', 403);
    }
    part.rsvpStatus = params.rsvpStatus ?? 'CONFIRMADO';
    part.respondedAt = now.toISOString();
    existing.updatedAt = now.toISOString();

    const auditEntry = {
      tenantId: ctx.user.tenantId,
      eventId: existing.id,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name || ctx.user.email || null,
      action: 'ALTERACAO_RSVP',
      entityType: 'AGENDA_PARTICIPANT',
      entityId: part.id,
      summary: `Participação alterada para ${part.rsvpStatus}`,
    };

    if (sandboxStore) {
      syncNotificationJobsForEvent({ store: sandboxStore, event: existing, now });
      appendSandboxAuditLog(sandboxStore, auditEntry);
      persistAgendaSandboxRoot();
    } else {
      await updatePrismaParticipantRsvp(ctx.user.tenantId, part.id, part.rsvpStatus, now);
      await syncPrismaNotificationJobsForEvent({ event: existing, now });
      await appendPrismaAuditLog(auditEntry);
    }
    return existing;
  }

  if (params.action === 'CONCLUIR') {
    if (!canUserConcludeEvent(existing, ctx)) {
      throw new AgendaAccessError('Sem permissão para concluir este compromisso.', 403);
    }
    const scope = existing.recurrenceType === 'UNICO' ? 'ALL' : params.scope ?? 'SINGLE';
    const occDate = (params.occurrenceDate || existing.localStartDate).slice(0, 10);

    if (scope === 'ALL' || existing.recurrenceType === 'UNICO') {
      existing.status = 'CONCLUIDO';
      existing.completedAt = now.toISOString();
      if (!sandboxStore) {
        await updatePrismaEventStatusFields(ctx.user.tenantId, existing.id, {
          status: 'CONCLUIDO',
          completedAt: now,
          updatedAt: now,
        });
      }
    } else {
      const idx = existing.occurrenceStatuses.findIndex((s) => s.occurrenceDate === occDate);
      const nextStatus = {
        eventId: existing.id,
        occurrenceDate: occDate,
        status: 'CONCLUIDO' as const,
        completedBy: ctx.user.id,
        completedAt: now.toISOString(),
      };
      if (idx >= 0) existing.occurrenceStatuses[idx] = nextStatus;
      else existing.occurrenceStatuses.push(nextStatus);
      if (!sandboxStore) {
        await upsertPrismaOccurrenceStatus(ctx.user.tenantId, existing.id, nextStatus);
      }
    }

    existing.updatedAt = now.toISOString();
    const auditEntry = {
      tenantId: ctx.user.tenantId,
      eventId: existing.id,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name || ctx.user.email || null,
      action: 'CONCLUSAO_COMPROMISSO',
      entityType: 'AGENDA_EVENT',
      entityId: existing.id,
      summary: `Compromisso concluído (${occDate})`,
    };

    if (sandboxStore) {
      syncNotificationJobsForEvent({ store: sandboxStore, event: existing, now });
      appendSandboxAuditLog(sandboxStore, auditEntry);
      persistAgendaSandboxRoot();
    } else {
      await syncPrismaNotificationJobsForEvent({ event: existing, now });
      await appendPrismaAuditLog(auditEntry);
    }
    return existing;
  }

  if (!canUserEditEvent(existing, ctx)) {
    throw new AgendaAccessError('Sem permissão para alterar este compromisso.', 403);
  }

  if (params.action === 'CANCELAR') {
    const scope = existing.recurrenceType === 'UNICO' ? 'ALL' : params.scope ?? 'SINGLE';
    const occDate = (params.occurrenceDate || existing.localStartDate).slice(0, 10);

    if (scope === 'ALL' || existing.recurrenceType === 'UNICO') {
      existing.status = 'CANCELADO';
      existing.cancelledAt = now.toISOString();
      if (!sandboxStore) {
        await updatePrismaEventStatusFields(ctx.user.tenantId, existing.id, {
          status: 'CANCELADO',
          cancelledAt: now,
          updatedAt: now,
        });
      }
    } else {
      const idx = existing.exceptions.findIndex((ex) => ex.occurrenceDate === occDate);
      const exObj = {
        id: idx >= 0 ? existing.exceptions[idx]!.id : randomUUID(),
        eventId: existing.id,
        occurrenceDate: occDate,
        scope: (scope === 'THIS_AND_FOLLOWING' ? 'THIS_AND_FOLLOWING' : 'SINGLE') as
          | 'SINGLE'
          | 'THIS_AND_FOLLOWING',
        action: 'CANCELLED' as const,
        overrideStart: null,
        overrideEnd: null,
        overrideTitle: null,
        overrideNotes: null,
      };
      if (idx >= 0) existing.exceptions[idx] = exObj;
      else existing.exceptions.push(exObj);
      if (!sandboxStore) {
        await upsertPrismaSingleException(
          ctx.user.tenantId,
          existing.id,
          ctx.user.id,
          exObj,
          now
        );
      }
    }

    existing.updatedAt = now.toISOString();
    const auditEntry = {
      tenantId: ctx.user.tenantId,
      eventId: existing.id,
      actorUserId: ctx.user.id,
      actorName: ctx.user.name || ctx.user.email || null,
      action: 'CANCELAMENTO_COMPROMISSO',
      entityType: 'AGENDA_EVENT',
      entityId: existing.id,
      summary: `Cancelamento registrado (escopo ${scope})`,
    };

    if (sandboxStore) {
      syncNotificationJobsForEvent({ store: sandboxStore, event: existing, now });
      appendSandboxAuditLog(sandboxStore, auditEntry);
      persistAgendaSandboxRoot();
    } else {
      await syncPrismaNotificationJobsForEvent({ event: existing, now });
      await appendPrismaAuditLog(auditEntry);
    }
    return existing;
  }

  if (!params.newLocalStartDate) {
    throw new AgendaAccessError('Informe a nova data para reagendamento.', 400);
  }
  const result = await updateAgendaEvent(
    ctx,
    eventId,
    {
      scope: params.scope ?? 'SINGLE',
      occurrenceDate: params.occurrenceDate,
      localStartDate: params.newLocalStartDate,
      localStartTime: params.newLocalStartTime ?? existing.localStartTime,
      localEndDate: params.newLocalEndDate ?? params.newLocalStartDate,
      localEndTime: params.newLocalEndTime ?? existing.localEndTime,
    },
    now
  );
  if (result.event.recurrenceType === 'UNICO') {
    result.event.status = 'REAGENDADO';
    if (!sandboxStore) {
      await updatePrismaEventStatusFields(ctx.user.tenantId, result.event.id, {
        status: 'REAGENDADO',
        updatedAt: now,
      });
    }
  }
  if (sandboxStore) {
    persistAgendaSandboxRoot();
  }
  return result.event;
}

export async function deleteAgendaEvent(
  ctx: AgendaAccessContext,
  eventId: string,
  now: Date = new Date()
): Promise<void> {
  const sandboxMode = isAgendaSandboxMode();
  const sandboxStore = sandboxMode ? getStore(ctx) : null;
  const existing = await getAgendaEventById(ctx, eventId);

  if (!canUserDeleteEvent(existing, ctx)) {
    throw new AgendaAccessError(
      'Exclusão não permitida por política de acesso ou retenção.',
      403
    );
  }

  existing.status = 'CANCELADO';
  const auditEntry = {
    tenantId: ctx.user.tenantId,
    eventId: existing.id,
    actorUserId: ctx.user.id,
    actorName: ctx.user.name || ctx.user.email || null,
    action: 'EXCLUSAO_COMPROMISSO',
    entityType: 'AGENDA_EVENT',
    entityId: existing.id,
    summary: `Compromisso removido do calendário`,
  };

  if (sandboxStore) {
    syncNotificationJobsForEvent({ store: sandboxStore, event: existing, now });
    sandboxStore.events = sandboxStore.events.filter((e) => e.id !== eventId);
    appendSandboxAuditLog(sandboxStore, auditEntry);
    persistAgendaSandboxRoot();
    return;
  }

  await syncPrismaNotificationJobsForEvent({ event: existing, now });
  await deletePrismaEvent(ctx.user.tenantId, existing.id);
  await appendPrismaAuditLog(auditEntry);
}

export async function listAgendaCategories(
  ctx: AgendaAccessContext
): Promise<AgendaCategoryDTO[]> {
  const categories = isAgendaSandboxMode()
    ? getStore(ctx).categories
    : await ensurePrismaTenantCategories(ctx.user.tenantId, ctx.user.id);
  return categories.filter(
    (c) => c.isActive && (c.scope === 'INSTITUCIONAL' || c.ownerUserId === ctx.user.id)
  );
}

export async function upsertAgendaCategory(
  ctx: AgendaAccessContext,
  input: {
    id?: string;
    name: string;
    color: string;
    icon: string;
    scope?: 'PESSOAL' | 'INSTITUCIONAL';
  }
): Promise<AgendaCategoryDTO> {
  if (ctx.isReadOnly) {
    throw new AgendaAccessError('Perfil somente leitura não pode editar categorias.', 403);
  }
  const scope = input.scope ?? 'PESSOAL';
  if (scope === 'INSTITUCIONAL' && !ctx.canManageCategories) {
    throw new AgendaAccessError(
      'Somente administradores podem criar ou editar categorias institucionais.',
      403
    );
  }

  const name = input.name.trim();
  if (name.length < 2 || name.length > 60) {
    throw new AgendaAccessError('Nome da categoria deve ter entre 2 e 60 caracteres.', 400);
  }

  if (!isAgendaSandboxMode()) {
    try {
      return await upsertPrismaCategory(ctx, input);
    } catch (err) {
      if (err instanceof Error && err.message === 'CATEGORY_NOT_FOUND') {
        throw new AgendaAccessError('Categoria não encontrada.', 404);
      }
      if (err instanceof Error && err.message === 'CATEGORY_FORBIDDEN') {
        throw new AgendaAccessError('Categoria pessoal pertence a outro usuário.', 403);
      }
      throw err;
    }
  }

  const store = getStore(ctx);
  if (input.id) {
    const cat = store.categories.find((c) => c.id === input.id);
    if (!cat) throw new AgendaAccessError('Categoria não encontrada.', 404);
    if (cat.scope === 'PESSOAL' && cat.ownerUserId !== ctx.user.id) {
      throw new AgendaAccessError('Categoria pessoal pertence a outro usuário.', 403);
    }
    cat.name = name;
    cat.color = input.color;
    cat.icon = input.icon;
    persistAgendaSandboxRoot();
    return cat;
  }

  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const created: AgendaCategoryDTO = {
    id: randomUUID(),
    tenantId: ctx.user.tenantId,
    slug: `${slug || 'categoria'}-${Date.now().toString(36)}`,
    name,
    color: input.color,
    icon: input.icon,
    scope,
    ownerUserId: scope === 'PESSOAL' ? ctx.user.id : null,
    isSystem: false,
    isActive: true,
  };
  store.categories.push(created);
  persistAgendaSandboxRoot();
  return created;
}

export function getOrCreateUserPreferences(
  store: AgendaSandboxTenantData,
  tenantId: string,
  userId: string
): AgendaUserPreferenceDTO {
  let pref = store.preferences.find(
    (p) => p.tenantId === tenantId && p.userId === userId
  );
  if (!pref) {
    pref = {
      tenantId,
      userId,
      defaultView: 'MENSAL',
      weekStartsOn: 0,
      preferredCategories: [],
      defaultChannel: 'EMAIL',
      defaultOffsetMinutes: 30,
      quietHoursStart: null,
      quietHoursEnd: null,
      showCompleted: true,
      webPushEnabled: false,
      calendarCompactFormat: false,
      themeMode: 'light',
    };
    store.preferences.push(pref);
  }
  return pref;
}

export async function updateAgendaUserPreferences(
  ctx: AgendaAccessContext,
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
    themeMode: 'light' | 'dark';
  }>
): Promise<AgendaUserPreferenceDTO> {
  if (ctx.isReadOnly) {
    throw new AgendaAccessError('Perfil somente leitura não altera preferências.', 403);
  }

  if (!isAgendaSandboxMode()) {
    return updatePrismaUserPreferences(ctx.user.tenantId, ctx.user.id, patch);
  }

  const store = getStore(ctx);
  const pref = getOrCreateUserPreferences(store, ctx.user.tenantId, ctx.user.id);

  if (patch.defaultView) pref.defaultView = patch.defaultView;
  if (patch.weekStartsOn === 0 || patch.weekStartsOn === 1) pref.weekStartsOn = patch.weekStartsOn;
  if (Array.isArray(patch.preferredCategories)) pref.preferredCategories = patch.preferredCategories;
  if (patch.defaultChannel) pref.defaultChannel = patch.defaultChannel;
  if (typeof patch.defaultOffsetMinutes === 'number') {
    pref.defaultOffsetMinutes = Math.max(0, Math.min(patch.defaultOffsetMinutes, 525_600));
  }
  if (patch.quietHoursStart !== undefined) pref.quietHoursStart = patch.quietHoursStart;
  if (patch.quietHoursEnd !== undefined) pref.quietHoursEnd = patch.quietHoursEnd;
  if (typeof patch.showCompleted === 'boolean') pref.showCompleted = patch.showCompleted;
  if (typeof patch.webPushEnabled === 'boolean') pref.webPushEnabled = patch.webPushEnabled;
  if (typeof patch.calendarCompactFormat === 'boolean') {
    pref.calendarCompactFormat = patch.calendarCompactFormat;
  }
  if (patch.themeMode === 'light' || patch.themeMode === 'dark') pref.themeMode = patch.themeMode;

  persistAgendaSandboxRoot();
  return pref;
}

export async function listAgendaNotificationsForUser(
  ctx: AgendaAccessContext,
  now: Date = new Date()
) {
  if (!isAgendaSandboxMode()) {
    return listPrismaNotificationsForUser(ctx.user.tenantId, ctx.user.id, now);
  }

  const store = getStore(ctx);
  const userJobs = store.jobs.filter((j) => j.recipientUserId === ctx.user.id);

  const duePopups = userJobs
    .filter((j) => {
      if (j.channel !== 'POPUP') return false;
      if (j.status === 'DISPONIVEL') return true;
      if (j.status === 'PENDENTE' && new Date(j.scheduledFor).getTime() <= now.getTime()) {
        j.status = 'DISPONIVEL';
        return true;
      }
      if (
        j.status === 'ADIADO' &&
        j.snoozedUntil &&
        new Date(j.snoozedUntil).getTime() <= now.getTime()
      ) {
        j.status = 'DISPONIVEL';
        j.snoozedUntil = null;
        return true;
      }
      return false;
    })
    .sort((a, b) => new Date(a.eventStartAt).getTime() - new Date(b.eventStartAt).getTime());

  const unreadCount = userJobs.filter(
    (j) =>
      j.status === 'DISPONIVEL' ||
      (j.status === 'ENVIADO' && !j.readAt)
  ).length;

  const userOutbox = store.emailOutbox.filter((e) => e.recipientUserId === ctx.user.id);

  return {
    duePopups,
    unreadCount,
    unread: userJobs.filter((j) => j.status === 'DISPONIVEL' || (j.status === 'ENVIADO' && !j.readAt)),
    read: userJobs.filter((j) => j.status === 'LIDO' || Boolean(j.readAt)),
    upcoming: userJobs.filter((j) => j.status === 'PENDENTE'),
    snoozed: userJobs.filter((j) => j.status === 'ADIADO'),
    history: userJobs.slice(0, 80),
    emailOutbox: userOutbox.slice(0, 40),
  };
}

export async function actOnAgendaNotification(
  ctx: AgendaAccessContext,
  input: {
    action: 'MARK_READ' | 'MARK_ALL_READ' | 'SNOOZE' | 'DISMISS' | 'CONCLUDE_EVENT';
    jobId?: string;
    snoozeMinutes?: 5 | 15 | 30 | 60;
  },
  now: Date = new Date()
) {
  if (!isAgendaSandboxMode()) {
    try {
      return await actOnPrismaNotification({
        tenantId: ctx.user.tenantId,
        userId: ctx.user.id,
        input,
        now,
        onConcludeEvent: async (evId, occDate) => {
          await changeAgendaOccurrenceStatus(
            ctx,
            evId,
            { action: 'CONCLUIR', scope: 'SINGLE', occurrenceDate: occDate },
            now
          );
        },
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'NOTIFICATION_NOT_FOUND') {
        throw new AgendaAccessError('Notificação não encontrada.', 404);
      }
      throw err;
    }
  }

  const store = getStore(ctx);
  if (input.action === 'MARK_ALL_READ') {
    for (const job of store.jobs) {
      if (
        job.recipientUserId === ctx.user.id &&
        (job.status === 'DISPONIVEL' || (job.status === 'ENVIADO' && !job.readAt))
      ) {
        job.status = 'LIDO';
        job.readAt = now.toISOString();
        job.updatedAt = now.toISOString();
      }
    }
    persistAgendaSandboxRoot();
    return { ok: true };
  }

  const job = store.jobs.find(
    (j) => j.id === input.jobId && j.recipientUserId === ctx.user.id
  );
  if (!job) {
    throw new AgendaAccessError('Notificação não encontrada.', 404);
  }

  if (input.action === 'MARK_READ' || input.action === 'DISMISS') {
    job.status = 'LIDO';
    job.readAt = now.toISOString();
    job.updatedAt = now.toISOString();
    persistAgendaSandboxRoot();
    return { ok: true, job };
  }

  if (input.action === 'SNOOZE') {
    const mins = input.snoozeMinutes ?? 15;
    job.status = 'ADIADO';
    job.snoozedUntil = new Date(now.getTime() + mins * 60_000).toISOString();
    job.updatedAt = now.toISOString();
    persistAgendaSandboxRoot();
    return { ok: true, job };
  }

  if (input.action === 'CONCLUDE_EVENT') {
    const [, occDate] = job.occurrenceKey.split('::');
    await changeAgendaOccurrenceStatus(
      ctx,
      job.eventId,
      {
        action: 'CONCLUIR',
        scope: 'SINGLE',
        occurrenceDate: occDate || job.eventLocalDate,
      },
      now
    );
    job.status = 'LIDO';
    job.readAt = now.toISOString();
    job.updatedAt = now.toISOString();
    persistAgendaSandboxRoot();
    return { ok: true, job };
  }

  return { ok: true };
}

/**
 * Resolve dinamicamente o resumo de Boas-Vindas para o usuário autenticado no evento de login.
 * Executa consulta única otimizada, sem expor agenda quando não autorizado (Cenário G)
 * e sem informar "agenda livre" em caso de erro de consulta (Cenário F).
 */
export async function getWelcomeSummaryForSession(params: {
  user: AuthenticatedUser;
  authAt?: number;
  now?: Date;
  timezone?: string;
  forceQueryFailure?: boolean;
  scenarioPreview?: AgendaWelcomeScenario;
}): Promise<AgendaWelcomeResponse> {
  const now = params.now ?? new Date();
  const tz = params.timezone || DEFAULT_AGENDA_TIMEZONE;
  const greeting = buildGreetingByTime(now, params.user.name, tz);
  const formattedDate = formatPortugueseLongDate(now, tz);
  const loginKey = `${params.user.id}:${params.authAt || 'session'}`;

  if (!isLoginWelcomeEnabled()) {
    return {
      enabled: false,
      loginKey,
      firstName: greeting.firstName,
      greetingTitle: greeting.title,
      timePeriod: greeting.period,
      formattedDate,
      timezone: tz,
      canAccessAgenda: false,
      queryFailed: false,
      scenario: 'G_SEM_PERMISSAO_AGENDA',
      totalTodayScheduled: 0,
      totalTodayCompleted: 0,
      totalTodayPending: 0,
      totalTodayInProgress: 0,
      totalOverdue: 0,
      todayItems: [],
      remainingCount: 0,
    };
  }

  if (params.scenarioPreview) {
    return buildWelcomePreviewResponse({
      scenario: params.scenarioPreview,
      loginKey,
      greeting,
      formattedDate,
      tz,
    });
  }

  const roleUpper = String(params.user.role || 'USER').toUpperCase();
  let canAccessAgenda = isAgendaEnabled();
  if (canAccessAgenda && isNavPermissionsFeatureEnabled() && roleUpper !== 'MASTER') {
    try {
      canAccessAgenda = await isRouteAllowedForUser('/agenda', params.user);
    } catch {
      canAccessAgenda = false;
    }
  }

  if (!canAccessAgenda) {
    return {
      enabled: true,
      loginKey,
      firstName: greeting.firstName,
      greetingTitle: greeting.title,
      timePeriod: greeting.period,
      formattedDate,
      timezone: tz,
      canAccessAgenda: false,
      queryFailed: false,
      scenario: 'G_SEM_PERMISSAO_AGENDA',
      totalTodayScheduled: 0,
      totalTodayCompleted: 0,
      totalTodayPending: 0,
      totalTodayInProgress: 0,
      totalOverdue: 0,
      todayItems: [],
      remainingCount: 0,
    };
  }

  if (params.forceQueryFailure) {
    return {
      enabled: true,
      loginKey,
      firstName: greeting.firstName,
      greetingTitle: greeting.title,
      timePeriod: greeting.period,
      formattedDate,
      timezone: tz,
      canAccessAgenda: true,
      queryFailed: true,
      scenario: 'F_FALHA_CONSULTA',
      totalTodayScheduled: 0,
      totalTodayCompleted: 0,
      totalTodayPending: 0,
      totalTodayInProgress: 0,
      totalOverdue: 0,
      todayItems: [],
      remainingCount: 0,
    };
  }

  try {
    const events = isAgendaSandboxMode()
      ? ensureTenantSandboxData({
          tenantId: params.user.tenantId,
          userId: params.user.id,
          userName: params.user.name,
          userEmail: params.user.email,
          department: params.user.departamento ?? null,
        }).events
      : await listPrismaTenantEvents(params.user.tenantId);

    const todayStr = getZonedParts(now, tz).dateStr;
    const { startUtc: todayStartUtc, endUtc: todayEndUtc } = getLocalDayUtcBounds(todayStr, tz);
    const overdueLookbackUtc = localDateTimeToUtc(addDaysToLocalDate(todayStr, -90), '00:00', tz);

    const fakeCtx: AgendaAccessContext = {
      user: params.user,
      roleUpper,
      canView: true,
      canCreateOwn: roleUpper !== 'VISITANTE',
      canAssignOrCreateSetorial: ['MASTER', 'ADMIN', 'SUBSTITUTO', 'RH'].includes(roleUpper),
      canCreateInstitucional: ['MASTER', 'ADMIN', 'SUBSTITUTO'].includes(roleUpper),
      canManageCategories: ['MASTER', 'ADMIN'].includes(roleUpper),
      canManageModule: roleUpper === 'MASTER',
      isReadOnly: roleUpper === 'VISITANTE',
    };

    const windowOccurrences = getAllVisibleOccurrencesFromEvents({
      events,
      ctx: fakeCtx,
      windowStartUtc: overdueLookbackUtc,
      windowEndUtc: todayEndUtc,
      now,
    }).filter((o) => o.effectiveStatus !== 'CANCELADO');

    const seenToday = new Map<string, AgendaOccurrenceView>();
    const seenOverdue = new Map<string, AgendaOccurrenceView>();

    for (const occ of windowOccurrences) {
      const occStartMs = new Date(occ.startAt).getTime();
      const occEndMs = new Date(occ.endAt).getTime();
      const overlapsToday =
        occEndMs >= todayStartUtc.getTime() && occStartMs < todayEndUtc.getTime();

      if (overlapsToday) {
        seenToday.set(occ.occurrenceKey, occ);
      } else if (occ.isOverdue && occEndMs < todayStartUtc.getTime()) {
        seenOverdue.set(occ.occurrenceKey, occ);
      }
    }

    const todayOccurrences = [...seenToday.values()].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    const totalTodayScheduled = todayOccurrences.length;
    const totalTodayCompleted = todayOccurrences.filter(
      (o) => o.effectiveStatus === 'CONCLUIDO'
    ).length;
    const totalTodayInProgress = todayOccurrences.filter(
      (o) => o.effectiveStatus === 'EM_ANDAMENTO'
    ).length;
    const totalTodayPending = todayOccurrences.filter(
      (o) => o.effectiveStatus !== 'CONCLUIDO'
    ).length;
    const totalOverdue =
      seenOverdue.size +
      todayOccurrences.filter((o) => o.isOverdue).length;

    let scenario: AgendaWelcomeScenario;
    if (totalTodayScheduled === 0 && totalOverdue > 0) {
      scenario = 'E_COM_ATRASADOS';
    } else if (totalTodayScheduled === 0) {
      scenario = 'C_SEM_COMPROMISSOS';
    } else if (totalTodayCompleted === totalTodayScheduled) {
      scenario = 'D_TODOS_CONCLUIDOS';
    } else if (totalTodayScheduled === 1) {
      scenario = 'A_UM_COMPROMISSO';
    } else {
      scenario = 'B_VARIOS_COMPROMISSOS';
    }

    const visibleTodayItems = todayOccurrences.slice(0, 5).map((o) => ({
      occurrenceKey: o.occurrenceKey,
      eventId: o.eventId,
      title: o.title,
      localStartTime: o.localStartTime,
      allDay: o.allDay,
      color: o.color,
      icon: o.icon,
      priority: o.priority,
      status: o.effectiveStatus,
      categoryName: o.categoryName,
    }));

    return {
      enabled: true,
      loginKey,
      firstName: greeting.firstName,
      greetingTitle: greeting.title,
      timePeriod: greeting.period,
      formattedDate,
      timezone: tz,
      canAccessAgenda: true,
      queryFailed: false,
      scenario,
      totalTodayScheduled,
      totalTodayCompleted,
      totalTodayPending,
      totalTodayInProgress,
      totalOverdue,
      todayItems: visibleTodayItems,
      remainingCount: Math.max(0, totalTodayScheduled - visibleTodayItems.length),
    };
  } catch {
    return {
      enabled: true,
      loginKey,
      firstName: greeting.firstName,
      greetingTitle: greeting.title,
      timePeriod: greeting.period,
      formattedDate,
      timezone: tz,
      canAccessAgenda: true,
      queryFailed: true,
      scenario: 'F_FALHA_CONSULTA',
      totalTodayScheduled: 0,
      totalTodayCompleted: 0,
      totalTodayPending: 0,
      totalTodayInProgress: 0,
      totalOverdue: 0,
      todayItems: [],
      remainingCount: 0,
    };
  }
}

function buildWelcomePreviewResponse(params: {
  scenario: AgendaWelcomeScenario;
  loginKey: string;
  greeting: { period: 'MANHA' | 'TARDE' | 'NOITE'; title: string; firstName: string | null };
  formattedDate: string;
  tz: string;
}): AgendaWelcomeResponse {
  const { scenario, loginKey, greeting, formattedDate, tz } = params;
  const base = {
    enabled: true,
    loginKey,
    firstName: greeting.firstName,
    greetingTitle: greeting.title,
    timePeriod: greeting.period,
    formattedDate,
    timezone: tz,
    canAccessAgenda: scenario !== 'G_SEM_PERMISSAO_AGENDA',
    queryFailed: scenario === 'F_FALHA_CONSULTA',
    scenario,
  };

  if (scenario === 'A_UM_COMPROMISSO') {
    return {
      ...base,
      totalTodayScheduled: 1,
      totalTodayCompleted: 0,
      totalTodayPending: 1,
      totalTodayInProgress: 0,
      totalOverdue: 0,
      todayItems: [
        {
          occurrenceKey: 'prev-1',
          eventId: 'prev-1',
          title: 'Reunião de TI',
          localStartTime: '09:00',
          allDay: false,
          color: '#7C3AED',
          icon: 'Cpu',
          priority: 'ALTA',
          status: 'AGENDADO',
          categoryName: 'Tecnologia da Informação',
        },
      ],
      remainingCount: 0,
    };
  }
  if (scenario === 'B_VARIOS_COMPROMISSOS' || scenario === 'E_COM_ATRASADOS') {
    return {
      ...base,
      totalTodayScheduled: 3,
      totalTodayCompleted: 0,
      totalTodayPending: 3,
      totalTodayInProgress: 0,
      totalOverdue: scenario === 'E_COM_ATRASADOS' ? 2 : 0,
      todayItems: [
        {
          occurrenceKey: 'prev-1',
          eventId: 'prev-1',
          title: 'Reunião de TI',
          localStartTime: '09:00',
          allDay: false,
          color: '#7C3AED',
          icon: 'Cpu',
          priority: 'ALTA',
          status: 'AGENDADO',
          categoryName: 'Tecnologia da Informação',
        },
        {
          occurrenceKey: 'prev-2',
          eventId: 'prev-2',
          title: 'Alinhamento — Gestão de Prazos',
          localStartTime: '14:00',
          allDay: false,
          color: '#2563EB',
          icon: 'Users',
          priority: 'NORMAL',
          status: 'AGENDADO',
          categoryName: 'Reuniões',
        },
        {
          occurrenceKey: 'prev-3',
          eventId: 'prev-3',
          title: 'Revisão de Sistemas',
          localStartTime: '17:00',
          allDay: false,
          color: '#DC2626',
          icon: 'ShieldAlert',
          priority: 'CRITICA',
          status: 'AGENDADO',
          categoryName: 'Segurança da Informação',
        },
      ],
      remainingCount: 0,
    };
  }
  if (scenario === 'D_TODOS_CONCLUIDOS') {
    return {
      ...base,
      totalTodayScheduled: 3,
      totalTodayCompleted: 3,
      totalTodayPending: 0,
      totalTodayInProgress: 0,
      totalOverdue: 0,
      todayItems: [],
      remainingCount: 0,
    };
  }
  return {
    ...base,
    totalTodayScheduled: 0,
    totalTodayCompleted: 0,
    totalTodayPending: 0,
    totalTodayInProgress: 0,
    totalOverdue: 0,
    todayItems: [],
    remainingCount: 0,
  };
}

/** Garante referência ao client Prisma tipado para checagem de prontidão em produção. */
export async function checkAgendaDatabaseReady(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1 FROM public.agenda_events LIMIT 0');
    return true;
  } catch {
    return false;
  }
}

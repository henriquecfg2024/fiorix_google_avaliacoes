import {
  DEFAULT_AGENDA_TIMEZONE,
  addDaysToLocalDate,
  computeEffectiveStatusAndOverdue,
  diffLocalDays,
  getZonedParts,
  localDateTimeToUtc,
} from './timezone';
import type {
  AgendaEventDTO,
  AgendaMonthEndPolicy,
  AgendaOccurrenceView,
  AgendaRecurrenceRule,
  AgendaRecurrenceType,
  AgendaStatus,
} from './types';

export const MAX_RECURRENCE_OCCURRENCES_EXPANDED = 400;

/** Feriados nacionais e da capital (SP) configuráveis para cálculo de dias úteis. */
export const DEFAULT_BR_SP_HOLIDAYS: ReadonlySet<string> = new Set([
  '2025-01-01', '2025-01-25', '2025-04-18', '2025-04-21', '2025-05-01', '2025-06-19',
  '2025-07-09', '2025-09-07', '2025-10-12', '2025-11-02', '2025-11-15', '2025-11-20', '2025-12-25',
  '2026-01-01', '2026-01-25', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04',
  '2026-07-09', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-15', '2026-11-20', '2026-12-25',
  '2027-01-01', '2027-01-25', '2027-03-26', '2027-04-21', '2027-05-01', '2027-05-27',
  '2027-07-09', '2027-09-07', '2027-10-12', '2027-11-02', '2027-11-15', '2027-11-20', '2027-12-25',
]);

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function formatDateYmd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getWeekdayOfLocalDate(localDate: string): number {
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isBusinessDay(
  localDate: string,
  holidays: ReadonlySet<string> = DEFAULT_BR_SP_HOLIDAYS
): boolean {
  const wd = getWeekdayOfLocalDate(localDate);
  if (wd === 0 || wd === 6) return false;
  return !holidays.has(localDate);
}

export function resolveFirstBusinessDayOfMonth(
  year: number,
  month: number,
  holidays: ReadonlySet<string> = DEFAULT_BR_SP_HOLIDAYS
): string {
  const maxDays = getDaysInMonth(year, month);
  for (let day = 1; day <= maxDays; day += 1) {
    const candidate = formatDateYmd(year, month, day);
    if (isBusinessDay(candidate, holidays)) return candidate;
  }
  return formatDateYmd(year, month, 1);
}

export function resolveLastBusinessDayOfMonth(
  year: number,
  month: number,
  holidays: ReadonlySet<string> = DEFAULT_BR_SP_HOLIDAYS
): string {
  const maxDays = getDaysInMonth(year, month);
  for (let day = maxDays; day >= 1; day -= 1) {
    const candidate = formatDateYmd(year, month, day);
    if (isBusinessDay(candidate, holidays)) return candidate;
  }
  return formatDateYmd(year, month, maxDays);
}

/** Resolve um dia específico no mês respeitando ano bissexto e política para dia inexistente (ex.: 31). */
export function resolveDayInMonth(
  year: number,
  month: number,
  targetDay: number,
  policy: AgendaMonthEndPolicy = 'ULTIMO_DIA'
): string | null {
  const daysInMonth = getDaysInMonth(year, month);
  if (targetDay <= daysInMonth) {
    return formatDateYmd(year, month, targetDay);
  }
  if (policy === 'IGNORAR_MES') {
    return null;
  }
  return formatDateYmd(year, month, daysInMonth);
}

function getMonthStepForType(
  frequency: AgendaRecurrenceType,
  rule?: AgendaRecurrenceRule | null
): number | null {
  const interval = Math.max(1, rule?.interval ?? 1);
  if (frequency === 'MENSAL') return interval;
  if (frequency === 'BIMESTRAL') return 2 * interval;
  if (frequency === 'TRIMESTRAL') return 3 * interval;
  if (frequency === 'SEMESTRAL') return 6 * interval;
  if (frequency === 'ANUAL') return 12 * interval;
  if (frequency === 'PERSONALIZADO' && rule?.customUnit === 'MESES') return interval;
  if (frequency === 'PERSONALIZADO' && rule?.customUnit === 'ANOS') return 12 * interval;
  return null;
}

/** Gera expressão compatível com RFC 5545 RRULE para rastreabilidade e interoperabilidade. */
export function toRruleString(
  type: AgendaRecurrenceType,
  rule?: AgendaRecurrenceRule | null
): string | null {
  if (type === 'UNICO') return null;
  const interval = Math.max(1, rule?.interval ?? 1);
  const byDayTokens = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const parts: string[] = [];

  if (type === 'DIARIO' || (type === 'PERSONALIZADO' && rule?.customUnit === 'DIAS')) {
    parts.push('FREQ=DAILY', `INTERVAL=${interval}`);
  } else if (type === 'SEMANAL' || (type === 'PERSONALIZADO' && rule?.customUnit === 'SEMANAS')) {
    parts.push('FREQ=WEEKLY', `INTERVAL=${interval}`);
    if (rule?.weekdays?.length) {
      parts.push(`BYDAY=${rule.weekdays.map((d) => byDayTokens[d]).filter(Boolean).join(',')}`);
    }
  } else if (type === 'QUINZENAL') {
    parts.push('FREQ=WEEKLY', `INTERVAL=${2 * interval}`);
    if (rule?.weekdays?.length) {
      parts.push(`BYDAY=${rule.weekdays.map((d) => byDayTokens[d]).filter(Boolean).join(',')}`);
    }
  } else {
    const monthStep = getMonthStepForType(type, rule);
    if (monthStep === 12) {
      parts.push('FREQ=YEARLY', `INTERVAL=${interval}`);
    } else {
      parts.push('FREQ=MONTHLY', `INTERVAL=${monthStep ?? interval}`);
    }
    if (rule?.monthDay) parts.push(`BYMONTHDAY=${rule.monthDay}`);
  }

  if (rule?.maxOccurrences && rule.maxOccurrences > 0) {
    parts.push(`COUNT=${rule.maxOccurrences}`);
  } else if (rule?.endDate) {
    parts.push(`UNTIL=${rule.endDate.replace(/-/g, '')}`);
  }

  return parts.join(';');
}

function buildHolidaySet(rule?: AgendaRecurrenceRule | null): ReadonlySet<string> {
  if (!rule?.holidayDates?.length) return DEFAULT_BR_SP_HOLIDAYS;
  const merged = new Set(DEFAULT_BR_SP_HOLIDAYS);
  for (const h of rule.holidayDates) merged.add(h);
  return merged;
}

/**
 * Gera datas locais (`YYYY-MM-DD`) das ocorrências dentro da janela solicitada `[windowStartDate, windowEndDate]`.
 * Usa expansão limitada por período para proteger memória e CPU (nunca gera milhares de registros).
 */
export function generateRecurrenceDatesInWindow(params: {
  startDate: string; // YYYY-MM-DD
  endDateOfEvent: string; // YYYY-MM-DD (para multi-dia / meia-noite)
  recurrenceType: AgendaRecurrenceType;
  recurrenceRule?: AgendaRecurrenceRule | null;
  windowStartDate: string;
  windowEndDate: string;
  maxLimit?: number;
}): string[] {
  const {
    startDate,
    endDateOfEvent,
    recurrenceType,
    recurrenceRule,
    windowStartDate,
    windowEndDate,
    maxLimit = MAX_RECURRENCE_OCCURRENCES_EXPANDED,
  } = params;

  const eventDurationDays = Math.max(0, diffLocalDays(startDate, endDateOfEvent));
  const overlapsWindow = (occStartDate: string) => {
    const occEndDate = addDaysToLocalDate(occStartDate, eventDurationDays);
    return occEndDate >= windowStartDate && occStartDate <= windowEndDate;
  };

  if (recurrenceType === 'UNICO') {
    return overlapsWindow(startDate) ? [startDate] : [];
  }

  const rule: AgendaRecurrenceRule = recurrenceRule ?? {
    frequency: recurrenceType,
    interval: 1,
    monthEndPolicy: 'ULTIMO_DIA',
    businessDayRule: 'NONE',
  };
  const interval = Math.max(1, rule.interval || 1);
  const hardEndDate =
    !rule.unlimited && rule.endDate && rule.endDate < windowEndDate
      ? rule.endDate
      : windowEndDate;
  const maxOccurrences =
    !rule.unlimited && rule.maxOccurrences && rule.maxOccurrences > 0
      ? rule.maxOccurrences
      : Number.POSITIVE_INFINITY;

  const results: string[] = [];
  let producedCount = 0;

  // 1) Diária
  if (
    recurrenceType === 'DIARIO' ||
    (recurrenceType === 'PERSONALIZADO' && rule.customUnit === 'DIAS')
  ) {
    let cursor = startDate;
    let guard = 0;
    while (cursor <= hardEndDate && producedCount < maxOccurrences && guard < 4000) {
      guard += 1;
      producedCount += 1;
      if (overlapsWindow(cursor)) {
        results.push(cursor);
        if (results.length >= maxLimit) break;
      }
      cursor = addDaysToLocalDate(cursor, interval);
    }
    return results;
  }

  // 2) Semanal / Quinzenal
  if (
    recurrenceType === 'SEMANAL' ||
    recurrenceType === 'QUINZENAL' ||
    (recurrenceType === 'PERSONALIZADO' && rule.customUnit === 'SEMANAS')
  ) {
    const weekStep = recurrenceType === 'QUINZENAL' ? 2 * interval : interval;
    const baseWeekday = getWeekdayOfLocalDate(startDate);
    const weekdays =
      rule.weekdays && rule.weekdays.length > 0
        ? [...new Set(rule.weekdays)].sort((a, b) => a - b)
        : [baseWeekday];

    const startOfWeek0 = addDaysToLocalDate(startDate, -baseWeekday);
    let weekIndex = 0;
    let guard = 0;

    while (producedCount < maxOccurrences && guard < 1500) {
      guard += 1;
      const weekMondayBase = addDaysToLocalDate(startOfWeek0, weekIndex * 7);
      if (weekMondayBase > hardEndDate) break;

      for (const wd of weekdays) {
        const candidate = addDaysToLocalDate(weekMondayBase, wd);
        if (candidate < startDate) continue;
        if (candidate > hardEndDate) break;

        producedCount += 1;
        if (overlapsWindow(candidate)) {
          results.push(candidate);
          if (results.length >= maxLimit) return results;
        }
        if (producedCount >= maxOccurrences) return results;
      }
      weekIndex += weekStep;
    }
    return results;
  }

  // 3) Mensal / Bimestral / Trimestral / Semestral / Anual / Personalizado em meses/anos
  const monthStep = getMonthStepForType(recurrenceType, rule) ?? 1;
  const holidays = buildHolidaySet(rule);
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const targetDay = rule.monthDay && rule.monthDay >= 1 && rule.monthDay <= 31 ? rule.monthDay : startDay;
  const policy: AgendaMonthEndPolicy = rule.monthEndPolicy ?? 'ULTIMO_DIA';
  const bdayRule = rule.businessDayRule ?? 'NONE';

  let monthOffset = 0;
  let guard = 0;

  while (producedCount < maxOccurrences && guard < 1200) {
    guard += 1;
    const totalMonths = startYear * 12 + (startMonth - 1) + monthOffset;
    const curYear = Math.floor(totalMonths / 12);
    const curMonth = (totalMonths % 12) + 1;

    let candidate: string | null = null;
    if (bdayRule === 'FIRST_BUSINESS_DAY') {
      candidate = resolveFirstBusinessDayOfMonth(curYear, curMonth, holidays);
    } else if (bdayRule === 'LAST_BUSINESS_DAY') {
      candidate = resolveLastBusinessDayOfMonth(curYear, curMonth, holidays);
    } else if (curMonth === 2 && startMonth === 2 && startDay === 29 && monthStep === 12) {
      // Aniversário em 29 de fevereiro em recorrência anual
      candidate = resolveDayInMonth(curYear, 2, 29, policy);
    } else {
      candidate = resolveDayInMonth(curYear, curMonth, targetDay, policy);
    }

    if (candidate) {
      if (candidate > hardEndDate) break;
      if (candidate >= startDate) {
        producedCount += 1;
        if (overlapsWindow(candidate)) {
          results.push(candidate);
          if (results.length >= maxLimit) break;
        }
      }
    } else {
      const firstOfMonth = formatDateYmd(curYear, curMonth, 1);
      if (firstOfMonth > hardEndDate) break;
    }

    monthOffset += monthStep;
  }

  return results;
}

/** Expande um evento e suas exceções/status por ocorrência dentro de uma janela UTC. */
export function expandEventOccurrencesInWindow(params: {
  event: AgendaEventDTO;
  windowStartUtc: Date;
  windowEndUtc: Date;
  now?: Date;
  permissions: { canEdit: boolean; canConclude: boolean; canDelete: boolean };
}): AgendaOccurrenceView[] {
  const { event, windowStartUtc, windowEndUtc, permissions } = params;
  const now = params.now ?? new Date();
  const tz = event.timezone || DEFAULT_AGENDA_TIMEZONE;

  const windowStartDate = getZonedParts(windowStartUtc, tz).dateStr;
  const windowEndDate = getZonedParts(windowEndUtc, tz).dateStr;

  const baseDurationMs = Math.max(
    60_000,
    new Date(event.endAt).getTime() - new Date(event.startAt).getTime()
  );

  const exceptionByDate = new Map(event.exceptions.map((ex) => [ex.occurrenceDate, ex]));
  const statusByDate = new Map(event.occurrenceStatuses.map((st) => [st.occurrenceDate, st]));

  // Encontra eventual corte "THIS_AND_FOLLOWING" de cancelamento
  const cancelledFromDate = event.exceptions
    .filter((ex) => ex.scope === 'THIS_AND_FOLLOWING' && ex.action === 'CANCELLED')
    .map((ex) => ex.occurrenceDate)
    .sort()[0];

  const dates = generateRecurrenceDatesInWindow({
    startDate: event.localStartDate,
    endDateOfEvent: event.localEndDate,
    recurrenceType: event.recurrenceType,
    recurrenceRule: event.recurrenceRule,
    windowStartDate: addDaysToLocalDate(windowStartDate, -1), // margem de segurança de fuso
    windowEndDate: addDaysToLocalDate(windowEndDate, 1),
  });

  const views: AgendaOccurrenceView[] = [];

  for (const occDate of dates) {
    if (cancelledFromDate && occDate >= cancelledFromDate) continue;

    const ex = exceptionByDate.get(occDate);
    if (ex?.action === 'CANCELLED') continue;

    let occStartUtc: Date;
    let occEndUtc: Date;
    if (ex?.overrideStart && ex?.overrideEnd) {
      occStartUtc = new Date(ex.overrideStart);
      occEndUtc = new Date(ex.overrideEnd);
    } else if (event.allDay) {
      occStartUtc = localDateTimeToUtc(occDate, '00:00', tz);
      const daySpan = Math.max(0, diffLocalDays(event.localStartDate, event.localEndDate));
      const endLocal = addDaysToLocalDate(occDate, daySpan);
      occEndUtc = localDateTimeToUtc(endLocal, '23:59', tz);
    } else {
      occStartUtc = localDateTimeToUtc(occDate, event.localStartTime, tz);
      occEndUtc = new Date(occStartUtc.getTime() + baseDurationMs);
    }

    if (
      occEndUtc.getTime() < windowStartUtc.getTime() ||
      occStartUtc.getTime() > windowEndUtc.getTime()
    ) {
      continue;
    }

    const startParts = getZonedParts(occStartUtc, tz);
    const endParts = getZonedParts(occEndUtc, tz);
    const occStatusOverride = statusByDate.get(occDate);
    const baseStatus: AgendaStatus =
      occStatusOverride?.status ??
      (event.recurrenceType === 'UNICO' ? event.status : 'AGENDADO');

    const { effectiveStatus, isOverdue } = computeEffectiveStatusAndOverdue({
      baseStatus,
      startAt: occStartUtc,
      endAt: occEndUtc,
      now,
    });

    views.push({
      occurrenceKey: `${event.id}::${occDate}`,
      eventId: event.id,
      occurrenceDate: occDate,
      isRecurringInstance: event.recurrenceType !== 'UNICO',
      title: ex?.overrideTitle || event.title,
      description: event.description,
      categoryId: event.categoryId,
      categoryName: event.categoryName,
      color: event.color,
      icon: event.icon,
      startAt: occStartUtc.toISOString(),
      endAt: occEndUtc.toISOString(),
      localStartDate: startParts.dateStr,
      localStartTime: event.allDay ? '00:00' : startParts.timeStr,
      localEndDate: endParts.dateStr,
      localEndTime: event.allDay ? '23:59' : endParts.timeStr,
      allDay: event.allDay,
      timezone: tz,
      location: event.location,
      meetingLink: event.meetingLink,
      notes: ex?.overrideNotes ?? event.notes,
      priority: event.priority,
      effectiveStatus,
      isOverdue,
      visibility: event.visibility,
      isConfidential: event.isConfidential,
      ownerUserId: event.ownerUserId,
      ownerName: event.ownerName,
      department: event.department,
      recurrenceType: event.recurrenceType,
      participants: event.participants,
      reminders: event.reminders,
      canEdit: permissions.canEdit,
      canConclude: permissions.canConclude,
      canDelete: permissions.canDelete,
    });
  }

  return views;
}

/** Detecta conflitos de horário entre um compromisso candidato e ocorrências visíveis ao usuário. */
export function detectScheduleConflicts(params: {
  candidateStartAt: Date;
  candidateEndAt: Date;
  excludeEventId?: string;
  authorizedOccurrences: AgendaOccurrenceView[];
}): AgendaOccurrenceView[] {
  const startMs = params.candidateStartAt.getTime();
  const endMs = params.candidateEndAt.getTime();
  return params.authorizedOccurrences.filter((occ) => {
    if (params.excludeEventId && occ.eventId === params.excludeEventId) return false;
    if (occ.effectiveStatus === 'CANCELADO') return false;
    const oStart = new Date(occ.startAt).getTime();
    const oEnd = new Date(occ.endAt).getTime();
    return oStart < endMs && oEnd > startMs;
  });
}

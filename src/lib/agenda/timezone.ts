import type { AgendaOccurrenceView, AgendaStatus } from './types';

export const DEFAULT_AGENDA_TIMEZONE = 'America/Sao_Paulo';

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=Dom..6=Sáb
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
}

const WEEKDAY_EN_TO_NUM: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const WEEKDAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Extrai partes locais exatas no fuso informado usando Intl.DateTimeFormat. */
export function getZonedParts(
  date: Date = new Date(),
  timeZone: string = DEFAULT_AGENDA_TIMEZONE
): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }

  const year = Number(map.year || date.getUTCFullYear());
  const month = Number(map.month || date.getUTCMonth() + 1);
  const day = Number(map.day || date.getUTCDate());
  const rawHour = Number(map.hour || 0);
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(map.minute || 0);
  const second = Number(map.second || 0);
  const weekday = WEEKDAY_EN_TO_NUM[map.weekday || 'Sun'] ?? 0;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday,
    dateStr: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

/** Calcula o deslocamento em ms do fuso em relação a UTC naquele instante. */
export function getTimezoneOffsetMs(date: Date, timeZone: string = DEFAULT_AGENDA_TIMEZONE): number {
  const zoned = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  const utcTruncated = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
  return asUtc - utcTruncated;
}

/** Converte data local (`YYYY-MM-DD`) e hora (`HH:mm`) no fuso especificado para Date UTC exato. */
export function localDateTimeToUtc(
  localDate: string,
  localTime: string = '00:00',
  timeZone: string = DEFAULT_AGENDA_TIMEZONE
): Date {
  const [yStr, mStr, dStr] = localDate.split('-');
  const [hStr, minStr] = localTime.split(':');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const hour = Number(hStr || 0);
  const minute = Number(minStr || 0);

  const roughUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const offset1 = getTimezoneOffsetMs(roughUtc, timeZone);
  const refined = new Date(roughUtc.getTime() - offset1);
  const offset2 = getTimezoneOffsetMs(refined, timeZone);
  return offset1 === offset2 ? refined : new Date(roughUtc.getTime() - offset2);
}

/** Retorna janela UTC [startUtc, endUtc) equivalente ao dia local completo no fuso do tenant. */
export function getLocalDayUtcBounds(
  localDate: string,
  timeZone: string = DEFAULT_AGENDA_TIMEZONE
): { startUtc: Date; endUtc: Date } {
  const startUtc = localDateTimeToUtc(localDate, '00:00', timeZone);
  const nextLocal = addDaysToLocalDate(localDate, 1);
  const endUtc = localDateTimeToUtc(nextLocal, '00:00', timeZone);
  return { startUtc, endUtc };
}

export function addDaysToLocalDate(localDate: string, deltaDays: number): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function diffLocalDays(fromDate: string, toDate: string): number {
  const [y1, m1, d1] = fromDate.split('-').map(Number);
  const [y2, m2, d2] = toDate.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / 86_400_000);
}

export function formatLocalDateBr(localDate: string): string {
  const parts = localDate.slice(0, 10).split('-');
  if (parts.length !== 3) return localDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatPortugueseLongDate(
  date: Date = new Date(),
  timeZone: string = DEFAULT_AGENDA_TIMEZONE
): string {
  const p = getZonedParts(date, timeZone);
  const weekdayName = WEEKDAYS_PT[p.weekday] ?? 'Dia';
  const monthName = MONTHS_PT[p.month - 1] ?? '';
  return `${weekdayName}, ${p.day} de ${monthName} de ${p.year}`;
}

export function extractFirstName(fullName?: string | null): string | null {
  const clean = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const first = clean.split(' ')[0];
  if (!first || first.toLowerCase() === 'null' || first.toLowerCase() === 'undefined') {
    return null;
  }
  return first;
}

export function buildGreetingByTime(
  date: Date = new Date(),
  fullName?: string | null,
  timeZone: string = DEFAULT_AGENDA_TIMEZONE
): {
  period: 'MANHA' | 'TARDE' | 'NOITE';
  title: string;
  firstName: string | null;
} {
  const { hour } = getZonedParts(date, timeZone);
  const firstName = extractFirstName(fullName);

  let prefix = 'Boa noite';
  let period: 'MANHA' | 'TARDE' | 'NOITE' = 'NOITE';
  if (hour >= 5 && hour <= 11) {
    prefix = 'Bom dia';
    period = 'MANHA';
  } else if (hour >= 12 && hour <= 17) {
    prefix = 'Boa tarde';
    period = 'TARDE';
  }

  return {
    period,
    firstName,
    title: firstName ? `${prefix}, ${firstName}!` : `${prefix}!`,
  };
}

export function formatCommitmentCountMessage(count: number): string {
  if (count <= 0) return 'Você não possui compromissos agendados para hoje.';
  if (count === 1) return 'Você tem 1 compromisso agendado para hoje.';
  return `Você tem ${count} compromissos agendados para hoje.`;
}

export function computeEffectiveStatusAndOverdue(params: {
  baseStatus: AgendaStatus;
  startAt: Date;
  endAt: Date;
  now?: Date;
}): { effectiveStatus: AgendaStatus; isOverdue: boolean } {
  const now = params.now ?? new Date();
  if (params.baseStatus === 'CONCLUIDO' || params.baseStatus === 'CANCELADO') {
    return { effectiveStatus: params.baseStatus, isOverdue: false };
  }
  if (now.getTime() > params.endAt.getTime()) {
    return { effectiveStatus: 'ATRASADO', isOverdue: true };
  }
  if (now.getTime() >= params.startAt.getTime() && now.getTime() <= params.endAt.getTime()) {
    return { effectiveStatus: 'EM_ANDAMENTO', isOverdue: false };
  }
  return { effectiveStatus: params.baseStatus, isOverdue: false };
}

/** Calcula contagem regressiva textual em pt-BR no cliente, sem chamadas ao servidor. */
export function formatCountdownLabel(
  occurrence: Pick<
    AgendaOccurrenceView,
    'startAt' | 'endAt' | 'localStartDate' | 'allDay' | 'effectiveStatus' | 'timezone'
  >,
  now: Date = new Date()
): string {
  const status = occurrence.effectiveStatus;
  if (status === 'CONCLUIDO') return 'Concluído';
  if (status === 'CANCELADO') return 'Cancelado';

  const startMs = new Date(occurrence.startAt).getTime();
  const endMs = new Date(occurrence.endAt).getTime();
  const nowMs = now.getTime();

  if (nowMs >= startMs && nowMs <= endMs) {
    return 'Em andamento';
  }

  const tz = occurrence.timezone || DEFAULT_AGENDA_TIMEZONE;
  const todayLocal = getZonedParts(now, tz).dateStr;
  const diffDays = diffLocalDays(todayLocal, occurrence.localStartDate);

  if (nowMs > endMs) {
    const overdueDays = Math.max(1, Math.abs(diffDays) || Math.ceil((nowMs - endMs) / 86_400_000));
    if (diffDays === 0) {
      const minsLate = Math.max(1, Math.floor((nowMs - endMs) / 60_000));
      if (minsLate < 60) return `Atrasado há ${minsLate} min`;
      return `Atrasado há ${Math.floor(minsLate / 60)}h`;
    }
    return overdueDays === 1 ? 'Atrasado há 1 dia' : `Atrasado há ${overdueDays} dias`;
  }

  if (diffDays === 0) {
    const diffMinutes = Math.max(0, Math.round((startMs - nowMs) / 60_000));
    if (diffMinutes === 0) return 'Agora';
    if (diffMinutes < 60) return `Em ${diffMinutes} min`;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return mins > 0 ? `Hoje em ${hours}h ${mins}m` : `Hoje em ${hours}h`;
  }

  if (diffDays === 1) return 'Amanhã';
  if (diffDays < 30) return `Faltam ${diffDays} dias`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return months === 1 ? 'Falta 1 mês' : `Faltam ${months} meses`;
  const years = Math.floor(diffDays / 365);
  return years === 1 ? 'Falta 1 ano' : `Faltam ${years} anos`;
}

export function formatHourShortBr(timeStr: string, allDay: boolean): string {
  if (allDay) return 'Dia inteiro';
  const [h, m] = timeStr.split(':');
  return `${h || '00'}h${m || '00'}`;
}

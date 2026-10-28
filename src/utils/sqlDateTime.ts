export const SQL_CURSOR_TIME_BASIS = 'WEBRI_LOCAL_DATETIME' as const;

const localDateTimePattern = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z?$/i;


export function toSqlDateTime2Local(value: string): string {
  if (typeof value !== 'string') {
    throw new Error('INVALID_SQL_DATETIME2_LOCAL');
  }
  const trimmed = value.trim();
  const match = localDateTimePattern.exec(trimmed);
  if (!match) {
    throw new Error('INVALID_SQL_DATETIME2_LOCAL');
  }
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr, fractionStr = '0'] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);
  const millis = Number(fractionStr.padEnd(3, '0').slice(0, 3));

  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59 ||
    second < 0 || second > 59
  ) {
    throw new Error('INVALID_SQL_DATETIME2_LOCAL');
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millis));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day ||
    utcDate.getUTCHours() !== hour ||
    utcDate.getUTCMinutes() !== minute ||
    utcDate.getUTCSeconds() !== second ||
    utcDate.getUTCMilliseconds() !== millis
  ) {
    throw new Error('INVALID_SQL_DATETIME2_LOCAL');
  }

  return `${yearStr}-${monthStr}-${dayStr} ${hourStr}:${minuteStr}:${secondStr}.${fractionStr.padEnd(3, '0')}`;
}

export function addSecondsToSqlDateTime2Local(value: string, secondsDelta: number): string {
  const formatted = toSqlDateTime2Local(value);
  const [datePart, timePart] = formatted.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hms, fraction] = timePart.split('.');
  const [hour, minute, second] = hms.split(':').map(Number);
  const millis = Number(fraction);

  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second, millis) + secondsDelta * 1000;
  const result = new Date(utcMs);

  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())} ${pad(result.getUTCHours())}:${pad(result.getUTCMinutes())}:${pad(result.getUTCSeconds())}.${pad(result.getUTCMilliseconds(), 3)}`;
}


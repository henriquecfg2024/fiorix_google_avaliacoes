/**
 * Helper de Horário de Expediente do Cartório.
 * Expediente Padrão: Segunda a Sábado, das 07:00 às 19:00 (Horário de Brasília - America/Sao_Paulo).
 * Domingo e Período Noturno (19h às 07h): Fora de expediente.
 * 
 * Ativado via env em produção: BUSINESS_HOURS_ONLY="true"
 */

export interface SaoPauloDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;
  dateStr: string;
  timeStr: string;
}

export function getSaoPauloDateTime(date: Date = new Date()): SaoPauloDateTime {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const getPart = (t: string) => parts.find((p) => p.type === t)?.value || '00';
    const year = parseInt(getPart('year'), 10);
    const month = parseInt(getPart('month'), 10);
    const day = parseInt(getPart('day'), 10);
    let hour = parseInt(getPart('hour'), 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(getPart('minute'), 10);
    const second = parseInt(getPart('second'), 10);

    const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const dayOfWeek = d.getUTCDay();

    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      dayOfWeek,
      dateStr: `${year}-${pad(month)}-${pad(day)}`,
      timeStr: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
    };
  } catch {
    const dayOfWeek = date.getDay();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour,
      minute,
      second,
      dayOfWeek,
      dateStr: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      timeStr: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
    };
  }
}

export function isBusinessHours(date: Date = new Date()): boolean {
  // Em testes unitários sintéticos do Vitest, executa 24/7 a menos que TEST_BUSINESS_HOURS="true"
  if (process.env.NODE_ENV === 'test' && process.env.TEST_BUSINESS_HOURS !== 'true') {
    return true;
  }

  // Em runtime normal do serviço, executa 24/7 a menos que BUSINESS_HOURS_ONLY="true"
  if (process.env.BUSINESS_HOURS_ONLY !== 'true') {
    return true;
  }

  const sp = getSaoPauloDateTime(date);
  const isWorkDay = sp.dayOfWeek >= 1 && sp.dayOfWeek <= 6;
  const isWorkHour = sp.hour >= 7 && sp.hour < 19;

  return isWorkDay && isWorkHour;
}


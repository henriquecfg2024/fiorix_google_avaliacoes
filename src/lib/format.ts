const PT_BR = 'pt-BR';

export function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString(PT_BR);
}

export function formatDate(value: Date | string | number | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(PT_BR);
}

export function formatDateTime(value: Date | string | number | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(PT_BR);
}

export function formatTime(value: Date | string | number | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(PT_BR, { hour: '2-digit', minute: '2-digit' });
}

/** Share of `total` taken by `count`, as a string with one decimal place. */
export function percentOf(count: number, total: number, digits = 1) {
  if (!total) return (0).toFixed(digits);
  return ((count / total) * 100).toFixed(digits);
}

/** Same as `percentOf`, but numeric — for chart payloads. */
export function percentNumber(count: number, total: number, digits = 1) {
  return Number(percentOf(count, total, digits));
}

export function formatDecimal(value: number, digits = 1) {
  return value.toFixed(digits).replace('.', ',');
}

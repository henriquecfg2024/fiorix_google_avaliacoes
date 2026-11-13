/**
 * Utilitário seguro para exportação CSV (CWE-1236: CSV Formula Injection).
 * Pode ser importado tanto em API Routes/Server Actions quanto em Client Components ('use client').
 */

const FORMULA_TRIGGER_PATTERN = /^[\s\u0000-\u001F]*[=+\-@|]/;
const PURE_NEGATIVE_NUMBER_PATTERN = /^-\d+(?:[.,]\d+)?$/;

/**
 * Neutraliza fórmulas perigosas do Excel/Calc (`=`, `+`, `-`, `@`, `|`, `\t`, `\r`)
 * preservando números negativos legítimos (ex.: `-42.5`, `-123,45`).
 */
export function sanitizeCsvFormulaText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value);
  }

  const raw = String(value);
  if (!raw) return '';

  const trimmed = raw.trim();
  if (PURE_NEGATIVE_NUMBER_PATTERN.test(trimmed)) {
    return raw;
  }

  if (
    FORMULA_TRIGGER_PATTERN.test(raw) ||
    raw.startsWith('\t') ||
    raw.startsWith('\r') ||
    raw.startsWith('\n')
  ) {
    return `'${raw}`;
  }

  return raw;
}

/**
 * Formata uma célula CSV sempre entre aspas duplas com escape RFC 4180 (`""`)
 * e proteção contra injeção de fórmulas em planilhas.
 */
export function escapeCsvCell(value: unknown): string {
  const safe = sanitizeCsvFormulaText(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Formata uma linha completa de CSV unindo células escapadas pelo delimitador informado.
 */
export function formatCsvRow(cells: unknown[], delimiter = ';'): string {
  return cells.map((cell) => escapeCsvCell(cell)).join(delimiter);
}


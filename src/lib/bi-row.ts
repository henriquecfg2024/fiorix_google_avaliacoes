export const HEADER_FIORIX = [
  'Protocolo',
  'FlagRecepcao',
  'TipoSolicitacao',
  'IdAndamento',
  'DtProtocolo',
  'DtPrevisaoEntrega',
  'DtAndamento',
  'DataProtocolo',
  'CodProcessamento',
  'DescAndamento',
  'Natureza',
  'TipoPrenotacao',
  'DiasPrometidos',
  'DiasCorridos',
  'DiasAtraso',
  'SituacaoPrazo',
  'IsDevolucao',
  'IsRegistrado',
  'TextoNotaDevolucao',
];

export interface BiCsvRow {
  Protocolo: string;
  FlagRecepcao?: number | null;
  TipoSolicitacao?: string | null;
  IdAndamento?: number | string | null;
  DtProtocolo?: string | null;
  DtPrevisaoEntrega?: string | null;
  DtAndamento?: string | null;
  CodProcessamento?: number | null;
  DescAndamento?: string | null;
  Natureza?: string | null;
  TipoPrenotacao?: string | null;
  DiasPrometidos?: number | null;
  DiasCorridos?: number | null;
  DiasAtraso?: number | null;
  SituacaoPrazo?: string | null;
  IsDevolucao?: boolean | null;
  IsRegistrado?: boolean | null;
  TextoNotaDevolucao?: string | null;
}

export function limparCelula(value: unknown) {
  return typeof value === 'string' ? value.replace(/^\uFEFF/, '').trim() : '';
}

export function normalizarCabecalho(value: unknown) {
  return limparCelula(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseIntValue(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseInt(String(value).replace(/\D/g, ''), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseBoolValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const lower = String(value).trim().toLowerCase();
  return lower === '1' || lower === 'true' || lower === 'sim';
}

/** Accepts ISO dates and the `dd/MM/yyyy[ HH:mm[:ss]]` format exported by SSMS. */
export function parseDateValue(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const cleaned = String(value).trim();
  if (!cleaned) return null;

  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const match = cleaned.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?$/
  );

  if (!match) {
    return null;
  }

  const [, day, month, year, time = '00:00:00'] = match;
  const fallback = new Date(`${year}-${month}-${day}T${time}`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function trimOrNull(value: unknown) {
  const cleaned = value === undefined || value === null ? '' : String(value).trim();
  return cleaned === '' ? null : cleaned;
}

export function protocoloValido(protocolo: unknown) {
  const cleaned = String(protocolo || '').trim();
  return Boolean(cleaned && cleaned !== '0' && cleaned.toLowerCase() !== 'protocolo');
}

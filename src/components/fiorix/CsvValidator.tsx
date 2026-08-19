import Papa from 'papaparse';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

/** Headers do CSV gerado pela nova procedure dbo.pr_Fiorix_BI */
export const HEADER_FIORIX_NOVO = [
  'PROTOCOLO',
  'DATA_ENTRADA',
  'TIPO',
  'STATUS',
  'ATRASO_DIAS',
  'SERVICO',
];

export const COLUNAS_OBRIGATORIAS = HEADER_FIORIX;

export interface CsvStats {
  fileName: string;
  totalLinhas: number;
  protocolosUnicos: number;
  devolucoes: number;
  atrasados: number;
  noPrazo: number;
  emAndamento: number;
  percAtraso: string;
  periodoIni: string;
  periodoFim: string;
  naturezas: string[];
}

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

const HEADER_FIORIX_NORMALIZADO = HEADER_FIORIX.map((header) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, '')
);

const HEADER_FIORIX_NOVO_NORMALIZADO = HEADER_FIORIX_NOVO.map((header) =>
  header.toLowerCase().replace(/[^a-z0-9_]/g, '')
);

/** All known header names (old + new) normalized for detection */
const ALL_KNOWN_HEADERS_NORMALIZADO = [
  ...HEADER_FIORIX_NORMALIZADO,
  ...HEADER_FIORIX_NOVO_NORMALIZADO,
];

function limparCelula(value: unknown) {
  return typeof value === 'string' ? value.replace(/^\uFEFF/, '').trim() : '';
}

function normalizarCabecalho(value: unknown) {
  return limparCelula(value).toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function linhaTemConteudo(row: string[]) {
  return Array.isArray(row) && row.some((cell) => limparCelula(cell) !== '');
}

/**
 * Case-insensitive, trim-aware field getter.
 * Accepts multiple possible column names and returns the first match.
 */
function getField(row: Record<string, string>, ...possibleNames: string[]): string {
  const lowerNames = possibleNames.map((n) => n.toLowerCase().trim());
  const foundKey = Object.keys(row).find((k) =>
    lowerNames.includes(k.toLowerCase().trim())
  );
  return foundKey ? String(row[foundKey]).trim() : '';
}

/**
 * Flexible date parser that handles both YYYY-MM-DD and DD/MM/YYYY formats.
 */
function parseDataFlexivel(s: string): Date | null {
  if (!s) return null;
  s = s.trim();
  if (!s) return null;

  // YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
  if (s.includes('-') && /^\d{4}-/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or DD/MM/YYYY HH:MM:SS
  if (s.includes('/')) {
    const match = s.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?$/
    );
    if (match) {
      const [, day, month, year, time = '00:00:00'] = match;
      const fallback = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}`);
      return isNaN(fallback.getTime()) ? null : fallback;
    }
  }

  // Last resort: try native Date parse
  const last = new Date(s);
  return isNaN(last.getTime()) ? null : last;
}

/**
 * Detect whether a new-schema CSV is being used (PROTOCOLO, DATA_ENTRADA, STATUS, etc.)
 */
function isNewSchema(headers: string[]): boolean {
  const normalized = headers.map(normalizarCabecalho);
  return normalized.includes('protocolo') &&
    (normalized.includes('data_entrada') || normalized.includes('dataentrada')) &&
    (normalized.includes('status') || normalized.includes('atraso_dias') || normalized.includes('atrasodias'));
}

function detectarCabecalho(row: string[]) {
  const normalizedRow = row.map(normalizarCabecalho).filter(Boolean);

  // Check old-schema matches
  const oldMatches = normalizedRow.filter((header) =>
    HEADER_FIORIX_NORMALIZADO.includes(header)
  ).length;

  // Check new-schema matches
  const newMatches = normalizedRow.filter((header) =>
    HEADER_FIORIX_NOVO_NORMALIZADO.includes(header)
  ).length;

  return normalizarCabecalho(row[0]) === 'protocolo' || oldMatches >= 6 || newMatches >= 3;
}

function mapearLinhaBruta(
  row: string[],
  detectedHeaders: string[],
  isHeader: boolean
): Record<string, string> {
  const rowObj: Record<string, string> = {};

  if (!isHeader || detectedHeaders.length < 10) {
    HEADER_FIORIX.forEach((colName, idx) => {
      rowObj[colName] = row[idx] !== undefined ? limparCelula(row[idx]) : '';
    });

    return rowObj;
  }

  detectedHeaders.forEach((colName, idx) => {
    rowObj[limparCelula(colName)] = row[idx] !== undefined ? limparCelula(row[idx]) : '';
  });

  HEADER_FIORIX.forEach((header) => {
    if (rowObj[header] !== undefined) {
      return;
    }

    const normalizedHeader = normalizarCabecalho(header);
    const matchedKey = Object.keys(rowObj).find(
      (key) => normalizarCabecalho(key) === normalizedHeader
    );

    if (matchedKey) {
      rowObj[header] = rowObj[matchedKey];
    }
  });

  return rowObj;
}

function getVal(row: Record<string, string>, col: string) {
  if (!row) return '';
  if (row[col] !== undefined && row[col] !== '') return row[col];

  const key = Object.keys(row).find(
    (candidate) => normalizarCabecalho(candidate) === normalizarCabecalho(col)
  );

  return key ? row[key] : '';
}

function getInt(val: unknown) {
  if (val === undefined || val === null || val === '') return null;
  const parsed = parseInt(String(val).replace(/\D/g, ''), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getBool(val: unknown) {
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return val;

  const lower = String(val).trim().toLowerCase();
  return lower === '1' || lower === 'true' || lower === 'sim';
}

function protocoloValido(protocolo: unknown) {
  const cleaned = String(protocolo || '').trim();
  return Boolean(cleaned && cleaned !== '0' && cleaned.toLowerCase() !== 'protocolo');
}

/**
 * Normalize a raw row into BiCsvRow.
 * Supports both old schema (Protocolo, SituacaoPrazo, IsDevolucao, DiasAtraso, etc.)
 * and new schema from dbo.pr_Fiorix_BI (PROTOCOLO, DATA_ENTRADA, TIPO, STATUS, ATRASO_DIAS).
 */
function normalizarLinha(row: Record<string, string>, useNewSchema: boolean): BiCsvRow {
  if (useNewSchema) {
    // New schema: PROTOCOLO, DATA_ENTRADA, TIPO, STATUS, ATRASO_DIAS
    const protocolo = getField(row, 'protocolo');
    const dataEntradaRaw = getField(row, 'data_entrada', 'data_protocolo', 'dt_protocolo', 'data', 'dataentrada');
    const statusRaw = getField(row, 'status').toUpperCase();
    const servicoRaw = getField(row, 'servico', 'serviço').toUpperCase();
    const tipoRaw = getField(row, 'tipo', 'tipossolicitacao', 'tiposolicitacao', 'tipo_prenotacao', 'tipoprenotacao');
    const atrasoDias = parseInt(getField(row, 'atraso_dias', 'atraso', 'dias_atraso', 'diasatraso', 'atrasodias') || '0', 10);

    const isDevolucao = servicoRaw.includes('DEVOL') || statusRaw.includes('DEVOL');
    const isRegistrado =
      servicoRaw.includes('REGISTRAD') ||
      statusRaw.includes('REGISTRAD') ||
      statusRaw.includes('AVERBAD');

    let situacaoPrazo = 'NoPrazo';
    if (isDevolucao) {
      situacaoPrazo = 'Devolucao';
    } else if (atrasoDias > 0) {
      situacaoPrazo = 'Atrasado';
    }

    return {
      Protocolo: protocolo,
      FlagRecepcao: null,
      TipoSolicitacao: tipoRaw || null,
      IdAndamento: null,
      DtProtocolo: dataEntradaRaw || null,
      DtPrevisaoEntrega: null,
      DtAndamento: null,
      CodProcessamento: null,
      DescAndamento: null,
      Natureza: tipoRaw || null,
      TipoPrenotacao: tipoRaw || null,
      DiasPrometidos: null,
      DiasCorridos: null,
      DiasAtraso: isNaN(atrasoDias) ? null : atrasoDias,
      SituacaoPrazo: situacaoPrazo,
      IsDevolucao: isDevolucao,
      IsRegistrado: isRegistrado,
      TextoNotaDevolucao: null,
    };
  }

  // Old schema: original column mapping
  return {
    Protocolo: String(getVal(row, 'Protocolo') || '').trim(),
    FlagRecepcao: getInt(getVal(row, 'FlagRecepcao')),
    TipoSolicitacao: getVal(row, 'TipoSolicitacao') || null,
    IdAndamento: getVal(row, 'IdAndamento') || null,
    DtProtocolo: getVal(row, 'DtProtocolo') || getVal(row, 'DataProtocolo') || null,
    DtPrevisaoEntrega: getVal(row, 'DtPrevisaoEntrega') || null,
    DtAndamento: getVal(row, 'DtAndamento') || null,
    CodProcessamento: getInt(getVal(row, 'CodProcessamento')),
    DescAndamento: getVal(row, 'DescAndamento') || null,
    Natureza: getVal(row, 'Natureza') || null,
    TipoPrenotacao: getVal(row, 'TipoPrenotacao') || null,
    DiasPrometidos: getInt(getVal(row, 'DiasPrometidos')),
    DiasCorridos: getInt(getVal(row, 'DiasCorridos')),
    DiasAtraso: getInt(getVal(row, 'DiasAtraso')),
    SituacaoPrazo: getVal(row, 'SituacaoPrazo') || null,
    IsDevolucao: getBool(getVal(row, 'IsDevolucao')),
    IsRegistrado: getBool(getVal(row, 'IsRegistrado')),
    TextoNotaDevolucao: getVal(row, 'TextoNotaDevolucao') || null,
  };
}

function parseDateValue(value?: string | null) {
  if (!value) return null;
  return parseDataFlexivel(String(value));
}

function assertArquivoBi(fileName: string, headers: string[]) {
  const normalizedFileName = fileName.toLowerCase();
  const normalizedHeaders = headers.map(normalizarCabecalho);
  const hasBiServiceColumn = normalizedHeaders.includes('servico');
  const hasMetasMilestones = [
    'd1protocolo',
    'd8impressao',
    'd9preparacao',
    'd9conferencia',
    'd10entrega',
  ].some((header) => normalizedHeaders.includes(header));

  if (normalizedFileName.startsWith('fiorix_metas_') || (hasMetasMilestones && !hasBiServiceColumn)) {
    throw new Error(
      'Arquivo de Metas detectado. Use a importacao de Metas para fiorix_metas_*.csv; nesta tela envie apenas arquivos BI, como fiorix_bi_*.csv.'
    );
  }
}

function toPreviewDateString(value?: string | null) {
  const parsed = parseDateValue(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

/** Format an ISO date string (YYYY-MM-DD) to pt-BR format (DD/MM/YYYY) */
function formatDatePtBR(isoDate: string): string {
  const parsed = parseDataFlexivel(isoDate);
  if (!parsed) return isoDate;
  return parsed.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function validarCSV(
  file: File,
  onPreview: (stats: CsvStats, rows: BiCsvRow[]) => void,
  onError: (msg: string) => void
) {
  /** Normalize a header key: lowercase, strip non-alphanumeric */
  const normalizeKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  /** Case-insensitive field getter that tries multiple possible column names */
  const get = (row: any, ...names: string[]): string => {
    const map: Record<string, any> = {};
    Object.keys(row).forEach(k => { map[normalizeKey(k)] = row[k]; });
    for (const n of names) {
      const nk = normalizeKey(n);
      if (map[nk] !== undefined && map[nk] !== null && String(map[nk]).trim() !== '') {
        return String(map[nk]).trim();
      }
    }
    return '';
  };

  /** Flexible date parser: handles YYYY-MM-DD (with optional time) and DD/MM/YYYY */
  const parseData = (s: string): Date | null => {
    if (!s) return null;
    s = s.split(' ')[0].trim(); // remove 00:00:00.000 from SSMS exports
    if (s.includes('-') && /^\d{4}-/.test(s)) {
      const d = new Date(s + 'T00:00:00');
      return isNaN(d.getTime()) ? null : d;
    }
    if (s.includes('/')) {
      const [d, m, y] = s.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    return null;
  };

  let headerLogged = false;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
    quoteChar: '"',
    escapeChar: '"',
    worker: false,
    chunkSize: 1024 * 1024 * 4,
    transformHeader: (h: string) => h.replace(/^\uFEFF/, '').trim(),
    complete: (results) => {
      const rawRows = (results.data as Record<string, any>[]) || [];

      if (rawRows.length > 0 && !headerLogged) {
        console.log('[CsvValidator] Colunas detectadas:', Object.keys(rawRows[0]));
        headerLogged = true;
      }

      if (rawRows.length === 0) {
        onError('O arquivo CSV está vazio. Exporte novamente o resultado da pr_Fiorix_BI.');
        return;
      }

      try {
        assertArquivoBi(file.name, results.meta.fields || Object.keys(rawRows[0] || {}));
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Arquivo invalido para o importador BI.');
        return;
      }

      const rowsLimpos = rawRows.map(row => {
      const statusRaw = get(row, 'STATUS', 'status', 'SituacaoPrazo', 'situacao', 'situacaoprazo').toUpperCase();
      const servicoRaw = get(row, 'SERVICO', 'servico', 'serviço').toUpperCase();
      const tipoRaw = get(row, 'TIPO', 'tipo', 'TipoPrenotacao', 'TipoSolicitacao', 'Natureza');
      const atrasoBruto = get(row, 'ATRASO_DIAS', 'ATRASO', 'DIAS', 'ATRASO_DIAS_CALCULADO', 'DiasAtraso', 'diasatraso');
      const isDevolucaoField = get(row, 'IsDevolucao', 'isdevolucao');
      const isDevolucao = servicoRaw.includes('DEVOL') || statusRaw.includes('DEVOL') || isDevolucaoField === '1' || isDevolucaoField.toLowerCase() === 'true' || isDevolucaoField.toLowerCase() === 'sim';

      return {
        protocolo: get(row, 'PROTOCOLO', 'protocolo'),
        data: parseData(get(row, 'DATA_ENTRADA', 'DATA', 'DTRECEP', 'DtProtocolo', 'DataProtocolo', 'DtAndamento')),
        status: isDevolucao ? 'DEVOLVIDO' : 'REGISTRADO',
        atraso: parseInt(atrasoBruto.replace(/[^0-9\-]/g, '') || '0', 10),
        tipo: tipoRaw,
      };
      }).filter(r => r.protocolo && r.protocolo !== '0' && normalizeKey(r.protocolo) !== 'protocolo');

      if (rowsLimpos.length === 0) {
        onError('Nenhum registro válido foi encontrado no CSV. Confira a coluna Protocolo na exportação.');
        return;
      }



      const totalLinhas = rowsLimpos.length;
      const protocolosUnicos = new Set(rowsLimpos.map(r => r.protocolo)).size;
      const devolucoes = rowsLimpos.filter(r => r.status === 'DEVOLVIDO').length;
      const atrasados = rowsLimpos.filter(r => r.atraso > 5).length;
      const noPrazo = rowsLimpos.filter(r => r.atraso <= 5 && r.status !== 'DEVOLVIDO').length;
      const emAndamento = 0;

      const datasValidas = rowsLimpos
        .map(r => r.data)
        .filter((d): d is Date => d !== null);

      let periodoIni = 'N/I';
      let periodoFim = 'N/I';

      if (datasValidas.length > 0) {
        const minDate = new Date(Math.min(...datasValidas.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...datasValidas.map(d => d.getTime())));
        periodoIni = minDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        periodoFim = maxDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      }

      const percAtrasoVal =
        noPrazo + atrasados > 0 ? (atrasados / (noPrazo + atrasados)) * 100 : 0;

      const naturezas = [...new Set(rowsLimpos.map(r => r.tipo).filter(Boolean))].slice(0, 3);

      const stats: CsvStats = {
        fileName: file.name,
        totalLinhas,
        protocolosUnicos,
        devolucoes,
        atrasados,
        noPrazo,
        emAndamento,
        percAtraso: percAtrasoVal.toFixed(1),
        periodoIni,
        periodoFim,
        naturezas,
      };

      console.log('[CsvValidator] Preview stats:', stats);
      onPreview(stats, []);
    },
    error: (err) => {
      onError(`Erro ao ler o arquivo CSV: ${err.message}`);
    },
  });
}

export async function importarLinhasEmLotes({
  rows,
  batchSize = 1000,
  concurrency = 3,
  insertBatch,
  onProgress,
}: {
  rows: BiCsvRow[];
  batchSize?: number;
  concurrency?: number;
  insertBatch: (rows: BiCsvRow[]) => Promise<{ success: boolean; count?: number; error?: string }>;
  onProgress?: (processed: number, total: number) => void | Promise<void>;
}) {
  let totalProcessed = 0;
  const safeConcurrency = Math.max(1, concurrency);

  for (let offset = 0; offset < rows.length; offset += batchSize * safeConcurrency) {
    const batches: BiCsvRow[][] = [];
    for (let index = 0; index < safeConcurrency && offset + index * batchSize < rows.length; index += 1) {
      batches.push(rows.slice(offset + index * batchSize, offset + (index + 1) * batchSize));
    }

    const counts = await Promise.all(batches.map(async (batch) => {
      const result = await insertBatch(batch);
      if (!result?.success) {
        throw new Error(result?.error || 'Falha ao inserir lote de dados.');
      }
      return batch.length;
    }));

    totalProcessed += counts.reduce((sum, count) => sum + count, 0);
    if (onProgress) await onProgress(totalProcessed, rows.length);
  }

  return { totalProcessed };
}

export async function importarCSVEmLotes({
  file,
  batchSize = 5000,
  estimatedTotal,
  insertBatch,
  onProgress,
  concurrency = 3,
}: {
  file: File;
  batchSize?: number;
  estimatedTotal: number;
  concurrency?: number;
  insertBatch: (
    rows: BiCsvRow[]
  ) => Promise<{ success: boolean; count?: number; error?: string }>;
  onProgress?: (processed: number, estimatedTotal: number) => void | Promise<void>;
}) {
  return new Promise<{ totalProcessed: number }>((resolve, reject) => {
    /** Normalize a header key: lowercase, strip non-alphanumeric */
    const normalizeKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    /** Case-insensitive field getter that tries multiple possible column names */
    const get = (row: any, ...names: string[]): string => {
      const map: Record<string, any> = {};
      Object.keys(row).forEach(k => { map[normalizeKey(k)] = row[k]; });
      for (const n of names) {
        const nk = normalizeKey(n);
        if (map[nk] !== undefined && map[nk] !== null && String(map[nk]).trim() !== '') {
          return String(map[nk]).trim();
        }
      }
      return '';
    };

    let totalProcessed = 0;
    let validRows = 0;
    let settled = false;
    const rowBuffer: BiCsvRow[] = [];
    const pendingBatches = new Set<Promise<void>>();

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const flushBuffer = async (drain = false) => {
      while (rowBuffer.length >= batchSize || (drain && rowBuffer.length > 0)) {
        while (pendingBatches.size >= Math.max(1, concurrency)) {
          await Promise.race(pendingBatches);
        }

        const batch = rowBuffer.splice(0, Math.min(batchSize, rowBuffer.length));
        const task = (async () => {
          const result = await insertBatch(batch);
          if (!result?.success) {
            throw new Error(result?.error || 'Falha ao inserir lote de dados.');
          }

          totalProcessed += batch.length;
          if (onProgress) await onProgress(totalProcessed, estimatedTotal);
        })();

        pendingBatches.add(task);
        task.then(
          () => pendingBatches.delete(task),
          () => pendingBatches.delete(task),
        );
      }

      if (drain && pendingBatches.size > 0) {
        await Promise.all(Array.from(pendingBatches));
      }
    };

    /** Convert a raw row (old or new schema) to BiCsvRow for Supabase insert */
    const toBiCsvRow = (row: Record<string, any>): BiCsvRow | null => {
      const protocolo = get(row, 'PROTOCOLO', 'protocolo');
      if (!protocolo || protocolo === '0' || normalizeKey(protocolo) === 'protocolo') {
        return null;
      }

      const statusRaw = get(row, 'STATUS', 'status', 'SituacaoPrazo', 'situacao').toUpperCase();
      const servicoRaw = get(row, 'SERVICO', 'servico', 'serviço').toUpperCase();
      const tipoRaw = get(row, 'TIPO', 'tipo', 'TipoPrenotacao', 'TipoSolicitacao', 'Natureza');
      const atrasoBruto = get(row, 'ATRASO_DIAS', 'ATRASO', 'DIAS', 'DiasAtraso', 'diasatraso');
      const atrasoDias = parseInt(atrasoBruto.replace(/[^0-9\-]/g, '') || '0', 10);
      const isDevolucaoField = get(row, 'IsDevolucao', 'isdevolucao');
      const isDevolucao = servicoRaw.includes('DEVOL') || statusRaw.includes('DEVOL') || isDevolucaoField === '1' || isDevolucaoField.toLowerCase() === 'true' || isDevolucaoField.toLowerCase() === 'sim';
      const isRegistrado = servicoRaw.includes('REGISTRAD') || statusRaw.includes('REGISTRAD') || statusRaw.includes('AVERBAD') || (!isDevolucao);

      let situacaoPrazo = 'NoPrazo';
      if (isDevolucao) {
        situacaoPrazo = 'Devolucao';
      } else if (atrasoDias > 0) {
        situacaoPrazo = 'Atrasado';
      }

      return {
        Protocolo: protocolo,
        FlagRecepcao: getInt(get(row, 'FlagRecepcao', 'flagrecepcao')),
        TipoSolicitacao: tipoRaw || get(row, 'TipoSolicitacao', 'tiposolicitacao') || null,
        IdAndamento: get(row, 'IdAndamento', 'idandamento') || null,
        DtProtocolo: get(row, 'DATA_ENTRADA', 'DATA', 'DtProtocolo', 'DataProtocolo', 'dtprotocolo', 'dataprotocolo') || null,
        DtPrevisaoEntrega: get(row, 'DtPrevisaoEntrega', 'dtprevisaoentrega') || null,
        DtAndamento: get(row, 'DtAndamento', 'dtandamento') || null,
        CodProcessamento: getInt(get(row, 'CodProcessamento', 'codprocessamento')),
        DescAndamento: get(row, 'DescAndamento', 'descandamento') || null,
        Natureza: tipoRaw || get(row, 'Natureza', 'natureza') || null,
        TipoPrenotacao: servicoRaw || tipoRaw || get(row, 'TipoPrenotacao', 'tipoprenotacao') || null,
        DiasPrometidos: getInt(get(row, 'DiasPrometidos', 'diasprometidos')),
        DiasCorridos: getInt(get(row, 'DiasCorridos', 'diascorridos')),
        DiasAtraso: isNaN(atrasoDias) ? null : atrasoDias,
        SituacaoPrazo: situacaoPrazo,
        IsDevolucao: isDevolucao,
        IsRegistrado: isRegistrado,
        TextoNotaDevolucao: get(row, 'TextoNotaDevolucao', 'textonotadevolucao') || null,
      };
    };

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      quoteChar: '"',
      escapeChar: '"',
      worker: false,
      chunkSize: 1024 * 1024 * 4,
      transformHeader: (h: string) => h.replace(/^\uFEFF/, '').trim(),
      chunk: (results, parser) => {
        parser.pause();

        Promise.resolve()
          .then(async () => {
            const rawRows = (results.data as Record<string, any>[]) || [];

            assertArquivoBi(file.name, results.meta.fields || Object.keys(rawRows[0] || {}));

            for (const rawRow of rawRows) {
              const normalizedRow = toBiCsvRow(rawRow);
              if (!normalizedRow) continue;

              validRows += 1;
              rowBuffer.push(normalizedRow);

              if (rowBuffer.length >= batchSize) {
                await flushBuffer();
              }
            }

            if (!settled) {
              parser.resume();
            }
          })
          .catch((error) => {
            parser.abort();
            fail(error);
          });
      },
      complete: () => {
        Promise.resolve()
          .then(async () => {
            if (settled) return;

            await flushBuffer(true);

            if (validRows === 0) {
              throw new Error('Nenhum registro válido foi encontrado no CSV.');
            }

            settled = true;
            resolve({ totalProcessed });
          })
          .catch((error) => fail(error));
      },
      error: (err) => fail(new Error(`Erro ao ler o arquivo CSV: ${err.message}`)),
    });
  });
}

export function PreviewCard({
  stats,
  onConfirm,
  onCancel,
  isImporting,
  uploadProgress,
  importStatusMsg,
}: {
  stats: CsvStats | null;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting?: boolean;
  uploadProgress?: number;
  importStatusMsg?: string;
}) {
  if (!stats) return null;

  return (
    <Card className="mt-5 border-dashed border-2 border-slate-300 bg-slate-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
          <span>📊 Preview: {stats.fileName}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-600">
        <p>✅ Total de linhas: <strong className="text-slate-800">{stats.totalLinhas.toLocaleString('pt-BR')}</strong></p>
        <p>📄 Protocolos únicos: <strong className="text-slate-800">{stats.protocolosUnicos.toLocaleString('pt-BR')}</strong></p>
        <p>⚠️ Devoluções: <strong className="text-slate-800">{stats.devolucoes.toLocaleString('pt-BR')}</strong></p>
        <p>
          🟢 No Prazo: <strong className="text-slate-800">{stats.noPrazo.toLocaleString('pt-BR')}</strong> | 🔴 Atrasados:{' '}
          <strong className="text-slate-800">
            {stats.atrasados.toLocaleString('pt-BR')} ({stats.percAtraso}%)
          </strong>
        </p>
        <p>📅 Período: <strong className="text-slate-800">{stats.periodoIni}</strong> até <strong className="text-slate-800">{stats.periodoFim}</strong></p>

        {isImporting && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span>{importStatusMsg}</span>
              <span>{(uploadProgress || 0).toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${uploadProgress || 0}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex gap-3 flex-wrap pt-0">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isImporting}
        >
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isImporting}
          className="bg-slate-900 hover:bg-slate-800 text-white shadow-md"
        >
          {isImporting ? 'Importando...' : 'Confirmar e Importar para Supabase'}
        </Button>
      </CardFooter>
    </Card>
  );
}

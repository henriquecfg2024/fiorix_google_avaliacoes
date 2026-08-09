import Papa from 'papaparse';

import {
  BiCsvRow,
  HEADER_FIORIX,
  limparCelula,
  normalizarCabecalho,
  parseBoolValue,
  parseDateValue,
  parseIntValue,
  protocoloValido,
} from '@/lib/bi-row';
import { formatNumber, percentOf } from '@/lib/format';

export type { BiCsvRow } from '@/lib/bi-row';
export { HEADER_FIORIX } from '@/lib/bi-row';

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

const HEADER_FIORIX_NORMALIZADO = HEADER_FIORIX.map(normalizarCabecalho);

function linhaTemConteudo(row: string[]) {
  return Array.isArray(row) && row.some((cell) => limparCelula(cell) !== '');
}

function detectarCabecalho(row: string[]) {
  const normalizedRow = row.map(normalizarCabecalho).filter(Boolean);
  const matches = normalizedRow.filter((header) =>
    HEADER_FIORIX_NORMALIZADO.includes(header)
  ).length;

  return normalizarCabecalho(row[0]) === 'protocolo' || matches >= 6;
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

function normalizarLinha(row: Record<string, string>): BiCsvRow {
  return {
    Protocolo: String(getVal(row, 'Protocolo') || '').trim(),
    FlagRecepcao: parseIntValue(getVal(row, 'FlagRecepcao')),
    TipoSolicitacao: getVal(row, 'TipoSolicitacao') || null,
    IdAndamento: getVal(row, 'IdAndamento') || null,
    DtProtocolo: getVal(row, 'DtProtocolo') || getVal(row, 'DataProtocolo') || null,
    DtPrevisaoEntrega: getVal(row, 'DtPrevisaoEntrega') || null,
    DtAndamento: getVal(row, 'DtAndamento') || null,
    CodProcessamento: parseIntValue(getVal(row, 'CodProcessamento')),
    DescAndamento: getVal(row, 'DescAndamento') || null,
    Natureza: getVal(row, 'Natureza') || null,
    TipoPrenotacao: getVal(row, 'TipoPrenotacao') || null,
    DiasPrometidos: parseIntValue(getVal(row, 'DiasPrometidos')),
    DiasCorridos: parseIntValue(getVal(row, 'DiasCorridos')),
    DiasAtraso: parseIntValue(getVal(row, 'DiasAtraso')),
    SituacaoPrazo: getVal(row, 'SituacaoPrazo') || null,
    IsDevolucao: parseBoolValue(getVal(row, 'IsDevolucao')),
    IsRegistrado: parseBoolValue(getVal(row, 'IsRegistrado')),
    TextoNotaDevolucao: getVal(row, 'TextoNotaDevolucao') || null,
  };
}

function toPreviewDateString(value?: string | null) {
  const parsed = parseDateValue(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

/**
 * Stateful reader that resolves the header layout from the first row and maps
 * every following raw row into a `BiCsvRow`. Returns null for the header row.
 */
function criarLeitorDeLinhas() {
  let detectedHeaders = HEADER_FIORIX;
  let isHeader = false;
  let firstDataRowResolved = false;

  return function lerLinha(rawRow: string[]): BiCsvRow | null {
    const cleanedRow = rawRow.map((cell) => limparCelula(cell));

    if (!firstDataRowResolved) {
      isHeader = detectarCabecalho(cleanedRow);
      detectedHeaders = isHeader ? cleanedRow : HEADER_FIORIX;
      firstDataRowResolved = true;

      if (isHeader) return null;
    }

    return normalizarLinha(mapearLinhaBruta(cleanedRow, detectedHeaders, isHeader));
  };
}

const PAPA_PARSE_CONFIG = {
  header: false,
  delimiter: ';',
  skipEmptyLines: false,
  encoding: 'UTF-8',
  quoteChar: '"',
  escapeChar: '"',
  worker: false,
  chunkSize: 1024 * 1024 * 4,
  transform: (val: string) => limparCelula(val),
} as const;

function linhasDoChunk(results: Papa.ParseResult<unknown>) {
  return ((results.data as string[][]) || []).filter(linhaTemConteudo);
}

export function validarCSV(
  file: File,
  onPreview: (stats: CsvStats, rows: BiCsvRow[]) => void,
  onError: (msg: string) => void
) {
  const lerLinha = criarLeitorDeLinhas();
  let totalLinhas = 0;
  let validRows = 0;
  let devolucoes = 0;
  let atrasados = 0;
  let noPrazo = 0;
  let emAndamento = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;
  const protocolosUnicos = new Set<number | string>();
  const naturezas = new Set<string>();

  Papa.parse(file, {
    ...PAPA_PARSE_CONFIG,
    chunk: (results) => {
      for (const rawRow of linhasDoChunk(results)) {
        const normalizedRow = lerLinha(rawRow);
        if (!normalizedRow) continue;

        totalLinhas += 1;

        if (!protocoloValido(normalizedRow.Protocolo)) {
          continue;
        }

        validRows += 1;

        const numericProtocol = Number(normalizedRow.Protocolo);
        protocolosUnicos.add(
          Number.isFinite(numericProtocol) ? numericProtocol : normalizedRow.Protocolo
        );

        if (normalizedRow.Natureza && naturezas.size < 12) {
          naturezas.add(normalizedRow.Natureza.trim());
        }

        const situacao = String(normalizedRow.SituacaoPrazo || '').toLowerCase();

        if (normalizedRow.IsDevolucao || situacao.includes('devolucao')) {
          devolucoes += 1;
        }

        if (situacao.includes('atrasad') || ((normalizedRow.DiasAtraso || 0) > 0)) {
          atrasados += 1;
        }

        if (situacao === 'noprazo') {
          noPrazo += 1;
        }

        if (situacao.includes('andamento')) {
          emAndamento += 1;
        }

        const previewDate = toPreviewDateString(
          normalizedRow.DtAndamento || normalizedRow.DtProtocolo
        );

        if (previewDate) {
          if (!minDate || previewDate < minDate) minDate = previewDate;
          if (!maxDate || previewDate > maxDate) maxDate = previewDate;
        }
      }
    },
    complete: () => {
      if (totalLinhas === 0) {
        onError('O arquivo CSV está vazio. Exporte novamente o resultado da pr_Fiorix_BI.');
        return;
      }

      if (totalLinhas < 10) {
        onError(
          `Arquivo com apenas ${totalLinhas} linhas. Exporte novamente o resultado completo da pr_Fiorix_BI.`
        );
        return;
      }

      if (validRows === 0) {
        onError(
          'Nenhum registro válido foi encontrado no CSV. Confira a coluna Protocolo na exportação.'
        );
        return;
      }

      const percAtrasoVal = percentOf(atrasados, noPrazo + atrasados);

      const stats: CsvStats = {
        fileName: file.name,
        totalLinhas,
        protocolosUnicos: protocolosUnicos.size,
        devolucoes,
        atrasados,
        noPrazo,
        emAndamento,
        percAtraso: percAtrasoVal,
        periodoIni: minDate || 'N/I',
        periodoFim: maxDate || 'N/I',
        naturezas: Array.from(naturezas).slice(0, 3),
      };

      onPreview(stats, []);
    },
    error: (err) => {
      onError(`Erro ao ler o arquivo CSV: ${err.message}`);
    },
  });
}

export type InsertBatchFn = (
  rows: BiCsvRow[]
) => Promise<{ success: boolean; count?: number; error?: string }>;

async function executarLote(batch: BiCsvRow[], insertBatch: InsertBatchFn) {
  const result = await insertBatch(batch);
  if (!result?.success) {
    throw new Error(result?.error || 'Falha ao inserir lote de dados.');
  }
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
  insertBatch: InsertBatchFn;
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
      await executarLote(batch, insertBatch);
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
  insertBatch: InsertBatchFn;
  onProgress?: (processed: number, estimatedTotal: number) => void | Promise<void>;
}) {
  return new Promise<{ totalProcessed: number }>((resolve, reject) => {
    const lerLinha = criarLeitorDeLinhas();
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
          await executarLote(batch, insertBatch);

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

    Papa.parse(file, {
      ...PAPA_PARSE_CONFIG,
      chunk: (results, parser) => {
        parser.pause();

        Promise.resolve()
          .then(async () => {
            for (const rawRow of linhasDoChunk(results)) {
              const normalizedRow = lerLinha(rawRow);

              if (!normalizedRow || !protocoloValido(normalizedRow.Protocolo)) {
                continue;
              }

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
    <div
      style={{
        background: '#f8fafc',
        border: '2px dashed #cbd5e1',
        padding: '24px',
        borderRadius: '16px',
        marginTop: '20px',
      }}
    >
      <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>
        📊 Preview: {stats.fileName}
      </h3>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        ✅ Total de linhas: <b>{formatNumber(stats.totalLinhas)}</b>
      </p>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        📄 Protocolos únicos: <b>{formatNumber(stats.protocolosUnicos)}</b>
      </p>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        ⚠️ Devoluções: <b>{formatNumber(stats.devolucoes)}</b>
      </p>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        🟢 No Prazo: <b>{formatNumber(stats.noPrazo)}</b> | 🔴 Atrasados:{' '}
        <b>
          {formatNumber(stats.atrasados)} ({stats.percAtraso}%)
        </b>
      </p>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        📅 Período: <b>{stats.periodoIni}</b> até <b>{stats.periodoFim}</b>
      </p>

      {isImporting && (
        <div style={{ marginTop: '16px', marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            <span>{importStatusMsg}</span>
            <span>{uploadProgress.toFixed(1)}%</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '10px',
              background: '#e2e8f0',
              borderRadius: '5px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${uploadProgress}%`,
                height: '100%',
                background: '#10b981',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={onCancel}
          disabled={isImporting}
          style={{
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            padding: '10px 20px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: isImporting ? 'not-allowed' : 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={isImporting}
          style={{
            background: isImporting ? '#94a3b8' : '#002B49',
            color: '#ffffff',
            padding: '10px 24px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            fontSize: '13px',
            cursor: isImporting ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 12px rgba(0, 43, 73, 0.25)',
          }}
        >
          {isImporting ? 'Importando...' : 'Confirmar e Importar para Supabase'}
        </button>
      </div>
    </div>
  );
}

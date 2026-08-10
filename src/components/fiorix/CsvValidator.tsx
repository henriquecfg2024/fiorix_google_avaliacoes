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

function limparCelula(value: unknown) {
  return typeof value === 'string' ? value.replace(/^\uFEFF/, '').trim() : '';
}

function normalizarCabecalho(value: unknown) {
  return limparCelula(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

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

function normalizarLinha(row: Record<string, string>): BiCsvRow {
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

function toPreviewDateString(value?: string | null) {
  const parsed = parseDateValue(value);
  return parsed ? parsed.toISOString().slice(0, 10) : null;
}

export function validarCSV(
  file: File,
  onPreview: (stats: CsvStats, rows: BiCsvRow[]) => void,
  onError: (msg: string) => void
) {
  let detectedHeaders = HEADER_FIORIX;
  let isHeader = false;
  let firstDataRowResolved = false;
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
    header: false,
    delimiter: ';',
    skipEmptyLines: false,
    encoding: 'UTF-8',
    quoteChar: '"',
    escapeChar: '"',
    worker: false,
    chunkSize: 1024 * 1024 * 4,
    transform: (val: string) => limparCelula(val),
    chunk: (results) => {
      const rawRows = ((results.data as string[][]) || []).filter(linhaTemConteudo);

      for (const rawRow of rawRows) {
        const cleanedRow = rawRow.map((cell) => limparCelula(cell));

        if (!firstDataRowResolved) {
          isHeader = detectarCabecalho(cleanedRow);
          detectedHeaders = isHeader ? cleanedRow : HEADER_FIORIX;
          firstDataRowResolved = true;

          if (isHeader) {
            continue;
          }
        }

        totalLinhas += 1;

        const mappedRow = mapearLinhaBruta(cleanedRow, detectedHeaders, isHeader);
        const normalizedRow = normalizarLinha(mappedRow);

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

      const percAtrasoVal =
        noPrazo + atrasados > 0 ? (atrasados / (noPrazo + atrasados)) * 100 : 0;

      const stats: CsvStats = {
        fileName: file.name,
        totalLinhas,
        protocolosUnicos: protocolosUnicos.size,
        devolucoes,
        atrasados,
        noPrazo,
        emAndamento,
        percAtraso: percAtrasoVal.toFixed(1),
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
    let detectedHeaders = HEADER_FIORIX;
    let isHeader = false;
    let firstDataRowResolved = false;
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

    Papa.parse(file, {
      header: false,
      delimiter: ';',
      skipEmptyLines: false,
      encoding: 'UTF-8',
      quoteChar: '"',
      escapeChar: '"',
      worker: false,
      chunkSize: 1024 * 1024 * 4,
      transform: (val: string) => limparCelula(val),
      chunk: (results, parser) => {
        parser.pause();

        Promise.resolve()
          .then(async () => {
            const rawRows = ((results.data as string[][]) || []).filter(linhaTemConteudo);

            for (const rawRow of rawRows) {
              const cleanedRow = rawRow.map((cell) => limparCelula(cell));

              if (!firstDataRowResolved) {
                isHeader = detectarCabecalho(cleanedRow);
                detectedHeaders = isHeader ? cleanedRow : HEADER_FIORIX;
                firstDataRowResolved = true;

                if (isHeader) {
                  continue;
                }
              }

              const mappedRow = mapearLinhaBruta(cleanedRow, detectedHeaders, isHeader);
              const normalizedRow = normalizarLinha(mappedRow);

              if (!protocoloValido(normalizedRow.Protocolo)) {
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

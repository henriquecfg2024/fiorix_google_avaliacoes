import Papa from 'papaparse';

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

export async function importarCSVEmLotes({
  file,
  batchSize = 5000,
  estimatedTotal,
  insertBatch,
  onProgress,
}: {
  file: File;
  batchSize?: number;
  estimatedTotal: number;
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

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    const flushBuffer = async () => {
      if (rowBuffer.length === 0) return;

      const batch = rowBuffer.splice(0, rowBuffer.length);
      const { success, error } = await insertBatch(batch);

      if (!success) {
        throw new Error(error || 'Falha ao inserir lote de dados.');
      }

      totalProcessed += batch.length;

      if (onProgress) {
        await onProgress(totalProcessed, estimatedTotal);
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

            await flushBuffer();

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
        ✅ Total de linhas: <b>{stats.totalLinhas.toLocaleString('pt-BR')}</b>
      </p>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        📄 Protocolos únicos: <b>{stats.protocolosUnicos.toLocaleString('pt-BR')}</b>
      </p>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        ⚠️ Devoluções: <b>{stats.devolucoes.toLocaleString('pt-BR')}</b>
      </p>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        🟢 No Prazo: <b>{stats.noPrazo.toLocaleString('pt-BR')}</b> | 🔴 Atrasados:{' '}
        <b>
          {stats.atrasados.toLocaleString('pt-BR')} ({stats.percAtraso}%)
        </b>{' '}
        <span style={{ color: '#dc2626', fontWeight: 600 }}>
          (explica os 22% de reclamações no Google)
        </span>
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
            <span>{uploadProgress}%</span>
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

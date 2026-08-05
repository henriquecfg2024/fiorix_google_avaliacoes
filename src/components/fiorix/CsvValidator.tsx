import Papa from 'papaparse';

export const COLUNAS_OBRIGATORIAS = [
  'Protocolo',
  'FlagRecepcao',
  'TipoSolicitacao',
  'IdAndamento',
  'DtProtocolo',
  'DtPrevisaoEntrega',
  'DtAndamento',
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

export function validarCSV(
  file: File,
  onPreview: (stats: CsvStats, rows: any[]) => void,
  onError: (msg: string) => void
) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
    delimiter: '', // auto-detect
    transformHeader: (h: string) => h.replace(/^\uFEFF/, '').trim().replace(/"/g, ''),
    complete: (results) => {
      let rows = results.data as any[];
      let headers = results.meta.fields || [];

      // 3. Suporte para ; : se headers.length === 1 e o primeiro header contém ";"
      if (headers.length === 1 && headers[0].includes(';')) {
        const rawDelimiter = ';';
        // Re-parse with semicolon delimiter
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          delimiter: rawDelimiter,
          transformHeader: (h: string) => h.replace(/^\uFEFF/, '').trim().replace(/"/g, ''),
          complete: (reResults) => {
            processParsedResults(reResults.data as any[], reResults.meta.fields || []);
          },
          error: (err) => {
            onError(`Erro ao processar CSV com separador ponto e vírgula (;): ${err.message}`);
          },
        });
        return;
      }

      processParsedResults(rows, headers);

      function processParsedResults(parsedRows: any[], parsedHeaders: string[]) {
        // 4. Log no console
        console.log('Headers detectados:', parsedHeaders);

        // 1. Quantidade de linhas
        if (parsedRows.length < 10) {
          onError(`Arquivo com ${parsedRows.length} linhas. Exporte novamente o resultado completo da pr_Fiorix_BI.`);
          return;
        }

        // 2. Colunas obrigatórias com normalização BOM e case-insensitive
        const headersNorm = parsedHeaders.map((h) => h.trim().replace(/^\uFEFF/, ''));
        const headersLower = headersNorm.map((h) => h.toLowerCase());
        const obrigatoriasLower = COLUNAS_OBRIGATORIAS.map((c) => c.toLowerCase());
        
        const faltantes = COLUNAS_OBRIGATORIAS.filter(
          (_, i) => !headersLower.includes(obrigatoriasLower[i])
        );

        if (faltantes.length > 0) {
          onError(`Colunas faltando: ${faltantes.join(', ')}`);
          return;
        }

        // Helper to retrieve column value case-insensitively
        const getVal = (r: any, col: string) => {
          if (!r) return undefined;
          if (r[col] !== undefined) return r[col];
          const key = Object.keys(r).find(
            (k) => k.trim().replace(/^\uFEFF/, '').toLowerCase() === col.toLowerCase()
          );
          return key ? r[key] : undefined;
        };

        // 3. Tem SituacaoPrazo?
        const temSituacao = parsedRows.some((r) => {
          const val = String(getVal(r, 'SituacaoPrazo') || '').trim();
          return ['noprazo', 'atrasado', 'devolucao', 'emandamento'].includes(val.toLowerCase());
        });

        if (!temSituacao) {
          onError(`Coluna SituacaoPrazo sem valores NoPrazo/Atrasado/Devolucao. Verifique se o CSV é da pr_Fiorix_BI corrigida.`);
          return;
        }

        // 4. PREVIEW INTELIGENTE
        const validRows = parsedRows.filter((r) => {
          const p = String(getVal(r, 'Protocolo') || '').trim();
          return p && p !== '0' && p.toLowerCase() !== 'protocolo';
        });

        const protocolosUnicos = new Set(validRows.map((r) => String(getVal(r, 'Protocolo') || '').trim())).size;

        const devolucoes = validRows.filter((r) => {
          const isDev = getVal(r, 'IsDevolucao');
          const sit = String(getVal(r, 'SituacaoPrazo') || '').toLowerCase();
          return isDev === '1' || isDev === 'true' || isDev === true || sit.includes('devolucao');
        }).length;

        const atrasados = validRows.filter((r) => {
          const sit = String(getVal(r, 'SituacaoPrazo') || '').toLowerCase();
          const diasAtraso = parseInt(String(getVal(r, 'DiasAtraso') || '0'), 10);
          return sit === 'atrasado' || diasAtraso > 0;
        }).length;

        const noPrazo = validRows.filter((r) => {
          const sit = String(getVal(r, 'SituacaoPrazo') || '').toLowerCase();
          return sit === 'noprazo';
        }).length;

        const emAndamento = validRows.filter((r) => {
          const sit = String(getVal(r, 'SituacaoPrazo') || '').toLowerCase();
          return sit === 'emandamento';
        }).length;

        const datas = validRows
          .map((r) => getVal(r, 'DtAndamento'))
          .filter(Boolean)
          .sort();

        const natSet = new Set<string>();
        validRows.forEach((r) => {
          const nat = getVal(r, 'Natureza');
          if (nat) natSet.add(String(nat).trim());
        });

        const percAtrasoVal = (noPrazo + atrasados) > 0 ? (atrasados / (noPrazo + atrasados)) * 100 : 0;

        const stats: CsvStats = {
          fileName: file.name,
          totalLinhas: parsedRows.length,
          protocolosUnicos,
          devolucoes,
          atrasados,
          noPrazo,
          emAndamento,
          percAtraso: percAtrasoVal.toFixed(1),
          periodoIni: datas[0] ? String(datas[0]).split('T')[0] : 'N/I',
          periodoFim: datas.length > 0 ? String(datas[datas.length - 1]).split('T')[0] : 'N/I',
          naturezas: Array.from(natSet).slice(0, 3),
        };

        onPreview(stats, validRows);
      }
    },
    error: (err) => {
      onError(`Erro ao ler o arquivo CSV: ${err.message}`);
    },
  });
}

// Card de Preview para mostrar ANTES de confirmar
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
        ⚠️ Devoluções: <b>{stats.devolucoes}</b>
      </p>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        🟢 No Prazo: <b>{stats.noPrazo}</b> | 🔴 Atrasados: <b>{stats.atrasados} ({stats.percAtraso}%)</b>{' '}
        <span style={{ color: '#dc2626', fontWeight: 600 }}>(explica os 22% de reclamações no Google)</span>
      </p>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        📅 Período: <b>{stats.periodoIni}</b> até <b>{stats.periodoFim}</b>
      </p>

      {/* Progress Bar during upload */}
      {isImporting && (
        <div style={{ marginTop: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            <span>{importStatusMsg}</span>
            <span>{uploadProgress}%</span>
          </div>
          <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#10b981', transition: 'width 0.3s' }} />
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

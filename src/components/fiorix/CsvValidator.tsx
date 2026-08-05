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

export function validarCSV(
  file: File,
  onPreview: (stats: CsvStats, rows: any[]) => void,
  onError: (msg: string) => void
) {
  Papa.parse(file, {
    header: false,
    delimiter: ';', // SSMS Save Results As CSV delimiter
    skipEmptyLines: false, // Preserva TextoNotaDevolucao com quebras de linha
    encoding: 'UTF-8',
    quoteChar: '"',
    escapeChar: '"',
    transform: (val: string) => (val ? val.replace(/^\uFEFF/, '').trim() : ''),
    complete: (results) => {
      let rawRows = (results.data as string[][]) || [];

      // Filtrar linhas completamente vazias
      rawRows = rawRows.filter(
        (r) => Array.isArray(r) && r.some((cell) => cell !== undefined && cell !== null && cell !== '')
      );

      if (rawRows.length === 0) {
        onError('O arquivo CSV está vazio. Exporte novamente o resultado da pr_Fiorix_BI.');
        return;
      }

      console.log('Headers/Primeira linha detectada:', rawRows[0]);

      // 1. Detectar se a primeira linha é Cabeçalho ou Dado
      const firstCell = String(rawRows[0][0] || '').trim();
      const isHeader =
        firstCell.toLowerCase().includes('protocolo') ||
        !/^\d+$/.test(firstCell.replace(/\D/g, ''));

      let dataRows = rawRows;
      let detectedHeaders = HEADER_FIORIX;

      if (isHeader && !/^\d+$/.test(firstCell)) {
        detectedHeaders = rawRows[0].map((h) => h.replace(/^\uFEFF/, '').trim());
        dataRows = rawRows.slice(1);
      }

      console.log('Quantidade de linhas de dados:', dataRows.length);

      if (dataRows.length < 10) {
        onError(
          `Arquivo com apenas ${dataRows.length} linhas. Exporte novamente o resultado completo da pr_Fiorix_BI.`
        );
        return;
      }

      // Mapear cada linha para a ordem do HEADER_FIORIX
      const mappedRows = dataRows.map((r) => {
        const rowObj: Record<string, any> = {};
        if (!isHeader || detectedHeaders.length < 10) {
          HEADER_FIORIX.forEach((colName, idx) => {
            rowObj[colName] = r[idx] !== undefined ? r[idx] : '';
          });
        } else {
          detectedHeaders.forEach((colName, idx) => {
            rowObj[colName] = r[idx] !== undefined ? r[idx] : '';
          });
          HEADER_FIORIX.forEach((h) => {
            if (rowObj[h] === undefined) {
              const matchKey = Object.keys(rowObj).find(
                (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === h.toLowerCase().replace(/[^a-z0-9]/g, '')
              );
              if (matchKey) rowObj[h] = rowObj[matchKey];
            }
          });
        }
        return rowObj;
      });

      const getVal = (r: any, col: string) => {
        if (!r) return undefined;
        if (r[col] !== undefined && r[col] !== '') return r[col];
        const key = Object.keys(r).find(
          (k) => k.trim().replace(/^\uFEFF/, '').toLowerCase() === col.toLowerCase()
        );
        return key ? r[key] : undefined;
      };

      // Filter valid rows with a valid protocol
      const validRows = mappedRows.filter((r) => {
        const p = String(getVal(r, 'Protocolo') || '').trim();
        return p && p !== '0' && p.toLowerCase() !== 'protocolo';
      });

      // Tratar tipos para envio ao Supabase
      const formattedRows = validRows.map((row) => {
        const getInt = (val: any) => {
          if (val === undefined || val === null || val === '') return null;
          const parsed = parseInt(String(val).replace(/\D/g, ''), 10);
          return isNaN(parsed) ? null : parsed;
        };

        const getBool = (val: any) => {
          if (val === undefined || val === null) return false;
          if (typeof val === 'boolean') return val;
          const s = String(val).trim().toLowerCase();
          return s === '1' || s === 'true' || s === 'sim';
        };

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
      });

      // Cálculo do Preview Inteligente
      const protocolosUnicos = new Set(
        formattedRows.map((r) => r.Protocolo)
      ).size;

      const devolucoes = formattedRows.filter((r) => {
        const sit = String(r.SituacaoPrazo || '').toLowerCase();
        return r.IsDevolucao || sit.includes('devolucao');
      }).length;

      const atrasados = formattedRows.filter((r) => {
        const sit = String(r.SituacaoPrazo || '').toLowerCase();
        return sit.includes('atrasad') || (r.DiasAtraso && r.DiasAtraso > 0);
      }).length;

      const noPrazo = formattedRows.filter((r) => {
        const sit = String(r.SituacaoPrazo || '').toLowerCase();
        return sit === 'noprazo';
      }).length;

      const emAndamento = formattedRows.filter((r) => {
        const sit = String(r.SituacaoPrazo || '').toLowerCase();
        return sit.includes('andamento');
      }).length;

      const datas = formattedRows
        .map((r) => r.DtAndamento || r.DtProtocolo)
        .filter(Boolean)
        .sort();

      const natSet = new Set<string>();
      formattedRows.forEach((r) => {
        if (r.Natureza) natSet.add(r.Natureza.trim());
      });

      const percAtrasoVal =
        noPrazo + atrasados > 0 ? (atrasados / (noPrazo + atrasados)) * 100 : 0;

      const stats: CsvStats = {
        fileName: file.name,
        totalLinhas: dataRows.length,
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

      onPreview(stats, formattedRows);
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
        ⚠️ Devoluções: <b>{stats.devolucoes.toLocaleString('pt-BR')}</b>
      </p>
      <p style={{ margin: '4px 0', fontSize: '14px', color: '#334155' }}>
        🟢 No Prazo: <b>{stats.noPrazo.toLocaleString('pt-BR')}</b> | 🔴 Atrasados: <b>{stats.atrasados.toLocaleString('pt-BR')} ({stats.percAtraso}%)</b>{' '}
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

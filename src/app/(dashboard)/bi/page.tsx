'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Papa from 'papaparse';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  Trash2,
  BarChart3,
  TrendingDown,
  Building2,
  RefreshCw,
  Info,
  XCircle,
  Calendar,
  FileText,
} from 'lucide-react';
import {
  createBiImport,
  insertBiBatch,
  deleteBiImport,
  updateBiImportStatus,
  BiRowInput,
} from '@/app/actions/bi';

import { importarLinhasEmLotes } from '@/components/fiorix/CsvValidator';

const COLUNAS_OBRIGATORIAS = [
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

export interface PreviewStats {
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

import { validarCSV, PreviewCard, CsvStats } from '@/components/fiorix/CsvValidator';

export default function FiorixBiPage() {
  const chartDefinitions = [
    ['1', 'Prazo de entrega'], ['2', 'Severidade do atraso'], ['3', 'Prazo prometido x corrido'],
    ['4', 'Evolução diária'], ['5', 'Andamentos com impacto'], ['6', 'Motivos de devolução'],
    ['7', 'Média por natureza'], ['8', 'Exceções legais - situação'], ['9', 'Exceções por natureza'],
    ['10', 'Exceções - andamentos'], ['11', 'Desempenho mensal'], ['12', 'Comparativo entre anos'],
  ];
  const defaultCharts = ['1', '2', '3', '4', '6', '11', '12'];
  const chartSettingsKey = 'fiorix-bi-enabled-charts-v2';
  // State for CSV Upload & Preview Stats
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BiRowInput[]>([]);
  const [previewStats, setPreviewStats] = useState<CsvStats | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [importStatusMsg, setImportStatusMsg] = useState<string>('');

  // State for Dashboard Analytics
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [importsList, setImportsList] = useState<any[]>([]);
  const dashboardRequestRef = useRef<AbortController | null>(null);
  const dashboardRequestIdRef = useRef(0);
  const manualImportSelectionRef = useRef(false);

  // State for Dashboard Filters
  const [selectedImportId, setSelectedImportId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTipoPrenotacao, setSelectedTipoPrenotacao] = useState<string>('ALL');
  const [enabledCharts, setEnabledCharts] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultCharts;
    try {
      const saved = JSON.parse(window.localStorage.getItem(chartSettingsKey) || 'null');
      return Array.isArray(saved) && saved.length > 0 ? saved : defaultCharts;
    } catch {
      return defaultCharts;
    }
  });
  const [showChartSettings, setShowChartSettings] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(chartSettingsKey, JSON.stringify(enabledCharts));
  }, [enabledCharts]);

  const toggleChart = (id: string) => {
    setEnabledCharts((current) => {
      if (current.includes(id)) {
        return current.length === 1 ? current : current.filter((chartId) => chartId !== id);
      }
      return [...current, id];
    });
  };

  // Load Dashboard & Imports History
  const fetchDashboard = useCallback(async () => {
    dashboardRequestRef.current?.abort();
    const controller = new AbortController();
    dashboardRequestRef.current = controller;
    const requestId = ++dashboardRequestIdRef.current;
    setLoadingDashboard(true);
    setDashboardError(null);

    try {
      const params = new URLSearchParams();
      if (selectedImportId && selectedImportId !== 'ALL') params.set('importId', selectedImportId);
      const hasHistoricalChart = enabledCharts.includes('11') || enabledCharts.includes('12');
      if (selectedImportId === 'ALL' && !hasHistoricalChart && !manualImportSelectionRef.current) {
        // Gráficos operacionais não precisam reprocessar os cinco anos.
        // O usuário ainda pode escolher "Todas as Importações" manualmente.
        params.set('importId', 'LATEST');
      }
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedTipoPrenotacao && selectedTipoPrenotacao !== 'ALL') {
        params.set('tipoPrenotacao', selectedTipoPrenotacao);
      }
      params.set('charts', enabledCharts.join(','));

      const response = await fetch(`/api/bi/dashboard?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });

      const responseText = await response.text();
      let payload: any;
      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new Error(
          response.ok
            ? 'A resposta do servidor não está em formato JSON.'
            : `O servidor retornou erro HTTP ${response.status}.`
        );
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Erro ao carregar dashboard BI');
      }

      if (requestId !== dashboardRequestIdRef.current) return;
      setDashboardData(payload.dashboard || null);
      setImportsList(payload.imports || []);
      if (selectedImportId === 'ALL' && !hasHistoricalChart && !manualImportSelectionRef.current && payload.imports?.[0]?.id) {
        setSelectedImportId(payload.imports[0].id);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Erro ao buscar dashboard BI no cliente:', error);
      if (requestId !== dashboardRequestIdRef.current) return;
      setDashboardData(null);
      setDashboardError(error?.message || 'Nao foi possivel carregar os graficos do BI.');
    } finally {
      if (requestId === dashboardRequestIdRef.current) {
        setLoadingDashboard(false);
      }
    }
  }, [selectedImportId, startDate, endDate, selectedTipoPrenotacao, enabledCharts]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboard();
    }, 150);

    return () => {
      window.clearTimeout(timer);
      dashboardRequestRef.current?.abort();
    };
  }, [fetchDashboard]);

  // Reset upload form
  const handleCancelUpload = () => {
    setCsvFile(null);
    setParsedRows([]);
    setPreviewStats(null);
    setValidationError(null);
    setImportStatusMsg('');
  };

  // Handle File Selection with CsvValidator
  const handleFileChange = (file: File) => {
    if (!file) return;
    setCsvFile(file);
    setIsParsing(true);
    setValidationError(null);
    setImportStatusMsg('');
    setPreviewStats(null);

    validarCSV(
      file,
      (stats, validRows) => {
        setPreviewStats(stats);
        setParsedRows(validRows);
        setIsParsing(false);
      },
      (errorMsg) => {
        setValidationError(errorMsg);
        setIsParsing(false);
      }
    );
  };

  // Drag and Drop handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Perform High-Performance Client-Side Streaming Batch Upsert (Handles 1.5M+ rows without memory overflow)
  const handleStartImport = async () => {
    if (!csvFile || !previewStats) return;

    setIsImporting(true);
    setUploadProgress(0);
    const estimatedTotal = previewStats.totalLinhas || 1491351;
    setImportStatusMsg(`Iniciando importação de ~${estimatedTotal.toLocaleString('pt-BR')} linhas...`);

    const createRes = await createBiImport(csvFile.name, estimatedTotal, 'Manual SSMS');
    if (!createRes.success || !createRes.importId) {
      setImportStatusMsg(`Falha ao iniciar importação: ${createRes.error}`);
      setIsImporting(false);
      return;
    }

    const importId = createRes.importId;
    let totalProcessed = 0;
    let rowBuffer: any[] = [];

    // validarCSV já normaliza o arquivo (inclusive CSVs exportados pelo SSMS
    // sem linha de cabeçalho). Reprocessar o arquivo com header:true fazia a
    // primeira linha virar o cabeçalho e resultava em zero linhas inseridas.
    try {
    const rows = parsedRows as BiRowInput[];
    if (rows.length === 0) throw new Error('Nenhum registro válido encontrado no CSV.');

    const importResult = await importarLinhasEmLotes({
      rows,
      batchSize: 1000,
      concurrency: 3,
      insertBatch: (batch) => insertBiBatch(importId, batch),
      onProgress: (processed, total) => {
        totalProcessed = processed;
        const pct = Math.min(99, Number(((processed / total) * 100).toFixed(1)));
        setUploadProgress(pct);
        setImportStatusMsg(
          `Importando ${processed.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} linhas (${pct.toFixed(1)}%)`
        );
      },
    });

    totalProcessed = importResult.totalProcessed;
    await updateBiImportStatus(importId, 'SUCCESS');

    {
      const pct = 99;
      setUploadProgress(pct);
    }

      setUploadProgress(100);
      setImportStatusMsg(`Importação concluída! ${totalProcessed.toLocaleString('pt-BR')} registros inseridos.`);
      setIsImporting(false);
      setTimeout(() => {
        handleCancelUpload();
        fetchDashboard();
      }, 800);
      return;
    } catch (e: any) {
      console.error('Erro ao inserir importação BI:', e);
      await deleteBiImport(importId);
      alert(`Erro na importação: ${e.message || e}`);
      setImportStatusMsg(`Erro na importação: ${e.message || e}`);
      setIsImporting(false);
      return;
    }

    Papa.parse(csvFile, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      encoding: 'UTF-8',
      quoteChar: '"',
      escapeChar: '"',
      worker: false,
      chunkSize: 1024 * 1024 * 5, // 5MB streaming chunks
      chunk: async (results, parser) => {
        parser.pause();

        try {
          const rawRows = (results.data as any[]) || [];
          const dbRows = rawRows
            .filter((row) => row && (row.Protocolo || row[Object.keys(row)[0]]))
            .map((row) => {
              const getVal = (col: string) => {
                if (row[col] !== undefined && row[col] !== null) return String(row[col]).trim();
                const key = Object.keys(row).find(
                  (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === col.toLowerCase().replace(/[^a-z0-9]/g, '')
                );
                return key ? String(row[key]).trim() : '';
              };

              const getInt = (val: string) => {
                if (!val) return null;
                const p = parseInt(val.replace(/\D/g, ''), 10);
                return isNaN(p) ? null : p;
              };

              const getBool = (val: string) => {
                const lower = val.toLowerCase();
                return lower === '1' || lower === 'true' || lower === 'sim';
              };

              const parseDate = (val: string | null) => {
                if (!val) return null;
                let d = new Date(val);
                if (isNaN(d.getTime())) {
                  const parts = val.split('/');
                  if (parts.length === 3) {
                    const day = parts[0];
                    const month = parts[1];
                    const yearTime = parts[2].split(' ');
                    const year = yearTime[0];
                    const time = yearTime[1] || '00:00:00';
                    d = new Date(`${year}-${month}-${day}T${time}`);
                  }
                }
                return isNaN(d.getTime()) ? null : d.toISOString();
              };

              return {
                import_id: importId,
                Protocolo: getVal('Protocolo'),
                FlagRecepcao: getInt(getVal('FlagRecepcao')),
                TipoSolicitacao: getVal('TipoSolicitacao') || null,
                IdAndamento: getVal('IdAndamento') ? String(getVal('IdAndamento')).replace(/\D/g, '') : null,
                DtProtocolo: parseDate(getVal('DtProtocolo') || getVal('DataProtocolo')),
                DtPrevisaoEntrega: parseDate(getVal('DtPrevisaoEntrega')),
                DtAndamento: parseDate(getVal('DtAndamento')),
                CodProcessamento: getInt(getVal('CodProcessamento')),
                DescAndamento: getVal('DescAndamento') || null,
                Natureza: getVal('Natureza') || null,
                TipoPrenotacao: getVal('TipoPrenotacao') || null,
                DiasPrometidos: getInt(getVal('DiasPrometidos')),
                DiasCorridos: getInt(getVal('DiasCorridos')),
                DiasAtraso: getInt(getVal('DiasAtraso')),
                SituacaoPrazo: getVal('SituacaoPrazo') || null,
                IsDevolucao: getBool(getVal('IsDevolucao')),
                IsRegistrado: getBool(getVal('IsRegistrado')),
                TextoNotaDevolucao: getVal('TextoNotaDevolucao') || null,
              };
            })
            .filter((r) => r.Protocolo && r.Protocolo !== '0' && r.Protocolo.toLowerCase() !== 'protocolo');

          rowBuffer.push(...dbRows);

          // Direct client-side upsert to Supabase in batches of 1,000 lines
          const batchSize = 1000;
          while (rowBuffer.length >= batchSize) {
            const batch = rowBuffer.splice(0, batchSize);
            const { success, error } = await insertBiBatch(importId, batch as BiRowInput[]);
            if (!success) throw new Error(error);

            totalProcessed += batch.length;
            const pct = Math.min(99, Math.round((totalProcessed / estimatedTotal) * 100));
            setUploadProgress(pct);
            setImportStatusMsg(
              `Importando ${totalProcessed.toLocaleString('pt-BR')} / ${estimatedTotal.toLocaleString('pt-BR')} linhas (${pct}%)`
            );
          }
        } catch (e: any) {
          console.error(e);
          alert(`Erro na importação: ${e.message || e}`);
          setImportStatusMsg(`Erro na importação: ${e.message || e}`);
          parser.abort();
          setIsImporting(false);
          return;
        }

        parser.resume();
      },
      complete: async () => {
        try {
          if (rowBuffer.length > 0) {
            const { success, error } = await insertBiBatch(importId, rowBuffer as BiRowInput[]);
            if (!success) throw new Error(error);
            totalProcessed += rowBuffer.length;
            rowBuffer = [];
          }

          setUploadProgress(100);
          setImportStatusMsg(`🎉 Importação concluída! ${totalProcessed.toLocaleString('pt-BR')} registros inseridos.`);
          setIsImporting(false);

          setTimeout(() => {
            handleCancelUpload();
            fetchDashboard();
          }, 1800);
        } catch (e: any) {
          console.error(e);
          alert(`Erro no encerramento da importação: ${e.message || e}`);
          setImportStatusMsg(`Erro no encerramento da importação: ${e.message || e}`);
          setIsImporting(false);
        }
      },
      error: (err) => {
        console.error('Streaming PapaParse error:', err);
        setImportStatusMsg(`Erro ao ler arquivo: ${err.message}`);
        setIsImporting(false);
      },
    });
  };

  // Handle Delete Import Run
  const handleDeleteImport = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lote de importação? Todos os dados associados serão removidos.')) return;
    await deleteBiImport(id);
    fetchDashboard();
  };

  return (
    <div style={{ padding: '24px 32px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ── TOP BANNER / HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #002B49 0%, #1e3a8a 100%)',
        borderRadius: '16px',
        padding: '24px 32px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(0, 43, 73, 0.3)',
        marginBottom: '28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px' }}>
              🏢 7º REGISTRO DE IMÓVEIS DE SP
            </span>
            <span style={{ background: '#10b981', color: '#ffffff', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
              SUPABASE ONLINE
            </span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, marginTop: '8px', marginBottom: '4px', letterSpacing: '-0.5px' }}>
            FIORIX BI · Módulo de Inteligência & Prazos
          </h1>
          <p style={{ color: '#93c5fd', fontSize: '14px', margin: 0, maxWidth: '680px' }}>
            Análise operacional de prazos da procedure <code style={{ background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>dbo.pr_Fiorix_BI</code>. Identificação científica de gargalos para redução de reclamações do Google Business.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => fetchDashboard()}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={16} className={loadingDashboard ? 'animate-spin' : ''} />
            Atualizar Dados
          </button>
          <Link
            href="/bi/importar"
            style={{
              background: '#10b981',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textDecoration: 'none'
            }}
          >
            ➕ Importar Novos Dados
          </Link>
        </div>
      </div>

      {/* ── SECTION 2: FILTERS BAR ── */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #dbeafe', padding: '16px 24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#002B49', fontSize: '14px', fontWeight: 800 }}>Gráficos exibidos</div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              {enabledCharts.length} de {chartDefinitions.length} gráficos ativos. Desative o que não utiliza para reduzir o tempo de carregamento.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setEnabledCharts(defaultCharts)}
              style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', padding: '9px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
            >
              Restaurar padrão
            </button>
            <button
              onClick={() => setShowChartSettings((current) => !current)}
              style={{ background: showChartSettings ? '#dbeafe' : '#2563eb', border: '1px solid #2563eb', color: showChartSettings ? '#1d4ed8' : '#ffffff', padding: '9px 14px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
            >
              {showChartSettings ? 'Fechar seleção' : 'Escolher gráficos'}
            </button>
          </div>
        </div>

        {showChartSettings && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
            {chartDefinitions.map(([id, label]) => (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#334155', fontSize: '12px', cursor: 'pointer', background: enabledCharts.includes(id) ? '#eff6ff' : '#f8fafc' }}>
                <input type="checkbox" checked={enabledCharts.includes(id)} onChange={() => toggleChart(id)} />
                <span><strong>Gráfico {id}</strong> · {label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#002B49', fontSize: '14px' }}>
          <Filter size={18} /> Filtros de Análise:
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Import Lote Selector */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>LOTE IMPORTADO</label>
            <select
              value={selectedImportId}
              onChange={(e) => {
                manualImportSelectionRef.current = true;
                setSelectedImportId(e.target.value);
              }}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff', color: '#0f172a' }}
            >
              <option value="ALL">Todas as Importações</option>
              {importsList.map((imp) => (
                <option key={imp.id} value={imp.id}>
                  {imp.fileName} ({new Date(imp.importedAt).toLocaleDateString('pt-BR')}) - {imp.rowsCount} rows
                </option>
              ))}
            </select>
          </div>

          {/* Date Start */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>DATA INICIAL (DtAndamento)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a' }}
            />
          </div>

          {/* Date End */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>DATA FINAL (DtAndamento)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a' }}
            />
          </div>

          {/* TipoPrenotacao Selector */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>TIPO PRENOTAÇÃO</label>
            <select
              value={selectedTipoPrenotacao}
              onChange={(e) => setSelectedTipoPrenotacao(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff', color: '#0f172a' }}
            >
              <option value="ALL">Todos os Tipos</option>
              {(dashboardData?.tiposPrenotacao || []).map((tp: string) => (
                <option key={tp} value={tp}>{tp}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: KPI SUMMARY CARDS ── */}
      {dashboardData?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total de Títulos Analisados</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#002B49', marginTop: '6px' }}>
              {dashboardData.summary.totalRecords.toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              {dashboardData.summary.totalRegistered} com Registrado (Cod 6) · {dashboardData.summary.exceptionRecordsExcluded || 0} fora da régua geral
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>✓ Entregues No Prazo</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>
              {dashboardData.summary.percentNoPrazo}%
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              {dashboardData.summary.noPrazoCount} títulos dentro do limite legal
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #fee2e2', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>⚠️ Entregues em Atraso</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#ef4444', marginTop: '6px' }}>
              {dashboardData.summary.percentAtrasado}%
            </div>
            <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px', fontWeight: 600 }}>
              Causa das queixas no Google (22%)
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #fef3c7', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>📋 Devoluções / Exigências</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b', marginTop: '6px' }}>
              {dashboardData.summary.percentDevolucao}%
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              {dashboardData.summary.devolucaoCount} títulos com nota devolutiva na régua geral
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 4: RECHARTS DASHBOARD ── */}
      {dashboardData?.legalExceptions?.summary?.totalRecords > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '24px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Controle separado · Naturezas sem prazo legal
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#78350f', margin: '6px 0 6px' }}>
                Naturezas com previsão legal zero
              </h3>
              <p style={{ fontSize: '13px', color: '#92400e', margin: 0, maxWidth: '920px', lineHeight: 1.55 }}>
                Quando a tabela legal informa previsão igual a 0, o título fica fora da régua geral de prazo. O acompanhamento dessas naturezas permanece abaixo, em bloco próprio.
              </p>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '12px 14px', minWidth: '230px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#a16207', textTransform: 'uppercase' }}>Protocolos fora da régua</div>
              <div style={{ fontSize: '30px', fontWeight: 800, color: '#92400e', marginTop: '4px' }}>
                {dashboardData.legalExceptions.summary.totalProtocols.toLocaleString('pt-BR')}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#a16207', textTransform: 'uppercase' }}>Registros excepcionados</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#78350f', marginTop: '6px' }}>
                {dashboardData.legalExceptions.summary.totalRecords.toLocaleString('pt-BR')}
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#a16207', textTransform: 'uppercase' }}>Protocolos únicos</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#78350f', marginTop: '6px' }}>
                {dashboardData.legalExceptions.summary.totalProtocols.toLocaleString('pt-BR')}
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#a16207', textTransform: 'uppercase' }}>Em acompanhamento</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>
                {dashboardData.legalExceptions.summary.emAcompanhamento.toLocaleString('pt-BR')}
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#a16207', textTransform: 'uppercase' }}>Finalizados</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#1d4ed8', marginTop: '6px' }}>
                {dashboardData.legalExceptions.summary.finalizados.toLocaleString('pt-BR')}
              </div>
            </div>

            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#a16207', textTransform: 'uppercase' }}>Média de dias corridos</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#78350f', marginTop: '6px' }}>
                {dashboardData.legalExceptions.summary.avgDiasCorridos.toLocaleString('pt-BR')}
              </div>
              <div style={{ fontSize: '11px', color: '#a16207', marginTop: '4px' }}>
                pico de {dashboardData.legalExceptions.summary.maxDiasCorridos.toLocaleString('pt-BR')} dias
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            <div style={{ display: enabledCharts.includes('8') ? undefined : 'none', background: '#ffffff', borderRadius: '14px', border: '1px solid #fde68a', padding: '20px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#78350f', marginBottom: '4px' }}>
                Situação das exceções legais
              </h4>
              <p style={{ fontSize: '12px', color: '#92400e', marginBottom: '18px' }}>
                Acompanhamento separado entre itens ainda em curso e itens já finalizados.
              </p>

              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.legalExceptions.charts.statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={88}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {dashboardData.legalExceptions.charts.statusPieData.map((entry: any, index: number) => (
                        <Cell key={`legal-status-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any, name: any) => [`${value} registros`, String(name)]} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: enabledCharts.includes('9') ? undefined : 'none', background: '#ffffff', borderRadius: '14px', border: '1px solid #fde68a', padding: '20px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#78350f', marginBottom: '4px' }}>
                Volume por natureza excepcionada
              </h4>
              <p style={{ fontSize: '12px', color: '#92400e', marginBottom: '18px' }}>
                Quantidade de registros retirados da régua geral e mantidos em controle próprio.
              </p>

              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.legalExceptions.charts.porNatureza} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="natureza" tick={{ fontSize: 11 }} angle={-10} textAnchor="end" />
                    <YAxis />
                    <Tooltip formatter={(value: any, name: any) => [name === 'total' ? `${value} registros` : `${value} dias`, name === 'total' ? 'Quantidade' : 'Média de dias']} />
                    <Bar dataKey="total" fill="#d97706" radius={[6, 6, 0, 0]} name="Quantidade" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: enabledCharts.includes('10') ? undefined : 'none', background: '#ffffff', borderRadius: '14px', border: '1px solid #fde68a', padding: '20px', gridColumn: '1 / -1' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#78350f', marginBottom: '4px' }}>
                Andamentos mais frequentes nas exceções
              </h4>
              <p style={{ fontSize: '12px', color: '#92400e', marginBottom: '18px' }}>
                Visão operacional dos principais movimentos dentro das naturezas sem prazo legal fixo.
              </p>

              <div style={{ width: '100%', height: 260 }}>
                {dashboardData.legalExceptions.charts.topAndamentos.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a16207', fontSize: '13px' }}>
                    Nenhum andamento encontrado para as exceções legais selecionadas.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.legalExceptions.charts.topAndamentos} layout="vertical" margin={{ left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="andamento" type="category" width={180} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: any) => [`${value} registros`, 'Quantidade']} />
                      <Bar dataKey="count" fill="#92400e" radius={[0, 6, 6, 0]} name="Quantidade" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {dashboardData?.summary?.exceptionRecordsExcluded > 0 && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', padding: '16px 18px', marginBottom: '24px', color: '#1d4ed8' }}>
          Os indicadores gerais abaixo já desconsideram {dashboardData.summary.exceptionRecordsExcluded.toLocaleString('pt-BR')} registros de naturezas com previsão legal igual a 0.
        </div>
      )}

      {loadingDashboard ? (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          Carregando indicadores do Supabase...
        </div>
      ) : dashboardError ? (
        <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '16px', padding: '24px', color: '#9a3412', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertTriangle size={22} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
                Nao foi possivel carregar os graficos do BI
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                {dashboardError}
              </div>
            </div>
          </div>
        </div>
      ) : dashboardData?.charts ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          
          {/* Chart 1: Pie Chart - Delivery Deadlines for CodProcessamento = 6 */}
          <div style={{ display: enabledCharts.includes('1') ? undefined : 'none', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 1: Prazo de Entrega (Registrados - Cod 6)
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
              % No Prazo vs Atrasado vs Devolução. Diagnóstico direto dos 22% do Google.
            </p>

            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData.charts.pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {dashboardData.charts.pieChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [`${value} títulos`, String(name)]} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Delay Severity */}
          <div style={{ display: enabledCharts.includes('2') ? undefined : 'none', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 2: Severidade do Atraso
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
              Distribuição dos títulos com atraso por faixas de dias em atraso.
            </p>

            <div style={{ width: '100%', height: 260 }}>
              {dashboardData.charts.delaySeverity.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhuma ocorrência de atraso encontrada para os filtros selecionados.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.charts.delaySeverity} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`${value} títulos`, 'Quantidade']} />
                    <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} name="Títulos em atraso" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 3: Promised vs Actual Days by Natureza */}
          <div style={{ display: enabledCharts.includes('3') ? undefined : 'none', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 3: Prazo Prometido x Dias Corridos por Natureza
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
              Identifica quais tipos de títulos normalmente extrapolam o tempo previsto.
            </p>

            <div style={{ width: '100%', height: 260 }}>
              {dashboardData.charts.prazoPrometidoVsCorridosPorNatureza.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhum dado de prazo disponível para os filtros selecionados.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.charts.prazoPrometidoVsCorridosPorNatureza} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="natureza" tick={{ fontSize: 11 }} angle={-12} textAnchor="end" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [`${value} dias`, 'Média']} />
                    <Legend />
                    <Bar dataKey="prometidos" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Dias prometidos" />
                    <Bar dataKey="corridos" fill="#ef4444" radius={[6, 6, 0, 0]} name="Dias corridos" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 4: Daily trend */}
          <div style={{ display: enabledCharts.includes('4') ? undefined : 'none', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 4: Evolução Diária do Prazo de Entrega
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
              Mostra como o volume de entregas no prazo, em atraso e devoluções se comporta ao longo do período analisado.
            </p>

            <div style={{ width: '100%', height: 300 }}>
              {dashboardData.charts.evolucaoPrazoPorDia.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
                  Sem evolução diária para os filtros selecionados.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.charts.evolucaoPrazoPorDia} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="noPrazo" stroke="#10b981" strokeWidth={2} name="No prazo" />
                    <Line type="monotone" dataKey="atrasado" stroke="#ef4444" strokeWidth={2} name="Atrasado" />
                    <Line type="monotone" dataKey="devolucao" stroke="#f59e0b" strokeWidth={2} name="Devolução" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 5: Top Andamentos */}
          <div style={{ display: enabledCharts.includes('5') ? undefined : 'none', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 5: Andamentos com Maiores Impactos no Prazo
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
              Avalia os andamentos mais recorrentes e sua média de atraso associada.
            </p>

            <div style={{ width: '100%', height: 260 }}>
              {dashboardData.charts.topAndamentosComAtraso.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhum andamento com impacto de prazo encontrado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.charts.topAndamentosComAtraso} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="andamento" type="category" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any, name: any) => [name === 'mediaAtraso' ? `${value} dias` : `${value} títulos`, name === 'mediaAtraso' ? 'Média de atraso' : 'Quantidade']} />
                    <Bar dataKey="count" fill="#002B49" radius={[0, 6, 6, 0]} name="Quantidade" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 6: Top 10 Return Reasons */}
          <div style={{ display: enabledCharts.includes('6') ? undefined : 'none', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 6: Top 10 Motivos de Devolução
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
              Extraídos de <code style={{ background: '#f1f5f9', padding: '2px 4px' }}>TextoNotaDevolucao</code>.
            </p>

            <div style={{ width: '100%', height: 260 }}>
              {dashboardData.charts.topDevolucoes.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhum motivo de devolução encontrado para os filtros selecionados.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.charts.topDevolucoes} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="motivo" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#002B49" radius={[0, 6, 6, 0]} name="Ocorrências" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 7: Average Processing Days by Natureza */}
          <div style={{ display: enabledCharts.includes('7') ? undefined : 'none', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 7: Tempo Média (Dias Corridos) por Natureza do Título
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>
              Comparativo de duração média desde o protocolo até a entrega por tipo de ato (Escritura, Formal de Partilha, etc.).
            </p>

            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.charts.avgDiasPorNatureza} margin={{ top: 10, right: 30, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="natureza" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
                  <YAxis label={{ value: 'Média de Dias', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value: any) => [`${value} dias corridos em média`, 'Média de Dias']} />
                  <Bar dataKey="mediaDias" fill="#1e3a8a" radius={[6, 6, 0, 0]} name="Média Dias Corridos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 11: Historical monthly performance */}
          <div style={{ display: enabledCharts.includes('11') ? undefined : 'none', background: '#ffffff', borderRadius: '16px', border: '1px solid #bfdbfe', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 11: Percentual mensal de títulos no prazo e atrasados
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              Acompanha a evolução mensal dos títulos prontos dentro do prazo de previsão, excluindo devoluções.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '18px' }}>
              <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: '#1d4ed8', fontSize: '11px', fontWeight: 700 }}>Média histórica</div>
                <div style={{ color: '#1e3a8a', fontSize: '22px', fontWeight: 800 }}>{dashboardData.historical.summary.overallPercent}%</div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: '#166534', fontSize: '11px', fontWeight: 700 }}>Últimos 12 meses</div>
                <div style={{ color: '#15803d', fontSize: '22px', fontWeight: 800 }}>{dashboardData.historical.summary.recentPercent}%</div>
              </div>
              <div style={{ background: '#fff7ed', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: '#9a3412', fontSize: '11px', fontWeight: 700 }}>Meta sugerida</div>
                <div style={{ color: '#c2410c', fontSize: '22px', fontWeight: 800 }}>{dashboardData.historical.summary.targetPercent}%</div>
              </div>
              <div style={{ background: '#fefce8', borderRadius: '10px', padding: '12px' }}>
                <div style={{ color: '#854d0e', fontSize: '11px', fontWeight: 700 }}>Melhor ano</div>
                <div style={{ color: '#a16207', fontSize: '22px', fontWeight: 800 }}>{dashboardData.historical.summary.bestYear || '—'}</div>
              </div>
            </div>

            <div style={{ width: '100%', height: 330 }}>
              {dashboardData.historical.monthly.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhum histórico mensal encontrado para os filtros selecionados.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.historical.monthly} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value: any) => [`${value}%`, 'Percentual']} />
                    <Legend />
                    <Line type="monotone" dataKey="percentNoPrazo" stroke="#10b981" strokeWidth={3} dot={false} name="No prazo" />
                    <Line type="monotone" dataKey="percentAtrasados" stroke="#ef4444" strokeWidth={2} dot={false} name="Atrasados" />
                    <Line type="monotone" dataKey="metaPercent" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 6" dot={false} name="Meta sugerida" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 12: Same month comparison across years */}
          <div style={{ display: enabledCharts.includes('12') ? undefined : 'none', background: '#ffffff', borderRadius: '16px', border: '1px solid #c7d2fe', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 12: Comparação do mesmo mês entre os anos
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              Compare Janeiro/2020 com Janeiro/2021, Janeiro/2022 e os demais anos disponíveis para identificar o melhor desempenho.
            </p>

            <div style={{ width: '100%', height: 320 }}>
              {dashboardData.historical.years.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>
                  Nenhum ano disponível para comparação.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.historical.comparison} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value: any, name: any) => [value == null ? 'Sem dados' : `${value}%`, `Ano ${name}`]} />
                    <Legend />
                    {dashboardData.historical.years.map((year: number, index: number) => (
                      <Line key={year} type="monotone" dataKey={String(year)} stroke={['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#059669', '#0891b2'][index % 6]} strokeWidth={2} connectNulls dot={{ r: 3 }} name={String(year)} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '560px' }}>
                <thead>
                  <tr style={{ background: '#eef2ff', color: '#3730a3' }}>
                    <th style={{ textAlign: 'left', padding: '9px' }}>Mês</th>
                    {dashboardData.historical.years.map((year: number) => <th key={year} style={{ textAlign: 'right', padding: '9px' }}>{year}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.historical.comparison.map((row: any) => (
                    <tr key={row.mes} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', fontWeight: 700, color: '#334155' }}>{row.nome}</td>
                      {dashboardData.historical.years.map((year: number) => (
                        <td key={year} style={{ padding: '8px', textAlign: 'right', color: row[String(year)] == null ? '#94a3b8' : '#0f172a' }}>
                          {row[String(year)] == null ? '—' : `${row[String(year)]}%`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', textAlign: 'center', color: '#64748b' }}>
          Nenhum dado encontrado para os filtros selecionados.
        </div>
      )}

    </div>
  );
}

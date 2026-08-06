'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
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
  getBiDashboardData,
  getBiImportsList,
  deleteBiImport,
  BiRowInput,
} from '@/app/actions/bi';
import { supabase } from '@/lib/supabase';


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
  const [importsList, setImportsList] = useState<any[]>([]);

  // State for Dashboard Filters
  const [selectedImportId, setSelectedImportId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTipoPrenotacao, setSelectedTipoPrenotacao] = useState<string>('ALL');

  // Load Dashboard & Imports History
  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    const [dashRes, importsRes] = await Promise.all([
      getBiDashboardData({
        importId: selectedImportId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        tipoPrenotacao: selectedTipoPrenotacao || undefined,
      }),
      getBiImportsList(),
    ]);

    if (dashRes.success) {
      setDashboardData(dashRes);
    }
    if (importsRes.success) {
      setImportsList(importsRes.imports || []);
    }
    setLoadingDashboard(false);
  }, [selectedImportId, startDate, endDate, selectedTipoPrenotacao]);

  useEffect(() => {
    fetchDashboard();
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

    Papa.parse(csvFile, {
      header: false,
      delimiter: ';',
      skipEmptyLines: false,
      encoding: 'UTF-8',
      quoteChar: '"',
      escapeChar: '"',
      worker: true, // Offloads parsing to worker thread to prevent UI freezing
      chunkSize: 1024 * 1024 * 5, // 5MB streaming chunks
      chunk: async (results, parser) => {
        parser.pause();

        try {
          const rawRows = (results.data as string[][]) || [];
          const isFirstChunk = totalProcessed === 0 && rowBuffer.length === 0;

          let dataRows = rawRows;
          if (isFirstChunk && rawRows.length > 0) {
            const firstCell = String(rawRows[0][0] || '').trim();
            if (firstCell.toLowerCase().includes('protocolo') || !/^\d+$/.test(firstCell.replace(/\D/g, ''))) {
              dataRows = rawRows.slice(1);
            }
          }

          const dbRows = dataRows
            .filter((r) => Array.isArray(r) && r.some((c) => c !== undefined && c !== null && c !== ''))
            .map((r) => {
              const getVal = (idx: number) => (r[idx] !== undefined ? String(r[idx]).trim() : '');
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
                Protocolo: getVal(0),
                FlagRecepcao: getInt(getVal(1)),
                TipoSolicitacao: getVal(2) || null,
                IdAndamento: getVal(3) ? String(getVal(3)).replace(/\D/g, '') : null,
                DtProtocolo: parseDate(getVal(4) || getVal(7)),
                DtPrevisaoEntrega: parseDate(getVal(5)),
                DtAndamento: parseDate(getVal(6)),
                CodProcessamento: getInt(getVal(8)),
                DescAndamento: getVal(9) || null,
                Natureza: getVal(10) || null,
                TipoPrenotacao: getVal(11) || null,
                DiasPrometidos: getInt(getVal(12)),
                DiasCorridos: getInt(getVal(13)),
                DiasAtraso: getInt(getVal(14)),
                SituacaoPrazo: getVal(15) || null,
                IsDevolucao: getBool(getVal(16)),
                IsRegistrado: getBool(getVal(17)),
                TextoNotaDevolucao: getVal(18) || null,
              };
            })
            .filter((r) => r.Protocolo && r.Protocolo !== '0' && r.Protocolo.toLowerCase() !== 'protocolo');

          rowBuffer.push(...dbRows);

          // Direct client-side upsert to Supabase in batches of 1,000 lines
          const batchSize = 1000;
          while (rowBuffer.length >= batchSize) {
            const batch = rowBuffer.splice(0, batchSize);
            const { error } = await supabase
              .from('fiorix_bi_data')
              .upsert(batch, { onConflict: 'IdAndamento' });

            if (error) throw error;

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
            const { error } = await supabase
              .from('fiorix_bi_data')
              .upsert(rowBuffer, { onConflict: 'IdAndamento' });

            if (error) throw error;
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
      </div>

      {/* ── SECTION 1: MANUAL CSV UPLOAD & INTEL PREVIEW ── */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <FileSpreadsheet style={{ color: '#002B49' }} size={22} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            1. Importação Manual de CSV (Procedure SSMS)
          </h2>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '32px 24px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            cursor: 'pointer',
            transition: 'border-color 0.2s, background-color 0.2s',
          }}
        >
          <UploadCloud size={44} style={{ color: '#002B49', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
            Arraste seu arquivo CSV exportado do SSMS aqui
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
            Suporta <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>fiorix_bi_YYYY-MM-DD.csv</code> gerado via <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>Save Results As...</code>
          </p>

          <label
            style={{
              background: '#002B49',
              color: '#ffffff',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-block',
            }}
          >
            Selecionar Arquivo CSV
            <input
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel,text/plain"
              style={{ display: 'none' }}
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              onChange={(e) => e.target.files && e.target.files[0] && handleFileChange(e.target.files[0])}
            />
          </label>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div style={{ marginTop: '20px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '16px', color: '#991b1b', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <XCircle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ fontWeight: 700, margin: '0 0 4px', fontSize: '14px' }}>Erro na Validação do CSV</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>{validationError}</p>
            </div>
          </div>
        )}

        {/* File Parsing Loading */}
        {isParsing && (
          <div style={{ marginTop: '16px', color: '#0284c7', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} className="animate-spin" /> Analisando e validando colunas do CSV...
          </div>
        )}

        {/* INTEL PREVIEW CARD */}
        {previewStats && !isParsing && (
          <PreviewCard
            stats={previewStats}
            onConfirm={handleStartImport}
            onCancel={handleCancelUpload}
            isImporting={isImporting}
            uploadProgress={uploadProgress}
            importStatusMsg={importStatusMsg}
          />
        )}
      </div>

      {/* ── SECTION 2: FILTERS BAR ── */}
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
              onChange={(e) => setSelectedImportId(e.target.value)}
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
              {dashboardData.summary.totalRegistered} com Registrado (Cod 6)
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
              {dashboardData.summary.devolucaoCount} títulos com nota devolutiva
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 4: RECHARTS DASHBOARD ── */}
      {loadingDashboard ? (
        <div style={{ background: '#ffffff', borderRadius: '16px', padding: '48px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          Carregando indicadores do Supabase...
        </div>
      ) : dashboardData?.charts ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          
          {/* Chart 1: Pie Chart - Delivery Deadlines for CodProcessamento = 6 */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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

          {/* Chart 2: Top 10 Return Reasons */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 2: Top 10 Motivos de Devolução
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

          {/* Chart 3: Average Processing Days by Natureza */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
              Gráfico 3: Tempo Média (Dias Corridos) por Natureza do Título
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

        </div>
      ) : null}

      {/* ── SECTION 5: HISTÓRICO DE IMPORTAÇÕES ── */}
      <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
          Histórico de Importações no Supabase (<code style={{ background: '#f1f5f9', padding: '2px 6px' }}>fiorix_bi_imports</code>)
        </h3>

        {importsList.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
            Nenhuma importação realizada ainda. Utilize a área no topo da página para importar um CSV do SSMS.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 16px' }}>Data/Hora</th>
                  <th style={{ padding: '10px 16px' }}>Nome do Arquivo CSV</th>
                  <th style={{ padding: '10px 16px' }}>Registros Inseridos</th>
                  <th style={{ padding: '10px 16px' }}>Importado Por</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {importsList.map((imp) => (
                  <tr key={imp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 16px', color: '#0f172a', fontWeight: 600 }}>
                      {new Date(imp.importedAt).toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#334155' }}>{imp.fileName}</td>
                    <td style={{ padding: '10px 16px', color: '#10b981', fontWeight: 700 }}>
                      {imp.rowsCount.toLocaleString('pt-BR')} linhas
                    </td>
                    <td style={{ padding: '10px 16px', color: '#64748b' }}>{imp.importedBy || 'Manual SSMS'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteImport(imp.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: '4px',
                        }}
                        title="Excluir este lote"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

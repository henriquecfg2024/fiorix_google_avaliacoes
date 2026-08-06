'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  BiRowInput,
} from '@/app/actions/bi';


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
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [importsList, setImportsList] = useState<any[]>([]);

  // State for Dashboard Filters
  const [selectedImportId, setSelectedImportId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTipoPrenotacao, setSelectedTipoPrenotacao] = useState<string>('ALL');

  // Load Dashboard & Imports History
  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    setDashboardError(null);

    try {
      const params = new URLSearchParams();
      if (selectedImportId && selectedImportId !== 'ALL') params.set('importId', selectedImportId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedTipoPrenotacao && selectedTipoPrenotacao !== 'ALL') {
        params.set('tipoPrenotacao', selectedTipoPrenotacao);
      }

      const response = await fetch(`/api/bi/dashboard?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Erro ao carregar dashboard BI');
      }

      setDashboardData(payload.dashboard || null);
      setImportsList(payload.imports || []);
    } catch (error: any) {
      console.error('Erro ao buscar dashboard BI no cliente:', error);
      setDashboardData(null);
      setDashboardError(error?.message || 'Nao foi possivel carregar os graficos do BI.');
    } finally {
      setLoadingDashboard(false);
    }
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

    // validarCSV já normaliza o arquivo (inclusive CSVs exportados pelo SSMS
    // sem linha de cabeçalho). Reprocessar o arquivo com header:true fazia a
    // primeira linha virar o cabeçalho e resultava em zero linhas inseridas.
    try {
      const batchSize = 1000;
      const rows = parsedRows as BiRowInput[];
      if (rows.length === 0) throw new Error('Nenhum registro válido encontrado no CSV.');

      for (let offset = 0; offset < rows.length; offset += batchSize) {
        const batch = rows.slice(offset, offset + batchSize);
        const { success, error } = await insertBiBatch(importId, batch);
        if (!success) throw new Error(error || 'Falha ao inserir lote de dados.');

        totalProcessed += batch.length;
        const pct = Math.min(99, Math.round((totalProcessed / rows.length) * 100));
        setUploadProgress(pct);
        setImportStatusMsg(
          `Importando ${totalProcessed.toLocaleString('pt-BR')} / ${rows.length.toLocaleString('pt-BR')} linhas (${pct}%)`
        );
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
              {dashboardData.summary.devolucaoCount} títulos com nota devolutiva
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
                Controle separado · Naturezas sem prazo fixo
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#78350f', margin: '6px 0 6px' }}>
                Usucapião Extrajudicial, Retificação de Área e Intimação
              </h3>
              <p style={{ fontSize: '13px', color: '#92400e', margin: 0, maxWidth: '920px', lineHeight: 1.55 }}>
                Estas naturezas foram retiradas das avaliações gerais de prazo por não possuírem prazo legal fixo. O acompanhamento delas permanece abaixo, em bloco próprio.
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
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #fde68a', padding: '20px' }}>
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

            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #fde68a', padding: '20px' }}>
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

            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #fde68a', padding: '20px', gridColumn: '1 / -1' }}>
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
          Os indicadores gerais abaixo já desconsideram {dashboardData.summary.exceptionRecordsExcluded.toLocaleString('pt-BR')} registros de Usucapião Extrajudicial, Retificação de Área e Intimação.
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

          {/* Chart 2: Delay Severity */}
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
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
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
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

        </div>
      ) : (
        <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '32px', textAlign: 'center', color: '#64748b' }}>
          Nenhum dado encontrado para os filtros selecionados.
        </div>
      )}

    </div>
  );
}

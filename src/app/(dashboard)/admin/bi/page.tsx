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
} from 'lucide-react';
import {
  createBiImport,
  insertBiBatch,
  getBiDashboardData,
  getBiImportsList,
  deleteBiImport,
  BiRowInput,
} from '@/app/actions/bi';

export default function FiorixBiPage() {
  // State for CSV Upload & Preview
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BiRowInput[]>([]);
  const [previewRows, setPreviewRows] = useState<BiRowInput[]>([]);
  const [ignoredRowsCount, setIgnoredRowsCount] = useState<number>(0);
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

  // Helper to extract value from row regardless of BOM, quotes or casing
  const getRowValue = (row: Record<string, any>, targetKey: string) => {
    if (!row) return undefined;
    if (row[targetKey] !== undefined && row[targetKey] !== null) return row[targetKey];
    
    // Case and BOM insensitive key search
    const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    const foundKey = Object.keys(row).find((k) => {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanK === cleanTarget;
    });

    return foundKey ? row[foundKey] : undefined;
  };

  // Handle File Selection and PapaParse Processing
  const handleFileChange = (file: File) => {
    if (!file) return;
    setCsvFile(file);
    setIsParsing(true);
    setImportStatusMsg('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim().replace(/^[\uFEFF\xFF\xFE"'\s]+|["'\s]+$/g, ''),
      complete: (results) => {
        const rawData = (results.data || []) as Record<string, any>[];
        let ignored = 0;
        const validRows: BiRowInput[] = [];

        rawData.forEach((row) => {
          const rawProto = getRowValue(row, 'Protocolo');
          const proto = rawProto ? String(rawProto).trim() : '';
          
          // Filter out rows with Protocolo = 0, empty, or header re-prints
          if (!proto || proto === '0' || proto.toLowerCase() === 'protocolo') {
            ignored++;
            return;
          }

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

          validRows.push({
            Protocolo: proto,
            FlagRecepcao: getInt(getRowValue(row, 'FlagRecepcao')),
            TipoSolicitacao: getRowValue(row, 'TipoSolicitacao') || null,
            IdAndamento: getRowValue(row, 'IdAndamento') || null,
            DtProtocolo: getRowValue(row, 'DtProtocolo') || getRowValue(row, 'DataProtocolo') || null,
            DtPrevisaoEntrega: getRowValue(row, 'DtPrevisaoEntrega') || null,
            DtAndamento: getRowValue(row, 'DtAndamento') || null,
            CodProcessamento: getInt(getRowValue(row, 'CodProcessamento')),
            DescAndamento: getRowValue(row, 'DescAndamento') || null,
            Natureza: getRowValue(row, 'Natureza') || null,
            TipoPrenotacao: getRowValue(row, 'TipoPrenotacao') || null,
            DiasPrometidos: getInt(getRowValue(row, 'DiasPrometidos')),
            DiasCorridos: getInt(getRowValue(row, 'DiasCorridos')),
            DiasAtraso: getInt(getRowValue(row, 'DiasAtraso')),
            SituacaoPrazo: getRowValue(row, 'SituacaoPrazo') || null,
            IsDevolucao: getBool(getRowValue(row, 'IsDevolucao')),
            IsRegistrado: getBool(getRowValue(row, 'IsRegistrado')),
            TextoNotaDevolucao: getRowValue(row, 'TextoNotaDevolucao') || null,
          });
        });

        setIgnoredRowsCount(ignored);
        setParsedRows(validRows);
        setPreviewRows(validRows.slice(0, 20));
        setIsParsing(false);
      },
      error: (error) => {
        console.error('PapaParse error:', error);
        setImportStatusMsg('Erro ao ler arquivo CSV. Verifique a codificação.');
        setIsParsing(false);
      },
    });
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

  // Perform Batch Import into Supabase
  const handleStartImport = async () => {
    if (!parsedRows.length || !csvFile) return;

    setIsImporting(true);
    setUploadProgress(0);
    setImportStatusMsg('Criando registro de importação no Supabase...');

    // 1. Create import record
    const createRes = await createBiImport(csvFile.name, parsedRows.length, 'Manual SSMS');
    if (!createRes.success || !createRes.importId) {
      setImportStatusMsg(`Falha na importação: ${createRes.error}`);
      setIsImporting(false);
      return;
    }

    const importId = createRes.importId;
    const batchSize = 500;
    const totalBatches = Math.ceil(parsedRows.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = start + batchSize;
      const batchRows = parsedRows.slice(start, end);

      setImportStatusMsg(`Importando lote ${i + 1} de ${totalBatches} (${batchRows.length} linhas)...`);
      
      const insertRes = await insertBiBatch(importId, batchRows);
      if (!insertRes.success) {
        setImportStatusMsg(`Erro no lote ${i + 1}: ${insertRes.error}`);
        setIsImporting(false);
        return;
      }

      const progress = Math.round(((i + 1) / totalBatches) * 100);
      setUploadProgress(progress);
    }

    setImportStatusMsg(`🎉 Importação concluída com sucesso! ${parsedRows.length} registros inseridos.`);
    setIsImporting(false);

    // Reset upload form & refresh dashboard
    setTimeout(() => {
      setCsvFile(null);
      setParsedRows([]);
      setPreviewRows([]);
      setUploadProgress(0);
      fetchDashboard();
    }, 1500);
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

      {/* ── SECTION 1: MANUAL CSV UPLOAD (SSMS) ── */}
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
            padding: '36px 24px',
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

        {/* File Preview & Validation Stats */}
        {isParsing && (
          <div style={{ marginTop: '16px', color: '#0284c7', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={16} className="animate-spin" /> Analisando e validando linhas do CSV...
          </div>
        )}

        {csvFile && !isParsing && parsedRows.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            {/* Validation Banner */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontWeight: 700, color: '#166534', fontSize: '14px' }}>
                  ✓ Arquivo Validado: {csvFile.name}
                </span>
                <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                  {parsedRows.length.toLocaleString('pt-BR')} linhas prontas para importação · {ignoredRowsCount} linhas descartadas (Protocolo vazio/zerado).
                </div>
              </div>

              <button
                onClick={handleStartImport}
                disabled={isImporting}
                style={{
                  background: isImporting ? '#94a3b8' : '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: isImporting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                }}
              >
                {isImporting ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {isImporting ? 'Importando...' : 'Importar para Supabase'}
              </button>
            </div>

            {/* Progress Bar */}
            {isImporting && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  <span>{importStatusMsg}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#10b981', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

            {/* Preview Table */}
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
              Preview das Primeiras 20 Linhas Válidas:
            </h4>
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', maxHeight: '280px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textIndent: 0 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '8px 12px' }}>Protocolo</th>
                    <th style={{ padding: '8px 12px' }}>Natureza</th>
                    <th style={{ padding: '8px 12px' }}>Tipo Prenotação</th>
                    <th style={{ padding: '8px 12px' }}>Processamento</th>
                    <th style={{ padding: '8px 12px' }}>Dt Protocolo</th>
                    <th style={{ padding: '8px 12px' }}>Previsão</th>
                    <th style={{ padding: '8px 12px' }}>Dias Corridos</th>
                    <th style={{ padding: '8px 12px' }}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{r.Protocolo}</td>
                      <td style={{ padding: '8px 12px', color: '#334155' }}>{r.Natureza || '-'}</td>
                      <td style={{ padding: '8px 12px', color: '#334155' }}>{r.TipoPrenotacao || '-'}</td>
                      <td style={{ padding: '8px 12px', color: '#334155' }}>{r.CodProcessamento} ({r.DescAndamento || ''})</td>
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.DtProtocolo ? String(r.DtProtocolo).split('T')[0] : '-'}</td>
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.DtPrevisaoEntrega ? String(r.DtPrevisaoEntrega).split('T')[0] : '-'}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.DiasCorridos ?? 0}d</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 700,
                          background: (r.SituacaoPrazo || '').toLowerCase().includes('atrasad') ? '#fee2e2' : '#dcfce7',
                          color: (r.SituacaoPrazo || '').toLowerCase().includes('atrasad') ? '#991b1b' : '#166534',
                        }}>
                          {r.SituacaoPrazo || 'OK'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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

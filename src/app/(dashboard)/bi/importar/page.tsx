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

        <Link
          href="/bi"
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
            textDecoration: 'none'
          }}
        >
          ← Voltar para o Dashboard
        </Link>
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

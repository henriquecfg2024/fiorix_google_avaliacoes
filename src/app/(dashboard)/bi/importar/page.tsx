'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, RefreshCw, Trash2, UploadCloud, XCircle } from 'lucide-react';

import {
  createBiImport,
  deleteBiImport,
  getBiImportsList,
  insertBiBatch,
} from '@/app/actions/bi';
import {
  CsvStats,
  PreviewCard,
  importarCSVEmLotes,
  validarCSV,
} from '@/components/fiorix/CsvValidator';

export default function FiorixBiImportPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewStats, setPreviewStats] = useState<CsvStats | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importStatusMsg, setImportStatusMsg] = useState('');
  const [importsList, setImportsList] = useState<any[]>([]);

  const fetchImports = useCallback(async () => {
    const importsRes = await getBiImportsList();
    if (importsRes.success) {
      setImportsList(importsRes.imports || []);
    }
  }, []);

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  const handleCancelUpload = () => {
    setCsvFile(null);
    setPreviewStats(null);
    setValidationError(null);
    setImportStatusMsg('');
    setUploadProgress(0);
    setIsParsing(false);
    setIsImporting(false);
  };

  const handleFileChange = (file: File) => {
    if (!file) return;

    setCsvFile(file);
    setIsParsing(true);
    setValidationError(null);
    setImportStatusMsg('');
    setPreviewStats(null);
    setUploadProgress(0);

    validarCSV(
      file,
      (stats) => {
        setPreviewStats(stats);
        setIsParsing(false);
      },
      (errorMsg) => {
        setValidationError(errorMsg);
        setIsParsing(false);
      }
    );
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleStartImport = async () => {
    if (!csvFile || !previewStats) return;

    setIsImporting(true);
    setUploadProgress(0);

    const estimatedTotal = previewStats.totalLinhas || 1;
    setImportStatusMsg(
      `Iniciando importação de ~${estimatedTotal.toLocaleString('pt-BR')} linhas...`
    );

    const createRes = await createBiImport(csvFile.name, estimatedTotal, 'Manual SSMS');
    if (!createRes.success || !createRes.importId) {
      setImportStatusMsg(`Falha ao iniciar importação: ${createRes.error}`);
      setIsImporting(false);
      return;
    }

    const importId = createRes.importId;

    try {
      const { totalProcessed } = await importarCSVEmLotes({
        file: csvFile,
        estimatedTotal,
        batchSize: 5000,
        insertBatch: (rows) => insertBiBatch(importId, rows),
        onProgress: (processed, total) => {
          const safeTotal = Math.max(total, processed, 1);
          const pct = Math.min(99, Math.round((processed / safeTotal) * 100));

          setUploadProgress(pct);
          setImportStatusMsg(
            `Importando ${processed.toLocaleString('pt-BR')} / ${safeTotal.toLocaleString('pt-BR')} linhas (${pct}%)`
          );
        },
      });

      if (totalProcessed === 0) {
        throw new Error('Nenhum registro válido foi encontrado no CSV.');
      }

      setUploadProgress(100);
      setImportStatusMsg(
        `Importação concluída! ${totalProcessed.toLocaleString('pt-BR')} registros inseridos.`
      );
      setIsImporting(false);

      setTimeout(() => {
        handleCancelUpload();
        fetchImports();
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao inserir importação BI:', error);
      await deleteBiImport(importId);
      alert(`Erro na importação: ${error?.message || error}`);
      setImportStatusMsg(`Erro na importação: ${error?.message || error}`);
      setIsImporting(false);
    }
  };

  const handleDeleteImport = async (id: string) => {
    if (
      !confirm(
        'Tem certeza que deseja excluir este lote de importação? Todos os dados associados serão removidos.'
      )
    ) {
      return;
    }

    await deleteBiImport(id);
    fetchImports();
  };

  return (
    <div
      style={{
        padding: '24px 32px',
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
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
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              🏢 7º REGISTRO DE IMÓVEIS DE SP
            </span>
            <span
              style={{
                background: '#10b981',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              SUPABASE ONLINE
            </span>
          </div>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 800,
              marginTop: '8px',
              marginBottom: '4px',
              letterSpacing: '-0.5px',
            }}
          >
            FIORIX BI · Módulo de Inteligência & Prazos
          </h1>
          <p style={{ color: '#93c5fd', fontSize: '14px', margin: 0, maxWidth: '680px' }}>
            Análise operacional de prazos da procedure{' '}
            <code
              style={{
                background: 'rgba(0,0,0,0.2)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              dbo.pr_Fiorix_BI
            </code>
            . Identificação científica de gargalos para redução de reclamações do Google
            Business.
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
            textDecoration: 'none',
          }}
        >
          ← Voltar para o Dashboard
        </Link>
      </div>

      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          marginBottom: '32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <FileSpreadsheet style={{ color: '#002B49' }} size={22} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            1. Importação Manual de CSV (Procedure SSMS)
          </h2>
        </div>

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
            Suporta{' '}
            <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
              fiorix_bi_YYYY-MM-DD.csv
            </code>{' '}
            gerado via{' '}
            <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
              Save Results As...
            </code>
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
              onClick={(e) => {
                (e.target as HTMLInputElement).value = '';
              }}
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />
          </label>
        </div>

        {validationError && (
          <div
            style={{
              marginTop: '20px',
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '12px',
              padding: '16px',
              color: '#991b1b',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <XCircle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ fontWeight: 700, margin: '0 0 4px', fontSize: '14px' }}>
                Erro na Validação do CSV
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
                {validationError}
              </p>
            </div>
          </div>
        )}

        {isParsing && (
          <div
            style={{
              marginTop: '16px',
              color: '#0284c7',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <RefreshCw size={16} className="animate-spin" />
            Analisando arquivo grande e validando colunas do CSV...
          </div>
        )}

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

      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
          Histórico de Importações no Supabase (
          <code style={{ background: '#f1f5f9', padding: '2px 6px' }}>fiorix_bi_imports</code>)
        </h3>

        {importsList.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
            Nenhuma importação realizada ainda. Utilize a área no topo da página para importar um
            CSV do SSMS.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    background: '#f8fafc',
                    color: '#475569',
                    textAlign: 'left',
                    borderBottom: '2px solid #e2e8f0',
                  }}
                >
                  <th style={{ padding: '10px 16px' }}>Data/Hora</th>
                  <th style={{ padding: '10px 16px' }}>Nome do Arquivo CSV</th>
                  <th style={{ padding: '10px 16px' }}>Registros Inseridos</th>
                  <th style={{ padding: '10px 16px' }}>Importado Por</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {importsList.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', color: '#0f172a' }}>
                      {new Date(item.importedAt).toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{item.fileName}</td>
                    <td style={{ padding: '12px 16px', color: '#16a34a', fontWeight: 700 }}>
                      {Number(item.rowsCount || 0).toLocaleString('pt-BR')} linhas
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{item.importedBy}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteImport(item.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                        title="Excluir lote"
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

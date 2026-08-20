'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, RefreshCw, Trash2, UploadCloud, XCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import {
  createBiImport,
  deleteBiImport,
  getBiImportsList,
  insertBiBatch,
  updateBiImportStatus,
} from '@/app/actions/bi';
import {
  CsvStats,
  PreviewCard,
  importarCSVEmLotes,
  validarCSV,
} from '@/components/fiorix/CsvValidator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type ImportRow = {
  id: string;
  importedAt: string;
  fileName: string;
  rowsCount?: number;
  importedBy?: string | null;
  status?: string;
  errorMessage?: string | null;
};

export default function FiorixBiImportPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewStats, setPreviewStats] = useState<CsvStats | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importStatusMsg, setImportStatusMsg] = useState('');
  const [importsList, setImportsList] = useState<ImportRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        batchSize: 1000,
        insertBatch: (rows) => insertBiBatch(importId, rows),
        onProgress: (processed, total) => {
          const safeTotal = Math.max(total, processed, 1);
          const pct = Math.min(99, Number(((processed / safeTotal) * 100).toFixed(1)));

          setUploadProgress(pct);
          setImportStatusMsg(
            `Importando ${processed.toLocaleString('pt-BR')} / ${safeTotal.toLocaleString('pt-BR')} linhas (${pct.toFixed(1)}%)`
          );
        },
      });

      if (totalProcessed === 0) {
        throw new Error('Nenhum registro válido foi encontrado no CSV.');
      }

      await updateBiImportStatus(importId, 'SUCCESS');

      setUploadProgress(100);
      setImportStatusMsg(
        `Importação concluída! ${totalProcessed.toLocaleString('pt-BR')} registros inseridos.`
      );
      toast.success("Importação Concluída!", {
        description: `${totalProcessed.toLocaleString('pt-BR')} registros foram inseridos com sucesso.`,
      });
      setIsImporting(false);

      setTimeout(() => {
        handleCancelUpload();
        fetchImports();
      }, 2000);
    } catch (error: unknown) {
      console.error('Erro ao inserir importação BI:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      await updateBiImportStatus(importId, 'FAILED', errMsg);
      toast.error("Falha na Importação", {
        description: errMsg,
      });
      setImportStatusMsg(`Erro na importação: ${errMsg}`);
      setIsImporting(false);
      fetchImports();
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
    toast.success("Lote removido com sucesso!");
    fetchImports();
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <div className="rounded-[28px] border border-white/8 bg-[#0B1020]/72 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-white/42">
            <span>Dashboard</span>
            <span className="text-white/20">/</span>
            <span>Sistema</span>
            <span className="text-white/20">/</span>
            <span className="text-amber-300">Nova Carga</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-[2.15rem] font-black tracking-[0.01em] text-transparent bg-clip-text bg-gradient-to-r from-slate-50 via-white to-amber-300">
                  FIORIX BI - Importador de Dados
                </h1>
                <Badge className="rounded-full border border-emerald-500/20 bg-emerald-500/10 font-mono text-xs text-emerald-300">
                  UPLOAD DE CARGA
                </Badge>
              </div>
              <p className="max-w-4xl text-sm leading-relaxed text-white/58">
                Atualize a base do Supabase fazendo upload do CSV exportado da pr_Fiorix_BI.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/bi/importacoes">
                <Button variant="outline" className="flex items-center gap-2 border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]">
                  Demonstrativo de importações
                </Button>
              </Link>
              <Link href="/bi">
                <Button variant="outline" className="flex items-center gap-2 border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]">
                  <ArrowLeft size={16} /> Voltar ao BI
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <Card className="border-white/8 bg-[#0B1020]/78 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="text-amber-300" size={20} />
              <CardTitle className="text-lg">Nova Importação Manual (CSV)</CardTitle>
            </div>
            <CardDescription className="text-white/55">
              Arraste seu arquivo CSV exportado do SSMS para atualizar os indicadores do BI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel,text/plain"
              className="hidden"
              style={{ display: 'none' }}
              onClick={(e) => {
                (e.target as HTMLInputElement).value = '';
              }}
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-white/10 rounded-xl p-10 text-center bg-white/[0.03] hover:bg-white/[0.05] transition-colors cursor-pointer flex flex-col items-center justify-center"
            >
              <UploadCloud size={40} className="text-amber-300 mb-4" />
              <h3 className="text-sm font-semibold text-white mb-2">
                Arraste seu arquivo CSV aqui ou clique para selecionar
              </h3>
              <p className="text-xs text-white/55 mb-6">
                Suporta <code className="bg-white/10 px-1 py-0.5 rounded text-white">fiorix_bi_YYYY-MM-DD.csv</code> gerado via Save Results As...
              </p>

              <Button
                type="button"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Selecionar Arquivo CSV
              </Button>
            </div>

            {validationError && (
              <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-rose-100 flex items-start gap-3">
                <XCircle size={20} className="mt-0.5 shrink-0 text-rose-300" />
                <div>
                  <h4 className="font-semibold text-sm">Erro na Validação do CSV</h4>
                  <p className="text-xs mt-1 text-rose-100/80">{validationError}</p>
                </div>
              </div>
            )}

            {isParsing && (
              <div className="mt-4 text-amber-300 text-sm flex items-center gap-2">
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
          </CardContent>
        </Card>

        <Card className="border-white/8 bg-[#0B1020]/78 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Importações</CardTitle>
            <CardDescription className="text-white/55">
              Registro de todas as importações feitas para a tabela <code>fiorix_bi_imports</code> no Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {importsList.length === 0 ? (
              <div className="text-center text-sm text-white/55 py-10">
                Nenhuma importação realizada ainda.
              </div>
            ) : (
              <div className="rounded-md border border-white/8 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-white/[0.03]">
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Nome do Arquivo CSV</TableHead>
                      <TableHead>Registros Inseridos</TableHead>
                      <TableHead>Importado Por</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importsList.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {new Date(item.importedAt).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-slate-600">{item.fileName}</TableCell>
                        <TableCell className="text-emerald-600 font-semibold">
                          {Number(item.rowsCount || 0).toLocaleString('pt-BR')} linhas
                        </TableCell>
                        <TableCell className="text-white/55 text-xs">{item.importedBy}</TableCell>
                        <TableCell className="text-center">
                          {item.status === 'SUCCESS' && (
                            <Badge variant="default" className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">
                              Concluído
                            </Badge>
                          )}
                          {item.status === 'PROCESSING' && (
                            <Badge variant="outline" className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                              Processando
                            </Badge>
                          )}
                          {item.status === 'FAILED' && (
                            <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 border-none" title={item.errorMessage || 'Erro desconhecido'}>
                              Falhou
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-white/50 hover:text-rose-300 hover:bg-white/[0.05]"
                            onClick={() => handleDeleteImport(item.id)}
                            title="Excluir lote"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

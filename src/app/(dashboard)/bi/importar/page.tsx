'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
import { FiorixHeader } from '@/components/fiorix/FiorixHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
    } catch (error: any) {
      console.error('Erro ao inserir importação BI:', error);
      const errMsg = error?.message || String(error);
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
    <div className="min-h-screen bg-slate-50">
      <FiorixHeader
        title="FIORIX BI"
        subtitle="Módulo de Inteligência & Prazos"
        cartorio="7º REGISTRO DE IMÓVEIS DE SP"
        badge="SUPABASE ONLINE"
      />

      <main className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Importador de Dados
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Atualize a base do Supabase fazendo upload do CSV exportado da pr_Fiorix_BI.
            </p>
          </div>
          <Link href="/bi">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft size={16} /> Voltar para o Dashboard
            </Button>
          </Link>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="text-blue-600" size={20} />
              <CardTitle className="text-lg">Nova Importação Manual (CSV)</CardTitle>
            </div>
            <CardDescription>
              Arraste seu arquivo CSV exportado do SSMS para atualizar os indicadores do BI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer flex flex-col items-center justify-center"
            >
              <UploadCloud size={40} className="text-slate-400 mb-4" />
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Arraste seu arquivo CSV aqui ou clique para selecionar
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Suporta <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">fiorix_bi_YYYY-MM-DD.csv</code> gerado via Save Results As...
              </p>

              <label className="cursor-pointer">
                <Button variant="default" asChild>
                  <span>Selecionar Arquivo CSV</span>
                </Button>
                <input
                  type="file"
                  accept=".csv,text/csv,application/vnd.ms-excel,text/plain"
                  className="hidden"
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = '';
                  }}
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                />
              </label>
            </div>

            {validationError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 flex items-start gap-3">
                <XCircle size={20} className="mt-0.5 shrink-0 text-red-600" />
                <div>
                  <h4 className="font-semibold text-sm">Erro na Validação do CSV</h4>
                  <p className="text-xs mt-1 text-red-700">{validationError}</p>
                </div>
              </div>
            )}

            {isParsing && (
              <div className="mt-4 text-blue-600 text-sm flex items-center gap-2">
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

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Importações</CardTitle>
            <CardDescription>
              Registro de todas as importações feitas para a tabela <code>fiorix_bi_imports</code> no Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {importsList.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-10">
                Nenhuma importação realizada ainda.
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
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
                        <TableCell className="text-slate-500 text-xs">{item.importedBy}</TableCell>
                        <TableCell className="text-center">
                          {item.status === 'SUCCESS' && (
                            <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                              Concluído
                            </Badge>
                          )}
                          {item.status === 'PROCESSING' && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
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
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
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

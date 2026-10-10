import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  FileSpreadsheet,
  Layers3,
  Printer,
  RotateCcw,
  Target,
  UploadCloud,
  Users,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ImportacoesActions } from "@/components/bi/ImportacoesActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listBiImports,
  listProdutividadeImportLogs,
  listProdutividadeInferredPeriods,
  listMetasImportLogs,
  listTarefasImportLogs,
  listRetornosImportLogs,
  listRetornosInferredPeriods,
  listImpressoesImportLogs,
  listImpressoesInferredPeriods,
  type UnifiedImportRecord,
} from "@/lib/import-history";
import { ImportTableClient } from "@/components/bi/ImportTableClient";
import { AutoRefresh } from "@/components/bi/AutoRefresh";

function formatDateTime(value: string | null | Date) {
  if (!value) return "Nenhuma registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nenhuma registrada";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function BiImportacoesPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect("/login");
  }

  const tenantId = user.tenantId;

  // Carregar dados de histórico e status do conector em paralelo
  const [
    connector,
    biImports,
    produtividadeLogs,
    produtividadeInferred,
    metasImports,
    tarefasImports,
    retornosLogs,
    retornosInferred,
    impressoesLogs,
    impressoesInferred,
  ] = await Promise.all([
    prisma.connector
      .findFirst({
        where: {
          tenantId,
          enabled: true,
          id: { not: "substituir_pelo_id_fornecido" },
        },
        select: {
          id: true,
          name: true,
          lastSeenAt: true,
          status: true,
        },
      })
      .catch(() => null),
    listBiImports(tenantId).catch((err) => {
      console.error("listBiImports error:", err);
      return [];
    }),
    listProdutividadeImportLogs(tenantId).catch((err) => {
      console.error("listProdutividadeImportLogs error:", err);
      return [];
    }),
    listProdutividadeInferredPeriods(tenantId).catch((err) => {
      console.error("listProdutividadeInferredPeriods error:", err);
      return [];
    }),
    listMetasImportLogs(tenantId).catch((err) => {
      console.error("listMetasImportLogs error:", err);
      return [];
    }),
    listTarefasImportLogs(tenantId).catch((err) => {
      console.error("listTarefasImportLogs error:", err);
      return [];
    }),
    listRetornosImportLogs(tenantId).catch((err) => {
      console.error("listRetornosImportLogs error:", err);
      return [];
    }),
    listRetornosInferredPeriods(tenantId).catch((err) => {
      console.error("listRetornosInferredPeriods error:", err);
      return [];
    }),
    listImpressoesImportLogs(tenantId).catch((err) => {
      console.error("listImpressoesImportLogs error:", err);
      return [];
    }),
    listImpressoesInferredPeriods(tenantId).catch((err) => {
      console.error("listImpressoesInferredPeriods error:", err);
      return [];
    }),
  ]);

  // Avaliação da saúde do FIORIX Connector
  const isConnectorOperational = Boolean(
    connector &&
      connector.lastSeenAt &&
      Date.now() - new Date(connector.lastSeenAt).getTime() <= 300000 && // 5 minutos de tolerância
      String(connector.status || "").toLowerCase() !== "offline"
  );

  // Filtragem de períodos inferidos sobrepostos aos logs formais
  const loggedProdPeriods = new Set(
    produtividadeLogs.map((row) => `${row.periodStart || ""}|${row.periodEnd || ""}`)
  );
  const produtividadeInferredFiltered = produtividadeInferred.filter(
    (row) => !loggedProdPeriods.has(`${row.periodStart || ""}|${row.periodEnd || ""}`)
  );

  const loggedRetornosPeriods = new Set(
    retornosLogs.map((row) => `${row.periodStart || ""}|${row.periodEnd || ""}`)
  );
  const retornosInferredFiltered = retornosInferred.filter(
    (row) => !loggedRetornosPeriods.has(`${row.periodStart || ""}|${row.periodEnd || ""}`)
  );

  const loggedImpressoesPeriods = new Set(
    impressoesLogs.map((row) => `${row.periodStart || ""}|${row.periodEnd || ""}`)
  );
  const impressoesInferredFiltered = impressoesInferred.filter(
    (row) => !loggedImpressoesPeriods.has(`${row.periodStart || ""}|${row.periodEnd || ""}`)
  );

  const retornosAll = [...retornosLogs, ...retornosInferredFiltered];
  const impressoesAll = [...impressoesLogs, ...impressoesInferredFiltered];
  const produtividadeAll = [...produtividadeLogs, ...produtividadeInferredFiltered];

  const unifiedRows = [
    ...biImports,
    ...produtividadeAll,
    ...metasImports,
    ...tarefasImports,
    ...retornosAll,
    ...impressoesAll,
  ].sort((a, b) => {
    const dateA = a.importedAt ? new Date(a.importedAt).getTime() : 0;
    const dateB = b.importedAt ? new Date(b.importedAt).getTime() : 0;
    return dateB - dateA;
  });

  // Métricas de contingência
  const isConnectorRow = (row: UnifiedImportRecord) =>
    row.origin !== "inferred" &&
    (row.importedBy?.toLowerCase().includes("connector") ||
      row.fileName?.toLowerCase().includes("connector") ||
      row.id?.startsWith("connector-"));

  const manualRows = unifiedRows.filter(
    (row) => row.origin !== "inferred" && !isConnectorRow(row)
  );

  const lastManual = manualRows[0] || null;
  const manualFilesCount = manualRows.length;
  const manualTotalLines = manualRows.reduce(
    (sum, r) => sum + Number(r.rowsCount || 0),
    0
  );

  const pendingCount = unifiedRows.filter((r) =>
    ["PROCESSING", "PROCESSANDO", "FAILED", "FALHOU"].includes(
      String(r.status || "").toUpperCase()
    )
  ).length;

  const hasActiveImports = unifiedRows.some((row) =>
    ["PROCESSING", "PROCESSANDO"].includes(String(row.status || "").toUpperCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A12] text-slate-900 dark:text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <AutoRefresh intervalMs={30000} enabled={hasActiveImports} />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1700px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2 border-b border-slate-200 dark:border-white/6">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">SISTEMA & TECNOLOGIA</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">IMPORTAÇÃO DE CONTINGÊNCIA</span>
            <h1 className="sr-only">Importação de Contingência</h1>
          </div>
        </div>

        {/* Banner Contextual de Estado do Conector */}
        {isConnectorOperational ? (
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 shadow-sm backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="rounded-xl bg-emerald-500/20 p-2 text-emerald-400 shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-emerald-300">
                  FIORIX Connector operacional
                </div>
                <div className="text-xs text-emerald-300/80 mt-0.5">
                  A importação manual deve ser utilizada somente em caso de indisponibilidade ou
                  orientação técnica.
                </div>
              </div>
            </div>

            <Link href="/sistema/operacoes">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 text-xs font-semibold shrink-0 cursor-pointer"
              >
                <Activity className="h-3.5 w-3.5" />
                Ver Central de Operações
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 shadow-sm backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="rounded-xl bg-amber-500/20 p-2 text-amber-400 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-amber-200">
                  Atenção: FIORIX Connector indisponível
                </div>
                <div className="text-xs text-amber-200/80 mt-0.5">
                  Você pode utilizar a importação manual de contingência para manter os dados e
                  indicadores atualizados.
                </div>
              </div>
            </div>

            <Link href="/sistema/operacoes">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 text-xs font-semibold shrink-0 cursor-pointer"
              >
                <Activity className="h-3.5 w-3.5" />
                Ver Central de Operações
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        )}

        {/* 4 Cards Métricos de Contingência */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Última importação manual */}
          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-4 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20 flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">
                Última importação manual
              </div>
              <div className="mt-2 text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-300">
                {lastManual ? formatDateTime(lastManual.importedAt) : "Nenhuma registrada"}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-white/45 truncate max-w-[220px]">
                {lastManual
                  ? lastManual.importedBy
                    ? `Por ${lastManual.importedBy}`
                    : "Envio manual"
                  : "Sem envios manuais recentes"}
              </div>
            </div>
            <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          {/* Card 2: Arquivos processados no período */}
          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-4 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20 flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">
                Arquivos processados no período
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-300">
                {manualFilesCount}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-white/45">
                {manualFilesCount === 1
                  ? "1 arquivo manual enviado"
                  : `${manualFilesCount} arquivos manuais enviados`}
              </div>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
          </div>

          {/* Card 3: Linhas importadas no período */}
          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-4 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20 flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">
                Linhas importadas no período
              </div>
              <div className="mt-2 text-2xl font-bold text-cyan-600 dark:text-cyan-300">
                {manualTotalLines.toLocaleString("pt-BR")}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-white/45">
                registros manuais de contingência
              </div>
            </div>
            <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400">
              <Layers3 className="h-5 w-5" />
            </div>
          </div>

          {/* Card 4: Pendências de validação */}
          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-4 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20 flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">
                Pendências de validação
              </div>
              <div
                className={`mt-2 text-2xl font-bold ${
                  pendingCount > 0
                    ? "text-amber-500 dark:text-amber-300"
                    : "text-emerald-600 dark:text-emerald-300"
                }`}
              >
                {pendingCount > 0
                  ? `${pendingCount} pendência${pendingCount > 1 ? "s" : ""}`
                  : "0 pendências"}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-white/45">
                {pendingCount > 0
                  ? "Cargas com falha ou em processamento"
                  : "Todas as cargas validadas"}
              </div>
            </div>
            <div
              className={`rounded-xl p-2.5 ${
                pendingCount > 0
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-emerald-500/10 text-emerald-400"
              }`}
            >
              {pendingCount > 0 ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
          </div>
        </div>

        {/* Área de Ações de Envio e Avançadas */}
        <ImportacoesActions />

        {/* Histórico de Importações (Tabela Principal) */}
        <div className="rounded-[28px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/8 pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-300" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Histórico de Importações
              </h2>
            </div>
            <div className="text-xs text-slate-500 dark:text-white/45">
              Exibindo histórico unificado com badges de origem (FIORIX Connector, Manual e Inferido).
            </div>
          </div>

          <ImportTableClient rows={unifiedRows} showSearch />
        </div>

        {/* Detalhamento por Módulo (Preservação Retrocompatível de Vistas Especializadas) */}
        <details className="group rounded-[28px] border border-white/10 bg-[#0B1020]/50 p-6 shadow-sm backdrop-blur-xl">
          <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-slate-900 dark:text-white select-none">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-violet-400" />
              <span>Detalhamento por Módulo (Visualização Especializada)</span>
            </div>
            <span className="text-xs font-normal text-white/50 group-open:hidden">
              Clique para expandir tabelas individuais por módulo
            </span>
          </summary>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Produtividade */}
            <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
                <h3 className="text-sm font-semibold text-white">Produtividade</h3>
              </div>
              <p className="text-xs text-white/55">
                Entradas de produtividade (dbo.pr_Fiorix_BI_Produtividade).
              </p>
              <ImportTableClient rows={produtividadeAll} />
            </div>

            {/* Módulo BI */}
            <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-semibold text-white">Módulo BI</h3>
              </div>
              <p className="text-xs text-white/55">
                Entradas da tabela fiorix_bi_imports (dbo.pr_Fiorix_BI).
              </p>
              <ImportTableClient rows={biImports} />
            </div>

            {/* Metas */}
            <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-300" />
                <h3 className="text-sm font-semibold text-white">Metas</h3>
              </div>
              <p className="text-xs text-white/55">
                Entradas da tabela fiorix_metas_imports (dbo.pr_Fiorix_BI_METAS).
              </p>
              <ImportTableClient rows={metasImports} />
            </div>

            {/* Tarefas */}
            <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-purple-300" />
                <h3 className="text-sm font-semibold text-white">Tarefas</h3>
              </div>
              <p className="text-xs text-white/55">
                Entradas da tabela fiorix_tarefas_imports (dbo.pr_Fiorix_BI_TAREFAS).
              </p>
              <ImportTableClient rows={tarefasImports} />
            </div>

            {/* Retornos */}
            <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-blue-300" />
                <h3 className="text-sm font-semibold text-white">Retornos</h3>
              </div>
              <p className="text-xs text-white/55">
                Entradas da procedure dbo.pr_Fiorix_BI_Retornos (Notas Devolutivas).
              </p>
              <ImportTableClient rows={retornosAll} />
            </div>

            {/* Impressões */}
            <div className="rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-amber-300" />
                <h3 className="text-sm font-semibold text-white">Impressões</h3>
              </div>
              <p className="text-xs text-white/55">
                Entradas da procedure dbo.pr_Fiorix_BI_Impressoes (Livro e Certidão).
              </p>
              <ImportTableClient rows={impressoesAll} />
            </div>
          </div>
        </details>
      </main>
    </div>
  );
}

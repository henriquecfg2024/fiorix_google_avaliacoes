import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Database,
  FileSpreadsheet,
  Layers3,
  Printer,
  RotateCcw,
  Target,
} from "lucide-react";

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
  listAndamentosImportLogs,
  listAndamentosInferredPeriods,
  type UnifiedImportRecord,
} from "@/lib/import-history";
import { ImportTableClient } from "@/components/bi/ImportTableClient";
import { AutoRefresh } from "@/components/bi/AutoRefresh";

export default async function BiImportacoesPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect("/login");
  }

  const tenantId = user.tenantId;

  const [
    biImports,
    produtividadeLogs,
    produtividadeInferred,
    metasImports,
    tarefasImports,
    retornosLogs,
    retornosInferred,
    impressoesLogs,
    impressoesInferred,
    andamentosLogs,
    andamentosInferred,
  ] = await Promise.all([
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
    listAndamentosImportLogs(tenantId).catch((err) => {
      console.error("listAndamentosImportLogs error:", err);
      return [];
    }),
    listAndamentosInferredPeriods(tenantId).catch((err) => {
      console.error("listAndamentosInferredPeriods error:", err);
      return [];
    }),
  ]);

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

  const loggedAndamentosPeriods = new Set(
    andamentosLogs.map((row) => `${row.periodStart || ""}|${row.periodEnd || ""}`)
  );
  const andamentosInferredFiltered = andamentosInferred.filter(
    (row) => !loggedAndamentosPeriods.has(`${row.periodStart || ""}|${row.periodEnd || ""}`)
  );

  const retornosAll = [...retornosLogs, ...retornosInferredFiltered];
  const impressoesAll = [...impressoesLogs, ...impressoesInferredFiltered];
  const andamentosAll = [...andamentosLogs, ...andamentosInferredFiltered];
  const produtividadeAll = [...produtividadeLogs, ...produtividadeInferredFiltered];

  const unifiedRows = [
    ...biImports,
    ...produtividadeAll,
    ...metasImports,
    ...tarefasImports,
    ...retornosAll,
    ...impressoesAll,
    ...andamentosAll,
  ].sort((a, b) => {
    const dateA = a.importedAt ? new Date(a.importedAt).getTime() : 0;
    const dateB = b.importedAt ? new Date(b.importedAt).getTime() : 0;
    return dateB - dateA;
  });

  const biCount = biImports.length;
  const produtividadeCount = produtividadeLogs.length;
  const metasCount = metasImports.length;
  const tarefasCount = tarefasImports.length;
  const retornosCount = retornosAll.length;
  const impressoesCount = impressoesAll.length;
  const andamentosCount = andamentosAll.length;
  const totalInferredCount =
    produtividadeInferredFiltered.length +
    retornosInferredFiltered.length +
    impressoesInferredFiltered.length +
    andamentosInferredFiltered.length;
  const totalRows = unifiedRows.reduce((sum, row) => sum + Number(row.rowsCount || 0), 0);
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200 dark:border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-400 dark:text-slate-600">/</span>
              <span>Sistema</span>
              <span className="text-slate-400 dark:text-slate-600">/</span>
              <span className="text-amber-600 dark:text-amber-300">Importações</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              Gestão de Importações
            </h1>
          </div>

          <Badge className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 font-sans text-xs font-semibold text-amber-700 dark:text-amber-300 self-start sm:self-center">
            HISTÓRICO DE CARGAS
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <ImportacoesActions />
        </div>

        {/* Metric Cards Grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-3.5 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">Módulo BI</div>
            <div className="mt-2 text-2xl font-bold text-cyan-600 dark:text-cyan-300">{biCount}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/45">importações</div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-3.5 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">Produtividade</div>
            <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-300">{produtividadeCount}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/45">importações</div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-3.5 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">Metas</div>
            <div className="mt-2 text-2xl font-bold text-violet-600 dark:text-violet-300">{metasCount}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/45">importações</div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-3.5 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">Tarefas</div>
            <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-300">{tarefasCount}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/45">importações</div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-3.5 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">Retornos</div>
            <div className="mt-2 text-2xl font-bold text-blue-600 dark:text-blue-300">{retornosCount}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/45">importações</div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-3.5 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">Impressões</div>
            <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-300">{impressoesCount}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/45">importações</div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-3.5 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">Andamentos</div>
            <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-300">{andamentosCount}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/45">importações</div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-3.5 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">Inferidos</div>
            <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-300">{totalInferredCount}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/45">lotes inferidos</div>
          </div>

          <div className="rounded-2xl border border-white/20 bg-[#0B1020]/90 p-3.5 shadow-sm backdrop-blur-xl transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/55">Total Linhas</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalRows.toLocaleString("pt-BR")}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-white/45">em todas as fontes</div>
          </div>
        </div>

        {/* Histórico Unificado */}
        <div className="rounded-[28px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-300" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Histórico Unificado</h2>
          </div>
          <ImportTableClient rows={unifiedRows} showSearch />
        </div>

        {/* Grid de Cards Individuais das Procedures */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {/* Produtividade */}
          <div className="rounded-[28px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Produtividade</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/55">
              Entradas de produtividade (<span className="text-emerald-400">dbo.pr_Fiorix_BI_Produtividade</span>).
            </p>
            <ImportTableClient rows={produtividadeAll} />
          </div>

          {/* Módulo BI */}
          <div className="rounded-[28px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-300" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Módulo BI</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/55">
              Entradas da tabela <span className="text-cyan-400">fiorix_bi_imports</span> (dbo.pr_Fiorix_BI).
            </p>
            <ImportTableClient rows={biImports} />
          </div>

          {/* Metas */}
          <div className="rounded-[28px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-300" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Metas</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/55">
              Entradas da tabela <span className="text-violet-400">fiorix_metas_imports</span> (dbo.pr_Fiorix_BI_METAS).
            </p>
            <ImportTableClient rows={metasImports} />
          </div>

          {/* Tarefas */}
          <div className="rounded-[28px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-purple-300" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tarefas</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/55">
              Entradas da tabela <span className="text-purple-400">fiorix_tarefas_imports</span> (dbo.pr_Fiorix_BI_TAREFAS).
            </p>
            <ImportTableClient rows={tarefasImports} />
          </div>

          {/* Retornos */}
          <div className="rounded-[28px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-blue-300" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Retornos</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/55">
              Entradas da procedure <span className="text-blue-400">dbo.pr_Fiorix_BI_Retornos</span> (Notas Devolutivas).
            </p>
            <ImportTableClient rows={retornosAll} />
          </div>

          {/* Impressões */}
          <div className="rounded-[28px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-amber-300" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Impressões</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/55">
              Entradas da procedure <span className="text-amber-400">dbo.pr_Fiorix_BI_Impressoes</span> (Livro e Certidão).
            </p>
            <ImportTableClient rows={impressoesAll} />
          </div>

          {/* Andamentos */}
          <div className="rounded-[28px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-rose-300" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Andamentos</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/55">
              Entradas da procedure <span className="text-rose-400">dbo.pr_Fiorix_BI_Andamentos</span> (Auditoria Geral).
            </p>
            <ImportTableClient rows={andamentosAll} />
          </div>
        </div>
      </main>
    </div>
  );
}

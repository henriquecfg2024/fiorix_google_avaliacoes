import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Database, FileSpreadsheet, Layers3, Target } from "lucide-react";

import { requireAuth } from "@/lib/auth-helpers";
import { ImportacoesActions } from "@/components/bi/ImportacoesActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listBiImports,
  listProdutividadeImportLogs,
  listProdutividadeInferredPeriods,
  listMetasImportLogs,
  type UnifiedImportRecord,
} from "@/lib/import-history";
import { ImportTableClient } from "@/components/bi/ImportTableClient";

export default async function BiImportacoesPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect("/login");
  }

  const tenantId = user.tenantId;

  const [biImports, produtividadeLogs, produtividadeInferred, metasImports] = await Promise.all([
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
  ]);

  const loggedPeriods = new Set(
    produtividadeLogs.map((row) => `${row.periodStart || ""}|${row.periodEnd || ""}`)
  );

  const produtividadeInferredFiltered = produtividadeInferred.filter(
    (row) => !loggedPeriods.has(`${row.periodStart || ""}|${row.periodEnd || ""}`)
  );

  const unifiedRows = [...biImports, ...produtividadeLogs, ...produtividadeInferredFiltered, ...metasImports].sort((a, b) => {
    const dateA = a.importedAt ? new Date(a.importedAt).getTime() : 0;
    const dateB = b.importedAt ? new Date(b.importedAt).getTime() : 0;
    return dateB - dateA;
  });

  const biCount = biImports.length;
  const produtividadeCount = produtividadeLogs.length;
  const produtividadeInferredCount = produtividadeInferredFiltered.length;
  const metasCount = metasImports.length;
  const totalRows = unifiedRows.reduce((sum, row) => sum + Number(row.rowsCount || 0), 0);

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span>Sistema</span>
              <span className="text-slate-600">/</span>
              <span className="text-amber-300">Importações</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              Gestão de Importações
            </h1>
          </div>

          <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 font-sans text-xs font-semibold text-amber-300 self-start sm:self-center">
            HISTÓRICO DE CARGAS
          </Badge>
        </div>

        <div className="flex flex-wrap gap-3">
          <ImportacoesActions />
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-white/12 bg-[#0B1020]/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Módulo BI</div>
              <div className="mt-2 text-2xl font-bold text-cyan-300">{biCount}</div>
              <div className="mt-1 text-xs text-white/45">importações registradas</div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-[#0B1020]/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Produtividade</div>
              <div className="mt-2 text-2xl font-bold text-emerald-300">{produtividadeCount}</div>
              <div className="mt-1 text-xs text-white/45">importações registradas</div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-[#0B1020]/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Metas</div>
              <div className="mt-2 text-2xl font-bold text-violet-300">{metasCount}</div>
              <div className="mt-1 text-xs text-white/45">importações registradas</div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-[#0B1020]/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Períodos Inferidos</div>
              <div className="mt-2 text-2xl font-bold text-amber-300">{produtividadeInferredCount}</div>
              <div className="mt-1 text-xs text-white/45">detectados na base de produtividade</div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-[#0B1020]/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Total de Linhas</div>
              <div className="mt-2 text-2xl font-bold text-white">{totalRows.toLocaleString("pt-BR")}</div>
              <div className="mt-1 text-xs text-white/45">somadas nas fontes exibidas</div>
            </div>
          </div>

        <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-300" />
            <h2 className="text-lg font-semibold">Histórico Unificado</h2>
          </div>
          <ImportTableClient rows={unifiedRows} showSearch />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
              <h2 className="text-lg font-semibold">Produtividade</h2>
            </div>
            <p className="text-sm text-white/55">
              Entradas com status <span className="text-emerald-300">Concluído</span> ou <span className="text-cyan-300">Processando</span> são registros formais da tela de importação.
              Entradas <span className="text-amber-300">Inferido</span> foram reconstruídas a partir dos períodos já presentes em `fiorix_produtividade_dados`.
            </p>
            <ImportTableClient rows={[...produtividadeLogs, ...produtividadeInferredFiltered]} />
          </div>

          <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-300" />
              <h2 className="text-lg font-semibold">Módulo BI</h2>
            </div>
            <p className="text-sm text-white/55">
              Essas entradas vêm da tabela `fiorix_bi_imports`, que já registra historicamente os uploads do módulo BI.
            </p>
            <ImportTableClient rows={biImports} />
          </div>

          <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-300" />
              <h2 className="text-lg font-semibold">Metas</h2>
            </div>
            <p className="text-sm text-white/55">
              Essas entradas vêm da tabela `fiorix_metas_imports`, que já registra historicamente os uploads do módulo de metas.
            </p>
            <ImportTableClient rows={metasImports} />
          </div>
        </div>
      </main>
    </div>
  );
}

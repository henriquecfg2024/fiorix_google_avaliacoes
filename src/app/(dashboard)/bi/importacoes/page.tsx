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
import { DeleteImportButton } from "@/components/bi/DeleteImportButton";

export const dynamic = "force-dynamic";

function formatMonthLabel(start: string | null, end: string | null) {
  if (!start) return null;

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;

  const monthLabel = startDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  if (!end) return monthLabel;

  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return monthLabel;

  const sameMonth =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth();

  if (sameMonth) return monthLabel;

  const endMonthLabel = endDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return `${monthLabel} a ${endMonthLabel}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start && !end) return "-";
  if (start && end) {
    return `${new Date(start).toLocaleDateString("pt-BR")} até ${new Date(end).toLocaleDateString("pt-BR")}`;
  }
  return start || end || "-";
}

function statusBadge(record: UnifiedImportRecord) {
  if (record.status === "FAILED" || record.status === "Falhou") {
    return (
      <Badge className="bg-red-500/15 text-red-300 border-red-500/30">
        Falhou
      </Badge>
    );
  }

  if (record.status === "PROCESSING" || record.status === "Processando" || record.status === "Processando...") {
    return (
      <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30">
        Processando
      </Badge>
    );
  }

  if (record.status === "INFERRED" || record.origin === "inferred") {
    return (
      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
        Inferido
      </Badge>
    );
  }

  return (
    <Badge className="bg-[#00C950]/15 text-[#00C950] border-[#00C950]/30">
      Concluído
    </Badge>
  );
}

function sourceBadge(source: UnifiedImportRecord["source"]) {
  if (source === "BI") {
    return <Badge className="bg-[#2B7FFF]/15 text-[#6EA8FF] border-[#2B7FFF]/30">Módulo BI</Badge>;
  } else if (source === "METAS") {
    return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Metas</Badge>;
  }
  return <Badge className="bg-[#00C950]/15 text-[#00C950] border-[#00C950]/30">Produtividade</Badge>;
}

function displayReference(row: UnifiedImportRecord) {
  if (row.origin !== "inferred") return row.fileName;

  const monthLabel = formatMonthLabel(row.periodStart, row.periodEnd);
  if (!monthLabel) return row.fileName;

  return `Produtividade ${monthLabel}`;
}

function ImportTable({ rows }: { rows: UnifiedImportRecord[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/55">
        Nenhuma importação encontrada.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-white/60">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Origem</th>
              <th className="text-left px-4 py-3 font-medium">Arquivo / Referência</th>
              <th className="text-left px-4 py-3 font-medium">Período</th>
              <th className="text-left px-4 py-3 font-medium">Data/Hora</th>
              <th className="text-left px-4 py-3 font-medium">Linhas</th>
              <th className="text-left px-4 py-3 font-medium">Inseridas</th>
              <th className="text-left px-4 py-3 font-medium">Importado por</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isMetasCompleted = row.source === "METAS" && (row.status === "Concluído" || row.status === "SUCCESS" || row.status === "COMPLETED");
              return (
                <tr key={`${row.source}-${row.id}`} className="border-t border-white/10 align-top">
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      {sourceBadge(row.source)}
                      {row.origin === "inferred" && (
                        <div className="text-[11px] text-white/45">Histórico inferido pela base</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white">
                    <div className="font-medium break-all">{displayReference(row)}</div>
                    {row.origin === "inferred" && (
                      <div className="mt-1 text-xs text-white/45 break-all">{row.fileName}</div>
                    )}
                    {row.errorMessage && (
                      <div className="mt-1 text-xs text-red-300">{row.errorMessage}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/75">{formatPeriod(row.periodStart, row.periodEnd)}</td>
                  <td className="px-4 py-3 text-white/75">{formatDateTime(row.importedAt)}</td>
                  <td className={`px-4 py-3 ${isMetasCompleted ? "text-[#10B981] font-semibold" : "text-white"}`}>
                    {Number(row.rowsCount || 0).toLocaleString("pt-BR")}
                  </td>
                  <td className={`px-4 py-3 font-medium ${isMetasCompleted ? "text-[#10B981]" : "text-[#00C950]"}`}>
                    {row.insertedCount !== null ? Number(row.insertedCount || 0).toLocaleString("pt-BR") : "-"}
                  </td>
                  <td className="px-4 py-3 text-white/65">{row.importedBy || "-"}</td>
                  <td className="px-4 py-3">{statusBadge(row)}</td>
                  <td className="px-4 py-3 text-right">
                    {row.origin !== "inferred" && (
                      <DeleteImportButton id={row.id} source={row.source as UnifiedImportRecord["source"]} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function BiImportacoesPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect("/login");
  }

  const tenantId = user.tenantId;

  const [biImports, produtividadeLogs, produtividadeInferred, metasImports] = await Promise.all([
    listBiImports(tenantId),
    listProdutividadeImportLogs(tenantId),
    listProdutividadeInferredPeriods(tenantId),
    listMetasImportLogs(tenantId),
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
        <div className="rounded-[28px] border border-white/8 bg-[#0B1020]/72 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-white/42">
            <span>Dashboard</span>
            <span className="text-white/20">/</span>
            <span>Sistema</span>
            <span className="text-white/20">/</span>
            <span className="text-amber-300">Importações</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-[2.15rem] font-black tracking-[0.01em] text-transparent bg-clip-text bg-gradient-to-r from-slate-50 via-white to-amber-300">
                  Gestão de Importações
                </h1>
                <Badge className="rounded-full border border-amber-500/20 bg-amber-500/10 font-mono text-xs text-amber-300">
                  HISTÓRICO DE CARGAS
                </Badge>
              </div>
              <p className="max-w-4xl text-sm leading-relaxed text-white/58">
                Visão unificada das cargas efetuadas no Módulo BI, Produtividade e Metas, incluindo inferências de períodos gravados na base.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ImportacoesActions />
              <Link href="/bi">
                <Button variant="outline" className="gap-2 border-white/8 bg-white/[0.04] text-white hover:bg-white/[0.08]">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao BI
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="rounded-2xl border border-cyan-500/15 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/45">Módulo BI</div>
              <div className="mt-2 text-2xl font-bold text-cyan-300">{biCount}</div>
              <div className="mt-1 text-xs text-white/50">importações registradas</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/15 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/45">Produtividade</div>
              <div className="mt-2 text-2xl font-bold text-emerald-300">{produtividadeCount}</div>
              <div className="mt-1 text-xs text-white/50">importações registradas</div>
            </div>
            <div className="rounded-2xl border border-violet-500/15 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/45">Metas</div>
              <div className="mt-2 text-2xl font-bold text-violet-300">{metasCount}</div>
              <div className="mt-1 text-xs text-white/50">importações registradas</div>
            </div>
            <div className="rounded-2xl border border-amber-500/15 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/45">Períodos Inferidos</div>
              <div className="mt-2 text-2xl font-bold text-amber-300">{produtividadeInferredCount}</div>
              <div className="mt-1 text-xs text-white/50">detectados na base de produtividade</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/45">Total de Linhas</div>
              <div className="mt-2 text-2xl font-bold text-white">{totalRows.toLocaleString("pt-BR")}</div>
              <div className="mt-1 text-xs text-white/50">somadas nas fontes exibidas</div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-[#0B1020]/78 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-cyan-300" />
            <h2 className="text-lg font-semibold">Histórico Unificado</h2>
          </div>
          <ImportTable rows={unifiedRows} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-[28px] border border-white/8 bg-[#0B1020]/78 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
              <h2 className="text-lg font-semibold">Produtividade</h2>
            </div>
            <p className="text-sm text-white/55">
              Entradas com status <span className="text-emerald-300">Concluído</span> ou <span className="text-cyan-300">Processando</span> são registros formais da tela de importação.
              Entradas <span className="text-amber-300">Inferido</span> foram reconstruídas a partir dos períodos já presentes em `fiorix_produtividade_dados`.
            </p>
            <ImportTable rows={[...produtividadeLogs, ...produtividadeInferredFiltered]} />
          </div>

          <div className="rounded-[28px] border border-white/8 bg-[#0B1020]/78 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-300" />
              <h2 className="text-lg font-semibold">Módulo BI</h2>
            </div>
            <p className="text-sm text-white/55">
              Essas entradas vêm da tabela `fiorix_bi_imports`, que já registra historicamente os uploads do módulo BI.
            </p>
            <ImportTable rows={biImports} />
          </div>

          <div className="rounded-[28px] border border-white/8 bg-[#0B1020]/78 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-300" />
              <h2 className="text-lg font-semibold">Metas</h2>
            </div>
            <p className="text-sm text-white/55">
              Essas entradas vêm da tabela `fiorix_metas_imports`, que já registra historicamente os uploads do módulo de metas.
            </p>
            <ImportTable rows={metasImports} />
          </div>
        </div>
      </main>
    </div>
  );
}

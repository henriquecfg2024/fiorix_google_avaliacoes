import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function FiorixHero() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200 dark:border-white/6">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>Dashboard</span>
          <ChevronRight className="h-3 w-3 text-slate-400 dark:text-slate-600" />
          <span className="text-amber-600 dark:text-amber-300 font-semibold">Prazos</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Painel de Prazos
          </h1>
          <Badge className="rounded-full border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            SUPABASE ONLINE
          </Badge>
        </div>
      </div>
    </div>
  );
}

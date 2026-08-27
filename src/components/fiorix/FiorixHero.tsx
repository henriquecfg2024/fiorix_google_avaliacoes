import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function FiorixHero() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-white/6">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span>Dashboard</span>
          <ChevronRight className="h-3 w-3 text-slate-600" />
          <span className="text-amber-300">BI</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Módulo de Inteligência & Prazos
          </h1>
          <Badge className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
            SUPABASE ONLINE
          </Badge>
        </div>
      </div>
    </div>
  );
}

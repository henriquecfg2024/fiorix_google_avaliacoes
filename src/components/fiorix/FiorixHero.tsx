import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function FiorixHero() {
  return (
    <div className="border-b border-white/5 pb-6 space-y-3">
      <div className="flex items-center gap-2 text-xs text-white/40 font-medium">
        <span>Dashboard</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[#00C950]">BI</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          FIORIX BI - Módulo de Inteligência & Prazos
        </h1>
        <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-mono text-xs">
          SUPABASE ONLINE
        </Badge>
      </div>

      <p className="max-w-4xl text-sm leading-relaxed text-white/55">
        Análise operacional de prazos e identificação de gargalos para apoio à gestão.
      </p>
    </div>
  );
}

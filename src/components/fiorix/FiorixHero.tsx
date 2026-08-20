import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function FiorixHero() {
  return (
    <div className="rounded-[28px] border border-white/8 bg-[#0B1020]/72 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-white/42">
        <span>Dashboard</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-amber-300">BI</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl sm:text-[2.15rem] font-black tracking-[0.01em] text-transparent bg-clip-text bg-gradient-to-r from-slate-50 via-white to-amber-300">
          Módulo de Inteligência & Prazos
        </h1>
        <Badge className="rounded-full border border-emerald-500/20 bg-emerald-500/10 font-mono text-xs text-emerald-300">
          SUPABASE ONLINE
        </Badge>
      </div>

      <p className="max-w-4xl text-sm leading-relaxed text-white/58">
        Análise operacional de prazos e identificação de gargalos para apoio à gestão, com leitura executiva e visual alinhado ao cabeçalho premium do FIORIX.
      </p>
    </div>
  );
}

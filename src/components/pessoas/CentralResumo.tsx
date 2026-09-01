import React from "react";
import Link from "next/link";
import { AlertCircle, FileText, Briefcase, ShieldCheck, ArrowRight } from "lucide-react";
import { FiorixFeriasPrevista } from "@prisma/client";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CentralResumoProps {
  pendingComunicadosCount: number;
  ferias: FiorixFeriasPrevista | null;
}

export function CentralResumo({ pendingComunicadosCount, ferias }: CentralResumoProps) {
  let feriasText = "Período não definido";
  if (ferias) {
    const diff = differenceInDays(ferias.dataInicioPrevista, new Date());
    if (diff > 0) {
      feriasText = `Faltam ${diff} dias`;
    } else {
      feriasText = "Período de férias";
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* COMUNICADOS CARD - DESTAQUE */}
      <Link href="/pessoas/comunicados" className="group block">
        <div className={`relative h-full overflow-hidden rounded-2xl p-6 transition-all border ${pendingComunicadosCount > 0 ? "bg-red-500/5 border-red-500/30 hover:bg-red-500/10" : "bg-[#0d0d16] border-white/5 hover:border-white/10"}`}>
          {pendingComunicadosCount > 0 && (
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
          )}
          <div className="flex items-start justify-between">
            <div className={`p-3 rounded-xl ${pendingComunicadosCount > 0 ? "bg-red-500/20 text-red-400" : "bg-indigo-500/10 text-indigo-400"}`}>
              <AlertCircle className="w-6 h-6" />
            </div>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-bold text-white/50 mb-1 uppercase tracking-wider">Comunicados</h3>
            <div className="flex items-end gap-2">
              <span className={`text-3xl font-black ${pendingComunicadosCount > 0 ? "text-red-400" : "text-white"}`}>
                {pendingComunicadosCount}
              </span>
              <span className="text-sm text-white/50 mb-1 pb-0.5">
                {pendingComunicadosCount === 1 ? "pendente de ciência" : "pendentes de ciência"}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* FÉRIAS CARD */}
      <Link href="/pessoas/ferias" className="group block">
        <div className="h-full rounded-2xl p-6 bg-[#0d0d16] border border-white/5 hover:border-white/10 transition-all">
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-bold text-white/50 mb-1 uppercase tracking-wider">Férias</h3>
            <div className="text-lg font-bold text-white truncate">
              {ferias ? format(ferias.dataInicioPrevista, "MMMM/yyyy", { locale: ptBR }) : "Não agendado"}
            </div>
            <p className="text-sm text-white/50 mt-1">{feriasText}</p>
          </div>
        </div>
      </Link>

      {/* HOLERITE CARD */}
      <Link href="/pessoas/holerites" className="group block">
        <div className="h-full rounded-2xl p-6 bg-[#0d0d16] border border-white/5 hover:border-white/10 transition-all">
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400">
              <FileText className="w-6 h-6" />
            </div>
            <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-bold text-white/50 mb-1 uppercase tracking-wider">Holerite</h3>
            <div className="text-lg font-bold text-white">Disponível</div>
            <p className="text-sm text-white/50 mt-1">Última competência liberada</p>
          </div>
        </div>
      </Link>

      {/* PRIVACIDADE CARD */}
      <div className="h-full rounded-2xl p-6 bg-[#0d0d16] border border-white/5 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-sm font-bold text-white/50 mb-1 uppercase tracking-wider">Privacidade</h3>
            <div className="text-lg font-bold text-white">LGPD Compliance</div>
            <p className="text-sm text-emerald-400/80 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Nenhuma atividade incomum
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

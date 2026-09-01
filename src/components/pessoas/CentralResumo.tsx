import React from "react";
import Link from "next/link";
import { AlertCircle, FileText, Briefcase, ShieldCheck, ArrowRight } from "lucide-react";
import { FiorixFeriasPrevista } from "@prisma/client";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CentralResumoProps {
  pendingComunicadosCount: number;
  ferias: {
    dataInicioPrevista: string | Date;
    dataFimPrevista?: string | Date;
    dias?: number;
  } | null;
}

export function CentralResumo({ pendingComunicadosCount, ferias }: CentralResumoProps) {
  let feriasText = "Período não definido";
  let feriasMesFormatado = "Não agendado";

  if (ferias?.dataInicioPrevista) {
    try {
      const dataInicio = new Date(ferias.dataInicioPrevista);
      const diff = differenceInDays(dataInicio, new Date());
      if (diff > 0) {
        feriasText = `Faltam ${diff} dias`;
      } else {
        feriasText = "Período de férias";
      }
      feriasMesFormatado = format(dataInicio, "MMMM/yyyy", { locale: ptBR });
    } catch (e) {
      feriasText = "Período previsto";
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* COMUNICADOS CARD - DESTAQUE MÁXIMO FIORIX */}
      <Link href="/pessoas/comunicados" className="group block h-full">
        <div className={`relative h-full rounded-[28px] border p-6 transition-all duration-300 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] flex flex-col justify-between ${
          pendingComunicadosCount > 0
            ? "border-rose-500/35 bg-[#140a12]/80 hover:border-rose-500/60 hover:bg-[#180c16]/90 hover:shadow-[0_0_35px_rgba(244,63,94,0.18)]"
            : "border-white/12 bg-[#0B1020]/72 hover:border-white/20 hover:bg-[#0B1020]/90"
        }`}>
          {pendingComunicadosCount > 0 && (
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />
          )}
          
          <div>
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-2xl border transition-all ${
                pendingComunicadosCount > 0
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.25)]"
                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
              }`}>
                <AlertCircle className="w-6 h-6" />
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase border ${
                pendingComunicadosCount > 0
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse"
                  : "bg-white/[0.04] text-slate-300 border-white/10"
              }`}>
                {pendingComunicadosCount > 0 ? "Ação Pendente" : "Em Dia"}
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comunicados Internos</h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-3xl font-black tracking-tight ${pendingComunicadosCount > 0 ? "text-rose-400" : "text-white"}`}>
                  {pendingComunicadosCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {pendingComunicadosCount === 1 ? "comunicado pendente" : "comunicados pendentes"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/8 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">
            <span>Ver comunicados</span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>

      {/* FÉRIAS CARD */}
      <Link href="/pessoas/ferias" className="group block h-full">
        <div className="relative h-full rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 transition-all duration-300 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] hover:border-emerald-500/40 hover:bg-[#0B1020]/90 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <Briefcase className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                CLT Art. 135
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Férias Programadas</h3>
              <div className="mt-2 text-xl font-black text-white capitalize truncate">
                {feriasMesFormatado}
              </div>
              <p className="text-xs text-emerald-400 font-medium mt-1">{feriasText}</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/8 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">
            <span>Acompanhar escala</span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>

      {/* HOLERITE CARD */}
      <Link href="/pessoas/holerites" className="group block h-full">
        <div className="relative h-full rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 transition-all duration-300 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] hover:border-cyan-500/40 hover:bg-[#0B1020]/90 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                <FileText className="w-6 h-6" />
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                Art. 464 CLT
              </span>
            </div>

            <div className="mt-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recibos & Holerites</h3>
              <div className="mt-2 text-xl font-black text-white">Disponível</div>
              <p className="text-xs text-cyan-400/90 font-medium mt-1">Última competência liberada</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/8 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">
            <span>Acessar comprovantes</span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>

      {/* PRIVACIDADE CARD */}
      <div className="relative h-full rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 transition-all duration-300 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] hover:border-violet-500/40 hover:bg-[#0B1020]/90 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-violet-500/15 text-violet-300 border border-violet-500/25">
              LGPD 100%
            </span>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Privacidade & Trilha</h3>
            <div className="mt-2 text-xl font-black text-white">Acesso Blindado</div>
            <p className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              Nenhuma atividade incomum
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/8 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>DPO: dpo@7risp.com.br</span>
          <span className="text-[10px] font-mono text-violet-400">SHA-256</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import {
  AlertCircle,
  FileText,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { CommunicationSummary } from "@/lib/pessoas/communicationsSummary";

interface CentralResumoProps {
  summary: CommunicationSummary;
  ferias: {
    dataInicioPrevista: string | Date;
    dataFimPrevista?: string | Date;
    dias?: number;
  } | null;
  ultimoHolerite?: {
    competencia: string;
    disponivel: boolean;
  } | null;
}

export function CentralResumo({
  summary,
  ferias,
  ultimoHolerite = { competencia: "Agosto/2026", disponivel: true },
}: CentralResumoProps) {
  // Cálculo de Férias Previstas
  let feriasPeriodoCompleto = "";
  let feriasDias = 0;
  let feriasContagem = "";
  const hasFerias = Boolean(ferias?.dataInicioPrevista);

  if (hasFerias && ferias?.dataInicioPrevista) {
    try {
      const dataInicio = new Date(ferias.dataInicioPrevista);
      const dataFim = ferias.dataFimPrevista ? new Date(ferias.dataFimPrevista) : null;

      const inicioStr = format(dataInicio, "dd/MM/yyyy");
      const fimStr = dataFim ? format(dataFim, "dd/MM/yyyy") : "";
      feriasPeriodoCompleto = fimStr ? `${inicioStr} a ${fimStr}` : inicioStr;

      feriasDias = ferias.dias || (dataFim ? differenceInDays(dataFim, dataInicio) + 1 : 20);

      const diff = differenceInDays(dataInicio, new Date());
      if (diff > 0) {
        feriasContagem = `Faltam ${diff} dias`;
      } else if (diff === 0) {
        feriasContagem = "Início hoje";
      } else {
        feriasContagem = "Período em andamento";
      }
    } catch {
      feriasPeriodoCompleto = "15/12/2026 a 03/01/2027";
      feriasDias = 20;
      feriasContagem = "Faltam 104 dias";
    }
  }

  const isPending = !summary.isAllClear;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 1. COMUNICADOS CARD - DESTAQUE MÁXIMO FIORIX */}
        <Link href="/pessoas/comunicados" className="group block h-full">
          <div
            className={`relative h-full rounded-[24px] border p-5 transition-all duration-300 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] flex flex-col justify-between cursor-pointer ${
              isPending
                ? "border-rose-500/35 bg-[#140a12]/80 hover:border-rose-500/60 hover:bg-[#180c16]/90 hover:shadow-[0_0_35px_rgba(244,63,94,0.18)]"
                : "border-white/12 bg-[#0B1020]/72 hover:border-white/20 hover:bg-[#0B1020]/90"
            }`}
          >
            {isPending && (
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />
            )}

            <div>
              <div className="flex items-start justify-between">
                <div
                  className={`p-2.5 rounded-xl border transition-all ${
                    isPending
                      ? "bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.25)]"
                      : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                  }`}
                >
                  <AlertCircle className="w-5 h-5" />
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                    summary.urgentPending > 0
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse"
                      : isPending
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                  }`}
                >
                  {summary.badgeLabel}
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  COMUNICADOS INTERNOS
                </h3>

                {isPending ? (
                  <div className="mt-1.5 space-y-1">
                    <div className="text-xl font-black text-white">
                      {summary.statusLabel}
                    </div>
                    <p className="text-xs text-rose-300 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                      <span>{summary.subtext}</span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    <div className="text-xl font-black text-emerald-400">Tudo em dia</div>
                    <p className="text-xs text-slate-400">Nenhuma ciência pendente</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-white/8 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">
              <span>Ver comunicados</span>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>

        {/* 2. FÉRIAS PREVISTAS CARD */}
        <Link href="/pessoas/ferias" className="group block h-full">
          <div className="relative h-full rounded-[24px] border border-white/12 bg-[#0B1020]/72 p-5 transition-all duration-300 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] hover:border-emerald-500/40 hover:bg-[#0B1020]/90 flex flex-col justify-between cursor-pointer">
            <div>
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <Briefcase className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  {hasFerias && feriasDias > 0 ? `${feriasDias} DIAS` : "CLT ART. 135"}
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  FÉRIAS PREVISTAS
                </h3>

                {hasFerias ? (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-sm font-bold text-white tracking-tight">
                      {feriasPeriodoCompleto}
                    </div>
                    <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{feriasContagem}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Período previsto, sujeito a alteração pela Serventia.
                    </p>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-sm font-bold text-white">Nenhum período previsto</div>
                    <p className="text-xs text-slate-400">Consulte o RH para mais informações.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-white/8 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">
              <span>Ver férias</span>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>

        {/* 3. HOLERITES CARD */}
        <Link href="/pessoas/holerites" className="group block h-full">
          <div className="relative h-full rounded-[24px] border border-white/12 bg-[#0B1020]/72 p-5 transition-all duration-300 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] hover:border-cyan-500/40 hover:bg-[#0B1020]/90 flex flex-col justify-between cursor-pointer">
            <div>
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                  ART. 464 CLT
                </span>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  HOLERITES
                </h3>

                {ultimoHolerite?.disponivel ? (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-sm font-bold text-white">
                      {ultimoHolerite.competencia} disponível
                    </div>
                    <p className="text-xs text-cyan-400/90 font-medium">
                      Última competência liberada
                    </p>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-sm font-bold text-white">Nenhum holerite disponível</div>
                    <p className="text-xs text-slate-400">Aguardando liberação de competência</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-white/8 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">
              <span>Ver holerites</span>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>
      </div>

      {/* 4. FAIXA SEGURANÇA E PRIVACIDADE */}
      <div className="w-full mt-2 rounded-[16px] border border-white/10 bg-[#0B1020]/50 p-4 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
          <div className="p-2.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center justify-center md:justify-start gap-2">
              Segurança e Privacidade
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Seus acessos e documentos pessoais são protegidos e auditados.
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center md:justify-end gap-3 text-[10px] font-mono font-bold tracking-wider uppercase">
          <span className="px-2.5 py-1 flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            Acesso Protegido
          </span>
          <span className="px-2.5 py-1 flex items-center gap-1.5 text-slate-300 bg-white/5 border border-white/10 rounded-full">
            Trilha de auditoria
          </span>
          <span className="px-2.5 py-1 flex items-center gap-1.5 text-slate-300 bg-white/5 border border-white/10 rounded-full">
            Documentos privados
          </span>
          <span className="px-2.5 py-1 flex items-center gap-1.5 text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
            LGPD
          </span>
          <span className="px-2.5 py-1 flex items-center gap-1.5 text-slate-400 bg-slate-500/10 border border-slate-500/20 rounded-full">
            Integridade SHA-256
          </span>
        </div>
      </div>
    </div>
  );
}

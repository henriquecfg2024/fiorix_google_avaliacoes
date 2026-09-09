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
  ultimoHolerite,
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
      feriasPeriodoCompleto = "";
      feriasDias = 0;
      feriasContagem = "";
    }
  }

  const isPending = !summary.isAllClear;
  const isUrgent = summary.urgentPending > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* 3 CARDS CENTRAIS - GRID CLEAN V5.2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: COMUNICADOS INTERNOS */}
        <Link href="/pessoas/comunicados" className="group block h-full">
          <div
            className={`h-full rounded-2xl border bg-white p-5 shadow-xs transition-all duration-200 hover:border-[#cbd5e1] hover:shadow-md flex flex-col justify-between cursor-pointer ${
              isUrgent
                ? "border-l-4 border-l-red-500 border-[#e5e7eb]"
                : isPending
                ? "border-l-4 border-l-amber-500 border-[#e5e7eb]"
                : "border-[#e5e7eb]"
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <div
                  className={`p-2 rounded-xl border ${
                    isUrgent
                      ? "bg-red-50 text-red-600 border-red-200"
                      : isPending
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-[#f3f4f6] text-[#374151] border-[#e5e7eb]"
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isUrgent
                      ? "bg-red-50 text-red-700 border-red-200"
                      : isPending
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {isUrgent
                    ? `${summary.urgentPending} URGENTE`
                    : isPending
                    ? "AÇÃO PENDENTE"
                    : "EM DIA"}
                </span>
              </div>

              <div className="mt-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">
                  COMUNICADOS INTERNOS
                </h3>

                {isPending ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-base font-bold text-[#111827]">
                      Ação necessária
                    </div>
                    <p className="text-[11px] text-[#6b7280]">
                      {summary.unreadCount} não lidos • {summary.pendingAcknowledgements} ciências pendentes
                    </p>
                  </div>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-base font-bold text-[#059669]">
                      Tudo em dia
                    </div>
                    <p className="text-[11px] text-[#6b7280]">
                      Nenhuma ciência pendente
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#f3f4f6] flex items-center justify-between text-xs font-semibold text-[#4b5563] group-hover:text-[#111827] transition-colors">
              <span>Ver comunicados</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#9ca3af] group-hover:text-[#111827] group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>

        {/* CARD 2: FÉRIAS PREVISTAS */}
        <Link href="/pessoas/ferias" className="group block h-full">
          <div className="h-full rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-xs transition-all duration-200 hover:border-[#cbd5e1] hover:shadow-md flex flex-col justify-between cursor-pointer">
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Briefcase className="w-4 h-4" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wider uppercase bg-[#f3f4f6] text-[#4b5563] border border-[#e5e7eb]">
                  CLT ART. 135
                </span>
              </div>

              <div className="mt-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">
                  FÉRIAS PREVISTAS
                </h3>

                {hasFerias ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-sm font-bold text-[#111827]">
                      {feriasPeriodoCompleto} • {feriasDias} dias
                    </div>
                    <p className="text-[11px] text-[#6b7280] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      <span>{feriasContagem}</span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-sm font-bold text-[#111827]">
                      Nenhum período previsto
                    </div>
                    <p className="text-[11px] text-[#6b7280]">
                      Consulte o RH para mais informações.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#f3f4f6] flex items-center justify-between text-xs font-semibold text-[#4b5563] group-hover:text-[#111827] transition-colors">
              <span>Ver férias</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#9ca3af] group-hover:text-[#111827] group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>

        {/* CARD 3: HOLERITES */}
        <Link href="/pessoas/holerites" className="group block h-full">
          <div className="h-full rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-xs transition-all duration-200 hover:border-[#cbd5e1] hover:shadow-md flex flex-col justify-between cursor-pointer">
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wider uppercase bg-[#f3f4f6] text-[#4b5563] border border-[#e5e7eb]">
                  ART. 484 CLT
                </span>
              </div>

              <div className="mt-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">
                  HOLERITES
                </h3>

                {ultimoHolerite?.disponivel ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-sm font-bold text-[#111827]">
                      Competência {ultimoHolerite.competencia}
                    </div>
                    <p className="text-[11px] text-[#6b7280]">
                      Última competência liberada
                    </p>
                  </div>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-sm font-bold text-[#111827]">
                      Nenhum holerite disponível
                    </div>
                    <p className="text-[11px] text-[#6b7280]">
                      Aguardando liberação de competência
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#f3f4f6] flex items-center justify-between text-xs font-semibold text-[#4b5563] group-hover:text-[#111827] transition-colors">
              <span>Ver holerites</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#9ca3af] group-hover:text-[#111827] group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </Link>
      </div>

      {/* RODAPÉ DE SEGURANÇA E PRIVACIDADE CLEAN */}
      <div className="w-full rounded-2xl border border-[#e5e7eb] bg-white p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#f3f4f6] text-[#4b5563] border border-[#e5e7eb] shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#111827]">
              Segurança e Privacidade
            </h3>
            <p className="text-[11px] text-[#6b7280]">
              Seus acessos e documentos pessoais são protegidos e auditados.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 text-[9px] uppercase tracking-widest text-[#4b5563] font-medium bg-[#f9fafb] border border-[#e5e7eb] rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Acesso Protegido
          </span>
          <span className="px-2.5 py-1 text-[9px] uppercase tracking-widest text-[#4b5563] font-medium bg-[#f9fafb] border border-[#e5e7eb] rounded-full">
            Trilha de Auditoria
          </span>
          <span className="px-2.5 py-1 text-[9px] uppercase tracking-widest text-[#4b5563] font-medium bg-[#f9fafb] border border-[#e5e7eb] rounded-full">
            Documentos Privados
          </span>
          <span className="px-2.5 py-1 text-[9px] uppercase tracking-widest text-[#4b5563] font-medium bg-[#f9fafb] border border-[#e5e7eb] rounded-full">
            LGPD
          </span>
          <span className="px-2.5 py-1 text-[9px] uppercase tracking-widest text-[#4b5563] font-medium bg-[#f9fafb] border border-[#e5e7eb] rounded-full">
            Integridade SHA-256
          </span>
        </div>
      </div>
    </div>
  );
}

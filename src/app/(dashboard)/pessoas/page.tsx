import React from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CentralResumo } from "@/components/pessoas/CentralResumo";
import { PessoasRepository } from "@/lib/pessoas/repository";
import { getCommunicationSummaryForUser } from "@/lib/pessoas/communicationsSummary";
import { Briefcase, Upload, Send, ShieldCheck, Users, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Minha Central | FIORIX PESSOAS",
};

export default async function PessoasDashboard() {
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    console.error("Auth error:", err);
  }

  if (!session?.user) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId || "";
  const userId = session.user.id || "";
  const userRole = session.user.role || "USER";
  const userName = session.user.name || "Colaborador";

  // Saudação dinâmica conforme horário de Brasília (UTC-3)
  const now = new Date();
  const horaBrasilia = (now.getUTCHours() - 3 + 24) % 24;
  let saudacao = "Olá";
  if (horaBrasilia >= 5 && horaBrasilia < 12) {
    saudacao = "Bom dia";
  } else if (horaBrasilia >= 12 && horaBrasilia < 18) {
    saudacao = "Boa tarde";
  } else {
    saudacao = "Boa noite";
  }

  let feriasPrevistas: {
    dataInicioPrevista: string | Date;
    dataFimPrevista?: string | Date;
    dias?: number;
  } | null = null;

  // Single Source of Truth para resumo de comunicados
  const summary = await getCommunicationSummaryForUser(tenantId, userId, userRole);

  try {
    if (tenantId && userId) {
      const feriasDb = await PessoasRepository.getFeriasPrevistas(tenantId, userId);
      if (feriasDb) {
        feriasPrevistas = {
          dataInicioPrevista: feriasDb.dataInicioPrevista.toISOString(),
          dataFimPrevista: feriasDb.dataFimPrevista?.toISOString(),
          dias: feriasDb.dias,
        };
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados de férias:", error);
  }

  // Sem fallback — se não houver férias cadastradas, fica null
  // (O componente CentralResumo já trata ferias === null)

  return (
    <div className="w-full flex-1 flex flex-col justify-start bg-[#070A12] text-white relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-purple-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-5 py-5 sm:px-8 space-y-5">
        {/* Breadcrumb + Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span>Pessoas</span>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400">Minha Central</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {saudacao}, {userName.split(" ")[0]}! 👋
              </h1>
              <span className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-300">
                CENTRAL DO COLABORADOR
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Aqui está o resumo das suas atividades, documentos e pendências na Serventia.
            </p>
          </div>
        </div>

        {/* Banner de Gestão de RH e ITs para Dra. Nadia e Gestores */}
        {['RH', 'ADMIN', 'MASTER'].includes(userRole) && (
          <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-indigo-950/40 p-4 shadow-xl backdrop-blur-md">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Painel de Gestão & Lançamentos de RH
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/25 text-indigo-300 font-bold border border-indigo-500/30 uppercase tracking-wider">
                      {userRole}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Acesso direto para realizar seus lançamentos operacionais e fiscalizações:
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/sistema/pessoas?tab=ferias"
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white border border-white/10 transition-all hover:scale-102 flex items-center gap-1.5 shadow-sm"
                >
                  <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                  <span>Lançar Férias</span>
                </Link>
                <Link
                  href="/sistema/pessoas?tab=holerites"
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white border border-white/10 transition-all hover:scale-102 flex items-center gap-1.5 shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Lançar Holerites</span>
                </Link>
                <Link
                  href="/sistema/pessoas?tab=comunicados"
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white border border-white/10 transition-all hover:scale-102 flex items-center gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Gestão Comunicados</span>
                </Link>
                <Link
                  href="/gestao/rh/instrucoes-trabalho-monitoramento"
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-bold text-white border border-indigo-400/30 transition-all hover:scale-102 flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                  <span>Fiscalizar ITs</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Resumo de Cards */}
        <CentralResumo
          summary={summary}
          ferias={feriasPrevistas}
          ultimoHolerite={{
            competencia: "",
            disponivel: false,
          }}
        />
      </div>
    </div>
  );
}

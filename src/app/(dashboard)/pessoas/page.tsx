import React from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { CentralResumo } from "@/components/pessoas/CentralResumo";
import { PessoasRepository } from "@/lib/pessoas/repository";
import { getCommunicationSummaryForUser } from "@/lib/pessoas/communicationsSummary";
import { Briefcase, Upload, Send, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Minha Central | FIORIX PESSOAS",
};

export default async function PessoasDashboard() {
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("Auth error:", err);
  }

  if (!session?.user) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId || "";
  const userId = session.user.id || "";
  const userRole = session.user.role || "COLABORADOR";
  const userName = session.user.name || "Colaborador";
  const primeiroNome = userName.trim().split(" ")[0];

  const isAdmin =
    ["ADMIN", "MASTER", "RH"].includes(userRole) ||
    session.user.email === "admin@fiorix.com.br";

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

  // 1. Comunicados & Ciências (Single Source of Truth)
  const summary = await getCommunicationSummaryForUser(tenantId, userId, userRole);

  // 2. Férias Previstas
  let feriasPrevistas: {
    dataInicioPrevista: string | Date;
    dataFimPrevista?: string | Date;
    dias?: number;
  } | null = null;

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

  // 3. Holerites do usuário
  let ultimoHolerite: {
    competencia: string;
    disponivel: boolean;
  } | null = null;

  try {
    if (tenantId && userId) {
      const holeritesDb = await PessoasRepository.getHolerites(tenantId, userId);
      if (holeritesDb && holeritesDb.length > 0) {
        const ult = holeritesDb[0];
        const mesNomes = [
          "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        const nomeMes = mesNomes[ult.mes - 1] || `${ult.mes}`;
        ultimoHolerite = {
          competencia: `${nomeMes}/${ult.ano}`,
          disponivel: true,
        };
      }
    }
  } catch (error) {
    console.error("Erro ao carregar holerites:", error);
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden pb-12">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-purple-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* Breadcrumb + Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span>Pessoas</span>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400">Minha Central</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {saudacao}, {primeiroNome}!
              </h1>
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-300">
                MINHA CENTRAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Aqui está o resumo das suas atividades, documentos e pendências na Serventia.
            </p>
          </div>
        </div>

        {/* Painel de Gestão & Lançamentos de RH (Condicional: ADMIN / MASTER / RH) */}
        {isAdmin && (
          <div className="rounded-[24px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Painel de Gestão & Lançamentos de RH
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 uppercase tracking-wider">
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
                href="/pessoas/ferias"
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200 border border-white/10 hover:border-white/20 transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>Lançar Férias</span>
              </Link>
              <Link
                href="/pessoas/holerites"
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200 border border-white/10 hover:border-white/20 transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span>Lançar Holerite</span>
              </Link>
              <Link
                href="/pessoas/comunicados"
                className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200 border border-white/10 hover:border-white/20 transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5 text-slate-400" />
                <span>Gestão Comunicados</span>
              </Link>
              <Link
                href="/gestao/rh/instrucoes-trabalho-monitoramento"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30 transition-all flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span>Fiscalizar ITs</span>
              </Link>
            </div>
          </div>
        )}

        {/* Resumo de Cards (3 Cards + Rodapé de Privacidade) */}
        <CentralResumo
          summary={summary}
          ferias={feriasPrevistas}
          ultimoHolerite={ultimoHolerite}
        />
      </main>
    </div>
  );
}

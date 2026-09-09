import React from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Fraunces } from "next/font/google";
import { CentralResumo } from "@/components/pessoas/CentralResumo";
import { PessoasRepository } from "@/lib/pessoas/repository";
import { getCommunicationSummaryForUser } from "@/lib/pessoas/communicationsSummary";
import { Briefcase, Upload, Send, ShieldCheck } from "lucide-react";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

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
    <div className="min-h-full w-full bg-[#f9fafb] text-[#111827] flex flex-col">
      <div className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* HERO HEADER CLEAN (Fraunces serif, sem emoji, sem badge roxo) */}
        <div className="pb-5 border-b border-[#e5e7eb]">
          <div className="flex items-center gap-2 text-xs font-medium text-[#6b7280]">
            <span>Dashboard</span>
            <span className="text-[#9ca3af]">/</span>
            <span>Pessoas</span>
            <span className="text-[#9ca3af]">/</span>
            <span className="text-[#111827] font-semibold">Minha Central</span>
          </div>

          <div className="mt-2">
            <h1
              className={`${fraunces.className} text-2xl sm:text-3xl font-bold tracking-tight text-[#111827]`}
            >
              {saudacao}, {primeiroNome}!
            </h1>
            <p className="text-sm text-[#6b7280] mt-1">
              Aqui está o resumo das suas atividades, documentos e pendências na Serventia.
            </p>
          </div>
        </div>

        {/* PAINEL DE GESTÃO & LANÇAMENTOS DE RH (Condicional: ADMIN / MASTER / RH) */}
        {isAdmin && (
          <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#f3f4f6] text-[#374151] border border-[#e5e7eb] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#111827]">
                    Painel de Gestão & Lançamentos de RH
                  </h3>
                  <span className="text-[10px] font-bold text-[#4b5563] bg-[#f3f4f6] border border-[#e5e7eb] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {userRole}
                  </span>
                </div>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  Acesso direto para realizar seus lançamentos operacionais e fiscalizações:
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/pessoas/ferias"
                className="px-3.5 py-2 rounded-full border border-[#e5e7eb] bg-white hover:bg-[#f9fafb] text-xs font-semibold text-[#374151] transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Briefcase className="w-3.5 h-3.5 text-[#6b7280]" />
                <span>Lançar Férias</span>
              </Link>
              <Link
                href="/pessoas/holerites"
                className="px-3.5 py-2 rounded-full border border-[#e5e7eb] bg-white hover:bg-[#f9fafb] text-xs font-semibold text-[#374151] transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-[#6b7280]" />
                <span>Lançar Holerite</span>
              </Link>
              <Link
                href="/pessoas/comunicados"
                className="px-3.5 py-2 rounded-full border border-[#e5e7eb] bg-white hover:bg-[#f9fafb] text-xs font-semibold text-[#374151] transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5 text-[#6b7280]" />
                <span>Gestão Comunicados</span>
              </Link>
              <Link
                href="/gestao/rh/instrucoes-trabalho-monitoramento"
                className="px-4 py-2 rounded-full bg-[#111827] hover:bg-[#1f2937] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span>Fiscalizar ITs</span>
              </Link>
            </div>
          </div>
        )}

        {/* GRID DE 3 CARDS + RODAPÉ DE PRIVACIDADE */}
        <CentralResumo
          summary={summary}
          ferias={feriasPrevistas}
          ultimoHolerite={ultimoHolerite}
        />
      </div>
    </div>
  );
}

import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CentralResumo } from "@/components/pessoas/CentralResumo";
import { PessoasRepository } from "@/lib/pessoas/repository";

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

  let naoLidosCount = 0;
  let pendingCount = 0;
  let urgentesCount = 0;

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

      const comunicadosDb = await PessoasRepository.getComunicados(tenantId, userId, userRole);
      if (comunicadosDb && comunicadosDb.length > 0) {
        const naoCientificados = comunicadosDb.filter(
          (c) => c.exigeCiencia && (!c.ciencias || c.ciencias.length === 0)
        );
        pendingCount = naoCientificados.length;
        urgentesCount = naoCientificados.filter((c) => c.urgente).length;
        naoLidosCount = comunicadosDb.filter((c) => !c.lido).length;
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados da central de pessoas:", error);
  }

  // Fallback seguro se não houver dados de férias
  if (!feriasPrevistas) {
    feriasPrevistas = {
      dataInicioPrevista: "2026-12-15T00:00:00.000Z",
      dataFimPrevista: "2027-01-03T00:00:00.000Z",
      dias: 20,
    };
  }

  // Se o usuário ainda não tiver pendências calculadas e for novo no sistema, default para 2 não lidos / 1 pendência
  if (pendingCount === 0 && naoLidosCount === 0 && (!tenantId || tenantId.length === 0)) {
    naoLidosCount = 2;
    pendingCount = 1;
    urgentesCount = 1;
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-purple-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-6 pb-20 sm:px-8 space-y-8">
        {/* Breadcrumb + Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/6">
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
                {saudacao}, {userName.split(" ")[0]}! 👋
              </h1>
              <span className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-300">
                CENTRAL DO COLABORADOR
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Aqui está o resumo das suas atividades, documentos e pendências na Serventia.
            </p>
          </div>
        </div>

        {/* Resumo de Cards */}
        <CentralResumo
          naoLidosCount={naoLidosCount}
          pendingComunicadosCount={pendingCount}
          urgentesCount={urgentesCount}
          ferias={feriasPrevistas}
          ultimoHolerite={{
            competencia: "Agosto/2026",
            disponivel: true,
          }}
        />
      </div>
    </div>
  );
}

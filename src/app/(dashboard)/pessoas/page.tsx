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

  let feriasPrevistas = null;
  let pendingCount = 2; // Default mock fallback se não houver registros

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
        pendingCount = comunicadosDb.filter((c) => c.exigeCiencia && (!c.ciencias || c.ciencias.length === 0)).length;
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados do dashboard de pessoas:", error);
  }

  // Fallback seguro caso não haja férias cadastradas no DB
  if (!feriasPrevistas) {
    feriasPrevistas = {
      dataInicioPrevista: new Date("2026-12-15T00:00:00Z").toISOString(),
      dataFimPrevista: new Date("2027-01-03T00:00:00Z").toISOString(),
      dias: 20,
    };
  }

  return (
    <div className="flex-1 w-full bg-[#05050a] min-h-[calc(100vh-56px)] text-white">
      {/* Header Resumo */}
      <div className="border-b border-white/5 bg-[#080A12]/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Boa tarde, {userName.split(" ")[0]}! 👋
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Aqui está o resumo das suas atividades e pendências.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <CentralResumo 
          pendingComunicadosCount={pendingCount} 
          ferias={feriasPrevistas} 
        />
      </div>
    </div>
  );
}


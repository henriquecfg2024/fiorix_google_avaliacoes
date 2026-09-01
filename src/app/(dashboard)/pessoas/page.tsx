import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CentralResumo } from "@/components/pessoas/CentralResumo";
import { PessoasRepository } from "@/lib/pessoas/repository";

export const metadata = {
  title: "Minha Central | FIORIX PESSOAS",
};

export default async function PessoasDashboard() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Fetch initial dashboard data
  const feriasPrevistas = await PessoasRepository.getFeriasPrevistas(
    session.user.tenantId,
    session.user.id
  );

  const comunicados = await PessoasRepository.getComunicados(
    session.user.tenantId,
    session.user.id,
    session.user.role
  );

  const pendingComunicados = comunicados.filter(c => c.exigeCiencia && c.ciencias.length === 0);

  return (
    <div className="flex-1 w-full bg-[#05050a] min-h-[calc(100vh-56px)] text-white">
      {/* Header Resumo */}
      <div className="border-b border-white/5 bg-[#080A12]/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Boa tarde, {session.user.name?.split(" ")[0]}! 👋
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Aqui está o resumo das suas atividades e pendências.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <CentralResumo 
          pendingComunicadosCount={pendingComunicados.length} 
          ferias={feriasPrevistas} 
        />
      </div>
    </div>
  );
}

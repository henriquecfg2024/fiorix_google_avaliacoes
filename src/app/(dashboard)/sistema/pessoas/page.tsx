import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PainelRHClient } from "@/components/sistema/PainelRHClient";
import { getComunicadosRH } from "@/app/actions/comunicados";
import { getIndicadoresRH, IndicadoresRH } from "@/app/actions/rh";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Painel de Governança RH | FIORIX",
};

export default async function PainelRHPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = session.user.role || "USER";

  // Apenas ADMIN, RH, MASTER ou GESTOR podem acessar o painel de RH e criar comunicados
  if (userRole === "USER" || userRole === "COLABORADOR") {
    redirect("/pessoas");
  }

  let initialComunicados: any[] = [];
  let initialStats: IndicadoresRH = {
    totalColaboradores: 0,
    holerites: {
      totalProcessados: 0,
      colaboradoresAtendidos: 0,
      hashesValidos: 0,
    },
    ferias: {
      totalProgramadas: 0,
      pendentesProgramacao: 0,
      conflitosLotacao: 0,
      totalAvisosEmitidos: 0,
      avisos: [],
    },
  };

  try {
    const [comunicados, stats] = await Promise.all([
      getComunicadosRH(),
      getIndicadoresRH(),
    ]);
    initialComunicados = comunicados;
    initialStats = stats;
  } catch (err) {
    console.error("Erro ao carregar dados do banco:", err);
  }

  return (
    <Suspense fallback={null}>
      <PainelRHClient
        userRole={userRole}
        userName={session.user.name || "Administrador"}
        initialComunicados={initialComunicados}
        initialStats={initialStats}
      />
    </Suspense>
  );
}

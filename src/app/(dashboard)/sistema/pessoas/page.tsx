import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PainelRHClient } from "@/components/sistema/PainelRHClient";
import { getComunicadosRH } from "@/app/actions/comunicados";

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
  try {
    initialComunicados = await getComunicadosRH();
  } catch (err) {
    console.error("Erro ao carregar comunicados do banco:", err);
  }

  return (
    <Suspense fallback={null}>
      <PainelRHClient
        userRole={userRole}
        userName={session.user.name || "Administrador"}
        initialComunicados={initialComunicados}
      />
    </Suspense>
  );
}

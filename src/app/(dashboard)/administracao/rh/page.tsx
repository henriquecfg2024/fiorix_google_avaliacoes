import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PainelRHClient } from "@/components/sistema/PainelRHClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Painel de Governança RH | FIORIX",
  description: "Gestão de Comunicados Internos, Holerites e Planejamento de Férias 2027",
};

export default async function AdministracaoRHPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = session.user.role || "USER";

  // Apenas ADMIN, RH, MASTER ou GESTOR podem acessar o painel de RH
  if (userRole === "USER" || userRole === "COLABORADOR") {
    redirect("/pessoas");
  }

  return (
    <PainelRHClient
      userRole={userRole}
      userName={session.user.name || "Administrador"}
    />
  );
}

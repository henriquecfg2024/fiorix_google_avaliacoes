import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PainelRHClient } from "@/components/sistema/PainelRHClient";

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
  if (userRole === "USER") {
    redirect("/pessoas");
  }

  return (
    <PainelRHClient
      userRole={userRole}
      userName={session.user.name || "Administrador"}
    />
  );
}

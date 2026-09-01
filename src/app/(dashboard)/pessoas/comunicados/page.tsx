import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ComunicadosClient } from "@/components/comunicados/ComunicadosClient";

export const metadata = {
  title: "Comunicados Internos | FIORIX",
};

export default async function ComunicadosPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = session.user.role || "USER";
  const userName = session.user.name || "Colaborador";

  return (
    <ComunicadosClient
      userRole={userRole}
      userName={userName}
    />
  );
}

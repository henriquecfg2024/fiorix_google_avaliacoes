import { auth } from "@/auth";
import { ComunicadosClient } from "@/components/comunicados/ComunicadosClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comunicados Internos | FIORIX",
};

export default async function ComunicadosPage() {
  let userRole = "USER";
  let userName = "Colaborador";

  try {
    const session = await auth();
    if (session?.user) {
      userRole = session.user.role || "USER";
      userName = session.user.name || "Colaborador";
    }
  } catch (err) {
    console.error("Auth error in ComunicadosPage:", err);
  }

  return (
    <ComunicadosClient
      userRole={userRole}
      userName={userName}
    />
  );
}

import { Suspense } from "react";
import { PainelRHClient } from "@/components/sistema/PainelRHClient";
import { loadPainelRHData } from "@/lib/rh/loadPainelRHData";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comunicados | Recursos Humanos | FIORIX",
};

export default async function RHComunicadosPage() {
  const { userRole, userName, initialComunicados, initialStats } = await loadPainelRHData();

  return (
    <Suspense fallback={null}>
      <PainelRHClient
        fixedTab="comunicados"
        userRole={userRole}
        userName={userName}
        initialComunicados={initialComunicados}
        initialStats={initialStats}
      />
    </Suspense>
  );
}

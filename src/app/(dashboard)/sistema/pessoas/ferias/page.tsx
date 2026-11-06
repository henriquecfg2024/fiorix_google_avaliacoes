import { Suspense } from "react";
import { PainelRHClient } from "@/components/sistema/PainelRHClient";
import { loadPainelRHData } from "@/lib/rh/loadPainelRHData";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Férias | Recursos Humanos | FIORIX",
};

export default async function RHFeriasPage() {
  const { userRole, userName, initialStats } = await loadPainelRHData({ skipComunicados: true });

  return (
    <Suspense fallback={null}>
      <PainelRHClient
        fixedTab="ferias"
        userRole={userRole}
        userName={userName}
        initialComunicados={[]}
        initialStats={initialStats}
      />
    </Suspense>
  );
}

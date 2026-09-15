import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getItsPageData, getGovernancaRhData } from "@/app/actions/its";
import { InstrucoesTrabalhoClient } from "@/components/its/InstrucoesTrabalhoClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Instruções de Trabalho | FIORIX",
  description: "Governança de ITs — Consulte documentos e acompanhe somente o que precisa de atenção.",
};

interface PageProps {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}

export default async function InstrucoesTrabalhoPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = String(session.user.role || "USER").toUpperCase();

  // Apenas SUBSTITUTO, ADMIN e MASTER acessam a Governança de ITs
  if (!["SUBSTITUTO", "ADMIN", "MASTER"].includes(userRole)) {
    redirect(userRole === "RH" ? "/sistema/pessoas" : "/minha-it");
  }

  // Determinar aba inicial via query param
  const resolvedSearch = searchParams ? await Promise.resolve(searchParams) : undefined;
  const tabParam = resolvedSearch?.tab;
  const initialTab: "catalogo" | "fiscalizacao" =
    tabParam === "fiscalizacao" ? "fiscalizacao" : "catalogo";

  try {
    // Buscar dados de ambas as abas em paralelo
    const [itsData, governancaData] = await Promise.all([
      getItsPageData(),
      getGovernancaRhData(),
    ]);

    return (
      <InstrucoesTrabalhoClient
        initialData={{
          currentUser: itsData.currentUser,
          its: itsData.its,
          kpis: governancaData.kpis,
          conformidadePorIt: governancaData.conformidadePorIt,
          itsPendentesAprovacao: governancaData.itsPendentesAprovacao,
        }}
        initialTab={initialTab}
      />
    );
  } catch (error: any) {
    console.error("Erro ao carregar Instruções de Trabalho:", error);
    redirect("/minha-it");
  }
}

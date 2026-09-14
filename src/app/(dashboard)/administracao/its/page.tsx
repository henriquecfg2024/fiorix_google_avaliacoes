import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getItsPageData } from "@/app/actions/its";
import { ModuloItsClient } from "@/components/its/ModuloItsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Instruções de Trabalho & Matriz de Polivalência | FIORIX",
  description: "Módulo 4: Governança Operacional, ITs e Matriz de Polivalência 7º RI SP",
};

export default async function ModuloItsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = String(session.user.role || "USER").toUpperCase();

  // Apenas SUBSTITUTO, ADMIN e MASTER acessam a gestão geral de ITs
  if (!["SUBSTITUTO", "ADMIN", "MASTER"].includes(userRole)) {
    redirect(userRole === "RH" ? "/sistema/pessoas" : "/minha-it");
  }

  try {
    const initialData = await getItsPageData();
    return <ModuloItsClient initialData={initialData} />;
  } catch (error: any) {
    console.error("Erro ao carregar dados de governança de ITs:", error);
    redirect("/minha-it");
  }
}


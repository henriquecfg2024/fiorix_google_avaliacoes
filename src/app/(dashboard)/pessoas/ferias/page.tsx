import { auth } from "@/auth";
import { FeriasClient } from "@/components/ferias/FeriasClient";
import { getMinhasFeriasAction } from "@/app/actions/ferias";
import { EscalaItem, PublicacaoStatus } from "@/lib/ferias/ferias-repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Férias | FIORIX",
};

export default async function FeriasPage() {
  let userRole = "USER";
  let userName = "Colaborador";
  let userId = "";
  let initialPublicacao: PublicacaoStatus | undefined;
  let initialFerias: EscalaItem | null | undefined;

  try {
    const session = await auth();
    if (session?.user) {
      userRole = session.user.role || "USER";
      userName = session.user.name || "Colaborador";
      userId = session.user.id || "";

      // Pré-carrega no servidor para ano padrão 2027 (Zero Layout Shift)
      const res = await getMinhasFeriasAction({ ano: 2027 });
      initialPublicacao = res.publicacao;
      initialFerias = res.ferias;
    }
  } catch (err) {
    console.error("Auth / Data fetch error in FeriasPage:", err);
  }

  return (
    <FeriasClient
      userRole={userRole}
      userName={userName}
      userId={userId}
      initialPublicacao={initialPublicacao}
      initialFerias={initialFerias}
    />
  );
}

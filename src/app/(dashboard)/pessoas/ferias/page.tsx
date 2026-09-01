import { auth } from "@/auth";
import { FeriasClient } from "@/components/ferias/FeriasClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Férias & Ausências | FIORIX",
};

export default async function FeriasPage() {
  let userRole = "USER";
  let userName = "Colaborador";

  try {
    const session = await auth();
    if (session?.user) {
      userRole = session.user.role || "USER";
      userName = session.user.name || "Colaborador";
    }
  } catch (err) {
    console.error("Auth error in FeriasPage:", err);
  }

  return (
    <FeriasClient
      userRole={userRole}
      userName={userName}
    />
  );
}

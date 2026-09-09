import { auth } from "@/auth";
import nextDynamic from "next/dynamic";

const FeriasClient = nextDynamic(
  () => import("@/components/ferias/FeriasClient").then((m) => m.FeriasClient),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#070A12] text-white p-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="h-8 w-48 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-64 bg-[#0B1020]/72 rounded-[28px] border border-white/8 animate-pulse" />
        </div>
      </div>
    ),
  }
);

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Férias | FIORIX",
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

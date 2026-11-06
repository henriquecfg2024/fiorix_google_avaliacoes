import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getComunicadosRH } from "@/app/actions/comunicados";
import { getIndicadoresRH, IndicadoresRH } from "@/app/actions/rh";

const ALLOWED_ROLES = ["ADMIN", "RH", "MASTER", "GESTOR", "SUBSTITUTO", "VISITANTE"];

export async function loadPainelRHData(options?: { skipComunicados?: boolean }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = session.user.role || "USER";

  if (!ALLOWED_ROLES.includes(userRole)) {
    redirect("/pessoas");
  }

  let initialComunicados: any[] = [];
  let initialStats: IndicadoresRH = {
    totalColaboradores: 0,
    holerites: {
      totalProcessados: 0,
      colaboradoresAtendidos: 0,
      hashesValidos: 0,
    },
    ferias: {
      totalProgramadas: 0,
      pendentesProgramacao: 0,
      conflitosLotacao: 0,
      totalAvisosEmitidos: 0,
      avisos: [],
    },
  };

  try {
    const [comunicadosRes, statsRes] = await Promise.allSettled([
      options?.skipComunicados ? Promise.resolve([]) : getComunicadosRH(),
      getIndicadoresRH(),
    ]);
    if (comunicadosRes.status === "fulfilled") {
      initialComunicados = comunicadosRes.value || [];
    } else {
      console.error("Erro ao carregar comunicados do banco:", comunicadosRes.reason);
    }
    if (statsRes.status === "fulfilled" && statsRes.value) {
      initialStats = statsRes.value;
    } else if (statsRes.status === "rejected") {
      console.error("Erro ao carregar indicadores RH do banco:", statsRes.reason);
    }
  } catch (err) {
    console.error("Erro ao carregar dados de RH do banco:", err);
  }

  return {
    session,
    userRole,
    userName: session.user.name || "Administrador",
    initialComunicados,
    initialStats,
  };
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireTenant();

    if (user.role !== "MASTER" && user.role !== "ADMIN" && user.role !== "SUBSTITUTO") {
      return NextResponse.json(
        { success: false, error: "Apenas a liderança/gestão tem permissão para alterar limites de erro." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { colaboradorNome, tipoRetorno, limitePercentual, competenciaInicio } = body;

    if (!colaboradorNome || !tipoRetorno || typeof limitePercentual !== "number" || !competenciaInicio) {
      return NextResponse.json(
        { success: false, error: "Parâmetros obrigatórios ausentes ou inválidos." },
        { status: 400 }
      );
    }

    const saved = await prisma.fiorixQualidadeLimite.upsert({
      where: {
        tenantId_colaboradorNome_tipoRetorno_competenciaInicio: {
          tenantId: user.tenantId,
          colaboradorNome,
          tipoRetorno,
          competenciaInicio,
        },
      },
      create: {
        tenantId: user.tenantId,
        colaboradorNome,
        tipoRetorno,
        limitePercentual,
        competenciaInicio,
        criadoPor: user.email || user.id,
      },
      update: {
        limitePercentual,
        criadoPor: user.email || user.id,
      },
    });

    return NextResponse.json({ success: true, limite: saved });
  } catch (error: any) {
    console.error("ERRO_QUALIDADE_LIMITES_POST:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao gravar limite de erro." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await requireTenant();
    const limites = await prisma.fiorixQualidadeLimite.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ competenciaInicio: "desc" }, { colaboradorNome: "asc" }],
    });
    return NextResponse.json({ success: true, limites });
  } catch (error: any) {
    console.error("ERRO_QUALIDADE_LIMITES_GET:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao buscar limites." },
      { status: 500 }
    );
  }
}

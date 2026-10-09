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
    const {
      tipoAlvo = "COLABORADOR",
      colaboradorNome,
      departamento,
      colaboradoresNomes,
      tipoRetorno,
      limitePercentual,
      competenciaInicio,
    } = body;

    // 1. Alterar limite por DEPARTAMENTO (aplica em lote aos membros e grava a regra do setor)
    if (tipoAlvo === "DEPARTAMENTO") {
      if (!departamento || !tipoRetorno || typeof limitePercentual !== "number" || !competenciaInicio) {
        return NextResponse.json(
          { success: false, error: "Parâmetros obrigatórios para limite departamental ausentes ou inválidos." },
          { status: 400 }
        );
      }

      const deptUpper = departamento.trim().toUpperCase();

      // Grava a regra de limite mestre do departamento: DEP:<DEPARTAMENTO>
      await prisma.fiorixQualidadeLimite.upsert({
        where: {
          tenantId_colaboradorNome_tipoRetorno_competenciaInicio: {
            tenantId: user.tenantId,
            colaboradorNome: `DEP:${deptUpper}`,
            tipoRetorno,
            competenciaInicio,
          },
        },
        create: {
          tenantId: user.tenantId,
          colaboradorNome: `DEP:${deptUpper}`,
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

      // Aplica individualmente a todos os colaboradores do departamento
      const nomesList: string[] = Array.isArray(colaboradoresNomes) ? colaboradoresNomes : [];
      for (const nome of nomesList) {
        const cNomeUpper = (nome || "").trim().toUpperCase();
        if (!cNomeUpper) continue;
        await prisma.fiorixQualidadeLimite.upsert({
          where: {
            tenantId_colaboradorNome_tipoRetorno_competenciaInicio: {
              tenantId: user.tenantId,
              colaboradorNome: cNomeUpper,
              tipoRetorno,
              competenciaInicio,
            },
          },
          create: {
            tenantId: user.tenantId,
            colaboradorNome: cNomeUpper,
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
      }

      return NextResponse.json({
        success: true,
        tipoAlvo: "DEPARTAMENTO",
        departamento: deptUpper,
        totalColaboradores: nomesList.length,
      });
    }

    // 2. Alterar limite individual por COLABORADOR
    if (!colaboradorNome || !tipoRetorno || typeof limitePercentual !== "number" || !competenciaInicio) {
      return NextResponse.json(
        { success: false, error: "Parâmetros obrigatórios ausentes ou inválidos." },
        { status: 400 }
      );
    }

    const nomeUpper = colaboradorNome.trim().toUpperCase();

    const saved = await prisma.fiorixQualidadeLimite.upsert({
      where: {
        tenantId_colaboradorNome_tipoRetorno_competenciaInicio: {
          tenantId: user.tenantId,
          colaboradorNome: nomeUpper,
          tipoRetorno,
          competenciaInicio,
        },
      },
      create: {
        tenantId: user.tenantId,
        colaboradorNome: nomeUpper,
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

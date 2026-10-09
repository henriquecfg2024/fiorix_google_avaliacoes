import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireTenant();

    // Apenas perfis de gestão podem estipular metas (MASTER, ADMIN, SUBSTITUTO)
    if (user.role !== "MASTER" && user.role !== "ADMIN" && user.role !== "SUBSTITUTO") {
      return NextResponse.json(
        { success: false, error: "Apenas a liderança/gestão tem permissão para estipular metas." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      tipoAlvo = "COLABORADOR",
      colaboradorNome,
      departamento,
      colaboradoresNomes,
      atividade,
      origem,
      metaValor,
      competenciaInicio,
    } = body;

    // 1. Estipular meta por DEPARTAMENTO (aplica em lote aos membros e grava o registro do setor)
    if (tipoAlvo === "DEPARTAMENTO") {
      if (!departamento || !atividade || typeof metaValor !== "number" || !competenciaInicio) {
        return NextResponse.json(
          { success: false, error: "Parâmetros obrigatórios para meta departamental ausentes ou inválidos." },
          { status: 400 }
        );
      }

      const deptUpper = departamento.trim().toUpperCase();

      // Grava a regra de meta mestre do departamento
      await prisma.fiorixQualidadeMeta.upsert({
        where: {
          tenantId_colaboradorNome_atividade_competenciaInicio: {
            tenantId: user.tenantId,
            colaboradorNome: `DEP:${deptUpper}`,
            atividade,
            competenciaInicio,
          },
        },
        create: {
          tenantId: user.tenantId,
          colaboradorNome: `DEP:${deptUpper}`,
          atividade,
          origem: origem || "TODOS",
          metaValor: Math.max(1, Math.round(metaValor)),
          competenciaInicio,
          criadoPor: user.email || user.id,
        },
        update: {
          metaValor: Math.max(1, Math.round(metaValor)),
          origem: origem || "TODOS",
          criadoPor: user.email || user.id,
        },
      });

      // Aplica individualmente a todos os colaboradores do departamento que realizam a atividade
      const nomesList: string[] = Array.isArray(colaboradoresNomes) ? colaboradoresNomes : [];
      for (const nome of nomesList) {
        const cNomeUpper = (nome || "").trim().toUpperCase();
        if (!cNomeUpper) continue;
        await prisma.fiorixQualidadeMeta.upsert({
          where: {
            tenantId_colaboradorNome_atividade_competenciaInicio: {
              tenantId: user.tenantId,
              colaboradorNome: cNomeUpper,
              atividade,
              competenciaInicio,
            },
          },
          create: {
            tenantId: user.tenantId,
            colaboradorNome: cNomeUpper,
            atividade,
            origem: origem || "TODOS",
            metaValor: Math.max(1, Math.round(metaValor)),
            competenciaInicio,
            criadoPor: user.email || user.id,
          },
          update: {
            metaValor: Math.max(1, Math.round(metaValor)),
            origem: origem || "TODOS",
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

    // 2. Estipular meta individual por COLABORADOR
    if (!colaboradorNome || !atividade || typeof metaValor !== "number" || !competenciaInicio) {
      return NextResponse.json(
        { success: false, error: "Parâmetros obrigatórios ausentes ou inválidos." },
        { status: 400 }
      );
    }

    const nomeUpper = colaboradorNome.trim().toUpperCase();

    const saved = await prisma.fiorixQualidadeMeta.upsert({
      where: {
        tenantId_colaboradorNome_atividade_competenciaInicio: {
          tenantId: user.tenantId,
          colaboradorNome: nomeUpper,
          atividade,
          competenciaInicio,
        },
      },
      create: {
        tenantId: user.tenantId,
        colaboradorNome: nomeUpper,
        atividade,
        origem: origem || "TODOS",
        metaValor: Math.max(1, Math.round(metaValor)),
        competenciaInicio,
        criadoPor: user.email || user.id,
      },
      update: {
        metaValor: Math.max(1, Math.round(metaValor)),
        origem: origem || "TODOS",
        criadoPor: user.email || user.id,
      },
    });

    return NextResponse.json({ success: true, meta: saved });
  } catch (error: any) {
    console.error("ERRO_QUALIDADE_METAS_POST:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao gravar meta de qualidade." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await requireTenant();
    const metas = await prisma.fiorixQualidadeMeta.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ competenciaInicio: "desc" }, { colaboradorNome: "asc" }],
    });
    return NextResponse.json({ success: true, metas });
  } catch (error: any) {
    console.error("ERRO_QUALIDADE_METAS_GET:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao buscar metas." },
      { status: 500 }
    );
  }
}

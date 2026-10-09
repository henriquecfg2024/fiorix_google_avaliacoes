import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireTenant();

    if (user.role !== "MASTER" && user.role !== "ADMIN" && user.role !== "SUBSTITUTO") {
      return NextResponse.json(
        { success: false, error: "Apenas a liderança/gestão tem permissão para auditar e revisar categorias de causas." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { idAndamento, numeroPrenotacao, categoriaSugerida, categoriaRevisada, justificativa } = body;

    if (!idAndamento || !numeroPrenotacao || !categoriaRevisada) {
      return NextResponse.json(
        { success: false, error: "idAndamento, numeroPrenotacao e categoriaRevisada são obrigatórios." },
        { status: 400 }
      );
    }

    const idAndamentoBigInt = BigInt(idAndamento);

    const saved = await prisma.fiorixQualidadeRevisaoCausa.upsert({
      where: {
        tenantId_idAndamento: {
          tenantId: user.tenantId,
          idAndamento: idAndamentoBigInt,
        },
      },
      create: {
        tenantId: user.tenantId,
        idAndamento: idAndamentoBigInt,
        numeroPrenotacao: Number(numeroPrenotacao),
        categoriaSugerida: categoriaSugerida || null,
        categoriaRevisada,
        justificativa: justificativa || null,
        revisadoPor: user.email || user.id,
      },
      update: {
        categoriaRevisada,
        justificativa: justificativa || null,
        revisadoPor: user.email || user.id,
        revisadoEm: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      revisao: {
        ...saved,
        idAndamento: saved.idAndamento.toString(),
      },
    });
  } catch (error: any) {
    console.error("ERRO_QUALIDADE_REVISAR_CAUSA_POST:", error);
    return NextResponse.json(
      { success: false, error: "Falha ao gravar revisão de causa." },
      { status: 500 }
    );
  }
}

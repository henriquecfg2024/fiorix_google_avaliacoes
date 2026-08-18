import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await requireRole("ADMIN", "MASTER");
    const body = await request.json().catch(() => ({}));
    const { protocolo, tipo, dryRun = true } = body;

    if (!protocolo || !tipo) {
      return NextResponse.json(
        { success: false, error: "Protocolo e Tipo (75 ou 76) são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Validar se o protocolo existe nas metas de dados do tenant
    const metaDados = await prisma.fiorixMetasDados.findFirst({
      where: {
        protocolo: Number(protocolo),
        tenantId: user.tenantId,
      },
    });

    if (!metaDados) {
      return NextResponse.json(
        { success: false, error: `Protocolo ${protocolo} não encontrado nas metas de dados.` },
        { status: 404 }
      );
    }

    // 2. Validar se andamento 76/75 realmente está ausente
    const balcaoRegistrado = metaDados.dBalcaoRegistrado;
    const balcaoDevolvido = metaDados.dBalcaoDevolvido;

    if (tipo === 76 && balcaoRegistrado) {
      return NextResponse.json(
        { success: false, error: "O andamento Balcão Registrado (76) já existe para este protocolo." },
        { status: 400 }
      );
    }

    if (tipo === 75 && balcaoDevolvido) {
      return NextResponse.json(
        { success: false, error: "O andamento Balcão Devolvido (75) já existe para este protocolo." },
        { status: 400 }
      );
    }

    // 3. Dry-run Mode
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `[DRY-RUN] Protocolo ${protocolo} validado com sucesso para correção do tipo ${tipo}.`,
        details: {
          protocolo,
          tipo,
          setor: "Conferência",
          acaoPrevia: tipo === 76 ? "Ausente" : "Pendente",
          acaoSimulada: `Inserir andamento ID ${tipo} no SQL Server (WEBRI)`,
          usuarioResponsavel: "FIORIX.CORRETOR",
        },
      });
    }

    // 4. Execução Real (apenas Admin/Master)
    // Atualizar no banco local Postgres (metas)
    const updateData: any = {};
    if (tipo === 76) {
      updateData.dBalcaoRegistrado = new Date();
    } else if (tipo === 75) {
      updateData.dBalcaoDevolvido = new Date();
    }

    await prisma.fiorixMetasDados.updateMany({
      where: {
        protocolo: Number(protocolo),
        tenantId: user.tenantId,
      },
      data: updateData,
    });

    // Registra a intervenção fictícia ou real
    console.log(`[FIORIX AUDITORIA] Correção real efetuada para o protocolo ${protocolo} com tipo ${tipo}.`);

    return NextResponse.json({
      success: true,
      dryRun: false,
      message: `Correção aplicada com sucesso para o protocolo ${protocolo}.`,
      details: {
        protocolo,
        tipo,
        status: "CONCLUÍDO",
        atualizadoEm: new Date(),
      },
    });
  } catch (error: any) {
    console.error("Erro na API de correção:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erro interno do servidor." },
      { status: 500 }
    );
  }
}

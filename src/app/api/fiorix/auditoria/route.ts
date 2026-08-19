import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: sessionUser.email }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuário não encontrado" }, { status: 404 });
    }

    // Get records missing Balcao Registrado (ID 76) or Balcao Devolvido (ID 75)
    const rawDados = await prisma.fiorixMetasDados.findMany({
      where: {
        tenantId: user.tenantId,
        dBalcaoDevolvido: null,
      },
      orderBy: {
        protocolo: "asc",
      },
      take: 500, // safety cap
    });

    const mapped = rawDados.map((d) => {
      // Map phase and sector dynamically based on milestones filled
      let fase = "Apresentação";
      let setor = "Qualificação";
      let responsavel = "Maria";
      let dataUltAndamento = d.dataApresentado ? new Date(d.dataApresentado).toLocaleDateString("pt-BR") : "18/08/2026";

      if (d.d9Conferencia) {
        fase = "Conferência";
        setor = "Conferência";
        responsavel = "Maria";
        dataUltAndamento = new Date(d.d9Conferencia).toLocaleDateString("pt-BR");
      } else if (d.d8Impressao) {
        fase = "Impressão";
        setor = "Registro";
        responsavel = "João";
        dataUltAndamento = new Date(d.d8Impressao).toLocaleDateString("pt-BR");
      } else if (d.d4Qualificacao) {
        fase = "Exame Formal";
        setor = "Conferência";
        responsavel = "Carlos";
        dataUltAndamento = new Date(d.d4Qualificacao).toLocaleDateString("pt-BR");
      }

      // Compute days parado
      const ultimoAndamento = [
        { nome: "APRESENTAÇÃO", data: d.dataApresentado, ordem: 1 },
        { nome: "QUALIFICAÇÃO", data: d.d4Qualificacao, ordem: 2 },
        { nome: "IMPRESSÃO", data: d.d8Impressao, ordem: 3 },
        { nome: "PREPARAÇÃO", data: d.d9Preparacao, ordem: 4 },
        { nome: "CONFERÊNCIA", data: d.d9Conferencia, ordem: 5 },
      ]
        .filter((andamento) => andamento.data)
        .sort(
          (a, b) =>
            new Date(b.data).getTime() - new Date(a.data).getTime() ||
            b.ordem - a.ordem
        )[0];

      if (ultimoAndamento) {
        setor = ultimoAndamento.nome;
      }

      const start = d.dataApresentado ? new Date(d.dataApresentado) : new Date();
      const diffTime = Math.abs(new Date().getTime() - start.getTime());
      const dias = Math.min(60, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1);

      // Determine client name and badge
      let cliente = "Instrumento Particular";
      if (d.natureza?.toLowerCase().includes("banco") || d.natureza?.toLowerCase().includes("aliena")) {
        cliente = "Banco Regional S/A";
      } else if (d.natureza?.toLowerCase().includes("aurora") || d.natureza?.toLowerCase().includes(" Aurora")) {
        cliente = "Construtora Aurora Ltda";
      } else if (d.natureza?.toLowerCase().includes("cyrela") || d.natureza?.toLowerCase().includes("cyr")) {
        cliente = "Cyrela Construtora";
      } else if (d.natureza?.toLowerCase().includes("mrv")) {
        cliente = "MRV Engenharia";
      }

      const badge = d.natureza 
        ? d.natureza.slice(0, 2).toUpperCase() + "-" + d.protocolo.toString().slice(-3)
        : "PR-" + d.protocolo.toString().slice(-3);

      return {
        id: String(d.protocolo),
        badge,
        cliente,
        fase,
        falta: d.dBalcaoRegistrado ? 75 : 76,
        dias,
        setor,
        responsavel,
        dataUltAndamento,
      };
    });

    return NextResponse.json({
      success: true,
      protocolos: mapped,
    });
  } catch (error: unknown) {
    console.error("Error in auditoria API:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

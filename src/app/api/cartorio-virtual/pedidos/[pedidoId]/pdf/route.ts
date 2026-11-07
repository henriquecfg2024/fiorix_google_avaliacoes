import { NextRequest, NextResponse } from "next/server";
import { obterContextoAutorizacaoCartorioVirtual } from "@/lib/cartorio-virtual/permissions";
import { obterDetalhePedidoCartorioVirtual } from "@/lib/cartorio-virtual/repository";
import { gerarPdfPedidoIndividualSiplan } from "@/lib/cartorio-virtual/siplan-order-pdf";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ pedidoId: string }> | { pedidoId: string } }
) {
  try {
    const ctx = await obterContextoAutorizacaoCartorioVirtual();
    if (!ctx.capacidades.includes("consultar")) {
      return NextResponse.json({ error: "Acesso negado ao pedido." }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(context.params);
    const url = new URL(_req.url);
    const ocultarAnotacoes = url.searchParams.get("ocultarAnotacoes") === "1";

    const { pedido, anotacoes } = await obterDetalhePedidoCartorioVirtual(
      ctx.tenantId,
      resolvedParams.pedidoId
    );
    if (!pedido) {
      return NextResponse.json(
        { error: "Pedido não encontrado nesta serventia." },
        { status: 404 }
      );
    }

    const gerado = await gerarPdfPedidoIndividualSiplan(pedido, {
      anotacoesSalvas: ocultarAnotacoes ? undefined : anotacoes,
    });

    return new NextResponse(Buffer.from(gerado.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Pedido_certidao_n_${pedido.numeroPedido}.pdf"`,
        "X-Content-SHA256": gerado.sha256,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Falha ao gerar espelho PDF do pedido." },
      { status: 400 }
    );
  }
}


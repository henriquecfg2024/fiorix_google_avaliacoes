import { NextRequest, NextResponse } from "next/server";
import { obterContextoAutorizacaoCartorioVirtual } from "@/lib/cartorio-virtual/permissions";
import { obterPdfBytesLoteImpressao } from "@/lib/cartorio-virtual/repository";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ loteId: string }> | { loteId: string } }
) {
  try {
    const ctx = await obterContextoAutorizacaoCartorioVirtual();
    if (!ctx.capacidades.includes("consultar") && !ctx.capacidades.includes("imprimir")) {
      return NextResponse.json({ error: "Acesso negado ao lote de impressão." }, { status: 403 });
    }

    const resolvedParams = await Promise.resolve(context.params);
    const { codigoLote, pdfBytes, sha256 } = await obterPdfBytesLoteImpressao({
      tenantId: ctx.tenantId,
      loteId: resolvedParams.loteId,
      operadorId: ctx.user.id,
      operadorNome: ctx.user.name || ctx.user.email || "Operador",
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${codigoLote}.pdf"`,
        "X-Content-SHA256": sha256,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Falha ao gerar PDF do lote." },
      { status: 400 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateHoleritePdfBinary } from "@/lib/pdf/generateHoleritePdf";
import { getRequestIp, maskIp } from "@/lib/security/requestIp";
import { logAuditEvent } from "@/lib/audit/log";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const userName = session?.user?.name || "Henrique Gama";
    const tenantId = session?.user?.tenantId || "tenant-7ri";
    const usuarioId = session?.user?.id || "user-1";
    const ip = getRequestIp(req);
    const ipMascarado = maskIp(ip);

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const mes = searchParams.get("mes") || "08/2026";

    // Registra log de auditoria
    await logAuditEvent({
      tenantId,
      usuarioId,
      tipo: "holerite_download_authorized",
      recursoId: id,
      ip,
      userAgent: req.headers.get("user-agent") || "unknown",
      metadata: { mes },
    });

    const pdfBuffer = generateHoleritePdfBinary({
      competencia: mes,
      nomeColaborador: userName,
      cpfMascarado: "***.456.789-**",
      cargo: "Escrevente Notarial",
      valorBruto: "6.840,00",
      valorLiquido: "5.420,15",
      descontos: "1.419,85",
      hashSha256: "f3a9c2e1d0b83e42aa881b9e2f4a1c5d7e8f0a1b2c3d4e5f6a7b8c9d0e1f2a3b",
      ipMascarado,
      dataEmissao: new Date().toLocaleDateString("pt-BR"),
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Holerite-Competencia-${mes.replace("/", "-")}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Erro ao gerar download de holerite PDF:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

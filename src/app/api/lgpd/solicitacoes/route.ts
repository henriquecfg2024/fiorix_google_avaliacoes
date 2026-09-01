import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestIp } from "@/lib/security/requestIp";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const usuarioId = session.user.id;
    const body = await req.json();
    const { tipo, recursoId, motivo } = body;

    await logAuditEvent({
      tenantId,
      usuarioId,
      tipo: tipo || "lgpd_solicitacao_exclusao",
      recursoId,
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent") || "unknown",
      metadata: { motivo, dataSolicitacao: new Date().toISOString() },
    });

    return NextResponse.json({
      success: true,
      mensagem: "Solicitação registrada com sucesso na trilha de governança e DPO.",
      protocolo: `LGPD-${Date.now()}`,
    });
  } catch (error) {
    console.error("Erro na rota LGPD solicitações:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth-helpers";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestIp } from "@/lib/security/requestIp";

export async function POST(req: NextRequest) {
  try {
    const user = await requireTenant();

    const tenantId = user.tenantId;
    const usuarioId = user.id;
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
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Não autenticado") || msg.includes("Sessão expirada") || msg.includes("Conta desativada")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    if (msg.includes("Acesso negado") || msg.includes("Tenant não associado")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    console.error("Erro na rota LGPD solicitações:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

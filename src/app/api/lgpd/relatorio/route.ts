import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestIp } from "@/lib/security/requestIp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireTenant();

    const tenantId = user.tenantId;
    const usuarioId = user.id;

    // Busca registros de acessos do próprio usuário
    const logs = await prisma.fiorixAcessoLog.findMany({
      where: {
        tenantId,
        usuarioId,
      },
      orderBy: { dataAcesso: "desc" },
      take: 100,
    });

    await logAuditEvent({
      tenantId,
      usuarioId,
      tipo: "lgpd_relatorio",
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent") || "unknown",
    });

    return NextResponse.json({
      success: true,
      titular: user.name,
      email: user.email,
      logs,
      geradoEm: new Date().toISOString(),
    });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Não autenticado") || msg.includes("Sessão expirada") || msg.includes("Conta desativada")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    if (msg.includes("Acesso negado") || msg.includes("Tenant não associado")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    console.error("Erro ao gerar relatório LGPD:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

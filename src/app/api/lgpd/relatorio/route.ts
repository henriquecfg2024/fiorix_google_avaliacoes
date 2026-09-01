import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestIp } from "@/lib/security/requestIp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const usuarioId = session.user.id;

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
      titular: session.user.name,
      email: session.user.email,
      logs,
      geradoEm: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro ao gerar relatório LGPD:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

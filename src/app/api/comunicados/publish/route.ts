import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateHash } from "@/lib/security/hash";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestIp } from "@/lib/security/requestIp";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    // Apenas ADMIN ou RH podem publicar
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "RH")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const autorId = session.user.id;
    const { titulo, prioridade, conteudo, destinatarios, exigeCiencia, notificar, dataExpiracao } = await req.json();

    if (!titulo || !conteudo || !destinatarios) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
    }

    // Gera o hash do conteúdo server-side para garantia de integridade
    const conteudoHash = generateHash(conteudo);

    const comunicado = await prisma.fiorixComunicado.create({
      data: {
        tenantId,
        autorId,
        titulo,
        conteudo,
        conteudoHash,
        prioridade: prioridade || "NORMAL",
        destinatarios,
        exigeCiencia: exigeCiencia ?? true,
        notificar: notificar ?? true,
        dataExpiracao: dataExpiracao ? new Date(dataExpiracao) : null,
      },
    });

    // Registra log de auditoria
    await logAuditEvent({
      tenantId,
      usuarioId: autorId,
      tipo: "comunicado_publish",
      recursoId: comunicado.id,
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent") || "unknown",
      metadata: { prioridade, destinatarios },
    });

    return NextResponse.json({ success: true, comunicado });
  } catch (error) {
    console.error("Erro ao publicar comunicado:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

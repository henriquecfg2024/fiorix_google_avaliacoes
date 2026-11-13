import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { generateHash } from "@/lib/security/hash";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestIp } from "@/lib/security/requestIp";

export async function POST(req: NextRequest) {
  try {
    // Apenas ADMIN, RH, MASTER, GESTOR ou SUBSTITUTO ativos podem publicar
    const user = await requireRole("ADMIN", "RH", "MASTER", "GESTOR", "SUBSTITUTO");

    const tenantId = user.tenantId;
    const autorId = user.id;
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
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Não autenticado") || msg.includes("Sessão expirada") || msg.includes("Conta desativada")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    if (msg.includes("Acesso negado")) {
      return NextResponse.json({ error: "Não autorizado: Apenas gestores e RH podem criar comunicados." }, { status: 403 });
    }
    console.error("Erro ao publicar comunicado:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

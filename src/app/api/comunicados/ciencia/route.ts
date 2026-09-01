import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth"; // Assumindo o NextAuth setup
import { PessoasRepository } from "@/lib/pessoas/repository";
import { generateCienciaHash } from "@/lib/security/hash";
import { getRequestIp, maskIp } from "@/lib/security/requestIp";
import { logAuditEvent } from "@/lib/audit/log";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const usuarioId = session.user.id;

    const { comunicadoId, comunicadoHash, scrollPercent } = await req.json();

    if (!comunicadoId || !comunicadoHash || scrollPercent < 90) {
      return NextResponse.json(
        { error: "Dados inválidos ou scroll insuficiente" },
        { status: 400 }
      );
    }

    // Valida se o comunicado existe e o usuário tem acesso
    const comunicado = await PessoasRepository.getComunicadoById(tenantId, comunicadoId);
    if (!comunicado) {
      return NextResponse.json({ error: "Comunicado não encontrado" }, { status: 404 });
    }

    // Gera o comprovante hash server-side
    const ip = getRequestIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";
    const timestamp = new Date().toISOString();

    const comprovanteHash = generateCienciaHash({
      comunicadoId,
      usuarioId,
      timestamp,
      comunicadoHash,
      ip,
      userAgent,
    });

    // Registra a ciência
    const qrCodeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verifica/${comprovanteHash}`;
    
    await PessoasRepository.registerCiencia({
      tenantId,
      comunicadoId,
      usuarioId,
      ip,
      userAgent,
      scrollPercent,
      comunicadoHash,
      comprovanteHash,
      qrCodeUrl,
    });

    // Registra log de auditoria
    await logAuditEvent({
      tenantId,
      usuarioId,
      tipo: "comunicado_ciencia",
      recursoId: comunicadoId,
      ip,
      userAgent,
      metadata: { comprovanteHash },
    });

    return NextResponse.json({
      success: true,
      comprovanteHash,
      qrCodeUrl,
      timestamp,
      ipMascarado: maskIp(ip),
    });
  } catch (error: any) {
    console.error("Erro ao registrar ciência:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

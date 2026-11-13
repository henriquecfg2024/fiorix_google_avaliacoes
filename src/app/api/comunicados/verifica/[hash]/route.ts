import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    const { hash } = params;

    if (!hash) {
      return NextResponse.json({ error: "Hash não fornecido" }, { status: 400 });
    }

    // Busca o registro de ciência pelo hash do comprovante
    const ciencia = await prisma.fiorixComunicadoCiencia.findUnique({
      where: { comprovanteHash: hash },
      include: {
        usuario: { select: { name: true, email: true, tenantId: true } },
        comunicado: { select: { titulo: true, versao: true, tenantId: true } },
      },
    });

    if (!ciencia) {
      return NextResponse.json(
        { valido: false, message: "Comprovante não encontrado ou inválido" },
        { status: 404 }
      );
    }

    // Sem sessão ativa verificada no mesmo tenant (próprio titular ou gestão/RH): confirma apenas validade — sem expor dados pessoais (LGPD)
    const session = await auth();
    const roleUpper = String(session?.user?.role || "").toUpperCase();
    const isSameTenant =
      Boolean(session?.user?.tenantId) &&
      session!.user!.tenantId === ciencia.comunicado.tenantId;
    const canViewDetails =
      isSameTenant &&
      (session!.user!.id === ciencia.usuarioId ||
        ["MASTER", "ADMIN", "RH", "GESTOR", "SUBSTITUTO"].includes(roleUpper));

    if (!canViewDetails) {
      return NextResponse.json(
        {
          valido: true,
          message: "Comprovante de ciência válido e registrado.",
        },
        {
          headers: {
            "Cache-Control": "private, no-store",
            "Referrer-Policy": "no-referrer",
          },
        }
      );
    }

    // Sessão autenticada + mesmo tenant (titular ou gestão): retorna dados completos
    return NextResponse.json(
      {
        valido: true,
        dados: {
          colaborador: ciencia.usuario.name,
          comunicado: ciencia.comunicado.titulo,
          versao: ciencia.comunicado.versao,
          dataCiencia: ciencia.dataCiencia,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      }
    );
  } catch (error) {
    console.error("Erro ao verificar hash:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

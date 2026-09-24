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

    // Sem sessão: confirma apenas validade — sem expor dados pessoais (LGPD)
    const session = await auth();
    const isAuthenticated = !!session?.user?.tenantId;
    const isSameTenant = isAuthenticated && session!.user!.tenantId === ciencia.comunicado.tenantId;

    if (!isSameTenant) {
      return NextResponse.json({
        valido: true,
        message: "Comprovante de ciência válido e registrado.",
      });
    }

    // Sessão autenticada + mesmo tenant: retorna dados completos
    return NextResponse.json({
      valido: true,
      dados: {
        colaborador: ciencia.usuario.name,
        comunicado: ciencia.comunicado.titulo,
        versao: ciencia.comunicado.versao,
        dataCiencia: ciencia.dataCiencia,
      },
    });
  } catch (error) {
    console.error("Erro ao verificar hash:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

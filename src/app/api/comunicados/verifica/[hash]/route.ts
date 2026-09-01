import { NextRequest, NextResponse } from "next/server";
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
        usuario: { select: { name: true, email: true } },
        comunicado: { select: { titulo: true, versao: true } },
      },
    });

    if (!ciencia) {
      return NextResponse.json(
        { valido: false, message: "Comprovante não encontrado ou inválido" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valido: true,
      dados: {
        colaborador: ciencia.usuario.name,
        email: ciencia.usuario.email,
        comunicado: ciencia.comunicado.titulo,
        versao: ciencia.comunicado.versao,
        dataCiencia: ciencia.dataCiencia,
        comunicadoHash: ciencia.comunicadoHash,
        ipRegistrado: ciencia.ip,
      },
    });
  } catch (error) {
    console.error("Erro ao verificar hash:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "RH")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { dataInicio, isOverride } = body;

    if (!dataInicio) {
      return NextResponse.json({ error: "Data de início obrigatória" }, { status: 400 });
    }

    const start = new Date(dataInicio);
    const hoje = new Date();
    
    // Zera as horas para comparar apenas os dias
    start.setHours(0, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(start.getTime() - hoje.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (start < hoje) {
       return NextResponse.json({ valido: false, mensagem: "A data de início não pode estar no passado." });
    }

    if (diffDays < 30) {
      if (isOverride) {
        // Se houver permissão de override (Circuit Breaker sugerido)
        return NextResponse.json({ 
          valido: true, 
          aviso: `Férias concedidas com ${diffDays} dias de antecedência via OVERRIDE Administrativo (Exceção CLT Art. 135).` 
        });
      }

      return NextResponse.json({ 
        valido: false, 
        mensagem: `BLOQUEIO — CLT ART. 135: É necessária antecedência mínima de 30 dias. Foram identificados apenas ${diffDays} dias.` 
      });
    }

    return NextResponse.json({ 
      valido: true, 
      mensagem: `Antecedência em conformidade (${diffDays} dias).` 
    });

  } catch (error) {
    console.error("Erro na validação de férias:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

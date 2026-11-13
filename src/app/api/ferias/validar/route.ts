import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    await requireRole("ADMIN", "RH", "MASTER");

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

  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.includes("Não autenticado") || msg.includes("Sessão expirada") || msg.includes("Conta desativada")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    if (msg.includes("Acesso negado")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }
    console.error("Erro na validação de férias:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

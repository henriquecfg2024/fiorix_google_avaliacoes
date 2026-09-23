import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { PessoasRepository } from "@/lib/pessoas/repository";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// Rate limit: 30 requisições por minuto por usuário
const RATE_LIMIT_CONFIG = { windowMs: 60_000, max: 30 };

/**
 * GET /api/holerites?ano=2026
 * Lista os holerites do usuário autenticado, filtrados por ano.
 * Nunca retorna holerites de outro colaborador.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Rate limiting
    const rateLimitKey = `holerite_list:${user.id}`;
    const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG);
    if (!rateCheck.ok) {
      return NextResponse.json(
        { error: "Muitas requisições." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // Busca holerites do usuário autenticado (isolamento por tenantId + usuarioId)
    const todosHolerites = await PessoasRepository.getHolerites(user.tenantId, user.id);

    // Filtra pelo ano, se fornecido
    const anoParam = req.nextUrl.searchParams.get("ano");
    const ano = anoParam ? parseInt(anoParam, 10) : null;

    const holerites = ano
      ? todosHolerites.filter((h: any) => h.ano === ano)
      : todosHolerites;

    // Retorna apenas campos necessários para o frontend (sem storagePath, hash, etc.)
    const holeritesSeguros = holerites.map((h: any) => ({
      id: h.id,
      mes: h.mes,
      ano: h.ano,
      arquivoNome: h.arquivoNome,
      dataUpload: h.dataUpload || h.createdAt,
    }));

    return NextResponse.json({
      holerites: holeritesSeguros,
      userName: user.name || "Colaborador",
    });
  } catch (error: any) {
    if (error?.message?.includes("Não autorizado")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    console.error("[Holerites API] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

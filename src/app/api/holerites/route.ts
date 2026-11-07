import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { PessoasRepository } from "@/lib/pessoas/repository";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ensureHoleritesGovernanceTablesExist } from "@/lib/holerites/holerites-governance-repository";
import { classificarAcessosHolerite } from "@/lib/holerites/clt-prazo-calculator";

export const dynamic = "force-dynamic";

// Rate limit: 30 requisições por minuto por usuário
const RATE_LIMIT_CONFIG = { windowMs: 60_000, max: 30 };

/**
 * GET /api/holerites?ano=2026
 * Lista os holerites do usuário autenticado, filtrados por ano,
 * incluindo o status de visualização e ciência eletrônica do próprio titular.
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

    await ensureHoleritesGovernanceTablesExist();

    // Busca holerites do usuário autenticado (isolamento por tenantId + usuarioId)
    const todosHolerites = await PessoasRepository.getHolerites(user.tenantId, user.id);

    const anoParam = req.nextUrl.searchParams.get("ano");
    const ano = anoParam ? parseInt(anoParam, 10) : null;

    const holerites = ano
      ? todosHolerites.filter((h: any) => h.ano === ano)
      : todosHolerites;

    const holeriteIds = holerites.map((h: any) => String(h.id));
    const extraMap = new Map<string, any>();

    if (holeriteIds.length > 0) {
      try {
        const extraRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, primeira_visualizacao_em, ciencia_confirmada_em, ciencia_comprovante_hash
           FROM public.fiorix_holerites
           WHERE tenant_id = $1 AND usuario_id = $2`,
          user.tenantId,
          user.id
        );
        for (const r of extraRows || []) {
          extraMap.set(String(r.id), r);
        }
      } catch {
        // Fallback retrocompatível caso apenas primeira_visualizacao_em exista
        try {
          const fallbackRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, primeira_visualizacao_em
             FROM public.fiorix_holerites
             WHERE tenant_id = $1 AND usuario_id = $2`,
            user.tenantId,
            user.id
          );
          for (const r of fallbackRows || []) {
            extraMap.set(String(r.id), r);
          }
        } catch {}
      }
    }

    const logs =
      holeriteIds.length > 0
        ? await prisma.fiorixAcessoLog.findMany({
            where: {
              tenantId: user.tenantId,
              usuarioId: user.id,
              recursoId: { in: holeriteIds },
              tipo: {
                in: [
                  "holerite_download_authorized",
                  "holerite_view",
                  "holerite_ciencia_confirmada",
                ],
              },
            },
            select: {
              recursoId: true,
              usuarioId: true,
              tipo: true,
              dataAcesso: true,
            },
            orderBy: { dataAcesso: "asc" },
          })
        : [];

    const logsByHolerite = new Map<string, any[]>();
    for (const lg of logs) {
      if (!lg.recursoId) continue;
      const arr = logsByHolerite.get(lg.recursoId) || [];
      arr.push(lg);
      logsByHolerite.set(lg.recursoId, arr);
    }

    const holeritesSeguros = holerites.map((h: any) => {
      const extra = extraMap.get(h.id);
      const classif = classificarAcessosHolerite({
        titularUsuarioId: user.id,
        primeiraVisualizacaoColuna: extra?.primeira_visualizacao_em ?? null,
        cienciaConfirmadaEmColuna: extra?.ciencia_confirmada_em ?? null,
        cienciaComprovanteHashColuna: extra?.ciencia_comprovante_hash ?? null,
        logs: logsByHolerite.get(h.id) || [],
      });

      const logCienciaMetadataHash = (logsByHolerite.get(h.id) || []).find(
        (l: any) => l.tipo === "holerite_ciencia_confirmada"
      );

      return {
        id: h.id,
        mes: h.mes,
        ano: h.ano,
        arquivoNome: h.arquivoNome,
        arquivoHash: h.arquivoHash,
        dataUpload: h.dataUpload || h.createdAt,
        status: classif.status,
        acessosTitular: classif.acessosTitular,
        primeiraVisualizacaoEm: classif.primeiraVisualizacaoTitularEm
          ? classif.primeiraVisualizacaoTitularEm.toISOString()
          : null,
        cienciaConfirmadaEm: classif.cienciaConfirmadaEm
          ? classif.cienciaConfirmadaEm.toISOString()
          : null,
        cienciaComprovanteHash: extra?.ciencia_comprovante_hash
          ? String(extra.ciencia_comprovante_hash)
          : logCienciaMetadataHash
          ? "CONFIRMADO_WORM"
          : null,
      };
    });

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

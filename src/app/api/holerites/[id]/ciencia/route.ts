import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getRequestIp } from "@/lib/security/requestIp";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAuditEventStrict } from "@/lib/audit/log";
import { recordAuditLog } from "@/lib/audit";
import { ensureHoleritesGovernanceTablesExist } from "@/lib/holerites/holerites-governance-repository";
import {
  formatarCompetenciaCurta,
  gerarComprovanteCienciaHoleriteHash,
} from "@/lib/holerites/clt-prazo-calculator";

export const dynamic = "force-dynamic";

const RATE_LIMIT_CONFIG = { windowMs: 60_000, max: 15 };

/**
 * POST /api/holerites/[id]/ciencia
 * Registra a confirmação eletrônica expressa de recebimento e ciência do holerite
 * exclusivamente pelo colaborador titular autenticado (CLT Art. 464 + MP nº 2.200-2/2001, art. 10, § 2º).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const tenantId = user.tenantId;
    const usuarioId = user.id;

    const rateCheck = checkRateLimit(`holerite_ciencia:${usuarioId}`, RATE_LIMIT_CONFIG);
    if (!rateCheck.ok) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um instante." },
        { status: 429 }
      );
    }

    const { id } = params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Parâmetro inválido." }, { status: 400 });
    }

    await ensureHoleritesGovernanceTablesExist();

    // Estritamente apenas o titular do holerite pode confirmar ciência
    const holerite = await prisma.fiorixHolerite.findFirst({
      where: {
        id,
        tenantId,
        usuarioId,
      },
      select: {
        id: true,
        usuarioId: true,
        mes: true,
        ano: true,
        arquivoNome: true,
        arquivoHash: true,
        dataUpload: true,
      },
    });

    if (!holerite) {
      return NextResponse.json(
        { error: "Holerite não encontrado para o colaborador autenticado." },
        { status: 404 }
      );
    }

    // Verifica se já existe ciência anterior (idempotente)
    try {
      const existingRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT ciencia_confirmada_em, ciencia_ip, ciencia_comprovante_hash
         FROM public.fiorix_holerites
         WHERE id = $1 AND tenant_id = $2
         LIMIT 1`,
        holerite.id,
        tenantId
      );
      const existing = existingRows?.[0];
      if (existing?.ciencia_confirmada_em && existing?.ciencia_comprovante_hash) {
        return NextResponse.json({
          success: true,
          alreadyConfirmed: true,
          cienciaConfirmadaEm: new Date(existing.ciencia_confirmada_em).toISOString(),
          cienciaComprovanteHash: String(existing.ciencia_comprovante_hash),
        });
      }
    } catch {}

    const ip = getRequestIp(req);
    const userAgent = (req.headers.get("user-agent") || "unknown").slice(0, 500);
    const agora = new Date();
    const agoraIso = agora.toISOString();

    const cienciaComprovanteHash = gerarComprovanteCienciaHoleriteHash({
      tenantId,
      holeriteId: holerite.id,
      usuarioId: holerite.usuarioId,
      ano: holerite.ano,
      mes: holerite.mes,
      arquivoHash: holerite.arquivoHash,
      cienciaConfirmadaEmIso: agoraIso,
      ip,
    });

    // 1. Auditoria estrita em FiorixAcessoLog
    await logAuditEventStrict({
      tenantId,
      usuarioId,
      tipo: "holerite_ciencia_confirmada",
      recursoId: holerite.id,
      ip,
      userAgent,
      metadata: {
        mes: holerite.mes,
        ano: holerite.ano,
        competencia: formatarCompetenciaCurta(holerite.mes, holerite.ano),
        arquivoHash: holerite.arquivoHash,
        cienciaComprovanteHash,
        fundamentoLegal: "CLT Art. 464 + MP 2.200-2/2001 Art. 10 §2º",
      },
    });

    // 2. Grava colunas dedicadas em fiorix_holerites
    await prisma
      .$executeRawUnsafe(
        `UPDATE public.fiorix_holerites
         SET primeira_visualizacao_em = COALESCE(primeira_visualizacao_em, $2::timestamptz),
             ciencia_confirmada_em = COALESCE(ciencia_confirmada_em, $2::timestamptz),
             ciencia_ip = COALESCE(ciencia_ip, $3),
             ciencia_user_agent = COALESCE(ciencia_user_agent, $4),
             ciencia_comprovante_hash = COALESCE(ciencia_comprovante_hash, $5)
         WHERE id = $1 AND tenant_id = $6`,
        holerite.id,
        agoraIso,
        ip,
        userAgent,
        cienciaComprovanteHash,
        tenantId
      )
      .catch((err) => {
        console.warn("[Holerite Ciência] Aviso ao atualizar colunas de ciência:", err);
      });

    // 3. Trilha imutável WORM em fiorix_audit_logs
    await recordAuditLog({
      modulo: "HOLERITES",
      acao: "CIENCIA",
      registroId: holerite.id,
      registroDescricao: `Ciência eletrônica de recebimento de holerite (${formatarCompetenciaCurta(holerite.mes, holerite.ano)}) confirmada pelo titular ${user.name || "Colaborador"}`,
      ipOrigem: ip,
      userOverride: user,
      detalhes: {
        holeriteId: holerite.id,
        competencia: formatarCompetenciaCurta(holerite.mes, holerite.ano),
        colaboradorNome: user.name,
        colaboradorEmail: user.email,
        arquivoHashSha256: holerite.arquivoHash,
        cienciaComprovanteHashSha256: cienciaComprovanteHash,
        cienciaConfirmadaEmIso: agoraIso,
        ip,
        userAgent,
        fundamentoLegal: "CLT Art. 464 e MP nº 2.200-2/2001, art. 10, § 2º",
      },
    });

    return NextResponse.json({
      success: true,
      alreadyConfirmed: false,
      cienciaConfirmadaEm: agoraIso,
      cienciaComprovanteHash,
    });
  } catch (error: any) {
    if (error?.message?.includes("Não autorizado")) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    console.error("[Holerite Ciência API] Erro:", error);
    return NextResponse.json(
      { error: "Não foi possível registrar a confirmação de recebimento." },
      { status: 500 }
    );
  }
}


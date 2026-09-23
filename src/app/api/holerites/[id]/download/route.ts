import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { getRequestIp } from "@/lib/security/requestIp";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAuditEventStrict } from "@/lib/audit/log";

export const dynamic = "force-dynamic";

const BUCKET_NAME = "fiorix-holerites";

// Rate limit: 10 downloads por minuto por usuário
const RATE_LIMIT_CONFIG = { windowMs: 60_000, max: 10 };

/**
 * Sanitiza string para uso seguro em headers HTTP (Content-Disposition).
 * Remove caracteres que podem causar header injection.
 */
function sanitizeFilename(input: string): string {
  return input.replace(/[^a-zA-Z0-9\-_.]/g, "_");
}

/**
 * Valida o formato de competência (MM/YYYY).
 */
function isValidCompetencia(value: string): boolean {
  return /^\d{2}\/\d{4}$/.test(value);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const tenantId = user.tenantId;
    const usuarioId = user.id;

    // ── Rate Limiting ────────────────────────────────────────────────
    const rateLimitKey = `holerite_download:${usuarioId}`;
    const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG);
    if (!rateCheck.ok) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em breve." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)),
          },
        }
      );
    }

    // ── Validação de parâmetros ──────────────────────────────────────
    const { id } = params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Parâmetro inválido." }, { status: 400 });
    }

    // ── Anti-IDOR: Verifica propriedade do holerite ─────────────────
    // O holerite DEVE pertencer ao usuário autenticado E ao tenant da sessão.
    const holerite = await prisma.fiorixHolerite.findFirst({
      where: {
        id,
        tenantId,
        usuarioId,
      },
      select: {
        id: true,
        mes: true,
        ano: true,
        storagePath: true,
        arquivoNome: true,
        arquivoHash: true,
        tamanhoBytes: true,
      },
    });

    if (!holerite) {
      // Retorna 404 genérico — nunca indicar se o ID existe para outro usuário
      return NextResponse.json(
        { error: "Documento não encontrado." },
        { status: 404 }
      );
    }

    // ── Auditoria ESTRITA — bloqueia download se o log falhar ───────
    const ip = getRequestIp(req);
    await logAuditEventStrict({
      tenantId,
      usuarioId,
      tipo: "holerite_download_authorized",
      recursoId: holerite.id,
      ip,
      userAgent: req.headers.get("user-agent") || "unknown",
      metadata: {
        mes: holerite.mes,
        ano: holerite.ano,
        arquivoHash: holerite.arquivoHash,
      },
    });

    // ── Gera URL assinada temporária via Supabase Storage ───────────
    // A URL expira em 5 minutos (300 segundos) e não expõe o caminho interno.
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(holerite.storagePath, 300, {
        download: holerite.arquivoNome,
      });

    if (signError || !signedData?.signedUrl) {
      console.error("[Holerite Download] Erro ao gerar URL assinada:", signError);
      return NextResponse.json(
        { error: "Não foi possível gerar o link de download seguro." },
        { status: 500 }
      );
    }

    // ── Resposta ────────────────────────────────────────────────────
    const competencia = `${String(holerite.mes).padStart(2, "0")}-${holerite.ano}`;
    const safeFilename = sanitizeFilename(`Holerite-Competencia-${competencia}.pdf`);

    const accept = req.headers.get("accept") || "";
    if (accept.includes("application/json")) {
      return NextResponse.json({
        signedUrl: signedData.signedUrl,
        fileName: safeFilename,
        mimeType: "application/pdf",
        sizeBytes: holerite.tamanhoBytes,
      });
    }

    // Redirect para URL assinada (o browser inicia o download)
    return NextResponse.redirect(signedData.signedUrl);
  } catch (error: any) {
    // Auditoria estrita falhou — bloquear a operação
    if (error?.message?.includes("Auditoria obrigatória falhou")) {
      console.error("[Holerite Download] Auditoria falhou — operação bloqueada:", error);
      return NextResponse.json(
        { error: "Operação temporariamente indisponível. Tente novamente." },
        { status: 503 }
      );
    }

    console.error("[Holerite Download] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

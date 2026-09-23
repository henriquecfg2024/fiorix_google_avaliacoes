import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { generateHash } from "@/lib/security/hash";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestIp } from "@/lib/security/requestIp";

const BUCKET_NAME = "fiorix-holerites";

/**
 * Garante que o bucket privado de holerites exista no Supabase Storage.
 * Cria automaticamente na primeira utilização se necessário.
 */
async function ensureBucketExists() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = buckets?.some((b: any) => b.name === BUCKET_NAME);
  if (!exists) {
    const { error } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ["application/pdf"],
    });
    if (error) {
      console.error("[Holerites] Erro ao criar bucket:", error);
      throw new Error("Falha ao inicializar storage de holerites.");
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "RH" && session.user.role !== "MASTER")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const uploaderId = session.user.id;

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    // Garantir que o bucket existe antes de processar uploads
    await ensureBucketExists();

    const resultados = [];

    for (const file of files) {
      if (file.type !== "application/pdf") {
        resultados.push({ arquivo: file.name, status: "FORMATO INVÁLIDO" });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        resultados.push({ arquivo: file.name, status: "TAMANHO EXCEDIDO (Máx 5MB)" });
        continue;
      }

      // Regex para extrair CPF_MES-ANO.pdf, ex: 12345678901_08-2026.pdf
      const match = file.name.match(/^(\d{11})_(\d{2})-(\d{4})\.pdf$/i);
      if (!match) {
        resultados.push({ arquivo: file.name, status: "FORMATO DE NOME INVÁLIDO" });
        continue;
      }

      const [, cpf, mesStr, anoStr] = match;
      const mes = parseInt(mesStr, 10);
      const ano = parseInt(anoStr, 10);

      // Validação de competência
      if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
        resultados.push({ arquivo: file.name, status: "COMPETÊNCIA INVÁLIDA" });
        continue;
      }

      // Localiza o colaborador pelo CPF dentro do tenant
      let usuarioAlvo: { id: string; name: string | null } | null = null;
      try {
        usuarioAlvo = await prisma.user.findUnique({
          where: { tenantId_cpf: { tenantId, cpf } },
          select: { id: true, name: true },
        });
      } catch {
        // Se a constraint ainda não existir (migração pendente), tenta busca simples
        usuarioAlvo = await prisma.user.findFirst({
          where: { tenantId, cpf },
          select: { id: true, name: true },
        });
      }

      if (!usuarioAlvo) {
        resultados.push({ arquivo: file.name, cpf, status: "COLABORADOR NÃO ENCONTRADO" });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const arquivoHash = generateHash(buffer);

      // Verifica duplicidade por mês/ano e usuário
      const existente = await prisma.fiorixHolerite.findUnique({
        where: { tenantId_usuarioId_mes_ano: { tenantId, usuarioId: usuarioAlvo.id, mes, ano } }
      });

      if (existente) {
        resultados.push({ arquivo: file.name, colaborador: usuarioAlvo.name, status: "DUPLICADO" });
        continue;
      }

      // Upload real para o Supabase Storage (bucket privado)
      const storagePath = `${tenantId}/${usuarioAlvo.id}/${ano}/${String(mes).padStart(2, "0")}.pdf`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error(`[Holerite Upload] Erro no storage para ${file.name}:`, uploadError);
        resultados.push({ arquivo: file.name, status: "ERRO NO STORAGE" });
        continue;
      }

      // Persiste no banco de dados
      await prisma.fiorixHolerite.create({
        data: {
          tenantId,
          usuarioId: usuarioAlvo.id,
          mes,
          ano,
          storagePath,
          arquivoNome: file.name,
          arquivoHash,
          tamanhoBytes: file.size,
          uploadedBy: uploaderId,
        }
      });

      resultados.push({ arquivo: file.name, colaborador: usuarioAlvo.name, status: "MATCH" });
    }

    // Registra auditoria
    await logAuditEvent({
      tenantId,
      usuarioId: uploaderId,
      tipo: "holerite_download_authorized" as any,
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent") || "unknown",
      metadata: { acao: "upload", processados: files.length, resultados },
    });

    return NextResponse.json({ success: true, resultados });

  } catch (error) {
    console.error("Erro no upload de holerites:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

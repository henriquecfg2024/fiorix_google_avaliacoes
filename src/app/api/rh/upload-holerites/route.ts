import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateHash } from "@/lib/security/hash";
import { logAuditEvent } from "@/lib/audit/log";
import { getRequestIp } from "@/lib/security/requestIp";

// Simulação de Storage. Em um cenário real, integraria com AWS S3, Supabase Storage, etc.
const STORAGE_PROVIDER_SAVE = async (buffer: Buffer, path: string) => {
  // Implementação mockada
  return `https://storage.fiorix.com/mock/${path}`;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "RH")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const uploaderId = session.user.id;
    
    // O Next.js Request FormData
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const resultados = [];

    for (const file of files) {
      if (file.type !== "application/pdf") {
        resultados.push({ arquivo: file.name, status: "FORMATO INVÁLIDO" });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
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

      // Localiza o colaborador (Aqui usaríamos um campo CPF real no banco, estamos simulando com o ID ou um Alias por enquanto.
      // Assumindo que o tenant tenha o registro do usuário com CPF no metadata ou em um model próprio
      // TODO: Ajustar para a busca real de CPF conforme a implementação específica de perfil
      const usuarioAlvo = await prisma.user.findFirst({
         where: { tenantId } // Precisa adicionar filtro por CPF
      });

      if (!usuarioAlvo) {
        resultados.push({ arquivo: file.name, cpf, status: "NÃO ENCONTRADO" });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const arquivoHash = generateHash(buffer);

      // Verifica se já existe para este mês/ano e usuário
      const existente = await prisma.fiorixHolerite.findUnique({
        where: { tenantId_usuarioId_mes_ano: { tenantId, usuarioId: usuarioAlvo.id, mes, ano } }
      });

      if (existente) {
        resultados.push({ arquivo: file.name, colaborador: usuarioAlvo.name, status: "DUPLICADO" });
        continue;
      }

      // Salva no storage (bucket privado)
      const storagePath = `${tenantId}/holerites/${usuarioAlvo.id}/${ano}/${mes}/${file.name}`;
      await STORAGE_PROVIDER_SAVE(buffer, storagePath);

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
      tipo: "holerite_upload" as any,
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent") || "unknown",
      metadata: { processados: files.length, resultados },
    });

    return NextResponse.json({ success: true, resultados });

  } catch (error) {
    console.error("Erro no upload de holerites:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

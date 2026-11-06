import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { generateHash } from "@/lib/security/hash";
import { logAuditEvent } from "@/lib/audit/log";
import { recordAuditLog } from "@/lib/audit";
import { getRequestIp } from "@/lib/security/requestIp";
import {
  ensureFeriasTablesExist,
  nomesColaboradorCompativeis,
} from "@/lib/ferias/ferias-repository";
import {
  formatarCpfCompleto,
  limparCpfReal,
  mascararCpfLgpd,
} from "@/lib/ferias/idade-calculator";

const BUCKET_NAME = "fiorix-holerites";

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

function normNomeBasico(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (
      !session?.user ||
      (session.user.role !== "ADMIN" &&
        session.user.role !== "RH" &&
        session.user.role !== "MASTER")
    ) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const uploaderId = session.user.id;

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const replaceExisting = formData.get("replace") === "true";

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    await Promise.all([ensureBucketExists(), ensureFeriasTablesExist()]);

    // Carrega lista de colaboradores excluídos para nunca vincular holerite a ex-colaborador removido
    const exclUsers = new Set<string>();
    const exclNames = new Set<string>();
    try {
      const exclRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT usuario_id, nome_normalizado FROM public.fiorix_ferias_colaboradores_excluidos WHERE tenant_id = $1`,
        tenantId
      );
      if (Array.isArray(exclRows)) {
        for (const ex of exclRows) {
          if (ex.usuario_id) exclUsers.add(String(ex.usuario_id));
          if (ex.nome_normalizado) exclNames.add(String(ex.nome_normalizado));
        }
      }
    } catch {}

    const resultados: Array<{
      arquivo: string;
      cpfInformado?: string;
      colaborador?: string | null;
      competencia?: string;
      status: string;
      motivo?: string;
      id?: string;
    }> = [];

    for (const file of files) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        resultados.push({
          arquivo: file.name,
          status: "FORMATO INVÁLIDO",
          motivo: "Apenas arquivos PDF são aceitos.",
        });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        resultados.push({
          arquivo: file.name,
          status: "TAMANHO EXCEDIDO",
          motivo: "O arquivo excede o limite máximo de 5MB.",
        });
        continue;
      }

      // Aceita CPF_MM-AAAA.pdf (11 dígitos exatos ou XXX.XXX.XXX-XX_MM-AAAA.pdf)
      const match = file.name.match(/^([\d.\-]{11,14})_(\d{2})-(\d{4})\.pdf$/i);
      if (!match) {
        resultados.push({
          arquivo: file.name,
          status: "NOME FORA DO PADRÃO",
          motivo: "Use estritamente o formato CPF_MM-AAAA.pdf (ex: 12345678901_10-2026.pdf).",
        });
        continue;
      }

      const [, rawCpfToken, mesStr, anoStr] = match;
      const digitsOnly = rawCpfToken.replace(/\D/g, "");
      if (digitsOnly.length !== 11) {
        resultados.push({
          arquivo: file.name,
          cpfInformado: rawCpfToken,
          status: "CPF INCOMPLETO",
          motivo: `O CPF no nome do arquivo possui ${digitsOnly.length} dígitos (obrigatório: 11 dígitos exatos).`,
        });
        continue;
      }

      const cpfValido = limparCpfReal(digitsOnly);
      if (!cpfValido) {
        resultados.push({
          arquivo: file.name,
          cpfInformado: formatarCpfCompleto(digitsOnly) || digitsOnly,
          status: "CPF INVÁLIDO",
          motivo: "Os dígitos verificadores do CPF são matematicamente inválidos ou sintéticos.",
        });
        continue;
      }

      const mes = parseInt(mesStr, 10);
      const ano = parseInt(anoStr, 10);
      const competencia = `${String(mes).padStart(2, "0")}/${ano}`;

      if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
        resultados.push({
          arquivo: file.name,
          cpfInformado: mascararCpfLgpd(cpfValido) || undefined,
          status: "COMPETÊNCIA INVÁLIDA",
          motivo: `Mês/ano inválido (${competencia}).`,
        });
        continue;
      }

      // ── VALIDAÇÃO ESTRITA 1-PARA-1 DOS 11 DÍGITOS DO CPF ──────────────────
      // 1) Busca exata dos 11 dígitos em User do tenant
      let usuarioAlvo: { id: string; name: string | null } | null = null;
      try {
        usuarioAlvo = await prisma.user.findUnique({
          where: { tenantId_cpf: { tenantId, cpf: cpfValido } },
          select: { id: true, name: true },
        });
      } catch {
        usuarioAlvo = await prisma.user.findFirst({
          where: { tenantId, cpf: cpfValido },
          select: { id: true, name: true },
        });
      }

      // 2) Se ainda não vinculado em User.cpf, busca exata dos 11 dígitos no cadastro oficial GESTOR / Manual FIORIX
      if (!usuarioAlvo) {
        const gestorMatches = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id, registro_gestor, usuario_id, nome, cargo, setor, ativo, excluido_fiorix
           FROM public.fiorix_rh_colaboradores_gestor
           WHERE tenant_id = $1 AND cpf = $2
           ORDER BY ativo DESC, updated_at DESC
           LIMIT 1`,
          tenantId,
          cpfValido
        );

        const gr = gestorMatches?.[0];
        if (gr) {
          if (gr.ativo === false || gr.excluido_fiorix === true) {
            resultados.push({
              arquivo: file.name,
              cpfInformado: formatarCpfCompleto(cpfValido) || cpfValido,
              colaborador: String(gr.nome),
              competencia,
              status: "COLABORADOR INATIVO / DESLIGADO",
              motivo: `O CPF pertence a "${gr.nome}", que consta como inativo/desligado no cadastro da Serventia.`,
            });
            continue;
          }

          // Verifica se já existe User para esse colaborador (por usuario_id ou nome compatível)
          const tenantUsers = await prisma.user.findMany({
            where: { tenantId },
            select: { id: true, name: true, cpf: true },
          });

          const existingUser =
            (gr.usuario_id && !String(gr.usuario_id).startsWith("gestor_") && !String(gr.usuario_id).startsWith("manual_")
              ? tenantUsers.find((u) => u.id === String(gr.usuario_id))
              : undefined) ||
            tenantUsers.find(
              (u) => u.name && nomesColaboradorCompativeis(u.name, String(gr.nome))
            );

          if (existingUser) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { cpf: cpfValido },
            });
            await prisma.$executeRawUnsafe(
              `UPDATE public.fiorix_rh_colaboradores_gestor SET usuario_id = $2 WHERE id = $1`,
              gr.id,
              existingUser.id
            );
            usuarioAlvo = { id: existingUser.id, name: existingUser.name || String(gr.nome) };
          } else {
            // Provisiona vínculo nominal interno em User com os 11 dígitos reais do GESTOR
            const slug = gr.registro_gestor
              ? `reg${gr.registro_gestor}`
              : cpfValido.slice(-6);
            const internalEmail = `colab.${slug}.${tenantId.slice(-6)}@7ri.fiorix.internal`.toLowerCase();
            const createdUser = await prisma.user.upsert({
              where: { email: internalEmail },
              update: {
                name: String(gr.nome),
                cpf: cpfValido,
                departamento: gr.setor ? String(gr.setor) : undefined,
                cargo: gr.cargo ? String(gr.cargo) : undefined,
              },
              create: {
                email: internalEmail,
                name: String(gr.nome),
                passwordHash: `!locked_gestor_${randomBytes(16).toString("hex")}`,
                role: "USER",
                tenantId,
                cpf: cpfValido,
                departamento: gr.setor ? String(gr.setor) : "Atendimento",
                cargo: gr.cargo ? String(gr.cargo) : "Colaborador",
              },
              select: { id: true, name: true },
            });
            await prisma.$executeRawUnsafe(
              `UPDATE public.fiorix_rh_colaboradores_gestor SET usuario_id = $2 WHERE id = $1`,
              gr.id,
              createdUser.id
            );
            usuarioAlvo = createdUser;
          }
        }
      }

      // 3) Se não encontrou correspondência EXATA dos 11 dígitos, BLOQUEIA IMEDIATAMENTE!
      if (
        !usuarioAlvo ||
        exclUsers.has(usuarioAlvo.id) ||
        exclNames.has(normNomeBasico(usuarioAlvo.name || ""))
      ) {
        resultados.push({
          arquivo: file.name,
          cpfInformado: formatarCpfCompleto(cpfValido) || cpfValido,
          competencia,
          status: "CPF NÃO CADASTRADO NA SERVENTIA",
          motivo: `O CPF ${formatarCpfCompleto(cpfValido)} não pertence a nenhum colaborador ativo cadastrado no GESTOR / FIORIX desta Serventia.`,
        });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const arquivoHash = generateHash(buffer);

      const existente = await prisma.fiorixHolerite.findUnique({
        where: {
          tenantId_usuarioId_mes_ano: {
            tenantId,
            usuarioId: usuarioAlvo.id,
            mes,
            ano,
          },
        },
      });

      if (existente && !replaceExisting) {
        resultados.push({
          arquivo: file.name,
          cpfInformado: mascararCpfLgpd(cpfValido) || undefined,
          colaborador: usuarioAlvo.name,
          competencia,
          status: "DUPLICADO",
          motivo: `Já existe holerite armazenado para ${usuarioAlvo.name} na competência ${competencia}.`,
        });
        continue;
      }

      const storagePath = `${tenantId}/${usuarioAlvo.id}/${ano}/${String(mes).padStart(2, "0")}.pdf`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        console.error(`[Holerite Upload] Erro no storage para ${file.name}:`, uploadError);
        resultados.push({
          arquivo: file.name,
          colaborador: usuarioAlvo.name,
          competencia,
          status: "ERRO NO STORAGE",
          motivo: "Falha ao gravar arquivo criptografado no storage privado.",
        });
        continue;
      }

      const saved = existente
        ? await prisma.fiorixHolerite.update({
            where: { id: existente.id },
            data: {
              storagePath,
              arquivoNome: file.name,
              arquivoHash,
              tamanhoBytes: file.size,
              uploadedBy: uploaderId,
              dataUpload: new Date(),
            },
          })
        : await prisma.fiorixHolerite.create({
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
            },
          });

      resultados.push({
        id: saved.id,
        arquivo: file.name,
        cpfInformado: mascararCpfLgpd(cpfValido) || undefined,
        colaborador: usuarioAlvo.name,
        competencia,
        status: existente ? "SUBSTITUÍDO" : "MATCH",
      });
    }

    const aprovados = resultados.filter(
      (r) => r.status === "MATCH" || r.status === "SUBSTITUÍDO"
    );
    const rejeitados = resultados.length - aprovados.length;

    await logAuditEvent({
      tenantId,
      usuarioId: uploaderId,
      tipo: "holerite_download_authorized" as any,
      ip: getRequestIp(req),
      userAgent: req.headers.get("user-agent") || "unknown",
      metadata: {
        acao: "upload_lote_1para1",
        processados: files.length,
        aprovados: aprovados.length,
        rejeitados,
        resultados,
      },
    });

    await recordAuditLog({
      modulo: "HOLERITES",
      acao: "INCLUSAO",
      registroDescricao: `Processamento em lote de holerites: ${aprovados.length} aceito(s), ${rejeitados} bloqueado(s) na validação 1-para-1 de CPF`,
      detalhes: {
        totalArquivos: files.length,
        aprovados: aprovados.length,
        rejeitados,
        resultados: resultados.map((r) => ({
          arquivo: r.arquivo,
          colaborador: r.colaborador ?? null,
          competencia: r.competencia ?? null,
          status: r.status,
          motivo: r.motivo ?? null,
        })),
      },
    });

    return NextResponse.json({
      success: true,
      aprovados: aprovados.length,
      rejeitados,
      resultados,
    });
  } catch (error) {
    console.error("Erro no upload de holerites:", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}

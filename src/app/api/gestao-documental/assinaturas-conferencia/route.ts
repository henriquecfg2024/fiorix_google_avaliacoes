import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';
import { isSameOriginRequest } from '@/lib/documental/origin';
import {
  getExternalConferenceForFile,
  saveExternalSignatureConference,
} from '@/lib/documental/signatureAuditStore';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });

const salvarConferenciaSchema = z.object({
  rootId: z.string().trim().min(1).max(64).default('local'),
  relativePath: z.string().trim().min(1).max(512),
  nomeArquivo: z.string().trim().min(1).max(260),
  hashSha256: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{64}$/, 'Hash SHA-256 inválido (deve conter 64 caracteres hexadecimais).'),
  resultado: z.enum(['VALIDA', 'INVALIDA', 'INCONCLUSIVA']),
  responsavelNome: z.string().trim().min(2).max(160).optional(),
  dataConferencia: z.string().trim().max(80).optional(),
  orgaoVerificador: z.string().trim().max(160).optional(),
  relatorioConformidade: z.string().trim().min(3).max(2000),
});

export async function GET(req: Request) {
  try {
    const user = await requireDocumentAccess();
    const params = new URL(req.url).searchParams;
    const hashSha256 = params.get('hashSha256') || undefined;
    const rootId = params.get('rootId') || undefined;
    const relativePath = params.get('relativePath') || undefined;

    const info = await getExternalConferenceForFile(user.tenantId, {
      hashSha256,
      rootId,
      relativePath,
    });

    return reply({
      conferencia: info.conferencia,
      conferenciaAnteriorDivergente: info.conferenciaAnteriorDivergente,
      usuarioAtualNome: user.name || user.email || 'Colaborador',
    });
  } catch (error) {
    if (error instanceof DocumentAccessError) {
      return reply({ error: error.message }, error.status);
    }
    return reply({ error: 'Não foi possível consultar a conferência externa.' }, 503);
  }
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return reply({ error: 'Origem inválida.' }, 403);
    }
    const user = await requireDocumentAccess();
    const raw = await req.text();
    if (raw.length > 16384) {
      return reply({ error: 'Requisição excede o tamanho máximo permitido.' }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: 'JSON inválido.' }, 400);
    }

    const parsed = salvarConferenciaSchema.safeParse(body);
    if (!parsed.success) {
      return reply(
        { error: parsed.error.issues[0]?.message || 'Dados da conferência externa inválidos.' },
        400,
      );
    }

    const data = parsed.data;
    const responsavelEfetivo =
      data.responsavelNome?.trim() || user.name || user.email || 'Colaborador Autenticado';

    const conferencia = await saveExternalSignatureConference(user.tenantId, {
      rootId: data.rootId,
      relativePath: data.relativePath,
      nomeArquivo: data.nomeArquivo,
      hashSha256: data.hashSha256,
      resultado: data.resultado,
      responsavelNome: responsavelEfetivo,
      responsavelId: user.id,
      dataConferencia: data.dataConferencia,
      orgaoVerificador: data.orgaoVerificador,
      relatorioConformidade: data.relatorioConformidade,
    });

    // Invalida cache anterior em DocumentSearchRequest para que a próxima consulta traga a conferência vinculada
    try {
      await prisma.$executeRaw`
        DELETE FROM "DocumentSearchRequest"
        WHERE "tenantId" = ${user.tenantId}
          AND type = 'analyze_signatures'
          AND "rootId" = ${data.rootId}
          AND "relativePath" = ${data.relativePath}
      `;
    } catch {
      // Ignora caso a tabela não esteja acessível no momento
    }

    return reply({ conferencia }, 201);
  } catch (error) {
    if (error instanceof DocumentAccessError) {
      return reply({ error: error.message }, error.status);
    }
    return reply({ error: 'Falha ao registrar conferência externa.' }, 503);
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, type AuthenticatedUser } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit';
import { isSameOriginRequest } from '@/lib/documental/origin';
import {
  createMemorialInfraEntry,
  deleteMemorialInfraEntry,
  getMemorialInfraSnapshot,
  memorialEntryInputSchema,
  updateMemorialInfraEntry,
} from '@/lib/memorial-infraestrutura/store';

export const dynamic = 'force-dynamic';

class MasterAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });

async function requireMasterAccess(): Promise<{
  sessionUser: AuthenticatedUser;
  tenantId: string;
  authorName: string;
}> {
  let sessionUser: AuthenticatedUser;
  try {
    sessionUser = await requireAuth();
  } catch {
    throw new MasterAccessError('Sessão não autenticada.', 401);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      role: true,
      tenantId: true,
      name: true,
      email: true,
    },
  });

  if (!dbUser || dbUser.role !== 'MASTER' || sessionUser.role !== 'MASTER') {
    throw new MasterAccessError('Acesso exclusivo ao perfil MASTER da plataforma.', 403);
  }

  return {
    sessionUser,
    tenantId: sessionUser.tenantId || dbUser.tenantId,
    authorName: dbUser.name || dbUser.email || 'MASTER',
  };
}

function handleError(err: unknown) {
  if (err instanceof MasterAccessError) {
    return reply({ error: err.message }, err.status);
  }
  if (err instanceof z.ZodError) {
    return reply(
      { error: err.issues[0]?.message || 'Dados inválidos para registro no Memorial.' },
      400,
    );
  }
  if (err instanceof Error) {
    return reply({ error: err.message }, 400);
  }
  return reply({ error: 'Falha interna ao processar Memorial dos Servidores.' }, 500);
}

const updateBodySchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    data: memorialEntryInputSchema,
  })
  .strict();

export async function GET() {
  try {
    const master = await requireMasterAccess();
    const snapshot = await getMemorialInfraSnapshot(master.tenantId);
    return reply(snapshot, 200);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginRequest(req)) {
      return reply({ error: 'Origem da requisição não autorizada.' }, 403);
    }
    const master = await requireMasterAccess();
    const body = await req.json();
    const input = memorialEntryInputSchema.parse(body);

    const entry = await createMemorialInfraEntry({
      tenantId: master.tenantId,
      authorName: master.authorName,
      input,
    });

    await recordAuditLog({
      modulo: 'MEMORIAL_INFRAESTRUTURA',
      acao: 'INCLUSAO',
      registroId: entry.id,
      registroDescricao: `[${entry.server}] ${entry.title}`,
      detalhes: {
        server: entry.server,
        category: entry.category,
        implementedAt: entry.implementedAt,
        connectorVersion: entry.connectorVersion,
      },
      userOverride: master.sessionUser,
    });

    return reply({ entry }, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!isSameOriginRequest(req)) {
      return reply({ error: 'Origem da requisição não autorizada.' }, 403);
    }
    const master = await requireMasterAccess();
    const body = await req.json();
    const { id, data } = updateBodySchema.parse(body);

    const entry = await updateMemorialInfraEntry({
      tenantId: master.tenantId,
      id,
      authorName: master.authorName,
      input: data,
    });

    await recordAuditLog({
      modulo: 'MEMORIAL_INFRAESTRUTURA',
      acao: 'ALTERACAO',
      registroId: entry.id,
      registroDescricao: `[${entry.server}] ${entry.title}`,
      detalhes: {
        server: entry.server,
        category: entry.category,
        implementedAt: entry.implementedAt,
      },
      userOverride: master.sessionUser,
    });

    return reply({ entry }, 200);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!isSameOriginRequest(req)) {
      return reply({ error: 'Origem da requisição não autorizada.' }, 403);
    }
    const master = await requireMasterAccess();
    const id = req.nextUrl.searchParams.get('id')?.trim() || '';
    if (!id || id.length > 120) {
      return reply({ error: 'Identificador inválido para exclusão.' }, 400);
    }

    await deleteMemorialInfraEntry({
      tenantId: master.tenantId,
      id,
    });

    await recordAuditLog({
      modulo: 'MEMORIAL_INFRAESTRUTURA',
      acao: 'EXCLUSAO',
      registroId: id,
      registroDescricao: `Remoção de registro customizado (${id}) do Memorial dos Servidores`,
      userOverride: master.sessionUser,
    });

    return reply({ ok: true, id }, 200);
  } catch (err) {
    return handleError(err);
  }
}

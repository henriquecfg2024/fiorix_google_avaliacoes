import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';
import { documentJobInput } from '@/lib/documental/contracts';
import { createJob, readSearch } from '@/lib/documental/store';

export const dynamic = 'force-dynamic';
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
function errorResponse(error: unknown) {
  if (error instanceof DocumentAccessError) return reply({ error: error.message }, error.status);
  return reply({ error: 'Serviço documental indisponível. Verifique a configuração em homologação.' }, 503);
}
export async function GET(req: Request) {
  try {
    const user = await requireDocumentAccess();
    const id = new URL(req.url).searchParams.get('id');
    if (id !== null) {
      if (!z.string().uuid().safeParse(id).success) return reply({ error: 'Pesquisa inválida.' }, 400);
      const job = await readSearch(id, user.tenantId, user.id);
      return job ? reply(job) : reply({ error: 'Pesquisa expirada ou não encontrada.' }, 404);
    }
    const connectors = await prisma.connector.findMany({
      where: { tenantId: user.tenantId, enabled: true },
      select: { id: true, name: true, lastSeenAt: true },
      orderBy: { name: 'asc' },
    });
    return reply({ connectors });
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: Request) {
  try {
    // Browser never receives a Connector credential.
    if (req.headers.get('origin') !== new URL(req.url).origin) return reply({ error: 'Origem inválida.' }, 403);
    const user = await requireDocumentAccess();
    const raw = await req.text();
    if (raw.length > 4096) return reply({ error: 'Requisição inválida.' }, 400);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'Requisição inválida.' }, 400); }
    const parsed = documentJobInput.safeParse(body);
    if (!parsed.success) return reply({ error: 'Parâmetros de requisição inválidos.' }, 400);
    const jobData = parsed.data;
    const connector = await prisma.connector.findFirst({
      where: { id: jobData.connectorId, tenantId: user.tenantId, enabled: true },
      select: { id: true, lastSeenAt: true },
    });
    if (!connector?.lastSeenAt || Date.now() - connector.lastSeenAt.getTime() > 120000) return reply({ error: 'Connector sem sinal recente.' }, 409);
    
    let jobResult: any = null;
    if (jobData.type === 'extract_petition' || jobData.type === 'analyze_signatures') {
      jobResult = await createJob(user.tenantId, user.id, connector.id, {
        type: jobData.type,
        rootId: jobData.rootId,
        relativePath: jobData.relativePath,
        forceFresh: jobData.forceFresh,
      });
    } else {
      jobResult = await createJob(user.tenantId, user.id, connector.id, {
        type: 'search',
        query: jobData.query,
        forceFresh: jobData.forceFresh,
      });
    }
    if (!jobResult) return reply({ error: 'Aguarde a operação anterior terminar ou expirar.' }, 429);

    if (typeof jobResult === 'string') {
      return reply({ id: jobResult }, 202);
    }

    if (jobResult.status === 'complete') {
      return reply({
        id: jobResult.id,
        status: 'complete',
        result: jobResult.result,
        cached: true,
      }, 200);
    }

    return reply({ id: jobResult.id, status: 'queued' }, 202);
  } catch (error) { return errorResponse(error); }
}

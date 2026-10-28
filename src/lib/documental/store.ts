import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

export interface SearchJob {
  id: string;
  type: string;
  query: string | null;
  rootId?: string | null;
  relativePath?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  status: 'queued' | 'running' | 'complete' | 'failed';
  result: Prisma.JsonValue | null;
  expiresAt: Date;
}

export interface JobResponse {
  id: string;
  status: 'queued' | 'complete';
  result?: Prisma.JsonValue | unknown;
  cached?: boolean;
}

export interface CreateJobOptions {
  type?: string;
  query?: string | null;
  rootId?: string | null;
  relativePath?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  forceFresh?: boolean;
}

export async function createJob(tenantId: string, userId: string, connectorId: string, options: CreateJobOptions): Promise<JobResponse | null> {
  const type = options.type || 'search';
  const query = options.query ?? null;
  const rootId = options.rootId ?? null;
  const relativePath = options.relativePath ?? null;
  const pageStart = options.pageStart ?? null;
  const pageEnd = options.pageEnd ?? null;
  const forceFresh = !!options.forceFresh;

  return prisma.$transaction(async tx => {
    // Serialize per user to enforce one outstanding job across concurrent requests.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':' + userId}))`;
    await tx.$executeRaw`DELETE FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId} AND "expiresAt" <= NOW()`;

    // Se for solicitado forceFresh, exclui jobs anteriores desse mesmo arquivo/busca para limpar cache
    if (forceFresh) {
      if (type === 'search' && query) {
        await tx.$executeRaw`DELETE FROM "DocumentSearchRequest"
          WHERE "tenantId" = ${tenantId} AND "connectorId" = ${connectorId}
            AND type = 'search' AND query = ${query}`;
      } else if ((type === 'extract_petition' || type === 'analyze_signatures' || type === 'read_document_text') && rootId && relativePath) {
        await tx.$executeRaw`DELETE FROM "DocumentSearchRequest"
          WHERE "tenantId" = ${tenantId} AND "connectorId" = ${connectorId}
            AND type = ${type} AND "rootId" = ${rootId} AND "relativePath" = ${relativePath}`;
      }
    }

    // Cache no servidor: se já houver um job idêntico concluído válido (até 24h), retorna imediatamente
    if (!forceFresh) {
      if (type === 'search' && query) {
        const recent = await tx.$queryRaw<Array<{ id: string; result: Prisma.JsonValue }>>`
          SELECT id, result FROM "DocumentSearchRequest"
          WHERE "tenantId" = ${tenantId} AND "connectorId" = ${connectorId}
            AND type = 'search' AND query = ${query} AND status = 'complete'
            AND "expiresAt" > NOW()
          ORDER BY "createdAt" DESC LIMIT 1
        `;
        if (recent.length) return { id: recent[0].id, status: 'complete', result: recent[0].result, cached: true };
      } else if ((type === 'extract_petition' || type === 'analyze_signatures' || type === 'read_document_text') && rootId && relativePath) {
        const recent = await tx.$queryRaw<Array<{ id: string; result: Prisma.JsonValue }>>`
          SELECT id, result FROM "DocumentSearchRequest"
          WHERE "tenantId" = ${tenantId} AND "connectorId" = ${connectorId}
            AND type = ${type} AND "rootId" = ${rootId} AND "relativePath" = ${relativePath} AND status = 'complete'
            AND "expiresAt" > NOW()
          ORDER BY "createdAt" DESC LIMIT 1
        `;
        if (recent.length) {
          const res = recent[0].result as Record<string, unknown> | null;
          // Se for extração e estiver totalmente vazia (stub de teste anterior), não serve do cache
          const ehValido = type === 'extract_petition'
            ? !!(res?.requerente || res?.imovel || res?.contribuinte_sql || res?.matricula_transcricao || res?.titular_origem)
            : true;
          if (ehValido) {
            return { id: recent[0].id, status: 'complete', result: recent[0].result, cached: true };
          }
        }
      }
    }

    const active = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "DocumentSearchRequest"
      WHERE "tenantId" = ${tenantId} AND "userId" = ${userId} AND status IN ('queued', 'running') LIMIT 1`;
    if (active.length) return null;
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "DocumentSearchRequest" (id, "tenantId", "userId", "connectorId", type, query, "rootId", "relativePath", "pageStart", "pageEnd", "expiresAt")
      VALUES (${id}, ${tenantId}, ${userId}, ${connectorId}, ${type}, ${query}, ${rootId}, ${relativePath}, ${pageStart}, ${pageEnd}, NOW() + INTERVAL '2 minutes')`;
    return { id, status: 'queued', cached: false };
  });
}

export async function createSearch(tenantId: string, userId: string, connectorId: string, query: string) {
  const job = await createJob(tenantId, userId, connectorId, { type: 'search', query });
  return job ? job.id : null;
}

export async function readSearch(id: string, tenantId: string, userId?: string) {
  const rows = await prisma.$queryRaw<SearchJob[]>`SELECT id, type, query, "rootId", "relativePath", "pageStart", "pageEnd", status, result, "expiresAt" FROM "DocumentSearchRequest"
    WHERE id = ${id} AND "tenantId" = ${tenantId} AND "expiresAt" > NOW()`;
  return rows[0] || null;
}

export async function claimSearch(tenantId: string, connectorId: string) {
  await prisma.$executeRaw`DELETE FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId} AND "expiresAt" <= NOW()`;
  const rows = await prisma.$queryRaw<Array<{ id: string; type: string; query: string | null; rootId: string | null; relativePath: string | null; pageStart: number | null; pageEnd: number | null }>>`
    UPDATE "DocumentSearchRequest" SET status = 'running'
    WHERE id = (SELECT id FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId}
      AND "connectorId" = ${connectorId} AND status = 'queued' AND "expiresAt" > NOW()
      ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, type, query, "rootId", "relativePath", "pageStart", "pageEnd"`;
  return rows[0] || null;
}

export async function finishSearch(id: string, tenantId: string, connectorId: string, result: unknown, failed = false) {
  return prisma.$executeRaw`UPDATE "DocumentSearchRequest" SET status = ${failed ? 'failed' : 'complete'},
    result = ${result === null ? null : JSON.stringify(result)}::jsonb,
    "expiresAt" = CASE WHEN ${failed} THEN NOW() + INTERVAL '2 minutes' ELSE NOW() + INTERVAL '24 hours' END
    WHERE id = ${id} AND "tenantId" = ${tenantId} AND "connectorId" = ${connectorId}
      AND status = 'running' AND "expiresAt" > NOW()`;
}


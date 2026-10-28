import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

export interface SearchJob {
  id: string;
  type: string;
  query: string | null;
  rootId?: string | null;
  relativePath?: string | null;
  status: 'queued' | 'running' | 'complete' | 'failed';
  result: Prisma.JsonValue | null;
  expiresAt: Date;
}

export interface CreateJobOptions {
  type?: string;
  query?: string | null;
  rootId?: string | null;
  relativePath?: string | null;
}

export async function createJob(tenantId: string, userId: string, connectorId: string, options: CreateJobOptions) {
  const type = options.type || 'search';
  const query = options.query ?? null;
  const rootId = options.rootId ?? null;
  const relativePath = options.relativePath ?? null;

  return prisma.$transaction(async tx => {
    // Serialize per user to enforce one outstanding job across concurrent requests.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':' + userId}))`;
    await tx.$executeRaw`DELETE FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId} AND "expiresAt" <= NOW()`;
    const active = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "DocumentSearchRequest"
      WHERE "tenantId" = ${tenantId} AND "userId" = ${userId} AND status IN ('queued', 'running') LIMIT 1`;
    if (active.length) return null;
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "DocumentSearchRequest" (id, "tenantId", "userId", "connectorId", type, query, "rootId", "relativePath", "expiresAt")
      VALUES (${id}, ${tenantId}, ${userId}, ${connectorId}, ${type}, ${query}, ${rootId}, ${relativePath}, NOW() + INTERVAL '2 minutes')`;
    return id;
  });
}

export async function createSearch(tenantId: string, userId: string, connectorId: string, query: string) {
  return createJob(tenantId, userId, connectorId, { type: 'search', query });
}

export async function readSearch(id: string, tenantId: string, userId: string) {
  const rows = await prisma.$queryRaw<SearchJob[]>`SELECT id, type, query, "rootId", "relativePath", status, result, "expiresAt" FROM "DocumentSearchRequest"
    WHERE id = ${id} AND "tenantId" = ${tenantId} AND "userId" = ${userId} AND "expiresAt" > NOW()`;
  return rows[0] || null;
}

export async function claimSearch(tenantId: string, connectorId: string) {
  await prisma.$executeRaw`DELETE FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId} AND "expiresAt" <= NOW()`;
  const rows = await prisma.$queryRaw<Array<{ id: string; type: string; query: string | null; rootId: string | null; relativePath: string | null }>>`
    UPDATE "DocumentSearchRequest" SET status = 'running'
    WHERE id = (SELECT id FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId}
      AND "connectorId" = ${connectorId} AND status = 'queued' AND "expiresAt" > NOW()
      ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, type, query, "rootId", "relativePath"`;
  return rows[0] || null;
}

export async function finishSearch(id: string, tenantId: string, connectorId: string, result: unknown, failed = false) {
  return prisma.$executeRaw`UPDATE "DocumentSearchRequest" SET status = ${failed ? 'failed' : 'complete'},
    result = ${result === null ? null : JSON.stringify(result)}::jsonb
    WHERE id = ${id} AND "tenantId" = ${tenantId} AND "connectorId" = ${connectorId}
      AND status = 'running' AND "expiresAt" > NOW()`;
}


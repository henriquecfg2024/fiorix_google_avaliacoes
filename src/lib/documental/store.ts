import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

export interface SearchJob {
  id: string; query: string; status: 'queued' | 'running' | 'complete' | 'failed';
  result: Prisma.JsonValue | null; expiresAt: Date;
}
export async function createSearch(tenantId: string, userId: string, connectorId: string, query: string) {
  return prisma.$transaction(async tx => {
    // Serialize per user to enforce one outstanding search across concurrent requests.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':' + userId}))`;
    await tx.$executeRaw`DELETE FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId} AND "expiresAt" <= NOW()`;
    const active = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "DocumentSearchRequest"
      WHERE "tenantId" = ${tenantId} AND "userId" = ${userId} AND status IN ('queued', 'running') LIMIT 1`;
    if (active.length) return null;
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "DocumentSearchRequest" (id, "tenantId", "userId", "connectorId", query, "expiresAt")
      VALUES (${id}, ${tenantId}, ${userId}, ${connectorId}, ${query}, NOW() + INTERVAL '2 minutes')`;
    return id;
  });
}
export async function readSearch(id: string, tenantId: string, userId: string) {
  const rows = await prisma.$queryRaw<SearchJob[]>`SELECT id, query, status, result, "expiresAt" FROM "DocumentSearchRequest"
    WHERE id = ${id} AND "tenantId" = ${tenantId} AND "userId" = ${userId} AND "expiresAt" > NOW()`;
  return rows[0] || null;
}
export async function claimSearch(tenantId: string, connectorId: string) {
  await prisma.$executeRaw`DELETE FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId} AND "expiresAt" <= NOW()`;
  const rows = await prisma.$queryRaw<Array<{ id: string; query: string }>>`
    UPDATE "DocumentSearchRequest" SET status = 'running'
    WHERE id = (SELECT id FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId}
      AND "connectorId" = ${connectorId} AND status = 'queued' AND "expiresAt" > NOW()
      ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, query`;
  return rows[0] || null;
}
export async function finishSearch(id: string, tenantId: string, connectorId: string, result: unknown, failed = false) {
  return prisma.$executeRaw`UPDATE "DocumentSearchRequest" SET status = ${failed ? 'failed' : 'complete'},
    result = ${result === null ? null : JSON.stringify(result)}::jsonb
    WHERE id = ${id} AND "tenantId" = ${tenantId} AND "connectorId" = ${connectorId}
      AND status = 'running' AND "expiresAt" > NOW()`;
}

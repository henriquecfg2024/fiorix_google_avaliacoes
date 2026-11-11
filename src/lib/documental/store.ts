import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { normalizarTermoPesquisaDocumental } from '@/lib/documental/pastasFavoritas';
import {
  computeLocalFileSha256,
  enrichAndNormalizeSignatureAuditForTenant,
  executeLocalPdfSignatureAudit,
} from '@/lib/documental/signatureAuditStore';

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
  const query = options.query ? normalizarTermoPesquisaDocumental(options.query) : null;
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
            AND type = 'search' AND (query = ${query} OR translate(LOWER(COALESCE(query, '')), '.-', '') = translate(LOWER(${query}), '.-', ''))`;
      } else if ((type === 'extract_petition' || type === 'analyze_signatures' || (type === 'read_document_text' && pageStart === null && pageEnd === null)) && rootId && relativePath) {
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
            AND type = 'search' AND (query = ${query} OR translate(LOWER(COALESCE(query, '')), '.-', '') = translate(LOWER(${query}), '.-', '')) AND status = 'complete'
            AND "expiresAt" > NOW()
          ORDER BY "createdAt" DESC LIMIT 1
        `;
        if (recent.length) return { id: recent[0].id, status: 'complete', result: recent[0].result, cached: true };
      } else if ((type === 'extract_petition' || type === 'analyze_signatures' || type === 'read_document_text') && rootId && relativePath) {
        const recent = await tx.$queryRaw<Array<{ id: string; result: Prisma.JsonValue; pageStart: number | null; pageEnd: number | null }>>`
          SELECT id, result, "pageStart", "pageEnd" FROM "DocumentSearchRequest"
          WHERE "tenantId" = ${tenantId} AND "connectorId" = ${connectorId}
            AND type = ${type} AND "rootId" = ${rootId} AND "relativePath" = ${relativePath} AND status = 'complete'
            AND (
              ("pageStart" IS NOT DISTINCT FROM ${pageStart}::int AND "pageEnd" IS NOT DISTINCT FROM ${pageEnd}::int)
              OR (${pageStart}::int IS NOT NULL AND ${pageEnd}::int IS NOT NULL AND "pageStart" IS NULL AND "pageEnd" IS NULL)
            )
            AND "expiresAt" > NOW()
          ORDER BY
            CASE WHEN "pageStart" IS NOT DISTINCT FROM ${pageStart}::int AND "pageEnd" IS NOT DISTINCT FROM ${pageEnd}::int THEN 0 ELSE 1 END ASC,
            "createdAt" DESC
          LIMIT 1
        `;
        if (recent.length) {
          const row = recent[0];
          const res = row.result as Record<string, unknown> | null;
          let ehValido = true;
          let resultadoFinal: unknown = row.result;
          if (type === 'extract_petition') {
            const imovelTxt = typeof res?.imovel === 'string' ? res.imovel : '';
            const reqTxt = typeof res?.requerente === 'string' ? res.requerente : '';
            ehValido = Boolean(reqTxt)
              && !/usucapi[ãa]o|merit[íi]ssim/i.test(reqTxt)
              && !/\[page:\d+\]|camscanner|rua\s+augusta[,\s]+(?:n[ºo°.]?\s*)?356|3218-0527/i.test(imovelTxt)
              && Boolean(res?.imovel || res?.contribuinte_sql || res?.matricula_transcricao || res?.titular_origem);
          } else if (type === 'read_document_text') {
            const relLower = (relativePath || '').toLowerCase();
            const isKen = relLower.endsWith('.ken') || relLower.endsWith('.tif') || relLower.endsWith('.tiff');
            const isPdf = relLower.endsWith('.pdf');
            if (isKen) {
              const paginasCache = Array.isArray(res?.pages) ? (res.pages as string[]) : [];
              if (paginasCache.length === 0) {
                ehValido = false;
              } else if (pageStart !== null && pageEnd !== null && row.pageStart === null && row.pageEnd === null) {
                const totalDoc = Number(res?.pageCount) || paginasCache.length;
                const endEfetivo = Math.min(pageEnd, totalDoc);
                if (pageStart >= 1 && paginasCache.length >= endEfetivo) {
                  const fatia = paginasCache.slice(pageStart - 1, endEfetivo);
                  resultadoFinal = {
                    ...res,
                    pages: fatia,
                    pageCount: totalDoc,
                    loadedPageStart: pageStart,
                    loadedPageEnd: pageStart + fatia.length - 1,
                    hasMorePages: pageStart + fatia.length - 1 < totalDoc,
                  };
                } else {
                  ehValido = false;
                }
              }
            } else if (isPdf) {
              // PDF servido pelo Connector na rede interna: o ticket expira (15 min)
              const expira = typeof res?.localUrlExpiresAt === 'string' ? Date.parse(res.localUrlExpiresAt) : NaN;
              const linkLocalValido = !!res?.localUrl && Number.isFinite(expira) && expira - Date.now() > 60_000;
              if (!res?.pdfDataUrl && !linkLocalValido) ehValido = false;
            }
          } else if (type === 'analyze_signatures') {
            if (res?.versao_motor !== 2) {
              ehValido = false;
            } else {
              const localInfo = await computeLocalFileSha256(rootId, relativePath);
              if (localInfo && res?.hash_sha256 !== localInfo.hashSha256) {
                ehValido = false;
              } else {
                resultadoFinal = await enrichAndNormalizeSignatureAuditForTenant(tenantId, res, {
                  rootId,
                  relativePath,
                });
              }
            }
          }
          if (ehValido) {
            return { id: row.id, status: 'complete', result: resultadoFinal, cached: true };
          }
          if (type === 'analyze_signatures') {
            await tx.$executeRaw`DELETE FROM "DocumentSearchRequest" WHERE id = ${row.id}`;
          }
        }
      }
    }

    // Se for analyze_signatures e o arquivo estiver acessível no disco local autorizado,
    // executa a auditoria criptográfica completa imediatamente e armazena o resultado atualizado.
    if (type === 'analyze_signatures' && rootId && relativePath) {
      const localAudited = await executeLocalPdfSignatureAudit(tenantId, rootId, relativePath);
      if (localAudited) {
        const id = randomUUID();
        await tx.$executeRaw`INSERT INTO "DocumentSearchRequest" (id, "tenantId", "userId", "connectorId", type, query, "rootId", "relativePath", "pageStart", "pageEnd", status, result, "expiresAt")
          VALUES (${id}, ${tenantId}, ${userId}, ${connectorId}, ${type}, ${query}, ${rootId}, ${relativePath}, NULL, NULL, 'complete', ${JSON.stringify(localAudited)}::jsonb, NOW() + INTERVAL '24 hours')`;
        return { id, status: 'complete', result: localAudited, cached: false };
      }
    }

    // Nunca cancela extrações de petição ou análises de assinatura em execução quando chega
    // leitura de bloco (chunk), listagem de diretório ou outro tipo de job do mesmo usuário.
    if (type !== 'read_document_chunk') {
      const active = await tx.$queryRaw<Array<{ id: string; type: string; status: string; query: string | null; rootId: string | null; relativePath: string | null; pageStart: number | null; pageEnd: number | null }>>`
        SELECT id, type, status, query, "rootId", "relativePath", "pageStart", "pageEnd" FROM "DocumentSearchRequest"
        WHERE "tenantId" = ${tenantId} AND "userId" = ${userId} AND type = ${type} AND status IN ('queued', 'running')
        ORDER BY "createdAt" DESC LIMIT 1
      `;
      if (active.length) {
        const a = active[0];
        if (
          a.type === type &&
          a.query === query &&
          a.rootId === rootId &&
          a.relativePath === relativePath &&
          a.pageStart === pageStart &&
          a.pageEnd === pageEnd
        ) {
          return { id: a.id, status: 'queued', cached: false };
        }
        if (a.status === 'queued' || type === 'search' || type === 'list_directory') {
          await tx.$executeRaw`DELETE FROM "DocumentSearchRequest" WHERE id = ${a.id}`;
        }
      }
    }
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "DocumentSearchRequest" (id, "tenantId", "userId", "connectorId", type, query, "rootId", "relativePath", "pageStart", "pageEnd", "expiresAt")
      VALUES (${id}, ${tenantId}, ${userId}, ${connectorId}, ${type}, ${query}, ${rootId}, ${relativePath}, ${pageStart}::int, ${pageEnd}::int, NOW() + INTERVAL '3 minutes')`;
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
  const job = rows[0] || null;
  // Blocos de transferência de PDF são descartados assim que entregues ao navegador para não ocupar espaço no banco
  if (job && job.type === 'read_document_chunk' && (job.status === 'complete' || job.status === 'failed')) {
    await prisma.$executeRaw`DELETE FROM "DocumentSearchRequest" WHERE id = ${id} AND "tenantId" = ${tenantId}`.catch(() => {});
  }
  if (job && job.type === 'analyze_signatures' && job.status === 'complete' && job.result) {
    const normalized = await enrichAndNormalizeSignatureAuditForTenant(tenantId, job.result, {
      rootId: job.rootId,
      relativePath: job.relativePath,
    });
    return {
      ...job,
      result: normalized as unknown as Prisma.JsonValue,
    };
  }
  return job;
}

export async function claimSearch(tenantId: string, connectorId: string) {
  await prisma.$executeRaw`DELETE FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId} AND "expiresAt" <= NOW()`;
  const rows = await prisma.$queryRaw<Array<{ id: string; type: string; query: string | null; rootId: string | null; relativePath: string | null; pageStart: number | null; pageEnd: number | null }>>`
    UPDATE "DocumentSearchRequest" SET status = 'running'
    WHERE id = (SELECT id FROM "DocumentSearchRequest" WHERE "tenantId" = ${tenantId}
      AND "connectorId" = ${connectorId} AND status = 'queued' AND "expiresAt" > NOW()
      ORDER BY
        CASE WHEN type IN ('read_document_text', 'read_document_chunk') THEN 0 ELSE 1 END ASC,
        "createdAt" ASC
      FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, type, query, "rootId", "relativePath", "pageStart", "pageEnd"`;
  return rows[0] || null;
}

export async function finishSearch(id: string, tenantId: string, connectorId: string, result: unknown, failed = false) {
  const ehChunkEfemero = Boolean(result && typeof result === 'object' && (result as Record<string, unknown>).isChunk === true);
  const expiracaoCurta = failed || ehChunkEfemero;
  return prisma.$executeRaw`UPDATE "DocumentSearchRequest" SET status = ${failed ? 'failed' : 'complete'},
    result = ${result === null ? null : JSON.stringify(result)}::jsonb,
    "expiresAt" = CASE WHEN ${expiracaoCurta}::boolean THEN NOW() + INTERVAL '2 minutes' ELSE NOW() + INTERVAL '24 hours' END
    WHERE id = ${id} AND "tenantId" = ${tenantId} AND "connectorId" = ${connectorId}
      AND status = 'running' AND "expiresAt" > NOW()`;
}

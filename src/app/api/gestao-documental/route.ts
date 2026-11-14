import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';
import { documentJobInput } from '@/lib/documental/contracts';
import { isSameOriginRequest } from '@/lib/documental/origin';
import { createJob, readSearch } from '@/lib/documental/store';
import {
  isSignedStorageDocumentalEnabled,
  STORAGE_MIN_CONNECTOR_VERSION,
} from '@/lib/documental/ephemeral-storage';
import {
  compareConnectorSemver,
  listTenantConnectorNodes,
  resolveEffectiveDocumentConnector,
} from '@/lib/connector/ha-manager';

export const dynamic = 'force-dynamic';

const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });

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

    const haNodes = await listTenantConnectorNodes(user.tenantId);
    const nowMs = Date.now();
    const isOnline = (n: { lastSeenAt: Date | null }) =>
      Boolean(n.lastSeenAt && nowMs - new Date(n.lastSeenAt).getTime() <= 120_000);

    // Exibe para todos os usuários da Gestão Documental apenas o único Connector efetivamente ATIVO
    // (servidores secundários em STANDBY/PAUSED ficam restritos à Central de Operações).
    const activeOnline = haNodes.find((n) => n.operationalState === 'ACTIVE' && isOnline(n));
    const activeAny = haNodes.find((n) => n.operationalState === 'ACTIVE');
    const fallbackOnline = haNodes.find((n) => n.operationalState !== 'PAUSED' && isOnline(n));
    const effectiveNode = activeOnline ?? activeAny ?? fallbackOnline ?? haNodes[0] ?? null;

    const connectors = effectiveNode
      ? [
          {
            id: effectiveNode.connectorId,
            name: effectiveNode.name,
            lastSeenAt: effectiveNode.lastSeenAt,
            role: effectiveNode.role,
            operationalState: effectiveNode.operationalState,
            lanUrl: effectiveNode.lanUrl,
            isPrimaryActive: effectiveNode.operationalState === 'ACTIVE',
          },
        ]
      : [];

    return reply({ connectors });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    // Browser never receives a Connector credential.
    if (!isSameOriginRequest(req)) return reply({ error: 'Origem inválida.' }, 403);
    const user = await requireDocumentAccess();
    const raw = await req.text();
    if (raw.length > 4096) return reply({ error: 'Requisição inválida.' }, 400);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: 'Requisição inválida.' }, 400);
    }
    const parsed = documentJobInput.safeParse(body);
    if (!parsed.success) return reply({ error: 'Parâmetros de requisição inválidos.' }, 400);
    const jobData = parsed.data;

    // Roteia automaticamente para o Connector ATIVO e online do cartório
    const effective = await resolveEffectiveDocumentConnector(user.tenantId, jobData.connectorId);
    if (!effective) {
      return reply({ error: 'Nenhum servidor Connector ATIVO com sinal recente disponível.' }, 409);
    }

    const targetConnectorId = effective.connectorId;

    let jobResult: any = null;
    if (jobData.type === 'list_directory') {
      // Sem cache no servidor: a listagem precisa refletir o disco no momento da navegação
      jobResult = await createJob(user.tenantId, user.id, targetConnectorId, {
        type: 'list_directory',
        rootId: jobData.rootId,
        relativePath: jobData.relativePath,
      });
    } else if (jobData.type === 'read_document_chunk') {
      jobResult = await createJob(user.tenantId, user.id, targetConnectorId, {
        type: 'read_document_chunk',
        rootId: jobData.rootId,
        relativePath: jobData.relativePath,
        pageStart: jobData.offset,
        pageEnd: jobData.length ?? 2097152,
        forceFresh: true,
      });
    } else if (
      jobData.type === 'extract_petition' ||
      jobData.type === 'analyze_signatures' ||
      jobData.type === 'read_document_text'
    ) {
      jobResult = await createJob(user.tenantId, user.id, targetConnectorId, {
        type: jobData.type,
        rootId: jobData.rootId,
        relativePath: jobData.relativePath,
        pageStart:
          jobData.type === 'extract_petition' || jobData.type === 'read_document_text'
            ? jobData.pageStart
            : undefined,
        pageEnd:
          jobData.type === 'extract_petition' || jobData.type === 'read_document_text'
            ? jobData.pageEnd
            : undefined,
        forceFresh: jobData.forceFresh,
      });
    } else if (jobData.type === 'stage_document_file') {
      const connectorSupportsStorage = Boolean(
        effective.version && compareConnectorSemver(effective.version, STORAGE_MIN_CONNECTOR_VERSION) >= 0,
      );
      if (!isSignedStorageDocumentalEnabled() || !connectorSupportsStorage) {
        return reply({
          id: 'fallback-chunk',
          status: 'complete',
          cached: false,
          result: { fallbackToChunk: true },
        });
      }
      jobResult = await createJob(user.tenantId, user.id, targetConnectorId, {
        type: 'stage_document_file',
        rootId: jobData.rootId,
        relativePath: jobData.relativePath,
      });
    } else {
      jobResult = await createJob(user.tenantId, user.id, targetConnectorId, {
        type: 'search',
        query: jobData.query,
        forceFresh: jobData.forceFresh,
      });
    }
    if (!jobResult) return reply({ error: 'Aguarde a operação anterior terminar ou expirar.' }, 429);

    if (typeof jobResult === 'string') {
      return reply({ id: jobResult, connectorId: targetConnectorId }, 202);
    }

    if (jobResult.status === 'complete') {
      return reply(
        {
          id: jobResult.id,
          status: 'complete',
          result: jobResult.result,
          cached: true,
          connectorId: targetConnectorId,
        },
        200,
      );
    }

    return reply({ id: jobResult.id, status: 'queued', connectorId: targetConnectorId }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}

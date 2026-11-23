import { resolveEffectiveDocumentConnector } from '@/lib/connector/ha-manager';
import { createJob, readSearch } from '@/lib/documental/store';
import { sincronizarReurbBatch, type ReurbIncomingRecord } from './connector-sync';
import { carregarRegularizacoesPorIds } from './query-service';
import type { ReurbRegularizacaoDTO } from './types';

interface RevalidarJobResult {
  sucesso?: boolean;
  revalidadoEm?: string;
  ocrConsultado?: boolean;
  ocrErro?: string | null;
  registros?: ReurbIncomingRecord[];
  erro?: string | null;
  error?: string | null;
}

export interface RevalidationOutcome {
  ok: boolean;
  statusHttp: number;
  connectorId: string | null;
  ocrConsultado: boolean;
  revalidadoEm: string | null;
  registros: ReurbRegularizacaoDTO[];
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function revalidarRegistrosNoConnector(params: {
  tenantId: string;
  userId: string;
  registros: ReurbRegularizacaoDTO[];
  demoMode?: boolean;
  maxWaitMs?: number;
  pollIntervalMs?: number;
}): Promise<RevalidationOutcome> {
  const { tenantId, userId, registros, demoMode = false } = params;
  if (registros.length === 0) {
    return {
      ok: true,
      statusHttp: 200,
      connectorId: null,
      ocrConsultado: false,
      revalidadoEm: new Date().toISOString(),
      registros: [],
    };
  }

  // Modo demonstração controlado (apenas fora de produção com REURB_DEMO_MODE=true)
  if (demoMode && registros.every((r) => r.id.startsWith('demo-reurb-'))) {
    return {
      ok: true,
      statusHttp: 200,
      connectorId: 'demo-local',
      ocrConsultado: true,
      revalidadoEm: new Date().toISOString(),
      registros,
    };
  }

  const effective = await resolveEffectiveDocumentConnector(tenantId);
  if (!effective) {
    return {
      ok: false,
      statusHttp: 503,
      connectorId: null,
      ocrConsultado: false,
      revalidadoEm: null,
      registros: [],
      error:
        'Geração bloqueada: nenhum Connector ATIVO online disponível para revalidação obrigatória no SRVSQL\\WEBRI e SRVSIPLANIA.',
    };
  }

  const prenotacoes = [...new Set(registros.map((r) => r.prenotacao).filter((n) => n > 0))];
  const created = await createJob(tenantId, userId, effective.connectorId, {
    type: 'reurb_revalidar',
    query: JSON.stringify({ prenotacoes }),
    forceFresh: true,
  });

  if (!created) {
    return {
      ok: false,
      statusHttp: 503,
      connectorId: effective.connectorId,
      ocrConsultado: false,
      revalidadoEm: null,
      registros: [],
      error:
        'Não foi possível enfileirar a revalidação REURB no Connector (fila ocupada ou rate-limit).',
    };
  }

  // Em createJob(), string representa o ID da tarefa recém-enfileirada
  const jobId = typeof created === 'string' ? created : created.id;
  if (!jobId) {
    return {
      ok: false,
      statusHttp: 503,
      connectorId: effective.connectorId,
      ocrConsultado: false,
      revalidadoEm: null,
      registros: [],
      error: 'Identificador da tarefa de revalidação REURB não retornado.',
    };
  }

  const maxWaitMs = params.maxWaitMs ?? 45_000;
  const pollIntervalMs = params.pollIntervalMs ?? 500;
  const startedAt = Date.now();

  let currentStatus: 'queued' | 'running' | 'complete' | 'failed' =
    typeof created === 'string' ? 'queued' : created.status;
  let currentResult: unknown = typeof created === 'string' ? null : (created.result ?? null);

  while (currentStatus !== 'complete' && currentStatus !== 'failed') {
    if (Date.now() - startedAt >= maxWaitMs) {
      return {
        ok: false,
        statusHttp: 504,
        connectorId: effective.connectorId,
        ocrConsultado: false,
        revalidadoEm: null,
        registros: [],
        error: 'Tempo limite excedido aguardando revalidação ao vivo no SRVSQL\\WEBRI e SRVSIPLANIA.',
      };
    }
    await sleep(pollIntervalMs);
    const fetched = await readSearch(jobId, tenantId, userId);
    if (!fetched) {
      return {
        ok: false,
        statusHttp: 503,
        connectorId: effective.connectorId,
        ocrConsultado: false,
        revalidadoEm: null,
        registros: [],
        error: 'Tarefa de revalidação REURB expirou ou foi descartada durante a execução.',
      };
    }
    currentStatus = fetched.status;
    currentResult = fetched.result;
  }

  if (currentStatus === 'failed') {
    const failedPayload = (currentResult || {}) as RevalidarJobResult;
    return {
      ok: false,
      statusHttp: 503,
      connectorId: effective.connectorId,
      ocrConsultado: false,
      revalidadoEm: null,
      registros: [],
      error:
        failedPayload.error ||
        failedPayload.erro ||
        'Falha reportada pelo Connector ao revalidar os dados da REURB.',
    };
  }

  const payload = (currentResult || {}) as RevalidarJobResult;
  if (!payload.sucesso || !Array.isArray(payload.registros)) {
    return {
      ok: false,
      statusHttp: 503,
      connectorId: effective.connectorId,
      ocrConsultado: Boolean(payload.ocrConsultado),
      revalidadoEm: payload.revalidadoEm || null,
      registros: [],
      error: payload.erro || 'Revalidação REURB retornou resposta incompleta do Connector.',
    };
  }

  if (!payload.ocrConsultado) {
    return {
      ok: false,
      statusHttp: 503,
      connectorId: effective.connectorId,
      ocrConsultado: false,
      revalidadoEm: payload.revalidadoEm || null,
      registros: [],
      error:
        'Revalidação bloqueada: o Connector não conseguiu consultar o OCR no SRVSIPLANIA' +
        (payload.ocrErro ? ` (${payload.ocrErro})` : '') +
        '. Os registros existentes foram preservados.',
    };
  }

  await sincronizarReurbBatch(tenantId, payload.registros);
  const { registros: updated } = await carregarRegularizacoesPorIds(
    tenantId,
    registros.map((r) => r.id)
  );

  return {
    ok: true,
    statusHttp: 200,
    connectorId: effective.connectorId,
    ocrConsultado: Boolean(payload.ocrConsultado),
    revalidadoEm: payload.revalidadoEm || new Date().toISOString(),
    registros: updated,
  };
}

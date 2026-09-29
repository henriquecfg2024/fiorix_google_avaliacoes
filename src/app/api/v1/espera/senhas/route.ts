import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { decryptConfig } from '@/lib/integration-crypto';

export const dynamic = 'force-dynamic';

/**
 * API de Gestão de Espera — proxy seguro para a API NextQS.
 *
 * Endpoints NextQS usados (documentação oficial Postman):
 *   GET /v1/organization/check                         — verificação de credenciais
 *   GET /v1/organization/reports/service/queue/:site_id — fila atual
 *   GET /v1/organization/reports/service/opened/:site_id — serviços abertos
 *
 * Campos do ticket NextQS mapeados:
 *   ticket              → Senha  (ex: "P0102")
 *   ticket_label / queue_label → Serviço / Fila
 *   service_desk_label  → Guichê
 *   service_desk_number → Número do guichê
 *   user_label          → Atendente
 *   ticket_generated_at → Emissão
 *   ticket_first_call_at → Chamada
 *   status              → Situação (1=Chamado, 2=Em atendimento, 3=Finalizado, etc.)
 */

// NextQS status codes (da documentação)
const STATUS_MAP: Record<string, string> = {
  '1': 'Chamado',
  '2': 'Em atendimento',
  '3': 'Finalizado',
  '4': 'Desistência',
  '5': 'Cancelado',
};

interface NextQSTicket {
  ticket?: string;
  ticket_label?: string;
  ticket_number?: number;
  ticket_alpha?: string;
  queue_id?: string;
  queue_label?: string;
  queue_hex_color?: string;
  queue_waiting_max_time?: number;
  service_desk_id?: string;
  service_desk_label?: string;
  service_desk_number?: number;
  user_id?: string;
  user_label?: string;
  ticket_customer_name?: string;
  ticket_generated_at?: string;
  ticket_first_call_at?: string;
  ticket_last_call_at?: string;
  service_started_at?: string;
  service_ended_at?: string;
  service_origin_id?: string;
  status?: string;
  is_noshow_at?: string;
  is_directcall?: boolean;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Normaliza um ticket da API NextQS para o formato FIORIX.
 * Preserva os valores originais — nunca inventa nem traduz.
 */
function normalizeTicket(raw: NextQSTicket, index: number) {
  const senha = raw.ticket || (raw.ticket_alpha && raw.ticket_number ? `${raw.ticket_alpha}${String(raw.ticket_number).padStart(4, '0')}` : '—');
  const servico = raw.ticket_label || raw.queue_label || '—';
  const fila = raw.queue_label || '—';
  const guiche = raw.service_desk_label
    ? (raw.service_desk_number ? `${raw.service_desk_label} ${raw.service_desk_number}` : raw.service_desk_label)
    : '—';
  const atendente = raw.user_label || '—';
  const statusCode = raw.status || '';
  const situacao = STATUS_MAP[statusCode] || statusCode || '—';

  // Horários
  const emissao = formatTime(raw.ticket_generated_at);
  const chamada = formatTime(raw.ticket_first_call_at);

  // Tempo de espera = chamada - emissão (calculado, não mockado)
  let tempoEsperaMin: number | null = null;
  if (raw.ticket_generated_at && raw.ticket_first_call_at) {
    const emissaoMs = safeParseDate(raw.ticket_generated_at);
    const chamadaMs = safeParseDate(raw.ticket_first_call_at);
    if (emissaoMs && chamadaMs && chamadaMs > emissaoMs) {
      tempoEsperaMin = Math.round((chamadaMs - emissaoMs) / 60000);
    }
  }

  return {
    id: raw.service_origin_id || `nqs-${index}`,
    senha,
    servico,
    fila,
    emissao,
    chamada,
    tempoEsperaMin,
    guiche,
    atendente,
    situacao,
  };
}

function safeParseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch {
    return null;
  }
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return value;
      return '—';
    }
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return '—';
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole('MASTER', 'ADMIN', 'SUBSTITUTO');
    const tenantId = user.tenantId;

    // 1. Buscar configuração NextQS do tenant
    const config = await prisma.integrationConfig.findFirst({
      where: { tenantId, integrationId: 'nextqs', isActive: true },
    });

    if (!config || !config.encryptedConfig || !config.configIv) {
      return NextResponse.json({
        configured: false,
        records: [],
        slaMinutes: 15,
        lastSyncAt: null,
        error: 'Integração NextQS não configurada para esta organização.',
      });
    }

    // 2. Decriptografar credenciais (server-side only)
    let decryptedConfig: Record<string, unknown>;
    try {
      decryptedConfig = decryptConfig(config.encryptedConfig, config.configIv);
    } catch (err) {
      console.error('[Espera API] Erro ao decriptografar credenciais NextQS:', (err as Error).message);
      return NextResponse.json({
        configured: true, records: [], slaMinutes: config.slaMinutes,
        lastSyncAt: config.lastSyncAt?.toISOString() || null,
        error: 'Erro ao acessar credenciais da integração. Verifique a configuração.',
      });
    }

    const apiUrl = (decryptedConfig.apiUrl as string)?.replace(/\/$/, '') || '';
    const apiKey = (decryptedConfig.apiKey as string) || '';
    const orgId = (decryptedConfig.orgId as string) || ''; // orgId = site_id no NextQS

    if (!apiUrl || !apiKey) {
      return NextResponse.json({
        configured: true, records: [], slaMinutes: config.slaMinutes,
        lastSyncAt: config.lastSyncAt?.toISOString() || null,
        error: 'URL ou token da API NextQS não configurados.',
      });
    }

    // 3. Montar base URL (normalizar: aceitar api.nextqs.com.br ou api.nextqs.com)
    // A URL base da API NextQS pode ser: https://api.nextqs.com/v1 ou https://api.nextqs.com
    // Removemos /v1 do final para construir os endpoints
    const baseUrl = apiUrl.replace(/\/v1\/?$/, '');

    // 4. Headers de autenticação (nunca expostos ao frontend)
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // 5. Endpoint: fila atual (queue) + serviços abertos (opened)
    //    GET /v1/organization/reports/service/queue/:site_id     — tickets na fila
    //    GET /v1/organization/reports/service/opened/:site_id    — serviços em andamento
    let allTickets: NextQSTicket[] = [];
    let fetchError: string | null = null;

    const endpoints: string[] = [];
    if (orgId) {
      endpoints.push(`${baseUrl}/v1/organization/reports/service/queue/${orgId}`);
      endpoints.push(`${baseUrl}/v1/organization/reports/service/opened/${orgId}?limit=200&page=1`);
    } else {
      // Se não tem orgId/site_id, tentar o check para validar e informar
      endpoints.push(`${baseUrl}/v1/organization/check`);
    }

    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(endpoint, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const statusCode = response.status;
          if (statusCode === 401 || statusCode === 403) {
            fetchError = 'Token de API NextQS inválido ou expirado.';
            break;
          }
          console.warn(`[Espera API] NextQS ${endpoint} → ${statusCode}`);
          continue;
        }

        const body = await response.json();

        if (Array.isArray(body)) {
          allTickets = allTickets.concat(body);
        } else if (body && body.check === true) {
          // Resposta do /check — credenciais OK mas sem site_id
          if (!orgId) {
            fetchError = 'Credenciais válidas, mas o Identificador da Unidade (site_id) não está configurado. Configure-o em Parâmetros > Integrações.';
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          fetchError = 'Timeout ao conectar à API NextQS (>15s).';
        } else {
          console.error('[Espera API] Erro ao consultar NextQS:', err.message);
          fetchError = 'Não foi possível conectar à API NextQS. Verifique a URL e as credenciais.';
        }
        break;
      }
    }

    // 6. Normalizar tickets
    const normalized = allTickets.map((t, i) => normalizeTicket(t, i));

    // Log server-side para diagnóstico de campos ausentes
    if (normalized.length > 0) {
      const sample = normalized[0];
      const missingFields: string[] = [];
      if (sample.servico === '—') missingFields.push('servico (ticket_label/queue_label)');
      if (sample.fila === '—') missingFields.push('fila (queue_label)');
      if (sample.guiche === '—') missingFields.push('guiche (service_desk_label)');
      if (sample.atendente === '—') missingFields.push('atendente (user_label)');
      if (sample.emissao === '—') missingFields.push('emissao (ticket_generated_at)');
      if (sample.chamada === '—') missingFields.push('chamada (ticket_first_call_at)');
      if (missingFields.length > 0) {
        console.warn(`[Espera API] Campos ausentes no payload NextQS: ${missingFields.join(', ')}`);
      }
    }

    // 7. Atualizar lastSyncAt
    if (!fetchError && normalized.length > 0) {
      await prisma.integrationConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: new Date() },
      }).catch(() => {});
    }

    return NextResponse.json({
      configured: true,
      records: normalized,
      slaMinutes: config.slaMinutes,
      lastSyncAt: new Date().toISOString(),
      total: normalized.length,
      error: fetchError,
    });
  } catch (err: any) {
    if (err.message?.includes('Acesso negado') || err.message?.includes('Não autorizado')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    console.error('[Espera API] Erro interno:', err.message);
    return NextResponse.json({
      configured: false, records: [], slaMinutes: 15, lastSyncAt: null,
      error: 'Erro interno ao carregar dados de espera.',
    }, { status: 500 });
  }
}

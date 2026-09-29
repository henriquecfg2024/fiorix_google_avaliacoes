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
  const statusCode = raw.status !== undefined && raw.status !== null ? String(raw.status) : '';
  const situacao = STATUS_MAP[statusCode] || statusCode || '—';

  // Horários (suporta ticket_generated_at ou created_at)
  const rawEmissao = raw.ticket_generated_at || (raw as any).created_at;
  const rawChamada = raw.ticket_first_call_at || (raw as any).service_started_at;

  const emissao = formatTime(rawEmissao);
  const chamada = formatTime(rawChamada);

  // Tempo de espera = chamada - emissão (calculado, não mockado)
  let tempoEsperaMin: number | null = null;
  if (rawEmissao && rawChamada) {
    const emissaoMs = safeParseDate(rawEmissao);
    const chamadaMs = safeParseDate(rawChamada);
    if (emissaoMs && chamadaMs && chamadaMs > emissaoMs) {
      tempoEsperaMin = Math.round((chamadaMs - emissaoMs) / 60000);
    }
  }

  return {
    id: raw.service_origin_id || (raw as any)._id || (raw as any).origin_id || `nqs-${index}`,
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

/**
 * Constrói o intervalo de datas no padrão ISO 8601 exigido pela API NextQS:
 * YYYY-MM-DDThh:mm:ssTZD (ex: 2026-09-29T00:00:00-03:00)
 */
function getDateRange(periodo: string) {
  const now = new Date();
  const tzOffset = '-03:00';
  const spDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // "YYYY-MM-DD"
  const endIso = `${spDateStr}T23:59:59${tzOffset}`;

  let startIso: string;

  if (periodo === 'mes') {
    const [year, month] = spDateStr.split('-');
    startIso = `${year}-${month}-01T00:00:00${tzOffset}`;
  } else if (periodo === '7d') {
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pastStr = past.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    startIso = `${pastStr}T00:00:00${tzOffset}`;
  } else {
    // 'hoje'
    startIso = `${spDateStr}T00:00:00${tzOffset}`;
  }

  return { startIso, endIso };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole('MASTER', 'ADMIN', 'SUBSTITUTO');
    const tenantId = user.tenantId;

    const periodo = req.nextUrl.searchParams.get('periodo') || 'hoje';

    // 1. Buscar configuração NextQS do tenant
    const config = await prisma.integrationConfig.findFirst({
      where: { tenantId, integrationId: 'nextqs' },
    });

    if (!config || !config.encryptedConfig || !config.configIv || config.status === 'DISCONNECTED') {
      return NextResponse.json({
        configured: false,
        records: [],
        slaMinutes: 15,
        lastSyncAt: null,
        error: 'Integração NextQS não configurada para esta organização.',
      });
    }

    // Auto-heal: se possuir credenciais válidas e não estiver ativo, garantir isActive: true
    if (!config.isActive) {
      await prisma.integrationConfig.update({
        where: { id: config.id },
        data: { isActive: true },
      }).catch(() => null);
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
    const orgId = (decryptedConfig.orgId as string) || ''; // Identificador fornecido pelo usuário

    if (!apiUrl || !apiKey) {
      return NextResponse.json({
        configured: true, records: [], slaMinutes: config.slaMinutes,
        lastSyncAt: config.lastSyncAt?.toISOString() || null,
        error: 'URL ou token da API NextQS não configurados.',
      });
    }

    // 3. Montar base URL (normalizar: aceitar api.nextqs.com.br ou api.nextqs.com)
    const baseUrl = apiUrl.replace(/\/v1\/?$/, '');

    // 4. Headers de autenticação (nunca expostos ao frontend)
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // 5. Resolver o site_id real da organização no NextQS
    //    Geralmente o usuário preenche um código ou sigla interna (ex: EJ387N),
    //    enquanto o NextQS trabalha com ObjectIDs MongoDB (24 caracteres hexadecimais).
    //    Consultamos /v1/organization/sites para mapear o site_id real da conta.
    let resolvedSiteId = orgId;
    let siteLabel = '';

    try {
      const sitesRes = await fetch(`${baseUrl}/v1/organization/sites`, {
        method: 'GET',
        headers,
      });

      if (sitesRes.ok) {
        const sitesData = await sitesRes.json();
        if (Array.isArray(sitesData) && sitesData.length > 0) {
          console.log(`[Espera API] Sites encontrados no NextQS (${sitesData.length}):`, sitesData.map((s: any) => `${s.label} (${s._id})`).join(', '));
          
          const matched = sitesData.find((s: any) => 
            s._id === orgId || 
            (s.label && s.label.toLowerCase() === orgId.toLowerCase()) ||
            (s.label && s.label.toLowerCase().includes(orgId.toLowerCase()))
          );

          if (matched) {
            resolvedSiteId = matched._id;
            siteLabel = matched.label;
          } else if (sitesData.length === 1 || !/^[0-9a-fA-F]{24}$/.test(orgId)) {
            // Se orgId não é um ObjectId de 24 hex ou existe apenas 1 unidade, usa a primeira
            resolvedSiteId = sitesData[0]._id;
            siteLabel = sitesData[0].label;
            console.log(`[Espera API] Mapeado identificador "${orgId}" para o site_id real: "${resolvedSiteId}" (${siteLabel})`);
          }
        }
      } else {
        const errText = await sitesRes.text().catch(() => '');
        console.warn(`[Espera API] /v1/organization/sites status ${sitesRes.status}: ${errText.slice(0, 100)}`);
      }
    } catch (err: any) {
      console.warn('[Espera API] Não foi possível consultar /v1/organization/sites:', err.message);
    }

    // 6. Montar endpoints para buscar os dados:
    //    A) Fila atual (tickets aguardando atendimento)
    //    B) Atendimentos em andamento / chamados
    //    C) Histórico de senhas emitidas e finalizadas no período selecionado
    let allTickets: NextQSTicket[] = [];
    let fetchError: string | null = null;

    const { startIso, endIso } = getDateRange(periodo);
    const endpointsToFetch: Array<{ name: string; url: string }> = [];

    // Se temos um site_id válido de 24 caracteres hexadecimais
    if (resolvedSiteId && /^[0-9a-fA-F]{24}$/.test(resolvedSiteId)) {
      endpointsToFetch.push({
        name: 'queue',
        url: `${baseUrl}/v1/organization/reports/service/queue/${resolvedSiteId}`,
      });
      endpointsToFetch.push({
        name: 'opened',
        url: `${baseUrl}/v1/organization/reports/service/opened/${resolvedSiteId}?limit=200&page=1`,
      });
    }

    // Histórico de senhas do período (concluídas, emitidas, chamadas)
    endpointsToFetch.push({
      name: 'reports',
      url: `${baseUrl}/v1/organization/reports?start_datetime=${encodeURIComponent(startIso)}&end_datetime=${encodeURIComponent(endIso)}&limit=500&page=1`,
    });

    console.log(`[Espera API] Consultando NextQS: baseUrl=${baseUrl}, resolvedSiteId=${resolvedSiteId || '(vazio)'}, periodo=${periodo}, endpoints=${endpointsToFetch.map(e => e.name).join(', ')}`);

    for (const ep of endpointsToFetch) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(ep.url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const statusCode = response.status;
          const errText = await response.text().catch(() => '');
          console.warn(`[Espera API] NextQS [${ep.name}] ${statusCode}: ${errText.slice(0, 150)}`);

          if (statusCode === 401 || statusCode === 403) {
            fetchError = 'Token de API NextQS inválido ou expirado.';
            break;
          }
          continue;
        }

        const body = await response.json();
        let list: NextQSTicket[] = [];

        if (Array.isArray(body)) {
          list = body;
        } else if (body && Array.isArray(body.data)) {
          list = body.data;
        } else if (body && Array.isArray(body.reports)) {
          list = body.reports;
        } else if (body && Array.isArray(body.services)) {
          list = body.services;
        }

        console.log(`[Espera API] NextQS [${ep.name}] retornou ${list.length} itens`);
        if (list.length > 0) {
          allTickets = allTickets.concat(list);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.warn(`[Espera API] Timeout no endpoint [${ep.name}]`);
        } else {
          console.error(`[Espera API] Erro ao consultar NextQS [${ep.name}]:`, err.message);
        }
      }
    }

    // 7. Deduplicar tickets
    const seenKeys = new Set<string>();
    const uniqueTickets: NextQSTicket[] = [];

    for (const t of allTickets) {
      const rawDate = t.ticket_generated_at || (t as any).created_at || '';
      const uniqueId = t.service_origin_id || (t as any)._id || (t as any).origin_id || (t.ticket ? `${t.ticket}-${rawDate}` : null);
      if (uniqueId) {
        if (seenKeys.has(uniqueId)) continue;
        seenKeys.add(uniqueId);
      }
      uniqueTickets.push(t);
    }

    // 8. Normalizar tickets
    const normalized = uniqueTickets.map((t, i) => normalizeTicket(t, i));

    // Ordenar tickets por horário de emissão decrescente (mais recentes primeiro)
    normalized.sort((a, b) => {
      const timeA = a.emissao !== '—' ? a.emissao : '';
      const timeB = b.emissao !== '—' ? b.emissao : '';
      return timeB.localeCompare(timeA);
    });

    // 9. Atualizar lastSyncAt se houver tickets
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
      siteLabel: siteLabel || undefined,
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

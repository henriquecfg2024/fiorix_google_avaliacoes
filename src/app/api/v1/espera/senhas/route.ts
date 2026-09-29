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
  const inicioAtendimento = formatTime(raw.service_started_at);
  const fimAtendimento = formatTime(raw.service_ended_at);

  // Tempo de espera = chamada - emissão
  let tempoEsperaMin: number | null = null;
  if (rawEmissao && rawChamada) {
    const emissaoMs = safeParseDate(rawEmissao);
    const chamadaMs = safeParseDate(rawChamada);
    if (emissaoMs && chamadaMs && chamadaMs > emissaoMs) {
      tempoEsperaMin = Math.round((chamadaMs - emissaoMs) / 60000);
    }
  }

  // Tempo de atendimento = fim - início
  let tempoAtendimentoMin: number | null = null;
  if (raw.service_started_at && raw.service_ended_at) {
    const inicioMs = safeParseDate(raw.service_started_at);
    const fimMs = safeParseDate(raw.service_ended_at);
    if (inicioMs && fimMs && fimMs >= inicioMs) {
      tempoAtendimentoMin = Math.round((fimMs - inicioMs) / 60000);
    }
  }

  const cliente = raw.ticket_customer_name || '—';
  const avaliacao = (raw as any).service_rating_label || ((raw as any).service_rating_id ? `Nota ${(raw as any).service_rating_id}` : '—');

  return {
    id: raw.service_origin_id || (raw as any)._id || (raw as any).origin_id || `nqs-${index}`,
    senha,
    servico,
    fila,
    emissao,
    chamada,
    inicioAtendimento,
    fimAtendimento,
    tempoEsperaMin,
    tempoAtendimentoMin,
    guiche,
    atendente,
    cliente,
    avaliacao,
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

    // 3. Montar base URL
    const baseUrl = apiUrl.replace(/\/v1\/?$/, '');

    // 4. Headers de autenticação (nunca expostos ao frontend)
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // 5. Resolver o site_id real da organização no NextQS via /v1/organization/sites
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

    // 6. Consultas paralelas: Fila ao vivo, Serviços abertos, Histórico de relatórios, Suspensões e Agendamentos
    const { startIso, endIso } = getDateRange(periodo);
    let fetchError: string | null = null;

    let rawQueueTickets: NextQSTicket[] = [];
    let rawOpenedTickets: NextQSTicket[] = [];
    let rawReportTickets: NextQSTicket[] = [];
    let rawSuspensions: any[] = [];
    let rawBookings: any[] = [];

    // Helper para fetch seguro com timeout
    const fetchSafe = async (url: string, logName: string) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            fetchError = 'Token de API NextQS inválido ou expirado.';
          }
          return null;
        }
        return await res.json();
      } catch (err: any) {
        console.warn(`[Espera API] Falha no endpoint [${logName}]:`, err.message);
        return null;
      }
    };

    const hasValidSite = resolvedSiteId && /^[0-9a-fA-F]{24}$/.test(resolvedSiteId);

    // Executar chamadas em paralelo
    const [queueData, openedData, reportsData, suspensionsData, bookingsData] = await Promise.all([
      hasValidSite ? fetchSafe(`${baseUrl}/v1/organization/reports/service/queue/${resolvedSiteId}`, 'queue') : Promise.resolve(null),
      hasValidSite ? fetchSafe(`${baseUrl}/v1/organization/reports/service/opened/${resolvedSiteId}?limit=200&page=1`, 'opened') : Promise.resolve(null),
      fetchSafe(`${baseUrl}/v1/organization/reports?start_datetime=${encodeURIComponent(startIso)}&end_datetime=${encodeURIComponent(endIso)}&limit=500&page=1`, 'reports'),
      fetchSafe(`${baseUrl}/v1/organization/reports/suspension?start_datetime=${encodeURIComponent(startIso)}&end_datetime=${encodeURIComponent(endIso)}&limit=200&page=1`, 'suspension'),
      fetchSafe(`${baseUrl}/v1/organization/schedules/bookings?limit=100&page=1`, 'schedules'),
    ]);

    const extractArray = (data: any): any[] => {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
      if (data && Array.isArray(data.reports)) return data.reports;
      if (data && Array.isArray(data.services)) return data.services;
      return [];
    };

    rawQueueTickets = extractArray(queueData);
    rawOpenedTickets = extractArray(openedData);
    rawReportTickets = extractArray(reportsData);
    rawSuspensions = extractArray(suspensionsData);
    rawBookings = extractArray(bookingsData);

    console.log(`[Espera API] Retornos NextQS: Fila=${rawQueueTickets.length}, Abertos=${rawOpenedTickets.length}, Relatório=${rawReportTickets.length}, Pausas=${rawSuspensions.length}, Agendamentos=${rawBookings.length}`);

    // 7. Unificar e deduplicar todos os tickets
    const seenKeys = new Set<string>();
    const allCombinedTickets: NextQSTicket[] = [];

    // Prioridade de inclusão: abertos / fila atual > relatórios
    for (const t of [...rawOpenedTickets, ...rawQueueTickets, ...rawReportTickets]) {
      const rawDate = t.ticket_generated_at || (t as any).created_at || '';
      const uniqueId = t.service_origin_id || (t as any)._id || (t as any).origin_id || (t.ticket ? `${t.ticket}-${rawDate}` : null);
      if (uniqueId) {
        if (seenKeys.has(uniqueId)) continue;
        seenKeys.add(uniqueId);
      }
      allCombinedTickets.push(t);
    }

    // 8. Normalizar registros principais
    const normalized = allCombinedTickets.map((t, i) => normalizeTicket(t, i));
    normalized.sort((a, b) => {
      const timeA = a.emissao !== '—' ? a.emissao : '';
      const timeB = b.emissao !== '—' ? b.emissao : '';
      return timeB.localeCompare(timeA);
    });

    const realtimeQueueNormalized = rawQueueTickets.map((t, i) => normalizeTicket(t, i));
    const realtimeOpenedNormalized = rawOpenedTickets.map((t, i) => normalizeTicket(t, i));

    // 9. Computar Métricas Executivas (KPIs idênticos ao NextQS Manager)
    const totalSenhas = normalized.length;
    const atendidos = normalized.filter(r => r.situacao !== 'Desistência' && r.situacao !== 'Cancelado');
    const desistencias = normalized.filter(r => r.situacao === 'Desistência' || r.situacao === 'Cancelado');
    const comEspera = normalized.filter(r => r.tempoEsperaMin !== null);
    const dentroSlaEspera = comEspera.filter(r => (r.tempoEsperaMin ?? 0) <= config.slaMinutes);
    const comAtendimento = normalized.filter(r => r.tempoAtendimentoMin !== null);
    const dentroSlaAtendimento = comAtendimento.filter(r => (r.tempoAtendimentoMin ?? 0) <= 15);

    const mediaEsperaMin = comEspera.length > 0 ? Math.round(comEspera.reduce((acc, r) => acc + (r.tempoEsperaMin ?? 0), 0) / comEspera.length) : 0;
    const mediaAtendimentoMin = comAtendimento.length > 0 ? Math.round(comAtendimento.reduce((acc, r) => acc + (r.tempoAtendimentoMin ?? 0), 0) / comAtendimento.length) : 0;
    const slaEsperaPerc = comEspera.length > 0 ? Math.round((dentroSlaEspera.length / comEspera.length) * 100) : 100;
    const slaAtendimentoPerc = comAtendimento.length > 0 ? Math.round((dentroSlaAtendimento.length / comAtendimento.length) * 100) : 100;
    
    // SLA Geral = média ponderada de Espera (60%) e Atendimento (40%)
    const slaGeralPerc = Math.round((slaEsperaPerc * 0.6) + (slaAtendimentoPerc * 0.4));

    // CSAT
    const avaliacoes = normalized.map(r => {
      if (!r.avaliacao || r.avaliacao === '—') return null;
      const num = parseFloat(r.avaliacao.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? null : num;
    }).filter((n): n is number => n !== null);
    const csatMediaPerc = avaliacoes.length > 0 ? Math.round((avaliacoes.reduce((a, b) => a + b, 0) / avaliacoes.length) * 20) : null;

    // 10. Computar Relatório de Horários de Pico (faixas horárias das 07h às 19h)
    const horasMap: Record<string, { total: number; dentroSla: number; foraSla: number; totalEspera: number; countEspera: number }> = {};
    const horasLista = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    for (const h of horasLista) {
      horasMap[h] = { total: 0, dentroSla: 0, foraSla: 0, totalEspera: 0, countEspera: 0 };
    }

    for (const r of normalized) {
      if (r.emissao !== '—') {
        const horaKey = r.emissao.split(':')[0] + ':00';
        if (!horasMap[horaKey]) {
          horasMap[horaKey] = { total: 0, dentroSla: 0, foraSla: 0, totalEspera: 0, countEspera: 0 };
        }
        horasMap[horaKey].total += 1;
        if (r.tempoEsperaMin !== null) {
          horasMap[horaKey].totalEspera += r.tempoEsperaMin;
          horasMap[horaKey].countEspera += 1;
          if (r.tempoEsperaMin <= config.slaMinutes) {
            horasMap[horaKey].dentroSla += 1;
          } else {
            horasMap[horaKey].foraSla += 1;
          }
        }
      }
    }

    const horariosPico = Object.entries(horasMap).map(([hora, val]) => ({
      hora,
      total: val.total,
      dentroSla: val.dentroSla,
      foraSla: val.foraSla,
      mediaEsperaMin: val.countEspera > 0 ? Math.round(val.totalEspera / val.countEspera) : 0,
    })).sort((a, b) => a.hora.localeCompare(b.hora));

    // 11. Computar Relatório de Performance dos Agentes
    const agentesMap: Record<string, {
      totalAtendimentos: number;
      totalEspera: number;
      countEspera: number;
      totalAtendimento: number;
      countAtendimento: number;
      dentroSla: number;
      desistencias: number;
      notas: number[];
    }> = {};

    for (const r of normalized) {
      const nome = r.atendente !== '—' ? r.atendente : 'Recepção / Triagem';
      if (!agentesMap[nome]) {
        agentesMap[nome] = {
          totalAtendimentos: 0,
          totalEspera: 0,
          countEspera: 0,
          totalAtendimento: 0,
          countAtendimento: 0,
          dentroSla: 0,
          desistencias: 0,
          notas: [],
        };
      }

      if (r.situacao === 'Desistência' || r.situacao === 'Cancelado') {
        agentesMap[nome].desistencias += 1;
      } else {
        agentesMap[nome].totalAtendimentos += 1;
      }

      if (r.tempoEsperaMin !== null) {
        agentesMap[nome].totalEspera += r.tempoEsperaMin;
        agentesMap[nome].countEspera += 1;
        if (r.tempoEsperaMin <= config.slaMinutes) {
          agentesMap[nome].dentroSla += 1;
        }
      }

      if (r.tempoAtendimentoMin !== null) {
        agentesMap[nome].totalAtendimento += r.tempoAtendimentoMin;
        agentesMap[nome].countAtendimento += 1;
      }

      if (r.avaliacao && r.avaliacao !== '—') {
        const num = parseFloat(r.avaliacao.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) agentesMap[nome].notas.push(num);
      }
    }

    const performanceAgentes = Object.entries(agentesMap).map(([atendente, val]) => ({
      atendente,
      totalAtendimentos: val.totalAtendimentos,
      mediaEsperaMin: val.countEspera > 0 ? Math.round(val.totalEspera / val.countEspera) : 0,
      mediaAtendimentoMin: val.countAtendimento > 0 ? Math.round(val.totalAtendimento / val.countAtendimento) : 0,
      dentroSlaPerc: val.countEspera > 0 ? Math.round((val.dentroSla / val.countEspera) * 1000) / 10 : 100,
      desistencias: val.desistencias,
      csatScore: val.notas.length > 0 ? Math.round((val.notas.reduce((a, b) => a + b, 0) / val.notas.length) * 20) : null,
    })).sort((a, b) => b.totalAtendimentos - a.totalAtendimentos);

    // 12. Normalizar Relatório de Suspensão (Pausas)
    const suspensoes = rawSuspensions.map((s: any) => {
      const inicio = formatTime(s.started_at || s.created_at);
      const fim = formatTime(s.ended_at);
      let duracaoMin: number | null = null;
      if (s.started_at && s.ended_at) {
        const iMs = safeParseDate(s.started_at);
        const fMs = safeParseDate(s.ended_at);
        if (iMs && fMs && fMs >= iMs) {
          duracaoMin = Math.round((fMs - iMs) / 60000);
        }
      }
      return {
        id: s._id || Math.random().toString(),
        atendente: s.user_label || 'Colaborador',
        motivo: s.reason_label || 'Intervalo / Pausa',
        inicio,
        fim,
        duracaoMin,
        emAndamento: !s.ended_at,
      };
    });

    // 13. Normalizar Relatório de Agendamentos
    const agendamentos = rawBookings.map((b: any) => ({
      id: b._id || Math.random().toString(),
      cliente: b.user_label || b.ticket_customer_name || 'Cliente',
      servico: b.schedule_label || 'Atendimento agendado',
      horario: formatTime(b.checkin_at || b.created_at),
      status: b.is_noshow_at ? 'Não compareceu' : (b.checkin_at ? 'Compareceu' : 'Agendado'),
      senha: b.ticket || '—',
    }));

    // 14. Atualizar lastSyncAt se houver tickets
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
      kpis: {
        slaGeralPerc,
        slaEsperaPerc,
        mediaEsperaMin,
        slaAtendimentoPerc,
        mediaAtendimentoMin,
        totalSenhas,
        totalAtendidas: atendidos.length,
        totalDesistencias: desistencias.length,
        csatMediaPerc,
        totalAgendamentos: agendamentos.length,
      },
      realtime: {
        fila: realtimeQueueNormalized,
        emAtendimento: realtimeOpenedNormalized,
      },
      horariosPico,
      performanceAgentes,
      suspensoes,
      agendamentos,
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

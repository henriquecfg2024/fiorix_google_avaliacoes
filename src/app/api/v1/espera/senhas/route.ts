import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { decryptConfig } from '@/lib/integration-crypto';

export const dynamic = 'force-dynamic';

/**
 * API de Gestão de Espera — proxy seguro para a API NextQS.
 *
 * - Lê as credenciais criptografadas do IntegrationConfig do tenant.
 * - Faz a requisição à API NextQS configurada.
 * - Retorna apenas os campos necessários para a interface, sem expor credenciais.
 * - Nunca retorna tokens, headers de autenticação ou payloads brutos.
 */

interface NextQSTicket {
  id?: string;
  senha?: string;
  ticket?: string;
  password?: string;
  servico?: string;
  service?: string;
  serviceName?: string;
  fila?: string;
  queue?: string;
  queueName?: string;
  emissao?: string;
  issueTime?: string;
  createdAt?: string;
  created_at?: string;
  chamada?: string;
  callTime?: string;
  calledAt?: string;
  called_at?: string;
  guiche?: string;
  counter?: string;
  counterName?: string;
  desk?: string;
  atendente?: string;
  attendant?: string;
  attendantName?: string;
  operator?: string;
  operatorName?: string;
  situacao?: string;
  status?: string;
  state?: string;
  [key: string]: unknown;
}

/**
 * Normaliza um ticket da API NextQS para o formato interno do FIORIX.
 * Aceita múltiplos nomes de campo possíveis, sem inventar valores.
 */
function normalizeTicket(raw: NextQSTicket, index: number) {
  const senha = raw.senha || raw.ticket || raw.password || raw.id || '—';
  const servico = raw.servico || raw.service || raw.serviceName || '—';
  const fila = raw.fila || raw.queue || raw.queueName || '—';
  const guiche = raw.guiche || raw.counter || raw.counterName || raw.desk || '—';
  const atendente = raw.atendente || raw.attendant || raw.attendantName || raw.operator || raw.operatorName || '—';
  const situacao = raw.situacao || raw.status || raw.state || '—';

  // Horários — extrair de múltiplas possibilidades
  const rawEmissao = raw.emissao || raw.issueTime || raw.createdAt || raw.created_at || null;
  const rawChamada = raw.chamada || raw.callTime || raw.calledAt || raw.called_at || null;

  const emissao = formatTime(rawEmissao);
  const chamada = formatTime(rawChamada);

  // Tempo de espera = chamada - emissão (calculado, não mockado)
  let tempoEsperaMin: number | null = null;
  if (rawEmissao && rawChamada) {
    const emissaoMs = parseDateTime(rawEmissao);
    const chamadaMs = parseDateTime(rawChamada);
    if (emissaoMs && chamadaMs && chamadaMs > emissaoMs) {
      tempoEsperaMin = Math.round((chamadaMs - emissaoMs) / 60000);
    }
  }

  return {
    id: `nqs-${index}-${senha}`,
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

function parseDateTime(value: string | null | undefined): number | null {
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
      // Pode ser apenas HH:MM ou HH:MM:SS
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

    // 1. Buscar configuração do NextQS para este tenant
    const config = await prisma.integrationConfig.findFirst({
      where: {
        tenantId,
        integrationId: 'nextqs',
        isActive: true,
      },
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

    // 2. Decriptografar credenciais no servidor
    let decryptedConfig: Record<string, unknown>;
    try {
      decryptedConfig = decryptConfig(config.encryptedConfig, config.configIv);
    } catch (err) {
      console.error('[Espera API] Erro ao decriptografar credenciais NextQS:', (err as Error).message);
      return NextResponse.json({
        configured: true,
        records: [],
        slaMinutes: config.slaMinutes,
        lastSyncAt: config.lastSyncAt?.toISOString() || null,
        error: 'Erro ao acessar credenciais da integração. Verifique a configuração.',
      });
    }

    const apiUrl = (decryptedConfig.apiUrl as string) || '';
    const apiKey = (decryptedConfig.apiKey as string) || '';
    const orgId = (decryptedConfig.orgId as string) || '';

    if (!apiUrl) {
      return NextResponse.json({
        configured: true,
        records: [],
        slaMinutes: config.slaMinutes,
        lastSyncAt: config.lastSyncAt?.toISOString() || null,
        error: 'URL da API NextQS não configurada.',
      });
    }

    // 3. Montar URL de consulta (adaptar ao endpoint real da NextQS)
    const searchParams = req.nextUrl.searchParams;
    const periodo = searchParams.get('periodo') || 'hoje';

    let dateFrom: string;
    let dateTo: string;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    switch (periodo) {
      case '7d': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        dateFrom = d.toISOString().split('T')[0];
        dateTo = todayStr;
        break;
      }
      case 'mes': {
        dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        dateTo = todayStr;
        break;
      }
      default: // hoje
        dateFrom = todayStr;
        dateTo = todayStr;
    }

    // Construir endpoint — adaptável ao padrão da API NextQS real
    const separator = apiUrl.includes('?') ? '&' : '?';
    const fetchUrl = `${apiUrl.replace(/\/$/, '')}/senhas${separator}dateFrom=${dateFrom}&dateTo=${dateTo}${orgId ? `&orgId=${encodeURIComponent(orgId)}` : ''}`;

    // 4. Requisição à API NextQS (com timeout e headers seguros)
    let rawTickets: NextQSTicket[] = [];
    let fetchError: string | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(orgId ? { 'X-Organization-Id': orgId } : {}),
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const statusText = response.statusText || 'Erro desconhecido';
        console.warn(`[Espera API] NextQS respondeu com ${response.status}: ${statusText}`);
        fetchError = `API NextQS retornou status ${response.status}.`;
      } else {
        const body = await response.json();
        // Aceitar array direto ou objeto com propriedade data/items/senhas/tickets
        if (Array.isArray(body)) {
          rawTickets = body;
        } else if (body && typeof body === 'object') {
          rawTickets = body.data || body.items || body.senhas || body.tickets || body.records || [];
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        fetchError = 'Timeout ao conectar à API NextQS (>10s).';
      } else {
        // Log server-side sanitizado — sem expor credenciais
        console.error('[Espera API] Erro ao consultar NextQS:', err.message);
        fetchError = 'Não foi possível conectar à API NextQS. Verifique a URL e as credenciais.';
      }
    }

    // 5. Normalizar e retornar
    const normalized = rawTickets.map((t, i) => normalizeTicket(t, i));

    // Log campos ausentes para diagnóstico (server-side only)
    if (normalized.length > 0) {
      const sample = normalized[0];
      const missingFields: string[] = [];
      if (sample.servico === '—') missingFields.push('servico');
      if (sample.fila === '—') missingFields.push('fila');
      if (sample.guiche === '—') missingFields.push('guiche');
      if (sample.atendente === '—') missingFields.push('atendente');
      if (sample.situacao === '—') missingFields.push('situacao');
      if (sample.emissao === '—') missingFields.push('emissao');
      if (sample.chamada === '—') missingFields.push('chamada');

      if (missingFields.length > 0) {
        console.warn(`[Espera API] Campos não encontrados no payload NextQS: ${missingFields.join(', ')}. Verifique o mapeamento.`);
      }
    }

    // Atualizar lastSyncAt na integração
    if (!fetchError && normalized.length > 0) {
      await prisma.integrationConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: new Date() },
      }).catch(() => {}); // Não falhar se o update falhar
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
      configured: false,
      records: [],
      slaMinutes: 15,
      lastSyncAt: null,
      error: 'Erro interno ao carregar dados de espera.',
    }, { status: 500 });
  }
}

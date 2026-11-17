import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { authenticateConnector } from '@/lib/connectorAuth';
import {
  ingestInfraBriefingSample,
  loadInfraBriefingDashboard,
  requestImmediateInfraBriefingRefresh,
} from '@/lib/infra-briefing/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole('MASTER', 'ADMIN', 'SUBSTITUTO', 'VISITANTE');
    const tenantId = user.tenantId || 'default-tenant';
    const requestedDate = req.nextUrl.searchParams.get('date');

    const snapshot = await loadInfraBriefingDashboard(tenantId, requestedDate);

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error ?? '');
    if (msg.includes('Acesso negado') || msg.includes('Não autorizado') || msg.includes('Sessão')) {
      return NextResponse.json(
        { error: 'Acesso não autorizado ao Briefing Matinal.' },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: 'Falha ao carregar o Briefing Matinal da infraestrutura.' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    // Ingestão M2M direta enviada pelo FIORIX Connector (SrvFiles)
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ') && action === 'ingest_infra_briefing') {
      const secret = authHeader.slice('Bearer '.length).trim();
      const connectorId = String(body?.connectorId || '').trim();
      const authResult = await authenticateConnector(connectorId, secret);
      if (!authResult.success || !authResult.tenant || !authResult.connector) {
        return NextResponse.json({ error: 'Credenciais do conector inválidas.' }, { status: 401 });
      }
      if (!body?.sample || typeof body.sample !== 'object' || Array.isArray(body.sample)) {
        return NextResponse.json({ error: 'Amostra do briefing matinal inválida.' }, { status: 400 });
      }
      const result = await ingestInfraBriefingSample(authResult.tenant.id, body.sample);
      return NextResponse.json(
        { ok: true, ...result },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const user = await requireRole('MASTER', 'ADMIN', 'SUBSTITUTO');
    const tenantId = user.tenantId || 'default-tenant';

    if (action === 'refresh_now') {
      const snapshot = await requestImmediateInfraBriefingRefresh(
        tenantId,
        user.name || user.email || 'Administrador',
      );
      return NextResponse.json(
        { ok: true, ...snapshot },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error ?? '');
    if (msg.includes('Acesso negado') || msg.includes('Não autorizado') || msg.includes('Sessão')) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Falha ao processar ação no Briefing Matinal.' },
      { status: 500 },
    );
  }
}

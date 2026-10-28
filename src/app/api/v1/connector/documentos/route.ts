import { NextResponse } from 'next/server';
import { authenticateConnector } from '@/lib/connectorAuth';
import { connectorMessage } from '@/lib/documental/contracts';
import { claimSearch, finishSearch } from '@/lib/documental/store';

export const dynamic = 'force-dynamic';
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(req: Request) {
  if (process.env.DOCUMENTAL_ENABLED !== 'true') return reply({ error: 'Módulo desabilitado.' }, 503);
  const secret = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!secret) return reply({ error: 'Não autorizado.' }, 401);
  try {
    const raw = await req.text();
    if (raw.length > 262144) return reply({ error: 'Limite excedido.' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'JSON inválido.' }, 400); }
    const parsed = connectorMessage.safeParse(body);
    if (!parsed.success) return reply({ error: 'Mensagem inválida.' }, 400);
    const message = parsed.data;
    const auth = await authenticateConnector(message.connectorId, secret);
    if (!auth.success || !auth.connector || !auth.tenant) return reply({ error: 'Não autorizado.' }, 401);
    const tenantId = auth.tenant.id;
    const connectorId = auth.connector.id;
    if (message.action === 'claim') return reply({ job: await claimSearch(tenantId, connectorId) });
    const count = await finishSearch(message.id, tenantId, connectorId,
      message.action === 'complete' ? message.result : null, message.action === 'fail');
    return count === 1 ? reply({ ok: true }) : reply({ error: 'Tarefa expirada ou indisponível.' }, 409);
  } catch { return reply({ error: 'Serviço documental indisponível.' }, 503); }
}

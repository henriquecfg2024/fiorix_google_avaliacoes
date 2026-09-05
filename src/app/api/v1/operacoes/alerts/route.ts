import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { sanitizeDatabaseError } from '@/lib/health/operations-service';
import {
  getAlertConfig,
  saveAlertConfig,
  getRecentAlertLogs,
  AlertChannelConfig,
} from '@/lib/alerts/alert-storage';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const alertConfigSchema = z.object({
  name: z.string().trim().min(1).max(100).optional().default('Webhook Principal'),
  webhookUrl: z.string().trim().url(),
  channelType: z.enum(['discord', 'slack', 'generic']).optional().default('generic'),
  enabled: z.boolean().optional().default(true),
  notifyConnectorOffline: z.boolean().optional().default(true),
  notifySyncFailed: z.boolean().optional().default(true),
  notifyModuleDelayed: z.boolean().optional().default(true),
  cooldownMinutes: z.number().int().min(1).max(1440).optional().default(15),
});

export async function GET() {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const tenantId = user.tenantId;

    const [config, logs] = await Promise.all([
      getAlertConfig(tenantId),
      getRecentAlertLogs(tenantId, 15),
    ]);

    return NextResponse.json(
      {
        config: config || {
          tenantId,
          name: 'Webhook Principal',
          webhookUrl: '',
          channelType: 'generic',
          enabled: false,
          notifyConnectorOffline: true,
          notifySyncFailed: true,
          notifyModuleDelayed: true,
          cooldownMinutes: 15,
          lastTriggeredAt: null,
        },
        logs,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    if (error.message?.includes('Acesso negado') || error.message?.includes('Não autorizado') || error.message?.includes('Sessão')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const sanitized = sanitizeDatabaseError(error);
    return NextResponse.json({ error: sanitized.message, code: sanitized.code }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const tenantId = user.tenantId;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 });
    }

    const parsed = alertConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.issues }, { status: 400 });
    }

    const saved = await saveAlertConfig(tenantId, parsed.data);
    return NextResponse.json({ success: true, config: saved });
  } catch (error: any) {
    if (error.message?.includes('Acesso negado') || error.message?.includes('Não autorizado') || error.message?.includes('Sessão')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const sanitized = sanitizeDatabaseError(error);
    return NextResponse.json({ error: sanitized.message, code: sanitized.code }, { status: 500 });
  }
}

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
  name: z.string().trim().min(1).max(100).optional().default('Notificações Principais'),
  webhookUrl: z.string().trim().optional().default(''),
  channelType: z.enum(['discord', 'slack', 'generic']).optional().default('generic'),
  enabled: z.boolean().optional().default(true),
  notifyConnectorOffline: z.boolean().optional().default(true),
  notifySyncFailed: z.boolean().optional().default(true),
  notifyModuleDelayed: z.boolean().optional().default(true),
  cooldownMinutes: z.number().int().min(1).max(1440).optional().default(15),

  // E-mail
  emailEnabled: z.boolean().optional().default(false),
  emailRecipients: z.string().optional().default(''),
  emailProvider: z.enum(['smtp', 'resend']).optional().default('smtp'),
  emailConfig: z.record(z.string(), z.any()).optional().default({}),

  // WhatsApp
  whatsappEnabled: z.boolean().optional().default(false),
  whatsappProvider: z.enum(['callmebot', 'evolution', 'zapi']).optional().default('callmebot'),
  whatsappPhone: z.string().optional().default(''),
  whatsappConfig: z.record(z.string(), z.any()).optional().default({}),
});

export async function GET() {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const tenantId = user.tenantId;

    const [config, logs] = await Promise.all([
      getAlertConfig(tenantId),
      getRecentAlertLogs(tenantId, 15),
    ]);

    // Mascarar senha SMTP na resposta do GET
    let sanitizedConfig = config;
    if (sanitizedConfig?.emailConfig?.pass) {
      sanitizedConfig = {
        ...sanitizedConfig,
        emailConfig: {
          ...sanitizedConfig.emailConfig,
          pass: '••••••••',
        },
      };
    }

    return NextResponse.json(
      {
        config: sanitizedConfig || {
          tenantId,
          name: 'Notificações Principais',
          webhookUrl: '',
          channelType: 'generic',
          enabled: false,
          notifyConnectorOffline: true,
          notifySyncFailed: true,
          notifyModuleDelayed: true,
          cooldownMinutes: 15,
          lastTriggeredAt: null,
          emailEnabled: false,
          emailRecipients: '',
          emailProvider: 'smtp',
          emailConfig: {},
          whatsappEnabled: false,
          whatsappProvider: 'callmebot',
          whatsappPhone: '',
          whatsappConfig: {},
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

    const payload = parsed.data;

    // Se a senha de SMTP enviada for o placeholder '••••••••', preservar a senha já salva
    if (payload.emailConfig?.pass === '••••••••' || !payload.emailConfig?.pass) {
      const existing = await getAlertConfig(tenantId);
      if (existing?.emailConfig?.pass) {
        payload.emailConfig.pass = existing.emailConfig.pass;
      }
    }

    const saved = await saveAlertConfig(tenantId, payload);
    return NextResponse.json({ success: true, config: saved });
  } catch (error: any) {
    if (error.message?.includes('Acesso negado') || error.message?.includes('Não autorizado') || error.message?.includes('Sessão')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const sanitized = sanitizeDatabaseError(error);
    return NextResponse.json({ error: sanitized.message, code: sanitized.code }, { status: 500 });
  }
}
